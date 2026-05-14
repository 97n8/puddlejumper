// ── Tests: Governance execute handler approval gate ─────────────────────────
//
// Focused tests for the approval gate wired into POST /pj/execute.
// Uses a real ApprovalStore (SQLite on tmpdir) with a minimal Express app
// that replicates the execute handler's gating logic so we don't need
// the full governance engine + runtime context infrastructure.
//
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import express from "express";
import request from "supertest";
import { signJwt, cookieParserMiddleware, csrfProtection } from "@publiclogic/core";
import { ApprovalStore, type CreateApprovalInput } from "../src/engine/approvalStore.js";

// ── Test fixtures ───────────────────────────────────────────────────────────

let store: ApprovalStore;
let tmpDir: string;

const TEST_USER = {
  sub: "u1",
  name: "Test Admin",
  role: "admin",
  permissions: ["deploy", "evaluate.execute"],
  tenants: ["tenant-1"],
  tenantId: "tenant-1",
};

async function getToken(overrides: Record<string, unknown> = {}) {
  return signJwt({ ...TEST_USER, ...overrides }, { expiresIn: "1h" });
}

function makeInput(overrides: Partial<CreateApprovalInput> = {}): CreateApprovalInput {
  return {
    requestId: `req-${crypto.randomUUID()}`,
    operatorId: "u1",
    workspaceId: "ws-1",
    municipalityId: "muni-1",
    actionIntent: "deploy_policy",
    actionMode: "governed",
    planHash: "abc123",
    planSteps: [{ stepId: "s1", description: "Step 1", connector: "github", status: "ready", plan: {} }],
    auditRecord: { eventId: "evt-1", workspaceId: "ws-1", operatorId: "u1", municipalityId: "muni-1" },
    decisionResult: { status: "approved", approved: true, actionPlan: [], automationPlan: [] },
    ...overrides,
  };
}

// ── Mini app that simulates the execute handler's gating logic ──────────────
//
// This replicates the key section of governance.ts POST /pj/execute:
//   1. Engine evaluates → result is approved
//   2. If approvalStore is present + mode != dry-run + action.mode == governed
//      → create approval record, return 202
//   3. Otherwise → return 200 (immediate execution)
//
function buildGateApp(approvalStore: ApprovalStore | undefined) {
  const app = express();
  app.use(cookieParserMiddleware());
  app.use(express.json());

  // Auth middleware (decode JWT from Bearer header)
  app.use(async (req: any, _res: any, next: any) => {
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith("Bearer ")) {
      try {
        const { verifyJwt } = await import("@publiclogic/core");
        req.auth = await verifyJwt(authHeader.slice(7));
      } catch { /* unauthenticated */ }
    }
    next();
  });

  app.use(csrfProtection());

  app.post("/api/pj/execute", (req: any, res: any) => {
    const auth = req.auth;
    if (!auth) { res.status(401).json({ error: "Unauthorized" }); return; }

    const mode = req.body.mode ?? "execute";
    const requestId = req.body.requestId ?? `pj-test-${crypto.randomUUID()}`;
    const actionMode = req.body.actionMode ?? "governed";
    const intent = req.body.intent ?? "deploy_policy";

    // Simulate an approved engine decision
    const fakeResult = {
      status: "approved",
      approved: true,
      schemaVersion: 1,
      actionPlan: [{ stepId: "s1", description: "Deploy", requiresApproval: false, connector: "github", status: "ready", plan: { repo: "test/repo" } }],
      automationPlan: [],
      auditRecord: {
        eventId: `evt-${crypto.randomUUID().slice(0, 8)}`,
        workspaceId: "ws-1",
        operatorId: auth.sub,
        municipalityId: "muni-1",
        timestamp: new Date().toISOString(),
        trigger: "manual",
        intent,
        rationale: "Test",
        schemaVersion: 1,
        evidence: { statute: "test", policyKey: "test", delegationUsed: "none", permissionCheck: "ok", mode: actionMode, systemPromptVersion: "1" },
        planHash: "abc123",
      },
      notices: [],
      nextSteps: [],
      warnings: [],
      uiFeedback: { lcdStatus: "ok", toast: { text: "ok", severity: "success" }, focus: null },
    };

    const success = true;

    // ── Approval gate (mirrors governance.ts) ──────────────────────────
    if (
      success &&
      approvalStore &&
      mode !== "dry-run" &&
      actionMode === "governed"
    ) {
      try {
        const approval = approvalStore.create({
          requestId,
          operatorId: auth.sub ?? auth.userId ?? "unknown",
          workspaceId: "ws-1",
          municipalityId: "muni-1",
          actionIntent: intent,
          actionMode,
          planHash: fakeResult.auditRecord.planHash,
          planSteps: fakeResult.actionPlan,
          auditRecord: fakeResult.auditRecord,
          decisionResult: fakeResult,
        });
        res.status(202).json({
          success: true,
          approvalRequired: true,
          approvalId: approval.id,
          approvalStatus: "pending",
          data: { decision: fakeResult },
          warnings: [],
          message: "Decision approved by engine but requires human sign-off before dispatch.",
        });
        return;
      } catch (err: any) {
        // duplicate requestId → re-fetch existing
        const existing = approvalStore.findByRequestId(requestId);
        if (existing) {
          res.status(202).json({
            success: true,
            approvalRequired: true,
            approvalId: existing.id,
            approvalStatus: existing.approval_status,
            data: { decision: fakeResult },
            warnings: [],
            message: "Approval already exists for this request.",
          });
          return;
        }
        // Fall through to normal response
      }
    }

    res.status(200).json({ success: true, data: { decision: fakeResult }, warnings: [] });
  });

  return app;
}

