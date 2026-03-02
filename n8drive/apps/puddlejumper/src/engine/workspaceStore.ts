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

  // Workspace member audit log (idempotent)
  const hasAuditTable = db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='workspace_member_audit'`).get();
  if (!hasAuditTable) {
    db.exec(`
      CREATE TABLE workspace_member_audit (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        workspace_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        action TEXT NOT NULL CHECK(action IN ('added','removed','role_changed','tool_access_changed')),
        old_value TEXT,
        new_value TEXT,
        actor_id TEXT,
        timestamp TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE INDEX idx_wm_audit_workspace ON workspace_member_audit(workspace_id);
      CREATE INDEX idx_wm_audit_user ON workspace_member_audit(user_id);
      CREATE INDEX idx_wm_audit_timestamp ON workspace_member_audit(timestamp);
    `);
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
  
  // CaseSpaces table (idempotent)
  const hasCasespacesTable = db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='casespaces'`).get();
  if (!hasCasespacesTable) {
    db.exec(`
      CREATE TABLE casespaces (
        id TEXT PRIMARY KEY,
        workspace_id TEXT NOT NULL,
        owner_id TEXT NOT NULL,
        name TEXT NOT NULL,
        description TEXT,
        color TEXT,
        icon TEXT,
        type TEXT DEFAULT 'custom',
        town TEXT,
        vault_module_ids TEXT DEFAULT '[]',
        visibility TEXT NOT NULL DEFAULT 'organization',
        members TEXT NOT NULL DEFAULT '[]',
        connection_ids TEXT NOT NULL DEFAULT '[]',
        audit_enabled INTEGER NOT NULL DEFAULT 0,
        retention_enabled INTEGER NOT NULL DEFAULT 0,
        file_count INTEGER NOT NULL DEFAULT 0,
        folder_count INTEGER NOT NULL DEFAULT 0,
        template_count INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL,
        last_accessed INTEGER
      );
      CREATE INDEX idx_casespaces_workspace ON casespaces(workspace_id);
      CREATE INDEX idx_casespaces_owner ON casespaces(owner_id);
    `);
  }

  // Per-tool internal permissions (idempotent)
  // Lets tools store their own role model outside the LogicOS admin UI.
  // Each tool reads/writes its own row; LogicOS never renders these.
  const hasToolPermsTable = db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='workspace_member_tool_permissions'`).get();
  if (!hasToolPermsTable) {
    db.exec(`
      CREATE TABLE workspace_member_tool_permissions (
        workspace_id TEXT NOT NULL,
        user_id      TEXT NOT NULL,
        tool_id      TEXT NOT NULL,
        permissions  TEXT NOT NULL DEFAULT '[]',
        updated_at   TEXT NOT NULL DEFAULT (datetime('now')),
        updated_by   TEXT,
        PRIMARY KEY (workspace_id, user_id, tool_id)
      );
      CREATE INDEX idx_tool_perms_workspace ON workspace_member_tool_permissions(workspace_id);
      CREATE INDEX idx_tool_perms_user ON workspace_member_tool_permissions(user_id);
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

// Returns the first workspace where userId is a non-owner member (used as fallback when JWT has no tenantId)
export function getWorkspaceForMember(dataDir: string, userId: string): { workspaceId: string; role: WorkspaceRole } | null {
  const db = getDb(dataDir);
  const row = db.prepare(`
    SELECT workspace_id, role FROM workspace_members
    WHERE user_id = ? AND role != 'owner'
    ORDER BY joined_at ASC LIMIT 1
  `).get(userId) as { workspace_id: string; role: string } | undefined;
  return row ? { workspaceId: row.workspace_id, role: row.role as WorkspaceRole } : null;
}

export function listWorkspaceMembers(dataDir: string, workspaceId: string) {
  const db = getDb(dataDir);
  return db.prepare(`SELECT * FROM workspace_members WHERE workspace_id = ? ORDER BY joined_at ASC`).all(workspaceId);
}

