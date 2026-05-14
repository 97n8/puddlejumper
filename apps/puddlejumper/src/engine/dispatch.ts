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
  private readonly retryPolicies = new Map<string, RetryPolicy>();

  /**
   * Register a connector dispatcher, optionally with a retry policy.
   *
   * When a retry policy is attached at registration time, dispatchPlan()
   * uses it automatically — route handlers no longer need to construct
   * one inline.
   */
  register(dispatcher: ConnectorDispatcher, retryPolicy?: RetryPolicy): void {
    this.dispatchers.set(dispatcher.connectorName, dispatcher);
    if (retryPolicy) {
      this.retryPolicies.set(dispatcher.connectorName, retryPolicy);
    }
  }

  get(connectorName: string): ConnectorDispatcher | undefined {
    return this.dispatchers.get(connectorName);
  }

  /** Get the retry policy registered for a connector (if any). */
  getRetryPolicy(connectorName: string): RetryPolicy | undefined {
    return this.retryPolicies.get(connectorName);
  }

  has(connectorName: string): boolean {
    return this.dispatchers.has(connectorName);
  }

  listRegistered(): string[] {
    return Array.from(this.dispatchers.keys());
  }
}

// ── Retry Policy ────────────────────────────────────────────────────────────

export type RetryPolicy = {
  /** Maximum number of attempts (including the first). Default: 3. */
  maxAttempts: number;
  /** Base delay in milliseconds before first retry. Default: 1000. */
  baseDelayMs: number;
  /** Called on each retry attempt (for logging/metrics). */
  onRetry?: (attempt: number, error: string, stepId: string) => void;
};

const DEFAULT_RETRY_POLICY: RetryPolicy = {
  maxAttempts: 3,
  baseDelayMs: 1000,
};

/**
 * Classify whether a dispatch failure is transient (retryable).
 *
 * Transient: 5xx HTTP status, network errors, timeouts.
 * Permanent: 4xx HTTP status, missing URL, validation errors.
 */
export function isTransientFailure(result: DispatchStepResult): boolean {
  if (result.status !== "failed" || !result.error) return false;

  // 5xx HTTP status from webhook/HTTP dispatchers
  if (/failed: 5\d{2}$/i.test(result.error)) return true;

  // Network / timeout errors
  const networkPatterns = [
    "fetch failed",
    "network",
    "ECONNREFUSED",
    "ECONNRESET",
    "ETIMEDOUT",
    "EHOSTUNREACH",
    "socket hang up",
    "UND_ERR",
    "ABORT_ERR",
    "timeout",
  ];
  const lower = result.error.toLowerCase();
  return networkPatterns.some((p) => lower.includes(p.toLowerCase()));
}

/** Sleep helper for retry backoff. */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Execute a dispatcher with retry + exponential backoff.
 *
 * Only retries on transient failures (5xx, network errors).
 * Permanent failures (4xx, validation) return immediately.
 */
export async function dispatchWithRetry(
  dispatcher: ConnectorDispatcher,
  step: PlanStepInput,
  context: DispatchContext,
  policy: RetryPolicy = DEFAULT_RETRY_POLICY,
): Promise<{ result: DispatchStepResult; retries: number }> {
  let lastResult: DispatchStepResult;
  let retries = 0;

  for (let attempt = 1; attempt <= policy.maxAttempts; attempt++) {
    try {
      lastResult = await dispatcher.dispatch(step, context);
    } catch (err) {
      // Unexpected throw — wrap as a failed result
      lastResult = {
        stepId: step.stepId,
        connector: step.connector,
        status: "failed",
        error: err instanceof Error ? err.message : String(err),
        completedAt: new Date().toISOString(),
      };
    }

    // Success or permanent failure — return immediately
    if (lastResult!.status !== "failed" || !isTransientFailure(lastResult!)) {
      return { result: lastResult!, retries };
    }

    // Transient failure — retry if we have attempts remaining
    if (attempt < policy.maxAttempts) {
      retries++;
      policy.onRetry?.(attempt, lastResult!.error ?? "unknown", step.stepId);
      const delay = policy.baseDelayMs * Math.pow(2, attempt - 1);
      await sleep(delay);
    }
  }

  // Exhausted all retries
  retries = policy.maxAttempts - 1;
  return { result: lastResult!, retries };
}

// ── Plan Dispatcher ─────────────────────────────────────────────────────────

/**
 * Dispatch an entire approved plan through the connector registry.
 *
 * Steps are dispatched sequentially (fail-fast on critical errors).
 * Steps whose connector has no registered dispatcher are skipped.
 * Each step is retried with exponential backoff on transient failures.
 */
/**
 * Dispatch an entire approved plan through the connector registry.
 *
 * Retry policy resolution order (per step):
 *   1. Per-connector policy from registry.getRetryPolicy(connector)
 *   2. Caller-provided fallback retryPolicy
 *   3. DEFAULT_RETRY_POLICY
 */
export async function dispatchPlan(
  steps: PlanStepInput[],
  context: DispatchContext,
  registry: DispatcherRegistry,
  retryPolicy?: RetryPolicy,
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

    const effectivePolicy = registry.getRetryPolicy(step.connector) ?? retryPolicy;
    const { result: stepResult } = await dispatchWithRetry(
      dispatcher, step, context, effectivePolicy,
    );
    results.push(stepResult);
    if (stepResult.status === "failed") {
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
