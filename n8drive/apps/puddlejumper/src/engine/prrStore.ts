// ── PRR (Public Records Request) Store ────────────────────────────────
//
// Manages public records requests, comments, and attachments.
//
import Database from "better-sqlite3";
import crypto from "node:crypto";
import { getDb as getWorkspaceDb } from "./workspaceStore.js";

export type PRRStatus = "submitted" | "acknowledged" | "in_progress" | "closed";

export type PRRRow = {
  id: string;
  workspace_id: string;
  public_token: string;
  submitter_name: string | null;
  submitter_email: string | null;
  summary: string;
  details: string | null;
  attachments: string | null; // JSON array
  status: PRRStatus;
  assigned_to: string | null;
  created_at: string;
  updated_at: string;
};

export type PRRCommentRow = {
  id: string;
  prr_id: string;
  user_id: string | null;
  body: string;
  created_at: string;
};

export type PRRFilters = {
  status?: PRRStatus;
  assigned_to?: string;
  page?: number;
  per_page?: number;
};

// Initialize PRR tables (idempotent)
export function initPRRTables(dataDir: string): Database.Database {
  const db = getWorkspaceDb(dataDir);
  
  // Check if prr_requests table exists
  const hasRequestsTable = db.prepare(
    `SELECT name FROM sqlite_master WHERE type='table' AND name='prr_requests'`
  ).get();
  
  if (!hasRequestsTable) {
    db.exec(`
      CREATE TABLE prr_requests (
        id TEXT PRIMARY KEY,
        workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
        public_token TEXT NOT NULL UNIQUE,
        submitter_name TEXT,
        submitter_email TEXT,
        summary TEXT NOT NULL,
        details TEXT,
        attachments TEXT, -- JSON array
        status TEXT NOT NULL DEFAULT 'submitted' CHECK(status IN ('submitted','acknowledged','in_progress','closed')),
        assigned_to TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      
      CREATE INDEX idx_prr_workspace ON prr_requests(workspace_id);
      CREATE INDEX idx_prr_token ON prr_requests(public_token);
      CREATE INDEX idx_prr_status ON prr_requests(status);
    `);
  }
  
  // Check if prr_comments table exists
  const hasCommentsTable = db.prepare(
    `SELECT name FROM sqlite_master WHERE type='table' AND name='prr_comments'`
  ).get();
  
  if (!hasCommentsTable) {
    db.exec(`
      CREATE TABLE prr_comments (
        id TEXT PRIMARY KEY,
        prr_id TEXT NOT NULL REFERENCES prr_requests(id) ON DELETE CASCADE,
        user_id TEXT,
        body TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      
      CREATE INDEX idx_prr_comments_prr ON prr_comments(prr_id);
    `);
  }
  
  return db;
}

// Generate secure random token
function generateToken(): string {
  return crypto.randomBytes(16).toString('hex');
}

// Generate unique ID
function generateId(prefix: string): string {
  return `${prefix}-${crypto.randomBytes(8).toString('hex')}`;
}

// Create a new PRR
export function createPRR(
  dataDir: string,
  params: {
    workspace_id: string;
    name?: string;
    email?: string;
    summary: string;
    details?: string;
    attachments?: Array<{ filename: string; size: number; path: string }>;
  }
): PRRRow {
  const db = initPRRTables(dataDir);
  
  const id = generateId('prr');
  const publicToken = generateToken();
  const attachmentsJson = params.attachments ? JSON.stringify(params.attachments) : null;
  
  db.prepare(`
    INSERT INTO prr_requests 
    (id, workspace_id, public_token, submitter_name, submitter_email, summary, details, attachments, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'submitted')
  `).run(
    id,
    params.workspace_id,
    publicToken,
    params.name || null,
    params.email || null,
    params.summary,
    params.details || null,
    attachmentsJson
  );
  
  return getPRRById(dataDir, id)!;
}

// Get PRR by ID
export function getPRRById(dataDir: string, id: string): PRRRow | null {
  const db = initPRRTables(dataDir);
  return db.prepare(`SELECT * FROM prr_requests WHERE id = ?`).get(id) as PRRRow | null;
}

// Get PRR by public token
export function getPRRByToken(dataDir: string, token: string): PRRRow | null {
  const db = initPRRTables(dataDir);
  return db.prepare(`SELECT * FROM prr_requests WHERE public_token = ?`).get(token) as PRRRow | null;
}

