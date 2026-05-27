// PRR canon store — the only path that reads/writes PRR processes.
// Every transition appends to audit_events via @pj/db.appendAuditEvent
// (the only sanctioned write path, canon rule 2).

import crypto from 'node:crypto';
import { appendAuditEvent, type DatabaseHandle } from '@pj/db';
import type { Process, PJPaginated } from '@publiclogic/core';
import {
  INITIAL_STATE,
  PJInvalidTransition,
  TERMINAL_STATES,
  validateTransition,
  type PrrState,
  type PrrTrigger,
} from './prr.machine.js';

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
