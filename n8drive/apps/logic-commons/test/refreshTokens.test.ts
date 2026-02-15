import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

// Point the store at a temp dir so tests don't pollute the real data/
const tmpDir = path.join(os.tmpdir(), `refresh-store-test-${Date.now()}`);
process.env.LOGIC_COMMONS_DATA_DIR = tmpDir;

// Import after env is set so the module picks up the override
const { createRefreshEntry, verifyRefreshEntry, revokeRefreshEntry, rotateRefreshEntry } = await import(
  '../src/lib/refreshTokens.js'
);

async function cleanStore() {
  await fs.rm(tmpDir, { recursive: true, force: true });
}

beforeEach(async () => { await cleanStore(); });
afterAll(async () => { await cleanStore(); });

describe('refresh token store', () => {
  it('creates an entry with a unique jti', async () => {
    const e = await createRefreshEntry('u1', 60_000);
    expect(e.jti).toBeDefined();
    expect(typeof e.jti).toBe('string');
    expect(e.userId).toBe('u1');
    expect(e.revoked).toBe(false);
  });

  it('verifies a valid entry', async () => {
    const e = await createRefreshEntry('u1', 60_000);
    const v = await verifyRefreshEntry(e.jti);
    expect(v).not.toBeNull();
    expect(v!.jti).toBe(e.jti);
  });

  it('returns null for unknown jti', async () => {
    const v = await verifyRefreshEntry('nonexistent');
    expect(v).toBeNull();
  });

  it('revokes an entry', async () => {
    const e = await createRefreshEntry('u1', 60_000);
    const ok = await revokeRefreshEntry(e.jti);
    expect(ok).toBe(true);
    const v = await verifyRefreshEntry(e.jti);
    expect(v).toBeNull();
  });

  it('revokeRefreshEntry returns false for unknown jti', async () => {
    const ok = await revokeRefreshEntry('nonexistent');
    expect(ok).toBe(false);
  });

  it('returns null for expired entry', async () => {
    const e = await createRefreshEntry('u1', 1); // 1ms TTL
    await new Promise((r) => setTimeout(r, 10));
    const v = await verifyRefreshEntry(e.jti);
    expect(v).toBeNull();
  });

  it('rotates: revokes old and creates new', async () => {
    const e1 = await createRefreshEntry('u1', 60_000);
    const e2 = await rotateRefreshEntry(e1.jti, 'u1', 60_000);
    expect(e2.jti).not.toBe(e1.jti);
    // Old is revoked
    const v1 = await verifyRefreshEntry(e1.jti);
    expect(v1).toBeNull();
    // New is valid
    const v2 = await verifyRefreshEntry(e2.jti);
    expect(v2).not.toBeNull();
  });

  it('creates multiple entries independently', async () => {
    const a = await createRefreshEntry('alice', 60_000);
    const b = await createRefreshEntry('bob', 60_000);
    expect(a.jti).not.toBe(b.jti);
    expect(await verifyRefreshEntry(a.jti)).not.toBeNull();
    expect(await verifyRefreshEntry(b.jti)).not.toBeNull();
  });
});
