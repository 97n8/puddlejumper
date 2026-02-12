import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { IdempotencyStore } from "../src/engine/idempotencyStore.js";

const TMP_DB = path.join(process.cwd(), "data", `idempotency-store-${Date.now()}.db`);

test("waits for in-flight shared-db row and replays completed result", async () => {
  const storeA = new IdempotencyStore<{ ok: boolean; value: string }>(TMP_DB);
  const storeB = new IdempotencyStore<{ ok: boolean; value: string }>(TMP_DB);
  const nowIso = new Date().toISOString();
  const expiresAtIso = new Date(Date.now() + 60_000).toISOString();
  const schemaVersion = 2;

  const firstClaim = await storeA.claim("request-1", "payload-hash-1", nowIso, expiresAtIso, schemaVersion);
  assert.equal(firstClaim.type, "acquired");

  const waitingClaimPromise = storeB.claim("request-1", "payload-hash-1", nowIso, expiresAtIso, schemaVersion);
  await new Promise((resolve) => setTimeout(resolve, 150));
  storeA.storeResult("request-1", { ok: true, value: "done" }, schemaVersion, "approved", {
    eventId: "event-1",
    schemaVersion
  });

  const waitingClaim = await waitingClaimPromise;
  assert.equal(waitingClaim.type, "replay");
  if (waitingClaim.type === "replay") {
    assert.deepEqual(waitingClaim.output, { ok: true, value: "done" });
  }

  storeA.close();
  storeB.close();
});

test("returns schema mismatch when replay version differs", async () => {
  const store = new IdempotencyStore<{ ok: boolean }>(TMP_DB);
  const nowIso = new Date().toISOString();
  const expiresAtIso = new Date(Date.now() + 60_000).toISOString();

  const acquired = await store.claim("request-schema", "payload-hash", nowIso, expiresAtIso, 1);
  assert.equal(acquired.type, "acquired");
  store.storeResult("request-schema", { ok: true }, 1, "approved", { eventId: "event-schema", schemaVersion: 1 });

  const mismatched = await store.claim("request-schema", "payload-hash", nowIso, expiresAtIso, 2);
  assert.equal(mismatched.type, "schema_mismatch");
  if (mismatched.type === "schema_mismatch") {
    assert.equal(mismatched.storedSchemaVersion, 1);
  }

  store.close();
});

test.after(() => {
  if (fs.existsSync(TMP_DB)) {
    fs.unlinkSync(TMP_DB);
  }
  if (fs.existsSync(`${TMP_DB}-shm`)) {
    fs.unlinkSync(`${TMP_DB}-shm`);
  }
  if (fs.existsSync(`${TMP_DB}-wal`)) {
    fs.unlinkSync(`${TMP_DB}-wal`);
  }
});
