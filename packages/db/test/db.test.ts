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
    '004_shared_bindings.sql',
    '005_deployment_status.sql',
    '006_identity_overlay.sql',
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

  describe('canon migration 004 — shared_bindings immutability', () => {
    function seedBinding(): void {
      db.prepare(
        `INSERT INTO shared_bindings (
           binding_id, name, split_point, version, content_yaml, content_hash,
           published_by, published_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run('b1', 'pkg', 'SP.STATE.NAMES', '1.0.0', 'foo: 1\n', 'hashabc', 'tester', '2026-05-27T00:00:00Z');
    }

    it('refuses UPDATE of content_yaml on an existing binding', () => {
      seedBinding();
      expect(() =>
        db.prepare(`UPDATE shared_bindings SET content_yaml = ? WHERE binding_id = ?`)
          .run('foo: 2\n', 'b1'),
      ).toThrowError(/shared_bindings content is immutable/);
    });

    it('refuses UPDATE of content_hash on an existing binding', () => {
      seedBinding();
      expect(() =>
        db.prepare(`UPDATE shared_bindings SET content_hash = ? WHERE binding_id = ?`)
          .run('different', 'b1'),
      ).toThrowError(/shared_bindings content is immutable/);
    });

    it('allows UPDATE of deprecated_at (deprecation is the only mutation)', () => {
      seedBinding();
      expect(() =>
        db.prepare(`UPDATE shared_bindings SET deprecated_at = ? WHERE binding_id = ?`)
          .run('2026-06-01T00:00:00Z', 'b1'),
      ).not.toThrow();
      const row = db.prepare(`SELECT deprecated_at FROM shared_bindings WHERE binding_id = ?`)
        .get('b1') as { deprecated_at: string };
      expect(row.deprecated_at).toBe('2026-06-01T00:00:00Z');
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
        '004_shared_bindings.sql',
        '005_deployment_status.sql',
        '006_identity_overlay.sql',
      ]);
    });

    it('keeps audit triggers intact after re-run', () => {
      migrate(db);
      expect(verifyAuditTriggers(db)).toBe(true);
    });
  });
});
