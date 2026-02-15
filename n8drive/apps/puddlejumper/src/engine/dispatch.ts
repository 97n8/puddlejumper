// ── Connector Dispatch Interface ────────────────────────────────────────────
//
// Defines the contract for executing approved plan steps against real
// external services (GitHub, SharePoint, etc.).
//
// The governance engine produces PlanStep[] with status "ready".
// The dispatch layer takes approved plans and executes them, transitioning
// steps through: ready → dispatching → dispatched | failed.
//
import type { ConnectorName } from "./governanceEngine.js";

// ── Types ───────────────────────────────────────────────────────────────────

/** Result from dispatching a single plan step. */
export type DispatchStepResult = {
  stepId: string;
  connector: ConnectorName | "none";
  status: "dispatched" | "failed" | "skipped";
  /** Connector-specific response data (e.g., PR URL, upload ID). */
  result?: Record<string, unknown>;
  /** Error message if status is "failed". */
  error?: string;
  /** ISO timestamp of dispatch completion. */
  completedAt: string;
};

/** Aggregate result from dispatching an entire plan. */
export type DispatchResult = {
  success: boolean;
  steps: DispatchStepResult[];
  /** Overall summary. */
  summary: string;
  /** ISO timestamp of dispatch start. */
  startedAt: string;
  /** ISO timestamp of dispatch completion. */
  completedAt: string;
};

/** The plan step shape produced by the governance engine. */
export type PlanStepInput = {
  stepId: string;
  description: string;
  requiresApproval: boolean;
  connector: ConnectorName | "none";
  status: string;
  plan: Record<string, unknown>;
};

/** Configuration passed to a connector dispatcher. */
export type DispatchContext = {
  /** The approval ID (for audit linkage). */
  approvalId: string;
  /** The original request ID. */
  requestId: string;
  /** The operator who initiated the action. */
  operatorId: string;
  /** Read-only flag — when true, connectors should only validate, not execute. */
  dryRun: boolean;
};

/**
 * A connector dispatcher handles execution of plan steps for a specific
 * connector type (e.g., GitHub, SharePoint).
 */
export interface ConnectorDispatcher {
  /** The connector this dispatcher handles. */
  readonly connectorName: ConnectorName;

  /**
   * Execute a single plan step.
   *
   * Implementations should:
   * 1. Validate the plan has required fields
   * 2. Call the external service
   * 3. Return a DispatchStepResult
   *
   * Errors should be caught and returned as { status: "failed", error: "..." }
   * rather than thrown.
   */
  dispatch(step: PlanStepInput, context: DispatchContext): Promise<DispatchStepResult>;

  /**
   * Check if this connector is currently healthy/reachable.
   * Used to pre-validate before dispatching.
   */
  healthCheck(): Promise<{ healthy: boolean; detail?: string }>;
}

// ── Dispatcher Registry ─────────────────────────────────────────────────────

/**
 * Registry of connector dispatchers.
 * The dispatch engine looks up the appropriate dispatcher for each plan step
 * by connector name.
 */
export class DispatcherRegistry {
  private readonly dispatchers = new Map<string, ConnectorDispatcher>();

  register(dispatcher: ConnectorDispatcher): void {
    this.dispatchers.set(dispatcher.connectorName, dispatcher);
  }

  get(connectorName: string): ConnectorDispatcher | undefined {
    return this.dispatchers.get(connectorName);
  }

  has(connectorName: string): boolean {
    return this.dispatchers.has(connectorName);
  }

  listRegistered(): string[] {
    return Array.from(this.dispatchers.keys());
  }
}

// ── Plan Dispatcher ─────────────────────────────────────────────────────────

/**
 * Dispatch an entire approved plan through the connector registry.
 *
 * Steps are dispatched sequentially (fail-fast on critical errors).
 * Steps whose connector has no registered dispatcher are skipped.
 */
export async function dispatchPlan(
  steps: PlanStepInput[],
  context: DispatchContext,
  registry: DispatcherRegistry,
): Promise<DispatchResult> {
  const startedAt = new Date().toISOString();
  const results: DispatchStepResult[] = [];
  let allSuccess = true;

  for (const step of steps) {
    // Skip steps not in "ready" state
    if (step.status !== "ready") {
      results.push({
        stepId: step.stepId,
        connector: step.connector,
        status: "skipped",
        result: { reason: `Step status is "${step.status}", not "ready"` },
        completedAt: new Date().toISOString(),
      });
      continue;
    }

    // Skip steps with no connector
    if (step.connector === "none") {
      results.push({
        stepId: step.stepId,
        connector: "none",
        status: "skipped",
        result: { reason: "No connector assigned" },
        completedAt: new Date().toISOString(),
      });
      continue;
    }

    const dispatcher = registry.get(step.connector);
    if (!dispatcher) {
      results.push({
        stepId: step.stepId,
        connector: step.connector,
        status: "skipped",
        result: { reason: `No dispatcher registered for "${step.connector}"` },
        completedAt: new Date().toISOString(),
      });
      continue;
    }

    try {
      const stepResult = await dispatcher.dispatch(step, context);
      results.push(stepResult);
      if (stepResult.status === "failed") {
        allSuccess = false;
      }
    } catch (err) {
      results.push({
        stepId: step.stepId,
        connector: step.connector,
        status: "failed",
        error: err instanceof Error ? err.message : String(err),
        completedAt: new Date().toISOString(),
      });
      allSuccess = false;
    }
  }

  const dispatched = results.filter((r) => r.status === "dispatched").length;
  const failed = results.filter((r) => r.status === "failed").length;
  const skipped = results.filter((r) => r.status === "skipped").length;

  return {
    success: allSuccess,
    steps: results,
    summary: `${dispatched} dispatched, ${failed} failed, ${skipped} skipped (of ${steps.length} total)`,
    startedAt,
    completedAt: new Date().toISOString(),
  };
}
