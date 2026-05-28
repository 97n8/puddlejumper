// PJ_RECONCILE_MIGRATIONS=1 — out-of-band drift reconciliation.
//
// Production volumes can carry schema state that pre-dates the migration
// tracker (e.g. prr.public_id added by an older code path before the
// schema_migrations table was introduced).  When the runner then sees an
// untracked migration whose SQL would re-create that state, it crashes on
// `duplicate column name`.  The reconcile pass detects the drift and
// inserts the schema_migrations row so the runner skips the migration.
//
// Test layout: one shared tmpdir at the file level.  The audit-store
// singleton (apps/logic-commons/src/lib/audit-store.ts) caches its db
// handle process-wide; the existing migrations.test.ts shares the same
// constraint.  Multiple tmpdirs in beforeEach would leak the cached
// handle into a deleted file — same pre-existing failure mode as the
// inventoried migrations.test.ts entry in ship.sh.

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import os from "node:os";
import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { runPuddleJumperMigrations } from "./migrations.js";

let tmpDir: string;
const ORIGINAL_RECONCILE = process.env.PJ_RECONCILE_MIGRATIONS;

function paths() {
  return {
    dataDir: tmpDir,
    prrDbPath: path.join(tmpDir, "prr.db"),
    approvalDbPath: path.join(tmpDir, "approvals.db"),
  };
}

function appliedRow(dbPath: string, filename: string): { filename: string; apply_method: string } | undefined {
  const db = new Database(dbPath, { readonly: true });
  try {
    return db
      .prepare("SELECT filename, apply_method FROM schema_migrations WHERE filename = ?")
      .get(filename) as { filename: string; apply_method: string } | undefined;
  } finally {
    db.close();
  }
}

function appliedFilenames(dbPath: string): string[] {
  const db = new Database(dbPath, { readonly: true });
  try {
    return (
      db
        .prepare("SELECT filename FROM schema_migrations ORDER BY filename ASC")
        .all() as Array<{ filename: string }>
    ).map((row) => row.filename);
  } finally {
    db.close();
  }
}

function seedDriftedPrr(): void {
  const db = new Database(paths().prrDbPath);
  try {
    db.exec(`
      CREATE TABLE prr (
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
      ALTER TABLE prr ADD COLUMN public_id TEXT;
      CREATE UNIQUE INDEX IF NOT EXISTS ix_prr_public_id ON prr(public_id);
    `);
  } finally {
    db.close();
  }
}

beforeAll(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "pj-reconcile-"));
});

afterAll(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
  if (ORIGINAL_RECONCILE === undefined) {
    delete process.env.PJ_RECONCILE_MIGRATIONS;
  } else {
    process.env.PJ_RECONCILE_MIGRATIONS = ORIGINAL_RECONCILE;
  }
});

describe("PJ_RECONCILE_MIGRATIONS=1 — end-to-end drift fix", () => {
  it("detects prr.public_id drift, marks the migration applied, applies the rest, and is idempotent on re-run", () => {
    process.env.PJ_RECONCILE_MIGRATIONS = "1";
    seedDriftedPrr();

    // First boot under the reconcile flag: drift is detected on prr.public_id,
    // 20260206 is marked applied, the two 20260524 migrations apply normally.
    const first = runPuddleJumperMigrations(paths());

    expect(first.applied.sort()).toEqual([
      "20260524_relay_v1_audit_json_indexes.sql",
      "20260524_relay_v1_casespace_fields.sql",
    ]);
    expect(first.skipped).toContain("20260206_add_prr_public_id.sql");

    const markedRow = appliedRow(paths().prrDbPath, "20260206_add_prr_public_id.sql");
    expect(markedRow?.apply_method).toBe("marked");

    expect(appliedRow(paths().approvalDbPath, "20260524_relay_v1_casespace_fields.sql")?.apply_method).toBe("executed");
    expect(appliedRow(path.join(tmpDir, "audit.db"), "20260524_relay_v1_audit_json_indexes.sql")?.apply_method).toBe("executed");

    // Second boot with the flag still on: reconcile is a no-op (marker present),
    // runner skips everything.  This proves the fix is stable across boots.
    const second = runPuddleJumperMigrations(paths());
    expect(second.applied).toEqual([]);
    expect(second.skipped.sort()).toEqual([
      "20260206_add_prr_public_id.sql",
      "20260524_relay_v1_audit_json_indexes.sql",
      "20260524_relay_v1_casespace_fields.sql",
    ]);

    // schema_migrations rows are unchanged after the second boot.
    expect(appliedFilenames(paths().prrDbPath)).toContain("20260206_add_prr_public_id.sql");
  });
});
