/**
 * PuddleJumper Database Layer
 * 
 * SQLite everywhere. better-sqlite3. WAL mode.
 * 
 * The audit_events table is append-only — enforced by SQLite triggers.
 * You literally cannot UPDATE or DELETE from audit_events.
 * This is not a policy. It's a constraint.
 * 
 * // GPR
 */

import Database from "better-sqlite3";
import type { AuditEvent, AuditEventInsert } from "@pj/core/audit";
import { randomUUID } from "crypto";
import { createHash } from "crypto";

let db: Database.Database;

export function getDb(path = "./data/pj.db"): Database.Database {
  if (!db) {
    db = new Database(path);
    db.pragma("journal_mode = WAL");
    db.pragma("foreign_keys = ON");
    db.pragma("busy_timeout = 5000");
  }
  return db;
}

/** Run schema migrations */
export function migrate(db: Database.Database): void {
  db.exec(SCHEMA);
}

/** Insert an audit event — the only write operation allowed on audit_events */
export function appendAuditEvent(
  db: Database.Database,
  event: AuditEventInsert
): AuditEvent {
  const id = randomUUID();
  const timestamp = new Date().toISOString();
  
  // Get previous hash for chain integrity
  const lastEvent = db
    .prepare("SELECT hash FROM audit_events WHERE tenant_id = ? ORDER BY rowid DESC LIMIT 1")
    .get(event.tenantId) as { hash: string } | undefined;
  
  const previousHash = lastEvent?.hash;
  const hash = createHash("sha256")
    .update(JSON.stringify({ id, ...event, timestamp, previousHash }))
    .digest("hex");
  
  db.prepare(`
    INSERT INTO audit_events (id, tenant_id, actor_id, actor_type, action, 
      resource_type, resource_id, payload, timestamp, previous_hash, hash)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id, event.tenantId, event.actorId, event.actorType, event.action,
    event.resourceType, event.resourceId, JSON.stringify(event.payload),
    timestamp, previousHash ?? null, hash
  );
  
  return {
    id,
    ...event,
    timestamp,
    previousHash,
    hash,
  };
}

const SCHEMA = `
-- ── Tenants ──
CREATE TABLE IF NOT EXISTS tenants (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  modules TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ── Users ──
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  email TEXT NOT NULL,
  name TEXT NOT NULL,
  roles TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_users_tenant ON users(tenant_id);

-- ── Audit Events (APPEND-ONLY) ──
CREATE TABLE IF NOT EXISTS audit_events (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  actor_id TEXT NOT NULL,
  actor_type TEXT NOT NULL CHECK(actor_type IN ('user', 'system', 'ai_assist')),
  action TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id TEXT NOT NULL,
  payload TEXT NOT NULL DEFAULT '{}',
  timestamp TEXT NOT NULL DEFAULT (datetime('now')),
  previous_hash TEXT,
  hash TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_audit_tenant ON audit_events(tenant_id);
CREATE INDEX IF NOT EXISTS idx_audit_resource ON audit_events(resource_type, resource_id);

-- ── ENFORCE APPEND-ONLY ──
-- You cannot UPDATE audit_events. Period.
CREATE TRIGGER IF NOT EXISTS audit_no_update
  BEFORE UPDATE ON audit_events
  BEGIN
    SELECT RAISE(ABORT, 'audit_events is append-only: UPDATE forbidden');
  END;

-- You cannot DELETE from audit_events. Period.
CREATE TRIGGER IF NOT EXISTS audit_no_delete
  BEFORE DELETE ON audit_events
  BEGIN
    SELECT RAISE(ABORT, 'audit_events is append-only: DELETE forbidden');
  END;

-- ── Governance Flows ──
CREATE TABLE IF NOT EXISTS governance_flows (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  required_conditions TEXT NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','active','completed','suspended','archived')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_flows_tenant ON governance_flows(tenant_id);

-- ── Flow Steps ──
CREATE TABLE IF NOT EXISTS flow_steps (
  id TEXT PRIMARY KEY,
  flow_id TEXT NOT NULL REFERENCES governance_flows(id),
  step_order INTEGER NOT NULL,
  name TEXT NOT NULL,
  assignee_role TEXT NOT NULL,
  vault_evaluation TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','in_progress','approved','rejected','skipped')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_steps_flow ON flow_steps(flow_id);

-- ── VAULT Evaluations ──
CREATE TABLE IF NOT EXISTS vault_evaluations (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  action_id TEXT NOT NULL,
  action_type TEXT NOT NULL,
  conditions TEXT NOT NULL,
  all_satisfied INTEGER NOT NULL DEFAULT 0,
  evaluated_at TEXT NOT NULL DEFAULT (datetime('now')),
  audit_event_id TEXT NOT NULL REFERENCES audit_events(id)
);
CREATE INDEX IF NOT EXISTS idx_vault_tenant ON vault_evaluations(tenant_id);
`;
