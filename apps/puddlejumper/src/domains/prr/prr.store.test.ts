import { describe, it, expect, beforeEach } from 'vitest';
import { getDb, migrate, type DatabaseHandle } from '@pj/db';
import {
  createPRR,
  getPRR,
  listPRR,
  transitionPRR,
  closePRR,
  updateFields,
} from './prr.store.js';
import { PJFieldsClosed, PJInvalidTransition } from './prr.machine.js';
import { PatchFieldsSchema } from './prr.schemas.js';

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

describe('PatchFieldsSchema — strict allowlist', () => {
  it('accepts a valid checklist patch', () => {
    const r = PatchFieldsSchema.safeParse({
      checklist: [{ id: 'a', label: 'Pick precinct', done: true }],
    });
    expect(r.success).toBe(true);
  });

  it('rejects an empty patch with fields.empty_patch', () => {
    const r = PatchFieldsSchema.safeParse({});
    expect(r.success).toBe(false);
    if (!r.success) {
      const codes = r.error.issues.map((i) => i.message);
      expect(codes).toContain('fields.empty_patch');
    }
  });

  it('rejects unknown top-level keys (canon: cannot mutate state via this route)', () => {
    const r = PatchFieldsSchema.safeParse({ state: 'closed' });
    expect(r.success).toBe(false);
    if (!r.success) {
      const unrecognized = r.error.issues.find((i) => i.code === 'unrecognized_keys');
      expect(unrecognized).toBeTruthy();
    }
  });

  it('rejects notes longer than 8000 chars', () => {
    const r = PatchFieldsSchema.safeParse({ notes: 'x'.repeat(8001) });
    expect(r.success).toBe(false);
  });

  it('accepts automation: null (clearing the binding)', () => {
    const r = PatchFieldsSchema.safeParse({ automation: null });
    expect(r.success).toBe(true);
  });
});

describe('updateFields — Phase 5.1', () => {
  let db: DatabaseHandle;
  beforeEach(() => { db = fresh(); });

  function freshChecklist() {
    return [
      { id: 'a', label: 'Pick precinct', done: false },
      { id: 'b', label: 'Knock', done: false },
    ];
  }

  it('writes a checklist patch, emits process.fields_updated with before/after diff', () => {
    const prr = createPRR(db, TENANT, ACTOR, {
      fields: { subject: 'x', checklist: freshChecklist() },
    });
    transitionPRR(db, TENANT, prr.process_id, 'intake_complete', ACTOR);

    const toggled = [
      { id: 'a', label: 'Pick precinct', done: true },
      { id: 'b', label: 'Knock', done: false },
    ];
    const r = updateFields(db, {
      tenantId: TENANT,
      prrId: prr.process_id,
      actorRef: ACTOR,
      patch: { checklist: toggled },
    });
    expect(r.changed).toEqual(['checklist']);
    expect(r.process.fields.checklist).toEqual(toggled);

    const events = db
      .prepare(
        `SELECT event_subtype, payload_json FROM audit_events
         WHERE process_id = ? AND event_subtype = 'process.fields_updated'
         ORDER BY rowid ASC`,
      )
      .all(prr.process_id) as Array<{ event_subtype: string; payload_json: string }>;
    expect(events).toHaveLength(1);
    const payload = JSON.parse(events[0]!.payload_json) as {
      changed: string[];
      before: Record<string, unknown>;
      after: Record<string, unknown>;
    };
    expect(payload.changed).toEqual(['checklist']);
    expect(payload.before.checklist).toEqual(freshChecklist());
    expect(payload.after.checklist).toEqual(toggled);
  });

  it('no-op resubmit returns changed:[] and writes no audit event', () => {
    const checklist = freshChecklist();
    const prr = createPRR(db, TENANT, ACTOR, { fields: { checklist } });

    const r1 = updateFields(db, {
      tenantId: TENANT, prrId: prr.process_id, actorRef: ACTOR,
      patch: { checklist },
    });
    expect(r1.changed).toEqual([]);

    const events = db
      .prepare(
        `SELECT COUNT(*) AS n FROM audit_events
         WHERE process_id = ? AND event_subtype = 'process.fields_updated'`,
      )
      .get(prr.process_id) as { n: number };
    expect(events.n).toBe(0);
  });

  it('refuses with PJFieldsClosed when the PRR is closed', () => {
    const prr = createPRR(db, TENANT, ACTOR, { fields: { subject: 'x' } });
    // Drive through the happy path to 'closed'.
    transitionPRR(db, TENANT, prr.process_id, 'intake_complete', ACTOR);
    transitionPRR(db, TENANT, prr.process_id, 'route', ACTOR);
    transitionPRR(db, TENANT, prr.process_id, 'search_begin', ACTOR);
    transitionPRR(db, TENANT, prr.process_id, 'search_complete', ACTOR);
    transitionPRR(db, TENANT, prr.process_id, 'respond', ACTOR);
    closePRR(db, TENANT, prr.process_id, ACTOR);

    expect(() =>
      updateFields(db, {
        tenantId: TENANT, prrId: prr.process_id, actorRef: ACTOR,
        patch: { notes: 'late edit' },
      }),
    ).toThrowError(PJFieldsClosed);

    // No fields_updated event was written.
    const ev = db
      .prepare(
        `SELECT COUNT(*) AS n FROM audit_events
         WHERE process_id = ? AND event_subtype = 'process.fields_updated'`,
      )
      .get(prr.process_id) as { n: number };
    expect(ev.n).toBe(0);
  });

  it('wrong tenant cannot see (or mutate) the PRR — surfaces as not-found', () => {
    const prr = createPRR(db, TENANT, ACTOR, { fields: { subject: 'x' } });
    expect(() =>
      updateFields(db, {
        tenantId: OTHER_TENANT, prrId: prr.process_id, actorRef: ACTOR,
        patch: { notes: 'cross-tenant attempt' },
      }),
    ).toThrowError(PJInvalidTransition);
  });

  it('merges patch into existing fields without dropping unrelated keys', () => {
    const prr = createPRR(db, TENANT, ACTOR, {
      fields: { subject: 'records ledger', requester_email: 'jdoe@example.org' },
    });
    const r = updateFields(db, {
      tenantId: TENANT, prrId: prr.process_id, actorRef: ACTOR,
      patch: { notes: 'awaiting clarification' },
    });
    expect(r.changed).toEqual(['notes']);
    expect(r.process.fields.subject).toBe('records ledger');
    expect(r.process.fields.requester_email).toBe('jdoe@example.org');
    expect(r.process.fields.notes).toBe('awaiting clarification');
  });

  it('canon audit triggers still ABORT UPDATE on the audit row', () => {
    const prr = createPRR(db, TENANT, ACTOR, { fields: { checklist: freshChecklist() } });
    updateFields(db, {
      tenantId: TENANT, prrId: prr.process_id, actorRef: ACTOR,
      patch: { checklist: [{ id: 'a', label: 'Pick precinct', done: true }, { id: 'b', label: 'Knock', done: false }] },
    });
    const row = db
      .prepare(
        `SELECT event_id FROM audit_events
         WHERE process_id = ? AND event_subtype = 'process.fields_updated'`,
      )
      .get(prr.process_id) as { event_id: string };
    expect(() =>
      db.prepare(`UPDATE audit_events SET event_subtype = ? WHERE event_id = ?`)
        .run('tampered', row.event_id),
    ).toThrowError(/append-only/i);
  });
});
