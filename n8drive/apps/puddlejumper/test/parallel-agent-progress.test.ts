// ── Parallel Agent Progress Tests ────────────────────────────────────────────
//
// Tests that multiple agents (different roles) can independently make progress
// on parallel chain steps without blocking each other.
//
// Key features validated:
//   - Targeted step decisions via stepId parameter
//   - Role-based authorization for chain steps (non-admin roles can decide)
//   - Admin superrole can decide any step
//   - Legacy (non-chain) approvals still require admin role
//   - Agents cannot decide steps with mismatched roles
//
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import crypto from "node:crypto";
import express from "express";
import request from "supertest";
import { signJwt, cookieParserMiddleware, csrfProtection } from "@publiclogic/core";
import { ApprovalStore, type CreateApprovalInput } from "../src/engine/approvalStore.js";
import { ChainStore } from "../src/engine/chainStore.js";
import {
  DispatcherRegistry,
  type ConnectorDispatcher,
  type PlanStepInput,
  type DispatchContext,
} from "../src/engine/dispatch.js";
import { createApprovalRoutes } from "../src/api/routes/approvals.js";

// ── Fixtures ────────────────────────────────────────────────────────────────

let approvalStore: ApprovalStore;
let chainStore: ChainStore;
let registry: DispatcherRegistry;
let tmpDir: string;

const ADMIN = { sub: "admin-1", name: "Admin", role: "admin", permissions: ["deploy"], tenants: ["t1"], tenantId: "t1" };
const IT_AGENT = { sub: "it-agent-1", name: "IT Agent", role: "it", permissions: ["deploy"], tenants: ["t1"], tenantId: "t1" };
const LEGAL_AGENT = { sub: "legal-agent-1", name: "Legal Agent", role: "legal", permissions: ["deploy"], tenants: ["t1"], tenantId: "t1" };
const FINANCE_AGENT = { sub: "finance-agent-1", name: "Finance Agent", role: "finance", permissions: ["deploy"], tenants: ["t1"], tenantId: "t1" };
const VIEWER = { sub: "viewer-1", name: "Viewer", role: "viewer", permissions: [], tenants: ["t1"], tenantId: "t1" };

async function tokenFor(user: Record<string, unknown>) {
  return signJwt(user, { expiresIn: "1h" });
}

function makeApprovalInput(overrides: Partial<CreateApprovalInput> = {}): CreateApprovalInput {
  return {
    requestId: `req-${crypto.randomUUID()}`,
    operatorId: "op-1",
    workspaceId: "ws-1",
    municipalityId: "muni-1",
    actionIntent: "deploy_policy",
    actionMode: "governed",
    planHash: "hash-abc",
    planSteps: [{ stepId: "s1", description: "Deploy", connector: "github", status: "ready", plan: {} }],
    auditRecord: { event: "test" },
    decisionResult: { status: "approved" },
    ...overrides,
  };
}

function createMockDispatcher(): ConnectorDispatcher {
  return {
    connectorName: "github" as any,
    async dispatch(step: PlanStepInput, context: DispatchContext) {
      return {
        stepId: step.stepId, connector: step.connector,
        status: "dispatched" as const, result: { mock: true },
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
  app.use("/api", createApprovalRoutes({
    approvalStore, dispatcherRegistry: registry, nodeEnv: "test", chainStore,
  }));
  return app;
}

// ── Setup / Teardown ────────────────────────────────────────────────────────

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "agent-progress-test-"));
  approvalStore = new ApprovalStore(path.join(tmpDir, "approvals.db"));
  chainStore = new ChainStore(approvalStore.db);
  registry = new DispatcherRegistry();
  registry.register(createMockDispatcher());
});

