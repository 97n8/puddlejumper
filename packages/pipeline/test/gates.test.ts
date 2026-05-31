// @pj/pipeline — C7 substance check + access gate tests.
// Stop early, but never silently.
//
// Proves: non-substantive input → no_op proof + stop (no state/holds); denied
// access → denial proof + stop BEFORE VAULT/state/holds; allowed access
// continues through C6; proof payload clearly says no_op or denied; unknown/no
// pack stays safe.

import { describe, it, expect, beforeEach } from 'vitest';
import { getDb, migrate, type DatabaseHandle } from '@pj/db';
import {
  runPipeline,
  seedTimedeskMuni,
  TIMEDESK_MUNI,
  type AccessEvaluator,
} from '../src/index.js';

const TENANT = 't_test';
const DEPLOYMENT = 'dpl_test';

function freshDb(): DatabaseHandle {
  const db = getDb(':memory:');
  migrate(db);
  return db;
}

function proofFor(db: DatabaseHandle, processId: string) {
  const row = db
    .prepare(
      `SELECT event_subtype, event_family, payload_json FROM audit_events
       WHERE process_id = ?`,
    )
    .get(processId) as
    | { event_subtype: string; event_family: string; payload_json: string }
    | undefined;
  return row;
}

function countRows(db: DatabaseHandle, table: string): number {
  return (db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get() as { n: number }).n;
}

const denyAll: AccessEvaluator = () => ({ granted: false, reason: 'test: denied' });

describe('@pj/pipeline — C7 substance check + access gate', () => {
  let db: DatabaseHandle;

  beforeEach(() => {
    db = freshDb();
  });

  it('non-substantive input returns no_op and writes proof (no state/holds)', () => {
    seedTimedeskMuni(db, TENANT);
    const result = runPipeline(db, {
      pack: 'timedesk.muni',
      tenant_id: TENANT,
      deployment_id: DEPLOYMENT,
      module: TIMEDESK_MUNI.module,
      environment: TIMEDESK_MUNI.environment,
      case_space_id: 'cs-noop',
      item: {}, // empty object → non-substantive
    });

    expect(result.outcome).toBe('no_op');
    expect(result.stopped_at).toBe('SUBSTANCE_CHECK');
    expect(result.ok).toBe(false);
    expect(result.vault).toBeNull();
    expect(result.state).toBeNull();
    expect(result.enrichment).toBeNull();

    // Nothing persisted: no state rows, no holds.
    expect(countRows(db, 'case_space_action_state')).toBe(0);
    expect(countRows(db, 'holds')).toBe(0);

    // But proof IS written — never a silent discard.
    const proof = proofFor(db, result.process_id);
    expect(proof?.event_subtype).toBe('pipeline.no_op');
    const payload = JSON.parse(proof!.payload_json) as { outcome: string };
    expect(payload.outcome).toBe('no_op');
  });

  it('denied access stops before VAULT/state/holds with a denial proof', () => {
    seedTimedeskMuni(db, TENANT);
    const result = runPipeline(
      db,
      {
        pack: 'timedesk.muni',
        tenant_id: TENANT,
        deployment_id: DEPLOYMENT,
        module: TIMEDESK_MUNI.module,
        environment: TIMEDESK_MUNI.environment,
        case_space_id: 'cs-denied',
        actor_ref: 'actor-x',
        item: { employee_id: 'emp-7' }, // substantive
      },
      { accessEvaluator: denyAll },
    );

    expect(result.outcome).toBe('denied');
    expect(result.stopped_at).toBe('ACCESS_GATE');
    expect(result.substance.substantive).toBe(true); // passed substance
    expect(result.access.granted).toBe(false);
    expect(result.vault).toBeNull();
    expect(result.state).toBeNull();

    // Authority before state: nothing decided or persisted.
    expect(countRows(db, 'case_space_action_state')).toBe(0);
    expect(countRows(db, 'holds')).toBe(0);

    const proof = proofFor(db, result.process_id);
    expect(proof?.event_family).toBe('auth');
    expect(proof?.event_subtype).toBe('auth.refused');
    const payload = JSON.parse(proof!.payload_json) as { outcome: string };
    expect(payload.outcome).toBe('denied');
  });

  it('allowed access continues through existing C6 behavior', () => {
    seedTimedeskMuni(db, TENANT);
    const result = runPipeline(db, {
      pack: 'timedesk.muni',
      tenant_id: TENANT,
      deployment_id: DEPLOYMENT,
      module: TIMEDESK_MUNI.module,
      environment: TIMEDESK_MUNI.environment,
      case_space_id: 'cs-ok',
      item: { employee_id: 'emp-7' },
    });

    expect(result.outcome).toBe('completed');
    expect(result.stopped_at).toBeNull();
    expect(result.access.granted).toBe(true);
    // C6 behavior intact: 2 pending holds for export/approve payroll.
    expect(result.state?.summary.pending).toBe(2);
    expect(result.state?.summary.holds_created).toBe(2);
    expect(countRows(db, 'holds')).toBe(2);

    const proof = proofFor(db, result.process_id);
    expect(proof?.event_subtype).toBe('pipeline.run');
  });

  it('unknown / no pack remains safe (completes with no_op verdicts, no holds)', () => {
    const result = runPipeline(db, {
      pack: 'does.not.exist',
      tenant_id: TENANT,
      deployment_id: DEPLOYMENT,
      case_space_id: 'cs-unknown',
      item: { something: true }, // substantive, open gate
    });

    expect(result.outcome).toBe('completed');
    expect(result.access.granted).toBe(true);
    // VAULT yields a safe no_op set; no state rows, no holds.
    expect(result.vault?.summary.no_op).toBe(1);
    expect(result.state?.summary.no_op).toBe(1);
    expect(countRows(db, 'holds')).toBe(0);
  });

  it('substance check stops before the access gate is even evaluated', () => {
    // denyAll would deny, but a non-substantive item must short-circuit first.
    const result = runPipeline(
      db,
      {
        pack: 'timedesk.muni',
        tenant_id: TENANT,
        deployment_id: DEPLOYMENT,
        item: null,
      },
      { accessEvaluator: denyAll },
    );
    expect(result.outcome).toBe('no_op');
    expect(result.stopped_at).toBe('SUBSTANCE_CHECK');
    // access was never evaluated by the denyAll evaluator.
    expect(result.access.granted).toBe(false);
    expect(result.access.reason).toMatch(/stopped at substance/i);
  });
});
