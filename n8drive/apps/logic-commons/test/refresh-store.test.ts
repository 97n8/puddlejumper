import { describe, it, expect, beforeEach, afterAll } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";

// Isolate store to a temp dir
const tmpDir = path.join(os.tmpdir(), `lc-refresh-test-${Date.now()}`);
process.env.CONTROLLED_DATA_DIR = tmpDir;

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
  configureRefreshStore,
} = await import("../src/lib/refresh-store.js");

async function cleanStore() {
  resetDb();
  await fs.rm(tmpDir, { recursive: true, force: true });
}

beforeEach(async () => { await cleanStore(); });
afterAll(async () => { await cleanStore(); });

describe("refresh token store", () => {
  it("creates a token with unique id and family", () => {
    const t = createRefreshToken("u1", null, 3600);
    expect(t.id).toBeDefined();
    expect(typeof t.id).toBe("string");
    expect(t.user_id).toBe("u1");
    expect(t.family).toBeDefined();
    expect(t.revoked_at).toBeNull();
    expect(t.replaced_by).toBeNull();
    expect(t.expires_at).toBeGreaterThan(t.issued_at);
  });

  it("uses provided family when given", () => {
    const t = createRefreshToken("u1", "fam-1", 3600);
    expect(t.family).toBe("fam-1");
  });

  it("generates unique family when null", () => {
    const t1 = createRefreshToken("u1", null, 3600);
    const t2 = createRefreshToken("u1", null, 3600);
    expect(t1.family).not.toBe(t2.family);
  });

  it("findRefreshToken returns token or null", () => {
    const t = createRefreshToken("u1", null, 3600);
    expect(findRefreshToken(t.id)).toEqual(t);
    expect(findRefreshToken("nonexistent")).toBeNull();
  });

  it("verifyRefreshToken returns active token", () => {
    const t = createRefreshToken("u1", null, 3600);
    expect(verifyRefreshToken(t.id)).toEqual(t);
  });

  it("verifyRefreshToken returns null for revoked", () => {
    const t = createRefreshToken("u1", null, 3600);
    revokeRefreshToken(t.id);
    expect(verifyRefreshToken(t.id)).toBeNull();
  });

  it("verifyRefreshToken returns null for expired token", () => {
    // TTL=-1 ⇒ expires_at is in the past
    const t = createRefreshToken("u1", null, -1);
    expect(verifyRefreshToken(t.id)).toBeNull();
  });

  it("revokeRefreshToken marks token revoked", () => {
    const t = createRefreshToken("u1", null, 3600);
    expect(revokeRefreshToken(t.id)).toBe(true);
    const row = findRefreshToken(t.id)!;
    expect(row.revoked_at).not.toBeNull();
  });

  it("revokeRefreshToken is idempotent (second call returns false)", () => {
    const t = createRefreshToken("u1", null, 3600);
    expect(revokeRefreshToken(t.id)).toBe(true);
    expect(revokeRefreshToken(t.id)).toBe(false);
  });

  it("revokeFamily revokes all tokens in a family", () => {
    const t1 = createRefreshToken("u1", "shared-fam", 3600);
    const t2 = createRefreshToken("u1", "shared-fam", 3600);
    const t3 = createRefreshToken("u1", "other-fam", 3600);
    expect(revokeFamily("shared-fam")).toBe(2);
    expect(verifyRefreshToken(t1.id)).toBeNull();
    expect(verifyRefreshToken(t2.id)).toBeNull();
    expect(verifyRefreshToken(t3.id)).not.toBeNull();
  });

  it("revokeAllForUser revokes all user tokens", () => {
    createRefreshToken("u1", null, 3600);
    createRefreshToken("u1", null, 3600);
    const other = createRefreshToken("u2", null, 3600);
    expect(revokeAllForUser("u1")).toBe(2);
    expect(verifyRefreshToken(other.id)).not.toBeNull();
  });

  describe("rotation with replay detection", () => {
    it("rotates an active token into the same family", () => {
      const t1 = createRefreshToken("u1", null, 3600);
      const result = rotateRefreshToken(t1.id, 3600);
      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error("unexpected");
      expect(result.token.family).toBe(t1.family);
      expect(result.token.id).not.toBe(t1.id);
      // Old token should be revoked with replaced_by set
      const old = findRefreshToken(t1.id)!;
      expect(old.revoked_at).not.toBeNull();
      expect(old.replaced_by).toBe(result.token.id);
    });

    it("detects replay and revokes entire family", () => {
      const t1 = createRefreshToken("u1", null, 3600);
      // Normal rotation
      const r1 = rotateRefreshToken(t1.id, 3600);
      expect(r1.ok).toBe(true);

      // Replay: re-use old token
      const r2 = rotateRefreshToken(t1.id, 3600);
      expect(r2.ok).toBe(false);
      if (r2.ok) throw new Error("unexpected");
      expect(r2.reason).toBe("token_reuse_detected");

      // Verify the new token from r1 is also revoked (entire family)
      if (!r1.ok) throw new Error("unexpected");
      expect(verifyRefreshToken(r1.token.id)).toBeNull();
    });

    it("returns invalid for non-existent token", () => {
      const result = rotateRefreshToken("nonexistent", 3600);
      expect(result.ok).toBe(false);
      if (result.ok) throw new Error("unexpected");
      expect(result.reason).toBe("invalid");
    });

    it("returns invalid for expired token", () => {
      const t = createRefreshToken("u1", null, -1);
      const result = rotateRefreshToken(t.id, 3600);
      expect(result.ok).toBe(false);
      if (result.ok) throw new Error("unexpected");
      expect(result.reason).toBe("invalid");
    });
  });

  it("purgeExpired removes old tokens", () => {
    // Create a token with TTL=-1 (already expired in the past)
    const expired = createRefreshToken("u1", null, -1);
    const active = createRefreshToken("u1", null, 3600);
    const purged = purgeExpired(0);
    expect(purged).toBeGreaterThanOrEqual(1);
    expect(findRefreshToken(expired.id)).toBeNull();
    expect(findRefreshToken(active.id)).not.toBeNull();
  });

  it("configureRefreshStore overrides data directory", () => {
    const customDir = path.join(os.tmpdir(), `lc-refresh-custom-${Date.now()}`);
    resetDb();
    configureRefreshStore(customDir);
    const t = createRefreshToken("u1", null, 3600);
    expect(findRefreshToken(t.id)).not.toBeNull();
    resetDb();
    // Restore default
    configureRefreshStore(tmpDir);
    fs.rm(customDir, { recursive: true, force: true });
  });
});
