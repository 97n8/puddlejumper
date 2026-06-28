// @pj/casespace-view — headless CaseSpace projection (Issue #101, C101-A).
// Render the thread. Do not create the thread.
//
// A read-only projection over the proof-backed runtime tables. It invents no
// state: every tile is a SELECT over existing rows, and Show Proof exposes the
// SAME audit_events rows that Recent Changes summarizes — never a separate
// implementation. The DB handle is injected; this package never writes.
//
// Scoping seam (documented, by design — Issue #101 decision):
//   case_space_action_state / holds / generated_outputs all carry
//   `case_space_id`, so Current State / Waiting On / Generated Outputs scope
//   directly. Canon `audit_events` carries `process_id` but NOT
//   `case_space_id`, so Recent Changes / Show Proof are linked to the
//   CaseSpace through the set of process_ids that touched it (gathered from
//   holds + generated_outputs, plus the caseSpaceId itself because the runner
//   defaults `case_space_id` to `process_id`). KNOWN BOUNDARY: a run that
//   wrote only action-state — no hold, no output — leaves a proof event with
//   no honest process_id link to this CaseSpace, so it will not appear in
//   Recent Changes / Proof. We surface only what the schema can prove rather
//   than fabricate a (tenant, case_space) join the runtime never recorded.

import type { DatabaseHandle } from '@pj/db';

export interface CaseSpaceView {
  caseSpaceId: string;
  currentState: {
    active: number;
    waitingApproval: number;
    blocked: number;
  };
  waitingOn: Array<{
    holdId: string;
    action: string;
    requiredRole: string;
    requestedAt: string;
  }>;
  recentChanges: Array<{
    auditEventId: string;
    type: string;
    summary: string;
    createdAt: string;
  }>;
  generatedOutputs: Array<{
    outputId: string;
    title: string;
    status: string;
    createdAt: string;
  }>;
  proof: Array<{
    auditEventId: string;
    type: string;
    payload: unknown;
    createdAt: string;
  }>;
}

/** Scope for a single CaseSpace projection. */
export interface CaseSpaceScope {
  tenant_id: string;
  case_space_id: string;
}

/** Max rows returned for the time-ordered tiles (Recent Changes / Proof). */
const RECENT_LIMIT = 50;

type ActionStateRow = { status: string; n: number };
type HoldRow = {
  hold_id: string;
  action: string | null;
  status: string;
  process_id: string | null;
  payload_json: string;
  created_at: string;
};
type OutputRow = {
  output_id: string;
  process_id: string | null;
  status: string;
  content_json: string;
  created_at: string;
};
type AuditRow = {
  event_id: string;
  event_subtype: string;
  payload_json: string;
  occurred_at: string;
};

