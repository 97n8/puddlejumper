import { afterEach, describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { DogStore } from "../src/api/dogStore.js";

const testDbPaths: string[] = [];

function makeDbPath() {
  const dbPath = path.resolve(
    __dirname,
    "../data",
    `dog-store-test-${Date.now()}-${Math.random().toString(36).slice(2)}.db`,
  );
  testDbPaths.push(dbPath);
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  return dbPath;
}

afterEach(() => {
  for (const dbPath of testDbPaths.splice(0)) {
    for (const suffix of ["", "-shm", "-wal"]) {
      fs.rmSync(`${dbPath}${suffix}`, { force: true });
    }
  }
});

describe("DogStore migrations", () => {
  it("migrates legacy databases before creating the tag index", () => {
    const dbPath = makeDbPath();
    const legacyDb = new Database(dbPath);
    legacyDb.exec(`
      CREATE TABLE dog_license (
        id            TEXT PRIMARY KEY,
        public_id     TEXT UNIQUE NOT NULL,
        tenant_id     TEXT NOT NULL,
        owner_name    TEXT NOT NULL,
        owner_email   TEXT,
        owner_address TEXT,
        owner_phone   TEXT,
        dog_name      TEXT NOT NULL,
        dog_breed     TEXT NOT NULL,
        dog_color     TEXT,
        dog_sex       TEXT,
        dog_altered   INTEGER NOT NULL DEFAULT 0,
        dog_dob       TEXT,
        rabies_cert   TEXT,
        rabies_exp    TEXT,
        veterinarian  TEXT,
        license_year  INTEGER NOT NULL,
        status        TEXT NOT NULL DEFAULT 'applied',
        assigned_to   TEXT,
        created_at    TEXT NOT NULL,
        updated_at    TEXT,
        licensed_at   TEXT,
        expires_at    TEXT,
        license_fee   REAL,
        notes         TEXT
      );
      CREATE INDEX ix_dog_tenant_created ON dog_license(tenant_id, created_at);
      CREATE INDEX ix_dog_tenant_status  ON dog_license(tenant_id, status);
    `);
    legacyDb.close();

    const store = new DogStore(dbPath);
    const columnNames = (
      store.db.prepare("PRAGMA table_info(dog_license)").all() as Array<{ name: string }>
    ).map((column) => column.name);
    expect(columnNames).toEqual(
      expect.arrayContaining(["tag_number", "renewal_of", "renewal_notice_sent_at", "fee_waived"]),
    );

    const indexNames = (
      store.db.prepare("PRAGMA index_list(dog_license)").all() as Array<{ name: string }>
    ).map((index) => index.name);
    expect(indexNames).toContain("ix_dog_tag");

    const created = store.apply({
      tenantId: "tenant-a",
      ownerName: "Taylor Test",
      dogName: "Scout",
      dogBreed: "Lab",
      dogAltered: true,
      licenseYear: 2026,
      actor: "tester",
    });
    const issued = store.issue({
      id: created.id,
      tenantId: "tenant-a",
      actor: "tester",
    });

    expect(issued?.status).toBe("licensed");
    expect(issued?.tag_number).toBe("2026-0001");
    store.db.close();
  });
});
