// @pj/pipeline — C3 rule pack resolver tests.
// Resolve the rules. Don't enforce them yet.
//
// Proves: resolves the active guestops.stay pack, ignores inactive versions,
// throws when missing, the C2 unique-active protection still holds, and the
// pipeline can run carrying resolved rule pack metadata.

import { describe, it, expect, beforeEach } from 'vitest';
import { getDb, migrate, type DatabaseHandle } from '@pj/db';
import {
  resolveActiveRulePack,
  findActiveRulePack,
  seedRulePack,
  seedGuestopsStay,
  PJRulePackNotFound,
  GUESTOPS_STAY,
  runPipeline,
} from '../src/index.js';

const TENANT = 't_test';
const SCOPE = {
  tenant_id: TENANT,
  module: GUESTOPS_STAY.module,
  environment: GUESTOPS_STAY.environment,
};

function freshDb(): DatabaseHandle {
  const db = getDb(':memory:');
  migrate(db);
  return db;
}

describe('@pj/pipeline — C3 rule pack resolver', () => {
  let db: DatabaseHandle;

  beforeEach(() => {
    db = freshDb();
  });

  it('seeds and resolves the active guestops.stay pack', () => {
    const seeded = seedGuestopsStay(db, TENANT);
    expect(seeded.pack).toBe('guestops.stay');
    expect(seeded.is_active).toBe(true);

    const resolved = resolveActiveRulePack(db, SCOPE);
    expect(resolved.rule_pack_id).toBe(seeded.rule_pack_id);
    expect(resolved.pack).toBe('guestops.stay');
    expect(resolved.version).toBe('1');
    // content_json is parsed into a typed object.
    expect(resolved.content.autonomy_ceiling).toBe('run_routine');
    expect(resolved.content.retention_class).toBe('stay-operations');
  });

  it('ignores inactive versions and resolves only the active one', () => {
    // An older, inactive version of the same scope.
    seedRulePack(db, {
      tenant_id: TENANT,
      module: GUESTOPS_STAY.module,
      environment: GUESTOPS_STAY.environment,
      pack: 'guestops.stay',
      version: '0',
      is_active: false,
    });
    const active = seedGuestopsStay(db, TENANT);

    const resolved = resolveActiveRulePack(db, SCOPE);
    expect(resolved.rule_pack_id).toBe(active.rule_pack_id);
    expect(resolved.version).toBe('1');
    expect(resolved.is_active).toBe(true);
  });

  it('throws PJRulePackNotFound when no active pack exists', () => {
    // Only an inactive pack present.
    seedRulePack(db, {
      tenant_id: TENANT,
      module: GUESTOPS_STAY.module,
      environment: GUESTOPS_STAY.environment,
      pack: 'guestops.stay',
      version: '1',
      is_active: false,
    });
    expect(() => resolveActiveRulePack(db, SCOPE)).toThrowError(
      PJRulePackNotFound,
    );
    // The non-throwing variant returns null for the same scope.
    expect(findActiveRulePack(db, SCOPE)).toBeNull();
  });

  it('still enforces one active pack per scope (C2 unique index)', () => {
    seedGuestopsStay(db, TENANT);
    expect(() =>
      seedRulePack(db, {
        tenant_id: TENANT,
        module: GUESTOPS_STAY.module,
        environment: GUESTOPS_STAY.environment,
        pack: 'guestops.stay',
        version: '2',
        is_active: true,
      }),
    ).toThrowError(/UNIQUE/i);
  });

  it('lets the pipeline run carrying the resolved rule pack id', () => {
    const seeded = seedGuestopsStay(db, TENANT);

    const result = runPipeline(db, {
      pack: 'guestops.stay',
      tenant_id: TENANT,
      deployment_id: 'dpl_test',
      module: GUESTOPS_STAY.module,
      environment: GUESTOPS_STAY.environment,
      item: { kind: 'reservation', id: 'res-1' },
    });

    expect(result.ok).toBe(true);
    expect(result.rule_pack_id).toBe(seeded.rule_pack_id);

    // The proof event records the carried rule pack id.
    const row = db
      .prepare(
        `SELECT payload_json FROM audit_events
         WHERE event_subtype = 'pipeline.run' AND process_id = ?`,
      )
      .get(result.process_id) as { payload_json: string };
    const payload = JSON.parse(row.payload_json) as { rule_pack_id: string | null };
    expect(payload.rule_pack_id).toBe(seeded.rule_pack_id);
  });

  it('runs with rule_pack_id null when no pack governs the scope', () => {
    const result = runPipeline(db, {
      pack: 'guestops.stay',
      tenant_id: TENANT,
      deployment_id: 'dpl_test',
      module: GUESTOPS_STAY.module,
      environment: GUESTOPS_STAY.environment,
    });
    expect(result.ok).toBe(true);
    expect(result.rule_pack_id).toBeNull();
  });
});