// ── Setup / teardown ────────────────────────────────────────────────────────

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "governance-gate-test-"));
  store = new ApprovalStore(path.join(tmpDir, "approvals.db"));
});

afterEach(() => {
  store.close();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

// ── Tests ───────────────────────────────────────────────────────────────────

describe("Governance execute approval gate", () => {
  // ── Gate behaviour ──────────────────────────────────────────────────────

  it("returns 202 with approvalRequired when approval store is present", async () => {
    const app = buildGateApp(store);
    const token = await getToken();

    const res = await request(app)
      .post("/api/pj/execute")
      .set("Authorization", `Bearer ${token}`)
      .set("X-PuddleJumper-Request", "true")
      .send({ actionId: "environment.create", mode: "execute", requestId: "req-unique-1" });

    expect(res.status).toBe(202);
    expect(res.body.success).toBe(true);
    expect(res.body.approvalRequired).toBe(true);
    expect(res.body.approvalId).toBeTruthy();
    expect(res.body.approvalStatus).toBe("pending");
    expect(res.body.message).toContain("human sign-off");

    // Verify the approval record was persisted
    const approval = store.findById(res.body.approvalId);
    expect(approval).not.toBeNull();
    expect(approval!.approval_status).toBe("pending");
    expect(approval!.operator_id).toBe("u1");
    expect(approval!.action_intent).toBe("deploy_policy");
    expect(approval!.plan_hash).toBe("abc123");
  });

  it("returns 200 immediately when no approval store is provided", async () => {
    const app = buildGateApp(undefined);
    const token = await getToken();

    const res = await request(app)
      .post("/api/pj/execute")
      .set("Authorization", `Bearer ${token}`)
      .set("X-PuddleJumper-Request", "true")
      .send({ mode: "execute" });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.approvalRequired).toBeUndefined();
  });

  it("returns 200 for dry-run mode (bypasses gate)", async () => {
    const app = buildGateApp(store);
    const token = await getToken();

    const res = await request(app)
      .post("/api/pj/execute")
      .set("Authorization", `Bearer ${token}`)
      .set("X-PuddleJumper-Request", "true")
      .send({ mode: "dry-run" });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.approvalRequired).toBeUndefined();
    // No approval record should exist
    expect(store.countPending()).toBe(0);
  });

  it("returns 200 for launch mode (non-governed)", async () => {
    const app = buildGateApp(store);
    const token = await getToken();

    const res = await request(app)
      .post("/api/pj/execute")
      .set("Authorization", `Bearer ${token}`)
      .set("X-PuddleJumper-Request", "true")
      .send({ mode: "execute", actionMode: "launch" });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(store.countPending()).toBe(0);
  });

  // ── Idempotency ────────────────────────────────────────────────────────

  it("duplicate requestId returns existing approval (idempotent)", async () => {
    const app = buildGateApp(store);
    const token = await getToken();

    const res1 = await request(app)
      .post("/api/pj/execute")
      .set("Authorization", `Bearer ${token}`)
      .set("X-PuddleJumper-Request", "true")
      .send({ mode: "execute", requestId: "idem-req-1" });

    expect(res1.status).toBe(202);
    const approvalId1 = res1.body.approvalId;

    const res2 = await request(app)
      .post("/api/pj/execute")
      .set("Authorization", `Bearer ${token}`)
      .set("X-PuddleJumper-Request", "true")
      .send({ mode: "execute", requestId: "idem-req-1" });

    expect(res2.status).toBe(202);
    expect(res2.body.approvalId).toBe(approvalId1);
    expect(res2.body.message).toContain("already exists");
  });

  // ── Approval lifecycle integration ────────────────────────────────────

  it("approval record contains correct plan data", async () => {
    const app = buildGateApp(store);
    const token = await getToken();

    const res = await request(app)
      .post("/api/pj/execute")
      .set("Authorization", `Bearer ${token}`)
      .set("X-PuddleJumper-Request", "true")
      .send({ mode: "execute", requestId: "plan-data-req" });

    const row = store.findById(res.body.approvalId)!;
    const plan = JSON.parse(row.plan_json);
    expect(plan).toHaveLength(1);
    expect(plan[0].stepId).toBe("s1");
    expect(plan[0].connector).toBe("github");
    expect(plan[0].status).toBe("ready");

    const audit = JSON.parse(row.audit_record_json);
    expect(audit.planHash).toBe("abc123");
    expect(audit.operatorId).toBe("u1");

    const decision = JSON.parse(row.decision_result_json);
    expect(decision.status).toBe("approved");
    expect(decision.approved).toBe(true);
  });

  it("created approval can be decided and dispatched through lifecycle", async () => {
    const app = buildGateApp(store);
    const token = await getToken();

    // Step 1: Execute → gets 202 with pending approval
    const executeRes = await request(app)
      .post("/api/pj/execute")
      .set("Authorization", `Bearer ${token}`)
      .set("X-PuddleJumper-Request", "true")
      .send({ mode: "execute", requestId: "lifecycle-req" });
    expect(executeRes.status).toBe(202);
    const approvalId = executeRes.body.approvalId;

    // Step 2: Approve the decision
    const approved = store.decide({
      approvalId,
      approverId: "admin-1",
      status: "approved",
      note: "LGTM",
    });
    expect(approved).not.toBeNull();
    expect(approved!.approval_status).toBe("approved");

    // Step 3: Consume for dispatch (atomic CAS)
    const dispatching = store.consumeForDispatch(approvalId);
    expect(dispatching).not.toBeNull();
    expect(dispatching!.approval_status).toBe("dispatching");

    // Step 4: Mark as dispatched
    const dispatched = store.markDispatched(approvalId, { pr: "https://github.com/pulls/1" });
    expect(dispatched).not.toBeNull();
    expect(dispatched!.approval_status).toBe("dispatched");
  });

  // ── Auth ──────────────────────────────────────────────────────────────

  it("returns 401 without auth token", async () => {
    const app = buildGateApp(store);
    const res = await request(app)
      .post("/api/pj/execute")
      .set("X-PuddleJumper-Request", "true")
      .send({ mode: "execute" });

    expect(res.status).toBe(401);
  });
});

