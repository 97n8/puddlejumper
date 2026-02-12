import crypto from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { canonicalize, sha256 } from "./hashing.js";
import { ALLOWED_INTENT_VALUES, CONNECTOR_PERMISSIONS, INTENT_PERMISSIONS, detectEmergencyJustification, detectInjection, isLaunchIntent, parseArchieve, toConnector, validateCharter, validateIntent, validateRecordedIntent, validateTrigger, validateTriggerType } from "./validation.js";
import { buildConnectorPlan } from "./connectors.js";
import { getSystemPromptText } from "../prompt/systemPrompt.js";
import { IdempotencyStore } from "./idempotencyStore.js";
import { CanonicalSourceError, DEFAULT_CANONICAL_ALLOWED_HOSTS, fetchCanonicalJsonDocument } from "../api/canonicalSource.js";
const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../");
const DEFAULT_IDEMPOTENCY_STORE = path.join(ROOT_DIR, "data", "idempotency.db");
const SYSTEM_PROMPT_VERSION = sha256(getSystemPromptText());
const ENGINE_SCHEMA_VERSION = 2;
function toUi(lcdStatus, text, severity, focus) {
    return {
        lcdStatus: lcdStatus.slice(0, 30),
        toast: { text, severity },
        focus
    };
}
function deepClone(value) {
    return JSON.parse(JSON.stringify(value));
}
function setPlans(output, plans) {
    output.actionPlan = plans;
    output.automationPlan = plans;
}
function parseCsv(value) {
    if (!value) {
        return [];
    }
    return value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
}
function resolveCanonicalSourceOptions(options = {}) {
    const envHosts = parseCsv(process.env.PJ_CANONICAL_HOST_ALLOWLIST).map((host) => host.toLowerCase());
    const optionHosts = (options.allowedHosts ?? []).map((host) => host.toLowerCase());
    const allowedHosts = Array.from(new Set([...DEFAULT_CANONICAL_ALLOWED_HOSTS, ...envHosts, ...optionHosts]));
    return {
        allowedHosts,
        timeoutMs: options.timeoutMs ?? 3000,
        maxBytes: options.maxBytes ?? 1_048_576,
        resolve4: options.resolve4,
        resolve6: options.resolve6,
        fetchImpl: options.fetchImpl
    };
}
async function verifyCanonicalPlan(metadata, computedPlanHash, canonicalSourceOptions) {
    const canonicalUrl = typeof metadata.canonicalUrl === "string" ? metadata.canonicalUrl.trim() : "";
    const canonicalSha = typeof metadata.canonicalSha === "string" ? metadata.canonicalSha.trim() : "";
    if (!canonicalUrl && !canonicalSha) {
        return { ok: true };
    }
    if (!canonicalUrl || !canonicalSha) {
        return {
            ok: false,
            reason: "Invalid canonical source.",
            details: { reason: "canonical_metadata_incomplete" }
        };
    }
    let canonicalContent = "";
    try {
        canonicalContent = await fetchCanonicalJsonDocument(canonicalUrl, canonicalSourceOptions);
    }
    catch (error) {
        if (error instanceof CanonicalSourceError) {
            return {
                ok: false,
                reason: error.message,
                details: error.details
            };
        }
        return {
            ok: false,
            reason: "Plan integrity check failed: canonical source unavailable.",
            details: { canonicalUrl, canonicalSha }
        };
    }
    const fetchedSha = sha256(canonicalContent);
    if (fetchedSha !== canonicalSha) {
        return {
            ok: false,
            reason: "Plan has diverged from canonical. Expected SHA does not match source content.",
            details: { expectedSha: canonicalSha, fetchedSha, canonicalUrl }
        };
    }
    let canonicalPlanHash = "";
    try {
        const parsed = JSON.parse(canonicalContent);
        canonicalPlanHash = String(parsed.planHash ?? parsed.auditRecord?.planHash ?? "").trim();
    }
    catch {
        return {
            ok: false,
            reason: "Plan integrity check failed: canonical artifact is invalid JSON.",
            details: { canonicalUrl, canonicalSha }
        };
    }
    if (!canonicalPlanHash) {
        return {
            ok: false,
            reason: "Plan integrity check failed: canonical artifact missing planHash.",
            details: { canonicalUrl, canonicalSha }
        };
    }
    if (canonicalPlanHash !== computedPlanHash) {
        return {
            ok: false,
            reason: "Plan has diverged from canonical. Re-sync required.",
            details: { expectedPlanHash: canonicalPlanHash, actualPlanHash: computedPlanHash, canonicalSha }
        };
    }
    return { ok: true };
}
function getConnectorHealth(metadata, connector) {
    const health = metadata?.connectorHealth && typeof metadata.connectorHealth === "object"
        ? metadata.connectorHealth
        : metadata?.connectorStatus && typeof metadata.connectorStatus === "object"
            ? metadata.connectorStatus
            : undefined;
    if (!health || !(connector in health)) {
        return true;
    }
    const status = health[connector];
    if (typeof status === "boolean") {
        return status;
    }
    if (typeof status === "string") {
        return !/(unavailable|unreachable|error|down|invalid)/i.test(status);
    }
    return true;
}
function resolveEvidence(payload) {
    const evidence = payload.action.trigger.evidence;
    if (!evidence || typeof evidence !== "object") {
        return { statute: "", policyKey: "", valid: false };
    }
    const statuteKey = typeof evidence.statuteKey === "string" ? evidence.statuteKey : "";
    const citation = typeof evidence.citation === "string" ? evidence.citation : "";
    const statute = typeof evidence.statute === "string" ? evidence.statute : "";
    const policyKey = typeof evidence.policyKey === "string" ? evidence.policyKey : "";
    const statuteFromMap = statuteKey && payload.municipality.statutes?.[statuteKey] ? payload.municipality.statutes[statuteKey] : "";
    const resolvedStatute = statuteFromMap || statute || citation;
    return {
        statute: resolvedStatute,
        policyKey,
        valid: Boolean(resolvedStatute || policyKey)
    };
}
function permissionSetFor(intent, connectors) {
    const required = new Set((INTENT_PERMISSIONS[intent] ?? ["deploy"]).map((value) => value.toLowerCase()));
    for (const connector of connectors) {
        const byConnector = CONNECTOR_PERMISSIONS[connector] ?? [];
        for (const permission of byConnector) {
            required.add(permission.toLowerCase());
        }
    }
    return required;
}
function delegationActive(from, until, at) {
    const nowMs = Date.parse(at);
    if (!Number.isFinite(nowMs)) {
        return false;
    }
    if (from) {
        const fromMs = Date.parse(from);
        if (!Number.isFinite(fromMs)) {
            return false;
        }
        if (fromMs > nowMs) {
            return false;
        }
    }
    if (!until) {
        return true;
    }
    const untilMs = Date.parse(until);
    if (!Number.isFinite(untilMs)) {
        return false;
    }
    return untilMs >= nowMs;
}
function delegationMatches(scope, intent, permissions, connectors) {
    const normalized = new Set((scope ?? []).map((s) => s.toLowerCase()));
    if (normalized.has("*")) {
        return true;
    }
    if (normalized.has(intent.toLowerCase()) || normalized.has(`intent:${intent.toLowerCase()}`)) {
        return true;
    }
    for (const permission of permissions) {
        if (normalized.has(permission) || normalized.has(`permission:${permission}`)) {
            return true;
        }
    }
    for (const connector of connectors) {
        if (normalized.has(connector) || normalized.has(`connector:${connector}`)) {
            return true;
        }
    }
    return false;
}
function parseEpoch(value) {
    if (!value) {
        return Number.NEGATIVE_INFINITY;
    }
    const epoch = Date.parse(value);
    return Number.isFinite(epoch) ? epoch : Number.NEGATIVE_INFINITY;
}
function normalizePrecedence(value) {
    if (typeof value === "number" && Number.isFinite(value)) {
        return value;
    }
    const parsed = Number.parseInt(String(value ?? 0), 10);
    return Number.isFinite(parsed) ? parsed : 0;
}
function delegationId(delegation) {
    return (delegation.id ??
        `${delegation.delegator ?? "unknown"}:${delegation.from ?? "open"}:${delegation.until ?? delegation.to ?? "open"}:${(delegation.scope ?? []).join("|")}`);
}
function checkAuthority(payload, connectors) {
    const required = permissionSetFor(payload.action.intent, connectors);
    const operatorPermissions = new Set((payload.operator.permissions ?? []).map((p) => p.toLowerCase()));
    // Role authority is the first decision path and takes precedence when it fully covers requirements.
    const roleCovers = Array.from(required).every((permission) => operatorPermissions.has(permission));
    if (roleCovers) {
        return {
            allowed: true,
            required: Array.from(required),
            delegationUsed: "",
            delegationEvaluation: {
                source: "role",
                evaluatedAt: payload.timestamp,
                requiredPermissions: Array.from(required),
                consideredDelegations: 0
            }
        };
    }
    const delegations = (payload.operator.delegations ?? []).filter((delegation) => delegationActive(delegation.from, delegation.until ?? delegation.to, payload.timestamp));
    const matchingDelegations = delegations.filter((delegation) => delegationMatches(delegation.scope, payload.action.intent, required, connectors));
    if (matchingDelegations.length === 0) {
        return {
            allowed: false,
            required: Array.from(required),
            delegationUsed: "",
            reason: "insufficient_permissions",
            delegationEvaluation: {
                source: "delegation",
                evaluatedAt: payload.timestamp,
                requiredPermissions: Array.from(required),
                consideredDelegations: 0
            }
        };
    }
    matchingDelegations.sort((a, b) => {
        const precedenceDelta = normalizePrecedence(b.precedence) - normalizePrecedence(a.precedence);
        if (precedenceDelta !== 0) {
            return precedenceDelta;
        }
        const fromDelta = parseEpoch(b.from) - parseEpoch(a.from);
        if (fromDelta !== 0) {
            return fromDelta;
        }
        return delegationId(a).localeCompare(delegationId(b));
    });
    if (matchingDelegations.length > 1) {
        const first = matchingDelegations[0];
        const second = matchingDelegations[1];
        const precedenceTie = normalizePrecedence(first.precedence) === normalizePrecedence(second.precedence);
        const fromTie = parseEpoch(first.from) === parseEpoch(second.from);
        if (precedenceTie && fromTie) {
            return {
                allowed: false,
                required: Array.from(required),
                delegationUsed: "",
                reason: "delegation_ambiguity",
                delegationEvaluation: {
                    source: "delegation",
                    evaluatedAt: payload.timestamp,
                    requiredPermissions: Array.from(required),
                    consideredDelegations: matchingDelegations.length,
                    ambiguity: true,
                    candidates: matchingDelegations.slice(0, 4).map((delegation) => ({
                        id: delegationId(delegation),
                        delegator: delegation.delegator ?? null,
                        scope: delegation.scope ?? [],
                        precedence: normalizePrecedence(delegation.precedence),
                        from: delegation.from ?? null
                    }))
                }
            };
        }
    }
    const chosen = matchingDelegations[0];
    const chosenId = delegationId(chosen);
    return {
        allowed: true,
        required: Array.from(required),
        delegationUsed: chosenId,
        delegationEvaluation: {
            source: "delegation",
            evaluatedAt: payload.timestamp,
            requiredPermissions: Array.from(required),
            consideredDelegations: matchingDelegations.length,
            used: {
                id: chosenId,
                delegator: chosen.delegator ?? null,
                scope: chosen.scope ?? [],
                precedence: normalizePrecedence(chosen.precedence),
                from: chosen.from ?? null,
                until: chosen.until ?? chosen.to ?? null
            }
        }
    };
}
function baseOutput(input, schemaVersion) {
    return {
        status: "rejected",
        approved: false,
        schemaVersion,
        actionPlan: [],
        automationPlan: [],
        auditRecord: {
            eventId: crypto.randomUUID(),
            workspaceId: input.workspace?.id ?? "",
            operatorId: input.operator?.id ?? "",
            municipalityId: input.municipality?.id ?? "",
            timestamp: input.timestamp ?? new Date().toISOString(),
            trigger: input.action?.trigger?.type ?? "",
            intent: input.action?.intent ?? "",
            rationale: "",
            schemaVersion,
            evidence: {
                statute: "",
                policyKey: "",
                delegationUsed: "",
                permissionCheck: "",
                mode: "governed",
                systemPromptVersion: SYSTEM_PROMPT_VERSION,
                connectorEvidence: {}
            },
            planHash: ""
        },
        notices: [],
        nextSteps: [],
        warnings: [],
        uiFeedback: toUi("Awaiting decision", "Validation pending", "info", null)
    };
}
function fail(output, reason, warning, nextStep, focus) {
    output.status = "rejected";
    output.approved = false;
    output.auditRecord.rationale = reason;
    output.warnings.push(warning);
    output.nextSteps.push(nextStep);
    output.uiFeedback = toUi("Blocked", warning, "error", focus);
    return output;
}
function isInputPayload(value) {
    return Boolean(value && typeof value === "object");
}
function resolveMode(action) {
    if (action.mode === "launch" || action.mode === "governed") {
        return action.mode;
    }
    return isLaunchIntent(action.intent) ? "launch" : "governed";
}
function resolveConnectorForIntent(intent, target) {
    const connector = toConnector(target);
    if (connector !== "none") {
        return connector;
    }
    if (intent === "open_repository" && /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+/.test(target)) {
        return "github";
    }
    if (intent === "open_365_location") {
        return "sharepoint";
    }
    if (intent === "run_automation") {
        return "powerautomate";
    }
    return "none";
}
function parseGithubReference(target) {
    const raw = target.startsWith("github:") ? target.slice("github:".length) : target;
    const [owner = "", repoAndTail = ""] = raw.split("/");
    const repo = repoAndTail.split(":")[0] ?? "";
    return { owner, repo };
}
function buildLaunchPlan(intent, target, connector, metadata) {
    if (intent === "open_repository") {
        const parsed = parseGithubReference(target);
        return {
            mode: "open",
            owner: parsed.owner,
            repo: parsed.repo,
            target
        };
    }
    if (intent === "open_365_location") {
        return {
            mode: "open",
            location: target,
            target
        };
    }
    if (intent === "run_automation") {
        return {
            mode: "run",
            automationId: metadata.automationId ?? (target.includes(":") ? target.split(":").slice(1).join(":") : target),
            target
        };
    }
    return {
        mode: "health_check",
        connector,
        target: target || "system"
    };
}
function buildLaunchDescription(intent, connector, target) {
    if (intent === "open_repository") {
        return `Resolve and open GitHub repository ${target}`;
    }
    if (intent === "open_365_location") {
        return `Resolve and open Microsoft 365 location ${target}`;
    }
    if (intent === "run_automation") {
        return `Trigger automation target ${target}`;
    }
    return `Run connector health check${connector === "none" ? "" : ` for ${connector}`}`;
}
function launchNotice(intent) {
    if (intent === "open_repository") {
        return "Repository ready";
    }
    if (intent === "open_365_location") {
        return "Microsoft 365 location ready";
    }
    if (intent === "run_automation") {
        return "Automation trigger prepared";
    }
    return "Health check ready";
}
function launchLcd(intent, connector) {
    if (intent === "open_repository") {
        return "OPEN -> GITHUB";
    }
    if (intent === "open_365_location") {
        return "OPEN -> M365";
    }
    if (intent === "run_automation") {
        return "RUN -> AUTOMATION";
    }
    if (connector !== "none") {
        return `CHECK -> ${connector.toUpperCase()}`;
    }
    return "CHECK -> SYSTEM";
}
function intentRemediation(allowed) {
    return `Intent must include: action type, target, and reason. Accepted action types: ${allowed.join(", ")}. Example: "Deploy VAULTPRR to hubb-prod - ship test passed, board approved 2026-02-10".`;
}
function strictModeRestricted(payload) {
    if (payload.municipality?.risk_profile?.strict_mode !== true) {
        return false;
    }
    if (payload.action.metadata?.restricted === true) {
        return true;
    }
    const patterns = [/restricted/i, /sealed/i, /secret/i, /private/i];
    return payload.action.targets.some((target) => patterns.some((pattern) => pattern.test(target)));
}
function actionForPlanHash(action) {
    const metadataRecord = action.metadata && typeof action.metadata === "object" ? action.metadata : {};
    const { canonicalUrl: _canonicalUrl, canonicalSha: _canonicalSha, ...metadataWithoutCanonical } = metadataRecord;
    return {
        ...action,
        requestId: undefined,
        metadata: metadataWithoutCanonical
    };
}
function planForHash(plan) {
    const { requestId: _requestId, ...rest } = plan;
    return rest;
}
export function createGovernanceEngine(options = {}) {
    const idempotencyStorePath = options.idempotencyStorePath ?? process.env.IDEMPOTENCY_DB_PATH ?? DEFAULT_IDEMPOTENCY_STORE;
    const ttlHoursRaw = options.idempotencyTtlHours ?? Number.parseInt(process.env.IDEMPOTENCY_TTL_HOURS ?? "24", 10);
    const idempotencyTtlHours = Number.isFinite(ttlHoursRaw) && ttlHoursRaw > 0 ? ttlHoursRaw : 24;
    const schemaVersion = Number.isFinite(options.schemaVersion) && (options.schemaVersion ?? 0) > 0
        ? Number(options.schemaVersion)
        : ENGINE_SCHEMA_VERSION;
    const canonicalSourceOptions = resolveCanonicalSourceOptions(options.canonicalSourceOptions);
    const idempotencyStore = new IdempotencyStore(idempotencyStorePath);
    void options.auditLogPath;
    async function evaluate(input) {
        const output = baseOutput(input ?? {}, schemaVersion);
        let finalResult = null;
        const finish = (result) => {
            finalResult = result;
            return result;
        };
        let requestId = "";
        let requestClaimed = false;
        try {
            if (!isInputPayload(input)) {
                return finish(fail(output, "Input must be a JSON object.", "Invalid input payload", { type: "fix_payload", details: { required: "single JSON object" } }, "input-json"));
            }
            const payloadHash = sha256(canonicalize(input));
            const providedRequestId = typeof input.action?.requestId === "string" ? input.action.requestId.trim() : "";
            requestId = providedRequestId || `auto-${output.auditRecord.eventId}`;
            const requestTimeMs = Date.now();
            const requestTimeIso = new Date(requestTimeMs).toISOString();
            const expiresAtIso = new Date(requestTimeMs + idempotencyTtlHours * 60 * 60 * 1000).toISOString();
            const claim = await idempotencyStore.claim(requestId, payloadHash, requestTimeIso, expiresAtIso, schemaVersion);
            if (claim.type === "replay") {
                return deepClone(claim.output);
            }
            if (claim.type === "pending") {
                return deepClone(await claim.promise);
            }
            if (claim.type === "schema_mismatch") {
                return finish(fail(output, "Stored requestId schema version does not match current engine schema.", "Idempotency schema version mismatch", {
                    type: "refresh_request_id",
                    details: {
                        requestId,
                        currentSchemaVersion: schemaVersion,
                        storedSchemaVersion: claim.storedSchemaVersion
                    }
                }, "request-id"));
            }
            if (claim.type === "conflict") {
                return finish(fail(output, "This requestId was used with a different operation. Use a new requestId.", "Idempotency conflict", { type: "regenerate_request_id", details: { requestId } }, "request-id"));
            }
            requestClaimed = true;
            if (detectInjection(input.action)) {
                return finish(fail(output, "Injection attempt detected in action payload.", "Injection attempt detected", { type: "contact_admin", details: { reason: "Potential prompt injection" } }, "input-json"));
            }
            const intentError = validateIntent(input.action);
            if (intentError) {
                const remediation = intentRemediation(ALLOWED_INTENT_VALUES);
                return finish(fail(output, intentError, remediation, {
                    type: "fix_intent",
                    details: {
                        allowed: ALLOWED_INTENT_VALUES,
                        remediation
                    }
                }, "action-intent"));
            }
            const mode = resolveMode(input.action);
            output.auditRecord.evidence.mode = mode;
            const triggerTypeError = validateTriggerType(input.action);
            if (triggerTypeError) {
                return finish(fail(output, triggerTypeError, triggerTypeError, { type: "fix_trigger", details: { required: "action.trigger.type" } }, "trigger-type"));
            }
            if (mode === "launch") {
                const targets = Array.isArray(input.action.targets) ? input.action.targets : [];
                if (input.action.intent !== "health_check" && targets.length === 0) {
                    return finish(fail(output, "No targets provided", "No targets provided", { type: "add_target", details: { required: "action.targets[]" } }, "targets-list"));
                }
                if (strictModeRestricted(input)) {
                    return finish(fail(output, "Target restricted by risk_profile.strict_mode", "Restricted target blocked in strict mode", { type: "request_override", details: { approverRole: "selectboard" } }, "targets-list"));
                }
                const resolvedTargets = targets.length === 0 ? ["health:system"] : targets;
                const launchPairs = resolvedTargets.map((target) => ({
                    target,
                    connector: resolveConnectorForIntent(input.action.intent, target)
                }));
                const connectors = Array.from(new Set(launchPairs.map((pair) => pair.connector).filter((connector) => connector !== "none")));
                const authority = checkAuthority(input, connectors);
                output.auditRecord.evidence.delegationUsed = authority.delegationUsed;
                output.auditRecord.evidence.permissionCheck = authority.required.join(",");
                output.auditRecord.evidence.delegationEvaluation = authority.delegationEvaluation;
                if (!authority.allowed) {
                    const reason = authority.reason === "delegation_ambiguity" ? "Delegation ambiguity" : "Authority check failed";
                    return finish(fail(output, reason, reason, {
                        type: authority.reason === "delegation_ambiguity" ? "resolve_delegation_ambiguity" : "request_approval",
                        details: { requiredPermissions: authority.required, approverRole: "selectboard" }
                    }, "operator-permissions"));
                }
                const launchSteps = launchPairs.map((pair, index) => {
                    const stepId = `s${index + 1}`;
                    return {
                        stepId,
                        description: buildLaunchDescription(input.action.intent, pair.connector, pair.target),
                        requiresApproval: false,
                        connector: pair.connector,
                        status: "ready",
                        plan: buildLaunchPlan(input.action.intent, pair.target, pair.connector, input.action.metadata)
                    };
                });
                const hashPayload = {
                    action: actionForPlanHash(input.action),
                    preparedPlans: launchSteps.map((step) => ({
                        stepId: step.stepId,
                        connector: step.connector,
                        plan: planForHash(step.plan)
                    }))
                };
                const planHash = sha256(canonicalize(hashPayload));
                const expectedPlanHash = typeof input.action.metadata?.expectedPlanHash === "string"
                    ? input.action.metadata.expectedPlanHash.trim()
                    : "";
                if (expectedPlanHash && expectedPlanHash !== planHash) {
                    return finish(fail(output, "Plan integrity mismatch", "Plan integrity mismatch", { type: "rebuild_payload", details: { expectedPlanHash, computedPlanHash: planHash } }, "payload-preview"));
                }
                const canonicalCheck = await verifyCanonicalPlan(input.action.metadata, planHash, canonicalSourceOptions);
                if (!canonicalCheck.ok) {
                    return finish(fail(output, canonicalCheck.reason, canonicalCheck.reason, { type: "resync_canonical_plan", details: canonicalCheck.details }, "payload-preview"));
                }
                const finalSteps = launchSteps.map((step) => ({
                    ...step,
                    plan: { ...step.plan, planHash }
                }));
                setPlans(output, finalSteps);
                output.status = "approved";
                output.approved = true;
                output.auditRecord.planHash = planHash;
                output.auditRecord.rationale =
                    "Launcher intent processed as navigational action. No policy, statutory, or record-modifying operation was triggered.";
                output.auditRecord.evidence.connectorEvidence = Object.fromEntries(finalSteps.map((step) => [step.connector, { prepared: true, target: step.plan.target }]));
                const primaryConnector = finalSteps[0]?.connector ?? "none";
                output.notices.push(launchNotice(input.action.intent));
                output.uiFeedback = toUi(launchLcd(input.action.intent, primaryConnector), input.action.intent === "run_automation" ? "Automation triggered" : "Launcher action ready", "success", null);
                return finish(output);
            }
            const charterError = validateCharter(input.workspace);
            if (charterError) {
                return finish(fail(output, charterError, "Workspace not chartered", {
                    type: "update_charter",
                    details: { required: ["authority", "accountability", "boundary", "continuity"] }
                }, "workspace-charter"));
            }
            const triggerError = validateTrigger(input.action);
            if (triggerError) {
                return finish(fail(output, triggerError, triggerError, {
                    type: "attach_evidence",
                    details: { required: ["trigger.type", "trigger.evidence.statute|citation|policyKey"] }
                }, "trigger-evidence"));
            }
            const recordedIntentError = validateRecordedIntent(input.action);
            if (recordedIntentError) {
                return finish(fail(output, recordedIntentError, recordedIntentError, { type: "record_intent", details: { field: "action.metadata.description" } }, "intent-description"));
            }
            const arch = parseArchieve(input.action.metadata?.archieve);
            if (!arch.ok) {
                return finish(fail(output, arch.reason, arch.reason, {
                    type: "fix_archieve",
                    details: {
                        requiredFormat: "[DEPT]_[TYPE]_[YYYY-MM-DD]_[SEQ]_vN",
                        requiredFields: ["dept", "type", "date", "seq", "v"]
                    }
                }, "archieve-fields"));
            }
            if (!Array.isArray(input.action.targets) || input.action.targets.length === 0) {
                return finish(fail(output, "No targets provided", "No targets provided", { type: "add_target", details: { required: "action.targets[]" } }, "targets-list"));
            }
            const connectorPairs = input.action.targets.map((target) => ({ target, connector: toConnector(target) }));
            if (connectorPairs.some((pair) => pair.connector === "none")) {
                return finish(fail(output, "Unsupported connector target found", "Unsupported connector target", {
                    type: "fix_targets",
                    details: {
                        allowedConnectors: ["sharepoint", "powerautomate", "aad", "civicplus", "google", "github", "vault"]
                    }
                }, "targets-list"));
            }
            const connectors = Array.from(new Set(connectorPairs.map((pair) => pair.connector)));
            const authority = checkAuthority(input, connectors);
            output.auditRecord.evidence.delegationUsed = authority.delegationUsed;
            output.auditRecord.evidence.permissionCheck = authority.required.join(",");
            output.auditRecord.evidence.delegationEvaluation = authority.delegationEvaluation;
            if (!authority.allowed) {
                const reason = authority.reason === "delegation_ambiguity" ? "Delegation ambiguity" : "Authority check failed";
                return finish(fail(output, reason, reason, {
                    type: authority.reason === "delegation_ambiguity" ? "resolve_delegation_ambiguity" : "request_approval",
                    details: { requiredPermissions: authority.required, approverRole: "selectboard" }
                }, "operator-permissions"));
            }
            for (const connector of connectors) {
                if (!getConnectorHealth(input.action.metadata, connector)) {
                    return finish(fail(output, `Connector unavailable - ${connector}`, `Connector unavailable - ${connector}`, { type: "repair_connector", details: { connector } }, "connector-health"));
                }
            }
            const evidence = resolveEvidence(input);
            output.auditRecord.evidence.statute = evidence.statute;
            output.auditRecord.evidence.policyKey = evidence.policyKey;
            if (!evidence.valid) {
                return finish(fail(output, "Missing trigger evidence", "Missing trigger evidence", {
                    type: "attach_evidence",
                    details: { required: ["trigger.evidence.statute|citation", "trigger.evidence.policyKey"] }
                }, "trigger-evidence"));
            }
            const preparedPlans = connectorPairs.map((pair, index) => {
                const stepId = `s${index + 1}`;
                const plan = buildConnectorPlan(pair.connector, {
                    target: pair.target,
                    metadata: input.action.metadata,
                    fileStem: arch.fileStem,
                    retention: arch.retention,
                    intent: input.action.intent,
                    requestId: requestId || undefined,
                    stepId
                });
                return {
                    stepId,
                    description: `Prepare ${pair.connector} action for ${pair.target}`,
                    connector: pair.connector,
                    plan
                };
            });
            const hashPayload = {
                action: actionForPlanHash(input.action),
                preparedPlans: preparedPlans.map((item) => ({
                    stepId: item.stepId,
                    connector: item.connector,
                    plan: planForHash(item.plan)
                }))
            };
            const planHash = sha256(canonicalize(hashPayload));
            const expectedPlanHash = typeof input.action.metadata?.expectedPlanHash === "string"
                ? input.action.metadata.expectedPlanHash.trim()
                : "";
            if (expectedPlanHash && expectedPlanHash !== planHash) {
                return finish(fail(output, "Plan integrity mismatch", "Plan integrity mismatch", { type: "retry_prepare", details: { expectedPlanHash, computedPlanHash: planHash } }, null));
            }
            const finalPlans = preparedPlans.map((item) => {
                const plan = { ...item.plan, planHash };
                if (typeof plan.commitMessageTemplate === "string") {
                    plan.commitMessage = plan.commitMessageTemplate.replace("{planHash}", planHash);
                }
                return {
                    stepId: item.stepId,
                    description: item.description,
                    requiresApproval: false,
                    connector: item.connector,
                    status: "ready",
                    plan
                };
            });
            setPlans(output, finalPlans);
            output.auditRecord.planHash = planHash;
            output.auditRecord.rationale =
                "All fail-closed governance checks passed: charter, trigger evidence, authority/delegation, ARCHIEVE metadata, and connector readiness.";
            output.auditRecord.evidence.connectorEvidence = Object.fromEntries(finalPlans.map((step) => [step.connector, { prepared: true, target: step.plan.target }]));
            output.notices.push(`Prepared ${finalPlans.length} connector plan(s)`);
            output.notices.push(`ARCHIEVE name: ${arch.fileStem}`);
            if (!arch.explicitType) {
                output.warnings.push("ARCHIEVE type not mapped explicitly; default retention route applied");
            }
            const isEmergency = input.action.metadata?.urgency === "emergency";
            if (isEmergency) {
                if (!detectEmergencyJustification(input.action.trigger.evidence)) {
                    return finish(fail(output, "Emergency evidence insufficient", "Emergency evidence insufficient", {
                        type: "attach_public_safety_basis",
                        details: { required: "trigger.evidence.publicSafety=true or equivalent citation" }
                    }, "trigger-evidence"));
                }
                output.warnings.push("Emergency bypass invoked - high risk");
                output.nextSteps.push({
                    type: "post_action_notice",
                    details: {
                        deadline: "48h",
                        channel: "official_town_site",
                        requirement: "Publish post-action emergency notice and include statutory evidence."
                    }
                });
            }
            const canonicalCheck = await verifyCanonicalPlan(input.action.metadata, planHash, canonicalSourceOptions);
            if (!canonicalCheck.ok) {
                return finish(fail(output, canonicalCheck.reason, canonicalCheck.reason, { type: "resync_canonical_plan", details: canonicalCheck.details }, "payload-preview"));
            }
            output.status = "approved";
            output.approved = true;
            output.uiFeedback = toUi("Ready to dispatch", "Governed plan prepared", "success", null);
            return finish(output);
        }
        catch (error) {
            if (requestId && requestClaimed) {
                idempotencyStore.abandon(requestId);
            }
            throw error;
        }
        finally {
            if (requestId && requestClaimed && finalResult) {
                const persistedResult = finalResult;
                idempotencyStore.storeResult(requestId, deepClone(persistedResult), schemaVersion, persistedResult.status, persistedResult.auditRecord);
            }
        }
    }
    return { evaluate, systemPromptVersion: SYSTEM_PROMPT_VERSION, schemaVersion };
}
export function createDefaultEngine(options = {}) {
    return createGovernanceEngine(options);
}
