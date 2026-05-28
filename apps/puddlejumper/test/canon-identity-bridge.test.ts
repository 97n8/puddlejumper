// Canon identity bridge (Me1) — commit 3 contract tests.
//
// Tests the OAuth-login → canon-identity bridge introduced in
// apps/puddlejumper/src/api/server.ts.  The bridge gates the returned
// session through @pj/db's `identities` table when PJ_CANON_TENANT_ID
// is set; when unset it preserves the legacy personal-workspace path.
//
// We exercise the bridge resolver (`applyCanonBridge`) directly against
// an in-memory canon DB so each case can be reasoned about in isolation
// from createApp's full dependency graph.  The hook calls the resolver
// once and either (a) throws 403 on `miss`, (b) overrides session
// tenantId/userId on `hit`, or (c) does nothing on `unset` — the same
// three outcomes the resolver represents.

import { describe, it, expect, beforeEach } from 'vitest';
import { getDb, migrate, type DatabaseHandle } from '@pj/db';
import {
  applyCanonBridge,
  resolveCanonIdentityForLogin,
} from '../src/api/server.js';

const CANON_TENANT = 'publiclogic';

function freshCanonDb(): DatabaseHandle {
  const db = getDb(':memory:');
  migrate(db);
  db.prepare('INSERT INTO tenants (id, name, canon_version) VALUES (?, ?, ?)')
    .run(CANON_TENANT, 'PublicLogic', '1.0.0');
  return db;
}

function seedIdentity(
  db: DatabaseHandle,
  email: string,
  displayName: string,
  tenantId = CANON_TENANT,
): string {
  const identity_id = `id-${email.replace(/[^a-z0-9]/gi, '-')}`;
  db.prepare(
    `INSERT INTO identities (identity_id, tenant_id, kind, active, email, display_name)
     VALUES (?, ?, 'person', 1, ?, ?)`,
  ).run(identity_id, tenantId, email, displayName);
  return identity_id;
}

