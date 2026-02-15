import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

// Point the store at a temp dir so tests don't pollute the real data/
const tmpDir = path.join(os.tmpdir(), `refresh-store-test-${Date.now()}`);
process.env.LOGIC_COMMONS_DATA_DIR = tmpDir;

// Import after env is set so the module picks up the override
const {
  createRefreshToken,
  findRefreshToken,
  verifyRefreshToken,
  revokeRefreshToken,
  revokeFamily,
  revokeAllForUser,
  rotateRefreshToken,
  purgeExpired,
  resetDb,
} = await import('../src/lib/refreshTokenStore.js');

async function cleanStore() {
  resetDb();
  await fs.rm(tmpDir, { recursive: true, force: true });
}

beforeEach(async () => { await cleanStore(); });
afterAll(async () => { await cleanStore(); });

describe('refresh token store (SQLite)', () => {
  it('creates a token with a unique id and family', () => {
    const t = createRefreshToken('u1', null, 3600);
    expect(t.id).toBeDefined();
    expect(typeof t.id).toBe('string');
    expect(t.user_id).toBe('u1');
    expect(t.family).toBeDefined();
    expect(t.revoked_at).toBeNull();
    expect(t.replaced_by).toBeNull();
    expect(t.expires_at).toBeGreaterThan(t.issued_at);
  });

  it('uses provided family when given', () => {
    const t = createRefreshToken('u1', 'my-family', 3600);
    expect(t.family).toBe('my-family');
  });

  it('findRefreshToken returns null for unknown jti', () => {
    expect(findRefreshToken('nonexistent')).toBeNull();
  });

  it('verifyRefreshToken returns active token', () => {
    const t = createRefreshToken('u1', null, 3600);
    const v = verifyRefreshToken(t.id);
    expect(v).not.toBeNull();
    expect(v!.id).toBe(t.id);
  });

  it('verifyRefreshToken returns null for unknown jti', () => {
    expect(verifyRefreshToken('nonexistent')).toBeNull();
  });

  it('verifyRefreshToken returns null for revoked token', () => {
    const t = createRefreshToken('u1', null, 3600);
    revokeRefreshToken(t.id);
    expect(verifyRefreshToken(t.id)).toBeNull();
  });

  it('revokeRefreshToken returns true for active, false for unknown', () => {
    const t = createRefreshToken('u1', null, 3600);
    expect(revokeRefreshToken(t.id)).toBe(true);
    // Already revoked — no change
    expect(revokeRefreshToken(t.id)).toBe(false);
    expect(revokeRefreshToken('nonexistent')).toBe(false);
  });

  it('revokeFamily revokes all tokens in family', () => {
    const t1 = createRefreshToken('u1', 'fam-a', 3600);
    const t2 = createRefreshToken('u1', 'fam-a', 3600);
    const t3 = createRefreshToken('u1', 'fam-b', 3600);

    const count = revokeFamily('fam-a');
    expect(count).toBe(2);
    expect(verifyRefreshToken(t1.id)).toBeNull();
    expect(verifyRefreshToken(t2.id)).toBeNull();
    // Different family — still active
    expect(verifyRefreshToken(t3.id)).not.toBeNull();
  });

  it('revokeAllForUser revokes all tokens for a user', () => {
    const a1 = createRefreshToken('alice', null, 3600);
    const a2 = createRefreshToken('alice', null, 3600);
    const b1 = createRefreshToken('bob', null, 3600);

    const count = revokeAllForUser('alice');
    expect(count).toBe(2);
    expect(verifyRefreshToken(a1.id)).toBeNull();
    expect(verifyRefreshToken(a2.id)).toBeNull();
    expect(verifyRefreshToken(b1.id)).not.toBeNull();
  });

  describe('rotateRefreshToken', () => {
    it('rotates: revokes old and creates new in same family', () => {
      const t1 = createRefreshToken('u1', null, 3600);
      const result = rotateRefreshToken(t1.id, 3600);
      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error('expected ok');

      const newToken = result.token;
      expect(newToken.id).not.toBe(t1.id);
      expect(newToken.family).toBe(t1.family);
      expect(newToken.user_id).toBe('u1');

      // Old is revoked and points to new
      const old = findRefreshToken(t1.id);
      expect(old!.revoked_at).not.toBeNull();
      expect(old!.replaced_by).toBe(newToken.id);

      // New is active
      expect(verifyRefreshToken(newToken.id)).not.toBeNull();
    });

    it('returns invalid for unknown jti', () => {
      const result = rotateRefreshToken('nonexistent', 3600);
      expect(result.ok).toBe(false);
      if (result.ok) throw new Error('expected fail');
      expect(result.reason).toBe('invalid');
    });

    it('detects replay — revokes entire family', () => {
      const t1 = createRefreshToken('u1', null, 3600);
      // First rotation: t1 → t2
      const r1 = rotateRefreshToken(t1.id, 3600);
      expect(r1.ok).toBe(true);
      if (!r1.ok) throw new Error('expected ok');
      const t2 = r1.token;

      // Replay: re-use t1 — already revoked
      const r2 = rotateRefreshToken(t1.id, 3600);
      expect(r2.ok).toBe(false);
      if (r2.ok) throw new Error('expected fail');
      expect(r2.reason).toBe('token_reuse_detected');

      // t2 should also be revoked (entire family compromised)
      expect(verifyRefreshToken(t2.id)).toBeNull();
    });
  });

  it('purgeExpired removes old tokens', () => {
    // Create a token that's already expired (TTL = -1 → expires_at in the past)
    const t = createRefreshToken('u1', null, -1);
    expect(findRefreshToken(t.id)).not.toBeNull();

    // Purge with 0 olderThanSec → cutoff = now; expires_at < now → deleted
    const count = purgeExpired(0);
    expect(count).toBeGreaterThanOrEqual(1);
    expect(findRefreshToken(t.id)).toBeNull();
  });

  it('creates multiple tokens independently', () => {
    const a = createRefreshToken('alice', null, 3600);
    const b = createRefreshToken('bob', null, 3600);
    expect(a.id).not.toBe(b.id);
    expect(a.family).not.toBe(b.family);
    expect(verifyRefreshToken(a.id)).not.toBeNull();
    expect(verifyRefreshToken(b.id)).not.toBeNull();
  });
});
