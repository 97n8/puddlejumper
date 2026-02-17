// ── PolicyProvider Interface ─────────────────────────────────────────────────
//
// The seam between PJ (control plane) and VAULT (authority layer).
//
//   PJ asks:  "Is this operator authorized?"      → checkAuthorization()
//   PJ asks:  "What approval chain applies?"      → getChainTemplate()
//   PJ says:  "This governance event happened."   → writeAuditEvent()
//
//   LocalPolicyProvider: SQLite-backed stand-in, shipped with PJ today.
//   RemotePolicyProvider: HTTP-to-VAULT (future — config swap, not rewrite).
//
// Boundary: Chain templates define routing order, not authorization rules.
// PJ owns routing/sequencing. VAULT owns authorization/policy.
//
import type Database from "better-sqlite3";
import type { ChainStore, ChainTemplate } from "./chainStore.js";
import { INTENT_PERMISSIONS, CONNECTOR_PERMISSIONS } from "./validation.js";

// ── Authorization Types ─────────────────────────────────────────────────────

/** Delegation record shape — mirrors the governance engine's internal type. */
export type PolicyDelegation = {
  id?: string;
  from?: string;
  until?: string;
  to?: string;
  scope?: string[];
  precedence?: number;
  delegator?: string;
  delegatee?: string;
};

/** Input to an authorization check. */
export type AuthorizationQuery = {
  operatorId: string;
  operatorRole?: string;
  operatorPermissions: string[];
  operatorDelegations: PolicyDelegation[];
  intent: string;
  connectors: string[];
  timestamp: string;
};

/** Result of an authorization check — compatible with the engine's AuthorityResult. */
export type AuthorizationResult = {
  allowed: boolean;
  required: string[];
  delegationUsed: string;
  reason?: "insufficient_permissions" | "delegation_ambiguity";
  delegationEvaluation: Record<string, unknown>;
};

// ── Chain Template Resolution ───────────────────────────────────────────────

/** Input to a chain template lookup. */
export type ChainTemplateQuery = {
  actionIntent: string;
  actionMode: string;
  municipalityId: string;
  workspaceId: string;
};

// ── Audit Events ────────────────────────────────────────────────────────────

/** Audit event types written through the policy provider. */
export type AuditEventType =
  | "action_evaluated"
  | "approval_created"
  | "approval_decided"
  | "approval_dispatched"
  | "chain_step_decided"
  | "authorization_checked";

/** A structured audit event for the compliance ledger. */
export type AuditEvent = {
  eventId: string;
  eventType: AuditEventType;
  workspaceId: string;
  operatorId: string;
  municipalityId: string;
  timestamp: string;
  intent: string;
  outcome: string;
  details: Record<string, unknown>;
};

// ── Manifest Registration ───────────────────────────────────────────────────

/** Input to manifest registration (pre-flight check). */
export type ManifestInput = {
  manifestId: string;
  workspaceId: string;
  operatorId: string;
  municipalityId: string;
  intent: string;
  planHash: string;
  /** Required. Every governance action needs a human-readable justification. */
  description: string;
  connectors: string[];
  timestamp: string;
};

/** Result of manifest registration. */
export type ManifestResult = {
  accepted: boolean;
  manifestId: string;
  reason?: string;
};

// ── Release Authorization ───────────────────────────────────────────────────

/** Input to release authorization check. */
export type ReleaseQuery = {
  approvalId: string;
  manifestId: string;
  workspaceId: string;
  municipalityId: string;
  operatorId: string;
  planHash: string;
  timestamp: string;
};

/** Result of release authorization. */
export type ReleaseResult = {
  authorized: boolean;
  reason?: string;
  expiresAt: string | null;
};

// ── Drift Classification ────────────────────────────────────────────────────

/** Input to drift classification. */
export type DriftQuery = {
  approvalId: string;
  manifestId: string;
  workspaceId: string;
  municipalityId: string;
  /** Which fields/resources drifted — typed so VAULT knows what to inspect. */
  changedFields: string[];
  /** Additional context — opaque to PJ, meaningful to VAULT. */
  driftContext: Record<string, unknown>;
  timestamp: string;
};

/** Drift severity classification. */
export type DriftClassification = {
  severity: "none" | "low" | "medium" | "high" | "critical";
  requiresReapproval: boolean;
  reason?: string;
};

