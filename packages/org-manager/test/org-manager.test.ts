import { describe, it, expect, beforeEach } from 'vitest';
import { getDb, migrate, type DatabaseHandle } from '@pj/db';
import {
  PJIdentityNotFound,
  assign,
  can,
  deactivateIdentity,
  whois,
} from '../src/index.js';

const TENANT = 't-canon';
const OTHER_TENANT = 't-other';
const ASSIGNED_BY = 'sys-bootstrap';

function fresh(): DatabaseHandle {
  const db = getDb(':memory:');
  migrate(db);
  db.prepare('INSERT INTO tenants (id, name, canon_version) VALUES (?, ?, ?)').run(
    TENANT, 'Canon', '1.0.0',
  );
  db.prepare('INSERT INTO tenants (id, name, canon_version) VALUES (?, ?, ?)').run(
    OTHER_TENANT, 'Other', '1.0.0',
  );
  return db;
}

function makeIdentity(db: DatabaseHandle, id: string, tenantId = TENANT): void {
  db.prepare(
    `INSERT INTO identities (identity_id, tenant_id, kind, active) VALUES (?, ?, 'person', 1)`,
  ).run(id, tenantId);
}

function makeProcess(db: DatabaseHandle, processId: string, tenantId = TENANT): void {
  db.prepare(
    `INSERT INTO processes (
       process_id, process_type, canon_version, tenant_id, deployment_id,
       current_state, created_by_ref
     ) VALUES (?, 'PRR', '1.0.0', ?, 'default', 'received', 'system')`,
  ).run(processId, tenantId);
}

function countAuditByFamily(db: DatabaseHandle, family: string): number {
  const row = db
    .prepare(`SELECT COUNT(*) as n FROM audit_events WHERE event_family = ?`)
    .get(family) as { n: number };
  return row.n;
}

