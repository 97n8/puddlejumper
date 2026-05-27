// Read-only audit query store. All writes go through @pj/db.appendAuditEvent.

import type { DatabaseHandle } from '@pj/db';
import type { AuditEvent, AuditEventFamily, PJPaginated } from '@publiclogic/core';

export interface AuditListFilters {
  family?: AuditEventFamily;
  subtype?: string;
  process_id?: string;
  actor_ref?: string;
  /** Cursor is the `occurred_at` of the prior page's last row. */
  cursor?: string | null;
  limit?: number;
}

export function listAuditEvents(
  db: DatabaseHandle,
  tenantId: string,
  filters: AuditListFilters = {},
): PJPaginated<AuditEvent> {
  const limit = Math.max(1, Math.min(filters.limit ?? 50, 500));
  const conds = ['tenant_id = ?'];
  const params: unknown[] = [tenantId];

  if (filters.family) {
    conds.push('event_family = ?');
    params.push(filters.family);
  }
  if (filters.subtype) {
    conds.push('event_subtype = ?');
    params.push(filters.subtype);
  }
  if (filters.process_id) {
    conds.push('process_id = ?');
    params.push(filters.process_id);
  }
  if (filters.actor_ref) {
    conds.push('actor_ref = ?');
    params.push(filters.actor_ref);
  }
  if (filters.cursor) {
    conds.push('occurred_at < ?');
    params.push(filters.cursor);
  }

  const rows = db
    .prepare(
      `SELECT * FROM audit_events
       WHERE ${conds.join(' AND ')}
       ORDER BY occurred_at DESC, event_id DESC
       LIMIT ?`,
    )
    .all(...params, limit + 1) as AuditEvent[];

  const hasMore = rows.length > limit;
  const page = rows.slice(0, limit);
  const next_cursor = hasMore ? page[page.length - 1]!.occurred_at : null;

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

/** Tenant-scoped audit stream for a single process, oldest first. */
export function listAuditEventsForProcess(
  db: DatabaseHandle,
  tenantId: string,
  processId: string,
  opts: { limit?: number } = {},
): AuditEvent[] {
  const limit = Math.max(1, Math.min(opts.limit ?? 500, 5000));
  return db
    .prepare(
      `SELECT * FROM audit_events
       WHERE tenant_id = ? AND process_id = ?
       ORDER BY occurred_at ASC, event_id ASC
       LIMIT ?`,
    )
    .all(tenantId, processId, limit) as AuditEvent[];
}
