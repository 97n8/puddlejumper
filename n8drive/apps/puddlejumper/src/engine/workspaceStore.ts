// ── Workspace Store ────────────────────────────────────────────────
//
// Manages personal and system workspaces for PuddleJumper.
//
import Database from "better-sqlite3";
import path from "node:path";
import fs from "node:fs";

export type WorkspaceRow = {
  id: string;
  name: string;
  owner_id: string;
  created_at: string;
};

let _db: Database.Database | null = null;

function getDb(dataDir: string): Database.Database {
  if (_db) return _db;
  fs.mkdirSync(dataDir, { recursive: true });
  const dbPath = path.join(dataDir, "approvals.db");
  _db = new Database(dbPath);
  _db.pragma("journal_mode = WAL");
  // Create workspaces table if not exists
  _db.exec(`
    CREATE TABLE IF NOT EXISTS workspaces (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      owner_id TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(owner_id)
    );
    CREATE INDEX IF NOT EXISTS idx_workspaces_owner ON workspaces(owner_id);
  `);
  return _db;
}

export function createWorkspace(dataDir: string, id: string, name: string, ownerId: string): WorkspaceRow {
  const db = getDb(dataDir);
  db.prepare(
    `INSERT INTO workspaces (id, name, owner_id) VALUES (?, ?, ?)`
  ).run(id, name, ownerId);
  return getWorkspace(dataDir, id)!;
}

export function getWorkspace(dataDir: string, id: string): WorkspaceRow | null {
  const db = getDb(dataDir);
  const row = db.prepare(`SELECT * FROM workspaces WHERE id = ?`).get(id);
  return row ? (row as WorkspaceRow) : null;
}

export function getWorkspaceByOwner(dataDir: string, ownerId: string): WorkspaceRow | null {
  const db = getDb(dataDir);
  const row = db.prepare(`SELECT * FROM workspaces WHERE owner_id = ?`).get(ownerId);
  return row ? (row as WorkspaceRow) : null;
}

export function listWorkspaces(dataDir: string): WorkspaceRow[] {
  const db = getDb(dataDir);
  return db.prepare(`SELECT * FROM workspaces ORDER BY created_at ASC`).all() as WorkspaceRow[];
}

export function ensurePersonalWorkspace(dataDir: string, userId: string, username: string): WorkspaceRow {
  let ws = getWorkspaceByOwner(dataDir, userId);
  if (ws) return ws;
  const id = `ws-${userId}`;
  const name = `${username || userId}'s Workspace`;
  createWorkspace(dataDir, id, name, userId);
  return getWorkspace(dataDir, id)!;
}

export function resetWorkspaceDb(): void {
  if (_db) {
    _db.close();
    _db = null;
  }
}
