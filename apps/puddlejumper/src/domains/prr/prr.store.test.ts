import { describe, it, expect, beforeEach } from 'vitest';
import { getDb, migrate, type DatabaseHandle } from '@pj/db';
import { createPRR, getPRR, listPRR, transitionPRR, closePRR } from './prr.store.js';
import { PJInvalidTransition } from './prr.machine.js';

const TENANT = 't-canon';
const OTHER_TENANT = 't-other';
const ACTOR = 'u-actor';

function fresh(): DatabaseHandle {
  const db = getDb(':memory:');
  migrate(db);
  // Both tenants needed for cross-tenant isolation check.
  db.prepare('INSERT INTO tenants (id, name, canon_version) VALUES (?, ?, ?)').run(
    TENANT, 'Canon Tenant', '1.0.0',
  );
  db.prepare('INSERT INTO tenants (id, name, canon_version) VALUES (?, ?, ?)').run(
    OTHER_TENANT, 'Other Tenant', '1.0.0',
  );
  return db;
}

describe('prr.store — canon contract', () => {
  let db: DatabaseHandle;
  beforeEach(() => { db = fresh(); });

  it('createPRR seeds state=received and emits process.created audit event', () => {
    const created = createPRR(db, TENANT, ACTOR, {
      fields: { subject: 'Records of meeting minutes' },
    });
    expect(created.process_type).toBe('PRR');
    expect(created.current_state).toBe('received');
    expect(created.tenant_id).toBe(TENANT);
    expect(created.created_by_ref).toBe(ACTOR);

    const events = db
      .prepare(`SELECT * FROM audit_events WHERE process_id = ? ORDER BY occurred_at ASC`)
      .all(created.process_id) as Array<{ event_family: string; event_subtype: string; actor_ref: string }>;
    expect(events).toHaveLength(1);
    expect(events[0]!.event_family).toBe('process');
    expect(events[0]!.event_subtype).toBe('process.created');
    expect(events[0]!.actor_ref).toBe(ACTOR);
  });

  it('transitionPRR(intake_complete) moves received → logged and emits transition.fired', () => {
    const created = createPRR(db, TENANT, ACTOR, { fields: { subject: 'x' } });
    const advanced = transitionPRR(db, TENANT, created.process_id, 'intake_complete', ACTOR);
    expect(advanced.current_state).toBe('logged');

    const transitionRow = db
      .prepare(
        `SELECT event_family, event_subtype, payload_json FROM audit_events
         WHERE process_id = ? AND event_family = 'transition'`,
      )
      .get(created.process_id) as { event_family: string; event_subtype: string; payload_json: string };
    expect(transitionRow.event_subtype).toBe('transition.fired');
    const payload = JSON.parse(transitionRow.payload_json) as { from: string; to: string; trigger: string };
    expect(payload).toEqual({ from: 'received', to: 'logged', trigger: 'intake_complete' });
  });

  it('runs the full statutory happy path and lands in closed', () => {
    const p = createPRR(db, TENANT, ACTOR, { fields: { subject: 'happy' } });
    transitionPRR(db, TENANT, p.process_id, 'intake_complete', ACTOR);
    transitionPRR(db, TENANT, p.process_id, 'route', ACTOR);
    transitionPRR(db, TENANT, p.process_id, 'search_begin', ACTOR);
    transitionPRR(db, TENANT, p.process_id, 'search_complete', ACTOR);
    transitionPRR(db, TENANT, p.process_id, 'respond', ACTOR);
    const closed = closePRR(db, TENANT, p.process_id, ACTOR);
    expect(closed.current_state).toBe('closed');
    expect(closed.closed_at).toBeTruthy();
  });

  it('throws PJInvalidTransition on illegal trigger from current state', () => {
    const p = createPRR(db, TENANT, ACTOR, { fields: { subject: 'x' } });
    expect(() =>
      transitionPRR(db, TENANT, p.process_id, 'respond', ACTOR),
    ).toThrowError(PJInvalidTransition);
  });

  it('throws PJInvalidTransition when closing from a non-responded state', () => {
    const p = createPRR(db, TENANT, ACTOR, { fields: { subject: 'x' } });
    expect(() => closePRR(db, TENANT, p.process_id, ACTOR)).toThrowError(PJInvalidTransition);
  });

  it('getPRR is tenant-scoped (other tenant cannot read)', () => {
    const p = createPRR(db, TENANT, ACTOR, { fields: { subject: 'x' } });
    expect(getPRR(db, OTHER_TENANT, p.process_id)).toBeNull();
    expect(getPRR(db, TENANT, p.process_id)?.process_id).toBe(p.process_id);
  });

  it('listPRR is tenant-scoped (other tenant sees empty)', () => {
    createPRR(db, TENANT, ACTOR, { fields: { subject: 'mine' } });
    createPRR(db, TENANT, ACTOR, { fields: { subject: 'mine2' } });
    createPRR(db, OTHER_TENANT, ACTOR, { fields: { subject: 'theirs' } });

    const mine = listPRR(db, TENANT);
    expect(mine.data).toHaveLength(2);
    const theirs = listPRR(db, OTHER_TENANT);
    expect(theirs.data).toHaveLength(1);
    expect(theirs.data[0]!.fields.subject).toBe('theirs');
  });

  it('listPRR filters by state', () => {
    const p1 = createPRR(db, TENANT, ACTOR, { fields: { s: 1 } });
    createPRR(db, TENANT, ACTOR, { fields: { s: 2 } });
    transitionPRR(db, TENANT, p1.process_id, 'intake_complete', ACTOR);

    const logged = listPRR(db, TENANT, { state: 'logged' });
    expect(logged.data).toHaveLength(1);
    expect(logged.data[0]!.process_id).toBe(p1.process_id);
  });
});
