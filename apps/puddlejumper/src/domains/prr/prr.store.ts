// PRR canon store — the only path that reads/writes PRR processes.
// Every transition appends to audit_events via @pj/db.appendAuditEvent
// (the only sanctioned write path, canon rule 2).

import crypto from 'node:crypto';
import { appendAuditEvent, type DatabaseHandle } from '@pj/db';
import type { Process, PJPaginated } from '@publiclogic/core';
import {
  INITIAL_STATE,
  PJFieldsClosed,
  PJInvalidTransition,
  TERMINAL_STATES,
  validateTransition,
  type PrrState,
  type PrrTrigger,
} from './prr.machine.js';
import type { PatchFieldsInput } from './prr.schemas.js';

const PROCESS_TYPE = 'PRR' as const;
const CANON_VERSION = '1.0.0';

/** Deployment identifier — overridable via env for multi-tenant deploys. */
function deploymentId(): string {
  return process.env.PJ_DEPLOYMENT_ID ?? 'default';
}

type ProcessRow = {
  process_id: string;
  process_type: string;
  canon_version: string;
  tenant_id: string;
  deployment_id: string;
  current_state: string;
  created_at: string;
  created_by_ref: string;
  assignee_ref: string | null;
  closed_at: string | null;
  fields: string;
  links: string;
};

function rowToProcess(row: ProcessRow): Process {
  return {
    process_id: row.process_id,
    process_type: row.process_type as Process['process_type'],
    canon_version: row.canon_version,
    tenant_id: row.tenant_id,
    deployment_id: row.deployment_id,
    current_state: row.current_state,
    created_at: row.created_at,
    created_by_ref: row.created_by_ref,
    assignee_ref: row.assignee_ref,
    closed_at: row.closed_at,
    fields: JSON.parse(row.fields) as Record<string, unknown>,
    links: JSON.parse(row.links) as Process['links'],
  };
}

export interface CreatePRRInput {
  fields: Record<string, unknown>;
  /** Optional links to other processes/documents. */
  links?: Process['links'];
}

/**
 * Create a new PRR. Initial state is always 'received'. Appends a
 * `process.created` audit event in the same transaction.
 */
