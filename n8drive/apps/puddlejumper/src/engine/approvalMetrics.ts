// ── Approval Metrics ────────────────────────────────────────────────────────
//
// Lightweight in-process counters and gauges for the approval gate
// and dispatch pipeline. Emits structured JSON logs compatible with
// the existing logServerInfo pattern and exposes a /metrics-style
// summary endpoint.
//
// Usage:
//   import { approvalMetrics } from "../engine/approvalMetrics.js";
//   approvalMetrics.increment("approvals_created");
//   approvalMetrics.observe("approval_time_seconds", durationSec);
//

// ── Types ───────────────────────────────────────────────────────────────────

export type MetricEntry = {
  name: string;
  type: "counter" | "gauge" | "histogram";
  value: number;
  labels?: Record<string, string>;
};

type HistogramBucket = {
  le: number;
  count: number;
};

type HistogramState = {
  sum: number;
  count: number;
  buckets: HistogramBucket[];
};

// ── Default histogram buckets (seconds) ─────────────────────────────────────

const DEFAULT_BUCKETS = [0.1, 0.5, 1, 5, 10, 30, 60, 300, 600, 1800, 3600];

// ── ApprovalMetrics class ───────────────────────────────────────────────────

export class ApprovalMetrics {
  private readonly counters = new Map<string, number>();
  private readonly gauges = new Map<string, number>();
  private readonly histograms = new Map<string, HistogramState>();

  // ── Counter operations ──────────────────────────────────────────────────

  increment(name: string, delta: number = 1): void {
    this.counters.set(name, (this.counters.get(name) ?? 0) + delta);
  }

  // ── Gauge operations ────────────────────────────────────────────────────

  setGauge(name: string, value: number): void {
    this.gauges.set(name, value);
  }

  incrementGauge(name: string, delta: number = 1): void {
    this.gauges.set(name, (this.gauges.get(name) ?? 0) + delta);
  }

  decrementGauge(name: string, delta: number = 1): void {
    this.gauges.set(name, (this.gauges.get(name) ?? 0) - delta);
  }

  // ── Histogram operations ────────────────────────────────────────────────

  observe(name: string, value: number): void {
    let state = this.histograms.get(name);
    if (!state) {
      state = {
        sum: 0,
        count: 0,
        buckets: DEFAULT_BUCKETS.map((le) => ({ le, count: 0 })),
      };
      this.histograms.set(name, state);
    }
    state.sum += value;
    state.count += 1;
    for (const bucket of state.buckets) {
      if (value <= bucket.le) {
        bucket.count += 1;
      }
    }
  }

  // ── Snapshot ────────────────────────────────────────────────────────────

  /** Return all metrics as a flat array (useful for JSON /metrics endpoint). */
  snapshot(): MetricEntry[] {
    const entries: MetricEntry[] = [];

    for (const [name, value] of this.counters) {
      entries.push({ name, type: "counter", value });
    }
    for (const [name, value] of this.gauges) {
      entries.push({ name, type: "gauge", value });
    }
    for (const [name, state] of this.histograms) {
      entries.push({ name: `${name}_count`, type: "histogram", value: state.count });
      entries.push({ name: `${name}_sum`, type: "histogram", value: state.sum });
      for (const bucket of state.buckets) {
        entries.push({
          name: `${name}_bucket`,
          type: "histogram",
          value: bucket.count,
          labels: { le: String(bucket.le) },
        });
      }
    }

    return entries;
  }

  /** Return Prometheus text exposition format with HELP and TYPE annotations. */
  prometheus(helpMap?: Record<string, string>): string {
    const lines: string[] = [];
    const help = (name: string) => helpMap?.[name] ?? "";

    for (const [name, value] of this.counters) {
      const h = help(name);
      if (h) lines.push(`# HELP ${name} ${h}`);
      lines.push(`# TYPE ${name} counter`);
      lines.push(`${name} ${value}`);
    }
    for (const [name, value] of this.gauges) {
      const h = help(name);
      if (h) lines.push(`# HELP ${name} ${h}`);
      lines.push(`# TYPE ${name} gauge`);
      lines.push(`${name} ${value}`);
    }
    for (const [name, state] of this.histograms) {
      const h = help(name);
      if (h) lines.push(`# HELP ${name} ${h}`);
      lines.push(`# TYPE ${name} histogram`);
      for (const bucket of state.buckets) {
        lines.push(`${name}_bucket{le="${bucket.le}"} ${bucket.count}`);
      }
      lines.push(`${name}_bucket{le="+Inf"} ${state.count}`);
      lines.push(`${name}_sum ${state.sum}`);
      lines.push(`${name}_count ${state.count}`);
    }

    return lines.join("\n") + "\n";
  }

