// ── Parallel Approval Chain Tests ────────────────────────────────────────────
//
// Tests for parallel approval support (60-day milestone).
//
// Parallel rules:
//   - Multiple steps can share the same `order` value.
//   - All steps at order N activate simultaneously.
//   - All steps at order N must be approved before order N+1 activates.
//   - Rejection at any step is terminal (remaining + subsequent skipped).
//   - Backward-compatible: templates with unique orders behave identically.
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
import {
  ChainStore,
  DEFAULT_TEMPLATE_ID,
  type ChainTemplateStep,
} from "../src/engine/chainStore.js";
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

/** IT + Legal in parallel at order 0, then Admin at order 1. */
function parallelTemplate(): { name: string; description: string; steps: ChainTemplateStep[] } {
  return {
    name: "Parallel IT + Legal",
    description: "IT and Legal approve in parallel, then Admin signs off",
    steps: [
      { order: 0, requiredRole: "it", label: "IT Review" },
      { order: 0, requiredRole: "legal", label: "Legal Review" },
      { order: 1, requiredRole: "admin", label: "Final Admin Sign-off" },
    ],
  };
}

/** 3-group: order 0 (single), order 1 (3 parallel), order 2 (single). */
function mixedTemplate(): { name: string; description: string; steps: ChainTemplateStep[] } {
  return {
    name: "Mixed Sequential + Parallel",
    description: "Dept head → 3 parallel reviewers → Admin",
    steps: [
      { order: 0, requiredRole: "dept_head", label: "Dept Head" },
      { order: 1, requiredRole: "it", label: "IT" },
      { order: 1, requiredRole: "legal", label: "Legal" },
      { order: 1, requiredRole: "finance", label: "Finance" },
      { order: 2, requiredRole: "admin", label: "Admin" },
    ],
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
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "parallel-test-"));
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

describe("Parallel approval — template creation", () => {

  it("creates a template with parallel steps at order 0", () => {
    const template = chainStore.createTemplate(parallelTemplate());
    expect(template.steps).toHaveLength(3);
    expect(template.steps.filter(s => s.order === 0)).toHaveLength(2);
    expect(template.steps.filter(s => s.order === 1)).toHaveLength(1);
  });

  it("creates a mixed sequential+parallel template", () => {
    const template = chainStore.createTemplate(mixedTemplate());
    expect(template.steps).toHaveLength(5);
    expect(template.steps.filter(s => s.order === 0)).toHaveLength(1);
    expect(template.steps.filter(s => s.order === 1)).toHaveLength(3);
    expect(template.steps.filter(s => s.order === 2)).toHaveLength(1);
  });

  it("rejects template with gap in orders", () => {
    expect(() => chainStore.createTemplate({
      name: "Bad",
      steps: [
        { order: 0, requiredRole: "a", label: "A" },
        { order: 2, requiredRole: "b", label: "B" }, // gap: no order 1
      ],
    })).toThrow();
  });
});

describe("Parallel approval — chain creation", () => {

  it("activates all steps at order 0 on creation", () => {
    const template = chainStore.createTemplate(parallelTemplate());
    const approval = approvalStore.create(makeApprovalInput());
    const steps = chainStore.createChainForApproval(approval.id, template.id);

    expect(steps).toHaveLength(3);

    const order0 = steps.filter(s => s.stepOrder === 0);
    expect(order0).toHaveLength(2);
    expect(order0.every(s => s.status === "active")).toBe(true);

    const order1 = steps.filter(s => s.stepOrder === 1);
    expect(order1).toHaveLength(1);
    expect(order1[0].status).toBe("pending");
  });

  it("activates single step at order 0 for sequential template (backward compat)", () => {
    const approval = approvalStore.create(makeApprovalInput());
    const steps = chainStore.createChainForApproval(approval.id);

    expect(steps).toHaveLength(1);
    expect(steps[0].status).toBe("active");
  });
});

