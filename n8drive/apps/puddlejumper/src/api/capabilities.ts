// ── Capability manifest, PJ actions, and evaluate helpers ───────────────────
import crypto from "node:crypto";
import type { AuthContext } from "@publiclogic/core";
import type {
  CapabilityManifest,
  LiveCapabilities,
  LiveTile,
  PjActionDefinition,
  PjActionId,
  RuntimeContext,
} from "./types.js";
import type { EvaluateRequestBody, PjExecuteRequestBody } from "./schemas.js";
import type { DecisionResult } from "../engine/governanceEngine.js";

// ── Action definitions ──────────────────────────────────────────────────────

export const PJ_ACTION_DEFINITIONS: readonly PjActionDefinition[] = [
  { id: "environment.create",  label: "Create Environment",  requires: ["evaluate.execute", "missionControl.tiles.customize"] },
  { id: "environment.update",  label: "Update Environment",  requires: ["evaluate.execute", "missionControl.tiles.customize"] },
  { id: "environment.promote", label: "Promote Environment", requires: ["evaluate.execute", "missionControl.tiles.customize"] },
  { id: "environment.snapshot",label: "Snapshot Environment", requires: ["evaluate.execute", "missionControl.tiles.customize"] },
];

// ── Manifest builder ────────────────────────────────────────────────────────

export function buildCapabilityManifest(
  auth: AuthContext,
  runtimeTiles: LiveTile[],
  runtimeCapabilities: LiveCapabilities | null,
): CapabilityManifest {
  const canEvaluate = auth.permissions.includes("deploy");
  const canEditCorePrompt = auth.role === "admin";
  const hasTiles = runtimeTiles.length > 0;
  const hasCapabilities =
    runtimeCapabilities !== null &&
    (runtimeCapabilities.automations.length > 0 || runtimeCapabilities.quickActions.length > 0);

  return {
    tenantId: auth.tenantId,
    userId: auth.userId,
    capabilities: {
      "corePrompt.read": true,
      "corePrompt.edit": canEditCorePrompt,
      "evaluate.execute": canEvaluate,
      "missionControl.tiles.read": hasTiles,
      "missionControl.tiles.customize": hasTiles && canEvaluate,
      "missionControl.capabilities.read": hasCapabilities,
      "popout.launch": hasCapabilities,
    },
  };
}

export function isPjActionAllowed(manifest: CapabilityManifest, action: PjActionDefinition): boolean {
  return action.requires.every((k) => manifest.capabilities[k] === true);
}

export function listAllowedPjActions(manifest: CapabilityManifest): Array<{ id: PjActionId; label: string; requires: string[] }> {
  return PJ_ACTION_DEFINITIONS
    .filter((a) => isPjActionAllowed(manifest, a))
    .map((a) => ({ id: a.id, label: a.label, requires: [...a.requires] }));
}

// ── Tenant scope enforcement ────────────────────────────────────────────────

function normalizeScopeToken(value: string): string {
  return value.trim().toLowerCase();
}

function extractTargetScopeToken(target: string): string | null {
  const rawTarget = target.trim();
  if (!rawTarget) return null;
  if (rawTarget.startsWith("health:")) return "__internal__";
  if (!rawTarget.includes(":")) {
    const [owner = ""] = rawTarget.split("/");
    return owner ? normalizeScopeToken(owner) : null;
  }
  const [connector = "", rest = ""] = rawTarget.split(":", 2);
  if (!rest) return null;
  if (connector.toLowerCase() === "github") {
    const [owner = ""] = rest.split("/");
    return owner ? normalizeScopeToken(owner) : null;
  }
  const [scope = ""] = rest.split(":");
  return scope ? normalizeScopeToken(scope) : null;
}

