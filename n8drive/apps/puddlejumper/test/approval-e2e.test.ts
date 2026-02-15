// ── End-to-end approval lifecycle smoke test ────────────────────────────────
//
// Tests the full flow: execute → 202 → list → approve → dispatch → dispatched
// Exercises the real approval routes + dispatch pipeline with a mock connector.
//
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import express from "express";
import request from "supertest";
import { signJwt, cookieParserMiddleware, csrfProtection } from "@publiclogic/core";
import { ApprovalStore } from "../src/engine/approvalStore.js";
import {
  DispatcherRegistry,
  type ConnectorDispatcher,
  type PlanStepInput,
  type DispatchContext,
  type DispatchStepResult,
} from "../src/engine/dispatch.js";
import { createApprovalRoutes } from "../src/api/routes/approvals.js";
import { approvalMetrics, METRIC, METRIC_HELP } from "../src/engine/approvalMetrics.js";

// ── Fixtures ────────────────────────────────────────────────────────────────

let store: ApprovalStore;
let registry: DispatcherRegistry;
let tmpDir: string;
let dispatchLog: Array<{ step: PlanStepInput; context: DispatchContext }>;

const ADMIN = { sub: "admin-1", name: "Admin", role: "admin", permissions: ["deploy"], tenants: ["t1"], tenantId: "t1" };
const VIEWER = { sub: "viewer-1", name: "Viewer", role: "viewer", permissions: [], tenants: ["t1"], tenantId: "t1" };

async function tokenFor(user: Record<string, unknown>) {
  return signJwt(user, { expiresIn: "1h" });
}

/** Mock connector that records calls and succeeds. */
function createMockDispatcher(): ConnectorDispatcher {
  return {
    connectorName: "github" as any,
    async dispatch(step, context) {
      dispatchLog.push({ step, context });
      return {
        stepId: step.stepId,
        connector: step.connector,
        status: "dispatched" as const,
        result: { pr: "https://github.com/test/repo/pull/42", mock: true },
        completedAt: new Date().toISOString(),
      };
    },
    async healthCheck() { return { healthy: true }; },
  };
}

/** Mock dispatcher that fails. */
function createFailingDispatcher(): ConnectorDispatcher {
  return {
    connectorName: "github" as any,
    async dispatch(step) {
      return {
        stepId: step.stepId,
        connector: step.connector,
        status: "failed" as const,
        error: "Simulated connector failure",
        completedAt: new Date().toISOString(),
      };
    },
    async healthCheck() { return { healthy: false, detail: "down" }; },
  };
}

/** Build an Express app with auth middleware + approval routes + gate endpoint. */
function buildApp(opts: { dispatcher?: ConnectorDispatcher } = {}) {
  const app = express();
  app.use(cookieParserMiddleware());
  app.use(express.json());

  // JWT auth
  app.use(async (req: any, _res: any, next: any) => {
    const h = req.headers.authorization;
    if (h?.startsWith("Bearer ")) {
      try {
        const { verifyJwt } = await import("@publiclogic/core");
        req.auth = await verifyJwt(h.slice(7));
      } catch { /* unauthenticated */ }
    }
    next();
  });

  app.use(csrfProtection());

  // Register dispatcher
  if (opts.dispatcher) {
    registry.register(opts.dispatcher);
  }

  // Gate endpoint (simulates governance execute → 202)
  app.post("/api/pj/execute", (req: any, res: any) => {
    const auth = req.auth;
    if (!auth) { res.status(401).json({ error: "Unauthorized" }); return; }

    const mode = req.body.mode ?? "execute";
    const requestId = req.body.requestId ?? `e2e-${crypto.randomUUID()}`;

    if (mode === "dry-run") {
      res.status(200).json({ success: true, data: {} });
      return;
    }

    const approval = store.create({
      requestId,
      operatorId: auth.sub,
      workspaceId: "ws-smoke",
      municipalityId: "muni-smoke",
      actionIntent: "deploy_policy",
      actionMode: "governed",
      planHash: "hash-" + requestId,
      planSteps: [
        { stepId: "s1", description: "Create branch", requiresApproval: false, connector: "github", status: "ready", plan: { repo: "test/repo", branch: "gov/deploy" } },
        { stepId: "s2", description: "Open PR",       requiresApproval: false, connector: "github", status: "ready", plan: { repo: "test/repo", pr: true } },
      ],
      auditRecord: { eventId: `evt-${requestId}`, timestamp: new Date().toISOString() },
      decisionResult: { status: "approved", approved: true },
    });

    res.status(202).json({
      success: true,
      approvalRequired: true,
      approvalId: approval.id,
      approvalStatus: "pending",
    });
  });

  // Mount approval routes
  app.use("/api", createApprovalRoutes({ approvalStore: store, dispatcherRegistry: registry, nodeEnv: "test" }));

  return app;
}