// ── Policy Provider Type ────────────────────────────────────────────────────

/** Policy provider implementation type. */
export type PolicyProviderType = "local" | "remote";

// ── PolicyProvider Interface ────────────────────────────────────────────────

export interface PolicyProvider {
  /**
   * Get the provider type (local or remote).
   *
   * This is synchronous — it's configuration, not a policy decision.
   */
  getProviderType(): PolicyProviderType;

  /**
   * Check if an operator is authorized to perform an action.
   *
   * Today (Local): evaluates permissions + delegations from the payload.
   * Future (VAULT): HTTP query to the authority service.
   */
  checkAuthorization(query: AuthorizationQuery): Promise<AuthorizationResult>;

  /**
   * Resolve the approval chain template for an action + municipality.
   *
   * Returns null when no template applies (caller uses default).
   *
   * Today (Local): returns the default template from ChainStore.
   * Future (VAULT): returns a municipality-specific template.
   */
  getChainTemplate(query: ChainTemplateQuery): Promise<ChainTemplate | null>;

  /**
   * Write a structured audit event.
   *
   * Today (Local): persists to SQLite audit_events table.
   * Future (VAULT): sends to the immutable compliance ledger.
   */
  writeAuditEvent(event: AuditEvent): Promise<void>;

  /**
   * Register a manifest (pre-flight check).
   *
   * Allows VAULT to reject upfront (freeze windows, disabled intents).
   *
   * Today (Local): accepts all manifests.
   * Future (VAULT): validates against policy constraints.
   */
  registerManifest(input: ManifestInput): Promise<ManifestResult>;

  /**
   * Authorize release of an approved action.
   *
   * Post-approval gate between "chain complete" and "dispatch".
   * Catches conditions that emerge between approval and dispatch.
   *
   * Today (Local): authorizes all releases.
   * Future (VAULT): validates plan hash, freeze windows, budget caps, TTL.
   */
  authorizeRelease(query: ReleaseQuery): Promise<ReleaseResult>;

  /**
   * Classify drift between deployed artifact and approved manifest.
   *
   * Today (Local): returns no drift.
   * Future (VAULT): analyzes drift severity and reapproval requirements.
   */
  classifyDrift(query: DriftQuery): Promise<DriftClassification>;
}

// ── Authorization Helpers (pure functions) ──────────────────────────────────

function permissionSetFor(intent: string, connectors: string[]): Set<string> {
  const required = new Set(
    (INTENT_PERMISSIONS[intent] ?? ["deploy"]).map((v) => v.toLowerCase()),
  );
  for (const connector of connectors) {
    const byConnector = CONNECTOR_PERMISSIONS[connector] ?? [];
    for (const perm of byConnector) {
      required.add(perm.toLowerCase());
    }
  }
  return required;
}

function delegationActive(from: string | undefined, until: string | undefined, at: string): boolean {
  const nowMs = Date.parse(at);
  if (!Number.isFinite(nowMs)) return false;

  if (from) {
    const fromMs = Date.parse(from);
    if (!Number.isFinite(fromMs) || fromMs > nowMs) return false;
  }

  if (!until) return true;

  const untilMs = Date.parse(until);
  if (!Number.isFinite(untilMs)) return false;

  return untilMs >= nowMs;
}

function delegationMatches(
  scope: string[] | undefined,
  intent: string,
  permissions: Set<string>,
  connectors: string[],
): boolean {
  const normalized = new Set((scope ?? []).map((s) => s.toLowerCase()));
  if (normalized.has("*")) return true;
  if (normalized.has(intent.toLowerCase()) || normalized.has(`intent:${intent.toLowerCase()}`)) return true;

  for (const permission of permissions) {
    if (normalized.has(permission) || normalized.has(`permission:${permission}`)) return true;
  }
  for (const connector of connectors) {
    if (normalized.has(connector) || normalized.has(`connector:${connector}`)) return true;
  }
  return false;
}

function parseEpoch(value: string | undefined): number {
  if (!value) return Number.NEGATIVE_INFINITY;
  const epoch = Date.parse(value);
  return Number.isFinite(epoch) ? epoch : Number.NEGATIVE_INFINITY;
}

