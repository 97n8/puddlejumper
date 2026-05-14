import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { IdempotencyStore } from "../src/engine/idempotencyStore.js";
import { exportSqliteDatabase, validateSqliteRestore } from "../src/api/sqliteMaintenance.js";

const SOURCE_DB = path.join(process.cwd(), "data", `sqlite-maint-source-${Date.now()}.db`);
const BACKUP_DB = path.join(process.cwd(), "backups", `sqlite-maint-backup-${Date.now()}.db`);

test("exports sqlite backup and validates restore metadata", async () => {
  const store = new IdempotencyStore<{ ok: true }>(SOURCE_DB);
  const requestId = `req-${Date.now()}`;
  const claim = await store.claim(
    requestId,
    "payload-hash",
    new Date().toISOString(),
    new Date(Date.now() + 60_000).toISOString(),
    1
  );
  assert.equal(claim.type, "acquired");
  store.storeResult(requestId, { ok: true }, 1, "approved", { eventId: "evt-1" });
  store.close();

  const backupPath = await exportSqliteDatabase(SOURCE_DB, BACKUP_DB);
  assert.equal(backupPath, path.resolve(BACKUP_DB));
  assert.equal(fs.existsSync(backupPath), true);

  const validation = validateSqliteRestore(backupPath);
  assert.equal(validation.ok, true);
  assert.equal(validation.tables.includes("idempotency"), true);
  assert.equal(validation.tables.includes("decision_audit"), true);
});

test("rejects sqlite backup path outside controlled directories", async () => {
  await assert.rejects(
    () => exportSqliteDatabase(SOURCE_DB, "/tmp/sqlite-maintenance-outside.db"),
    /inside/
  );
});

test.after(() => {
  for (const dbPath of [SOURCE_DB, BACKUP_DB]) {
    if (fs.existsSync(dbPath)) {
      fs.unlinkSync(dbPath);
    }
    if (fs.existsSync(`${dbPath}-shm`)) {
      fs.unlinkSync(`${dbPath}-shm`);
    }
    if (fs.existsSync(`${dbPath}-wal`)) {
      fs.unlinkSync(`${dbPath}-wal`);
    }
  }
});
