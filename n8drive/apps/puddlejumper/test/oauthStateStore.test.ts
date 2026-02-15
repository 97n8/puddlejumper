import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { OAuthStateStore } from "../src/api/oauthStateStore.js";

let store: OAuthStateStore;
let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "oauth-state-test-"));
  store = new OAuthStateStore(path.join(tmpDir, "oauth_state.db"));
});

afterEach(() => {
  store.close();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe("OAuthStateStore", () => {
  it("creates and consumes a state token", () => {
    const state = store.create("github");
    expect(typeof state).toBe("string");
    expect(state.length).toBeGreaterThan(0);

    const provider = store.consume(state);
    expect(provider).toBe("github");
  });

  it("returns null when consuming a non-existent state", () => {
    expect(store.consume("non-existent")).toBeNull();
  });

  it("is single-use — second consume returns null", () => {
    const state = store.create("google");
    expect(store.consume(state)).toBe("google");
    expect(store.consume(state)).toBeNull();
  });

  it("tracks multiple providers independently", () => {
    const s1 = store.create("github");
    const s2 = store.create("google");
    const s3 = store.create("microsoft");

    expect(store.count()).toBe(3);
    expect(store.consume(s2)).toBe("google");
    expect(store.count()).toBe(2);
    expect(store.consume(s1)).toBe("github");
    expect(store.consume(s3)).toBe("microsoft");
    expect(store.count()).toBe(0);
  });

  it("rejects expired state tokens", () => {
    const state = store.create("github");

    // Manually expire it by updating the DB
    const db = (store as any).db;
    db.prepare("UPDATE oauth_state SET expires_at = ? WHERE state = ?").run(Date.now() - 1000, state);

    expect(store.consume(state)).toBeNull();
  });

  it("prune removes expired entries", () => {
    store.create("github");
    store.create("google");

    // Expire all entries
    const db = (store as any).db;
    db.prepare("UPDATE oauth_state SET expires_at = ?").run(Date.now() - 1000);

    expect(store.count()).toBe(0); // count checks expires_at >= now
    const pruned = store.prune();
    expect(pruned).toBe(2);
  });

  it("survives store re-open (persistence)", () => {
    const dbPath = path.join(tmpDir, "oauth_state.db");
    const state = store.create("microsoft");
    store.close();

    // Re-open same DB
    const store2 = new OAuthStateStore(dbPath);
    expect(store2.consume(state)).toBe("microsoft");
    store2.close();
  });

  it("count returns only non-expired entries", () => {
    store.create("github");
    store.create("google");
    expect(store.count()).toBe(2);

    // Expire one
    const db = (store as any).db;
    const rows = db.prepare("SELECT state FROM oauth_state LIMIT 1").all() as { state: string }[];
    db.prepare("UPDATE oauth_state SET expires_at = ? WHERE state = ?").run(Date.now() - 1000, rows[0].state);

    expect(store.count()).toBe(1);
  });
});
