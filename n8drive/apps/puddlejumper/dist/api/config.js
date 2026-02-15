// ── Configuration, env-parsing, and runtime resolution ──────────────────────
import path from "node:path";
// ── Constants ───────────────────────────────────────────────────────────────
export const SESSION_COOKIE_NAME = "jwt";
export const SESSION_MAX_AGE_MS = 8 * 60 * 60 * 1000;
export const LOGIN_WINDOW_MS = 60_000;
export const LOGIN_MAX_ATTEMPTS = 10;
export const CORRELATION_ID_HEADER = "x-correlation-id";
export const CORRELATION_ID_PATTERN = /^[A-Za-z0-9._:-]{8,128}$/;
export const DEFAULT_ACCESS_NOTIFICATION_INTERVAL_MS = 30_000;
export const DEFAULT_ACCESS_NOTIFICATION_BATCH_SIZE = 25;
export const DEFAULT_ACCESS_NOTIFICATION_MAX_RETRIES = 8;
export const MS_GRAPH_TOKEN_HEADER = "x-ms-graph-token";
export const DEFAULT_GRAPH_PROFILE_URL = "https://graph.microsoft.com/v1.0/me?$select=id,displayName,mail,userPrincipalName";
// ── Primitive helpers ───────────────────────────────────────────────────────
export function asTrimmedString(value) {
    return typeof value === "string" ? value.trim() : "";
}
export function asStringArray(value) {
    if (!Array.isArray(value)) {
        return [];
    }
    return value
        .map((entry) => asTrimmedString(entry))
        .filter(Boolean);
}
export function asRecord(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
        return null;
    }
    return value;
}
export function parseJsonFromEnv(name) {
    const raw = process.env[name];
    if (!raw) {
        return null;
    }
    try {
        return JSON.parse(raw);
    }
    catch {
        return null;
    }
}
export function parseEnvPositiveInt(value) {
    if (typeof value !== "string" || !value.trim()) {
        return null;
    }
    const parsed = Number.parseInt(value, 10);
    if (!Number.isFinite(parsed) || parsed <= 0) {
        return null;
    }
    return parsed;
}
export function parseCsv(value) {
    if (!value) {
        return [];
    }
    return value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
}
export function normalizePrincipal(value) {
    return typeof value === "string" ? value.trim().toLowerCase() : "";
}
export function parsePrincipalSet(value) {
    return new Set(parseCsv(value).map((entry) => normalizePrincipal(entry)).filter(Boolean));
}
// ── Runtime context normalizers ─────────────────────────────────────────────
export function normalizeRuntimeContext(value) {
    const objectValue = asRecord(value);
    if (!objectValue) {
        return null;
    }
    const workspaceValue = asRecord(objectValue.workspace);
    const municipalityValue = asRecord(objectValue.municipality);
    if (!workspaceValue || !municipalityValue) {
        return null;
    }
    const charterValue = asRecord(workspaceValue.charter);
    if (!charterValue) {
        return null;
    }
    const charter = {
        authority: charterValue.authority === true,
        accountability: charterValue.accountability === true,
        boundary: charterValue.boundary === true,
        continuity: charterValue.continuity === true,
    };
    const workspaceId = asTrimmedString(workspaceValue.id);
    const municipalityId = asTrimmedString(municipalityValue.id);
    if (!workspaceId || !municipalityId) {
        return null;
    }
    const workspace = {
        id: workspaceId,
        charter,
        ...(asTrimmedString(workspaceValue.name) ? { name: asTrimmedString(workspaceValue.name) } : {}),
    };
    const municipality = {
        id: municipalityId,
        ...(asTrimmedString(municipalityValue.name) ? { name: asTrimmedString(municipalityValue.name) } : {}),
        ...(asTrimmedString(municipalityValue.state) ? { state: asTrimmedString(municipalityValue.state) } : {}),
        ...(typeof municipalityValue.population === "number" && Number.isFinite(municipalityValue.population)
            ? { population: Math.max(0, Math.floor(municipalityValue.population)) }
            : {}),
        ...(asRecord(municipalityValue.statutes) ? { statutes: municipalityValue.statutes } : {}),
        ...(asRecord(municipalityValue.policies)
            ? { policies: municipalityValue.policies }
            : {}),
        ...(asRecord(municipalityValue.risk_profile)
            ? { risk_profile: municipalityValue.risk_profile }
            : {}),
    };
    const actionDefaultsValue = asRecord(objectValue.actionDefaults);
    const actionDefaults = actionDefaultsValue
        ? {
            ...(actionDefaultsValue.mode === "launch" || actionDefaultsValue.mode === "governed"
                ? { mode: actionDefaultsValue.mode }
                : {}),
            ...(asTrimmedString(actionDefaultsValue.intent) ? { intent: asTrimmedString(actionDefaultsValue.intent) } : {}),
            ...(Array.isArray(actionDefaultsValue.targets) ? { targets: asStringArray(actionDefaultsValue.targets) } : {}),
            ...(actionDefaultsValue.environment === "production" ||
                actionDefaultsValue.environment === "staging" ||
                actionDefaultsValue.environment === "pilot"
                ? { environment: actionDefaultsValue.environment }
                : {}),
            ...(asTrimmedString(actionDefaultsValue.description)
                ? { description: asTrimmedString(actionDefaultsValue.description) }
                : {}),
        }
        : undefined;
    return {
        workspace,
        municipality,
        ...(actionDefaults ? { actionDefaults } : {}),
    };
}
export function normalizeLiveTiles(value) {
    if (!Array.isArray(value)) {
        return [];
    }
    const tiles = [];
    for (const entry of value) {
        const objectEntry = asRecord(entry);
        if (!objectEntry) {
            continue;
        }
        const id = asTrimmedString(objectEntry.id);
        const label = asTrimmedString(objectEntry.label);
        const icon = asTrimmedString(objectEntry.icon);
        const mode = objectEntry.mode === "launch" || objectEntry.mode === "governed" ? objectEntry.mode : null;
        const intent = asTrimmedString(objectEntry.intent);
        const target = asTrimmedString(objectEntry.target);
        const tone = asTrimmedString(objectEntry.tone);
        const description = asTrimmedString(objectEntry.description);
        if (!id || !label || !icon || !mode || !intent || !target || !tone || !description) {
            continue;
        }
        const tile = { id, label, icon, mode, intent, target, tone, description };
        if (objectEntry.emergency === true) {
            tile.emergency = true;
        }
        tiles.push(tile);
    }
    return tiles;
}
export function normalizeCapabilities(value) {
    const objectValue = asRecord(value);
    if (!objectValue) {
        return null;
    }
    const automationsValue = Array.isArray(objectValue.automations) ? objectValue.automations : [];
    const quickActionsValue = Array.isArray(objectValue.quickActions) ? objectValue.quickActions : [];
    const automations = automationsValue
        .map((entry) => {
        const objectEntry = asRecord(entry);
        if (!objectEntry)
            return null;
        const id = asTrimmedString(objectEntry.id);
        const title = asTrimmedString(objectEntry.title);
        const icon = asTrimmedString(objectEntry.icon);
        const desc = asTrimmedString(objectEntry.desc);
        const status = asTrimmedString(objectEntry.status);
        const tags = asStringArray(objectEntry.tags);
        if (!id || !title || !icon || !desc || !status)
            return null;
        return {
            type: "automation",
            id, title, icon, desc, tags, status,
            ...(asTrimmedString(objectEntry.modal) ? { modal: asTrimmedString(objectEntry.modal) } : {}),
        };
    })
        .filter((entry) => Boolean(entry));
    const quickActions = quickActionsValue
        .map((entry) => {
        const objectEntry = asRecord(entry);
        if (!objectEntry)
            return null;
        const title = asTrimmedString(objectEntry.title);
        const icon = asTrimmedString(objectEntry.icon);
        const desc = asTrimmedString(objectEntry.desc);
        const hint = asTrimmedString(objectEntry.hint);
        const trigger = asStringArray(objectEntry.trigger).map((item) => item.toLowerCase());
        if (!title || !icon || !desc || !hint || trigger.length === 0)
            return null;
        return {
            type: "action",
            trigger, title, icon, desc, hint,
            ...(asTrimmedString(objectEntry.modal) ? { modal: asTrimmedString(objectEntry.modal) } : {}),
        };
    })
        .filter((entry) => Boolean(entry));
    return { automations, quickActions };
}
// ── Login user parsing ──────────────────────────────────────────────────────
export function parseLoginUsersFromEnv() {
    const raw = process.env.PJ_LOGIN_USERS_JSON;
    if (!raw)
        return [];
    try {
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed))
            return [];
        return parsed
            .map((entry) => {
            if (!entry || typeof entry !== "object")
                return null;
            const obj = entry;
            const id = typeof obj.id === "string" ? obj.id.trim() : "";
            const username = typeof obj.username === "string" ? obj.username.trim() : "";
            const passwordHash = typeof obj.passwordHash === "string" ? obj.passwordHash.trim() : "";
            const name = typeof obj.name === "string" ? obj.name.trim() : "";
            const role = typeof obj.role === "string" ? obj.role.trim().toLowerCase() : "";
            const permissions = Array.isArray(obj.permissions)
                ? obj.permissions.map((p) => (typeof p === "string" ? p.trim().toLowerCase() : "")).filter(Boolean)
                : [];
            const tenants = Array.isArray(obj.tenants)
                ? obj.tenants
                    .map((t) => {
                    if (!t || typeof t !== "object")
                        return null;
                    const te = t;
                    const tenantId = typeof te.id === "string" ? te.id.trim() : "";
                    const tenantName = typeof te.name === "string" ? te.name.trim() : "";
                    const tenantSha = typeof te.sha === "string" ? te.sha.trim() : "";
                    const connections = Array.isArray(te.connections)
                        ? te.connections.map((c) => (typeof c === "string" ? c.trim() : "")).filter(Boolean)
                        : [];
                    if (!tenantId || !tenantName)
                        return null;
                    return { id: tenantId, name: tenantName, sha: tenantSha, connections };
                })
                    .filter((t) => Boolean(t))
                : [];
            if (!id || !username || !passwordHash || !name || !role)
                return null;
            return {
                id, username, passwordHash, name, role, permissions, tenants,
                tenantId: typeof obj.tenantId === "string" ? obj.tenantId.trim() || null : tenants[0]?.id ?? null,
            };
        })
            .filter((e) => Boolean(e));
    }
    catch {
        return [];
    }
}
export function resolveLoginUsers() {
    return parseLoginUsersFromEnv();
}
export function isBuiltInLoginEnabled(nodeEnv) {
    const allowAdminLogin = process.env.ALLOW_ADMIN_LOGIN === "true";
    const allowProductionOverride = process.env.ALLOW_PROD_ADMIN_LOGIN === "true";
    if (!allowAdminLogin)
        return false;
    if (nodeEnv !== "production")
        return true;
    return allowProductionOverride;
}
// ── Runtime resolution ──────────────────────────────────────────────────────
export function resolveRuntimeContext(nodeEnv) {
    const context = normalizeRuntimeContext(parseJsonFromEnv("PJ_RUNTIME_CONTEXT_JSON"));
    if (context)
        return context;
    if (nodeEnv === "production") {
        throw new Error("PJ_RUNTIME_CONTEXT_JSON must be configured in production");
    }
    return null;
}
export function resolveLiveTiles(nodeEnv) {
    const tiles = normalizeLiveTiles(parseJsonFromEnv("PJ_RUNTIME_TILES_JSON"));
    if (tiles.length > 0)
        return tiles;
    if (nodeEnv === "production") {
        throw new Error("PJ_RUNTIME_TILES_JSON must be configured in production");
    }
    return [];
}
export function resolveLiveCapabilities(nodeEnv) {
    const capabilities = normalizeCapabilities(parseJsonFromEnv("PJ_RUNTIME_CAPABILITIES_JSON"));
    if (capabilities && (capabilities.automations.length > 0 || capabilities.quickActions.length > 0)) {
        return capabilities;
    }
    if (nodeEnv === "production") {
        throw new Error("PJ_RUNTIME_CAPABILITIES_JSON must be configured in production");
    }
    return null;
}
// ── Production invariants ───────────────────────────────────────────────────
export function isPathInsideDirectory(candidatePath, baseDirectory) {
    const resolvedCandidate = path.resolve(candidatePath);
    const resolvedBase = path.resolve(baseDirectory);
    const relative = path.relative(resolvedBase, resolvedCandidate);
    return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}
