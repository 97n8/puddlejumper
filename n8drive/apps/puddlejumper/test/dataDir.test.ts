import { describe, it, expect, afterAll } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import {
  configureRefreshStore,
  createRefreshToken,
  resetDb as resetRefreshDb,
  configureAuditStore,
  insertAuditEvent,
} from "@publiclogic/logic-commons";

// ── Test: configurable data directory for logic-commons stores ──────────────

const tmpDir = path.join(os.tmpdir(), `data-dir-test-${Date.now()}`);

describe("DATA_DIR resolution", () => {
  afterAll(() => {
    try { resetRefreshDb(); } catch { /* ok */ }
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("refresh store creates DB under configured data dir", () => {
    resetRefreshDb();
    configureRefreshStore(tmpDir);

    const token = createRefreshToken("test-user", null, 3600);
    expect(token.user_id).toBe("test-user");
    expect(fs.existsSync(path.join(tmpDir, "refresh_tokens.db"))).toBe(true);
  });

  it("audit store creates DB under configured data dir", () => {
    const auditDir = path.join(tmpDir, "audit-subdir");
    configureAuditStore(auditDir);

    insertAuditEvent({ event_type: "test.data_dir", actor_id: "test" });
    expect(fs.existsSync(path.join(auditDir, "audit.db"))).toBe(true);
  });
});
