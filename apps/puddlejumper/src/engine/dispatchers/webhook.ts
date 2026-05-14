// ── Webhook Dispatcher ──────────────────────────────────────────────────────
//
// Dispatches approved plan steps as HTTP webhook calls.
// This is the first "real" (non-stub) integration dispatcher, serving as the
// template for all future connectors (Email, SMS, GitHub Actions, etc.).
//
// Rules:
//   • No retry logic (will be added later via a policy layer)
//   • No secrets manager integration yet
//   • Throws on non-2xx response
//   • Minimal and pure
//
import type {
  ConnectorDispatcher,
  PlanStepInput,
  DispatchContext,
  DispatchStepResult,
} from "../dispatch.js";

// ── Types ───────────────────────────────────────────────────────────────────

type WebhookPlanData = {
  url: string;
  method?: string;
  headers?: Record<string, string>;
  body?: unknown;
};

// ── Dispatcher ──────────────────────────────────────────────────────────────

export class WebhookDispatcher implements ConnectorDispatcher {
  readonly connectorName = "webhook" as const;

  async dispatch(
    step: PlanStepInput,
    context: DispatchContext,
  ): Promise<DispatchStepResult> {
    const plan = step.plan as unknown as WebhookPlanData;

    if (!plan.url) {
      return {
        stepId: step.stepId,
        connector: "webhook",
        status: "failed",
        error: "Missing url in plan",
        completedAt: new Date().toISOString(),
      };
    }

    if (context.dryRun) {
      return {
        stepId: step.stepId,
        connector: "webhook",
        status: "dispatched",
        result: {
          dryRun: true,
          url: plan.url,
          method: plan.method ?? "POST",
          message: "Dry run — no webhook sent",
        },
        completedAt: new Date().toISOString(),
      };
    }

    try {
      const method = plan.method ?? "POST";
      const response = await fetch(plan.url, {
        method,
        headers: {
          "content-type": "application/json",
          ...plan.headers,
        },
        body: plan.body ? JSON.stringify(plan.body) : undefined,
      });

      if (!response.ok) {
        return {
          stepId: step.stepId,
          connector: "webhook",
          status: "failed",
          error: `Webhook failed: ${response.status}`,
          completedAt: new Date().toISOString(),
        };
      }

      return {
        stepId: step.stepId,
        connector: "webhook",
        status: "dispatched",
        result: {
          url: plan.url,
          method,
          httpStatus: response.status,
        },
        completedAt: new Date().toISOString(),
      };
    } catch (err) {
      return {
        stepId: step.stepId,
        connector: "webhook",
        status: "failed",
        error: err instanceof Error ? err.message : String(err),
        completedAt: new Date().toISOString(),
      };
    }
  }

  async healthCheck(): Promise<{ healthy: boolean; detail?: string }> {
    // Webhook dispatcher is always "healthy" — it's a generic HTTP caller.
    // Individual webhook URLs may be unreachable, but that's per-step, not per-dispatcher.
    return { healthy: true, detail: "Webhook dispatcher ready" };
  }
}