// ── Setup / teardown ────────────────────────────────────────────────────────

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "e2e-approval-test-"));
  store = new ApprovalStore(path.join(tmpDir, "approvals.db"));
  registry = new DispatcherRegistry();
  dispatchLog = [];
  approvalMetrics.reset();
});

afterEach(() => {
  store.close();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

// ── Tests ───────────────────────────────────────────────────────────────────

describe("Approval lifecycle end-to-end", () => {

  it("full happy path: execute → 202 → list → approve → dispatch → dispatched", async () => {
    const app = buildApp({ dispatcher: createMockDispatcher() });
    const adminToken = await tokenFor(ADMIN);
    const h = { Authorization: `Bearer ${adminToken}`, "X-PuddleJumper-Request": "true" };

    // ── Step 1: Execute governed action → 202 ──
    const executeRes = await request(app)
      .post("/api/pj/execute")
      .set(h)
      .send({ mode: "execute", requestId: "e2e-happy-1" });
    expect(executeRes.status).toBe(202);
    expect(executeRes.body.approvalRequired).toBe(true);
    const approvalId = executeRes.body.approvalId;
    expect(approvalId).toBeTruthy();

    // ── Step 2: List pending → should contain our approval ──
    const listRes = await request(app)
      .get("/api/approvals?status=pending")
      .set(h);
    expect(listRes.status).toBe(200);
    expect(listRes.body.success).toBe(true);
    const found = listRes.body.data.approvals.find((r: any) => r.id === approvalId);
    expect(found).toBeTruthy();
    expect(found.approval_status).toBe("pending");

    // ── Step 3: Pending count ──
    const countRes = await request(app)
      .get("/api/approvals/count/pending")
      .set(h);
    expect(countRes.status).toBe(200);
    expect(countRes.body.data.pendingCount).toBeGreaterThanOrEqual(1);

    // ── Step 4: Approve ──
    const decideRes = await request(app)
      .post(`/api/approvals/${approvalId}/decide`)
      .set(h)
      .send({ status: "approved", note: "E2E smoke test approval" });
    expect(decideRes.status).toBe(200);
    expect(decideRes.body.success).toBe(true);
    expect(decideRes.body.data.approval_status).toBe("approved");
    expect(decideRes.body.data.approver_id).toBe("admin-1");

    // ── Step 5: Dispatch ──
    const dispatchRes = await request(app)
      .post(`/api/approvals/${approvalId}/dispatch`)
      .set(h)
      .send({});
    expect(dispatchRes.status).toBe(200);
    expect(dispatchRes.body.success).toBe(true);
    expect(dispatchRes.body.data.approvalStatus).toBe("dispatched");
    expect(dispatchRes.body.data.dispatchResult.success).toBe(true);
    expect(dispatchRes.body.data.dispatchResult.steps).toHaveLength(2);
    expect(dispatchRes.body.data.dispatchResult.steps[0].status).toBe("dispatched");
    expect(dispatchRes.body.data.dispatchResult.steps[0].result.pr).toBe("https://github.com/test/repo/pull/42");

    // ── Step 6: Verify dispatch log received both steps ──
    expect(dispatchLog).toHaveLength(2);
    expect(dispatchLog[0].step.stepId).toBe("s1");
    expect(dispatchLog[1].step.stepId).toBe("s2");
    expect(dispatchLog[0].context.approvalId).toBe(approvalId);
    expect(dispatchLog[0].context.dryRun).toBe(false);

    // ── Step 7: Final state in DB ──
    const final = store.findById(approvalId)!;
    expect(final.approval_status).toBe("dispatched");
    expect(final.dispatched_at).toBeTruthy();
    expect(JSON.parse(final.dispatch_result_json!).success).toBe(true);

    // ── Step 8: Verify metrics counters ──
    const snap = approvalMetrics.snapshot();
    const counter = (name: string) => snap.find(m => m.name === name && m.type === "counter")?.value ?? 0;
    const gauge   = (name: string) => snap.find(m => m.name === name && m.type === "gauge")?.value ?? 0;
    expect(counter(METRIC.APPROVALS_APPROVED)).toBe(1);
    expect(counter(METRIC.DISPATCH_SUCCESS)).toBe(1);
    expect(counter(METRIC.CONSUME_CAS_SUCCESS)).toBe(1);
    expect(counter(METRIC.CONSUME_CAS_CONFLICT)).toBe(0);
    expect(counter(METRIC.DISPATCH_FAILURE)).toBe(0);
    expect(gauge(METRIC.PENDING_GAUGE)).toBe(0);
  });

  it("reject path: execute → 202 → reject → cannot dispatch", async () => {
    const app = buildApp({ dispatcher: createMockDispatcher() });
    const adminToken = await tokenFor(ADMIN);
    const h = { Authorization: `Bearer ${adminToken}`, "X-PuddleJumper-Request": "true" };

    // Execute
    const executeRes = await request(app)
      .post("/api/pj/execute")
      .set(h)
      .send({ mode: "execute", requestId: "e2e-reject-1" });
    const approvalId = executeRes.body.approvalId;

    // Reject
    const decideRes = await request(app)
      .post(`/api/approvals/${approvalId}/decide`)
      .set(h)
      .send({ status: "rejected", note: "Not for production" });
    expect(decideRes.status).toBe(200);
    expect(decideRes.body.data.approval_status).toBe("rejected");

    // Attempt dispatch — should fail with 409
    const dispatchRes = await request(app)
      .post(`/api/approvals/${approvalId}/dispatch`)
      .set(h)
      .send({});
    expect(dispatchRes.status).toBe(409);
    expect(dispatchRes.body.error).toContain("rejected");

    // Metrics: rejected counter incremented, approved unchanged
    const snap = approvalMetrics.snapshot();
    const counter = (name: string) => snap.find(m => m.name === name && m.type === "counter")?.value ?? 0;
    expect(counter(METRIC.APPROVALS_REJECTED)).toBe(1);
    expect(counter(METRIC.APPROVALS_APPROVED)).toBe(0);
  });

  it("dispatch failure path: connector fails → dispatch_failed status", async () => {
    const app = buildApp({ dispatcher: createFailingDispatcher() });
    const adminToken = await tokenFor(ADMIN);
    const h = { Authorization: `Bearer ${adminToken}`, "X-PuddleJumper-Request": "true" };

    const executeRes = await request(app)
      .post("/api/pj/execute")
      .set(h)
      .send({ mode: "execute", requestId: "e2e-fail-1" });
    const approvalId = executeRes.body.approvalId;

    // Approve
    await request(app)
      .post(`/api/approvals/${approvalId}/decide`)
      .set(h)
      .send({ status: "approved" });

    // Dispatch — connector dispatcher will fail
    const dispatchRes = await request(app)
      .post(`/api/approvals/${approvalId}/dispatch`)
      .set(h)
      .send({});
    expect(dispatchRes.status).toBe(200);
    expect(dispatchRes.body.success).toBe(false);
    expect(dispatchRes.body.data.approvalStatus).toBe("dispatch_failed");
    expect(dispatchRes.body.data.dispatchResult.steps[0].error).toBe("Simulated connector failure");

    // DB state
    const row = store.findById(approvalId)!;
    expect(row.approval_status).toBe("dispatch_failed");

    // Metrics: dispatch failure counter incremented
    const snap = approvalMetrics.snapshot();
    const counter = (name: string) => snap.find(m => m.name === name && m.type === "counter")?.value ?? 0;
    expect(counter(METRIC.DISPATCH_FAILURE)).toBe(1);
    expect(counter(METRIC.DISPATCH_SUCCESS)).toBe(0);
  });

  it("dry-run dispatch does not mutate state", async () => {
    const app = buildApp({ dispatcher: createMockDispatcher() });
    const adminToken = await tokenFor(ADMIN);
    const h = { Authorization: `Bearer ${adminToken}`, "X-PuddleJumper-Request": "true" };

    const executeRes = await request(app)
      .post("/api/pj/execute")
      .set(h)
      .send({ mode: "execute", requestId: "e2e-dryrun-1" });
    const approvalId = executeRes.body.approvalId;

    // Approve
    await request(app)
      .post(`/api/approvals/${approvalId}/decide`)
      .set(h)
      .send({ status: "approved" });

    // Dispatch in dry-run mode
    const dispatchRes = await request(app)
      .post(`/api/approvals/${approvalId}/dispatch`)
      .set(h)
      .send({ dryRun: true });
    expect(dispatchRes.status).toBe(200);

    // Dispatcher should have received dryRun=true in context
    expect(dispatchLog.length).toBeGreaterThan(0);
    expect(dispatchLog[0].context.dryRun).toBe(true);
  });

  it("double dispatch attempt → second returns 409", async () => {
    const app = buildApp({ dispatcher: createMockDispatcher() });
    const adminToken = await tokenFor(ADMIN);
    const h = { Authorization: `Bearer ${adminToken}`, "X-PuddleJumper-Request": "true" };

    const executeRes = await request(app)
      .post("/api/pj/execute")
      .set(h)
      .send({ mode: "execute", requestId: "e2e-double-1" });
    const approvalId = executeRes.body.approvalId;

    await request(app)
      .post(`/api/approvals/${approvalId}/decide`)
      .set(h)
      .send({ status: "approved" });

    // First dispatch
    const first = await request(app)
      .post(`/api/approvals/${approvalId}/dispatch`)
      .set(h)
      .send({});
    expect(first.status).toBe(200);
    expect(first.body.data.approvalStatus).toBe("dispatched");

    // Second dispatch attempt — already dispatched
    const second = await request(app)
      .post(`/api/approvals/${approvalId}/dispatch`)
      .set(h)
      .send({});
    expect(second.status).toBe(409);
    expect(second.body.error).toContain("dispatched");
  });

  it("RBAC: non-admin cannot approve or dispatch", async () => {
    const app = buildApp({ dispatcher: createMockDispatcher() });
    const adminToken = await tokenFor(ADMIN);
    const viewerToken = await tokenFor(VIEWER);

    // Admin creates approval
    const executeRes = await request(app)
      .post("/api/pj/execute")
      .set({ Authorization: `Bearer ${adminToken}`, "X-PuddleJumper-Request": "true" })
      .send({ mode: "execute", requestId: "e2e-rbac-1" });
    const approvalId = executeRes.body.approvalId;

    // Viewer cannot approve
    const decideRes = await request(app)
      .post(`/api/approvals/${approvalId}/decide`)
      .set({ Authorization: `Bearer ${viewerToken}`, "X-PuddleJumper-Request": "true" })
      .send({ status: "approved" });
    expect(decideRes.status).toBe(403);

    // Viewer cannot dispatch
    const dispatchRes = await request(app)
      .post(`/api/approvals/${approvalId}/dispatch`)
      .set({ Authorization: `Bearer ${viewerToken}`, "X-PuddleJumper-Request": "true" })
      .send({});
    expect(dispatchRes.status).toBe(403);
  });

  it("non-admin list shows only own approvals", async () => {
    const app = buildApp({ dispatcher: createMockDispatcher() });
    const adminToken = await tokenFor(ADMIN);
    const viewerToken = await tokenFor(VIEWER);

    // Admin creates approval (operator = admin-1)
    await request(app)
      .post("/api/pj/execute")
      .set({ Authorization: `Bearer ${adminToken}`, "X-PuddleJumper-Request": "true" })
      .send({ mode: "execute", requestId: "e2e-vis-1" });

    // Viewer lists — should NOT see admin's approval
    const listRes = await request(app)
      .get("/api/approvals")
      .set({ Authorization: `Bearer ${viewerToken}`, "X-PuddleJumper-Request": "true" });
    expect(listRes.status).toBe(200);
    // Viewer (viewer-1) shouldn't see admin-1's approval
    const viewerApprovals = listRes.body.data.approvals.filter((r: any) => r.operator_id === "admin-1");
    expect(viewerApprovals).toHaveLength(0);
  });

  it("consumeForDispatch CAS prevents concurrent dispatch", async () => {
    // Create and approve an approval directly
    const row = store.create({
      requestId: "cas-test-1",
      operatorId: "op1",
      workspaceId: "ws1",
      municipalityId: "m1",
      actionIntent: "deploy_policy",
      actionMode: "governed",
      planHash: "hash1",
      planSteps: [{ stepId: "s1", description: "x", requiresApproval: false, connector: "github", status: "ready", plan: {} }],
      auditRecord: {},
      decisionResult: {},
    });
    store.decide({ approvalId: row.id, approverId: "admin", status: "approved" });

    // Two concurrent consume attempts
    const results = await Promise.all([
      Promise.resolve(store.consumeForDispatch(row.id)),
      Promise.resolve(store.consumeForDispatch(row.id)),
    ]);

    // Exactly one should succeed
    const successes = results.filter((r) => r !== null);
    const failures = results.filter((r) => r === null);
    expect(successes).toHaveLength(1);
    expect(failures).toHaveLength(1);
    expect(successes[0]!.approval_status).toBe("dispatching");
  });

  it("prometheus() output includes HELP and TYPE lines", () => {
    // Simulate some activity
    approvalMetrics.increment(METRIC.APPROVALS_CREATED);
    approvalMetrics.increment(METRIC.APPROVALS_APPROVED);
    approvalMetrics.setGauge(METRIC.PENDING_GAUGE, 3);
    approvalMetrics.observe(METRIC.APPROVAL_TIME, 12.5);

    const output = approvalMetrics.prometheus(METRIC_HELP);

    // Must contain HELP + TYPE + values
    expect(output).toContain("# HELP approvals_created_total");
    expect(output).toContain("# TYPE approvals_created_total counter");
    expect(output).toContain("approvals_created_total 1");

    expect(output).toContain("# HELP approval_pending_gauge");
    expect(output).toContain("# TYPE approval_pending_gauge gauge");
    expect(output).toContain("approval_pending_gauge 3");

    expect(output).toContain("# HELP approval_time_seconds");
    expect(output).toContain("# TYPE approval_time_seconds histogram");
    expect(output).toContain("approval_time_seconds_count 1");
    expect(output).toContain("approval_time_seconds_sum 12.5");
    expect(output).toContain('approval_time_seconds_bucket{le="+Inf"} 1');
  });
});
