import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";

export type MigrationDatabase = "prr" | "approvals" | "audit";

export type MigrationApplyMethod = "executed" | "marked";

export type MigrationHeader = {
  database: MigrationDatabase;
  description: string;
  author: string;
  authoredDate: string;
};

export type MigrationRecord = {
  filename: string;
  applied_at: string;
  checksum: string;
  target_database: MigrationDatabase;
  description: string;
  author: string;
  authored_date: string;
  apply_method: MigrationApplyMethod;
};

export type MigrationTarget = {
  database: MigrationDatabase;
  dbPath: string;
};

export type MigrationRunResult = {
  applied: string[];
  skipped: string[];
};

const MIGRATION_FILENAME_RE = /^\d{8}_[a-z0-9_]+\.sql$/;
const HEADER_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const VALID_MIGRATION_DATABASES = ["approvals", "audit", "prr"] as const satisfies readonly MigrationDatabase[];

function isMigrationDatabase(value: string): value is MigrationDatabase {
  return VALID_MIGRATION_DATABASES.includes(value as MigrationDatabase);
}

function sha256(input: string): string {
  return crypto.createHash("sha256").update(input).digest("hex");
}

function ensureSchemaMigrations(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL,
      checksum TEXT NOT NULL,
      target_database TEXT NOT NULL,
      description TEXT NOT NULL,
      author TEXT NOT NULL,
      authored_date TEXT NOT NULL,
      apply_method TEXT NOT NULL CHECK(apply_method IN ('executed', 'marked'))
    );
  `);

  const columns = db
    .prepare("PRAGMA table_info(schema_migrations)")
    .all() as Array<{ name: string }>;
  const columnNames = new Set(columns.map((column) => column.name));

  if (!columnNames.has("target_database")) {
    db.exec("ALTER TABLE schema_migrations ADD COLUMN target_database TEXT NOT NULL DEFAULT 'prr'");
  }
  if (!columnNames.has("description")) {
    db.exec("ALTER TABLE schema_migrations ADD COLUMN description TEXT NOT NULL DEFAULT ''");
  }
  if (!columnNames.has("author")) {
    db.exec("ALTER TABLE schema_migrations ADD COLUMN author TEXT NOT NULL DEFAULT ''");
  }
  if (!columnNames.has("authored_date")) {
    db.exec("ALTER TABLE schema_migrations ADD COLUMN authored_date TEXT NOT NULL DEFAULT '1970-01-01'");
  }
  if (!columnNames.has("apply_method")) {
    db.exec(
      "ALTER TABLE schema_migrations ADD COLUMN apply_method TEXT NOT NULL DEFAULT 'executed' CHECK(apply_method IN ('executed', 'marked'))",
    );
  }
}

function parseRequiredHeaderLine(
  actual: string | undefined,
  label: string,
  filename: string,
): string {
  const prefix = `-- ${label}: `;
  if (!actual?.startsWith(prefix)) {
    throw new Error(
      `Migration ${filename} must begin with '-- ${label}: ...' on header line ${label === "Database" ? 1 : label === "Description" ? 2 : label === "Author" ? 3 : 4}`,
    );
  }
  const value = actual.slice(prefix.length).trim();
  if (!value) {
    throw new Error(`Migration ${filename} has an empty ${label} header`);
  }
  return value;
}

function parseMigrationHeader(sql: string, filename: string): MigrationHeader {
  const lines = sql.split(/\r?\n/);
  const databaseValue = parseRequiredHeaderLine(lines[0], "Database", filename);
  const description = parseRequiredHeaderLine(lines[1], "Description", filename);
  const author = parseRequiredHeaderLine(lines[2], "Author", filename);
  const authoredDate = parseRequiredHeaderLine(lines[3], "Date", filename);

  if (!isMigrationDatabase(databaseValue)) {
    throw new Error(
      `Migration ${filename} targets unknown database '${databaseValue}'. Accepted values: ${VALID_MIGRATION_DATABASES.join(", ")}`,
    );
  }
  if (!HEADER_DATE_RE.test(authoredDate)) {
    throw new Error(`Migration ${filename} has invalid Date header '${authoredDate}' (expected YYYY-MM-DD)`);
  }
  if ((lines[4] ?? "").trim() !== "") {
    throw new Error(`Migration ${filename} must include a blank line after the four required header lines`);
  }

  const sqlBody = lines.slice(5).join("\n").trim();
  if (!sqlBody) {
    throw new Error(`Migration ${filename} does not contain any SQL after the required header block`);
  }

  return {
    database: databaseValue,
    description,
    author,
    authoredDate,
  };
}

function listMigrationFiles(migrationsDir: string): string[] {
  return fs
    .readdirSync(migrationsDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && MIGRATION_FILENAME_RE.test(entry.name))
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b));
}

function loadMigration(migrationsDir: string, filename: string): {
  filename: string;
  fullPath: string;
  sql: string;
  checksum: string;
  header: MigrationHeader;
} {
  const fullPath = path.join(migrationsDir, filename);
  const sql = fs.readFileSync(fullPath, "utf8");
  return {
    filename,
    fullPath,
    sql,
    checksum: sha256(sql),
    header: parseMigrationHeader(sql, filename),
  };
}

function openTargetDb(dbPath: string): Database.Database {
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  const db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  ensureSchemaMigrations(db);
  return db;
}

function getRecordedMigrations(db: Database.Database): MigrationRecord[] {
  return db
    .prepare(`
      SELECT filename, applied_at, checksum, target_database, description, author, authored_date, apply_method
      FROM schema_migrations
      ORDER BY filename ASC
    `)
    .all() as MigrationRecord[];
}

function verifyRecordedChecksums(db: Database.Database, migrationsDir: string): void {
  for (const record of getRecordedMigrations(db)) {
    const fullPath = path.join(migrationsDir, record.filename);
    if (!fs.existsSync(fullPath)) {
      throw new Error(`Previously applied migration is missing from disk: ${record.filename}`);
    }
    const migration = loadMigration(migrationsDir, record.filename);
    if (record.checksum !== migration.checksum) {
      throw new Error(`Checksum mismatch for previously applied migration ${record.filename}`);
    }
    if (record.target_database !== migration.header.database) {
      throw new Error(`Recorded target database mismatch for previously applied migration ${record.filename}`);
    }
  }
}

function insertMigrationRecord(
  db: Database.Database,
  migration: ReturnType<typeof loadMigration>,
  applyMethod: MigrationApplyMethod,
  appliedAt: string,
): void {
  db.prepare(`
    INSERT INTO schema_migrations (
      filename,
      applied_at,
      checksum,
      target_database,
      description,
      author,
      authored_date,
      apply_method
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    migration.filename,
    appliedAt,
    migration.checksum,
    migration.header.database,
    migration.header.description,
    migration.header.author,
    migration.header.authoredDate,
    applyMethod,
  );
}