afterEach(() => {
  approvalStore.close();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

// ── Tests ───────────────────────────────────────────────────────────────────

describe("Targeted step decisions via stepId", () => {

  it("IT agent targets their specific step in a parallel chain", async () => {
    const template = chainStore.createTemplate({
      name: "Parallel IT + Legal",
      steps: [
        { order: 0, requiredRole: "it", label: "IT Review" },
        { order: 0, requiredRole: "legal", label: "Legal Review" },
        { order: 1, requiredRole: "admin", label: "Final Admin Sign-off" },
      ],
    });
    const approval = approvalStore.create(makeApprovalInput());
    const steps = chainStore.createChainForApproval(approval.id, template.id);
    const itStep = steps.find(s => s.requiredRole === "it")!;

    const app = buildApp();
    const itToken = await tokenFor(IT_AGENT);
    const h = { Authorization: `Bearer ${itToken}`, "X-PuddleJumper-Request": "true" };

    const res = await request(app)
      .post(`/api/approvals/${approval.id}/decide`)
      .set(h)
      .send({ status: "approved", stepId: itStep.id, note: "IT approved" });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.approval_status).toBe("pending"); // legal still active
  });

  it("Legal agent targets their step independently of IT", async () => {
    const template = chainStore.createTemplate({
      name: "Parallel IT + Legal",
      steps: [
        { order: 0, requiredRole: "it", label: "IT Review" },
        { order: 0, requiredRole: "legal", label: "Legal Review" },
        { order: 1, requiredRole: "admin", label: "Final Admin Sign-off" },
      ],
    });
    const approval = approvalStore.create(makeApprovalInput());
    const steps = chainStore.createChainForApproval(approval.id, template.id);
    const legalStep = steps.find(s => s.requiredRole === "legal")!;

    const app = buildApp();
    const legalToken = await tokenFor(LEGAL_AGENT);
    const h = { Authorization: `Bearer ${legalToken}`, "X-PuddleJumper-Request": "true" };

    const res = await request(app)
      .post(`/api/approvals/${approval.id}/decide`)
      .set(h)
      .send({ status: "approved", stepId: legalStep.id });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.approval_status).toBe("pending"); // IT still active
  });

  it("both IT and Legal approve in parallel, then admin finalizes", async () => {
    const template = chainStore.createTemplate({
      name: "Parallel then Admin",
      steps: [
        { order: 0, requiredRole: "it", label: "IT Review" },
        { order: 0, requiredRole: "legal", label: "Legal Review" },
        { order: 1, requiredRole: "admin", label: "Admin Sign-off" },
      ],
    });
    const approval = approvalStore.create(makeApprovalInput());
    const steps = chainStore.createChainForApproval(approval.id, template.id);
    const itStep = steps.find(s => s.requiredRole === "it")!;
    const legalStep = steps.find(s => s.requiredRole === "legal")!;

    const app = buildApp();
    const itToken = await tokenFor(IT_AGENT);
    const legalToken = await tokenFor(LEGAL_AGENT);
    const adminToken = await tokenFor(ADMIN);

    // IT approves their step
    const r1 = await request(app)
      .post(`/api/approvals/${approval.id}/decide`)
      .set({ Authorization: `Bearer ${itToken}`, "X-PuddleJumper-Request": "true" })
      .send({ status: "approved", stepId: itStep.id });
    expect(r1.status).toBe(200);
    expect(r1.body.data.approval_status).toBe("pending");

    // Legal approves their step → chain advances to order 1
    const r2 = await request(app)
      .post(`/api/approvals/${approval.id}/decide`)
      .set({ Authorization: `Bearer ${legalToken}`, "X-PuddleJumper-Request": "true" })
      .send({ status: "approved", stepId: legalStep.id });
    expect(r2.status).toBe(200);
    expect(r2.body.data.approval_status).toBe("pending");
    expect(r2.body.data.chainAdvanced).toBe(true);

    // Admin finalizes
    const r3 = await request(app)
      .post(`/api/approvals/${approval.id}/decide`)
      .set({ Authorization: `Bearer ${adminToken}`, "X-PuddleJumper-Request": "true" })
      .send({ status: "approved" });
    expect(r3.status).toBe(200);
    expect(r3.body.data.approval_status).toBe("approved");
  });

  it("rejects when stepId does not belong to the approval", async () => {
    const template = chainStore.createTemplate({
      name: "Simple",
      steps: [{ order: 0, requiredRole: "admin", label: "Admin" }],
    });
    const approval1 = approvalStore.create(makeApprovalInput());
    const approval2 = approvalStore.create(makeApprovalInput());
    chainStore.createChainForApproval(approval1.id, template.id);
    const steps2 = chainStore.createChainForApproval(approval2.id, template.id);

    const app = buildApp();
    const adminToken = await tokenFor(ADMIN);
    const h = { Authorization: `Bearer ${adminToken}`, "X-PuddleJumper-Request": "true" };

    // Try to decide approval1 with a stepId from approval2
    const res = await request(app)
      .post(`/api/approvals/${approval1.id}/decide`)
      .set(h)
      .send({ status: "approved", stepId: steps2[0].id });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/does not belong/);
  });

  it("returns 404 when stepId does not exist", async () => {
    const template = chainStore.createTemplate({
      name: "Simple",
      steps: [{ order: 0, requiredRole: "admin", label: "Admin" }],
    });
    const approval = approvalStore.create(makeApprovalInput());
    chainStore.createChainForApproval(approval.id, template.id);

    const app = buildApp();
    const adminToken = await tokenFor(ADMIN);
    const h = { Authorization: `Bearer ${adminToken}`, "X-PuddleJumper-Request": "true" };

    const res = await request(app)
      .post(`/api/approvals/${approval.id}/decide`)
      .set(h)
      .send({ status: "approved", stepId: "nonexistent-step-id" });

    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/not found/);
  });
});

