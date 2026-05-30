// @pj/pipeline — C1 verifier.
// Proves the V1 spine runs end-to-end synchronously and writes exactly one
// Recordstream/audit proof event via the canon @pj/db writer.

import { describe, it, expect, beforeEach } from 'vitest';
import { getDb, migrate, type DatabaseHandle } from '@pj/db';
import { runPipeline, PIPELINE_STAGES } from '../src/index.js';

const TENANT = 't_test';
const DEPLOYMENT = 'dpl_test';

function freshDb(): DatabaseHandle {
  const db = getDb(':memory:');
  migrate(db);
  return db;
}

describe('@pj/pipeline — C1 skeleton', () => {
  let db: DatabaseHandle;

  beforeEach(() => {
    db = freshDb();
  });

  it('walks all fourteen canon stages in order', () => {
    const result = runPipeline(db, {
      pack: 'guestops.stay',
      tenant_id: TENANT,
      deployment_id: DEPLOYMENT,
      actor_ref: 'actor-1',
      item: { kind: 'reservation', id: 'res-1' },
    });

    expect(result.ok).toBe(true);
    expect(result.stages.map((s) => s.stage)).toEqual([...PIPELINE_STAGES]);
    expect(result.stages.every((s) => s.outcome === 'accepted')).toBe(true);
  });

  it('writes exactly one Recordstream proof event proving the run', () => {
    const result = runPipeline(db, {
      pack: 'guestops.stay',
      tenant_id: TENANT,
      deployment_id: DEPLOYMENT,
      item: { kind: 'reservation', id: 'res-1' },
    });

    const rows = db
      .prepare(
        `SELECT * FROM audit_events
         WHERE event_subtype = 'pipeline.run' AND process_id = ?`,
      )
      .all(result.process_id) as Array<{
      event_id: string;
      event_family: string;
      tenant_id: string;
      payload_json: string;
    }>;

    expect(rows).toHaveLength(1);
    expect(rows[0].event_id).toBe(result.proof_event_id);
    expect(rows[0].event_family).toBe('system');
    expect(rows[0].tenant_id).toBe(TENANT);

    const payload = JSON.parse(rows[0].payload_json) as {
      pack: string;
      ok: boolean;
      results: Array<{ stage: string; outcome: string }>;
    };
    expect(payload.pack).toBe('guestops.stay');
    expect(payload.ok).toBe(true);
    expect(payload.results).toHaveLength(PIPELINE_STAGES.length);
  });

  it('runs the same spine for each V1 triad pack', () => {
    for (const pack of ['guestops.stay', 'timedesk.muni', 'finance.biz']) {
      const result = runPipeline(db, {
        pack,
        tenant_id: TENANT,
        deployment_id: DEPLOYMENT,
      });
      expect(result.ok).toBe(true);
      expect(result.pack).toBe(pack);
    }

    const count = db
      .prepare(
        `SELECT COUNT(*) AS n FROM audit_events WHERE event_subtype = 'pipeline.run'`,
      )
      .get() as { n: number };
    expect(count.n).toBe(3);
  });
});
