// ── Dispatcher Registry Retry + SharePoint Tests ────────────────────────────
//
// Tests for:
//   - DispatcherRegistry per-connector retry policy registration
//   - dispatchPlan uses registry-attached policy over fallback
//   - SharePointDispatcher stub behavior
//
import { describe, it, expect, vi } from "vitest";
import {
  DispatcherRegistry,
  dispatchPlan,
  type RetryPolicy,
  type PlanStepInput,
  type DispatchContext,
  type DispatchStepResult,
  type ConnectorDispatcher,
} from "../src/engine/dispatch.js";
import { SharePointDispatcher } from "../src/engine/dispatchers/sharepoint.js";

// ── Helpers ─────────────────────────────────────────────────────────────────

function makeStep(connector: string, overrides: Partial<PlanStepInput> = {}): PlanStepInput {
  return {
    stepId: `s-${connector}`,
    description: `${connector} step`,
    requiresApproval: false,
    connector: connector as any,
    status: "ready",
    plan: { url: "https://example.com/hook", operation: "test" },
    ...overrides,
  };
}

const CTX: DispatchContext = {
  approvalId: "a-test",
  requestId: "r-test",
  operatorId: "op-test",
  dryRun: false,
};

/** A fake dispatcher that can be configured to succeed or fail. */
function fakeDispatcher(name: string, behavior: "succeed" | "transient-fail" | "permanent-fail"): ConnectorDispatcher {
  return {
    connectorName: name as any,
    async dispatch(step): Promise<DispatchStepResult> {
      if (behavior === "succeed") {
        return { stepId: step.stepId, connector: name as any, status: "dispatched", completedAt: new Date().toISOString() };
      }
      if (behavior === "transient-fail") {
        return { stepId: step.stepId, connector: name as any, status: "failed", error: "Webhook failed: 503", completedAt: new Date().toISOString() };
      }
      return { stepId: step.stepId, connector: name as any, status: "failed", error: "Missing url in plan", completedAt: new Date().toISOString() };
    },
    async healthCheck() { return { healthy: true }; },
  };
}

// ── Tests ───────────────────────────────────────────────────────────────────

describe("DispatcherRegistry — retry policy on registration", () => {

  it("register() accepts an optional retry policy", () => {
    const registry = new DispatcherRegistry();
    const policy: RetryPolicy = { maxAttempts: 5, baseDelayMs: 500 };
    registry.register(fakeDispatcher("webhook", "succeed"), policy);

    expect(registry.has("webhook")).toBe(true);
    expect(registry.getRetryPolicy("webhook")).toEqual(policy);
  });

  it("register() without retry policy stores no policy", () => {
    const registry = new DispatcherRegistry();
    registry.register(fakeDispatcher("slack", "succeed"));

    expect(registry.has("slack")).toBe(true);
    expect(registry.getRetryPolicy("slack")).toBeUndefined();
  });

  it("getRetryPolicy() returns undefined for unregistered connector", () => {
    const registry = new DispatcherRegistry();
    expect(registry.getRetryPolicy("nonexistent")).toBeUndefined();
  });

  it("listRegistered includes dispatchers with and without policies", () => {
    const registry = new DispatcherRegistry();
    registry.register(fakeDispatcher("webhook", "succeed"), { maxAttempts: 3, baseDelayMs: 1000 });
    registry.register(fakeDispatcher("slack", "succeed"));

    expect(registry.listRegistered().sort()).toEqual(["slack", "webhook"]);
  });
});