describe("Role-based authorization for chain steps", () => {

  it("non-admin agent with matching role can decide their chain step", async () => {
    const template = chainStore.createTemplate({
      name: "IT Only",
      steps: [
        { order: 0, requiredRole: "it", label: "IT Review" },
        { order: 1, requiredRole: "admin", label: "Admin" },
      ],
    });
    const approval = approvalStore.create(makeApprovalInput());
    chainStore.createChainForApproval(approval.id, template.id);

    const app = buildApp();
    const itToken = await tokenFor(IT_AGENT);
    const h = { Authorization: `Bearer ${itToken}`, "X-PuddleJumper-Request": "true" };

    const res = await request(app)
      .post(`/api/approvals/${approval.id}/decide`)
      .set(h)
      .send({ status: "approved" });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it("non-admin agent with wrong role gets 403", async () => {
    const template = chainStore.createTemplate({
      name: "Legal Only",
      steps: [
        { order: 0, requiredRole: "legal", label: "Legal Review" },
        { order: 1, requiredRole: "admin", label: "Admin" },
      ],
    });
    const approval = approvalStore.create(makeApprovalInput());
    chainStore.createChainForApproval(approval.id, template.id);

    const app = buildApp();
    const itToken = await tokenFor(IT_AGENT);
    const h = { Authorization: `Bearer ${itToken}`, "X-PuddleJumper-Request": "true" };

    const res = await request(app)
      .post(`/api/approvals/${approval.id}/decide`)
      .set(h)
      .send({ status: "approved" });

    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/cannot decide this step/);
  });

  it("admin can decide any chain step regardless of requiredRole", async () => {
    const template = chainStore.createTemplate({
      name: "IT Step",
      steps: [{ order: 0, requiredRole: "it", label: "IT Review" }],
    });
    const approval = approvalStore.create(makeApprovalInput());
    chainStore.createChainForApproval(approval.id, template.id);

    const app = buildApp();
    const adminToken = await tokenFor(ADMIN);
    const h = { Authorization: `Bearer ${adminToken}`, "X-PuddleJumper-Request": "true" };

    const res = await request(app)
      .post(`/api/approvals/${approval.id}/decide`)
      .set(h)
      .send({ status: "approved" });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.approval_status).toBe("approved");
  });

  it("viewer cannot decide chain steps", async () => {
    const template = chainStore.createTemplate({
      name: "Admin Step",
      steps: [{ order: 0, requiredRole: "admin", label: "Admin" }],
    });
    const approval = approvalStore.create(makeApprovalInput());
    chainStore.createChainForApproval(approval.id, template.id);

    const app = buildApp();
    const viewerToken = await tokenFor(VIEWER);
    const h = { Authorization: `Bearer ${viewerToken}`, "X-PuddleJumper-Request": "true" };

    const res = await request(app)
      .post(`/api/approvals/${approval.id}/decide`)
      .set(h)
      .send({ status: "approved" });

    expect(res.status).toBe(403);
  });
});

describe("Legacy (non-chain) approvals", () => {

  it("admin can still decide legacy approvals (no chain)", async () => {
    const approval = approvalStore.create(makeApprovalInput());
    // No chain created — legacy mode

    const app = buildApp();
    const adminToken = await tokenFor(ADMIN);
    const h = { Authorization: `Bearer ${adminToken}`, "X-PuddleJumper-Request": "true" };

    const res = await request(app)
      .post(`/api/approvals/${approval.id}/decide`)
      .set(h)
      .send({ status: "approved" });

    expect(res.status).toBe(200);
    expect(res.body.data.approval_status).toBe("approved");
  });

  it("non-admin cannot decide legacy approvals", async () => {
    const approval = approvalStore.create(makeApprovalInput());
    // No chain created — legacy mode

    const app = buildApp();
    const itToken = await tokenFor(IT_AGENT);
    const h = { Authorization: `Bearer ${itToken}`, "X-PuddleJumper-Request": "true" };

    const res = await request(app)
      .post(`/api/approvals/${approval.id}/decide`)
      .set(h)
      .send({ status: "approved" });

    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/Only admins/);
  });
});

