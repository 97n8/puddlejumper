// @pj/db — SQLite layer.
// The only package that touches the database file. Canon rule 1 (WAL mode),
// canon rule 2 (audit_events append-only triggers).

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';

export type DatabaseHandle = Database.Database;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Resolve the bundled canon migrations directory.
 *
 * `src/` and `dist/` both sit one level under the package root, so the
 * relative `../migrations` resolves correctly whether the caller imports
 * the TypeScript source (vitest in-monorepo) or the compiled JS (consumer
 * pulling `@pj/db` from node_modules).
 */
const MIGRATIONS_DIR = path.resolve(__dirname, '..', 'migrations');

const MIGRATION_FILENAMES = [
  '001_schema_init.sql',
  '002_divergence.sql',
  '003_integration.sql',
  '004_shared_bindings.sql',
  '005_deployment_status.sql',
  '006_identity_overlay.sql',
] as const;

export interface MigrateResult {
  applied: string[];
  skipped: string[];
}

/**
 * Open a SQLite database. Default path is in-memory.
 *
 * Every connection sets `journal_mode = WAL` and `foreign_keys = ON` (canon
 * rule 1). In-memory DBs ignore `journal_mode` but the pragma is harmless.
 */
export function getDb(dbPath: string = ':memory:'): DatabaseHandle {
  if (dbPath !== ':memory:') {
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  }
  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  return db;
}

function ensureMigrationsTable(db: DatabaseHandle): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS pj_db_migrations (
      filename    TEXT PRIMARY KEY,
      applied_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    );
  `);
}

/**
 * Apply the canon migration set (001 → 003) in order. Idempotent: each
 * migration is recorded in `pj_db_migrations` and skipped on re-run.
 *
 * Returns the filenames that were applied vs. skipped.
 */
export function migrate(db: DatabaseHandle): MigrateResult {
  ensureMigrationsTable(db);

  const applied: string[] = [];
  const skipped: string[] = [];

  const hasMigration = db.prepare<[string]>(
    'SELECT 1 FROM pj_db_migrations WHERE filename = ?',
  );
  const recordMigration = db.prepare<[string]>(
    'INSERT INTO pj_db_migrations (filename) VALUES (?)',
  );

  for (const filename of MIGRATION_FILENAMES) {
    if (hasMigration.get(filename)) {
      skipped.push(filename);
      continue;
    }

    const fullPath = path.join(MIGRATIONS_DIR, filename);
    const sql = fs.readFileSync(fullPath, 'utf8');

    const apply = db.transaction(() => {
      db.exec(sql);
      recordMigration.run(filename);
    });
    apply();
    applied.push(filename);
  }

  return { applied, skipped };
}

/**
 * Verify both canon append-only triggers (`audit_events_no_update` and
 * `audit_events_no_delete`) are defined on this database. Canon rule 2.
 *
 * Returns `true` only when both triggers are present.
 */
export function verifyAuditTriggers(db: DatabaseHandle): boolean {
  const rows = db
    .prepare(
      `SELECT name FROM sqlite_master
       WHERE type = 'trigger'
         AND name IN ('audit_events_no_update', 'audit_events_no_delete')`,
    )
    .all() as Array<{ name: string }>;
  const names = new Set(rows.map((r) => r.name));
  return names.has('audit_events_no_update') && names.has('audit_events_no_delete');
}