describe('@pj/org-manager', () => {
  let db: DatabaseHandle;
  beforeEach(() => { db = fresh(); });

  // ── whois ─────────────────────────────────────────────────────────────────

  it('whois() returns identity row, including title from latest active assignment', () => {
    makeIdentity(db, 'u1');
    makeProcess(db, 'p1');
    assign(db, 'p1', 'records_officer', { strategy: 'named_default', identity_ref: 'u1' }, TENANT, ASSIGNED_BY);

    const result = whois(db, 'u1', TENANT);
    expect(result.identity_id).toBe('u1');
    expect(result.tenant_id).toBe(TENANT);
    expect(result.active).toBe(true);
    expect(result.title).toBe('records_officer');
  });

  it('whois() throws PJIdentityNotFound when the identity exists only in another tenant', () => {
    makeIdentity(db, 'u-cross', OTHER_TENANT);
    expect(() => whois(db, 'u-cross', TENANT)).toThrowError(PJIdentityNotFound);
  });

  // ── can ───────────────────────────────────────────────────────────────────

  it('can() returns true for administrator + process.transition', () => {
    makeIdentity(db, 'u-admin');
    makeProcess(db, 'p1');
    assign(db, 'p1', 'administrator', { strategy: 'named_default', identity_ref: 'u-admin' }, TENANT, ASSIGNED_BY);

    const ok = can(db, 'u-admin', 'process.transition', 'p1', TENANT);
    expect(ok).toBe(true);
  });

  it('can() returns false for requestor + process.transition (requestor has read only)', () => {
    makeIdentity(db, 'u-req');
    makeProcess(db, 'p1');
    assign(db, 'p1', 'requestor', { strategy: 'named_default', identity_ref: 'u-req' }, TENANT, ASSIGNED_BY);

    const ok = can(db, 'u-req', 'process.transition', 'p1', TENANT);
    expect(ok).toBe(false);
  });

  it('can() always appends auth.granted or auth.refused to audit_events', () => {
    makeIdentity(db, 'u-admin');
    makeIdentity(db, 'u-req');
    makeProcess(db, 'p1');
    assign(db, 'p1', 'administrator', { strategy: 'named_default', identity_ref: 'u-admin' }, TENANT, ASSIGNED_BY);
    assign(db, 'p1', 'requestor', { strategy: 'named_default', identity_ref: 'u-req' }, TENANT, ASSIGNED_BY);

    const beforeAuth = countAuditByFamily(db, 'auth');

    can(db, 'u-admin', 'process.transition', 'p1', TENANT);  // → granted
    can(db, 'u-req',   'process.transition', 'p1', TENANT);  // → refused
    can(db, 'u-admin', 'audit.export',       'p1', TENANT);  // → granted

    const afterAuth = countAuditByFamily(db, 'auth');
    expect(afterAuth - beforeAuth).toBe(3);

    // ORDER BY rowid — SQLite's monotonic insertion order. occurred_at is
    // millisecond precision; same-ms inserts would tie under it.
    const events = db
      .prepare(`SELECT event_subtype, actor_ref FROM audit_events
                 WHERE event_family = 'auth' ORDER BY rowid ASC`)
      .all() as Array<{ event_subtype: string; actor_ref: string }>;
    const tail = events.slice(-3);
    expect(tail.map((e) => e.event_subtype)).toEqual([
      'auth.granted',
      'auth.refused',
      'auth.granted',
    ]);
  });

  // ── assign ────────────────────────────────────────────────────────────────

  it('assign() named_default always picks the specified identity', () => {
    makeIdentity(db, 'u1');
    makeIdentity(db, 'u2');
    makeProcess(db, 'p1');
    const chosen = assign(
      db, 'p1', 'reviewer',
      { strategy: 'named_default', identity_ref: 'u2' },
      TENANT, ASSIGNED_BY,
    );
    expect(chosen).toBe('u2');

    const rows = db
      .prepare(`SELECT identity_id, role_type FROM assignments WHERE process_id = ?`)
      .all('p1') as Array<{ identity_id: string; role_type: string }>;
    expect(rows).toEqual([{ identity_id: 'u2', role_type: 'reviewer' }]);
  });

  it('assign() round_robin distributes evenly across 3 identities over 6 assignments', () => {
    makeIdentity(db, 'u1');
    makeIdentity(db, 'u2');
    makeIdentity(db, 'u3');
    for (let i = 1; i <= 6; i += 1) makeProcess(db, `p${i}`);

    const picks: string[] = [];
    for (let i = 1; i <= 6; i += 1) {
      picks.push(
        assign(
          db, `p${i}`, 'reviewer',
          { strategy: 'round_robin', role_type: 'reviewer' },
          TENANT, ASSIGNED_BY,
        ),
      );
    }

    const counts = picks.reduce<Record<string, number>>((acc, id) => {
      acc[id] = (acc[id] ?? 0) + 1;
      return acc;
    }, {});
    expect(counts).toEqual({ u1: 2, u2: 2, u3: 2 });
  });

  // ── deactivateIdentity ────────────────────────────────────────────────────

  it('deactivateIdentity() sets active=0 and closes open assignments', () => {
    makeIdentity(db, 'u-admin');
    makeProcess(db, 'p1');
    makeProcess(db, 'p2');
    assign(db, 'p1', 'administrator', { strategy: 'named_default', identity_ref: 'u-admin' }, TENANT, ASSIGNED_BY);
    assign(db, 'p2', 'administrator', { strategy: 'named_default', identity_ref: 'u-admin' }, TENANT, ASSIGNED_BY);

    deactivateIdentity(db, 'u-admin', TENANT);

    const identity = db
      .prepare(`SELECT active, deactivated_at FROM identities WHERE identity_id = ?`)
      .get('u-admin') as { active: number; deactivated_at: string | null };
    expect(identity.active).toBe(0);
    expect(identity.deactivated_at).toBeTruthy();

    const openCount = (db
      .prepare(`SELECT COUNT(*) as n FROM assignments WHERE identity_id = ? AND unassigned_at IS NULL`)
      .get('u-admin') as { n: number }).n;
    expect(openCount).toBe(0);

    const deactivatedEvent = db
      .prepare(`SELECT payload_json FROM audit_events
                 WHERE event_subtype = 'role.deactivated' AND actor_ref = ?`)
      .get('u-admin') as { payload_json: string };
    const payload = JSON.parse(deactivatedEvent.payload_json) as { open_assignments_closed: number };
    expect(payload.open_assignments_closed).toBe(2);
  });

  it('deactivated identity → can() returns false even for the administrator role', () => {
    makeIdentity(db, 'u-admin');
    makeProcess(db, 'p1');
    assign(db, 'p1', 'administrator', { strategy: 'named_default', identity_ref: 'u-admin' }, TENANT, ASSIGNED_BY);
    expect(can(db, 'u-admin', 'process.transition', 'p1', TENANT)).toBe(true);

    deactivateIdentity(db, 'u-admin', TENANT);

    expect(can(db, 'u-admin', 'process.transition', 'p1', TENANT)).toBe(false);

    const lastAuth = db
      .prepare(`SELECT event_subtype, payload_json FROM audit_events
                 WHERE event_family = 'auth'
                 ORDER BY rowid DESC LIMIT 1`)
      .get() as { event_subtype: string; payload_json: string };
    expect(lastAuth.event_subtype).toBe('auth.refused');
    const payload = JSON.parse(lastAuth.payload_json) as { reason: string };
    expect(payload.reason).toBe('identity_inactive');
  });
});
