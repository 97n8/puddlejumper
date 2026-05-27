// @pj/db — canon test suite.
// Source: Master Build Spec v1.1, Phase 1, Task 1.3 acceptance criteria.

import { describe, it, expect, beforeEach } from 'vitest';
import {
  getDb,
  migrate,
  verifyAuditTriggers,
  appendAuditEvent,
  type DatabaseHandle,
} from '../src/index.js';

function freshDb(): DatabaseHandle {
  const db = getDb(':memory:');
  const result = migrate(db);
  expect(result.applied).toEqual([
    '001_schema_init.sql',
    '002_divergence.sql',
    '003_integration.sql',
  ]);
  return db;
}

const FIXED_TENANT = 't_test';
const FIXED_DEPLOYMENT = 'dpl_test';

function seedTenant(db: DatabaseHandle): void {
  db.prepare(
    `INSERT INTO tenants (id, name, canon_version) VALUES (?, ?, ?)`,
  ).run(FIXED_TENANT, 'Test Tenant', '1.0.0');
}

describe('@pj/db — canon contract', () => {
  let db: DatabaseHandle;

  beforeEach(() => {
    db = freshDb();
    seedTenant(db);
  });

  describe('appendAuditEvent', () => {
    it('inserts a row and returns it with a generated event_id', () => {
      const event = appendAuditEvent(db, {
        event_family: 'process',
        event_subtype: 'process.created',
        canon_version: '1.0.0',
        deployment_id: FIXED_DEPLOYMENT,
        tenant_id: FIXED_TENANT,
        process_id: 'proc-1',
        actor_ref: 'actor-1',
        payload: { process_type: 'PRR', title: 'test' },
      });

      expect(event.event_id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
      );
      expect(event.event_family).toBe('process');
      expect(event.event_subtype).toBe('process.created');
      expect(event.payload_hash).toMatch(/^[0-9a-f]{64}$/);
      expect(event.inserted_at).toBeTruthy();

      const row = db
        .prepare('SELECT COUNT(*) as n FROM audit_events WHERE event_id = ?')
        .get(event.event_id) as { n: number };
      expect(row.n).toBe(1);
    });

    it('honors a caller-supplied event_id', () => {
      const explicit = 'e-explicit-0001';
      const event = appendAuditEvent(db, {
        event_id: explicit,
        event_family: 'transition',
        event_subtype: 'transition.fired',
        canon_version: '1.0.0',
        deployment_id: FIXED_DEPLOYMENT,
        tenant_id: FIXED_TENANT,
        payload: { from: 'received', to: 'logged' },
      });
      expect(event.event_id).toBe(explicit);
    });
  });

  describe('canon rule 2 — append-only', () => {
    it('refuses UPDATE on audit_events with ABORT', () => {
      const event = appendAuditEvent(db, {
        event_family: 'process',
        event_subtype: 'process.created',
        canon_version: '1.0.0',
        deployment_id: FIXED_DEPLOYMENT,
        tenant_id: FIXED_TENANT,
        payload: { x: 1 },
      });

      expect(() =>
        db
          .prepare('UPDATE audit_events SET event_subtype = ? WHERE event_id = ?')
          .run('process.fields_updated', event.event_id),
      ).toThrowError(/append-only/i);
    });

    it('refuses DELETE on audit_events with ABORT', () => {
      const event = appendAuditEvent(db, {
        event_family: 'process',
        event_subtype: 'process.created',
        canon_version: '1.0.0',
        deployment_id: FIXED_DEPLOYMENT,
        tenant_id: FIXED_TENANT,
        payload: { x: 1 },
      });

      expect(() =>
        db.prepare('DELETE FROM audit_events WHERE event_id = ?').run(event.event_id),
      ).toThrowError(/append-only/i);
    });
  });

  describe('verifyAuditTriggers', () => {
    it('returns true on a freshly migrated DB', () => {
      expect(verifyAuditTriggers(db)).toBe(true);
    });

    it('returns false if either trigger is dropped', () => {
      db.exec('DROP TRIGGER audit_events_no_update');
      expect(verifyAuditTriggers(db)).toBe(false);
    });
  });

  describe('migrate idempotency', () => {
    it('skips already-applied migrations on re-run', () => {
      const second = migrate(db);
      expect(second.applied).toEqual([]);
      expect(second.skipped).toEqual([
        '001_schema_init.sql',
        '002_divergence.sql',
        '003_integration.sql',
      ]);
    });

    it('keeps audit triggers intact after re-run', () => {
      migrate(db);
      expect(verifyAuditTriggers(db)).toBe(true);
    });
  });
});
