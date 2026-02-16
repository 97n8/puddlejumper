// ── Chain Integration Tests ─────────────────────────────────────────────────
//
// Tests the wired chain lifecycle: approval creation → chain created →
// decide chain steps via API → parent approval transitions → dispatch.
//
// These tests exercise the REAL approval + chain routes with a mock connector.
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
import {
  DispatcherRegistry,
  type ConnectorDispatcher,
  type PlanStepInput,
  type DispatchContext,
} from "../src/engine/dispatch.js";
import { createApprovalRoutes } from "../src/api/routes/approvals.js";
import { createWebhookActionRoutes } from "../src/api/routes/webhookAction.js";

// ── Fixtures ────────────────────────────────────────────────────────────────

let approvalStore: ApprovalStore;
let chainStore: ChainStore;
let registry: DispatcherRegistry;
let tmpDir: string;
let dispatchLog: Array<{ step: PlanStepInput; context: DispatchContext }>;

const ADMIN = { sub: "admin-1", name: "Admin", role: "admin", permissions: ["deploy"], tenants: ["t1"], tenantId: "t1" };
const REVIEWER = { sub: "reviewer-1", name: "Reviewer", role: "admin", permissions: ["deploy"], tenants: ["t1"], tenantId: "t1" };
const VIEWER = { sub: "viewer-1", name: "Viewer", role: "viewer", permissions: [], tenants: ["t1"], tenantId: "t1" };

async function tokenFor(user: Record<string, unknown>) {
  return signJwt(user, { expiresIn: "1h" });
}

function createMockDispatcher(): ConnectorDispatcher {
  return {
    connectorName: "github" as any,
    async dispatch(step, context) {
      dispatchLog.push({ step, context });
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

/** Build test app with approval + chain routes wired together. */
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

  // Gate endpoint — simulates governance execute → 202 with chain creation
  app.post("/api/pj/execute", (req: any, res: any) => {
    const auth = req.auth;
    if (!auth) { res.status(401).json({ error: "Unauthorized" }); return; }

    const requestId = req.body.requestId ?? `chain-e2e-${crypto.randomUUID()}`;
    const templateId = req.body.templateId;

    const approval = approvalStore.create({
      requestId,
      operatorId: auth.sub,
      workspaceId: "ws-chain",
      municipalityId: "muni-chain",
      actionIntent: "deploy_policy",
      actionMode: "governed",
      planHash: "hash-" + requestId,
      planSteps: [
        { stepId: "s1", description: "Create branch", requiresApproval: false, connector: "github", status: "ready", plan: { repo: "test/repo", branch: "gov/deploy" } },
      ],
      auditRecord: { eventId: `evt-${requestId}`, timestamp: new Date().toISOString() },
      decisionResult: { status: "approved", approved: true },
    });

    // Wire: create chain for this approval
    chainStore.createChainForApproval(approval.id, templateId);

    res.status(202).json({
      success: true,
      approvalRequired: true,
      approvalId: approval.id,
      approvalStatus: "pending",
    });
  });

  // Mount approval routes with chainStore
  app.use("/api", createApprovalRoutes({
    approvalStore, dispatcherRegistry: registry, nodeEnv: "test", chainStore,
  }));

  // Mount webhook action routes with chainStore
  app.use("/api", createWebhookActionRoutes({
    approvalStore, dispatcherRegistry: registry, chainStore,
  }));

  return app;
}

// ── Setup / Teardown ────────────────────────────────────────────────────────

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "chain-integ-test-"));
  approvalStore = new ApprovalStore(path.join(tmpDir, "approvals.db"));
  chainStore = new ChainStore(approvalStore.db);
  registry = new DispatcherRegistry();
  registry.register(createMockDispatcher());
  dispatchLog = [];
});

