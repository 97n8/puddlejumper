import { afterEach, describe, expect, it } from "vitest";
import express from "express";
import request from "supertest";
import Database from "better-sqlite3";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { signJwt, cookieParserMiddleware } from "@publiclogic/core";
import { createPayloadsRouter } from "../src/api/routes/payloads.js";
import { KillSwitchStore } from "../src/ops/killSwitch.js";

const TEST_DIR = path.join(os.tmpdir(), `payloads-route-${Date.now()}`);
const TEST_SHARED_TOKEN = "payload-test-token";

function buildPayload() {
  return {
    payload_version: "1.0",
    source: "drive-intake-router",
    intent: "organize_drive_file",
    emitted_at: "2026-05-06T14:00:00.000Z",
    run_id: "run_test_001",
    subject: {
      provider: "google_drive",
      file_id: "doc_001",
      file_name: "ULAF-Provisional-Notes.docx",
      mime_type: "application/vnd.google-apps.document",
      owner: "nate@publiclogic.org",
      owner_is_self: true,
      is_shortcut: false,
      parent_id: "root",
      created_time: "2026-04-01T00:00:00.000Z",
      modified_time: "2026-05-01T00:00:00.000Z",
      size_bytes: 12345,
    },
    classification: {
      category: "legal_ip",
      project: "ulaf",
      work_state: "3_DRAFT",
      confidence: 0.88,
      matched_rules: ["filename_ulaf", "content_provisional"],
      classifier: "drive-intake-router",
      reason: "Filename + content match ULAF provisional patent draft.",
    },
    proposed_plan: {
      dispatcher: "google",
      action: "move",
      plan: {
        operation: "move_file",
        file_id: "doc_001",
        from_parent_id: "root",
        to_parent_id: "folder_legal_ip_drafts",
        preserve_name: true,
        allow_overwrite: false,
      },
    },
    policy_context: {
      requires_review: false,
      review_reason: null,
      dry_run: true,
      legal_ip_sensitive: true,
      externally_owned: false,
    },
  };
}

async function buildApp() {
  fs.mkdirSync(TEST_DIR, { recursive: true });
  const dbPath = path.join(TEST_DIR, `${Date.now()}.db`);
  const db = new Database(dbPath);
  const killSwitch = new KillSwitchStore(db);
  const app = express();
  app.use(cookieParserMiddleware());
  app.use(express.json());
  app.use(async (req: any, _res: any, next: any) => {
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith("Bearer jwt:")) {
      try {
        req.auth = await (await import("@publiclogic/core")).verifyJwt(authHeader.slice(11));
      } catch {
        req.auth = undefined;
      }
    }
    next();
  });
  app.use("/api", createPayloadsRouter({ db, killSwitch, sharedToken: TEST_SHARED_TOKEN }));
  return { app, db, killSwitch };
}

afterEach(() => {
  fs.rmSync(TEST_DIR, { recursive: true, force: true });
});

describe("payload intake route", () => {
  it("accepts a valid payload via shared token and returns review chain", async () => {
    const { app, db } = await buildApp();
    const res = await request(app)
      .post("/api/payloads")
      .set("Authorization", `Bearer ${TEST_SHARED_TOKEN}`)
      .set("X-PJ-Source", "drive-intake-router")
      .send(buildPayload());

    expect(res.status).toBe(202);
    expect(res.body.accepted).toBe(true);
    expect(res.body.chain_template).toBe("drive_intake_review");
    expect(res.body.stub).toBe(true);
    expect(res.body.status).toBe("queued_pending_implementation");
    db.close();
  });

  it("returns idempotent success on repeated submission", async () => {
    const { app, db } = await buildApp();
    const payload = buildPayload();

    const first = await request(app)
      .post("/api/payloads")
      .set("Authorization", `Bearer ${TEST_SHARED_TOKEN}`)
      .set("X-PJ-Source", "drive-intake-router")
      .send(payload);

    const second = await request(app)
      .post("/api/payloads")
      .set("Authorization", `Bearer ${TEST_SHARED_TOKEN}`)
      .set("X-PJ-Source", "drive-intake-router")
      .send(payload);

    expect(first.status).toBe(202);
    expect(second.status).toBe(200);
    expect(second.body.idempotent).toBe(true);
    expect(second.body.chain_id).toBe(first.body.chain_id);
    expect(second.body.stub).toBe(true);
    db.close();
  });

  it("honors the kill switch", async () => {
    const { app, db, killSwitch } = await buildApp();
    killSwitch.set({ enabled: true, reason: "maintenance", setBy: "admin" });

    const res = await request(app)
      .post("/api/payloads")
      .set("Authorization", `Bearer ${TEST_SHARED_TOKEN}`)
      .set("X-PJ-Source", "drive-intake-router")
      .send(buildPayload());

    expect(res.status).toBe(503);
    expect(res.body.error).toBe("service_paused");
    expect(res.body.reason).toBeUndefined();
    expect(res.body.set_by).toBeUndefined();
    db.close();
  });

  it("lets admins read the kill switch state", async () => {
    const { app, db } = await buildApp();
    const token = await signJwt({
      sub: "admin-1",
      userId: "admin-1",
      role: "admin",
      permissions: ["deploy", "seal"],
      tenantId: "tenant-1",
    });

    const res = await request(app)
      .get("/api/admin/payloads/kill-switch")
      .set("Authorization", `Bearer jwt:${token}`);

    expect(res.status).toBe(200);
    expect(res.body.enabled).toBe(false);
    db.close();
  });
});