describe("dispatchPlan — per-connector retry policy resolution", () => {

  it("uses registry-attached policy over caller fallback", async () => {
    const registryRetries: number[] = [];
    const fallbackRetries: number[] = [];

    const registryPolicy: RetryPolicy = {
      maxAttempts: 2,
      baseDelayMs: 1,
      onRetry: (attempt) => { registryRetries.push(attempt); },
    };
    const fallbackPolicy: RetryPolicy = {
      maxAttempts: 4,
      baseDelayMs: 1,
      onRetry: (attempt) => { fallbackRetries.push(attempt); },
    };

    const registry = new DispatcherRegistry();
    registry.register(fakeDispatcher("webhook", "transient-fail"), registryPolicy);

    const result = await dispatchPlan(
      [makeStep("webhook")],
      CTX,
      registry,
      fallbackPolicy,
    );

    // Registry policy has maxAttempts=2, so exactly 1 retry (attempt 1)
    expect(registryRetries).toEqual([1]);
    expect(fallbackRetries).toEqual([]);
    expect(result.steps[0].status).toBe("failed");
  });

  it("falls back to caller policy when no registry policy exists", async () => {
    const fallbackRetries: number[] = [];
    const fallbackPolicy: RetryPolicy = {
      maxAttempts: 2,
      baseDelayMs: 1,
      onRetry: (attempt) => { fallbackRetries.push(attempt); },
    };

    const registry = new DispatcherRegistry();
    registry.register(fakeDispatcher("webhook", "transient-fail")); // no policy

    const result = await dispatchPlan(
      [makeStep("webhook")],
      CTX,
      registry,
      fallbackPolicy,
    );

    expect(fallbackRetries).toEqual([1]);
    expect(result.steps[0].status).toBe("failed");
  });

  it("uses default policy when no registry or caller policy", async () => {
    const registry = new DispatcherRegistry();
    registry.register(fakeDispatcher("webhook", "succeed")); // no policy

    const result = await dispatchPlan(
      [makeStep("webhook")],
      CTX,
      registry,
      // no fallback
    );

    expect(result.success).toBe(true);
    expect(result.steps[0].status).toBe("dispatched");
  });

  it("applies different policies to different connectors in same plan", async () => {
    const webhookRetries: number[] = [];
    const githubRetries: number[] = [];

    const registry = new DispatcherRegistry();
    registry.register(fakeDispatcher("webhook", "transient-fail"), {
      maxAttempts: 2,
      baseDelayMs: 1,
      onRetry: (attempt) => { webhookRetries.push(attempt); },
    });
    registry.register(fakeDispatcher("github", "transient-fail"), {
      maxAttempts: 3,
      baseDelayMs: 1,
      onRetry: (attempt) => { githubRetries.push(attempt); },
    });

    const result = await dispatchPlan(
      [makeStep("webhook"), makeStep("github")],
      CTX,
      registry,
    );

    expect(webhookRetries).toEqual([1]);       // 2 attempts → 1 retry
    expect(githubRetries).toEqual([1, 2]);     // 3 attempts → 2 retries
    expect(result.steps.every(s => s.status === "failed")).toBe(true);
  });
});

describe("SharePointDispatcher", () => {
  const dispatcher = new SharePointDispatcher();

  it("has connectorName 'sharepoint'", () => {
    expect(dispatcher.connectorName).toBe("sharepoint");
  });

  it("returns skipped for non-dry-run dispatch (stub)", async () => {
    const step = makeStep("sharepoint", { plan: { operation: "upload", siteUrl: "https://contoso.sharepoint.com" } });
    const result = await dispatcher.dispatch(step, CTX);

    expect(result.status).toBe("skipped");
    expect(result.result).toHaveProperty("reason");
    expect((result.result as any).reason).toMatch(/not yet implemented/i);
  });

  it("returns dispatched for dry-run with plan details", async () => {
    const step = makeStep("sharepoint", { plan: { operation: "upload", siteUrl: "https://contoso.sharepoint.com" } });
    const result = await dispatcher.dispatch(step, { ...CTX, dryRun: true });

    expect(result.status).toBe("dispatched");
    expect((result.result as any).dryRun).toBe(true);
    expect((result.result as any).operation).toBe("upload");
  });

  it("healthCheck returns healthy (stub)", async () => {
    const health = await dispatcher.healthCheck();
    expect(health.healthy).toBe(true);
    expect(health.detail).toMatch(/stub/i);
  });

  it("registers in DispatcherRegistry", () => {
    const registry = new DispatcherRegistry();
    registry.register(dispatcher);

    expect(registry.has("sharepoint")).toBe(true);
    expect(registry.get("sharepoint")).toBe(dispatcher);
  });

  it("dispatches through registry pipeline", async () => {
    const registry = new DispatcherRegistry();
    registry.register(dispatcher);

    const result = await dispatchPlan(
      [makeStep("sharepoint", { plan: { operation: "upload" } })],
      CTX,
      registry,
    );

    // Stub returns "skipped" so it's not a failure
    expect(result.steps[0].status).toBe("skipped");
    expect(result.success).toBe(true); // skipped is not failed
  });
});
