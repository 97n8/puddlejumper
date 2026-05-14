/**
 * Seed script — creates dev tenant, test user, sample flows
 * Run: npx tsx apps/api/db/seed.ts
 * // GPR
 */
import Database from "better-sqlite3";
import { randomUUID } from "crypto";

const db = new Database("./apps/api/data/pj.db");
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

// Run schema from @pj/db
// For now, inline the critical tables:

db.exec(`
CREATE TABLE IF NOT EXISTS tenants (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  modules TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  email TEXT NOT NULL,
  name TEXT NOT NULL,
  roles TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

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

CREATE TRIGGER IF NOT EXISTS audit_no_update
  BEFORE UPDATE ON audit_events
  BEGIN SELECT RAISE(ABORT, 'audit_events is append-only: UPDATE forbidden'); END;

CREATE TRIGGER IF NOT EXISTS audit_no_delete
  BEFORE DELETE ON audit_events
  BEGIN SELECT RAISE(ABORT, 'audit_events is append-only: DELETE forbidden'); END;

CREATE TABLE IF NOT EXISTS governance_flows (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  required_conditions TEXT NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'draft',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
`);

// Seed dev tenant
const tenantId = "phillipston-dev";
db.prepare(`INSERT OR IGNORE INTO tenants (id, name, slug, modules) VALUES (?, ?, ?, ?)`).run(
  tenantId,
  "Town of Phillipston (Dev)",
  "phillipston-dev",
  JSON.stringify(["logicos", "vault", "cal", "archieve", "formkey", "org-manager", "puddles"])
);

// Seed test user
db.prepare(`INSERT OR IGNORE INTO users (id, tenant_id, email, name, roles) VALUES (?, ?, ?, ?, ?)`).run(
  "u-dev-clerk",
  tenantId,
  "clerk@phillipston-dev.local",
  "Karen Blais (Dev)",
  JSON.stringify(["town_clerk"])
);

// Seed sample flow
db.prepare(`INSERT OR IGNORE INTO governance_flows (id, tenant_id, name, description, required_conditions, status) VALUES (?, ?, ?, ?, ?, ?)`).run(
  "fl-dev-001",
  tenantId,
  "PRR #26-041 — Police Detail Invoices FY24-25",
  "Public records request from Gardner News",
  JSON.stringify(["verification", "authority", "utility", "legitimacy", "transfer"]),
  "active"
);

db.prepare(`INSERT OR IGNORE INTO governance_flows (id, tenant_id, name, description, required_conditions, status) VALUES (?, ?, ?, ?, ?, ?)`).run(
  "fl-dev-002",
  tenantId,
  "Select Board Minutes — May 6, 2026",
  "Certification of meeting minutes",
  JSON.stringify(["verification", "authority", "utility", "legitimacy", "transfer"]),
  "active"
);

console.log("Seeded: phillipston-dev tenant, clerk user, 2 sample flows");
db.close();
