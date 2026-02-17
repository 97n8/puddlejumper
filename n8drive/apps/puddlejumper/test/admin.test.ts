import './setup-admin';

// ── Admin UI Tests ──────────────────────────────────────────────────────────
//
// Tests for the admin API endpoints and the admin HTML page serving.
//
// 1. GET /pj/admin — serves the admin HTML page
// 2. GET /api/admin/stats — aggregated operational metrics (admin only)
//
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import crypto from "node:crypto";
import express from "express";
import request from "supertest";
import { signJwt, cookieParserMiddleware, csrfProtection } from "@publiclogic/core";
import { ApprovalStore } from "../src/engine/approvalStore.js";
import { ChainStore, DEFAULT_TEMPLATE_ID } from "../src/engine/chainStore.js";
import { approvalMetrics, METRIC } from "../src/engine/approvalMetrics.js";
import { createAdminRoutes } from "../src/api/routes/admin.js";
import { createApprovalRoutes } from "../src/api/routes/approvals.js";
import {
  DispatcherRegistry,
  type ConnectorDispatcher,
  type PlanStepInput,
  type DispatchContext,
} from "../src/engine/dispatch.js";

// ── Fixtures ────────────────────────────────────────────────────────────────

let approvalStore: ApprovalStore;
let chainStore: ChainStore;
let registry: DispatcherRegistry;
let tmpDir: string;

const ADMIN = { sub: "admin-1", name: "Admin", role: "admin", permissions: ["deploy"], tenants: ["t1"], tenantId: "t1" };
const VIEWER = { sub: "viewer-1", name: "Viewer", role: "viewer", permissions: [], tenants: ["t1"], tenantId: "t1" };

async function tokenFor(user: Record<string, unknown>) {
  return signJwt(user, { expiresIn: "1h" });
}

function createMockDispatcher(): ConnectorDispatcher {
  return {
    connectorName: "github" as any,
    async dispatch(step: PlanStepInput, context: DispatchContext) {
      return {
        stepId: step.stepId,
        connector: step.connector,
        status: "dispatched" as const,
        result: { mock: true },
        completedAt: new Date().toISOString(),
      };
    },
    async healthCheck() { return { healthy: true }; },
  };
}

function buildApp() {
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

  // Mount admin routes
  app.use("/api", createAdminRoutes({ approvalStore, chainStore }));

  // Mount approval routes (for integration testing)
  app.use("/api", createApprovalRoutes({
    approvalStore, dispatcherRegistry: registry, nodeEnv: "test", chainStore,
  }));

  return app;
}

function createApproval(overrides: Record<string, unknown> = {}) {
  return approvalStore.create({
    requestId: overrides.requestId as string ?? `req-${crypto.randomUUID()}`,
    operatorId: overrides.operatorId as string ?? "admin-1",
    workspaceId: "ws-test",
    municipalityId: "muni-test",
    actionIntent: overrides.actionIntent as string ?? "deploy_policy",
    actionMode: "governed",
    planHash: "hash-" + crypto.randomUUID(),
    planSteps: [
      { stepId: "s1", description: "Test step", requiresApproval: false, connector: "github", status: "ready", plan: {} },
    ],
    auditRecord: { eventId: "evt-test", timestamp: new Date().toISOString() },
    decisionResult: { status: "approved", approved: true },
  });
}

// ── Setup / Teardown ────────────────────────────────────────────────────────

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "admin-test-"));
  approvalStore = new ApprovalStore(path.join(tmpDir, "approvals.db"));
  chainStore = new ChainStore(approvalStore.db);
  registry = new DispatcherRegistry();
  registry.register(createMockDispatcher());
  approvalMetrics.reset();
});

