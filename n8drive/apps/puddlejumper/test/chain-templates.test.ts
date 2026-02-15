// ── Template Management API Tests ───────────────────────────────────────────
//
// CRUD operations for chain templates via HTTP, plus template selection
// at approval creation time, and chain summary enrichment on approval list.
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
import { createChainTemplateRoutes } from "../src/api/routes/chainTemplates.js";
import { createWebhookActionRoutes } from "../src/api/routes/webhookAction.js";

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
    async dispatch(step, context) {
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

  // Gate endpoint — simulates governance execute → 202 with template selection
  app.post("/api/pj/execute", (req: any, res: any) => {
    const auth = req.auth;
    if (!auth) { res.status(401).json({ error: "Unauthorized" }); return; }

    const requestId = req.body.requestId ?? `tmpl-e2e-${crypto.randomUUID()}`;
    const templateId = req.body.templateId;

    const approval = approvalStore.create({
      requestId,
      operatorId: auth.sub,
      workspaceId: "ws-tmpl",
      municipalityId: "muni-tmpl",
      actionIntent: req.body.actionIntent ?? "deploy_policy",
      actionMode: "governed",
      planHash: "hash-" + requestId,
      planSteps: [
        { stepId: "s1", description: "Deploy", requiresApproval: false, connector: "github", status: "ready", plan: {} },
      ],
      auditRecord: { eventId: `evt-${requestId}`, timestamp: new Date().toISOString() },
      decisionResult: { status: "approved", approved: true },
    });

    // Wire: create chain with template selection
    chainStore.createChainForApproval(approval.id, templateId);

    res.status(202).json({
      success: true,
      approvalRequired: true,
      approvalId: approval.id,
      approvalStatus: "pending",
    });
  });

  app.use("/api", createChainTemplateRoutes({ chainStore }));
  app.use("/api", createApprovalRoutes({
    approvalStore, dispatcherRegistry: registry, nodeEnv: "test", chainStore,
  }));
  app.use("/api", createWebhookActionRoutes({
    approvalStore, dispatcherRegistry: registry, chainStore,
  }));

  return app;
}

// ── Setup / Teardown ────────────────────────────────────────────────────────

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "tmpl-api-test-"));
  approvalStore = new ApprovalStore(path.join(tmpDir, "approvals.db"));
  chainStore = new ChainStore(approvalStore.db);
  registry = new DispatcherRegistry();
  registry.register(createMockDispatcher());
});