export function assertTenantScope(auth: AuthContext, payload: EvaluateRequestBody):
  | { ok: true }
  | { ok: false; reason: string; details: Record<string, unknown> } {
  const authorizedScopes = new Set<string>();
  if (auth.tenantId) authorizedScopes.add(normalizeScopeToken(auth.tenantId));
  for (const tenant of auth.tenants) {
    if (tenant.id) authorizedScopes.add(normalizeScopeToken(tenant.id));
    if (tenant.name) authorizedScopes.add(normalizeScopeToken(tenant.name));
    if (tenant.sha) authorizedScopes.add(normalizeScopeToken(tenant.sha));
  }
  if (authorizedScopes.size === 0) {
    return { ok: false, reason: "Tenant scope unavailable", details: { userId: auth.userId } };
  }
  const workspaceScope = normalizeScopeToken(payload.workspace.id);
  if (!authorizedScopes.has(workspaceScope)) {
    return {
      ok: false,
      reason: "Workspace outside authorized tenant scope",
      details: { workspaceId: payload.workspace.id, tenantId: auth.tenantId, authorizedScopes: Array.from(authorizedScopes) },
    };
  }
  const unauthorizedTargets = payload.action.targets.filter((target) => {
    const token = extractTargetScopeToken(target);
    if (!token) return true;
    if (token === "__internal__") return false;
    return !authorizedScopes.has(token);
  });
  if (unauthorizedTargets.length > 0) {
    return {
      ok: false,
      reason: "One or more targets are outside authorized tenant scope",
      details: { unauthorizedTargets, tenantId: auth.tenantId, authorizedScopes: Array.from(authorizedScopes) },
    };
  }
  return { ok: true };
}

// ── Scoped request ID ───────────────────────────────────────────────────────

export function scopedRequestId(userId: string, tenantId: string | null, requestId: string | undefined): string | undefined {
  if (!requestId) return undefined;
  const normalizedTenant = tenantId && tenantId.trim() ? tenantId.trim() : "no-tenant";
  return `${userId}:${normalizedTenant}:${requestId}`;
}

// ── Evaluate payload builders ───────────────────────────────────────────────

function resolvePrimaryScope(auth: AuthContext, runtimeContext: RuntimeContext): string {
  const fromTenantId = auth.tenantId?.trim();
  if (fromTenantId) return fromTenantId;
  const fromTenants = auth.tenants.find((t: any) => t.id.trim())?.id.trim();
  if (fromTenants) return fromTenants;
  return runtimeContext.workspace.id;
}

function resolveStatuteCitation(runtimeContext: RuntimeContext): string {
  const statutes = runtimeContext.municipality.statutes;
  if (statutes && typeof statutes === "object") {
    const first = Object.values(statutes).find((v) => typeof v === "string" && v.trim().length > 0);
    if (typeof first === "string" && first.trim().length > 0) return first.trim();
  }
  return "MGL Ch. 66 Section 10";
}

function normalizeTargetSegment(value: string): string {
  const normalized = value.trim().replace(/[^A-Za-z0-9._:-]+/g, "-");
  return normalized || "default";
}

