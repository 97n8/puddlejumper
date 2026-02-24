// ── Workspace Store ────────────────────────────────────────────────
//
// Manages personal and system workspaces for PuddleJumper.
//
import Database from "better-sqlite3";
import path from "node:path";
import fs from "node:fs";
import crypto from "node:crypto";

export type WorkspaceRow = {
  id: string;
  name: string;
  owner_id: string;
  created_at: string;
  plan: string;
  approval_count: number;
  template_count: number;
  member_count: number;
};

export type WorkspaceRole = "owner" | "admin" | "member" | "viewer";

const _dbs = new Map<string, Database.Database>();

export function getDb(dataDir: string): Database.Database {
  if (_dbs.has(dataDir)) return _dbs.get(dataDir)!;
  fs.mkdirSync(dataDir, { recursive: true });
  const dbPath = path.join(dataDir, "approvals.db");
  const db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.pragma("synchronous = NORMAL");
  db.pragma("wal_autocheckpoint = 1000");
  // Create workspaces table if not exists
  db.exec(`
    CREATE TABLE IF NOT EXISTS workspaces (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      owner_id TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(owner_id)
    );
    CREATE INDEX IF NOT EXISTS idx_workspaces_owner ON workspaces(owner_id);
  `);
  
  // Add usage tracking columns (idempotent migration)
  const columns = db.pragma("table_info(workspaces)") as Array<{ name: string }>;
  const hasUsageColumns = columns.some(c => c.name === "plan");
  
  if (!hasUsageColumns) {
    db.exec(`
      ALTER TABLE workspaces ADD COLUMN plan TEXT NOT NULL DEFAULT 'free';
      ALTER TABLE workspaces ADD COLUMN approval_count INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE workspaces ADD COLUMN template_count INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE workspaces ADD COLUMN member_count INTEGER NOT NULL DEFAULT 1;
    `);
  }
  
  // Workspace members table (idempotent)
  const hasMembersTable = db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='workspace_members'`).get();
  if (!hasMembersTable) {
    db.exec(`
      CREATE TABLE workspace_members (
        id TEXT PRIMARY KEY,
        workspace_id TEXT NOT NULL REFERENCES workspaces(id),
        user_id TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'member' CHECK(role IN ('owner','admin','member','viewer')),
        tool_access TEXT,
        invited_by TEXT,
        joined_at TEXT NOT NULL DEFAULT (datetime('now')),
        UNIQUE(workspace_id, user_id)
      );
      CREATE INDEX idx_workspace_members_workspace ON workspace_members(workspace_id);
      CREATE INDEX idx_workspace_members_user ON workspace_members(user_id);
    `);
  } else {
    // Idempotent migration: add tool_access column if missing
    const cols = db.pragma("table_info(workspace_members)") as Array<{ name: string }>;
    if (!cols.some(c => c.name === "tool_access")) {
      db.exec(`ALTER TABLE workspace_members ADD COLUMN tool_access TEXT`);
    }
  }

  const hasInvitationsTable = db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='workspace_invitations'`).get();
  if (!hasInvitationsTable) {
    db.exec(`
      CREATE TABLE workspace_invitations (
        id TEXT PRIMARY KEY,
        workspace_id TEXT NOT NULL REFERENCES workspaces(id),
        email TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'member',
        tool_access TEXT,
        token TEXT NOT NULL UNIQUE,
        invited_by TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        expires_at TEXT NOT NULL,
        accepted_at TEXT
      );
      CREATE INDEX idx_workspace_invitations_token ON workspace_invitations(token);
      CREATE INDEX idx_workspace_invitations_workspace ON workspace_invitations(workspace_id);
    `);
  } else {
    const cols = db.pragma("table_info(workspace_invitations)") as Array<{ name: string }>;
    if (!cols.some(c => c.name === "tool_access")) {
      db.exec(`ALTER TABLE workspace_invitations ADD COLUMN tool_access TEXT`);
    }
  }

  // Deployed processes table (FormKey deployments from Vault)
  const hasDeployedProcessesTable = db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='deployed_processes'`).get();
  if (!hasDeployedProcessesTable) {
    db.exec(`
      CREATE TABLE deployed_processes (
        id TEXT PRIMARY KEY,
        workspace_id TEXT NOT NULL REFERENCES workspaces(id),
        form_key TEXT NOT NULL,
        process_id TEXT NOT NULL,
        process_version TEXT NOT NULL,
        deployed_by TEXT NOT NULL,
        deployed_at TEXT NOT NULL DEFAULT (datetime('now')),
        manifest_hash TEXT,
        status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','archived','error')),
        UNIQUE(workspace_id, form_key)
      );
      CREATE INDEX idx_deployed_processes_workspace ON deployed_processes(workspace_id);
      CREATE INDEX idx_deployed_processes_form_key ON deployed_processes(form_key);
    `);
  }
  
  _dbs.set(dataDir, db);
  return db;
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
  
  if (!ws) {
    const id = `ws-${userId}`;
    const name = `${username || userId}'s Workspace`;
    
    let existing = getWorkspace(dataDir, id);
    if (existing) {
      if (existing.owner_id !== userId) {
        const newId = `ws-${userId}-${Date.now()}`;
        createWorkspace(dataDir, newId, name, userId);
        existing = getWorkspace(dataDir, newId)!;
      }
    } else {
      createWorkspace(dataDir, id, name, userId);
      existing = getWorkspace(dataDir, id)!;
    }
    ws = existing;
  }

  // Always ensure owner has a member entry (backfills existing workspaces too)
  const db = getDb(dataDir);
  const memberId = `wm-${userId}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  try {
    db.prepare(`
      INSERT INTO workspace_members (id, workspace_id, user_id, role, joined_at)
      VALUES (?, ?, ?, 'owner', datetime('now'))
    `).run(memberId, ws.id, userId);
  } catch (err: any) {
    if (err.code !== 'SQLITE_CONSTRAINT_UNIQUE') throw err;
  }
  
  return ws;
}

export function resetWorkspaceDb(): void {
  for (const [key, db] of _dbs.entries()) {
    db.exec(`
      DELETE FROM workspace_invitations;
      DELETE FROM workspace_members;
      DELETE FROM workspaces;
    `);
    db.close();
    _dbs.delete(key);
  }
}

// ── Usage Counter Functions ────────────────────────────────────────
// Atomic increment/decrement of workspace usage counters

export function incrementApprovalCount(dataDir: string, workspaceId: string): void {
  const db = getDb(dataDir);
  db.prepare(`UPDATE workspaces SET approval_count = approval_count + 1 WHERE id = ?`).run(workspaceId);
}

export function decrementApprovalCount(dataDir: string, workspaceId: string): void {
  const db = getDb(dataDir);
  db.prepare(`UPDATE workspaces SET approval_count = MAX(0, approval_count - 1) WHERE id = ?`).run(workspaceId);
}

export function incrementTemplateCount(dataDir: string, workspaceId: string): void {
  const db = getDb(dataDir);
  db.prepare(`UPDATE workspaces SET template_count = template_count + 1 WHERE id = ?`).run(workspaceId);
}

export function decrementTemplateCount(dataDir: string, workspaceId: string): void {
  const db = getDb(dataDir);
  db.prepare(`UPDATE workspaces SET template_count = MAX(0, template_count - 1) WHERE id = ?`).run(workspaceId);
}

export function incrementMemberCount(dataDir: string, workspaceId: string): void {
  const db = getDb(dataDir);
  db.prepare(`UPDATE workspaces SET member_count = member_count + 1 WHERE id = ?`).run(workspaceId);
}

export function decrementMemberCount(dataDir: string, workspaceId: string): void {
  const db = getDb(dataDir);
  db.prepare(`UPDATE workspaces SET member_count = MAX(1, member_count - 1) WHERE id = ?`).run(workspaceId);
}

export function updateWorkspacePlan(dataDir: string, workspaceId: string, plan: string): void {
  const db = getDb(dataDir);
  db.prepare(`UPDATE workspaces SET plan = ? WHERE id = ?`).run(plan, workspaceId);
}

// ── Workspace Member Functions ─────────────────────────────────────

export function getMemberRole(dataDir: string, workspaceId: string, userId: string): WorkspaceRole | null {
  const db = getDb(dataDir);
  const row = db.prepare(`SELECT role FROM workspace_members WHERE workspace_id = ? AND user_id = ?`).get(workspaceId, userId) as { role: string } | undefined;
  return row ? (row.role as WorkspaceRole) : null;
}

export function listWorkspaceMembers(dataDir: string, workspaceId: string) {
  const db = getDb(dataDir);
  return db.prepare(`SELECT * FROM workspace_members WHERE workspace_id = ? ORDER BY joined_at ASC`).all(workspaceId);
}

export function addWorkspaceMember(dataDir: string, workspaceId: string, userId: string, role: string, invitedBy: string, toolAccess?: string[] | null) {
  const db = getDb(dataDir);
  const id = `wm-${userId}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const toolAccessJson = toolAccess ? JSON.stringify(toolAccess) : null;
  db.prepare(`
    INSERT INTO workspace_members (id, workspace_id, user_id, role, tool_access, invited_by, joined_at)
    VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
    ON CONFLICT(workspace_id, user_id) DO UPDATE SET role = excluded.role, tool_access = excluded.tool_access
  `).run(id, workspaceId, userId, role, toolAccessJson, invitedBy);
  incrementMemberCount(dataDir, workspaceId);
}