afterEach(() => {
  approvalStore.close();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

// ── Template CRUD ───────────────────────────────────────────────────────────

describe("Template management API — CRUD", () => {

  it("lists templates (default template always present)", async () => {
    const app = buildApp();
    const adminToken = await tokenFor(ADMIN);
    const h = { Authorization: `Bearer ${adminToken}`, "X-PuddleJumper-Request": "true" };

    const res = await request(app).get("/api/chain-templates").set(h);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    const def = res.body.data.find((t: any) => t.id === DEFAULT_TEMPLATE_ID);
    expect(def).toBeTruthy();
    expect(def.name).toBe("Single Admin Approval");
  });

  it("creates a custom template", async () => {
    const app = buildApp();
    const adminToken = await tokenFor(ADMIN);
    const h = { Authorization: `Bearer ${adminToken}`, "X-PuddleJumper-Request": "true" };

    const res = await request(app)
      .post("/api/chain-templates")
      .set(h)
      .send({
        name: "Legal + Admin Review",
        description: "Two-step: legal then admin",
        steps: [
          { order: 0, requiredRole: "admin", label: "Legal Review" },
          { order: 1, requiredRole: "admin", label: "Admin Sign-off" },
        ],
      });
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBeTruthy();
    expect(res.body.data.name).toBe("Legal + Admin Review");
    expect(res.body.data.steps).toHaveLength(2);
  });

  it("creates template with explicit id", async () => {
    const app = buildApp();
    const adminToken = await tokenFor(ADMIN);
    const h = { Authorization: `Bearer ${adminToken}`, "X-PuddleJumper-Request": "true" };

    const res = await request(app)
      .post("/api/chain-templates")
      .set(h)
      .send({
        id: "my-custom-id",
        name: "Custom ID Template",
        steps: [{ order: 0, requiredRole: "admin", label: "Step 1" }],
      });
    expect(res.status).toBe(201);
    expect(res.body.data.id).toBe("my-custom-id");
  });

  it("gets a single template by id", async () => {
    const app = buildApp();
    const adminToken = await tokenFor(ADMIN);
    const h = { Authorization: `Bearer ${adminToken}`, "X-PuddleJumper-Request": "true" };

    const res = await request(app).get(`/api/chain-templates/${DEFAULT_TEMPLATE_ID}`).set(h);
    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(DEFAULT_TEMPLATE_ID);
  });

  it("returns 404 for unknown template", async () => {
    const app = buildApp();
    const adminToken = await tokenFor(ADMIN);
    const h = { Authorization: `Bearer ${adminToken}`, "X-PuddleJumper-Request": "true" };

    const res = await request(app).get("/api/chain-templates/nonexistent").set(h);
    expect(res.status).toBe(404);
  });

  it("updates a template (name, description, steps)", async () => {
    const app = buildApp();
    const adminToken = await tokenFor(ADMIN);
    const h = { Authorization: `Bearer ${adminToken}`, "X-PuddleJumper-Request": "true" };

    // Create first
    const createRes = await request(app)
      .post("/api/chain-templates")
      .set(h)
      .send({
        name: "Original Name",
        steps: [{ order: 0, requiredRole: "admin", label: "Step 1" }],
      });
    const id = createRes.body.data.id;

    // Update
    const updateRes = await request(app)
      .put(`/api/chain-templates/${id}`)
      .set(h)
      .send({
        name: "Updated Name",
        description: "Updated desc",
        steps: [
          { order: 0, requiredRole: "admin", label: "New Step 1" },
          { order: 1, requiredRole: "admin", label: "New Step 2" },
        ],
      });
    expect(updateRes.status).toBe(200);
    expect(updateRes.body.data.name).toBe("Updated Name");
    expect(updateRes.body.data.description).toBe("Updated desc");
    expect(updateRes.body.data.steps).toHaveLength(2);
  });

  it("cannot update default template", async () => {
    const app = buildApp();
    const adminToken = await tokenFor(ADMIN);
    const h = { Authorization: `Bearer ${adminToken}`, "X-PuddleJumper-Request": "true" };

    const res = await request(app)
      .put(`/api/chain-templates/${DEFAULT_TEMPLATE_ID}`)
      .set(h)
      .send({
        name: "Hacked Default",
        steps: [{ order: 0, requiredRole: "admin", label: "Step 1" }],
      });
    expect(res.status).toBe(403);
  });

  it("deletes a template", async () => {
    const app = buildApp();
    const adminToken = await tokenFor(ADMIN);
    const h = { Authorization: `Bearer ${adminToken}`, "X-PuddleJumper-Request": "true" };

    // Create
    const createRes = await request(app)
      .post("/api/chain-templates")
      .set(h)
      .send({
        name: "Deletable",
        steps: [{ order: 0, requiredRole: "admin", label: "Step 1" }],
      });
    const id = createRes.body.data.id;

    // Delete
    const delRes = await request(app).delete(`/api/chain-templates/${id}`).set(h);
    expect(delRes.status).toBe(200);

    // Confirm gone
    const getRes = await request(app).get(`/api/chain-templates/${id}`).set(h);
    expect(getRes.status).toBe(404);
  });

  it("cannot delete default template", async () => {
    const app = buildApp();
    const adminToken = await tokenFor(ADMIN);
    const h = { Authorization: `Bearer ${adminToken}`, "X-PuddleJumper-Request": "true" };

    const res = await request(app).delete(`/api/chain-templates/${DEFAULT_TEMPLATE_ID}`).set(h);
    expect(res.status).toBe(403);
  });

  it("cannot delete template in use by active chains", async () => {
    const app = buildApp();
    const adminToken = await tokenFor(ADMIN);
    const h = { Authorization: `Bearer ${adminToken}`, "X-PuddleJumper-Request": "true" };

    // Create template
    const createRes = await request(app)
      .post("/api/chain-templates")
      .set(h)
      .send({
        id: "in-use-tmpl",
        name: "In Use",
        steps: [{ order: 0, requiredRole: "admin", label: "Step 1" }],
      });

    // Create approval with that template
    await request(app)
      .post("/api/pj/execute")
      .set(h)
      .send({ requestId: "tmpl-in-use-1", templateId: "in-use-tmpl" });

    // Try delete — should be blocked
    const delRes = await request(app).delete("/api/chain-templates/in-use-tmpl").set(h);
    expect(delRes.status).toBe(409);
  });
});

describe("Template management API — validation", () => {

  it("rejects template with no steps", async () => {
    const app = buildApp();
    const adminToken = await tokenFor(ADMIN);
    const h = { Authorization: `Bearer ${adminToken}`, "X-PuddleJumper-Request": "true" };

    const res = await request(app)
      .post("/api/chain-templates")
      .set(h)
      .send({ name: "Empty", steps: [] });
    expect(res.status).toBe(400);
  });

  it("rejects template with missing name", async () => {
    const app = buildApp();
    const adminToken = await tokenFor(ADMIN);
    const h = { Authorization: `Bearer ${adminToken}`, "X-PuddleJumper-Request": "true" };

    const res = await request(app)
      .post("/api/chain-templates")
      .set(h)
      .send({ steps: [{ order: 0, requiredRole: "admin", label: "Step 1" }] });
    expect(res.status).toBe(400);
  });

  it("rejects template with non-sequential step orders", async () => {
    const app = buildApp();
    const adminToken = await tokenFor(ADMIN);
    const h = { Authorization: `Bearer ${adminToken}`, "X-PuddleJumper-Request": "true" };

    const res = await request(app)
      .post("/api/chain-templates")
      .set(h)
      .send({
        name: "Bad Orders",
        steps: [
          { order: 0, requiredRole: "admin", label: "Step 1" },
          { order: 5, requiredRole: "admin", label: "Step 2" },
        ],
      });
    expect(res.status).toBe(400);
  });

  it("viewers can list templates but cannot create", async () => {
    const app = buildApp();
    const viewerToken = await tokenFor(VIEWER);
    const h = { Authorization: `Bearer ${viewerToken}`, "X-PuddleJumper-Request": "true" };

    // Viewers can read templates (read-only access)
    const listRes = await request(app).get("/api/chain-templates").set(h);
    expect(listRes.status).toBe(200);
    expect(listRes.body.success).toBe(true);

    // But cannot create templates (mutation — admin only)
    const createRes = await request(app)
      .post("/api/chain-templates")
      .set(h)
      .send({ name: "Test", steps: [{ order: 0, requiredRole: "admin", label: "S" }] });
    expect(createRes.status).toBe(403);
  });
});

describe("Template selection at approval creation", () => {

  it("explicit templateId selects custom template for chain", async () => {
    const app = buildApp();
    const adminToken = await tokenFor(ADMIN);
    const h = { Authorization: `Bearer ${adminToken}`, "X-PuddleJumper-Request": "true" };

    // Create a 2-step template
    await request(app)
      .post("/api/chain-templates")
      .set(h)
      .send({
        id: "two-step-select",
        name: "Two Step",
        steps: [
          { order: 0, requiredRole: "admin", label: "Review" },
          { order: 1, requiredRole: "admin", label: "Final" },
        ],
      });

    // Create approval with that template
    const execRes = await request(app)
      .post("/api/pj/execute")
      .set(h)
      .send({ requestId: "select-tmpl-1", templateId: "two-step-select" });
    const approvalId = execRes.body.approvalId;

    // Chain should have 2 steps from the selected template
    const chainRes = await request(app)
      .get(`/api/approvals/${approvalId}/chain`)
      .set(h);
    expect(chainRes.body.data.totalSteps).toBe(2);
    expect(chainRes.body.data.templateId).toBe("two-step-select");
  });

  it("omitting templateId uses default template", async () => {
    const app = buildApp();
    const adminToken = await tokenFor(ADMIN);
    const h = { Authorization: `Bearer ${adminToken}`, "X-PuddleJumper-Request": "true" };

    const execRes = await request(app)
      .post("/api/pj/execute")
      .set(h)
      .send({ requestId: "default-tmpl-1" });
    const approvalId = execRes.body.approvalId;

    const chainRes = await request(app)
      .get(`/api/approvals/${approvalId}/chain`)
      .set(h);
    expect(chainRes.body.data.totalSteps).toBe(1);
    expect(chainRes.body.data.templateId).toBe(DEFAULT_TEMPLATE_ID);
  });
});

describe("Approval list enriched with chain summary", () => {

  it("GET /api/approvals includes chainSummary for each approval", async () => {
    const app = buildApp();
    const adminToken = await tokenFor(ADMIN);
    const h = { Authorization: `Bearer ${adminToken}`, "X-PuddleJumper-Request": "true" };

    // Create approval (chain auto-created)
    const execRes = await request(app)
      .post("/api/pj/execute")
      .set(h)
      .send({ requestId: "enrich-list-1" });
    const approvalId = execRes.body.approvalId;

    // List approvals
    const listRes = await request(app)
      .get("/api/approvals?status=pending")
      .set(h);
    expect(listRes.status).toBe(200);
    const approval = listRes.body.data.approvals.find((a: any) => a.id === approvalId);
    expect(approval).toBeTruthy();
    expect(approval.chainSummary).toBeTruthy();
    expect(approval.chainSummary.totalSteps).toBe(1);
    expect(approval.chainSummary.completedSteps).toBe(0);
    expect(approval.chainSummary.allApproved).toBe(false);
    expect(approval.chainSummary.rejected).toBe(false);
    expect(approval.chainSummary.currentStepLabel).toBe("Admin Approval");
  });

  it("GET /api/approvals/:id includes chainSummary", async () => {
    const app = buildApp();
    const adminToken = await tokenFor(ADMIN);
    const h = { Authorization: `Bearer ${adminToken}`, "X-PuddleJumper-Request": "true" };

    const execRes = await request(app)
      .post("/api/pj/execute")
      .set(h)
      .send({ requestId: "enrich-single-1" });
    const approvalId = execRes.body.approvalId;

    const res = await request(app)
      .get(`/api/approvals/${approvalId}`)
      .set(h);
    expect(res.status).toBe(200);
    expect(res.body.data.chainSummary).toBeTruthy();
    expect(res.body.data.chainSummary.totalSteps).toBe(1);
  });

  it("chainSummary is null for legacy approvals without chains", async () => {
    const app = buildApp();
    const adminToken = await tokenFor(ADMIN);
    const h = { Authorization: `Bearer ${adminToken}`, "X-PuddleJumper-Request": "true" };

    // Create legacy approval directly (no chain)
    const approval = approvalStore.create({
      requestId: "legacy-enrich-1",
      operatorId: "admin-1",
      workspaceId: "ws",
      municipalityId: "muni",
      actionIntent: "deploy",
      actionMode: "governed",
      planHash: "hash",
      planSteps: [{ stepId: "s1", description: "Deploy", requiresApproval: false, connector: "github", status: "ready", plan: {} }],
      auditRecord: {},
      decisionResult: { status: "approved", approved: true },
    });

    const res = await request(app)
      .get(`/api/approvals/${approval.id}`)
      .set(h);
    expect(res.body.data.chainSummary).toBeNull();
  });
});
