// ── Approval Chain Store Tests ───────────────────────────────────────────────
//
// Tests for multi-step approval chain data model:
//   - Chain template CRUD
//   - Chain instance creation from templates
//   - Sequential step progression (approve step N → activate step N+1)
//   - Rejection at any step → skip remaining
//   - Chain progress queries
//   - Default template (backward-compatible single-step)
//   - Edge cases and validation
//
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { ApprovalStore, type CreateApprovalInput } from "../src/engine/approvalStore.js";
import {
  ChainStore,
  DEFAULT_TEMPLATE_ID,
  DEFAULT_TEMPLATE_NAME,
  type ChainTemplate,
  type ChainTemplateStep,
} from "../src/engine/chainStore.js";

// ── Fixtures ────────────────────────────────────────────────────────────────

let approvalStore: ApprovalStore;
let chainStore: ChainStore;
let tmpDir: string;

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

function threeStepTemplate(): { name: string; description: string; steps: ChainTemplateStep[] } {
  return {
    name: "Three-Step Municipal",
    description: "Department head → Legal → Admin",
    steps: [
      { order: 0, requiredRole: "department_head", label: "Department Head Approval" },
      { order: 1, requiredRole: "legal", label: "Legal Review" },
      { order: 2, requiredRole: "admin", label: "Final Admin Sign-off" },
    ],
  };
}

// ── Setup / Teardown ────────────────────────────────────────────────────────

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "chain-store-test-"));
  approvalStore = new ApprovalStore(path.join(tmpDir, "approvals.db"));
  chainStore = new ChainStore(approvalStore.db);
});