export function removeWorkspaceMember(dataDir: string, workspaceId: string, userId: string) {
  const db = getDb(dataDir);
  db.prepare(`DELETE FROM workspace_members WHERE workspace_id = ? AND user_id = ?`).run(workspaceId, userId);
  decrementMemberCount(dataDir, workspaceId);
}

export function updateMemberRole(dataDir: string, workspaceId: string, userId: string, role: string) {
  const db = getDb(dataDir);
  db.prepare(`UPDATE workspace_members SET role = ? WHERE workspace_id = ? AND user_id = ?`).run(role, workspaceId, userId);
}

// ── Workspace Invitation Functions ────────────────────────────────

export function createInvitation(dataDir: string, workspaceId: string, email: string, role: string, invitedBy: string, toolAccess?: string[] | null) {
  const db = getDb(dataDir);
  const id = `inv-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  const toolAccessJson = toolAccess ? JSON.stringify(toolAccess) : null;
  
  db.prepare(`
    INSERT INTO workspace_invitations (id, workspace_id, email, role, tool_access, token, invited_by, created_at, expires_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), ?)
  `).run(id, workspaceId, email, role, toolAccessJson, token, invitedBy, expiresAt);
  
  return { id, token, expiresAt };
}

export function getInvitationByToken(dataDir: string, token: string) {
  const db = getDb(dataDir);
  return db.prepare(`SELECT * FROM workspace_invitations WHERE token = ?`).get(token);
}

export function listPendingInvitations(dataDir: string, workspaceId: string) {
  const db = getDb(dataDir);
  return db.prepare(`SELECT * FROM workspace_invitations WHERE workspace_id = ? AND accepted_at IS NULL ORDER BY created_at DESC`).all(workspaceId);
}

export function acceptInvitation(dataDir: string, token: string, userId: string) {
  const db = getDb(dataDir);
  const invitation: any = getInvitationByToken(dataDir, token);
  if (!invitation) return null;
  
  if (new Date(invitation.expires_at) < new Date()) {
    return { error: "expired" };
  }
  
  db.prepare(`UPDATE workspace_invitations SET accepted_at = datetime('now') WHERE token = ?`).run(token);
  
  const toolAccess = invitation.tool_access ? JSON.parse(invitation.tool_access) : null;
  addWorkspaceMember(dataDir, invitation.workspace_id, userId, invitation.role, invitation.invited_by, toolAccess);
  
  return { workspaceId: invitation.workspace_id, role: invitation.role, toolAccess };
}

export function revokeInvitation(dataDir: string, invitationId: string) {
  const db = getDb(dataDir);
  db.prepare(`DELETE FROM workspace_invitations WHERE id = ?`).run(invitationId);
}

