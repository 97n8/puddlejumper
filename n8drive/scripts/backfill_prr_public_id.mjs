import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import Database from "better-sqlite3";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dbPath = path.resolve(process.env.PRR_DB_PATH ?? path.join(__dirname, "..", "data", "prr.db"));

if (!fs.existsSync(dbPath)) {
  process.stderr.write(`Database file not found at ${dbPath}\n`);
  process.exit(1);
}

const db = new Database(dbPath);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

const existingColumns = db.prepare("PRAGMA table_info(prr)").all() as Array<{ name: string }>;
if (!existingColumns.some((column) => column.name === "public_id")) {
  db.exec("ALTER TABLE prr ADD COLUMN public_id TEXT");
}
db.exec("CREATE UNIQUE INDEX IF NOT EXISTS ix_prr_public_id ON prr(public_id)");

const rows = db
  .prepare("SELECT id FROM prr WHERE public_id IS NULL OR TRIM(public_id) = ''")
  .all() as Array<{ id: string }>;

if (rows.length === 0) {
  process.stdout.write("No rows require backfill.\n");
  db.close();
  process.exit(0);
}

const update = db.prepare("UPDATE prr SET public_id = ? WHERE id = ?");
const backfill = db.transaction((items: Array<{ id: string }>) => {
  for (const row of items) {
    let updated = false;
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const publicId = crypto.randomUUID();
      try {
        update.run(publicId, row.id);
        updated = true;
        break;
      } catch (error) {
        if (error instanceof Error && /UNIQUE constraint failed: prr\.public_id/i.test(error.message)) {
          continue;
        }
        throw error;
      }
    }
    if (!updated) {
      throw new Error(`Failed to backfill public_id for PRR ${row.id}`);
    }
  }
});

try {
  process.stdout.write(`Backfilling ${rows.length} PRR rows with public_id...\n`);
  backfill(rows);
  process.stdout.write("Backfill complete.\n");
} finally {
  db.close();
}
