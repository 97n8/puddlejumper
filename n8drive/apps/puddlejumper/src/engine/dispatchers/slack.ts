// ── Slack Dispatcher (stub — proves wiring pattern is extensible) ────────────
//
// This is a minimal implementation to confirm that the DispatcherRegistry
// pattern supports multiple dispatchers.  No real Slack API calls are made.
import type { ConnectorDispatcher, PlanStepInput, DispatchContext, DispatchStepResult } from "../dispatch.js";

export class SlackDispatcher implements ConnectorDispatcher {
  readonly connectorName = "slack" as const;

  async dispatch(step: PlanStepInput, context: DispatchContext): Promise<DispatchStepResult> {
    // Stub — real implementation will call Slack Web API
    return {
      stepId: step.stepId,
      connector: this.connectorName,
      status: "skipped",
      result: { reason: "Slack dispatcher not yet implemented", dryRun: context.dryRun },
      completedAt: new Date().toISOString(),
    };
  }

  async healthCheck(): Promise<{ healthy: boolean; detail?: string }> {
    return { healthy: true, detail: "stub — no real Slack connection" };
  }
}
