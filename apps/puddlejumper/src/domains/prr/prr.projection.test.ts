// Gate 3 invariant: a case is a projection of the event log.
//
// Kill the box, restart, and the case rebuilds identically from
// audit_events — no state lost, no state invented. This test makes that
// claim executable: it walks one proof-of-life case through all seven PRR
// states, snapshots the projection, then reconstructs `processes` purely
// from `audit_events` and asserts the projection is byte-for-byte identical.

import { describe, it, expect, beforeEach } from 'vitest';
import { getDb, migrate, type DatabaseHandle } from '@pj/db';
import {
  createPRR,
  getPRR,
  transitionPRR,
  closePRR,
  rebuildProjectionFromAudit,
} from './prr.store.js';

const TENANT = 't-canon';
const ACTOR = 'u-actor';

// The full statutory walk: received → … → closed.
const WALK = [
  'intake_complete', // received  → logged
  'route', //           logged    → assigned
  'search_begin', //    assigned  → searching
  'search_complete', // searching → reviewing
  'respond', //         reviewing → responded
] as const;

const EXPECTED_STATES = [
  'received',
  'logged',
  'assigned',
  'searching',
  'reviewing',
  'responded',
  'closed',
];

function fresh(): DatabaseHandle {
  const db = getDb(':memory:');
  migrate(db);
  db.prepare('INSERT INTO tenants (id, name, canon_version) VALUES (?, ?, ?)').run(
    TENANT, 'Canon Tenant', '1.0.0',
  );
  return db;
}

function walkOneCase(db: DatabaseHandle): string {
  const created = createPRR(db, TENANT, ACTOR, {
    fields: { subject: 'Proof of life — meeting minutes' },
    links: [{ rel: 'origin', ref: 'seed:welcome' }] as never,
  });
  for (const trigger of WALK) {
    transitionPRR(db, TENANT, created.process_id, trigger, ACTOR);
  }
  closePRR(db, TENANT, created.process_id, ACTOR);
  return created.process_id;
}

describe('prr.projection — case rebuilds identically from audit_events', () => {
  let db: DatabaseHandle;
  beforeEach(() => { db = fresh(); });

  it('stamps every transition to audit_events in canon order', () => {
    const id = walkOneCase(db);
    const events = db
      .prepare(
        `SELECT event_family, event_subtype, payload_json FROM audit_events
          WHERE process_id = ? ORDER BY occurred_at ASC, rowid ASC`,
      )
      .all(id) as Array<{ event_family: string; event_subtype: string; payload_json: string }>;

    // process.created + 5 transition.fired + process.closed = 7 stamps.
    expect(events).toHaveLength(7);
    expect(events[0]!.event_subtype).toBe('process.created');
    expect(events.at(-1)!.event_subtype).toBe('process.closed');

    // The ordered states the log implies, start to finish.
    const statesFromLog = [
      JSON.parse(events[0]!.payload_json).initial_state as string,
      ...events.slice(1).map((e) => JSON.parse(e.payload_json).to as string),
    ];
    expect(statesFromLog).toEqual(EXPECTED_STATES);
  });

  it('rebuilds the projection byte-for-byte from the log (the magic moment)', () => {
    const id = walkOneCase(db);

    const before = getPRR(db, TENANT, id);
    expect(before?.current_state).toBe('closed');

    // Simulate killing the box and restarting against the same audit log:
    // drop the projection entirely, then refold it from audit_events.
    db.prepare('DELETE FROM processes').run();
    expect(getPRR(db, TENANT, id)).toBeNull();

    const { rebuilt } = rebuildProjectionFromAudit(db, { tenantId: TENANT });
    expect(rebuilt).toBe(1);

    const after = getPRR(db, TENANT, id);
    expect(after).toEqual(before);
  });

  it('treats the log as authority — heals a corrupted projection', () => {
    const id = walkOneCase(db);
    const truth = getPRR(db, TENANT, id);

    // Tamper with the projection directly (processes is NOT append-only).
    db.prepare(
      `UPDATE processes SET current_state = 'received', closed_at = NULL WHERE process_id = ?`,
    ).run(id);
    expect(getPRR(db, TENANT, id)?.current_state).toBe('received');

    // A rebuild discards the tampered state and restores the log's truth.
    rebuildProjectionFromAudit(db, { tenantId: TENANT });
    expect(getPRR(db, TENANT, id)).toEqual(truth);
  });

  it('invents no state — rebuild yields exactly the cases in the log', () => {
    walkOneCase(db);
    walkOneCase(db);
    db.prepare('DELETE FROM processes').run();
    const { rebuilt } = rebuildProjectionFromAudit(db);
    expect(rebuilt).toBe(2);
    const count = db.prepare('SELECT COUNT(*) AS n FROM processes').get() as { n: number };
    expect(count.n).toBe(2);
  });
});