describe('canon identity bridge — applyCanonBridge', () => {
  let db: DatabaseHandle;
  beforeEach(() => { db = freshCanonDb(); });

  // ── 1. HIT ──────────────────────────────────────────────────────────────
  it('hit: returns canon identity when email matches an active row', () => {
    const nateId = seedIdentity(db, 'nate@publiclogic.org', 'Nate Boudreau');

    const result = applyCanonBridge(db, CANON_TENANT, 'nate@publiclogic.org');

    expect(result.mode).toBe('hit');
    if (result.mode === 'hit') {
      expect(result.canonTenantId).toBe(CANON_TENANT);
      expect(result.canonIdentityId).toBe(nateId);
    }
    // The bridge contract states the session should resolve to canon ids
    // when this mode is returned.  The hook in server.ts:
    //   const effectiveTenantId = canonBridge.mode === 'hit'
    //     ? canonBridge.canonTenantId : ws.id;
    //   const effectiveUserId   = canonBridge.mode === 'hit'
    //     ? canonBridge.canonIdentityId : row.sub;
    // So this assertion is the contract for session.tenantId === 'publiclogic'
    // AND session.userId === canon identity_id.
  });

  // ── 2. MISS ─────────────────────────────────────────────────────────────
  it('miss: returns mode=miss when no canon row exists for the email', () => {
    // No identity seeded.
    const result = applyCanonBridge(db, CANON_TENANT, 'stranger@example.com');

    expect(result.mode).toBe('miss');
    if (result.mode === 'miss') {
      expect(result.canonTenantId).toBe(CANON_TENANT);
    }
    // Per hook contract, mode='miss' MUST cause the hook to throw 403
    // before any personal workspace is created/selected and before any
    // session is returned.  The throw is verified by the hook's source
    // inspection (`throw Object.assign(new Error('Access denied — ...'),
    // { statusCode: 403 })`); this test guards the resolver branch that
    // triggers it.
  });

  it('miss: also returned when email is undefined or empty (no anonymous sessions)', () => {
    expect(applyCanonBridge(db, CANON_TENANT, undefined).mode).toBe('miss');
    expect(applyCanonBridge(db, CANON_TENANT, '').mode).toBe('miss');
    expect(applyCanonBridge(db, CANON_TENANT, '   ').mode).toBe('miss');
  });

  it('miss: deactivated identity does not match (active = 0 is excluded)', () => {
    seedIdentity(db, 'former@publiclogic.org', 'Former Member');
    db.prepare(
      `UPDATE identities SET active = 0, deactivated_at = ? WHERE email = ?`,
    ).run(new Date().toISOString(), 'former@publiclogic.org');

    const result = applyCanonBridge(db, CANON_TENANT, 'former@publiclogic.org');
    expect(result.mode).toBe('miss');
  });

  it('miss: tenant boundary — identity in another tenant does not match', () => {
    db.prepare('INSERT INTO tenants (id, name, canon_version) VALUES (?, ?, ?)')
      .run('other-tenant', 'Other', '1.0.0');
    seedIdentity(db, 'allie@publiclogic.org', 'Allie', 'other-tenant');

    const result = applyCanonBridge(db, CANON_TENANT, 'allie@publiclogic.org');
    expect(result.mode).toBe('miss');
  });

  // ── 3. UNSET ────────────────────────────────────────────────────────────
  it('unset: returns mode=unset and does not consult the canon DB when env empty', () => {
    // Even with an identity present, the bridge must short-circuit when
    // PJ_CANON_TENANT_ID is unset.  This is the regression guard that
    // local-dev / pre-Me1 behavior is preserved.
    seedIdentity(db, 'nate@publiclogic.org', 'Nate Boudreau');

    expect(applyCanonBridge(db, undefined,   'nate@publiclogic.org').mode).toBe('unset');
    expect(applyCanonBridge(db, '',          'nate@publiclogic.org').mode).toBe('unset');
    expect(applyCanonBridge(db, '   ',       'nate@publiclogic.org').mode).toBe('unset');
    // Per hook contract, mode='unset' leaves the existing flow untouched:
    //   effectiveTenantId = ws.id, effectiveUserId = row.sub.
  });

  // ── 4. NORM ─────────────────────────────────────────────────────────────
  it('norm: matches case-insensitive, whitespace-trimmed email against stored value', () => {
    const nateId = seedIdentity(db, 'nate@publiclogic.org', 'Nate Boudreau');

    // Mixed case + leading/trailing whitespace.
    const noisy = '  Nate@PublicLogic.ORG  ';
    const result = applyCanonBridge(db, CANON_TENANT, noisy);

    expect(result.mode).toBe('hit');
    if (result.mode === 'hit') {
      expect(result.canonIdentityId).toBe(nateId);
    }
  });

  it('norm: stored email is NOT mutated — normalization is for matching only', () => {
    const stored = 'nate@publiclogic.org';
    seedIdentity(db, stored, 'Nate Boudreau');

    applyCanonBridge(db, CANON_TENANT, '  NATE@PUBLICLOGIC.ORG  ');

    const row = db
      .prepare(`SELECT email FROM identities WHERE identity_id = ?`)
      .get(`id-${stored.replace(/[^a-z0-9]/gi, '-')}`) as { email: string };
    expect(row.email).toBe(stored);
  });

  // ── resolver direct-call coverage (defense in depth) ────────────────────
  it('resolveCanonIdentityForLogin: returns null for empty email', () => {
    expect(resolveCanonIdentityForLogin(db, CANON_TENANT, '')).toBeNull();
    expect(resolveCanonIdentityForLogin(db, CANON_TENANT, '   ')).toBeNull();
  });

  it('resolveCanonIdentityForLogin: returns the row on direct hit', () => {
    const id = seedIdentity(db, 'allie@publiclogic.org', 'Allison Weiss Rothschild');
    const row = resolveCanonIdentityForLogin(db, CANON_TENANT, 'allie@publiclogic.org');
    expect(row?.identity_id).toBe(id);
  });
});
