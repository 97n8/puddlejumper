// ── SQLite-backed user store ────────────────────────────────────────────────
//
// Lightweight user record management for PuddleJumper. Tracks OAuth users
// with role assignments. The store is used by the onUserAuthenticated hook
// to look up or create user records on every OAuth login.
//
// Roles:
//   viewer — read-only access to GET endpoints (default for new users)
//   admin  — full access (manually assigned)
//
import path from "node:path";
import fs from "node:fs";
import Database from "better-sqlite3";

export type UserRow = {
  id: string;
  sub: string;
  email: string | null;
  name: string | null;
  provider: string;
  role: string;
  created_at: string;
  updated_at: string;
};

let _db: Database.Database | null = null;

function getDb(dataDir: string): Database.Database {
  if (_db) return _db;
  fs.mkdirSync(dataDir, { recursive: true });
  const dbPath = path.join(dataDir, "users.db");
  _db = new Database(dbPath);
  _db.pragma("journal_mode = WAL");
  _db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sub TEXT NOT NULL,
      provider TEXT NOT NULL,
      email TEXT,
      name TEXT,
      role TEXT NOT NULL DEFAULT 'viewer',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(sub, provider)
    );
    CREATE INDEX IF NOT EXISTS idx_users_sub_provider ON users(sub, provider);
  `);
  return _db;
}

/** For tests: close the DB handle and reset the singleton. */
export function resetUserDb(): void {
  if (_db) {
    _db.close();
    _db = null;
  }
}

/**
 * Look up or create a user. On first login, creates a record with the default
 * `viewer` role. On subsequent logins, updates email/name but preserves the
 * existing role (so admins are never downgraded).
 */
export function upsertUser(
  dataDir: string,
  user: { sub: string; email?: string; name?: string; provider: string },
): UserRow {
  const db = getDb(dataDir);
  const now = new Date().toISOString();

  // Try to find existing user
  const existing = db
    .prepare("SELECT * FROM users WHERE sub = ? AND provider = ?")
    .get(user.sub, user.provider) as UserRow | undefined;

  if (existing) {
    // Update profile fields but keep role
    db.prepare(
      "UPDATE users SET email = ?, name = ?, updated_at = ? WHERE sub = ? AND provider = ?",
    ).run(user.email ?? existing.email, user.name ?? existing.name, now, user.sub, user.provider);

    return {
      ...existing,
      email: user.email ?? existing.email,
      name: user.name ?? existing.name,
      updated_at: now,
    };
  }

  // New user — assign viewer role
  const result = db
    .prepare(
      "INSERT INTO users (sub, provider, email, name, role, created_at, updated_at) VALUES (?, ?, ?, ?, 'viewer', ?, ?)",
    )
    .run(user.sub, user.provider, user.email ?? null, user.name ?? null, now, now);

  return {
    id: String(result.lastInsertRowid),
    sub: user.sub,
    provider: user.provider,
    email: user.email ?? null,
    name: user.name ?? null,
    role: "viewer",
    created_at: now,
    updated_at: now,
  };
}

/** Look up a user by sub + provider. Returns null if not found. */
export function findUser(
  dataDir: string,
  sub: string,
  provider: string,
): UserRow | null {
  const db = getDb(dataDir);
  return (
    (db.prepare("SELECT * FROM users WHERE sub = ? AND provider = ?").get(sub, provider) as
      | UserRow
      | undefined) ?? null
  );
}

/** Update a user's role. Returns true if the user exists and was updated. */
export function setUserRole(
  dataDir: string,
  sub: string,
  provider: string,
  role: string,
): boolean {
  const db = getDb(dataDir);
  const result = db
    .prepare("UPDATE users SET role = ?, updated_at = ? WHERE sub = ? AND provider = ?")
    .run(role, new Date().toISOString(), sub, provider);
  return result.changes > 0;
}
