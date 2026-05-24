import { describe, it, expect, beforeEach, afterEach } from "vitest";
import os from "node:os";
import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { markMigrationApplied, runMigrations, type MigrationTarget } from "./migrations.js";

let tmpDir: string;

function writeMigration(filename: string, body: string): void {
  fs.writeFileSync(path.join(tmpDir, "migrations", filename), body, "utf8");
}

function createDbTarget(database: MigrationTarget["database"], suffix = database): MigrationTarget {
  return {
    database,
    dbPath: path.join(tmpDir, `${suffix}.db`),
  };
}

function validMigrationSql(overrides?: Partial<{
  databaseLine: string;
  descriptionLine: string;
  authorLine: string;
  dateLine: string;
  blankLine: string;
  sql: string;
}>): string {
  return [
    overrides?.databaseLine ?? "-- Database: prr",
    overrides?.descriptionLine ?? "-- Description: Valid migration",
    overrides?.authorLine ?? "-- Author: 97n8",
    overrides?.dateLine ?? "-- Date: 2026-05-24",
    overrides?.blankLine ?? "",
    overrides?.sql ?? "CREATE TABLE valid_table (id TEXT PRIMARY KEY);",
  ].join("\n");
}

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "logic-migrations-"));
  fs.mkdirSync(path.join(tmpDir, "migrations"), { recursive: true });
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe("runMigrations", () => {
  it("applies pending files in lexicographic order", () => {
    writeMigration("20260524_first.sql", validMigrationSql({
      descriptionLine: "-- Description: Create ordered_entries table",
      sql: "CREATE TABLE ordered_entries (id TEXT PRIMARY KEY, step TEXT NOT NULL);",
    }));
    writeMigration("20260525_second.sql", validMigrationSql({
      descriptionLine: "-- Description: Insert a row after the table exists",
      dateLine: "-- Date: 2026-05-25",
      sql: "INSERT INTO ordered_entries (id, step) VALUES ('1', 'second');",
    }));

    const result = runMigrations({
      migrationsDir: path.join(tmpDir, "migrations"),
      targets: [createDbTarget("prr")],
    });

    expect(result.applied).toEqual(["20260524_first.sql", "20260525_second.sql"]);
  });

  it("rejects a migration with no header block at all", () => {
    writeMigration("20260524_no_header.sql", "SELECT 1;\n");

    expect(() =>
      runMigrations({
        migrationsDir: path.join(tmpDir, "migrations"),
        targets: [createDbTarget("prr")],
      }),
    ).toThrow(/Database/);
  });

  it("rejects a malformed Database header", () => {
    writeMigration("20260524_bad_database_header.sql", validMigrationSql({
      databaseLine: "-- Database prr",
    }));

    expect(() =>
      runMigrations({
        migrationsDir: path.join(tmpDir, "migrations"),
        targets: [createDbTarget("prr")],
      }),
    ).toThrow(/Database/);
  });

  it("rejects a malformed Description header", () => {
    writeMigration("20260524_bad_description_header.sql", validMigrationSql({
      descriptionLine: "-- Description Valid migration",
    }));

    expect(() =>
      runMigrations({
        migrationsDir: path.join(tmpDir, "migrations"),
        targets: [createDbTarget("prr")],
      }),
    ).toThrow(/Description/);
  });

  it("rejects a malformed Author header", () => {
    writeMigration("20260524_bad_author_header.sql", validMigrationSql({
      authorLine: "-- Author 97n8",
    }));

    expect(() =>
      runMigrations({
        migrationsDir: path.join(tmpDir, "migrations"),
        targets: [createDbTarget("prr")],
      }),
    ).toThrow(/Author/);
  });

  it("rejects a malformed Date header", () => {
    writeMigration("20260524_bad_date_header.sql", validMigrationSql({
      dateLine: "-- Date 2026-05-24",
    }));

    expect(() =>
      runMigrations({
        migrationsDir: path.join(tmpDir, "migrations"),
        targets: [createDbTarget("prr")],
      }),
    ).toThrow(/Date/);
  });

  it("rejects an invalid Date header value", () => {
    writeMigration("20260524_invalid_date.sql", validMigrationSql({
      dateLine: "-- Date: 2026/05/24",
    }));

    expect(() =>
      runMigrations({
        migrationsDir: path.join(tmpDir, "migrations"),
        targets: [createDbTarget("prr")],
      }),
    ).toThrow(/expected YYYY-MM-DD/);
  });

  it("rejects a missing blank line after the header block", () => {
    writeMigration("20260524_missing_blank.sql", validMigrationSql({
      blankLine: "CREATE TABLE should_not_run (id TEXT PRIMARY KEY);",
      sql: "",
    }));

    expect(() =>
      runMigrations({
        migrationsDir: path.join(tmpDir, "migrations"),
        targets: [createDbTarget("prr")],
      }),
    ).toThrow(/blank line/);
  });

  it("fails loud on an unknown database header", () => {
    writeMigration("20260524_unknown_database.sql", validMigrationSql({
      databaseLine: "-- Database: commons",
      sql: "SELECT 1;",
    }));

    expect(() =>
      runMigrations({
        migrationsDir: path.join(tmpDir, "migrations"),
        targets: [createDbTarget("prr")],
      }),
    ).toThrow(/unknown database 'commons'/i);
  });

  it("stores full migration metadata for marked applications", () => {
    writeMigration("20260524_marked.sql", validMigrationSql({
      descriptionLine: "-- Description: Mark a migration without execution",
      sql: "CREATE TABLE example (id TEXT PRIMARY KEY);",
    }));

    const target = createDbTarget("prr");
    const record = markMigrationApplied({
      migrationsDir: path.join(tmpDir, "migrations"),
      target,
      filename: "20260524_marked.sql",
    });

    expect(record.target_database).toBe("prr");
    expect(record.description).toBe("Mark a migration without execution");
    expect(record.author).toBe("97n8");
    expect(record.authored_date).toBe("2026-05-24");
    expect(record.apply_method).toBe("marked");

    const db = new Database(target.dbPath, { readonly: true });
    try {
      const stored = db
        .prepare(
          "SELECT target_database, description, author, authored_date, apply_method FROM schema_migrations WHERE filename = ?",
        )
        .get("20260524_marked.sql") as Record<string, string>;
      expect(stored).toEqual({
        target_database: "prr",
        description: "Mark a migration without execution",
        author: "97n8",
        authored_date: "2026-05-24",
        apply_method: "marked",
      });
    } finally {
      db.close();
    }
  });

  it("rejects checksum mismatches for previously applied migrations", () => {
    writeMigration("20260524_checksum.sql", validMigrationSql({
      descriptionLine: "-- Description: Create checksum test table",
      sql: "CREATE TABLE checksum_test (id TEXT PRIMARY KEY);",
    }));

    runMigrations({
      migrationsDir: path.join(tmpDir, "migrations"),
      targets: [createDbTarget("prr")],
    });

    writeMigration("20260524_checksum.sql", validMigrationSql({
      descriptionLine: "-- Description: Create checksum test table",
      sql: "CREATE TABLE checksum_test (id TEXT PRIMARY KEY, changed TEXT);",
    }));

    expect(() =>
      runMigrations({
        migrationsDir: path.join(tmpDir, "migrations"),
        targets: [createDbTarget("prr")],
      }),
    ).toThrow(/Checksum mismatch/);
  });

  it("computes the same checksum for the same file contents across runs", () => {
    writeMigration("20260524_same_checksum.sql", validMigrationSql({
      descriptionLine: "-- Description: Deterministic checksum test",
      sql: "CREATE TABLE checksum_repeat (id TEXT PRIMARY KEY);",
    }));

    const first = markMigrationApplied({
      migrationsDir: path.join(tmpDir, "migrations"),
      target: createDbTarget("prr", "first-prr"),
      filename: "20260524_same_checksum.sql",
    });
    const second = markMigrationApplied({
      migrationsDir: path.join(tmpDir, "migrations"),
      target: createDbTarget("prr", "second-prr"),
      filename: "20260524_same_checksum.sql",
    });

    expect(first.checksum).toBe(second.checksum);
  });

  it("rolls back the transaction and leaves schema_migrations unchanged on SQL error", () => {
    writeMigration("20260524_broken.sql", validMigrationSql({
      descriptionLine: "-- Description: Fail after creating a table",
      sql: [
        "CREATE TABLE broken_table (id TEXT PRIMARY KEY);",
        "INSERT INTO missing_table (id) VALUES ('1');",
      ].join("\n"),
    }));

    const target = createDbTarget("prr");
    expect(() =>
      runMigrations({
        migrationsDir: path.join(tmpDir, "migrations"),
        targets: [target],
      }),
    ).toThrow(/Failed to apply migration 20260524_broken\.sql/);

    const db = new Database(target.dbPath, { readonly: true });
    try {
      const recorded = db.prepare("SELECT COUNT(*) AS count FROM schema_migrations").get() as { count: number };
      const table = db
        .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'broken_table'")
        .get() as { name: string } | undefined;
      expect(recorded.count).toBe(0);
      expect(table).toBeUndefined();
    } finally {
      db.close();
    }
  });

  it("catches migrations being marked against the wrong database", () => {
    writeMigration("20260524_wrong_target.sql", validMigrationSql({
      descriptionLine: "-- Description: Wrong target database for this test",
      sql: "CREATE TABLE wrong_target (id TEXT PRIMARY KEY);",
    }));

    expect(() =>
      markMigrationApplied({
        migrationsDir: path.join(tmpDir, "migrations"),
        target: createDbTarget("audit"),
        filename: "20260524_wrong_target.sql",
      }),
    ).toThrow(/targets prr, not audit/);
  });
});
