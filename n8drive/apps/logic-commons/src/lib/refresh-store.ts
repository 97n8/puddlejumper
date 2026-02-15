// ── SQLite-backed refresh token store with family rotation & replay detection
//
// Provides persistent refresh token management with rotation chains.
// Replay detection: if a revoked token is re-used, the entire family is revoked.
import crypto from "node:crypto";
import path from "node:path";
import fs from "node:fs";
import Database from "better-sqlite3";

// ── Types ───────────────────────────────────────────────────────────────────

export type RefreshTokenRow = {
  id: string;
  user_id: string;
  family: string;
  issued_at: number;
  expires_at: number;
  revoked_at: number | null;
  replaced_by: string | null;
};

// ── Store (module-level singleton) ──────────────────────────────────────────

let _dataDir: string | null = null;
let _db: Database.Database | null = null;

/** Override the data directory. Call before any store operations. */
export function configureRefreshStore(dataDir: string): void {
  _dataDir = dataDir;
}

function resolveDataDir(): string {
  if (_dataDir) return _dataDir;
  return process.env.CONTROLLED_DATA_DIR || path.resolve(process.cwd(), "data");
}

function getDb(): Database.Database {
  if (_db) return _db;
  const dir = resolveDataDir();
  fs.mkdirSync(dir, { recursive: true });
  const dbPath = path.join(dir, "refresh_tokens.db");
  _db = new Database(dbPath);
  _db.pragma("journal_mode = WAL");
  _db.exec(`
    CREATE TABLE IF NOT EXISTS refresh_tokens (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      family TEXT NOT NULL,
      issued_at INTEGER NOT NULL,
      expires_at INTEGER NOT NULL,
      revoked_at INTEGER,
      replaced_by TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user ON refresh_tokens(user_id);
    CREATE INDEX IF NOT EXISTS idx_refresh_tokens_family ON refresh_tokens(family);
  `);
  return _db;
}

/** For tests: close the DB and reset so next call re-opens it. */
export function resetDb(): void {
  if (_db) {
    _db.close();
    _db = null;
  }
}

// ── Operations ──────────────────────────────────────────────────────────────

const nowSec = () => Math.floor(Date.now() / 1000);

/**
 * Insert a new refresh token.
 * @param userId  Subject / user ID
 * @param family  Rotation family (pass null to start a new chain)
 * @param ttlSec  Lifetime in seconds
 */
export function createRefreshToken(
  userId: string,
  family: string | null,
  ttlSec: number,
): RefreshTokenRow {
  const db = getDb();
  const id = crypto.randomUUID();
  const fam = family ?? crypto.randomUUID();
  const now = nowSec();
  const expiresAt = now + ttlSec;
  db.prepare(
    `INSERT INTO refresh_tokens (id, user_id, family, issued_at, expires_at)
     VALUES (?, ?, ?, ?, ?)`,
  ).run(id, userId, fam, now, expiresAt);
  return {
    id,
    user_id: userId,
    family: fam,
    issued_at: now,
    expires_at: expiresAt,
    revoked_at: null,
    replaced_by: null,
  };
}

/** Look up a token by jti. Returns null if not found. */
export function findRefreshToken(jti: string): RefreshTokenRow | null {
  const db = getDb();
  return (
    (db.prepare("SELECT * FROM refresh_tokens WHERE id = ?").get(jti) as
      | RefreshTokenRow
      | undefined) ?? null
  );
}

/** Verify a token is active: exists, not revoked, not expired. */
export function verifyRefreshToken(jti: string): RefreshTokenRow | null {
  const row = findRefreshToken(jti);
  if (!row) return null;
  if (row.revoked_at !== null) return null;
  if (nowSec() > row.expires_at) return null;
  return row;
}

/** Revoke a single token by jti. Returns true if row existed. */
export function revokeRefreshToken(jti: string): boolean {
  const db = getDb();
  const result = db
    .prepare("UPDATE refresh_tokens SET revoked_at = ? WHERE id = ? AND revoked_at IS NULL")
    .run(nowSec(), jti);
  return result.changes > 0;
}

/** Revoke ALL tokens in a family. Returns count revoked. */
export function revokeFamily(family: string): number {
  const db = getDb();
  const result = db
    .prepare("UPDATE refresh_tokens SET revoked_at = ? WHERE family = ? AND revoked_at IS NULL")
    .run(nowSec(), family);
  return result.changes;
}

/** Revoke all active tokens for a user. Returns count revoked. */
export function revokeAllForUser(userId: string): number {
  const db = getDb();
  const result = db
    .prepare("UPDATE refresh_tokens SET revoked_at = ? WHERE user_id = ? AND revoked_at IS NULL")
    .run(nowSec(), userId);
  return result.changes;
}

/**
 * Rotate a refresh token:
 * - If the incoming jti is active → revoke it, issue a new one in the same family.
 * - If the incoming jti is already revoked → replay detected! Revoke the entire family.
 * - If the incoming jti doesn't exist or is expired → fail.
 */
export function rotateRefreshToken(
  jti: string,
  ttlSec: number,
):
  | { ok: true; token: RefreshTokenRow }
  | { ok: false; reason: "token_reuse_detected" | "invalid" } {
  const db = getDb();
  const row = findRefreshToken(jti);
  if (!row) return { ok: false, reason: "invalid" };

  if (nowSec() > row.expires_at) return { ok: false, reason: "invalid" };

  if (row.revoked_at !== null) {
    revokeFamily(row.family);
    return { ok: false, reason: "token_reuse_detected" };
  }

  const newToken = createRefreshToken(row.user_id, row.family, ttlSec);
  db.prepare("UPDATE refresh_tokens SET revoked_at = ?, replaced_by = ? WHERE id = ?").run(
    nowSec(),
    newToken.id,
    jti,
  );

  return { ok: true, token: newToken };
}

/**
 * Remove expired tokens older than `olderThanSec` seconds.
 * Call periodically for housekeeping.
 */
export function purgeExpired(olderThanSec: number = 86400 * 30): number {
  const db = getDb();
  const cutoff = nowSec() - olderThanSec;
  const result = db.prepare("DELETE FROM refresh_tokens WHERE expires_at < ?").run(cutoff);
  return result.changes;
}