describe("Parallel approval — step decisions", () => {

  it("approving one parallel step does NOT advance if sibling is still active", () => {
    const template = chainStore.createTemplate(parallelTemplate());
    const approval = approvalStore.create(makeApprovalInput());
    const steps = chainStore.createChainForApproval(approval.id, template.id);
    const order0Steps = steps.filter(s => s.stepOrder === 0);

    const result = chainStore.decideStep({
      stepId: order0Steps[0].id,
      deciderId: "it-user",
      status: "approved",
    });

    expect(result).not.toBeNull();
    expect(result!.step.status).toBe("approved");
    expect(result!.advanced).toBe(false);    // sibling still active
    expect(result!.allApproved).toBe(false);
    expect(result!.rejected).toBe(false);

    // Sibling still active
    const remaining = chainStore.getActiveSteps(approval.id);
    expect(remaining).toHaveLength(1);
    expect(remaining[0].requiredRole).toBe(order0Steps[1].requiredRole);

    // Order 1 still pending
    const allSteps = chainStore.getStepsForApproval(approval.id);
    const order1 = allSteps.filter(s => s.stepOrder === 1);
    expect(order1[0].status).toBe("pending");
  });

  it("approving all parallel steps at order 0 advances to order 1", () => {
    const template = chainStore.createTemplate(parallelTemplate());
    const approval = approvalStore.create(makeApprovalInput());
    const steps = chainStore.createChainForApproval(approval.id, template.id);
    const order0Steps = steps.filter(s => s.stepOrder === 0);

    // Approve first parallel step
    chainStore.decideStep({ stepId: order0Steps[0].id, deciderId: "it-user", status: "approved" });

    // Approve second parallel step → should advance
    const result = chainStore.decideStep({
      stepId: order0Steps[1].id,
      deciderId: "legal-user",
      status: "approved",
    });

    expect(result!.advanced).toBe(true);
    expect(result!.allApproved).toBe(false);

    // Order 1 should now be active
    const active = chainStore.getActiveSteps(approval.id);
    expect(active).toHaveLength(1);
    expect(active[0].stepOrder).toBe(1);
    expect(active[0].requiredRole).toBe("admin");
  });

  it("full chain: parallel group → sequential final → allApproved", () => {
    const template = chainStore.createTemplate(parallelTemplate());
    const approval = approvalStore.create(makeApprovalInput());
    const steps = chainStore.createChainForApproval(approval.id, template.id);

    const order0 = steps.filter(s => s.stepOrder === 0);
    const order1 = steps.filter(s => s.stepOrder === 1);

    chainStore.decideStep({ stepId: order0[0].id, deciderId: "it", status: "approved" });
    chainStore.decideStep({ stepId: order0[1].id, deciderId: "legal", status: "approved" });

    const finalResult = chainStore.decideStep({
      stepId: order1[0].id,
      deciderId: "admin",
      status: "approved",
    });

    expect(finalResult!.allApproved).toBe(true);
    expect(finalResult!.advanced).toBe(false);

    const allSteps = chainStore.getStepsForApproval(approval.id);
    expect(allSteps.every(s => s.status === "approved")).toBe(true);
  });

  it("rejection in parallel group skips sibling and subsequent steps", () => {
    const template = chainStore.createTemplate(parallelTemplate());
    const approval = approvalStore.create(makeApprovalInput());
    const steps = chainStore.createChainForApproval(approval.id, template.id);
    const order0 = steps.filter(s => s.stepOrder === 0);

    const result = chainStore.decideStep({
      stepId: order0[0].id,
      deciderId: "it-user",
      status: "rejected",
      note: "Security concern",
    });

    expect(result!.rejected).toBe(true);

    const allSteps = chainStore.getStepsForApproval(approval.id);
    expect(allSteps[0].status).toBe("rejected");  // IT rejected
    expect(allSteps[1].status).toBe("skipped");   // Legal skipped (sibling)
    expect(allSteps[2].status).toBe("skipped");   // Admin skipped (subsequent)

    expect(chainStore.getActiveSteps(approval.id)).toHaveLength(0);
  });

  it("rejection after one parallel sibling was already approved", () => {
    const template = chainStore.createTemplate(parallelTemplate());
    const approval = approvalStore.create(makeApprovalInput());
    const steps = chainStore.createChainForApproval(approval.id, template.id);
    const order0 = steps.filter(s => s.stepOrder === 0);

    // IT approves
    chainStore.decideStep({ stepId: order0[0].id, deciderId: "it", status: "approved" });

    // Legal rejects → chain terminal
    const result = chainStore.decideStep({
      stepId: order0[1].id,
      deciderId: "legal",
      status: "rejected",
    });

    expect(result!.rejected).toBe(true);

    const allSteps = chainStore.getStepsForApproval(approval.id);
    expect(allSteps[0].status).toBe("approved");  // IT already approved
    expect(allSteps[1].status).toBe("rejected");  // Legal rejected
    expect(allSteps[2].status).toBe("skipped");   // Admin skipped (subsequent)
  });
});