export function assertProductionInvariants(nodeEnv, authOptions, controlledDataDir) {
    if (nodeEnv !== "production")
        return;
    const allowProductionAdminLogin = process.env.ALLOW_PROD_ADMIN_LOGIN === "true";
    if (process.env.ALLOW_ADMIN_LOGIN === "true" && !allowProductionAdminLogin) {
        throw new Error("ALLOW_ADMIN_LOGIN must not be true in production");
    }
    if (allowProductionAdminLogin && process.env.ALLOW_ADMIN_LOGIN !== "true") {
        throw new Error("ALLOW_PROD_ADMIN_LOGIN requires ALLOW_ADMIN_LOGIN to also be true");
    }
    const requiredEnvVars = [
        "PJ_RUNTIME_CONTEXT_JSON",
        "PJ_RUNTIME_TILES_JSON",
        "PJ_RUNTIME_CAPABILITIES_JSON",
        "PRR_DB_PATH",
        "IDEMPOTENCY_DB_PATH",
        "RATE_LIMIT_DB_PATH",
        "ACCESS_NOTIFICATION_WEBHOOK_URL",
        "FRONTEND_URL",
    ];
    for (const variable of requiredEnvVars) {
        if (!process.env[variable]?.trim()) {
            throw new Error(`${variable} must be configured in production`);
        }
    }
    // OAuth provider credentials – each provider needs both client ID and secret
    const oauthProviders = [
        { name: "GitHub", idVar: "GITHUB_CLIENT_ID", secretVar: "GITHUB_CLIENT_SECRET", redirectVar: "GITHUB_REDIRECT_URI" },
        { name: "Google", idVar: "GOOGLE_CLIENT_ID", secretVar: "GOOGLE_CLIENT_SECRET", redirectVar: "GOOGLE_REDIRECT_URI" },
        { name: "Microsoft", idVar: "MICROSOFT_CLIENT_ID", secretVar: "MICROSOFT_CLIENT_SECRET", redirectVar: "MICROSOFT_REDIRECT_URI" },
    ];
    for (const { name, idVar, secretVar, redirectVar } of oauthProviders) {
        const hasId = Boolean(process.env[idVar]?.trim());
        const hasSecret = Boolean(process.env[secretVar]?.trim());
        if (hasId !== hasSecret) {
            throw new Error(`${name} OAuth: both ${idVar} and ${secretVar} must be set (or both unset)`);
        }
        if (hasId && !process.env[redirectVar]?.trim()) {
            throw new Error(`${name} OAuth: ${redirectVar} must be configured when ${idVar} is set`);
        }
    }
    const hasJwtVerificationKey = Boolean(authOptions.jwtPublicKey?.trim() || authOptions.jwtSecret?.trim());
    if (!hasJwtVerificationKey) {
        throw new Error("JWT verification key must be configured in production");
    }
    if (authOptions.jwtSecret?.trim() === "dev-secret") {
        throw new Error("JWT secret cannot use development fallback in production");
    }
    const prrPath = process.env.PRR_DB_PATH ?? "";
    const idempotencyPath = process.env.IDEMPOTENCY_DB_PATH ?? "";
    const rateLimitPath = process.env.RATE_LIMIT_DB_PATH ?? "";
    const connectorPath = process.env.CONNECTOR_DB_PATH ?? "";
    const connectorStateSecret = (process.env.CONNECTOR_STATE_SECRET ?? "").trim();
    for (const [label, p] of [
        ["PRR_DB_PATH", prrPath],
        ["IDEMPOTENCY_DB_PATH", idempotencyPath],
        ["RATE_LIMIT_DB_PATH", rateLimitPath],
        ["CONNECTOR_DB_PATH", connectorPath],
    ]) {
        if (!isPathInsideDirectory(p, controlledDataDir)) {
            throw new Error(`${label} must be inside the controlled data directory`);
        }
    }
    if (!connectorStateSecret) {
        throw new Error("CONNECTOR_STATE_SECRET is required in production");
    }
}
