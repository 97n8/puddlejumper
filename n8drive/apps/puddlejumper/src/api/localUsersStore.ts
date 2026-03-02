// ── DB-backed local user store ───────────────────────────────────────────────
//
// Manages user accounts that admins create directly (not via OAuth or email
// invite). Each local user gets a username + bcrypt password hash. On first
// login they are required to change their password before accessing the app.
//
// The table lives in users.db alongside the OAuth user records.

import path from "node:path";
import fs from "node:fs";
import crypto from "node:crypto";
import Database from "better-sqlite3";
import bcrypt from "bcryptjs";

export type LocalUserRow = {
  id: string;
  username: string;
  email: string | null;
  name: string;
  password_hash: string;
  must_change_password: 0 | 1;
  created_by: string | null;
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
    CREATE TABLE IF NOT EXISTS local_users (
      id                  TEXT PRIMARY KEY,
      username            TEXT NOT NULL UNIQUE COLLATE NOCASE,
      email               TEXT,
      name                TEXT NOT NULL,
      password_hash       TEXT NOT NULL,
      must_change_password INTEGER NOT NULL DEFAULT 1,
      created_by          TEXT,
      created_at          TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at          TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_local_users_username ON local_users(username COLLATE NOCASE);
  `);
  return _db;
}

export function resetLocalUserDb(): void {
  if (_db) { _db.close(); _db = null; }
}

// ── CRUD ──────────────────────────────────────────────────────────────────────

export type CreateLocalUserInput = {
  username: string;
  email?: string | null;
  name: string;
  /** Plain-text temporary password — will be hashed here. */
  temporaryPassword: string;
  createdBy?: string | null;
};

/** Create a local user with a temporary password. Returns the new row. */
export async function createLocalUser(
  dataDir: string,
  input: CreateLocalUserInput,
): Promise<LocalUserRow> {
  const db = getDb(dataDir);
  const id = `lu-${crypto.randomBytes(8).toString("hex")}`;
  const passwordHash = await bcrypt.hash(input.temporaryPassword, 12);
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO local_users (id, username, email, name, password_hash, must_change_password, created_by, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?)
  `).run(id, input.username.trim(), input.email ?? null, input.name.trim(), passwordHash, input.createdBy ?? null, now, now);

  return db.prepare("SELECT * FROM local_users WHERE id = ?").get(id) as LocalUserRow;
}

/** Find a local user by username (case-insensitive). */
export function findLocalUserByUsername(dataDir: string, username: string): LocalUserRow | null {
  const db = getDb(dataDir);
  return (db.prepare("SELECT * FROM local_users WHERE username = ? COLLATE NOCASE").get(username.trim()) as LocalUserRow | undefined) ?? null;
}

/** Find a local user by ID. */
export function findLocalUserById(dataDir: string, id: string): LocalUserRow | null {
  const db = getDb(dataDir);
  return (db.prepare("SELECT * FROM local_users WHERE id = ?").get(id) as LocalUserRow | undefined) ?? null;
}

/** List all local users (password_hash excluded from returned shape). */
export function listLocalUsers(dataDir: string): Omit<LocalUserRow, "password_hash">[] {
  const db = getDb(dataDir);
  return db.prepare("SELECT id, username, email, name, must_change_password, created_by, created_at, updated_at FROM local_users ORDER BY created_at ASC")
    .all() as Omit<LocalUserRow, "password_hash">[];
}

/** Validate a plain-text password against a stored local user. Returns the user on success, null on failure. */
export async function validateLocalUserPassword(
  dataDir: string,
  username: string,
  plainPassword: string,
): Promise<LocalUserRow | null> {
  const user = findLocalUserByUsername(dataDir, username);
  if (!user) return null;
  const ok = await bcrypt.compare(plainPassword, user.password_hash);
  return ok ? user : null;
}

/** Change a user's password. If `setMustChange` is false, clears the must_change_password flag. */
export async function updateLocalUserPassword(
  dataDir: string,
  userId: string,
  newPlainPassword: string,
  setMustChange = false,
): Promise<boolean> {
  const db = getDb(dataDir);
  const hash = await bcrypt.hash(newPlainPassword, 12);
  const result = db.prepare(`
    UPDATE local_users SET password_hash = ?, must_change_password = ?, updated_at = datetime('now') WHERE id = ?
  `).run(hash, setMustChange ? 1 : 0, userId);
  return result.changes > 0;
}

/** Admin-reset a user's password and force them to change it on next login. */
export async function adminResetPassword(
  dataDir: string,
  userId: string,
  newTemporaryPassword: string,
): Promise<boolean> {
  return updateLocalUserPassword(dataDir, userId, newTemporaryPassword, true);
}

/** Update a local user's profile fields. */
export function updateLocalUser(
  dataDir: string,
  userId: string,
  updates: { email?: string | null; name?: string },
): boolean {
  const db = getDb(dataDir);
  const existing = findLocalUserById(dataDir, userId);
  if (!existing) return false;
  db.prepare("UPDATE local_users SET email = ?, name = ?, updated_at = datetime('now') WHERE id = ?")
    .run(updates.email ?? existing.email, updates.name ?? existing.name, userId);
  return true;
}

/** Permanently delete a local user. */
export function deleteLocalUser(dataDir: string, userId: string): boolean {
  const db = getDb(dataDir);
  const result = db.prepare("DELETE FROM local_users WHERE id = ?").run(userId);
  return result.changes > 0;
}
