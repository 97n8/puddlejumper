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
// Production images flatten layout — `../../../../` from /app/dist/api/ clamps
// to filesystem root, making the dev-default resolve to /migrations (ENOENT).
// PJ_MIGRATIONS_DIR overrides the lookup; Dockerfile sets it explicitly.
const MIGRATIONS_DIR = process.env.PJ_MIGRATIONS_DIR ?? path.join(REPO_ROOT, "migrations");

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

// Out-of-band schema drift was introduced on persistent volumes before the
// migration tracker was added.  Setting PJ_RECONCILE_MIGRATIONS=1 enables a
// one-shot detection pass that inserts the corresponding schema_migrations
// row (apply_method='marked') so the runner skips the migration instead of
// re-applying its non-idempotent SQL (which would crash on duplicate-column).
//
// Each fixture's detect() must be cheap (single PRAGMA) and read-only.  The
// pass is idempotent: if the migration is already recorded with a matching
// checksum, markPuddleJumperMigrationApplied returns the existing row.
type DriftFixture = {
  database: MigrationDatabase;
  filename: string;
  describe: string;
  detect: (opts: { prrDbPath: string; approvalDbPath: string }) => boolean;
};

function columnExists(dbPath: string, table: string, column: string): boolean {
  if (!fs.existsSync(dbPath)) return false;
  const db = new Database(dbPath, { readonly: true });
  try {
    const rows = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
    return rows.some((row) => row.name === column);
  } catch {
    return false;
  } finally {
    db.close();
  }
}

const KNOWN_DRIFT_FIXTURES: DriftFixture[] = [
  {
    database: "prr",
    filename: "20260206_add_prr_public_id.sql",
    describe: "prr.public_id column added out-of-band before tracker existed",
    detect: (opts) => columnExists(opts.prrDbPath, "prr", "public_id"),
  },
  {
    database: "approvals",
    filename: "20260524_relay_v1_casespace_fields.sql",
    describe: "casespaces relay-v1 columns added out-of-band",
    detect: (opts) =>
      columnExists(opts.approvalDbPath, "casespaces", "status") ||
      columnExists(opts.approvalDbPath, "casespaces", "current_responsible_actor_id") ||
      columnExists(opts.approvalDbPath, "casespaces", "last_relay_id"),
  },
];

function reconcileKnownDrift(opts: { dataDir: string; prrDbPath: string; approvalDbPath: string }): void {
  if (process.env.PJ_RECONCILE_MIGRATIONS !== "1") return;
  console.log("[migrations] PJ_RECONCILE_MIGRATIONS=1 — drift reconciliation pass");
  for (const fixture of KNOWN_DRIFT_FIXTURES) {
    if (!fixture.detect({ prrDbPath: opts.prrDbPath, approvalDbPath: opts.approvalDbPath })) {
      console.log(`[migrations] reconcile: ${fixture.filename} — no drift; runner will apply normally`);
      continue;
    }
    console.log(`[migrations] reconcile: ${fixture.filename} — drift detected (${fixture.describe})`);
    const record = markPuddleJumperMigrationApplied({
      dataDir: opts.dataDir,
      prrDbPath: opts.prrDbPath,
      approvalDbPath: opts.approvalDbPath,
      database: fixture.database,
      filename: fixture.filename,
    });
    console.log(
      `[migrations] reconcile: ${fixture.filename} — schema_migrations row present (apply_method=${record.apply_method}, applied_at=${record.applied_at})`,
    );
  }
}

export function runPuddleJumperMigrations(opts: {
  dataDir: string;
  prrDbPath: string;
  approvalDbPath: string;
}) {
  prepareTargets(opts);
  reconcileKnownDrift(opts);
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
