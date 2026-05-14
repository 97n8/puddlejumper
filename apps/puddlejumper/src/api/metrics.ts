// ─────────────────────────────────────────────────────────────────────────────
// Governance Metrics — PublicLogic System Architecture Part 5 (Observability)
// ─────────────────────────────────────────────────────────────────────────────
// These are the 10 canonical metric names per System Architecture FINAL.
// LOCKED — do not rename. Alert thresholds defined in architecture doc.
//
// Implementation uses PJ's in-process metrics infrastructure (ApprovalMetrics
// pattern). If prom-client is added in the future, replace the backing
// implementation while keeping these exported names unchanged.
// ─────────────────────────────────────────────────────────────────────────────

import { ApprovalMetrics } from '../engine/approvalMetrics.js';

// ── Canonical metric name constants ──────────────────────────────────────────
// These names are frozen per System Architecture FINAL Part 5.

export const GOVERNANCE_METRIC = {
  // archieve_log_duration_ms — target < 5ms p99. > 15ms p99 sustained → migration trigger
  ARCHIEVE_LOG_DURATION_MS: 'archieve_log_duration_ms',

  // archieve_wal_depth — > 100 warn, > 1000 critical, > 10000 → 503
  ARCHIEVE_WAL_DEPTH: 'archieve_wal_depth',

  // archieve_chain_verifications_total — any violation → page on-call
  ARCHIEVE_CHAIN_VERIFICATIONS_TOTAL: 'archieve_chain_verifications_total',

  // archieve_sqlite_busy_total — any > 0/min sustained → migration evaluation
  ARCHIEVE_SQLITE_BUSY_TOTAL: 'archieve_sqlite_busy_total',

  // seal_failure_total — any non-zero → page on-call
  SEAL_FAILURE_TOTAL: 'seal_failure_total',

  // governance_pipeline_duration_ms — p95 > 2000ms → investigate
  GOVERNANCE_PIPELINE_DURATION_MS: 'governance_pipeline_duration_ms',

  // dispatch_failure_total — any → alert ops
  DISPATCH_FAILURE_TOTAL: 'dispatch_failure_total',

  // gex_total — > 5/week on same action type → governance review
  // NOTE: GEX (Governance Exception Path) not yet implemented. Stub reserves the metric name.
  GEX_TOTAL: 'gex_total',

  // idempotency_conflict_total — any → investigate immediately
  IDEMPOTENCY_CONFLICT_TOTAL: 'idempotency_conflict_total',

  // approval_pending_age_seconds — > 86400s (24h) → notify approver
  APPROVAL_PENDING_AGE_SECONDS: 'approval_pending_age_seconds',
} as const;

// ── Singleton governance metrics instance ─────────────────────────────────────

export const governanceMetrics = new ApprovalMetrics();

// ── Alert threshold documentation ─────────────────────────────────────────────
// These thresholds are locked per System Architecture FINAL Part 5.

export const GOVERNANCE_METRIC_HELP: Record<string, string> = {
  [GOVERNANCE_METRIC.ARCHIEVE_LOG_DURATION_MS]:
    'ARCHIEVE write latency in milliseconds. Labels: tenant_id, event_type. Alert: p99 > 15ms sustained → migration trigger',
  [GOVERNANCE_METRIC.ARCHIEVE_WAL_DEPTH]:
    'Undelivered events in ARCHIEVE WAL queue. Labels: tenant_id. Alert: > 100 warn · > 1000 critical · > 10000 → 503',
  [GOVERNANCE_METRIC.ARCHIEVE_CHAIN_VERIFICATIONS_TOTAL]:
    'ARCHIEVE chain verifications run. Labels: tenant_id, result (valid|violation). Alert: any violation → page on-call',
  [GOVERNANCE_METRIC.ARCHIEVE_SQLITE_BUSY_TOTAL]:
    'SQLite BUSY errors by operation type. Labels: operation (wal_insert|delivery|verification|export). Alert: > 0/min sustained → migration evaluation',
  [GOVERNANCE_METRIC.SEAL_FAILURE_TOTAL]:
    'SEAL application failures. Labels: reason. Alert: any non-zero → page on-call',
  [GOVERNANCE_METRIC.GOVERNANCE_PIPELINE_DURATION_MS]:
    'Full governance pipeline duration in milliseconds. Labels: outcome (approved|rejected|error). Alert: p95 > 2000ms → investigate',
  [GOVERNANCE_METRIC.DISPATCH_FAILURE_TOTAL]:
    'Dispatch failures after all retries exhausted. Labels: dispatcher (github|slack|webhook|sharepoint). Alert: any → alert ops',
  [GOVERNANCE_METRIC.GEX_TOTAL]:
    'Governance Exception Path activations. Labels: gex_type (escalation|emergency|superseding|elevation|governance_gap), outcome. Alert: > 5/week same action type → governance review. STUB — wire when GEX is implemented.',
  [GOVERNANCE_METRIC.IDEMPOTENCY_CONFLICT_TOTAL]:
    'requestId reused with different payload hash. Labels: workspace_id. Alert: any → investigate immediately',
  [GOVERNANCE_METRIC.APPROVAL_PENDING_AGE_SECONDS]:
    'Age of oldest pending approval per workspace in seconds. Labels: workspace_id. Alert: > 86400s (24h) → notify approver',
};
