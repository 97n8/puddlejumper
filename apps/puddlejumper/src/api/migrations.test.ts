import { describe, it, expect, beforeEach, afterEach } from "vitest";
import os from "node:os";
import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import {
  markPuddleJumperMigrationApplied,
  runPuddleJumperMigrations,
} from "./migrations.js";

let tmpDir: string;

function runnerPaths() {
  return {
    dataDir: tmpDir,
    prrDbPath: path.join(tmpDir, "prr.db"),
    approvalDbPath: path.join(tmpDir, "approvals.db"),
  };
}

function auditDbPath(): string {
  return path.join(tmpDir, "audit.db");
}

function columnNames(dbPath: string, tableName: string): string[] {
  const db = new Database(dbPath, { readonly: true });
  try {
    return (db.prepare(`PRAGMA table_info(${tableName})`).all() as Array<{ name: string }>).map((row) => row.name);
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

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "pj-migrations-"));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe("runPuddleJumperMigrations", () => {
  it("applies the PRR and Relay migrations on a fresh database set", () => {
    const result = runPuddleJumperMigrations(runnerPaths());

    expect(result.applied).toEqual([
      "20260206_add_prr_public_id.sql",
      "20260524_relay_v1_audit_json_indexes.sql",
      "20260524_relay_v1_casespace_fields.sql",
    ]);

    expect(columnNames(runnerPaths().prrDbPath, "prr")).toContain("public_id");
    expect(columnNames(runnerPaths().approvalDbPath, "casespaces")).toContain("status");
    expect(appliedFilenames(auditDbPath())).toEqual(["20260524_relay_v1_audit_json_indexes.sql"]);
  });

  it("skips already-recorded migrations on repeat runs", () => {
    runPuddleJumperMigrations(runnerPaths());

    const result = runPuddleJumperMigrations(runnerPaths());
    expect(result.applied).toEqual([]);
    expect(result.skipped).toEqual([
      "20260206_add_prr_public_id.sql",
      "20260524_relay_v1_audit_json_indexes.sql",
      "20260524_relay_v1_casespace_fields.sql",
    ]);
  });

  it("fails loud when the PRR migration was applied manually before the runner existed", () => {
    const db = new Database(runnerPaths().prrDbPath);
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

    expect(() => runPuddleJumperMigrations(runnerPaths())).toThrow(/20260206_add_prr_public_id\.sql/i);
  });

  it("records marked migrations with apply_method = 'marked' for out-of-band cases", () => {
    const db = new Database(runnerPaths().prrDbPath);
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

    const record = markPuddleJumperMigrationApplied({
      ...runnerPaths(),
      database: "prr",
      filename: "20260206_add_prr_public_id.sql",
    });

    expect(record.apply_method).toBe("marked");
    expect(record.target_database).toBe("prr");

    const result = runPuddleJumperMigrations(runnerPaths());
    expect(result.skipped).toContain("20260206_add_prr_public_id.sql");
  });
});