describe("Parallel approval — mixed template", () => {

  it("progresses: sequential → parallel group → sequential", () => {
    const template = chainStore.createTemplate(mixedTemplate());
    const approval = approvalStore.create(makeApprovalInput());
    const steps = chainStore.createChainForApproval(approval.id, template.id);

    // Order 0: single dept_head step, should be active
    expect(steps.filter(s => s.stepOrder === 0).every(s => s.status === "active")).toBe(true);
    expect(steps.filter(s => s.stepOrder === 1).every(s => s.status === "pending")).toBe(true);
    expect(steps.filter(s => s.stepOrder === 2).every(s => s.status === "pending")).toBe(true);

    const order0 = steps.filter(s => s.stepOrder === 0);
    const order1 = steps.filter(s => s.stepOrder === 1);
    const order2 = steps.filter(s => s.stepOrder === 2);

    // Approve dept head → order 1 (3 parallel) should activate
    const r1 = chainStore.decideStep({ stepId: order0[0].id, deciderId: "dept", status: "approved" });
    expect(r1!.advanced).toBe(true);

    const activeAfterDept = chainStore.getActiveSteps(approval.id);
    expect(activeAfterDept).toHaveLength(3);
    expect(activeAfterDept.every(s => s.stepOrder === 1)).toBe(true);

    // Approve IT
    const rIT = chainStore.decideStep({ stepId: order1[0].id, deciderId: "it", status: "approved" });
    expect(rIT!.advanced).toBe(false); // 2 siblings still active

    // Approve Legal
    const rLegal = chainStore.decideStep({ stepId: order1[1].id, deciderId: "legal", status: "approved" });
    expect(rLegal!.advanced).toBe(false); // 1 sibling still active

    // Approve Finance → order 2 should activate
    const rFinance = chainStore.decideStep({ stepId: order1[2].id, deciderId: "finance", status: "approved" });
    expect(rFinance!.advanced).toBe(true);

    const activeAfterParallel = chainStore.getActiveSteps(approval.id);
    expect(activeAfterParallel).toHaveLength(1);
    expect(activeAfterParallel[0].stepOrder).toBe(2);

    // Approve admin → chain complete
    const rAdmin = chainStore.decideStep({ stepId: order2[0].id, deciderId: "admin", status: "approved" });
    expect(rAdmin!.allApproved).toBe(true);
  });

  it("rejection in parallel group of mixed template skips everything after", () => {
    const template = chainStore.createTemplate(mixedTemplate());
    const approval = approvalStore.create(makeApprovalInput());
    const steps = chainStore.createChainForApproval(approval.id, template.id);

    const order0 = steps.filter(s => s.stepOrder === 0);
    const order1 = steps.filter(s => s.stepOrder === 1);

    // Approve dept head
    chainStore.decideStep({ stepId: order0[0].id, deciderId: "dept", status: "approved" });

    // Approve IT
    chainStore.decideStep({ stepId: order1[0].id, deciderId: "it", status: "approved" });

    // Reject Legal → finance (sibling) and admin (subsequent) skipped
    const result = chainStore.decideStep({ stepId: order1[1].id, deciderId: "legal", status: "rejected" });
    expect(result!.rejected).toBe(true);

    const allSteps = chainStore.getStepsForApproval(approval.id);
    expect(allSteps[0].status).toBe("approved");  // dept_head
    expect(allSteps[1].status).toBe("approved");  // it
    expect(allSteps[2].status).toBe("rejected");  // legal
    expect(allSteps[3].status).toBe("skipped");   // finance (sibling)
    expect(allSteps[4].status).toBe("skipped");   // admin (subsequent)
  });
});