  /** Reset all metrics (useful for testing). */
  reset(): void {
    this.counters.clear();
    this.gauges.clear();
    this.histograms.clear();
  }
}

// ── Singleton instance ──────────────────────────────────────────────────────

export const approvalMetrics = new ApprovalMetrics();

// ── Structured log emitter (mirrors logServerInfo pattern) ──────────────────

/**
 * Emit a structured approval lifecycle event to stdout.
 * These events are searchable in Fly logs and can feed alerting.
 */
export function emitApprovalEvent(
  event: string,
  details: Record<string, unknown>,
): void {
  const serialized = {
    level: "info",
    scope: `approval.${event}`,
    timestamp: new Date().toISOString(),
    ...details,
  };
  // eslint-disable-next-line no-console
  console.info(JSON.stringify(serialized));
}

// ── Pre-defined metric names ────────────────────────────────────────────────

export const METRIC = {
  // Counters
  APPROVALS_CREATED: "approvals_created_total",
  APPROVALS_APPROVED: "approvals_approved_total",
  APPROVALS_REJECTED: "approvals_rejected_total",
  APPROVALS_EXPIRED: "approvals_expired_total",
  DISPATCH_SUCCESS: "dispatch_success_total",
  DISPATCH_FAILURE: "dispatch_failure_total",
  CONSUME_CAS_SUCCESS: "consume_for_dispatch_success_total",
  CONSUME_CAS_CONFLICT: "consume_for_dispatch_conflict_total",
  DISPATCH_RETRY: "dispatch_retry_total",

  // Gauges
  PENDING_GAUGE: "approval_pending_gauge",
  CHAIN_STEP_PENDING_GAUGE: "approval_chain_step_pending_gauge",

  // Histograms
  APPROVAL_TIME: "approval_time_seconds",
  DISPATCH_LATENCY: "dispatch_latency_seconds",
  CHAIN_STEP_TIME: "approval_chain_step_time_seconds",

  // Chain counters
  CHAIN_STEPS_TOTAL: "approval_chain_steps_total",
  CHAIN_STEP_DECIDED: "approval_chain_step_decided_total",
  CHAIN_COMPLETED: "approval_chain_completed_total",
  CHAIN_REJECTED: "approval_chain_rejected_total",
} as const;

/** Human-readable HELP strings for each metric (used in Prometheus output). */
export const METRIC_HELP: Record<string, string> = {
  [METRIC.APPROVALS_CREATED]:   "Total approvals created via governance gate",
  [METRIC.APPROVALS_APPROVED]:  "Total approvals decided as approved",
  [METRIC.APPROVALS_REJECTED]:  "Total approvals decided as rejected",
  [METRIC.APPROVALS_EXPIRED]:   "Total approvals that expired before decision",
  [METRIC.DISPATCH_SUCCESS]:    "Total successful dispatches to connectors",
  [METRIC.DISPATCH_FAILURE]:    "Total failed dispatches to connectors",
  [METRIC.CONSUME_CAS_SUCCESS]: "Successful CAS operations for dispatch lock",
  [METRIC.CONSUME_CAS_CONFLICT]:"CAS conflicts when acquiring dispatch lock (double-dispatch prevented)",
  dispatch_retry_total:          "Total retry attempts across all dispatcher dispatch calls",
  [METRIC.PENDING_GAUGE]:       "Current number of approvals in pending state",
  [METRIC.CHAIN_STEP_PENDING_GAUGE]: "Current number of chain steps in active (awaiting decision) state",
  [METRIC.APPROVAL_TIME]:       "Time in seconds from approval creation to decision",
  [METRIC.DISPATCH_LATENCY]:    "Time in seconds for dispatch plan execution",
  [METRIC.CHAIN_STEP_TIME]:     "Time in seconds from chain step activation to decision",
  [METRIC.CHAIN_STEPS_TOTAL]:   "Total chain steps created across all approvals",
  [METRIC.CHAIN_STEP_DECIDED]:  "Total chain steps decided (label: status=approved|rejected)",
  [METRIC.CHAIN_COMPLETED]:     "Total approval chains fully approved (all steps passed)",
  [METRIC.CHAIN_REJECTED]:      "Total approval chains rejected at any step",
};
