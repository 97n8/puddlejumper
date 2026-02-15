import { describe, it, expect } from "vitest";
import { DispatcherRegistry, dispatchPlan } from "../src/engine/dispatch.js";
import { GitHubDispatcher } from "../src/engine/dispatchers/github.js";
import { SlackDispatcher } from "../src/engine/dispatchers/slack.js";
import type { PlanStepInput, DispatchContext } from "../src/engine/dispatch.js";

describe("DispatcherRegistry multi-dispatcher wiring", () => {
  it("registers both GitHub and Slack dispatchers", () => {
    const registry = new DispatcherRegistry();
    registry.register(new GitHubDispatcher());
    registry.register(new SlackDispatcher());

    expect(registry.has("github")).toBe(true);
    expect(registry.has("slack")).toBe(true);
    expect(registry.listRegistered()).toContain("github");
    expect(registry.listRegistered()).toContain("slack");
  });

  it("SlackDispatcher returns skipped status (stub)", async () => {
    const dispatcher = new SlackDispatcher();
    const step: PlanStepInput = {
      stepId: "step-1",
      description: "Post to Slack",
      requiresApproval: false,
      connector: "slack" as any,
      status: "ready",
      plan: { channel: "#test", message: "Hello" },
    };
    const context: DispatchContext = {
      approvalId: "ap-1",
      requestId: "req-1",
      operatorId: "user-1",
      dryRun: false,
    };

    const result = await dispatcher.dispatch(step, context);
    expect(result.status).toBe("skipped");
    expect(result.connector).toBe("slack");
    expect(result.result?.reason).toContain("not yet implemented");
  });

  it("SlackDispatcher healthCheck returns healthy", async () => {
    const dispatcher = new SlackDispatcher();
    const health = await dispatcher.healthCheck();
    expect(health.healthy).toBe(true);
  });

  it("multi-step dispatch routes to correct dispatchers", async () => {
    const registry = new DispatcherRegistry();
    registry.register(new SlackDispatcher());

    const steps: PlanStepInput[] = [
      {
        stepId: "s1",
        description: "Post to Slack",
        requiresApproval: false,
        connector: "slack" as any,
        status: "ready",
        plan: { channel: "#ops" },
      },
      {
        stepId: "s2",
        description: "No connector",
        requiresApproval: false,
        connector: "none",
        status: "ready",
        plan: {},
      },
      {
        stepId: "s3",
        description: "Unknown connector",
        requiresApproval: false,
        connector: "email" as any,
        status: "ready",
        plan: {},
      },
    ];

    const context: DispatchContext = {
      approvalId: "ap-2",
      requestId: "req-2",
      operatorId: "user-2",
      dryRun: true,
    };

    const result = await dispatchPlan(steps, context, registry);
    expect(result.steps).toHaveLength(3);

    // Slack step: skipped (stub)
    expect(result.steps[0].connector).toBe("slack");
    expect(result.steps[0].status).toBe("skipped");

    // No connector: skipped
    expect(result.steps[1].connector).toBe("none");
    expect(result.steps[1].status).toBe("skipped");

    // Unknown connector: skipped (no dispatcher)
    expect(result.steps[2].connector).toBe("email");
    expect(result.steps[2].status).toBe("skipped");

    expect(result.summary).toContain("3 skipped");
  });
});
