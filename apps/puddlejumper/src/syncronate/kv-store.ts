import type Database from 'better-sqlite3';

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS syncronate_kv (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    expires_at TEXT
  );
`;

export function initKvStore(db: Database.Database): void {
  db.exec(SCHEMA);
}

export function kvGet(db: Database.Database, key: string): string | null {
  const row = db.prepare(
    `SELECT value, expires_at FROM syncronate_kv WHERE key = ?`
  ).get(key) as { value: string; expires_at: string | null } | undefined;

  if (!row) return null;
  if (row.expires_at && new Date(row.expires_at) < new Date()) {
    db.prepare(`DELETE FROM syncronate_kv WHERE key = ?`).run(key);
    return null;
  }
  return row.value;
}

export function kvSet(
  db: Database.Database,
  key: string,
  value: string,
  opts?: { ttlSeconds?: number }
): void {
  const expiresAt = opts?.ttlSeconds
    ? new Date(Date.now() + opts.ttlSeconds * 1000).toISOString()
    : null;

  db.prepare(
    `INSERT INTO syncronate_kv (key, value, expires_at) VALUES (?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, expires_at = excluded.expires_at`
  ).run(key, value, expiresAt);
}

export function kvDel(db: Database.Database, key: string): void {
  db.prepare(`DELETE FROM syncronate_kv WHERE key = ?`).run(key);
}

export function kvCleanup(db: Database.Database): void {
  db.prepare(
    `DELETE FROM syncronate_kv WHERE expires_at IS NOT NULL AND expires_at < datetime('now')`
  ).run();
}
