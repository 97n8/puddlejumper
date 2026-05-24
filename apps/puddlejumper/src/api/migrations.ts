import path from "node:path";
import { fileURLToPath } from "node:url";
import fs from "node:fs";
import Database from "better-sqlite3";
import {
  configureAuditStore,
  ensureAuditStoreInitialized,
  markMigrationApplied,
  runMigrations,
  type MigrationDatabase,
  type MigrationTarget,
} from "@publiclogic/logic-commons";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, "../../../../");
const MIGRATIONS_DIR = path.join(REPO_ROOT, "migrations");

export function getPuddleJumperMigrationTargets(opts: {
  dataDir: string;
  prrDbPath: string;
  approvalDbPath: string;
}): MigrationTarget[] {
  return [
    { database: "audit", dbPath: path.join(opts.dataDir, "audit.db") },
    { database: "approvals", dbPath: opts.approvalDbPath },
    { database: "prr", dbPath: opts.prrDbPath },
  ];
}

function withDb(dbPath: string, handler: (db: Database.Database) => void): void {
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  const db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  try {
    handler(db);
  } finally {
    db.close();
  }
}

function ensureLegacyPrrSchema(dbPath: string): void {
  withDb(dbPath, (db) => {
    db.exec(`
      CREATE TABLE IF NOT EXISTS prr (
        id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL,
        requester_name TEXT,
        requester_email TEXT,
        subject TEXT NOT NULL,
        description TEXT,
        status TEXT NOT NULL,
        assigned_to TEXT,
        received_at TEXT NOT NULL,
        statutory_due_at TEXT NOT NULL,
        last_action_at TEXT,
        closed_at TEXT,
        disposition TEXT,
        tenant_case_seq INTEGER DEFAULT 0
      );
    `);
  });
}

function ensureLegacyApprovalsSchema(dbPath: string): void {
  withDb(dbPath, (db) => {
    db.exec(`
      CREATE TABLE IF NOT EXISTS casespaces (
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
      CREATE INDEX IF NOT EXISTS idx_casespaces_workspace ON casespaces(workspace_id);
      CREATE INDEX IF NOT EXISTS idx_casespaces_owner ON casespaces(owner_id);
    `);
  });
}

function prepareTargets(opts: { dataDir: string; prrDbPath: string; approvalDbPath: string }): void {
  configureAuditStore(opts.dataDir);
  ensureAuditStoreInitialized();
  ensureLegacyPrrSchema(opts.prrDbPath);
  ensureLegacyApprovalsSchema(opts.approvalDbPath);
}

export function runPuddleJumperMigrations(opts: {
  dataDir: string;
  prrDbPath: string;
  approvalDbPath: string;
}) {
  prepareTargets(opts);
  return runMigrations({
    migrationsDir: MIGRATIONS_DIR,
    targets: getPuddleJumperMigrationTargets(opts),
  });
}

export function markPuddleJumperMigrationApplied(opts: {
  dataDir: string;
  prrDbPath: string;
  approvalDbPath: string;
  database: MigrationDatabase;
  filename: string;
}) {
  prepareTargets(opts);
  const target = getPuddleJumperMigrationTargets(opts).find((entry) => entry.database === opts.database);
  if (!target) {
    throw new Error(`Unknown migration database '${opts.database}'`);
  }
  return markMigrationApplied({
    migrationsDir: MIGRATIONS_DIR,
    target,
    filename: opts.filename,
  });
}