describe("ApprovalStore.consumeForDispatch", () => {
  it("atomically transitions approved → dispatching", () => {
    const input = makeInput();
    const created = store.create(input);
    store.decide({ approvalId: created.id, approverId: "admin", status: "approved" });

    const result = store.consumeForDispatch(created.id);
    expect(result).not.toBeNull();
    expect(result!.approval_status).toBe("dispatching");
  });

  it("returns null if not in approved state", () => {
    const created = store.create(makeInput());
    // Still pending
    expect(store.consumeForDispatch(created.id)).toBeNull();
  });

  it("second call returns null (prevents double-dispatch)", () => {
    const created = store.create(makeInput());
    store.decide({ approvalId: created.id, approverId: "admin", status: "approved" });

    const first = store.consumeForDispatch(created.id);
    expect(first).not.toBeNull();

    // Second call should fail — already dispatching
    const second = store.consumeForDispatch(created.id);
    expect(second).toBeNull();
  });

  it("returns null for non-existent id", () => {
    expect(store.consumeForDispatch("nope")).toBeNull();
  });

  it("returns null for rejected approval", () => {
    const created = store.create(makeInput());
    store.decide({ approvalId: created.id, approverId: "admin", status: "rejected" });
    expect(store.consumeForDispatch(created.id)).toBeNull();
  });
});