export function buildPjEvaluatePayload(
  auth: AuthContext,
  runtimeContext: RuntimeContext,
  request: PjExecuteRequestBody,
  correlationId: string,
): EvaluateRequestBody {
  const scope = resolvePrimaryScope(auth, runtimeContext);
  const timestamp = new Date().toISOString();
  const dateStamp = timestamp.slice(0, 10);
  const statuteCitation = resolveStatuteCitation(runtimeContext);
  const policyKey = "governance.control_surface";
  const requestIdFromPayload =
    (typeof request.payload === "object" && request.payload && "requestId" in request.payload
      ? (request.payload as { requestId?: string }).requestId
      : undefined) ?? undefined;
  const rawRequestId = request.requestId?.trim() || requestIdFromPayload?.trim();
  const scopedId = scopedRequestId(auth.userId, auth.tenantId, rawRequestId);
  const trigger = {
    type: "manual" as const,
    reference: `pj:${request.actionId}:${correlationId}`,
    evidence: { statute: statuteCitation, policyKey },
  };

  const base = {
    workspace: { ...runtimeContext.workspace, id: scope },
    municipality: runtimeContext.municipality,
    operator: {
      id: auth.userId, name: auth.name, role: auth.role,
      permissions: auth.permissions, delegations: auth.delegations,
    },
  };
  const archieve = (dept: string, type: string) => ({ dept, type, date: dateStamp, seq: 1, v: 1 });

  if (request.actionId === "environment.create") {
    const segment = normalizeTargetSegment(request.payload.name);
    return { ...base, action: { mode: "governed", trigger, intent: "create_environment",
      targets: [`sharepoint:${scope}:/environments/${segment}`], environment: "production",
      metadata: { description: `Create environment ${request.payload.name} via PuddleJumper control surface.`, archieve: archieve("PJ", "policy") },
      ...(scopedId ? { requestId: scopedId } : {}) }, timestamp };
  }

  if (request.actionId === "environment.update") {
    const envId = normalizeTargetSegment(request.payload.environmentId);
    return { ...base, action: { mode: "governed", trigger, intent: "deploy_policy",
      targets: [`sharepoint:${scope}:/environments/${envId}`], environment: "production",
      metadata: { description: `Update environment ${request.payload.environmentId} via PuddleJumper control surface.`, archieve: archieve("PJ", "policy") },
      ...(scopedId ? { requestId: scopedId } : {}) }, timestamp };
  }

  if (request.actionId === "environment.promote") {
    const source = normalizeTargetSegment(request.payload.sourceEnvironmentId);
    const target = normalizeTargetSegment(request.payload.targetEnvironmentId);
    return { ...base, action: { mode: "governed", trigger, intent: "deploy_policy",
      targets: [`sharepoint:${scope}:/environments/promotions/${source}/${target}`], environment: "production",
      metadata: { description: `Promote environment ${request.payload.sourceEnvironmentId} to ${request.payload.targetEnvironmentId} via PuddleJumper.`, archieve: archieve("PJ", "policy") },
      ...(scopedId ? { requestId: scopedId } : {}) }, timestamp };
  }

  const snapshotEnvId = normalizeTargetSegment(request.payload.environmentId);
  return { ...base, action: { mode: "governed", trigger, intent: "deploy_policy",
    targets: [`sharepoint:${scope}:/environments/snapshots/${snapshotEnvId}`], environment: "production",
    metadata: { description: `Snapshot environment ${request.payload.environmentId} via PuddleJumper control surface.`, archieve: archieve("PJ", "audit") },
    ...(scopedId ? { requestId: scopedId } : {}) }, timestamp };
}

// ── Decision helpers ────────────────────────────────────────────────────────

export function resolveDecisionStatusCode(result: { approved: boolean; warnings: string[] }): number {
  if (result.approved) return 200;
  if (result.warnings.some((w) => /idempotency conflict|schema version mismatch/i.test(w))) return 409;
  if (result.warnings.some((w) => /invalid canonical source|canonical/i.test(w))) return 400;
  return 400;
}

export function buildPjExecuteData(
  request: PjExecuteRequestBody,
  evaluatePayload: EvaluateRequestBody,
  decision: DecisionResult,
): Record<string, unknown> {
  const base = { actionId: request.actionId, mode: request.mode, decision };
  if (request.mode === "dry-run") {
    return { ...base, preview: {
      workspaceId: evaluatePayload.workspace.id, intent: evaluatePayload.action.intent,
      targets: evaluatePayload.action.targets, description: evaluatePayload.action.metadata.description } };
  }
  if (request.actionId === "environment.create") {
    return { ...base, id: `env-${decision.auditRecord.eventId.slice(0, 12)}`,
      name: request.payload.name, version: 1, config: request.payload.config ?? {},
      createdAt: decision.auditRecord.timestamp, updatedAt: decision.auditRecord.timestamp };
  }
  if (request.actionId === "environment.update") {
    return { ...base, environmentId: request.payload.environmentId, patch: request.payload.patch };
  }
  if (request.actionId === "environment.promote") {
    return { ...base, sourceEnvironmentId: request.payload.sourceEnvironmentId,
      targetEnvironmentId: request.payload.targetEnvironmentId, merge: Boolean(request.payload.merge) };
  }
  return { ...base, environmentId: request.payload.environmentId, message: request.payload.message ?? "" };
}