afterEach(() => {
  approvalStore.close();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

// ── Tests ───────────────────────────────────────────────────────────────────

describe("GET /api/admin/stats", () => {

  it("returns aggregated metrics for admin users", async () => {
    const app = buildApp();
    const token = await tokenFor(ADMIN);
    const h = { Authorization: `Bearer ${token}`, "X-PuddleJumper-Request": "true" };

    // Create some approvals to seed metrics
    const a1 = createApproval({ requestId: "r1", actionIntent: "deploy_policy" });
    const a2 = createApproval({ requestId: "r2", actionIntent: "update_config" });
    chainStore.createChainForApproval(a1.id);
    chainStore.createChainForApproval(a2.id);

    // Simulate some metrics
    approvalMetrics.increment(METRIC.APPROVALS_CREATED, 2);
    approvalMetrics.increment(METRIC.APPROVALS_APPROVED, 1);
    approvalMetrics.increment(METRIC.DISPATCH_SUCCESS, 1);
    approvalMetrics.observe(METRIC.APPROVAL_TIME, 120);
    approvalMetrics.observe(METRIC.DISPATCH_LATENCY, 2.5);

    const res = await request(app)
      .get("/api/admin/stats")
      .set(h)
      .expect(200);

    expect(res.body.success).toBe(true);
    const d = res.body.data;
    expect(d.pending).toBe(2);
    expect(d.approvalsCreated).toBe(2);
    expect(d.approvalsApproved).toBe(1);
    expect(d.dispatchSuccess).toBe(1);
    expect(d.avgApprovalTimeSec).toBe(120);
    expect(d.avgDispatchLatencySec).toBe(2.5);
    expect(d.activeChainSteps).toBe(2); // 2 chains, each with 1 active step
  });

  it("allows viewer read-only access to stats", async () => {
    const app = buildApp();
    const token = await tokenFor(VIEWER);
    const h = { Authorization: `Bearer ${token}`, "X-PuddleJumper-Request": "true" };

    const res = await request(app)
      .get("/api/admin/stats")
      .set(h)
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data.pending).toBeDefined();
  });

  it("rejects unauthenticated requests with 401", async () => {
    const app = buildApp();

    const res = await request(app)
      .get("/api/admin/stats")
      .set({ "X-PuddleJumper-Request": "true" })
      .expect(401);

    expect(res.body).toBeDefined();
  });

  it("returns zeros when no metrics exist", async () => {
    const app = buildApp();
    const token = await tokenFor(ADMIN);
    const h = { Authorization: `Bearer ${token}`, "X-PuddleJumper-Request": "true" };

    const res = await request(app)
      .get("/api/admin/stats")
      .set(h)
      .expect(200);

    const d = res.body.data;
    expect(d.pending).toBe(0);
    expect(d.approvalsCreated).toBe(0);
    expect(d.approvalsApproved).toBe(0);
    expect(d.approvalsRejected).toBe(0);
    expect(d.dispatchSuccess).toBe(0);
    expect(d.dispatchFailure).toBe(0);
    expect(d.dispatchRetry).toBe(0);
    expect(d.avgApprovalTimeSec).toBe(0);
    expect(d.avgDispatchLatencySec).toBe(0);
    expect(d.activeChainSteps).toBe(0);
  });

  it("computes averages correctly with multiple observations", async () => {
    const app = buildApp();
    const token = await tokenFor(ADMIN);
    const h = { Authorization: `Bearer ${token}`, "X-PuddleJumper-Request": "true" };

    // 3 observations: 60s, 120s, 180s → avg = 120s
    approvalMetrics.observe(METRIC.APPROVAL_TIME, 60);
    approvalMetrics.observe(METRIC.APPROVAL_TIME, 120);
    approvalMetrics.observe(METRIC.APPROVAL_TIME, 180);

    // 2 observations: 1s, 3s → avg = 2s
    approvalMetrics.observe(METRIC.DISPATCH_LATENCY, 1);
    approvalMetrics.observe(METRIC.DISPATCH_LATENCY, 3);

    const res = await request(app)
      .get("/api/admin/stats")
      .set(h)
      .expect(200);

    expect(res.body.data.avgApprovalTimeSec).toBe(120);
    expect(res.body.data.avgDispatchLatencySec).toBe(2);
  });
});

describe("Admin HTML page — via full createApp", () => {

  it("GET /pj/admin serves the admin HTML page", async () => {
    // Use the full createApp to verify wiring
    const dataDir = path.resolve(__dirname, "../data");
    fs.mkdirSync(dataDir, { recursive: true });
    process.env.CONNECTOR_STATE_SECRET = "test-admin-secret";

    const { createApp } = await import("../src/api/server.js");
    const app = createApp("test");

    const res = await request(app)
      .get("/pj/admin")
      .expect(200);

    expect(res.type).toMatch(/html/);
    expect(res.text).toContain("PuddleJumper");
    expect(res.text).toContain("Approval Queue");
    expect(res.text).toContain("Dashboard");
    expect(res.text).toContain("/api/admin/stats");
    expect(res.text).toContain("/api/approvals");
  });

  it("admin stats endpoint is accessible via full app", async () => {
    const dataDir = path.resolve(__dirname, "../data");
    fs.mkdirSync(dataDir, { recursive: true });
    process.env.CONNECTOR_STATE_SECRET = "test-admin-secret-2";

    const { createApp } = await import("../src/api/server.js");
    const app = createApp("test");

    const token = await tokenFor(ADMIN);

    const res = await request(app)
      .get("/api/admin/stats")
      .set({ Authorization: `Bearer ${token}`, "X-PuddleJumper-Request": "true" })
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty("pending");
    expect(res.body.data).toHaveProperty("approvalsCreated");
    expect(res.body.data).toHaveProperty("avgApprovalTimeSec");
  });
});

describe("Admin stats reflect chain state", () => {

  it("activeChainSteps counts only active steps", async () => {
    const app = buildApp();
    const token = await tokenFor(ADMIN);
    const h = { Authorization: `Bearer ${token}`, "X-PuddleJumper-Request": "true" };

    // Create a 3-step template
    const template = chainStore.createTemplate({
      name: "Three Step",
      steps: [
        { order: 0, requiredRole: "dept_head", label: "Dept Head" },
        { order: 1, requiredRole: "legal", label: "Legal" },
        { order: 2, requiredRole: "admin", label: "Admin" },
      ],
    });

    // Create two approvals with chains
    const a1 = createApproval({ requestId: "multi-1" });
    const a2 = createApproval({ requestId: "multi-2" });
    chainStore.createChainForApproval(a1.id, template.id);
    chainStore.createChainForApproval(a2.id, template.id);

    // Both have 1 active step (step 0)
    let res = await request(app).get("/api/admin/stats").set(h).expect(200);
    expect(res.body.data.activeChainSteps).toBe(2);

    // Approve step 0 for a1 → step 1 becomes active, still 2 total active
    const a1Steps = chainStore.getStepsForApproval(a1.id);
    chainStore.decideStep({ stepId: a1Steps[0].id, deciderId: "admin-1", status: "approved" });

    res = await request(app).get("/api/admin/stats").set(h).expect(200);
    expect(res.body.data.activeChainSteps).toBe(2); // a1 step 1 active, a2 step 0 active

    // Reject a2 → no more active steps for a2, only a1 has 1
    const a2Steps = chainStore.getStepsForApproval(a2.id);
    chainStore.decideStep({ stepId: a2Steps[0].id, deciderId: "admin-1", status: "rejected" });

    res = await request(app).get("/api/admin/stats").set(h).expect(200);
    expect(res.body.data.activeChainSteps).toBe(1); // only a1 step 1 active
  });
});