describe("Parallel approval — progress + summary", () => {

  it("getChainProgress shows multiple active steps via currentSteps", () => {
    const template = chainStore.createTemplate(parallelTemplate());
    const approval = approvalStore.create(makeApprovalInput());
    chainStore.createChainForApproval(approval.id, template.id);

    const progress = chainStore.getChainProgress(approval.id)!;
    expect(progress.currentSteps).toHaveLength(2);
    expect(progress.currentSteps.every(s => s.status === "active")).toBe(true);
    // Backward compat: currentStep returns first active
    expect(progress.currentStep).not.toBeNull();
    expect(progress.currentStep!.status).toBe("active");
  });

  it("getChainSummary.currentStepLabel shows first active label", () => {
    const template = chainStore.createTemplate(parallelTemplate());
    const approval = approvalStore.create(makeApprovalInput());
    chainStore.createChainForApproval(approval.id, template.id);

    const summary = chainStore.getChainSummary(approval.id)!;
    expect(summary.currentStepLabel).toBeTruthy();
    // Should be one of the two active step labels
    expect(["IT Review", "Legal Review"]).toContain(summary.currentStepLabel);
  });

  it("getActiveSteps returns all active steps", () => {
    const template = chainStore.createTemplate(parallelTemplate());
    const approval = approvalStore.create(makeApprovalInput());
    chainStore.createChainForApproval(approval.id, template.id);

    const active = chainStore.getActiveSteps(approval.id);
    expect(active).toHaveLength(2);
    expect(active.map(s => s.requiredRole).sort()).toEqual(["it", "legal"]);
  });
});

describe("Parallel approval — countActiveSteps", () => {

  it("counts all parallel active steps", () => {
    const template = chainStore.createTemplate(parallelTemplate());
    const approval = approvalStore.create(makeApprovalInput());
    chainStore.createChainForApproval(approval.id, template.id);

    // 2 parallel active steps
    expect(chainStore.countActiveSteps()).toBe(2);
  });

  it("decrements as parallel steps are approved", () => {
    const template = chainStore.createTemplate(parallelTemplate());
    const approval = approvalStore.create(makeApprovalInput());
    const steps = chainStore.createChainForApproval(approval.id, template.id);
    const order0 = steps.filter(s => s.stepOrder === 0);

    chainStore.decideStep({ stepId: order0[0].id, deciderId: "it", status: "approved" });
    expect(chainStore.countActiveSteps()).toBe(1);

    // Approve last parallel → next order activates (1 step)
    chainStore.decideStep({ stepId: order0[1].id, deciderId: "legal", status: "approved" });
    expect(chainStore.countActiveSteps()).toBe(1); // order 1 admin now active
  });

  it("drops to 0 on rejection of parallel step", () => {
    const template = chainStore.createTemplate(parallelTemplate());
    const approval = approvalStore.create(makeApprovalInput());
    const steps = chainStore.createChainForApproval(approval.id, template.id);
    const order0 = steps.filter(s => s.stepOrder === 0);

    chainStore.decideStep({ stepId: order0[0].id, deciderId: "it", status: "rejected" });
    expect(chainStore.countActiveSteps()).toBe(0);
  });
});

