import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Database from "better-sqlite3";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, "../../");
const DATA_DIR = path.join(ROOT_DIR, "data");
const BACKUP_DIR = path.join(ROOT_DIR, "backups");

type RestoreValidation = {
  ok: boolean;
  path: string;
  tables: string[];
  issues: string[];
};

function isPathInside(candidatePath: string, baseDirectory: string): boolean {
  const resolvedCandidate = path.resolve(candidatePath);
  const resolvedBase = path.resolve(baseDirectory);
  const relative = path.relative(resolvedBase, resolvedCandidate);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function assertControlledPath(candidatePath: string, purpose: "read" | "write"): string {
  const resolvedPath = path.resolve(candidatePath);
  const allowedBases = [DATA_DIR, BACKUP_DIR];
  if (!allowedBases.some((base) => isPathInside(resolvedPath, base))) {
    throw new Error(`${purpose} path must be inside ${DATA_DIR} or ${BACKUP_DIR}`);
  }
  return resolvedPath;
}

function tableNames(db: Database.Database): string[] {
  return db
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name ASC")
    .all()
    .map((row) => String((row as { name: string }).name));
}

export async function exportSqliteDatabase(sourcePath: string, destinationPath: string): Promise<string> {
  const resolvedSource = assertControlledPath(sourcePath, "read");
  const resolvedDestination = assertControlledPath(destinationPath, "write");

  if (!fs.existsSync(resolvedSource)) {
    throw new Error(`Source database not found at ${resolvedSource}`);
  }

  fs.mkdirSync(path.dirname(resolvedDestination), { recursive: true });
  const sourceDb = new Database(resolvedSource, { readonly: true });
  try {
    await sourceDb.backup(resolvedDestination);
    return resolvedDestination;
  } finally {
    sourceDb.close();
  }
}

export function validateSqliteRestore(dbPath: string): RestoreValidation {
  const resolvedPath = assertControlledPath(dbPath, "read");
  const issues: string[] = [];

  if (!fs.existsSync(resolvedPath)) {
    return {
      ok: false,
      path: resolvedPath,
      tables: [],
      issues: ["Database file does not exist"]
    };
  }

  const db = new Database(resolvedPath, { readonly: true });
  try {
    const quickCheck = db.prepare("PRAGMA quick_check").pluck().get();
    if (quickCheck !== "ok") {
      issues.push(`PRAGMA quick_check failed: ${String(quickCheck)}`);
    }

    const tables = tableNames(db);
    for (const required of ["idempotency", "decision_audit"]) {
      if (!tables.includes(required)) {
        issues.push(`Missing required table: ${required}`);
      }
    }

    return {
      ok: issues.length === 0,
      path: resolvedPath,
      tables,
      issues
    };
  } finally {
    db.close();
  }
}

function parseFlag(argv: string[], flag: string): string | null {
  const index = argv.indexOf(flag);
  if (index < 0) {
    return null;
  }
  return argv[index + 1] ?? null;
}

async function runCli(): Promise<void> {
  const [command, ...args] = process.argv.slice(2);
  if (command === "backup") {
    const source = parseFlag(args, "--source");
    const out = parseFlag(args, "--out");
    if (!source || !out) {
      throw new Error("Usage: tsx src/api/sqliteMaintenance.ts backup --source <db> --out <backup.db>");
    }
    const backupPath = await exportSqliteDatabase(source, out);
    process.stdout.write(`${backupPath}\n`);
    return;
  }

  if (command === "validate-restore") {
    const dbPath = parseFlag(args, "--db");
    if (!dbPath) {
      throw new Error("Usage: tsx src/api/sqliteMaintenance.ts validate-restore --db <backup.db>");
    }
    const validation = validateSqliteRestore(dbPath);
    process.stdout.write(`${JSON.stringify(validation, null, 2)}\n`);
    if (!validation.ok) {
      process.exitCode = 1;
    }
    return;
  }

  throw new Error("Usage: tsx src/api/sqliteMaintenance.ts <backup|validate-restore> [options]");
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  void runCli().catch((error) => {
    const message = error instanceof Error ? error.message : "SQLite maintenance command failed";
    process.stderr.write(`${message}\n`);
    process.exitCode = 1;
  });
}