function parseJsonObject(raw: string): Record<string, unknown> {
  try {
    const v: unknown = JSON.parse(raw);
    return v && typeof v === 'object' && !Array.isArray(v)
      ? (v as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

// ── Loaders: one query per source table, no projection logic ─────────────────

/** Load all action-state counts for the CaseSpace, grouped by status. */
function loadActionState(db: DatabaseHandle, scope: CaseSpaceScope): ActionStateRow[] {
  return db
    .prepare(
      `SELECT status, COUNT(*) AS n FROM case_space_action_state
       WHERE tenant_id = ? AND case_space_id = ? GROUP BY status`,
    )
    .all(scope.tenant_id, scope.case_space_id) as ActionStateRow[];
}

/** Load ALL holds for the CaseSpace (any status) — open ones filter later. */
function loadHolds(db: DatabaseHandle, scope: CaseSpaceScope): HoldRow[] {
  return db
    .prepare(
      `SELECT hold_id, action, status, process_id, payload_json, created_at
       FROM holds
       WHERE tenant_id = ? AND case_space_id = ?
       ORDER BY created_at ASC`,
    )
    .all(scope.tenant_id, scope.case_space_id) as HoldRow[];
}

/** Load generated outputs for the CaseSpace, newest first. */
function loadGeneratedOutputs(db: DatabaseHandle, scope: CaseSpaceScope): OutputRow[] {
  return db
    .prepare(
      `SELECT output_id, process_id, status, content_json, created_at
       FROM generated_outputs
       WHERE tenant_id = ? AND case_space_id = ?
       ORDER BY created_at DESC`,
    )
    .all(scope.tenant_id, scope.case_space_id) as OutputRow[];
}

/**
 * Derive the process_id set that demonstrably touched this CaseSpace — a PURE
 * function of already-loaded rows (no DB access). The caseSpaceId itself is
 * included because the runner defaults case_space_id to the run's process_id
 * when none is supplied. Holds and outputs contribute their own process_id.
 */
function deriveProcessIds(args: {
  caseSpaceId: string;
  holds: HoldRow[];
  outputs: OutputRow[];
}): string[] {
  const ids = new Set<string>([args.caseSpaceId]);
  for (const h of args.holds) if (h.process_id) ids.add(h.process_id);
  for (const o of args.outputs) if (o.process_id) ids.add(o.process_id);
  return [...ids];
}

/** Load the audit_events for a process_id set, ONCE, newest first. */
function loadAuditEventsByProcessIds(
  db: DatabaseHandle,
  scope: CaseSpaceScope,
  processIds: string[],
): AuditRow[] {
  if (processIds.length === 0) return [];
  const placeholders = processIds.map(() => '?').join(', ');
  return db
    .prepare(
      `SELECT event_id, event_subtype, payload_json, occurred_at
       FROM audit_events
       WHERE tenant_id = ? AND process_id IN (${placeholders})
       ORDER BY occurred_at DESC, inserted_at DESC
       LIMIT ?`,
    )
    .all(scope.tenant_id, ...processIds, RECENT_LIMIT) as AuditRow[];
}

// ── Projectors: pure functions of loaded rows ────────────────────────────────

/** Current State: counts straight from case_space_action_state. */
function projectCurrentState(rows: ActionStateRow[]): CaseSpaceView['currentState'] {
  const by = new Map(rows.map((r) => [r.status, r.n]));
  // attempted/done = in-flight or cleared (active); pending = waiting on a
  // hold; failed = blocked. Honest 1:1 with the action-state enum.
  return {
    active: (by.get('attempted') ?? 0) + (by.get('done') ?? 0),
    waitingApproval: by.get('pending') ?? 0,
    blocked: by.get('failed') ?? 0,
  };
}

/** Waiting On: the OPEN (held) holds, oldest first. */
function projectWaitingOn(holds: HoldRow[]): CaseSpaceView['waitingOn'] {
  return holds
    .filter((h) => h.status === 'held')
    .map((h) => {
      // requiredRole has no dedicated holds column yet; surface it from the
      // hold payload when present, else '' (never fabricated).
      const payload = parseJsonObject(h.payload_json);
      const requiredRole =
        typeof payload.requiredRole === 'string' ? payload.requiredRole : '';
      return {
        holdId: h.hold_id,
        action: h.action ?? '',
        requiredRole,
        requestedAt: h.created_at,
      };
    });
}

/** Generated Outputs tiles from loaded rows. */
function projectGeneratedOutputs(outputs: OutputRow[]): CaseSpaceView['generatedOutputs'] {
  return outputs.map((o) => {
    const content = parseJsonObject(o.content_json);
    const title =
      typeof content.title === 'string' && content.title.length > 0
        ? content.title
        : '(untitled output)';
    return {
      outputId: o.output_id,
      title,
      status: o.status,
      createdAt: o.created_at,
    };
  });
}

/** A terse, human summary line for a Recent Changes row. */
function summarize(subtype: string, payload: Record<string, unknown>): string {
  const outcome =
    payload.outcome && typeof payload.outcome === 'object'
      ? undefined
      : (payload.outcome as string | undefined);
  switch (subtype) {
    case 'pipeline.run':
      return outcome ? `Pipeline run (${outcome})` : 'Pipeline run';
    case 'pipeline.no_op':
      return 'Item received — no action (non-substantive)';
    case 'auth.refused':
      return 'Access denied';
    case 'hold.resolved': {
      const res = typeof payload.resolution === 'string' ? payload.resolution : '';
      return res ? `Hold ${res}` : 'Hold resolved';
    }
    default:
      return subtype;
  }
}

/** Recent Changes: summarized view of the loaded audit rows. */
function projectRecentChanges(auditEvents: AuditRow[]): CaseSpaceView['recentChanges'] {
  return auditEvents.map((a) => ({
    auditEventId: a.event_id,
    type: a.event_subtype,
    summary: summarize(a.event_subtype, parseJsonObject(a.payload_json)),
    createdAt: a.occurred_at,
  }));
}

/** Show Proof: raw view of the SAME loaded audit rows. */
function projectProof(auditEvents: AuditRow[]): CaseSpaceView['proof'] {
  return auditEvents.map((a) => ({
    auditEventId: a.event_id,
    type: a.event_subtype,
    payload: parseJsonObject(a.payload_json),
    createdAt: a.occurred_at,
  }));
}

/**
 * Project the full read model for one CaseSpace. Pure read: no INSERT/UPDATE,
 * no invented rows. An empty CaseSpace projects clean zeros / empty lists.
 *
 * INVARIANT (Issue #101): Recent Changes and Show Proof are two projections of
 * the SAME `auditEvents` fetch — one query, never independently sourced — so
 * they cannot diverge. recentChanges is the summarized view; proof is the raw
 * view, in identical order.
 */
export function projectCaseSpaceView(
  db: DatabaseHandle,
  scope: CaseSpaceScope,
): CaseSpaceView {
  const actionState = loadActionState(db, scope);
  const holds = loadHolds(db, scope);
  const outputs = loadGeneratedOutputs(db, scope);

  const processIds = deriveProcessIds({
    caseSpaceId: scope.case_space_id,
    holds,
    outputs,
  });
  const auditEvents = loadAuditEventsByProcessIds(db, scope, processIds);

  return {
    caseSpaceId: scope.case_space_id,
    currentState: projectCurrentState(actionState),
    waitingOn: projectWaitingOn(holds),
    recentChanges: projectRecentChanges(auditEvents),
    generatedOutputs: projectGeneratedOutputs(outputs),
    proof: projectProof(auditEvents),
  };
}