function applyMigrationFile(db: Database.Database, migration: ReturnType<typeof loadMigration>): void {
  const tx = db.transaction(() => {
    db.exec(migration.sql);
    insertMigrationRecord(db, migration, "executed", new Date().toISOString());
  });
  try {
    tx();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to apply migration ${migration.filename}: ${message}`);
  }
}

export function runMigrations(opts: {
  migrationsDir: string;
  targets: MigrationTarget[];
}): MigrationRunResult {
  const applied: string[] = [];
  const skipped: string[] = [];
  const targetMap = new Map<MigrationDatabase, MigrationTarget>(
    opts.targets.map((target) => [target.database, target]),
  );

  const openDbs = new Map<MigrationDatabase, Database.Database>();
  try {
    for (const target of opts.targets) {
      const db = openTargetDb(target.dbPath);
      verifyRecordedChecksums(db, opts.migrationsDir);
      openDbs.set(target.database, db);
    }

    for (const filename of listMigrationFiles(opts.migrationsDir)) {
      const migration = loadMigration(opts.migrationsDir, filename);
      const target = targetMap.get(migration.header.database);
      if (!target) {
        throw new Error(`No target configured for migration database '${migration.header.database}' in ${filename}`);
      }

      const db = openDbs.get(migration.header.database)!;
      const existing = db
        .prepare(`SELECT filename FROM schema_migrations WHERE filename = ?`)
        .get(filename) as { filename: string } | undefined;

      if (existing) {
        skipped.push(filename);
        continue;
      }

      applyMigrationFile(db, migration);
      applied.push(filename);
    }

    return { applied, skipped };
  } finally {
    for (const db of openDbs.values()) db.close();
  }
}

export function markMigrationApplied(opts: {
  migrationsDir: string;
  target: MigrationTarget;
  filename: string;
}): MigrationRecord {
  const migration = loadMigration(opts.migrationsDir, opts.filename);
  if (migration.header.database !== opts.target.database) {
    throw new Error(
      `Migration ${opts.filename} targets ${migration.header.database}, not ${opts.target.database}`,
    );
  }

  const db = openTargetDb(opts.target.dbPath);
  try {
    verifyRecordedChecksums(db, opts.migrationsDir);
    const existing = db
      .prepare(`
        SELECT filename, applied_at, checksum, target_database, description, author, authored_date, apply_method
        FROM schema_migrations
        WHERE filename = ?
      `)
      .get(opts.filename) as MigrationRecord | undefined;

    if (existing) {
      if (existing.checksum !== migration.checksum) {
        throw new Error(`Checksum mismatch for previously applied migration ${opts.filename}`);
      }
      return existing;
    }

    const appliedAt = new Date().toISOString();
    insertMigrationRecord(db, migration, "marked", appliedAt);

    return {
      filename: opts.filename,
      applied_at: appliedAt,
      checksum: migration.checksum,
      target_database: migration.header.database,
      description: migration.header.description,
      author: migration.header.author,
      authored_date: migration.header.authoredDate,
      apply_method: "marked",
    };
  } finally {
    db.close();
  }
}
