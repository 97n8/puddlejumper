import { describe, it, expect, beforeEach, afterAll } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import Database from "better-sqlite3";

const tmpDir = path.join(os.tmpdir(), `lc-audit-test-${Date.now()}`);
process.env.CONTROLLED_DATA_DIR = tmpDir;

const {
  insertAuditEvent,
  queryAuditEvents,
  logToolEvent,
  resetAuditDb,
  configureAuditStore,
} = await import("../src/lib/audit-store.js");

async function cleanStore() {
  resetAuditDb();
  await fs.rm(tmpDir, { recursive: true, force: true });
}

beforeEach(async () => { await cleanStore(); });
afterAll(async () => { await cleanStore(); });

describe("audit store", () => {
  it("inserts and retrieves an event", () => {
    const row = insertAuditEvent({
      event_type: "auth.login",
      actor_id: "u1",
      ip_address: "127.0.0.1",
    });
    expect(row.id).toBeDefined();
    expect(row.event_type).toBe("auth.login");
    expect(row.actor_id).toBe("u1");
    expect(row.ip_address).toBe("127.0.0.1");
    expect(row.timestamp).toBeDefined();
  });

  it("stores and parses metadata as JSON", () => {
    const row = insertAuditEvent({
      event_type: "auth.login",
      metadata: { provider: "github", method: "oauth" },
    });
    expect(row.metadata).toBeDefined();
    const parsed = JSON.parse(row.metadata!);
    expect(parsed.provider).toBe("github");
    expect(parsed.method).toBe("oauth");
  });

  it("stores null metadata when not provided", () => {
    const row = insertAuditEvent({ event_type: "test.event" });
    expect(row.metadata).toBeNull();
  });

  it("stores all optional fields", () => {
    const row = insertAuditEvent({
      event_type: "auth.logout",
      actor_id: "u1",
      target_id: "t1",
      ip_address: "10.0.0.1",
      user_agent: "TestAgent/1.0",
      request_id: "corr-123",
      metadata: { reason: "user_initiated" },
    });
    expect(row.actor_id).toBe("u1");
    expect(row.target_id).toBe("t1");
    expect(row.ip_address).toBe("10.0.0.1");
    expect(row.user_agent).toBe("TestAgent/1.0");
    expect(row.request_id).toBe("corr-123");
  });

  describe("queryAuditEvents", () => {
    it("returns events in descending order", () => {
      insertAuditEvent({ event_type: "first" });
      insertAuditEvent({ event_type: "second" });
      const events = queryAuditEvents();
      expect(events.length).toBe(2);
      expect(events[0].event_type).toBe("second");
      expect(events[1].event_type).toBe("first");
    });

    it("filters by event_type", () => {
      insertAuditEvent({ event_type: "auth.login" });
      insertAuditEvent({ event_type: "auth.logout" });
      insertAuditEvent({ event_type: "auth.login" });
      const events = queryAuditEvents({ event_type: "auth.login" });
      expect(events.length).toBe(2);
      expect(events.every((e) => e.event_type === "auth.login")).toBe(true);
    });

    it("filters by actor_id", () => {
      insertAuditEvent({ event_type: "a", actor_id: "u1" });
      insertAuditEvent({ event_type: "b", actor_id: "u2" });
      const events = queryAuditEvents({ actor_id: "u1" });
      expect(events.length).toBe(1);
      expect(events[0].actor_id).toBe("u1");
    });

    it("respects limit", () => {
      for (let i = 0; i < 10; i++) {
        insertAuditEvent({ event_type: `event-${i}` });
      }
      const events = queryAuditEvents({ limit: 3 });
      expect(events.length).toBe(3);
    });

    it("caps limit at 500", () => {
      insertAuditEvent({ event_type: "a" });
      // Should not throw even with limit > 500
      const events = queryAuditEvents({ limit: 9999 });
      expect(events.length).toBe(1);
    });

    it("returns empty array when no matches", () => {
      const events = queryAuditEvents({ event_type: "nonexistent" });
      expect(events).toEqual([]);
    });

    it("returns all when no filters", () => {
      insertAuditEvent({ event_type: "a" });
      insertAuditEvent({ event_type: "b" });
      const events = queryAuditEvents();
      expect(events.length).toBe(2);
    });

    it("filters by a single tool id stored in metadata", () => {
      logToolEvent({ tool: "cs-rrc-michigan", action: "opened", actorId: "u1" });
      logToolEvent({ tool: "cs-other", action: "opened", actorId: "u2" });

      const events = queryAuditEvents({ tool_id: "cs-rrc-michigan" });

      expect(events.length).toBe(1);
      expect(JSON.parse(events[0].metadata ?? "{}").tool).toBe("cs-rrc-michigan");
    });

    it("filters across multiple tool ids for roll-up reads", () => {
      logToolEvent({ tool: "cs-mastersite", action: "casespace_provisioned", actorId: "svc" });
      logToolEvent({ tool: "cs-rrc-michigan", action: "opened", actorId: "svc" });
      logToolEvent({ tool: "cs-other", action: "opened", actorId: "svc" });

      const events = queryAuditEvents({ tool_id: ["cs-mastersite", "cs-rrc-michigan"] });

      expect(events.length).toBe(2);
      expect(events.map((event) => JSON.parse(event.metadata ?? "{}").tool)).toEqual([
        "cs-rrc-michigan",
        "cs-mastersite",
      ]);
    });
  });

  it("configureAuditStore overrides data directory", () => {
    const customDir = path.join(os.tmpdir(), `lc-audit-custom-${Date.now()}`);
    resetAuditDb();
    configureAuditStore(customDir);
    const row = insertAuditEvent({ event_type: "test" });
    expect(row.id).toBeDefined();
    resetAuditDb();
    configureAuditStore(tmpDir);
    fs.rm(customDir, { recursive: true, force: true });
  });

  it("keeps tool as the authoritative metadata scope key", () => {
    const row = logToolEvent({
      tool: "cs-rrc-michigan",
      action: "synced",
      actorId: "svc-proxy",
      meta: { tool: "evil-override", action: "spoofed", note: "ok" },
    });

    expect(JSON.parse(row.metadata ?? "{}")).toEqual({
      tool: "cs-rrc-michigan",
      action: "synced",
      note: "ok",
    });
  });

  it("rejects updates and deletes because the audit table is append-only", () => {
    const row = insertAuditEvent({ event_type: "auth.login", actor_id: "u1" });
    const dbPath = path.join(tmpDir, "audit.db");
    const db = new Database(dbPath);

    expect(() => db.prepare("UPDATE audit_events SET event_type = ? WHERE id = ?").run("changed", row.id)).toThrow(
      /append-only/i,
    );
    expect(() => db.prepare("DELETE FROM audit_events WHERE id = ?").run(row.id)).toThrow(/append-only/i);

    db.close();
  });
});
