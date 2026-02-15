import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { OAuthStateStore } from "../src/lib/state-store.js";

let store: OAuthStateStore;
let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "lc-state-test-"));
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
    expect(store.consume("nonexistent")).toBeNull();
  });

  it("is single-use — second consume returns null (atomic CAS)", () => {
    const state = store.create("google");
    expect(store.consume(state)).toBe("google");
    expect(store.consume(state)).toBeNull();
  });

  it("tracks multiple providers independently", () => {
    const s1 = store.create("github");
    const s2 = store.create("google");
    const s3 = store.create("microsoft");
    expect(store.consume(s1)).toBe("github");
    expect(store.consume(s2)).toBe("google");
    expect(store.consume(s3)).toBe("microsoft");
  });

  it("counts only active (non-used, non-expired) states", () => {
    store.create("github");
    store.create("google");
    expect(store.count()).toBe(2);
    const s = store.create("microsoft");
    store.consume(s);
    expect(store.count()).toBe(2); // consumed state doesn't count
  });

  it("prune removes used states", () => {
    const s = store.create("github");
    store.consume(s);
    const pruned = store.prune();
    expect(pruned).toBeGreaterThanOrEqual(1);
  });

  it("handles concurrent create/consume without conflicts", () => {
    const states = Array.from({ length: 20 }, (_, i) =>
      store.create(i % 2 === 0 ? "github" : "google"),
    );
    // Consume all in order
    for (const state of states) {
      expect(store.consume(state)).not.toBeNull();
    }
    // All should now be consumed
    for (const state of states) {
      expect(store.consume(state)).toBeNull();
    }
  });

  it("survives close and reopen", () => {
    const state = store.create("github");
    store.close();

    // Reopen on same DB path
    store = new OAuthStateStore(path.join(tmpDir, "oauth_state.db"));
    expect(store.consume(state)).toBe("github");
  });
});
