import { describe, it, expect, vi } from "vitest";
import {
  DispatcherRegistry,
  dispatchPlan,
  type ConnectorDispatcher,
  type PlanStepInput,
  type DispatchContext,
  type DispatchStepResult,
} from "../src/engine/dispatch.js";

// ── Helpers ─────────────────────────────────────────────────────────────────

function makeStep(overrides: Partial<PlanStepInput> = {}): PlanStepInput {
  return {
    stepId: `step-${crypto.randomUUID().slice(0, 8)}`,
    description: "Test step",
    requiresApproval: false,
    connector: "github",
    status: "ready",
    plan: { repo: "test/repo" },
    ...overrides,
  };
}

const defaultContext: DispatchContext = {
  approvalId: "appr-1",
  requestId: "req-1",
  operatorId: "op-1",
  dryRun: false,
};

function makeDispatcher(
  connectorName: string,
  dispatchFn?: (step: PlanStepInput, ctx: DispatchContext) => Promise<DispatchStepResult>,
): ConnectorDispatcher {
  return {
    connectorName: connectorName as any,
    dispatch: dispatchFn ?? (async (step) => ({
      stepId: step.stepId,
      connector: step.connector,
      status: "dispatched",
      result: { mock: true },
      completedAt: new Date().toISOString(),
    })),
    healthCheck: async () => ({ healthy: true }),
  };
}

// ── Tests ───────────────────────────────────────────────────────────────────

describe("DispatcherRegistry", () => {
  it("registers and retrieves a dispatcher", () => {
    const reg = new DispatcherRegistry();
    const d = makeDispatcher("github");
    reg.register(d);
    expect(reg.get("github")).toBe(d);
    expect(reg.has("github")).toBe(true);
    expect(reg.has("sharepoint")).toBe(false);
  });

  it("listRegistered returns all names", () => {
    const reg = new DispatcherRegistry();
    reg.register(makeDispatcher("github"));
    reg.register(makeDispatcher("sharepoint") as any);
    expect(reg.listRegistered().sort()).toEqual(["github", "sharepoint"]);
  });
});

describe("dispatchPlan", () => {
  it("dispatches a single ready step", async () => {
    const reg = new DispatcherRegistry();
    reg.register(makeDispatcher("github"));
    const steps = [makeStep()];

    const result = await dispatchPlan(steps, defaultContext, reg);
    expect(result.success).toBe(true);
    expect(result.steps.length).toBe(1);
    expect(result.steps[0].status).toBe("dispatched");
    expect(result.summary).toContain("1 dispatched");
  });

  it("skips steps not in ready state", async () => {
    const reg = new DispatcherRegistry();
    reg.register(makeDispatcher("github"));
    const steps = [makeStep({ status: "dispatched" })];

    const result = await dispatchPlan(steps, defaultContext, reg);
    expect(result.success).toBe(true);
    expect(result.steps[0].status).toBe("skipped");
    expect(result.steps[0].result?.reason).toContain("dispatched");
  });

  it("skips steps with no connector", async () => {
    const reg = new DispatcherRegistry();
    const steps = [makeStep({ connector: "none" })];

    const result = await dispatchPlan(steps, defaultContext, reg);
    expect(result.success).toBe(true);
    expect(result.steps[0].status).toBe("skipped");
    expect(result.steps[0].result?.reason).toContain("No connector");
  });

  it("skips steps with unregistered connector", async () => {
    const reg = new DispatcherRegistry();
    // Don't register anything
    const steps = [makeStep({ connector: "sharepoint" as any })];

    const result = await dispatchPlan(steps, defaultContext, reg);
    expect(result.success).toBe(true);
    expect(result.steps[0].status).toBe("skipped");
    expect(result.steps[0].result?.reason).toContain("No dispatcher");
  });

  it("marks success=false when a step fails", async () => {
    const reg = new DispatcherRegistry();
    reg.register(makeDispatcher("github", async (step) => ({
      stepId: step.stepId,
      connector: step.connector,
      status: "failed",
      error: "API error",
      completedAt: new Date().toISOString(),
    })));

    const result = await dispatchPlan([makeStep()], defaultContext, reg);
    expect(result.success).toBe(false);
    expect(result.steps[0].status).toBe("failed");
    expect(result.summary).toContain("1 failed");
  });

  it("catches thrown errors from dispatcher", async () => {
    const reg = new DispatcherRegistry();
    reg.register(makeDispatcher("github", async () => {
      throw new Error("Connection refused");
    }));

    const result = await dispatchPlan([makeStep()], defaultContext, reg);
    expect(result.success).toBe(false);
    expect(result.steps[0].status).toBe("failed");
    expect(result.steps[0].error).toBe("Connection refused");
  });

  it("dispatches multiple steps sequentially", async () => {
    const order: string[] = [];
    const reg = new DispatcherRegistry();
    reg.register(makeDispatcher("github", async (step) => {
      order.push(step.stepId);
      return {
        stepId: step.stepId,
        connector: step.connector,
        status: "dispatched",
        completedAt: new Date().toISOString(),
      };
    }));

    const steps = [
      makeStep({ stepId: "a" }),
      makeStep({ stepId: "b" }),
      makeStep({ stepId: "c" }),
    ];

    const result = await dispatchPlan(steps, defaultContext, reg);
    expect(result.success).toBe(true);
    expect(result.steps.length).toBe(3);
    expect(order).toEqual(["a", "b", "c"]);
    expect(result.summary).toContain("3 dispatched");
  });

  it("continues dispatching after a failed step", async () => {
    const reg = new DispatcherRegistry();
    let callCount = 0;
    reg.register(makeDispatcher("github", async (step) => {
      callCount++;
      if (callCount === 1) {
        return {
          stepId: step.stepId, connector: step.connector,
          status: "failed", error: "oops",
          completedAt: new Date().toISOString(),
        };
      }
      return {
        stepId: step.stepId, connector: step.connector,
        status: "dispatched",
        completedAt: new Date().toISOString(),
      };
    }));

    const result = await dispatchPlan(
      [makeStep({ stepId: "x" }), makeStep({ stepId: "y" })],
      defaultContext, reg,
    );
    expect(result.success).toBe(false);
    expect(result.steps[0].status).toBe("failed");
    expect(result.steps[1].status).toBe("dispatched");
    expect(result.summary).toContain("1 dispatched");
    expect(result.summary).toContain("1 failed");
  });

  it("handles empty steps array", async () => {
    const reg = new DispatcherRegistry();
    const result = await dispatchPlan([], defaultContext, reg);
    expect(result.success).toBe(true);
    expect(result.steps.length).toBe(0);
    expect(result.summary).toContain("0 dispatched");
  });

  it("passes context to dispatcher", async () => {
    const reg = new DispatcherRegistry();
    let captured: DispatchContext | null = null;
    reg.register(makeDispatcher("github", async (step, ctx) => {
      captured = ctx;
      return {
        stepId: step.stepId, connector: step.connector,
        status: "dispatched", completedAt: new Date().toISOString(),
      };
    }));

    await dispatchPlan([makeStep()], { ...defaultContext, dryRun: true }, reg);
    expect(captured).not.toBeNull();
    expect(captured!.dryRun).toBe(true);
    expect(captured!.approvalId).toBe("appr-1");
  });
});