describe("Multi-agent parallel progress — full lifecycle", () => {

  it("3-role parallel group: each agent decides independently, then admin finalizes", async () => {
    const template = chainStore.createTemplate({
      name: "Three Parallel",
      steps: [
        { order: 0, requiredRole: "it", label: "IT" },
        { order: 0, requiredRole: "legal", label: "Legal" },
        { order: 0, requiredRole: "finance", label: "Finance" },
        { order: 1, requiredRole: "admin", label: "Admin Final" },
      ],
    });
    const approval = approvalStore.create(makeApprovalInput());
    const steps = chainStore.createChainForApproval(approval.id, template.id);

    const itStep = steps.find(s => s.requiredRole === "it")!;
    const legalStep = steps.find(s => s.requiredRole === "legal")!;
    const financeStep = steps.find(s => s.requiredRole === "finance")!;

    const app = buildApp();
    const itToken = await tokenFor(IT_AGENT);
    const legalToken = await tokenFor(LEGAL_AGENT);
    const financeToken = await tokenFor(FINANCE_AGENT);
    const adminToken = await tokenFor(ADMIN);

    // All three agents approve in any order, targeting their own steps
    const r1 = await request(app)
      .post(`/api/approvals/${approval.id}/decide`)
      .set({ Authorization: `Bearer ${financeToken}`, "X-PuddleJumper-Request": "true" })
      .send({ status: "approved", stepId: financeStep.id });
    expect(r1.status).toBe(200);
    expect(r1.body.data.approval_status).toBe("pending");

    const r2 = await request(app)
      .post(`/api/approvals/${approval.id}/decide`)
      .set({ Authorization: `Bearer ${itToken}`, "X-PuddleJumper-Request": "true" })
      .send({ status: "approved", stepId: itStep.id });
    expect(r2.status).toBe(200);
    expect(r2.body.data.approval_status).toBe("pending");

    const r3 = await request(app)
      .post(`/api/approvals/${approval.id}/decide`)
      .set({ Authorization: `Bearer ${legalToken}`, "X-PuddleJumper-Request": "true" })
      .send({ status: "approved", stepId: legalStep.id });
    expect(r3.status).toBe(200);
    expect(r3.body.data.chainAdvanced).toBe(true);

    // Admin finalizes
    const r4 = await request(app)
      .post(`/api/approvals/${approval.id}/decide`)
      .set({ Authorization: `Bearer ${adminToken}`, "X-PuddleJumper-Request": "true" })
      .send({ status: "approved" });
    expect(r4.status).toBe(200);
    expect(r4.body.data.approval_status).toBe("approved");

    // Dispatch
    const dispatchRes = await request(app)
      .post(`/api/approvals/${approval.id}/dispatch`)
      .set({ Authorization: `Bearer ${adminToken}`, "X-PuddleJumper-Request": "true" })
      .send({});
    expect(dispatchRes.status).toBe(200);
    expect(dispatchRes.body.success).toBe(true);
  });

  it("one agent rejects while another has already approved", async () => {
    const template = chainStore.createTemplate({
      name: "IT + Legal Parallel",
      steps: [
        { order: 0, requiredRole: "it", label: "IT" },
        { order: 0, requiredRole: "legal", label: "Legal" },
        { order: 1, requiredRole: "admin", label: "Admin" },
      ],
    });
    const approval = approvalStore.create(makeApprovalInput());
    const steps = chainStore.createChainForApproval(approval.id, template.id);

    const itStep = steps.find(s => s.requiredRole === "it")!;
    const legalStep = steps.find(s => s.requiredRole === "legal")!;

    const app = buildApp();
    const itToken = await tokenFor(IT_AGENT);
    const legalToken = await tokenFor(LEGAL_AGENT);

    // IT approves
    const r1 = await request(app)
      .post(`/api/approvals/${approval.id}/decide`)
      .set({ Authorization: `Bearer ${itToken}`, "X-PuddleJumper-Request": "true" })
      .send({ status: "approved", stepId: itStep.id });
    expect(r1.status).toBe(200);

    // Legal rejects → chain terminal, parent rejected
    const r2 = await request(app)
      .post(`/api/approvals/${approval.id}/decide`)
      .set({ Authorization: `Bearer ${legalToken}`, "X-PuddleJumper-Request": "true" })
      .send({ status: "rejected", stepId: legalStep.id, note: "Compliance issue" });
    expect(r2.status).toBe(200);
    expect(r2.body.data.approval_status).toBe("rejected");
  });
});