describe("Parallel approval — API integration", () => {

  it("approve/reject through API with parallel chain", async () => {
    const template = chainStore.createTemplate(parallelTemplate());
    const approval = approvalStore.create(makeApprovalInput());
    chainStore.createChainForApproval(approval.id, template.id);

    const app = buildApp();
    const token = await tokenFor(ADMIN);
    const h = { Authorization: `Bearer ${token}`, "X-PuddleJumper-Request": "true" };

    // First decide call — approves one parallel step
    const res1 = await request(app)
      .post(`/api/approvals/${approval.id}/decide`)
      .set(h)
      .send({ status: "approved" })
      .expect(200);

    expect(res1.body.success).toBe(true);
    // Parent should still be pending (parallel sibling still active)
    expect(res1.body.data.approval_status).toBe("pending");

    // Second decide call — approves other parallel step → chain advances
    const res2 = await request(app)
      .post(`/api/approvals/${approval.id}/decide`)
      .set(h)
      .send({ status: "approved" })
      .expect(200);

    expect(res2.body.success).toBe(true);
    expect(res2.body.data.approval_status).toBe("pending"); // still pending, order 1 remains

    // Third decide call — approves final step → chain complete → parent approved
    const res3 = await request(app)
      .post(`/api/approvals/${approval.id}/decide`)
      .set(h)
      .send({ status: "approved" })
      .expect(200);

    expect(res3.body.success).toBe(true);
    expect(res3.body.data.approval_status).toBe("approved");
  });

  it("chain progress endpoint shows parallel steps", async () => {
    const template = chainStore.createTemplate(parallelTemplate());
    const approval = approvalStore.create(makeApprovalInput());
    chainStore.createChainForApproval(approval.id, template.id);

    const app = buildApp();
    const token = await tokenFor(ADMIN);
    const h = { Authorization: `Bearer ${token}`, "X-PuddleJumper-Request": "true" };

    const res = await request(app)
      .get(`/api/approvals/${approval.id}/chain`)
      .set(h)
      .expect(200);

    expect(res.body.data.totalSteps).toBe(3);
    expect(res.body.data.steps.filter((s: any) => s.status === "active")).toHaveLength(2);
    expect(res.body.data.currentSteps).toHaveLength(2);
  });
});

describe("Parallel approval — backward compatibility", () => {

  it("sequential templates still work identically", () => {
    // 3-step sequential (unique orders)
    const template = chainStore.createTemplate({
      name: "Sequential Three",
      steps: [
        { order: 0, requiredRole: "dept_head", label: "Dept Head" },
        { order: 1, requiredRole: "legal", label: "Legal" },
        { order: 2, requiredRole: "admin", label: "Admin" },
      ],
    });
    const approval = approvalStore.create(makeApprovalInput());
    const steps = chainStore.createChainForApproval(approval.id, template.id);

    expect(steps[0].status).toBe("active");
    expect(steps[1].status).toBe("pending");
    expect(steps[2].status).toBe("pending");

    // Approve step 0 → step 1 active
    const r1 = chainStore.decideStep({ stepId: steps[0].id, deciderId: "u1", status: "approved" });
    expect(r1!.advanced).toBe(true);
    expect(chainStore.getActiveStep(approval.id)!.stepOrder).toBe(1);

    // Approve step 1 → step 2 active
    const r2 = chainStore.decideStep({ stepId: steps[1].id, deciderId: "u2", status: "approved" });
    expect(r2!.advanced).toBe(true);
    expect(chainStore.getActiveStep(approval.id)!.stepOrder).toBe(2);

    // Approve step 2 → chain complete
    const r3 = chainStore.decideStep({ stepId: steps[2].id, deciderId: "u3", status: "approved" });
    expect(r3!.allApproved).toBe(true);
    expect(r3!.advanced).toBe(false);
  });

  it("default template single-step chain still works", () => {
    const approval = approvalStore.create(makeApprovalInput());
    const steps = chainStore.createChainForApproval(approval.id);

    expect(steps).toHaveLength(1);
    expect(steps[0].status).toBe("active");

    const result = chainStore.decideStep({
      stepId: steps[0].id, deciderId: "admin", status: "approved",
    });
    expect(result!.allApproved).toBe(true);
  });
});
