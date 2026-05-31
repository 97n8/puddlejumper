// @pj/db — canon migration 007 (V1 pipeline schema) test suite.
// Source: Issue #99 step C2 acceptance criteria + ops/v1/C0_DIAGNOSIS.md.
//
// Proves: migrations apply, the eight tables exist, and the key constraints
// hold (one active rule_pack per tenant/module/environment; hold statuses;
// incoming item confidence/status; generated output status).

import { describe, it, expect, beforeEach } from 'vitest';
import { getDb, migrate, type DatabaseHandle } from '../src/index.js';

const TENANT = 't_test';

function freshDb(): DatabaseHandle {
  const db = getDb(':memory:');
  migrate(db);
  return db;
}

const PIPELINE_TABLES = [
  'rule_packs',
  'holds',
  'incoming_items',
  'output_templates',
  'generated_outputs',
  'case_space_action_state',
  'connector_grants',
  'source_pointers',
] as const;

function tableExists(db: DatabaseHandle, name: string): boolean {
  const row = db
    .prepare(
      `SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?`,
    )
    .get(name) as { name: string } | undefined;
  return row?.name === name;
}

describe('@pj/db — migration 007 V1 pipeline schema', () => {
  let db: DatabaseHandle;

  beforeEach(() => {
    db = freshDb();
  });

  it('applies the migration and creates all eight pipeline tables', () => {
    for (const table of PIPELINE_TABLES) {
      expect(tableExists(db, table), `table ${table} should exist`).toBe(true);
    }
  });

  describe('rule_packs — one active per tenant/module/environment', () => {
    function insertPack(id: string, isActive: number): void {
      db.prepare(
        `INSERT INTO rule_packs (
           rule_pack_id, tenant_id, module, environment, pack, version, is_active
         ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      ).run(id, TENANT, 'guestops', 'stay', 'guestops.stay', '1', isActive);
    }

    it('allows a single active pack per (tenant, module, environment)', () => {
      expect(() => insertPack('rp1', 1)).not.toThrow();
    });

    it('refuses a second active pack for the same scope', () => {
      insertPack('rp1', 1);
      expect(() => insertPack('rp2', 1)).toThrowError(/UNIQUE/i);
    });

    it('allows multiple inactive packs alongside one active', () => {
      insertPack('rp1', 1);
      expect(() => insertPack('rp2', 0)).not.toThrow();
      expect(() => insertPack('rp3', 0)).not.toThrow();
    });

    it('constrains is_active to 0 or 1', () => {
      expect(() => insertPack('rpX', 2)).toThrowError(/CHECK/i);
    });
  });

  describe('holds — status constrained', () => {
    function insertHold(id: string, status: string): void {
      db.prepare(
        `INSERT INTO holds (hold_id, tenant_id, status) VALUES (?, ?, ?)`,
      ).run(id, TENANT, status);
    }

    it('accepts the valid hold statuses', () => {
      for (const [i, s] of ['held', 'released', 'expired'].entries()) {
        expect(() => insertHold(`h${i}`, s)).not.toThrow();
      }
    });

    it('refuses an invalid hold status', () => {
      expect(() => insertHold('hX', 'paused')).toThrowError(/CHECK/i);
    });
  });

  describe('incoming_items — confidence and status constrained', () => {
    function insertItem(id: string, confidence: string, status: string): void {
      db.prepare(
        `INSERT INTO incoming_items (item_id, tenant_id, confidence, status)
         VALUES (?, ?, ?, ?)`,
      ).run(id, TENANT, confidence, status);
    }

    it('accepts valid confidence values', () => {
      for (const [i, c] of ['clear', 'low', 'unclassified'].entries()) {
        expect(() => insertItem(`c${i}`, c, 'received')).not.toThrow();
      }
    });

    it('refuses an invalid confidence value', () => {
      expect(() => insertItem('cX', 'maybe', 'received')).toThrowError(/CHECK/i);
    });

    it('accepts valid intake statuses', () => {
      for (const [i, s] of ['received', 'held', 'confirmed', 'rejected'].entries()) {
        expect(() => insertItem(`s${i}`, 'clear', s)).not.toThrow();
      }
    });

    it('refuses an invalid intake status', () => {
      expect(() => insertItem('sX', 'clear', 'archived')).toThrowError(/CHECK/i);
    });
  });

  describe('generated_outputs — status constrained', () => {
    function insertOutput(id: string, status: string): void {
      db.prepare(
        `INSERT INTO generated_outputs (output_id, tenant_id, status)
         VALUES (?, ?, ?)`,
      ).run(id, TENANT, status);
    }

    it('accepts valid output statuses', () => {
      for (const [i, s] of ['draft', 'generated', 'saved', 'failed'].entries()) {
        expect(() => insertOutput(`o${i}`, s)).not.toThrow();
      }
    });

    it('refuses an invalid output status', () => {
      expect(() => insertOutput('oX', 'published')).toThrowError(/CHECK/i);
    });
  });

  describe('case_space_action_state — unique per scope + status constrained', () => {
    function insertState(id: string, action: string, status: string): void {
      db.prepare(
        `INSERT INTO case_space_action_state (
           action_state_id, tenant_id, case_space_id, module, action, status
         ) VALUES (?, ?, ?, ?, ?, ?)`,
      ).run(id, TENANT, 'cs-1', 'guestops', action, status);
    }

    it('refuses a duplicate (tenant, case_space, module, action) row', () => {
      insertState('as1', 'send_brief', 'done');
      expect(() => insertState('as2', 'send_brief', 'pending')).toThrowError(/UNIQUE/i);
    });

    it('accepts valid action statuses', () => {
      for (const [i, s] of ['attempted', 'pending', 'done', 'failed'].entries()) {
        expect(() => insertState(`as${i}`, `action-${i}`, s)).not.toThrow();
      }
    });

    it('refuses an invalid action status', () => {
      expect(() => insertState('asX', 'send_brief', 'skipped')).toThrowError(/CHECK/i);
    });
  });
});
