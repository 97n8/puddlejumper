import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';

export type RefreshEntry = {
  jti: string;
  userId: string;
  expiresAt: number;
  revoked: boolean;
  createdAt: number;
};

const DATA_DIR = process.env.LOGIC_COMMONS_DATA_DIR || path.resolve(import.meta.dirname ?? __dirname, '../../data');
const STORE_FILE = path.join(DATA_DIR, 'refresh_tokens.json');

async function ensureDir(): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
}

async function readStore(): Promise<Record<string, RefreshEntry>> {
  try {
    return JSON.parse(await fs.readFile(STORE_FILE, 'utf8'));
  } catch (err: any) {
    if (err.code === 'ENOENT') return {};
    throw err;
  }
}

async function writeStore(obj: Record<string, RefreshEntry>): Promise<void> {
  const tmp = STORE_FILE + '.tmp';
  await fs.writeFile(tmp, JSON.stringify(obj), 'utf8');
  await fs.rename(tmp, STORE_FILE);
}

/** Create a new refresh entry and persist it. Returns the entry (including jti). */
export async function createRefreshEntry(userId: string, ttlMs: number): Promise<RefreshEntry> {
  await ensureDir();
  const store = await readStore();
  const jti = crypto.randomUUID();
  const now = Date.now();
  const entry: RefreshEntry = { jti, userId, expiresAt: now + ttlMs, createdAt: now, revoked: false };
  store[jti] = entry;
  await writeStore(store);
  return entry;
}

/** Mark a jti as revoked. Returns true if the entry existed. */
export async function revokeRefreshEntry(jti: string): Promise<boolean> {
  const store = await readStore();
  if (!store[jti]) return false;
  store[jti].revoked = true;
  await writeStore(store);
  return true;
}

/** Verify a jti is valid (exists, not revoked, not expired). Returns the entry or null. */
export async function verifyRefreshEntry(jti: string): Promise<RefreshEntry | null> {
  const store = await readStore();
  const e = store[jti];
  if (!e) return null;
  if (e.revoked) return null;
  if (Date.now() > e.expiresAt) return null;
  return e;
}

/** Revoke old jti and create a new entry for the same user. */
export async function rotateRefreshEntry(oldJti: string, userId: string, ttlMs: number): Promise<RefreshEntry> {
  await revokeRefreshEntry(oldJti);
  return createRefreshEntry(userId, ttlMs);
}