afterEach(() => {
  approvalStore.close();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

// ── Tests ───────────────────────────────────────────────────────────────────

describe("Chain integration — single-step (default template)", () => {

  it("creates chain on approval, approves step, parent becomes approved", async () => {
    const app = buildApp();
    const adminToken = await tokenFor(ADMIN);
    const h = { Authorization: `Bearer ${adminToken}`, "X-PuddleJumper-Request": "true" };

    // Step 1: Create governed action → 202
    const execRes = await request(app)
      .post("/api/pj/execute")
      .set(h)
      .send({ requestId: "chain-single-1" });
    expect(execRes.status).toBe(202);
    const approvalId = execRes.body.approvalId;

    // Step 2: Verify chain was created
    const chainRes = await request(app)
      .get(`/api/approvals/${approvalId}/chain`)
      .set(h);
    expect(chainRes.status).toBe(200);
    expect(chainRes.body.success).toBe(true);
    expect(chainRes.body.data.totalSteps).toBe(1);
    expect(chainRes.body.data.completedSteps).toBe(0);
    expect(chainRes.body.data.currentStep).toBeTruthy();
    expect(chainRes.body.data.currentStep.status).toBe("active");
    expect(chainRes.body.data.allApproved).toBe(false);

    // Step 3: Decide via approval route (chain-aware)
    const decideRes = await request(app)
      .post(`/api/approvals/${approvalId}/decide`)
      .set(h)
      .send({ status: "approved", note: "LGTM" });
    expect(decideRes.status).toBe(200);
    expect(decideRes.body.success).toBe(true);
    // Parent approval should now be "approved" (single-step chain complete)
    expect(decideRes.body.data.approval_status).toBe("approved");

    // Step 4: Verify chain is fully approved
    const chain2 = await request(app)
      .get(`/api/approvals/${approvalId}/chain`)
      .set(h);
    expect(chain2.body.data.allApproved).toBe(true);
    expect(chain2.body.data.completedSteps).toBe(1);

    // Step 5: Dispatch
    const dispatchRes = await request(app)
      .post(`/api/approvals/${approvalId}/dispatch`)
      .set(h)
      .send({});
    expect(dispatchRes.status).toBe(200);
    expect(dispatchRes.body.success).toBe(true);
    expect(dispatchLog.length).toBe(1);
  });

  it("rejects chain step → parent becomes rejected", async () => {
    const app = buildApp();
    const adminToken = await tokenFor(ADMIN);
    const h = { Authorization: `Bearer ${adminToken}`, "X-PuddleJumper-Request": "true" };

    const execRes = await request(app)
      .post("/api/pj/execute")
      .set(h)
      .send({ requestId: "chain-reject-1" });
    const approvalId = execRes.body.approvalId;

    // Reject the chain step
    const decideRes = await request(app)
      .post(`/api/approvals/${approvalId}/decide`)
      .set(h)
      .send({ status: "rejected", note: "Not approved" });
    expect(decideRes.status).toBe(200);
    expect(decideRes.body.data.approval_status).toBe("rejected");

    // Chain should show rejected
    const chainRes = await request(app)
      .get(`/api/approvals/${approvalId}/chain`)
      .set(h);
    expect(chainRes.body.data.rejected).toBe(true);
    expect(chainRes.body.data.allApproved).toBe(false);
  });
});

describe("Chain integration — multi-step template", () => {

  it("multi-step: approve step 1 → advances → approve step 2 → parent approved", async () => {
    // Create a 2-step template
    const twoStepTemplate = chainStore.createTemplate({
      id: "two-step-review",
      name: "Two-Step Review",
      description: "Requires reviewer then admin approval",
      steps: [
        { order: 0, requiredRole: "admin", label: "Reviewer Approval" },
        { order: 1, requiredRole: "admin", label: "Final Admin Approval" },
      ],
    });

    const app = buildApp();
    const adminToken = await tokenFor(ADMIN);
    const reviewerToken = await tokenFor(REVIEWER);
    const h = { Authorization: `Bearer ${adminToken}`, "X-PuddleJumper-Request": "true" };
    const hReviewer = { Authorization: `Bearer ${reviewerToken}`, "X-PuddleJumper-Request": "true" };

    // Create approval with 2-step template
    const execRes = await request(app)
      .post("/api/pj/execute")
      .set(h)
      .send({ requestId: "chain-multi-1", templateId: twoStepTemplate.id });
    const approvalId = execRes.body.approvalId;

    // Verify chain has 2 steps
    const chain1 = await request(app)
      .get(`/api/approvals/${approvalId}/chain`)
      .set(h);
    expect(chain1.body.data.totalSteps).toBe(2);
    expect(chain1.body.data.completedSteps).toBe(0);
    expect(chain1.body.data.currentStep.label).toBe("Reviewer Approval");

    // Approve step 1 — should advance, NOT approve parent
    const decide1 = await request(app)
      .post(`/api/approvals/${approvalId}/decide`)
      .set(hReviewer)
      .send({ status: "approved", note: "Step 1 OK" });
    expect(decide1.status).toBe(200);
    expect(decide1.body.success).toBe(true);
    // Parent still pending (step 2 awaits)
    expect(decide1.body.data.approval_status).toBe("pending");
    expect(decide1.body.data.chainAdvanced).toBe(true);

    // Verify chain progress
    const chain2 = await request(app)
      .get(`/api/approvals/${approvalId}/chain`)
      .set(h);
    expect(chain2.body.data.completedSteps).toBe(1);
    expect(chain2.body.data.currentStep.label).toBe("Final Admin Approval");

    // Approve step 2 — chain complete, parent approved
    const decide2 = await request(app)
      .post(`/api/approvals/${approvalId}/decide`)
      .set(h)
      .send({ status: "approved", note: "Final OK" });
    expect(decide2.status).toBe(200);
    expect(decide2.body.data.approval_status).toBe("approved");

    // Dispatch
    const dispatchRes = await request(app)
      .post(`/api/approvals/${approvalId}/dispatch`)
      .set(h)
      .send({});
    expect(dispatchRes.status).toBe(200);
    expect(dispatchRes.body.success).toBe(true);
  });

  it("multi-step: reject at step 2 → parent rejected, remaining skipped", async () => {
    chainStore.createTemplate({
      id: "three-step",
      name: "Three-Step",
      steps: [
        { order: 0, requiredRole: "admin", label: "Step 1" },
        { order: 1, requiredRole: "admin", label: "Step 2" },
        { order: 2, requiredRole: "admin", label: "Step 3" },
      ],
    });

    const app = buildApp();
    const adminToken = await tokenFor(ADMIN);
    const h = { Authorization: `Bearer ${adminToken}`, "X-PuddleJumper-Request": "true" };

    const execRes = await request(app)
      .post("/api/pj/execute")
      .set(h)
      .send({ requestId: "chain-reject-multi", templateId: "three-step" });
    const approvalId = execRes.body.approvalId;

    // Approve step 1
    await request(app)
      .post(`/api/approvals/${approvalId}/decide`)
      .set(h)
      .send({ status: "approved" });

    // Reject step 2
    const decide2 = await request(app)
      .post(`/api/approvals/${approvalId}/decide`)
      .set(h)
      .send({ status: "rejected", note: "Blocked" });
    expect(decide2.status).toBe(200);
    expect(decide2.body.data.approval_status).toBe("rejected");

    // Chain should show step 3 skipped
    const chainRes = await request(app)
      .get(`/api/approvals/${approvalId}/chain`)
      .set(h);
    expect(chainRes.body.data.rejected).toBe(true);
    const steps = chainRes.body.data.steps;
    expect(steps[0].status).toBe("approved");
    expect(steps[1].status).toBe("rejected");
    expect(steps[2].status).toBe("skipped");
  });
});

describe("Chain integration — chain progress API", () => {

  it("GET /api/approvals/:id/chain returns 404 for unknown approval", async () => {
    const app = buildApp();
    const adminToken = await tokenFor(ADMIN);
    const h = { Authorization: `Bearer ${adminToken}`, "X-PuddleJumper-Request": "true" };

    const res = await request(app)
      .get("/api/approvals/nonexistent/chain")
      .set(h);
    expect(res.status).toBe(404);
  });

  it("viewer can access chain endpoint (read-only)", async () => {
    const app = buildApp();
    const viewerToken = await tokenFor(VIEWER);
    const adminToken = await tokenFor(ADMIN);

    // Create approval as admin
    const execRes = await request(app)
      .post("/api/pj/execute")
      .set({ Authorization: `Bearer ${adminToken}`, "X-PuddleJumper-Request": "true" })
      .send({ requestId: "chain-viewer-1" });
    const approvalId = execRes.body.approvalId;

    // Viewer can now access chain endpoint (read-only)
    const res = await request(app)
      .get(`/api/approvals/${approvalId}/chain`)
      .set({ Authorization: `Bearer ${viewerToken}`, "X-PuddleJumper-Request": "true" });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});

describe("Chain integration — webhook action", () => {

  it("governed webhook creates chain alongside approval", async () => {
    const app = buildApp();
    const adminToken = await tokenFor(ADMIN);
    const h = { Authorization: `Bearer ${adminToken}`, "X-PuddleJumper-Request": "true" };

    const res = await request(app)
      .post("/api/pj/actions/webhook")
      .set(h)
      .send({
        mode: "governed",
        action: {
          type: "webhook",
          url: "https://example.com/hook",
          method: "POST",
          body: { test: true },
        },
      });
    expect(res.status).toBe(202);
    const approvalId = res.body.approvalId;
    expect(approvalId).toBeTruthy();

    // Chain should exist
    const chainRes = await request(app)
      .get(`/api/approvals/${approvalId}/chain`)
      .set(h);
    expect(chainRes.status).toBe(200);
    expect(chainRes.body.data.totalSteps).toBe(1);
    expect(chainRes.body.data.currentStep.status).toBe("active");
  });
});

describe("Chain integration — backward compatibility", () => {

  it("decide still works for approvals without chains (legacy fallback)", async () => {
    const app = buildApp();
    const adminToken = await tokenFor(ADMIN);
    const h = { Authorization: `Bearer ${adminToken}`, "X-PuddleJumper-Request": "true" };

    // Create approval directly (without chain) — simulates legacy approval
    const approval = approvalStore.create({
      requestId: "legacy-no-chain-1",
      operatorId: "admin-1",
      workspaceId: "ws-legacy",
      municipalityId: "muni-legacy",
      actionIntent: "deploy_policy",
      actionMode: "governed",
      planHash: "hash-legacy",
      planSteps: [{ stepId: "s1", description: "Deploy", requiresApproval: false, connector: "github", status: "ready", plan: {} }],
      auditRecord: {},
      decisionResult: { status: "approved", approved: true },
    });

    // Decide (no chain exists) — should fall back to direct decide
    const decideRes = await request(app)
      .post(`/api/approvals/${approval.id}/decide`)
      .set(h)
      .send({ status: "approved", note: "Legacy OK" });
    expect(decideRes.status).toBe(200);
    expect(decideRes.body.data.approval_status).toBe("approved");

    // Chain endpoint returns 404 (no chain)
    const chainRes = await request(app)
      .get(`/api/approvals/${approval.id}/chain`)
      .set(h);
    expect(chainRes.status).toBe(404);
  });
});

describe("role-gated chain step authorization", () => {

  it("admin can decide any step regardless of requiredRole", async () => {
    const app = buildApp();
    const adminToken = await tokenFor(ADMIN);
    const h = { Authorization: `Bearer ${adminToken}`, "X-PuddleJumper-Request": "true" };

    // Create a chain template with legal_reviewer requirement
    const template = chainStore.createTemplate({
      name: "Legal Review",
      description: "Requires legal reviewer",
      steps: [
        { order: 0, requiredRole: "legal_reviewer", label: "Legal Review" },
      ],
    });

    // Create approval with this chain
    const execRes = await request(app)
      .post("/api/pj/execute")
      .set(h)
      .send({ requestId: "role-admin-test", templateId: template.id });
    const approvalId = execRes.body.approvalId;

    // Admin should be able to decide despite step requiring legal_reviewer
    const decideRes = await request(app)
      .post(`/api/approvals/${approvalId}/decide`)
      .set(h)
      .send({ status: "approved", note: "Admin override" });
    expect(decideRes.status).toBe(200);
    expect(decideRes.body.success).toBe(true);
  });

  it("matching role can decide their step", async () => {
    const app = buildApp();
    const deptHeadToken = await tokenFor({ sub: "dept-head-1", name: "Dept Head", role: "dept_head", permissions: [], tenants: ["t1"], tenantId: "t1" });
    const h = { Authorization: `Bearer ${deptHeadToken}`, "X-PuddleJumper-Request": "true" };

    // Create a chain template with dept_head requirement
    const template = chainStore.createTemplate({
      name: "Department Head Review",
      description: "Requires department head",
      steps: [
        { order: 0, requiredRole: "dept_head", label: "Dept Head Review" },
      ],
    });

    // Create approval with this chain (as admin first)
    const adminToken = await tokenFor(ADMIN);
    const execRes = await request(app)
      .post("/api/pj/execute")
      .set({ Authorization: `Bearer ${adminToken}`, "X-PuddleJumper-Request": "true" })
      .send({ requestId: "role-match-test", templateId: template.id });
    const approvalId = execRes.body.approvalId;

    // dept_head should be able to decide their step
    const decideRes = await request(app)
      .post(`/api/approvals/${approvalId}/decide`)
      .set(h)
      .send({ status: "approved", note: "Dept head approval" });
    expect(decideRes.status).toBe(200);
    expect(decideRes.body.success).toBe(true);
  });

  it("mismatched role gets 403", async () => {
    const app = buildApp();
    const deptHeadToken = await tokenFor({ sub: "dept-head-1", name: "Dept Head", role: "dept_head", permissions: [], tenants: ["t1"], tenantId: "t1" });
    const h = { Authorization: `Bearer ${deptHeadToken}`, "X-PuddleJumper-Request": "true" };

    // Create a chain template with legal_reviewer requirement
    const template = chainStore.createTemplate({
      name: "Legal Review",
      description: "Requires legal reviewer",
      steps: [
        { order: 0, requiredRole: "legal_reviewer", label: "Legal Review" },
      ],
    });

    // Create approval with this chain (as admin first)
    const adminToken = await tokenFor(ADMIN);
    const execRes = await request(app)
      .post("/api/pj/execute")
      .set({ Authorization: `Bearer ${adminToken}`, "X-PuddleJumper-Request": "true" })
      .send({ requestId: "role-mismatch-test", templateId: template.id });
    const approvalId = execRes.body.approvalId;

    // dept_head should get 403 when trying to decide legal_reviewer step
    const decideRes = await request(app)
      .post(`/api/approvals/${approvalId}/decide`)
      .set(h)
      .send({ status: "approved", note: "Trying to approve" });
    expect(decideRes.status).toBe(403);
    expect(decideRes.body.success).toBe(false);
    expect(decideRes.body.error).toContain("dept_head");
    expect(decideRes.body.error).toContain("legal_reviewer");
  });

  it("viewer role gets 403", async () => {
    const app = buildApp();
    const viewerToken = await tokenFor(VIEWER);
    const h = { Authorization: `Bearer ${viewerToken}`, "X-PuddleJumper-Request": "true" };

    // Create a chain template with admin requirement
    const template = chainStore.createTemplate({
      name: "Admin Review",
      description: "Requires admin",
      steps: [
        { order: 0, requiredRole: "admin", label: "Admin Review" },
      ],
    });

    // Create approval with this chain (as admin first)
    const adminToken = await tokenFor(ADMIN);
    const execRes = await request(app)
      .post("/api/pj/execute")
      .set({ Authorization: `Bearer ${adminToken}`, "X-PuddleJumper-Request": "true" })
      .send({ requestId: "role-viewer-test", templateId: template.id });
    const approvalId = execRes.body.approvalId;

    // viewer should get 403 (blocked by existing check at line 111)
    const decideRes = await request(app)
      .post(`/api/approvals/${approvalId}/decide`)
      .set(h)
      .send({ status: "approved", note: "Trying to approve" });
    expect(decideRes.status).toBe(403);
    expect(decideRes.body.success).toBe(false);
  });

  it("role check only applies to active step", async () => {
    const app = buildApp();
    const deptHeadToken = await tokenFor({ sub: "dept-head-1", name: "Dept Head", role: "dept_head", permissions: [], tenants: ["t1"], tenantId: "t1" });
    const deptHeadH = { Authorization: `Bearer ${deptHeadToken}`, "X-PuddleJumper-Request": "true" };

    // Create a 2-step chain
    const template = chainStore.createTemplate({
      name: "Two Step Review",
      description: "Department head then legal",
      steps: [
        { order: 0, requiredRole: "dept_head", label: "Dept Head Review" },
        { order: 1, requiredRole: "legal_reviewer", label: "Legal Review" },
      ],
    });

    // Create approval with this chain (as admin)
    const adminToken = await tokenFor(ADMIN);
    const execRes = await request(app)
      .post("/api/pj/execute")
      .set({ Authorization: `Bearer ${adminToken}`, "X-PuddleJumper-Request": "true" })
      .send({ requestId: "role-progression-test", templateId: template.id });
    const approvalId = execRes.body.approvalId;

    // Step 1: dept_head decides first step (should succeed)
    const decide1Res = await request(app)
      .post(`/api/approvals/${approvalId}/decide`)
      .set(deptHeadH)
      .send({ status: "approved", note: "Dept head approval" });
    expect(decide1Res.status).toBe(200);
    expect(decide1Res.body.success).toBe(true);

    // Verify second step is now active (use admin token for chain visibility)
    const chainRes = await request(app)
      .get(`/api/approvals/${approvalId}/chain`)
      .set({ Authorization: `Bearer ${adminToken}`, "X-PuddleJumper-Request": "true" });
    expect(chainRes.status).toBe(200);
    expect(chainRes.body.data.currentStep.requiredRole).toBe("legal_reviewer");

    // Step 2: dept_head tries to decide second step (should get 403)
    const decide2Res = await request(app)
      .post(`/api/approvals/${approvalId}/decide`)
      .set(deptHeadH)
      .send({ status: "approved", note: "Trying to approve legal step" });
    expect(decide2Res.status).toBe(403);
    expect(decide2Res.body.success).toBe(false);
    expect(decide2Res.body.error).toContain("dept_head");
    expect(decide2Res.body.error).toContain("legal_reviewer");
  });

  it("admin override on second step", async () => {
    const app = buildApp();
    const deptHeadToken = await tokenFor({ sub: "dept-head-1", name: "Dept Head", role: "dept_head", permissions: [], tenants: ["t1"], tenantId: "t1" });
    const deptHeadH = { Authorization: `Bearer ${deptHeadToken}`, "X-PuddleJumper-Request": "true" };
    const adminToken = await tokenFor(ADMIN);
    const adminH = { Authorization: `Bearer ${adminToken}`, "X-PuddleJumper-Request": "true" };

    // Create a 2-step chain
    const template = chainStore.createTemplate({
      name: "Two Step Review",
      description: "Department head then legal",
      steps: [
        { order: 0, requiredRole: "dept_head", label: "Dept Head Review" },
        { order: 1, requiredRole: "legal_reviewer", label: "Legal Review" },
      ],
    });

    // Create approval with this chain
    const execRes = await request(app)
      .post("/api/pj/execute")
      .set(adminH)
      .send({ requestId: "role-admin-override-test", templateId: template.id });
    const approvalId = execRes.body.approvalId;

    // Step 1: dept_head decides first step
    const decide1Res = await request(app)
      .post(`/api/approvals/${approvalId}/decide`)
      .set(deptHeadH)
      .send({ status: "approved", note: "Dept head approval" });
    expect(decide1Res.status).toBe(200);

    // Step 2: admin decides second step (should succeed even though it requires legal_reviewer)
    const decide2Res = await request(app)
      .post(`/api/approvals/${approvalId}/decide`)
      .set(adminH)
      .send({ status: "approved", note: "Admin override on legal step" });
    expect(decide2Res.status).toBe(200);
    expect(decide2Res.body.success).toBe(true);
    expect(decide2Res.body.data.approval_status).toBe("approved");
  });
});