afterEach(() => {
  approvalStore.close();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

// ── Tests ───────────────────────────────────────────────────────────────────

describe("ChainStore", () => {

  // ── Default Template ──────────────────────────────────────────────────

  describe("Default template", () => {
    it("creates default template on initialization", () => {
      const template = chainStore.getTemplate(DEFAULT_TEMPLATE_ID);
      expect(template).not.toBeNull();
      expect(template!.id).toBe(DEFAULT_TEMPLATE_ID);
      expect(template!.name).toBe(DEFAULT_TEMPLATE_NAME);
      expect(template!.steps).toHaveLength(1);
      expect(template!.steps[0].requiredRole).toBe("admin");
      expect(template!.steps[0].order).toBe(0);
    });

    it("does not duplicate default template on re-initialization", () => {
      // Create a second ChainStore on the same db
      const store2 = new ChainStore(approvalStore.db);
      const templates = store2.listTemplates();
      const defaults = templates.filter((t) => t.id === DEFAULT_TEMPLATE_ID);
      expect(defaults).toHaveLength(1);
    });
  });

  // ── Template CRUD ─────────────────────────────────────────────────────

  describe("Template CRUD", () => {
    it("creates a multi-step template", () => {
      const template = chainStore.createTemplate(threeStepTemplate());
      expect(template.id).toBeTruthy();
      expect(template.name).toBe("Three-Step Municipal");
      expect(template.steps).toHaveLength(3);
      expect(template.steps[0].requiredRole).toBe("department_head");
      expect(template.steps[1].requiredRole).toBe("legal");
      expect(template.steps[2].requiredRole).toBe("admin");
    });

    it("creates a template with explicit id", () => {
      const template = chainStore.createTemplate({
        id: "custom-id",
        ...threeStepTemplate(),
      });
      expect(template.id).toBe("custom-id");
    });

    it("rejects template with zero steps", () => {
      expect(() => chainStore.createTemplate({
        name: "Empty",
        steps: [],
      })).toThrow("at least one step");
    });

    it("rejects template with non-sequential orders", () => {
      expect(() => chainStore.createTemplate({
        name: "Bad Order",
        steps: [
          { order: 0, requiredRole: "admin", label: "A" },
          { order: 2, requiredRole: "legal", label: "B" },
        ],
      })).toThrow("sequential");
    });

    it("sorts steps by order when creating", () => {
      const template = chainStore.createTemplate({
        name: "Reverse Input",
        steps: [
          { order: 1, requiredRole: "legal", label: "Legal" },
          { order: 0, requiredRole: "admin", label: "Admin" },
        ],
      });
      expect(template.steps[0].order).toBe(0);
      expect(template.steps[0].requiredRole).toBe("admin");
      expect(template.steps[1].order).toBe(1);
      expect(template.steps[1].requiredRole).toBe("legal");
    });

    it("lists all templates", () => {
      chainStore.createTemplate(threeStepTemplate());
      const templates = chainStore.listTemplates();
      expect(templates.length).toBeGreaterThanOrEqual(2); // default + custom
    });

    it("returns null for non-existent template", () => {
      expect(chainStore.getTemplate("nonexistent")).toBeNull();
    });
  });

  // ── Chain Creation ────────────────────────────────────────────────────

  describe("Chain creation", () => {
    it("creates chain steps for an approval using default template", () => {
      const approval = approvalStore.create(makeApprovalInput());
      const steps = chainStore.createChainForApproval(approval.id);
      expect(steps).toHaveLength(1);
      expect(steps[0].approvalId).toBe(approval.id);
      expect(steps[0].templateId).toBe(DEFAULT_TEMPLATE_ID);
      expect(steps[0].stepOrder).toBe(0);
      expect(steps[0].requiredRole).toBe("admin");
      expect(steps[0].status).toBe("active"); // first step starts active
    });

    it("creates multi-step chain with first step active", () => {
      const template = chainStore.createTemplate(threeStepTemplate());
      const approval = approvalStore.create(makeApprovalInput());
      const steps = chainStore.createChainForApproval(approval.id, template.id);

      expect(steps).toHaveLength(3);
      expect(steps[0].status).toBe("active");
      expect(steps[1].status).toBe("pending");
      expect(steps[2].status).toBe("pending");
      expect(steps[0].requiredRole).toBe("department_head");
      expect(steps[1].requiredRole).toBe("legal");
      expect(steps[2].requiredRole).toBe("admin");
    });

    it("throws when template not found", () => {
      const approval = approvalStore.create(makeApprovalInput());
      expect(() => chainStore.createChainForApproval(approval.id, "nonexistent"))
        .toThrow("not found");
    });

    it("throws when chain already exists for approval", () => {
      const approval = approvalStore.create(makeApprovalInput());
      chainStore.createChainForApproval(approval.id);
      expect(() => chainStore.createChainForApproval(approval.id))
        .toThrow("already exists");
    });
  });

  // ── Step Queries ──────────────────────────────────────────────────────

  describe("Step queries", () => {
    it("getStepsForApproval returns ordered steps", () => {
      const template = chainStore.createTemplate(threeStepTemplate());
      const approval = approvalStore.create(makeApprovalInput());
      chainStore.createChainForApproval(approval.id, template.id);

      const steps = chainStore.getStepsForApproval(approval.id);
      expect(steps).toHaveLength(3);
      expect(steps.map((s) => s.stepOrder)).toEqual([0, 1, 2]);
    });

    it("getActiveStep returns the current active step", () => {
      const template = chainStore.createTemplate(threeStepTemplate());
      const approval = approvalStore.create(makeApprovalInput());
      chainStore.createChainForApproval(approval.id, template.id);

      const active = chainStore.getActiveStep(approval.id);
      expect(active).not.toBeNull();
      expect(active!.stepOrder).toBe(0);
      expect(active!.status).toBe("active");
    });

    it("getActiveStep returns null when no chain exists", () => {
      expect(chainStore.getActiveStep("nonexistent")).toBeNull();
    });

    it("getStep returns a single step by id", () => {
      const approval = approvalStore.create(makeApprovalInput());
      const steps = chainStore.createChainForApproval(approval.id);
      const step = chainStore.getStep(steps[0].id);
      expect(step).not.toBeNull();
      expect(step!.id).toBe(steps[0].id);
    });

    it("getStep returns null for nonexistent id", () => {
      expect(chainStore.getStep("nonexistent")).toBeNull();
    });

    it("getStepsForApproval returns empty for unknown approval", () => {
      expect(chainStore.getStepsForApproval("nonexistent")).toEqual([]);
    });
  });

  // ── Sequential Approval (Happy Path) ──────────────────────────────────

  describe("Sequential approval — happy path", () => {
    it("progresses through 3-step chain: dept_head → legal → admin", () => {
      const template = chainStore.createTemplate(threeStepTemplate());
      const approval = approvalStore.create(makeApprovalInput());
      const steps = chainStore.createChainForApproval(approval.id, template.id);

      // Step 0: department_head approves
      const result1 = chainStore.decideStep({
        stepId: steps[0].id,
        deciderId: "dept-head-user",
        status: "approved",
        note: "Department approved",
      });
      expect(result1).not.toBeNull();
      expect(result1!.step.status).toBe("approved");
      expect(result1!.step.deciderId).toBe("dept-head-user");
      expect(result1!.step.deciderNote).toBe("Department approved");
      expect(result1!.advanced).toBe(true);
      expect(result1!.allApproved).toBe(false);
      expect(result1!.rejected).toBe(false);

      // Step 1 should now be active
      const active1 = chainStore.getActiveStep(approval.id);
      expect(active1!.stepOrder).toBe(1);
      expect(active1!.status).toBe("active");

      // Step 1: legal approves
      const result2 = chainStore.decideStep({
        stepId: steps[1].id,
        deciderId: "legal-user",
        status: "approved",
      });
      expect(result2!.advanced).toBe(true);
      expect(result2!.allApproved).toBe(false);

      // Step 2 should now be active
      const active2 = chainStore.getActiveStep(approval.id);
      expect(active2!.stepOrder).toBe(2);

      // Step 2: admin approves → chain complete
      const result3 = chainStore.decideStep({
        stepId: steps[2].id,
        deciderId: "admin-user",
        status: "approved",
        note: "Final sign-off",
      });
      expect(result3!.advanced).toBe(false);
      expect(result3!.allApproved).toBe(true);
      expect(result3!.rejected).toBe(false);

      // No more active steps
      expect(chainStore.getActiveStep(approval.id)).toBeNull();

      // All steps are approved
      const finalSteps = chainStore.getStepsForApproval(approval.id);
      expect(finalSteps.every((s) => s.status === "approved")).toBe(true);
    });

    it("single-step chain (default template) completes in one decision", () => {
      const approval = approvalStore.create(makeApprovalInput());
      const steps = chainStore.createChainForApproval(approval.id);
      expect(steps).toHaveLength(1);

      const result = chainStore.decideStep({
        stepId: steps[0].id,
        deciderId: "admin-user",
        status: "approved",
      });
      expect(result!.allApproved).toBe(true);
      expect(result!.advanced).toBe(false);
      expect(chainStore.getActiveStep(approval.id)).toBeNull();
    });
  });

  // ── Rejection ─────────────────────────────────────────────────────────

  describe("Rejection", () => {
    it("rejection at step 0 skips all remaining steps", () => {
      const template = chainStore.createTemplate(threeStepTemplate());
      const approval = approvalStore.create(makeApprovalInput());
      const steps = chainStore.createChainForApproval(approval.id, template.id);

      const result = chainStore.decideStep({
        stepId: steps[0].id,
        deciderId: "dept-head-user",
        status: "rejected",
        note: "Not ready",
      });
      expect(result!.rejected).toBe(true);
      expect(result!.allApproved).toBe(false);
      expect(result!.step.status).toBe("rejected");

      // Remaining steps should be skipped
      const allSteps = chainStore.getStepsForApproval(approval.id);
      expect(allSteps[0].status).toBe("rejected");
      expect(allSteps[1].status).toBe("skipped");
      expect(allSteps[2].status).toBe("skipped");

      // No active step
      expect(chainStore.getActiveStep(approval.id)).toBeNull();
    });

    it("rejection at step 1 preserves step 0 approval and skips step 2", () => {
      const template = chainStore.createTemplate(threeStepTemplate());
      const approval = approvalStore.create(makeApprovalInput());
      const steps = chainStore.createChainForApproval(approval.id, template.id);

      // Approve step 0
      chainStore.decideStep({ stepId: steps[0].id, deciderId: "u1", status: "approved" });

      // Reject step 1
      const result = chainStore.decideStep({
        stepId: steps[1].id,
        deciderId: "u2",
        status: "rejected",
        note: "Legal concern",
      });
      expect(result!.rejected).toBe(true);

      const allSteps = chainStore.getStepsForApproval(approval.id);
      expect(allSteps[0].status).toBe("approved");
      expect(allSteps[1].status).toBe("rejected");
      expect(allSteps[2].status).toBe("skipped");
    });

    it("rejection at final step", () => {
      const template = chainStore.createTemplate(threeStepTemplate());
      const approval = approvalStore.create(makeApprovalInput());
      const steps = chainStore.createChainForApproval(approval.id, template.id);

      chainStore.decideStep({ stepId: steps[0].id, deciderId: "u1", status: "approved" });
      chainStore.decideStep({ stepId: steps[1].id, deciderId: "u2", status: "approved" });

      const result = chainStore.decideStep({
        stepId: steps[2].id,
        deciderId: "u3",
        status: "rejected",
      });
      expect(result!.rejected).toBe(true);
      expect(result!.allApproved).toBe(false);

      const allSteps = chainStore.getStepsForApproval(approval.id);
      expect(allSteps[0].status).toBe("approved");
      expect(allSteps[1].status).toBe("approved");
      expect(allSteps[2].status).toBe("rejected");
    });
  });

  // ── Edge Cases ────────────────────────────────────────────────────────

  describe("Edge cases", () => {
    it("cannot decide a pending (non-active) step", () => {
      const template = chainStore.createTemplate(threeStepTemplate());
      const approval = approvalStore.create(makeApprovalInput());
      const steps = chainStore.createChainForApproval(approval.id, template.id);

      // Try to decide step 1 (pending, not active)
      const result = chainStore.decideStep({
        stepId: steps[1].id,
        deciderId: "user",
        status: "approved",
      });
      expect(result).toBeNull();
    });

    it("cannot decide an already-decided step", () => {
      const approval = approvalStore.create(makeApprovalInput());
      const steps = chainStore.createChainForApproval(approval.id);

      chainStore.decideStep({ stepId: steps[0].id, deciderId: "u1", status: "approved" });

      // Try to decide again
      const result = chainStore.decideStep({
        stepId: steps[0].id,
        deciderId: "u2",
        status: "rejected",
      });
      expect(result).toBeNull();
    });

    it("returns null for nonexistent step id", () => {
      const result = chainStore.decideStep({
        stepId: "nonexistent",
        deciderId: "user",
        status: "approved",
      });
      expect(result).toBeNull();
    });

    it("decided_at timestamp is recorded", () => {
      const approval = approvalStore.create(makeApprovalInput());
      const steps = chainStore.createChainForApproval(approval.id);
      const before = new Date().toISOString();

      chainStore.decideStep({ stepId: steps[0].id, deciderId: "u1", status: "approved" });

      const step = chainStore.getStep(steps[0].id)!;
      expect(step.decidedAt).not.toBeNull();
      expect(new Date(step.decidedAt!).getTime()).toBeGreaterThanOrEqual(new Date(before).getTime());
    });
  });

  // ── Chain Progress ────────────────────────────────────────────────────

  describe("Chain progress", () => {
    it("returns full progress for a 3-step chain", () => {
      const template = chainStore.createTemplate(threeStepTemplate());
      const approval = approvalStore.create(makeApprovalInput());
      chainStore.createChainForApproval(approval.id, template.id);

      const progress = chainStore.getChainProgress(approval.id);
      expect(progress).not.toBeNull();
      expect(progress!.totalSteps).toBe(3);
      expect(progress!.completedSteps).toBe(0);
      expect(progress!.currentStep).not.toBeNull();
      expect(progress!.currentStep!.stepOrder).toBe(0);
      expect(progress!.allApproved).toBe(false);
      expect(progress!.rejected).toBe(false);
      expect(progress!.templateName).toBe("Three-Step Municipal");
    });

    it("tracks progress as steps are approved", () => {
      const template = chainStore.createTemplate(threeStepTemplate());
      const approval = approvalStore.create(makeApprovalInput());
      const steps = chainStore.createChainForApproval(approval.id, template.id);

      chainStore.decideStep({ stepId: steps[0].id, deciderId: "u1", status: "approved" });
      const progress1 = chainStore.getChainProgress(approval.id)!;
      expect(progress1.completedSteps).toBe(1);
      expect(progress1.currentStep!.stepOrder).toBe(1);

      chainStore.decideStep({ stepId: steps[1].id, deciderId: "u2", status: "approved" });
      const progress2 = chainStore.getChainProgress(approval.id)!;
      expect(progress2.completedSteps).toBe(2);
      expect(progress2.currentStep!.stepOrder).toBe(2);

      chainStore.decideStep({ stepId: steps[2].id, deciderId: "u3", status: "approved" });
      const progress3 = chainStore.getChainProgress(approval.id)!;
      expect(progress3.completedSteps).toBe(3);
      expect(progress3.currentStep).toBeNull();
      expect(progress3.allApproved).toBe(true);
    });

    it("shows rejected state in progress", () => {
      const template = chainStore.createTemplate(threeStepTemplate());
      const approval = approvalStore.create(makeApprovalInput());
      const steps = chainStore.createChainForApproval(approval.id, template.id);

      chainStore.decideStep({ stepId: steps[0].id, deciderId: "u1", status: "rejected" });
      const progress = chainStore.getChainProgress(approval.id)!;
      expect(progress.rejected).toBe(true);
      expect(progress.allApproved).toBe(false);
      expect(progress.currentStep).toBeNull();
    });

    it("returns null for approval with no chain", () => {
      expect(chainStore.getChainProgress("nonexistent")).toBeNull();
    });
  });

  // ── Counting ──────────────────────────────────────────────────────────

  describe("countActiveSteps", () => {
    it("counts active steps across multiple approvals", () => {
      const approval1 = approvalStore.create(makeApprovalInput());
      const approval2 = approvalStore.create(makeApprovalInput());
      chainStore.createChainForApproval(approval1.id);
      chainStore.createChainForApproval(approval2.id);

      expect(chainStore.countActiveSteps()).toBe(2);

      // Decide one
      const steps1 = chainStore.getStepsForApproval(approval1.id);
      chainStore.decideStep({ stepId: steps1[0].id, deciderId: "u1", status: "approved" });

      expect(chainStore.countActiveSteps()).toBe(1);
    });

    it("returns 0 when no chains exist", () => {
      expect(chainStore.countActiveSteps()).toBe(0);
    });

    it("updates count when multi-step chain progresses", () => {
      const template = chainStore.createTemplate(threeStepTemplate());
      const approval = approvalStore.create(makeApprovalInput());
      const steps = chainStore.createChainForApproval(approval.id, template.id);

      // Active: step 0
      expect(chainStore.countActiveSteps()).toBe(1);

      // Approve step 0 → step 1 becomes active (still 1 active)
      chainStore.decideStep({ stepId: steps[0].id, deciderId: "u1", status: "approved" });
      expect(chainStore.countActiveSteps()).toBe(1);

      // Approve step 1 → step 2 becomes active (still 1 active)
      chainStore.decideStep({ stepId: steps[1].id, deciderId: "u2", status: "approved" });
      expect(chainStore.countActiveSteps()).toBe(1);

      // Approve step 2 → no more active
      chainStore.decideStep({ stepId: steps[2].id, deciderId: "u3", status: "approved" });
      expect(chainStore.countActiveSteps()).toBe(0);
    });

    it("decrements on rejection", () => {
      const approval = approvalStore.create(makeApprovalInput());
      const steps = chainStore.createChainForApproval(approval.id);
      expect(chainStore.countActiveSteps()).toBe(1);

      chainStore.decideStep({ stepId: steps[0].id, deciderId: "u1", status: "rejected" });
      expect(chainStore.countActiveSteps()).toBe(0);
    });
  });

  // ── Multiple Approvals Isolation ──────────────────────────────────────

  describe("Multi-approval isolation", () => {
    it("chains for different approvals are independent", () => {
      const template = chainStore.createTemplate(threeStepTemplate());
      const a1 = approvalStore.create(makeApprovalInput());
      const a2 = approvalStore.create(makeApprovalInput());

      const steps1 = chainStore.createChainForApproval(a1.id, template.id);
      const steps2 = chainStore.createChainForApproval(a2.id, template.id);

      // Approve step 0 of approval 1
      chainStore.decideStep({ stepId: steps1[0].id, deciderId: "u1", status: "approved" });

      // Approval 2 step 0 should still be active (unaffected)
      const a2Active = chainStore.getActiveStep(a2.id);
      expect(a2Active!.stepOrder).toBe(0);
      expect(a2Active!.status).toBe("active");

      // Approval 1 step 1 should be active
      const a1Active = chainStore.getActiveStep(a1.id);
      expect(a1Active!.stepOrder).toBe(1);
    });
  });
});