function normalizePrecedence(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const parsed = Number.parseInt(String(value ?? 0), 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

function delegationId(d: PolicyDelegation): string {
  return (
    d.id ??
    `${d.delegator ?? "unknown"}:${d.from ?? "open"}:${d.until ?? d.to ?? "open"}:${(d.scope ?? []).join("|")}`
  );
}

/** Evaluate authorization from permissions + delegations. */
export function evaluateAuthorization(query: AuthorizationQuery): AuthorizationResult {
  const required = permissionSetFor(query.intent, query.connectors);
  const operatorPerms = new Set(query.operatorPermissions.map((p) => p.toLowerCase()));

  // Direct role-based authority (highest precedence)
  const roleCovers = Array.from(required).every((perm) => operatorPerms.has(perm));
  if (roleCovers) {
    return {
      allowed: true,
      required: Array.from(required),
      delegationUsed: "",
      delegationEvaluation: {
        source: "role",
        evaluatedAt: query.timestamp,
        requiredPermissions: Array.from(required),
        consideredDelegations: 0,
      },
    };
  }

  // Delegation-based authority
  const delegations = (query.operatorDelegations ?? []).filter((d) =>
    delegationActive(d.from, d.until ?? d.to, query.timestamp),
  );
  const matchingDelegations = delegations.filter((d) =>
    delegationMatches(d.scope, query.intent, required, query.connectors),
  );

  if (matchingDelegations.length === 0) {
    return {
      allowed: false,
      required: Array.from(required),
      delegationUsed: "",
      reason: "insufficient_permissions",
      delegationEvaluation: {
        source: "delegation",
        evaluatedAt: query.timestamp,
        requiredPermissions: Array.from(required),
        consideredDelegations: 0,
      },
    };
  }

  // Sort: highest precedence first, then latest `from`, then stable ID sort
  matchingDelegations.sort((a, b) => {
    const precedenceDelta = normalizePrecedence(b.precedence) - normalizePrecedence(a.precedence);
    if (precedenceDelta !== 0) return precedenceDelta;
    const fromDelta = parseEpoch(b.from) - parseEpoch(a.from);
    if (fromDelta !== 0) return fromDelta;
    return delegationId(a).localeCompare(delegationId(b));
  });

  // Ambiguity check: if top two have equal precedence AND equal `from`
  if (matchingDelegations.length > 1) {
    const first = matchingDelegations[0];
    const second = matchingDelegations[1];
    const precedenceTie =
      normalizePrecedence(first.precedence) === normalizePrecedence(second.precedence);
    const fromTie = parseEpoch(first.from) === parseEpoch(second.from);
    if (precedenceTie && fromTie) {
      return {
        allowed: false,
        required: Array.from(required),
        delegationUsed: "",
        reason: "delegation_ambiguity",
        delegationEvaluation: {
          source: "delegation",
          evaluatedAt: query.timestamp,
          requiredPermissions: Array.from(required),
          consideredDelegations: matchingDelegations.length,
          ambiguity: true,
          candidates: matchingDelegations.slice(0, 4).map((d) => ({
            id: delegationId(d),
            delegator: d.delegator ?? null,
            scope: d.scope ?? [],
            precedence: normalizePrecedence(d.precedence),
            from: d.from ?? null,
          })),
        },
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
      evaluatedAt: query.timestamp,
      requiredPermissions: Array.from(required),
      consideredDelegations: matchingDelegations.length,
      used: {
        id: chosenId,
        delegator: chosen.delegator ?? null,
        scope: chosen.scope ?? [],
        precedence: normalizePrecedence(chosen.precedence),
        from: chosen.from ?? null,
        until: chosen.until ?? chosen.to ?? null,
      },
    },
  };
}

// ── LocalPolicyProvider ─────────────────────────────────────────────────────

/**
 * SQLite-backed PolicyProvider — PJ's local stand-in for VAULT.
 *
 * When VAULT ships, swap this for RemotePolicyProvider (config change,
 * not code rewrite).
 */
export class LocalPolicyProvider implements PolicyProvider {
  constructor(
    private readonly db: Database.Database,
    private readonly chainStore: ChainStore,
  ) {
    this.initializeAuditTable();
  }

  private initializeAuditTable(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS audit_events (
        event_id TEXT PRIMARY KEY,
        event_type TEXT NOT NULL,
        workspace_id TEXT NOT NULL,
        operator_id TEXT NOT NULL,
        municipality_id TEXT NOT NULL,
        timestamp TEXT NOT NULL,
        intent TEXT NOT NULL,
        outcome TEXT NOT NULL,
        details_json TEXT NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_audit_events_type
        ON audit_events(event_type);
      CREATE INDEX IF NOT EXISTS idx_audit_events_workspace
        ON audit_events(workspace_id);
      CREATE INDEX IF NOT EXISTS idx_audit_events_timestamp
        ON audit_events(timestamp);
    `);
  }

  // ── PolicyProvider implementation ─────────────────────────────────────

  getProviderType(): PolicyProviderType {
    return "local";
  }

  async checkAuthorization(query: AuthorizationQuery): Promise<AuthorizationResult> {
    return evaluateAuthorization(query);
  }

  async getChainTemplate(_query: ChainTemplateQuery): Promise<ChainTemplate | null> {
    // Today: return the default template regardless of action/municipality.
    // Future: look up municipality-specific template mappings.
    return this.chainStore.getTemplate("default");
  }

  async writeAuditEvent(event: AuditEvent): Promise<void> {
    this.db
      .prepare(
        `INSERT OR IGNORE INTO audit_events
          (event_id, event_type, workspace_id, operator_id, municipality_id,
           timestamp, intent, outcome, details_json, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        event.eventId,
        event.eventType,
        event.workspaceId,
        event.operatorId,
        event.municipalityId,
        event.timestamp,
        event.intent,
        event.outcome,
        JSON.stringify(event.details),
        new Date().toISOString(),
      );
  }

  async registerManifest(input: ManifestInput): Promise<ManifestResult> {
    return { accepted: true, manifestId: input.manifestId };
  }

  async authorizeRelease(_query: ReleaseQuery): Promise<ReleaseResult> {
    return { authorized: true, expiresAt: null };
  }

  async classifyDrift(_query: DriftQuery): Promise<DriftClassification> {
    return { severity: "none", requiresReapproval: false };
  }

  // ── Query helpers (admin / testing) ───────────────────────────────────

  /** Retrieve audit events, newest first. Optional filters. */
  getAuditEvents(filters?: {
    eventType?: AuditEventType;
    workspaceId?: string;
    municipalityId?: string;
    limit?: number;
  }): AuditEvent[] {
    const clauses: string[] = [];
    const params: unknown[] = [];

    if (filters?.eventType) {
      clauses.push("event_type = ?");
      params.push(filters.eventType);
    }
    if (filters?.workspaceId) {
      clauses.push("workspace_id = ?");
      params.push(filters.workspaceId);
    }
    if (filters?.municipalityId) {
      clauses.push("municipality_id = ?");
      params.push(filters.municipalityId);
    }

    const where = clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : "";
    const limit = filters?.limit ?? 100;

    const rows = this.db
      .prepare(`SELECT * FROM audit_events ${where} ORDER BY timestamp DESC LIMIT ?`)
      .all(...params, limit) as Array<{
      event_id: string;
      event_type: string;
      workspace_id: string;
      operator_id: string;
      municipality_id: string;
      timestamp: string;
      intent: string;
      outcome: string;
      details_json: string;
    }>;

    return rows.map((row) => ({
      eventId: row.event_id,
      eventType: row.event_type as AuditEventType,
      workspaceId: row.workspace_id,
      operatorId: row.operator_id,
      municipalityId: row.municipality_id,
      timestamp: row.timestamp,
      intent: row.intent,
      outcome: row.outcome,
      details: JSON.parse(row.details_json) as Record<string, unknown>,
    }));
  }

  /** Count audit events — useful for metrics and testing. */
  countAuditEvents(eventType?: AuditEventType): number {
    const query = eventType
      ? "SELECT COUNT(*) as cnt FROM audit_events WHERE event_type = ?"
      : "SELECT COUNT(*) as cnt FROM audit_events";
    const row = (eventType
      ? this.db.prepare(query).get(eventType)
      : this.db.prepare(query).get()) as { cnt: number };
    return row.cnt;
  }
}