export function addWorkspaceMember(dataDir: string, workspaceId: string, userId: string, role: string, invitedBy: string, toolAccess?: string[] | null) {  const db = getDb(dataDir);
  const id = `wm-${userId}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const toolAccessJson = toolAccess ? JSON.stringify(toolAccess) : null;
  db.prepare(`
    INSERT INTO workspace_members (id, workspace_id, user_id, role, tool_access, invited_by, joined_at)
    VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
    ON CONFLICT(workspace_id, user_id) DO UPDATE SET role = excluded.role, tool_access = excluded.tool_access
  `).run(id, workspaceId, userId, role, toolAccessJson, invitedBy);
  incrementMemberCount(dataDir, workspaceId);
  db.prepare(`INSERT INTO workspace_member_audit (workspace_id, user_id, action, new_value, actor_id) VALUES (?, ?, 'added', ?, ?)`)
    .run(workspaceId, userId, JSON.stringify({ role, toolAccess }), invitedBy);
}

export function removeWorkspaceMember(dataDir: string, workspaceId: string, userId: string, actorId?: string) {
  const db = getDb(dataDir);
  const existing: any = db.prepare(`SELECT role FROM workspace_members WHERE workspace_id = ? AND user_id = ?`).get(workspaceId, userId);
  db.prepare(`DELETE FROM workspace_members WHERE workspace_id = ? AND user_id = ?`).run(workspaceId, userId);
  decrementMemberCount(dataDir, workspaceId);
  db.prepare(`INSERT INTO workspace_member_audit (workspace_id, user_id, action, old_value, actor_id) VALUES (?, ?, 'removed', ?, ?)`)
    .run(workspaceId, userId, existing ? JSON.stringify({ role: existing.role }) : null, actorId ?? null);
}

export function updateMemberRole(dataDir: string, workspaceId: string, userId: string, role: string, actorId?: string) {
  const db = getDb(dataDir);
  const existing: any = db.prepare(`SELECT role FROM workspace_members WHERE workspace_id = ? AND user_id = ?`).get(workspaceId, userId);
  db.prepare(`UPDATE workspace_members SET role = ? WHERE workspace_id = ? AND user_id = ?`).run(role, workspaceId, userId);
  db.prepare(`INSERT INTO workspace_member_audit (workspace_id, user_id, action, old_value, new_value, actor_id) VALUES (?, ?, 'role_changed', ?, ?, ?)`)
    .run(workspaceId, userId, existing?.role ?? null, role, actorId ?? null);
}

export function updateMemberToolAccess(dataDir: string, workspaceId: string, userId: string, toolAccess: string[] | null, actorId?: string) {
  const db = getDb(dataDir);
  const existing: any = db.prepare(`SELECT tool_access FROM workspace_members WHERE workspace_id = ? AND user_id = ?`).get(workspaceId, userId);
  const json = toolAccess ? JSON.stringify(toolAccess) : null;
  db.prepare(`UPDATE workspace_members SET tool_access = ? WHERE workspace_id = ? AND user_id = ?`).run(json, workspaceId, userId);
  db.prepare(`INSERT INTO workspace_member_audit (workspace_id, user_id, action, old_value, new_value, actor_id) VALUES (?, ?, 'tool_access_changed', ?, ?, ?)`)
    .run(workspaceId, userId, existing?.tool_access ?? null, json, actorId ?? null);
}

/** Returns the tool_access list for a member, or null (meaning "all tools"). */
export function getMemberToolAccess(dataDir: string, workspaceId: string, userId: string): string[] | null {
  const db = getDb(dataDir);
  const row = db.prepare(`SELECT tool_access FROM workspace_members WHERE workspace_id = ? AND user_id = ?`)
    .get(workspaceId, userId) as { tool_access: string | null } | undefined;
  if (!row) return null;
  return row.tool_access ? JSON.parse(row.tool_access) : null;
}

// ── Per-Tool Internal Permissions ─────────────────────────────────
// Tools own their internal role model. LogicOS admin only assigns which
// tools a user can access; each tool manages its own internal permissions
// via these endpoints — outside the LogicOS UI.

export function getToolPermissions(dataDir: string, workspaceId: string, userId: string, toolId: string): string[] {
  const db = getDb(dataDir);
  const row = db.prepare(`SELECT permissions FROM workspace_member_tool_permissions WHERE workspace_id = ? AND user_id = ? AND tool_id = ?`)
    .get(workspaceId, userId, toolId) as { permissions: string } | undefined;
  return row ? JSON.parse(row.permissions) : [];
}

export function setToolPermissions(dataDir: string, workspaceId: string, userId: string, toolId: string, permissions: string[], actorId?: string): void {
  const db = getDb(dataDir);
  db.prepare(`
    INSERT INTO workspace_member_tool_permissions (workspace_id, user_id, tool_id, permissions, updated_at, updated_by)
    VALUES (?, ?, ?, ?, datetime('now'), ?)
    ON CONFLICT(workspace_id, user_id, tool_id) DO UPDATE SET
      permissions = excluded.permissions,
      updated_at  = excluded.updated_at,
      updated_by  = excluded.updated_by
  `).run(workspaceId, userId, toolId, JSON.stringify(permissions), actorId ?? null);
}

export function listToolPermissionsForMember(dataDir: string, workspaceId: string, userId: string): Array<{ toolId: string; permissions: string[] }> {
  const db = getDb(dataDir);
  const rows = db.prepare(`SELECT tool_id, permissions FROM workspace_member_tool_permissions WHERE workspace_id = ? AND user_id = ?`)
    .all(workspaceId, userId) as Array<{ tool_id: string; permissions: string }>;
  return rows.map(r => ({ toolId: r.tool_id, permissions: JSON.parse(r.permissions) }));
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


// ── CaseSpace Store ─────────────────────────────────────────────────────

export interface CaseSpaceRow {
  id: string;
  workspace_id: string;
  owner_id: string;
  name: string;
  description?: string;
  color?: string;
  icon?: string;
  type?: string;
  town?: string;
  vault_module_ids: string[];
  visibility: string;
  members: string[];
  connection_ids: string[];
  audit_enabled: boolean;
  retention_enabled: boolean;
  file_count: number;
  folder_count: number;
  template_count: number;
  created_at: number;
  last_accessed?: number;
}

function rowToCaseSpace(row: any): CaseSpaceRow {
  return {
    ...row,
    vault_module_ids: row.vault_module_ids ? JSON.parse(row.vault_module_ids) : [],
    members: row.members ? JSON.parse(row.members) : [],
    connection_ids: row.connection_ids ? JSON.parse(row.connection_ids) : [],
    audit_enabled: Boolean(row.audit_enabled),
    retention_enabled: Boolean(row.retention_enabled),
  };
}

export function listCaseSpaces(dataDir: string, workspaceId: string, userId: string): CaseSpaceRow[] {
  const db = getDb(dataDir);
  const rows = db.prepare(`SELECT * FROM casespaces WHERE workspace_id = ? ORDER BY created_at ASC`).all(workspaceId) as any[];
  return rows
    .map(rowToCaseSpace)
    .filter(cs => {
      if (cs.visibility === 'organization') return true;
      if (cs.visibility === 'public') return true;
      if (cs.owner_id === userId) return true;
      return cs.members.includes(userId);
    });
}

export function createCaseSpace(dataDir: string, cs: Omit<CaseSpaceRow, 'file_count' | 'folder_count' | 'template_count'>): CaseSpaceRow {
  const db = getDb(dataDir);
  db.prepare(`
    INSERT INTO casespaces (id, workspace_id, owner_id, name, description, color, icon, type, town,
      vault_module_ids, visibility, members, connection_ids, audit_enabled, retention_enabled,
      file_count, folder_count, template_count, created_at, last_accessed)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, 0, ?, ?)
  `).run(
    cs.id, cs.workspace_id, cs.owner_id, cs.name, cs.description ?? null,
    cs.color ?? null, cs.icon ?? null, cs.type ?? 'custom', cs.town ?? null,
    JSON.stringify(cs.vault_module_ids ?? []), cs.visibility ?? 'organization',
    JSON.stringify(cs.members ?? []), JSON.stringify(cs.connection_ids ?? []),
    cs.audit_enabled ? 1 : 0, cs.retention_enabled ? 1 : 0,
    cs.created_at, cs.last_accessed ?? null,
  );
  return getCaseSpace(dataDir, cs.id)!;
}

export function getCaseSpace(dataDir: string, id: string): CaseSpaceRow | null {
  const db = getDb(dataDir);
  const row = db.prepare(`SELECT * FROM casespaces WHERE id = ?`).get(id) as any;
  return row ? rowToCaseSpace(row) : null;
}

export function updateCaseSpace(dataDir: string, id: string, updates: Partial<Omit<CaseSpaceRow, 'id' | 'workspace_id' | 'owner_id' | 'created_at'>>): CaseSpaceRow | null {
  const db = getDb(dataDir);
  const row = db.prepare(`SELECT * FROM casespaces WHERE id = ?`).get(id) as any;
  if (!row) return null;
  const merged = rowToCaseSpace(row);
  const next = { ...merged, ...updates };
  db.prepare(`
    UPDATE casespaces SET name=?, description=?, color=?, icon=?, type=?, town=?,
      vault_module_ids=?, visibility=?, members=?, connection_ids=?,
      audit_enabled=?, retention_enabled=?, file_count=?, folder_count=?, template_count=?, last_accessed=?
    WHERE id=?
  `).run(
    next.name, next.description ?? null, next.color ?? null, next.icon ?? null,
    next.type ?? 'custom', next.town ?? null,
    JSON.stringify(next.vault_module_ids ?? []), next.visibility ?? 'organization',
    JSON.stringify(next.members ?? []), JSON.stringify(next.connection_ids ?? []),
    next.audit_enabled ? 1 : 0, next.retention_enabled ? 1 : 0,
    next.file_count ?? 0, next.folder_count ?? 0, next.template_count ?? 0,
    next.last_accessed ?? null, id,
  );
  return getCaseSpace(dataDir, id);
}

export function deleteCaseSpace(dataDir: string, id: string): void {
  const db = getDb(dataDir);
  db.prepare(`DELETE FROM casespaces WHERE id = ?`).run(id);
}