export function createPRR(
  db: DatabaseHandle,
  tenantId: string,
  createdByRef: string,
  input: CreatePRRInput,
): Process {
  const process_id = crypto.randomUUID();
  const created_at = new Date().toISOString();
  const fields = JSON.stringify(input.fields ?? {});
  const links = JSON.stringify(input.links ?? []);

  const tx = db.transaction(() => {
    db.prepare(
      `INSERT INTO processes (
         process_id, process_type, canon_version, tenant_id, deployment_id,
         current_state, created_at, created_by_ref, fields, links
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      process_id,
      PROCESS_TYPE,
      CANON_VERSION,
      tenantId,
      deploymentId(),
      INITIAL_STATE,
      created_at,
      createdByRef,
      fields,
      links,
    );

    appendAuditEvent(db, {
      event_family: 'process',
      event_subtype: 'process.created',
      canon_version: CANON_VERSION,
      deployment_id: deploymentId(),
      tenant_id: tenantId,
      process_id,
      actor_ref: createdByRef,
      occurred_at: created_at,
      payload: {
        process_type: PROCESS_TYPE,
        initial_state: INITIAL_STATE,
        fields: input.fields ?? {},
        // Carry links in the creation event so the case is fully
        // reconstructable from audit_events alone (canon rule 2: the log is
        // the source of truth). Without this the projection would hold a
        // field the log does not — and it would not be a true projection.
        links: input.links ?? [],
      },
    });
  });
  tx();

  return getPRR(db, tenantId, process_id)!;
}

/** Tenant-scoped read. Returns null if not found OR if tenant mismatch. */
export function getPRR(
  db: DatabaseHandle,
  tenantId: string,
  processId: string,
): Process | null {
  const row = db
    .prepare(
      `SELECT * FROM processes
       WHERE process_id = ? AND tenant_id = ? AND process_type = ?`,
    )
    .get(processId, tenantId, PROCESS_TYPE) as ProcessRow | undefined;
  return row ? rowToProcess(row) : null;
}

export interface ListPRRFilters {
  state?: PrrState;
  assignee_ref?: string;
  limit?: number;
  cursor?: string | null;
}

/** Always tenant-scoped. Cursor is the last `created_at` of the prior page. */
export function listPRR(
  db: DatabaseHandle,
  tenantId: string,
  filters: ListPRRFilters = {},
): PJPaginated<Process> {
  const limit = Math.max(1, Math.min(filters.limit ?? 50, 200));
  const conds = ['tenant_id = ?', 'process_type = ?'];
  const params: unknown[] = [tenantId, PROCESS_TYPE];
  if (filters.state) {
    conds.push('current_state = ?');
    params.push(filters.state);
  }
  if (filters.assignee_ref) {
    conds.push('assignee_ref = ?');
    params.push(filters.assignee_ref);
  }
  if (filters.cursor) {
    conds.push('created_at < ?');
    params.push(filters.cursor);
  }

  const rows = db
    .prepare(
      `SELECT * FROM processes
       WHERE ${conds.join(' AND ')}
       ORDER BY created_at DESC
       LIMIT ?`,
    )
    .all(...params, limit + 1) as ProcessRow[];

  const hasMore = rows.length > limit;
  const page = rows.slice(0, limit).map(rowToProcess);
  const next_cursor = hasMore ? page[page.length - 1]!.created_at : null;

  return {
    ok: true,
    data: page,
    page: {
      limit,
      cursor: filters.cursor ?? null,
      next_cursor,
    },
  };
}

/**
 * Validate and apply a state transition. Throws `PJInvalidTransition` if the
 * trigger is not permitted from the current state. Appends `transition.fired`
 * to audit_events in the same transaction.
 */
export function transitionPRR(
  db: DatabaseHandle,
  tenantId: string,
  processId: string,
  trigger: PrrTrigger,
  actorRef: string,
): Process {
  const existing = getPRR(db, tenantId, processId);
  if (!existing) {
    throw new PJInvalidTransition(
      INITIAL_STATE,
      trigger,
      `PRR '${processId}' not found in tenant`,
    );
  }
  const from = existing.current_state as PrrState;
  const check = validateTransition(from, trigger);
  if (!check.valid) {
    throw new PJInvalidTransition(from, trigger, check.reason);
  }
  const to = check.to;
  const occurred_at = new Date().toISOString();

  const tx = db.transaction(() => {
    db.prepare(
      `UPDATE processes SET current_state = ? WHERE process_id = ? AND tenant_id = ?`,
    ).run(to, processId, tenantId);

    appendAuditEvent(db, {
      event_family: 'transition',
      event_subtype: 'transition.fired',
      canon_version: CANON_VERSION,
      deployment_id: deploymentId(),
      tenant_id: tenantId,
      process_id: processId,
      actor_ref: actorRef,
      occurred_at,
      payload: { from, to, trigger },
    });
  });
  tx();

  return getPRR(db, tenantId, processId)!;
}

/**
 * Close a PRR. Only valid from 'responded' (per canon transition table).
 * Sets closed_at and appends `process.closed` to audit_events.
 */
export function closePRR(
  db: DatabaseHandle,
  tenantId: string,
  processId: string,
  actorRef: string,
): Process {
  const existing = getPRR(db, tenantId, processId);
  if (!existing) {
    throw new PJInvalidTransition(
      INITIAL_STATE,
      'close',
      `PRR '${processId}' not found in tenant`,
    );
  }
  const from = existing.current_state as PrrState;
  const check = validateTransition(from, 'close');
  if (!check.valid) {
    throw new PJInvalidTransition(from, 'close', check.reason);
  }
  const closed_at = new Date().toISOString();

  const tx = db.transaction(() => {
    db.prepare(
      `UPDATE processes
       SET current_state = ?, closed_at = ?
       WHERE process_id = ? AND tenant_id = ?`,
    ).run('closed', closed_at, processId, tenantId);

    appendAuditEvent(db, {
      event_family: 'process',
      event_subtype: 'process.closed',
      canon_version: CANON_VERSION,
      deployment_id: deploymentId(),
      tenant_id: tenantId,
      process_id: processId,
      actor_ref: actorRef,
      occurred_at: closed_at,
      payload: { from, to: 'closed', trigger: 'close' },
    });
  });
  tx();

  return getPRR(db, tenantId, processId)!;
}

export { TERMINAL_STATES };

// ── Projection rebuild (canon rule 2: cases is a projection of audit_events) ──

type ProjectionAccumulator = {
  process_id: string;
  process_type: string;
  canon_version: string;
  tenant_id: string;
  deployment_id: string;
  current_state: string;
  created_at: string;
  created_by_ref: string;
  assignee_ref: string | null;
  closed_at: string | null;
  fields: Record<string, unknown>;
  links: unknown;
};

export interface RebuildProjectionResult {
  rebuilt: number;
}

/**
 * Rebuild the `processes` projection purely from `audit_events`.
 *
 * This is the canon invariant made executable: `processes` carries no
 * authority of its own — it is a fold of the append-only event log. Drop the
 * box, restart, call this, and every case returns identically. No in-memory
 * state, no information that isn't in the log.
 *
 * Determinism: events are replayed in (occurred_at, rowid) order. `rowid` is
 * SQLite's monotonic append counter, so events sharing a millisecond still
 * resolve to true insertion order.
 *
 * Skin-agnostic (Guardrail 9): the fold never branches on process_type /
 * CaseSpace Type — every process family is reconstructed by the same rules.
 *
 * Scope note: deletes-then-reinserts the `processes` rows. `audit_events` does
 * not reference `processes`, and the runtime never writes `assignments` for
 * PRR, so the DELETE is FK-safe. Pass `tenantId` to scope the rebuild to one
 * tenant; omit it to rebuild the whole projection.
 */
export function rebuildProjectionFromAudit(
  db: DatabaseHandle,
  opts: { tenantId?: string } = {},
): RebuildProjectionResult {
  const where = opts.tenantId ? 'WHERE tenant_id = ?' : '';
  const selectParams = opts.tenantId ? [opts.tenantId] : [];

  const rows = db
    .prepare(
      `SELECT event_subtype, canon_version, deployment_id, tenant_id,
              process_id, actor_ref, occurred_at, payload_json
         FROM audit_events
         ${where}
        ORDER BY occurred_at ASC, rowid ASC`,
    )
    .all(...selectParams) as Array<{
      event_subtype: string;
      canon_version: string;
      deployment_id: string;
      tenant_id: string;
      process_id: string | null;
      actor_ref: string | null;
      occurred_at: string;
      payload_json: string;
    }>;

  const acc = new Map<string, ProjectionAccumulator>();

  for (const ev of rows) {
    if (!ev.process_id) continue;
    const payload = JSON.parse(ev.payload_json) as Record<string, unknown>;
    switch (ev.event_subtype) {
      case 'process.created': {
        acc.set(ev.process_id, {
          process_id: ev.process_id,
          process_type: String(payload.process_type ?? PROCESS_TYPE),
          canon_version: ev.canon_version,
          tenant_id: ev.tenant_id,
          deployment_id: ev.deployment_id,
          current_state: String(payload.initial_state ?? INITIAL_STATE),
          created_at: ev.occurred_at,
          created_by_ref: ev.actor_ref ?? 'unknown',
          assignee_ref: null,
          closed_at: null,
          fields: (payload.fields as Record<string, unknown>) ?? {},
          links: payload.links ?? [],
        });
        break;
      }
      case 'transition.fired': {
        const row = acc.get(ev.process_id);
        if (row) row.current_state = String(payload.to ?? row.current_state);
        break;
      }
      case 'process.closed': {
        const row = acc.get(ev.process_id);
        if (row) {
          row.current_state = 'closed';
          row.closed_at = ev.occurred_at;
        }
        break;
      }
      case 'process.fields_updated': {
        const row = acc.get(ev.process_id);
        const after = payload.after as Record<string, unknown> | undefined;
        if (row && after) row.fields = { ...row.fields, ...after };
        break;
      }
      default:
        // Non-projecting families (role / auth / system / divergence). Ignored.
        break;
    }
  }

  const tx = db.transaction(() => {
    if (opts.tenantId) {
      db.prepare('DELETE FROM processes WHERE tenant_id = ?').run(opts.tenantId);
    } else {
      db.prepare('DELETE FROM processes').run();
    }
    const insert = db.prepare(
      `INSERT INTO processes (
         process_id, process_type, canon_version, tenant_id, deployment_id,
         current_state, created_at, created_by_ref, assignee_ref, closed_at,
         fields, links
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    for (const row of acc.values()) {
      insert.run(
        row.process_id,
        row.process_type,
        row.canon_version,
        row.tenant_id,
        row.deployment_id,
        row.current_state,
        row.created_at,
        row.created_by_ref,
        row.assignee_ref,
        row.closed_at,
        JSON.stringify(row.fields),
        JSON.stringify(row.links),
      );
    }
  });
  tx();

  return { rebuilt: acc.size };
}

// ── updateFields (Phase 5.1) ────────────────────────────────────────────────

/** Result of updateFields — `changed` is the list of allowlist keys that
 *  actually changed (no-op patches return `changed: []` without writing). */
export interface UpdateFieldsResult {
  process: Process;
  changed: string[];
}

const FIELD_KEYS = ['checklist', 'notes', 'automation'] as const;
type AllowedField = typeof FIELD_KEYS[number];

/** Stable JSON for change-detection equality (sorted keys, recursive). */
function stableJson(value: unknown): string {
  if (value === null || value === undefined) return 'null';
  if (typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  const body = keys.map((k) => `${JSON.stringify(k)}:${stableJson(obj[k])}`).join(',');
  return `{${body}}`;
}

/**
 * Apply an allowlisted patch to a PRR's `fields` JSON.
 *
 * Behavior:
 *   - Tenant-scoped lookup. Missing PRR throws (caller maps to 404).
 *   - Closed PRRs refuse the patch — throws PJFieldsClosed (→ 409).
 *   - No-op patches (every supplied key equals the current value) return
 *     `changed: []` without writing or auditing.  Matters because the UI
 *     re-sends full checklist arrays on every toggle.
 *   - A real change writes the full new `fields` JSON and emits a single
 *     `process.fields_updated` audit event with `{ changed, before, after }`
 *     (before/after include only the keys that actually changed).
 *   - The UPDATE and the appendAuditEvent commit in one transaction.
 */
export function updateFields(
  db: DatabaseHandle,
  args: {
    tenantId: string;
    prrId: string;
    actorRef: string;
    patch: PatchFieldsInput;
  },
): UpdateFieldsResult {
  const { tenantId, prrId, actorRef, patch } = args;

  const existing = getPRR(db, tenantId, prrId);
  if (!existing) {
    // Mirrors the convention used elsewhere in this store: surface absence
    // via a transition-style error so the route handler can branch on it.
    throw new PJInvalidTransition(
      INITIAL_STATE,
      'intake_complete',
      `PRR '${prrId}' not found in tenant`,
    );
  }
  if (existing.current_state === 'closed') {
    throw new PJFieldsClosed(prrId);
  }

  const currentFields = existing.fields ?? {};
  const before: Record<string, unknown> = {};
  const after:  Record<string, unknown> = {};
  const changed: string[] = [];

  for (const key of FIELD_KEYS) {
    const k: AllowedField = key;
    if (!(k in patch) || patch[k] === undefined) continue;
    const cur = currentFields[k];
    const next = patch[k];
    if (stableJson(cur) === stableJson(next)) continue;
    before[k] = cur ?? null;
    after[k] = next;
    changed.push(k);
  }

  if (changed.length === 0) {
    return { process: existing, changed: [] };
  }

  const nextFields: Record<string, unknown> = { ...currentFields };
  for (const k of changed) nextFields[k] = after[k];

  const occurred_at = new Date().toISOString();

  const tx = db.transaction(() => {
    db.prepare(
      `UPDATE processes SET fields = ? WHERE process_id = ? AND tenant_id = ?`,
    ).run(JSON.stringify(nextFields), prrId, tenantId);

    appendAuditEvent(db, {
      event_family: 'process',
      event_subtype: 'process.fields_updated',
      canon_version: CANON_VERSION,
      deployment_id: deploymentId(),
      tenant_id: tenantId,
      process_id: prrId,
      actor_ref: actorRef,
      occurred_at,
      payload: { changed, before, after },
    });
  });
  tx();

  return { process: getPRR(db, tenantId, prrId)!, changed };
}