// List PRRs for workspace with filters
export function listPRRs(dataDir: string, workspaceId: string, filters: PRRFilters = {}): { requests: PRRRow[]; total: number } {
  const db = initPRRTables(dataDir);
  
  const page = filters.page || 1;
  const perPage = filters.per_page || 50;
  const offset = (page - 1) * perPage;
  
  let whereClause = 'WHERE workspace_id = ?';
  const params: any[] = [workspaceId];
  
  if (filters.status) {
    whereClause += ' AND status = ?';
    params.push(filters.status);
  }
  
  if (filters.assigned_to) {
    whereClause += ' AND assigned_to = ?';
    params.push(filters.assigned_to);
  }
  
  const total = db.prepare(
    `SELECT COUNT(*) as count FROM prr_requests ${whereClause}`
  ).get(...params) as { count: number };
  
  const requests = db.prepare(
    `SELECT * FROM prr_requests ${whereClause} ORDER BY created_at DESC LIMIT ? OFFSET ?`
  ).all(...params, perPage, offset) as PRRRow[];
  
  return { requests, total: total.count };
}

// Update PRR status
export function updatePRRStatus(
  dataDir: string,
  id: string,
  status: PRRStatus,
  actorId: string,
  note?: string
): PRRRow | null {
  const db = initPRRTables(dataDir);
  
  // Use transaction for atomic update + optional comment
  const transaction = db.transaction(() => {
    db.prepare(`
      UPDATE prr_requests 
      SET status = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(status, id);
    
    if (note) {
      addPRRComment(dataDir, id, actorId, note);
    }
  });
  
  transaction();
  return getPRRById(dataDir, id);
}

// Assign PRR to user
export function assignPRR(dataDir: string, id: string, assignedTo: string | null): PRRRow | null {
  const db = initPRRTables(dataDir);
  
  db.prepare(`
    UPDATE prr_requests 
    SET assigned_to = ?, updated_at = datetime('now')
    WHERE id = ?
  `).run(assignedTo, id);
  
  return getPRRById(dataDir, id);
}

// Update PRR (combined status + assignment)
export function updatePRR(
  dataDir: string,
  id: string,
  updates: { status?: PRRStatus; assigned_to?: string | null }
): PRRRow | null {
  const db = initPRRTables(dataDir);
  
  const sets: string[] = [];
  const params: any[] = [];
  
  if (updates.status) {
    sets.push('status = ?');
    params.push(updates.status);
  }
  
  if (updates.assigned_to !== undefined) {
    sets.push('assigned_to = ?');
    params.push(updates.assigned_to);
  }
  
  if (sets.length === 0) return getPRRById(dataDir, id);
  
  sets.push('updated_at = datetime(\'now\')');
  params.push(id);
  
  db.prepare(`
    UPDATE prr_requests 
    SET ${sets.join(', ')}
    WHERE id = ?
  `).run(...params);
  
  return getPRRById(dataDir, id);
}

// Add comment to PRR
export function addPRRComment(
  dataDir: string,
  prrId: string,
  userId: string | null,
  body: string
): PRRCommentRow {
  const db = initPRRTables(dataDir);
  
  const id = generateId('comment');
  
  db.prepare(`
    INSERT INTO prr_comments (id, prr_id, user_id, body)
    VALUES (?, ?, ?, ?)
  `).run(id, prrId, userId, body);
  
  return db.prepare(`SELECT * FROM prr_comments WHERE id = ?`).get(id) as PRRCommentRow;
}

// List comments for PRR
export function listPRRComments(dataDir: string, prrId: string): PRRCommentRow[] {
  const db = initPRRTables(dataDir);
  
  return db.prepare(`
    SELECT * FROM prr_comments 
    WHERE prr_id = ? 
    ORDER BY created_at ASC
  `).all(prrId) as PRRCommentRow[];
}

// Delete PRR (admin only)
export function deletePRR(dataDir: string, id: string): boolean {
  const db = initPRRTables(dataDir);
  
  const transaction = db.transaction(() => {
    // Comments will cascade delete due to ON DELETE CASCADE
    const result = db.prepare(`DELETE FROM prr_requests WHERE id = ?`).run(id);
    return result.changes > 0;
  });
  
  return transaction();
}
