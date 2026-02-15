import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
const DATA_DIR = process.env.LOGIC_COMMONS_DATA_DIR || path.resolve(import.meta.dirname ?? __dirname, '../../data');
const STORE_FILE = path.join(DATA_DIR, 'refresh_tokens.json');
async function ensureDir() {
    await fs.mkdir(DATA_DIR, { recursive: true });
}
async function readStore() {
    try {
        return JSON.parse(await fs.readFile(STORE_FILE, 'utf8'));
    }
    catch (err) {
        if (err.code === 'ENOENT')
            return {};
        throw err;
    }
}
async function writeStore(obj) {
    const tmp = STORE_FILE + '.tmp';
    await fs.writeFile(tmp, JSON.stringify(obj), 'utf8');
    await fs.rename(tmp, STORE_FILE);
}
/** Create a new refresh entry and persist it. Returns the entry (including jti). */
export async function createRefreshEntry(userId, ttlMs) {
    await ensureDir();
    const store = await readStore();
    const jti = crypto.randomUUID();
    const now = Date.now();
    const entry = { jti, userId, expiresAt: now + ttlMs, createdAt: now, revoked: false };
    store[jti] = entry;
    await writeStore(store);
    return entry;
}
/** Mark a jti as revoked. Returns true if the entry existed. */
export async function revokeRefreshEntry(jti) {
    const store = await readStore();
    if (!store[jti])
        return false;
    store[jti].revoked = true;
    await writeStore(store);
    return true;
}
/** Verify a jti is valid (exists, not revoked, not expired). Returns the entry or null. */
export async function verifyRefreshEntry(jti) {
    const store = await readStore();
    const e = store[jti];
    if (!e)
        return null;
    if (e.revoked)
        return null;
    if (Date.now() > e.expiresAt)
        return null;
    return e;
}
/** Revoke old jti and create a new entry for the same user. */
export async function rotateRefreshEntry(oldJti, userId, ttlMs) {
    await revokeRefreshEntry(oldJti);
    return createRefreshEntry(userId, ttlMs);
}
