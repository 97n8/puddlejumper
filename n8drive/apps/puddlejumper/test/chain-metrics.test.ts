// ── Chain Metrics Tests ──────────────────────────────────────────────────────
//
// Verifies that the 6 chain Prometheus metrics from the architecture appendix
// are correctly defined and that the ApprovalMetrics class tracks them.
//
import { describe, it, expect, beforeEach } from "vitest";
import { ApprovalMetrics, METRIC, METRIC_HELP } from "../src/engine/approvalMetrics.js";

// ── Tests ───────────────────────────────────────────────────────────────────

describe("Chain metrics constants", () => {
  it("defines all 6 chain metric names", () => {
    expect(METRIC.CHAIN_STEPS_TOTAL).toBe("approval_chain_steps_total");
    expect(METRIC.CHAIN_STEP_DECIDED).toBe("approval_chain_step_decided_total");
    expect(METRIC.CHAIN_COMPLETED).toBe("approval_chain_completed_total");
    expect(METRIC.CHAIN_REJECTED).toBe("approval_chain_rejected_total");
    expect(METRIC.CHAIN_STEP_PENDING_GAUGE).toBe("approval_chain_step_pending_gauge");
    expect(METRIC.CHAIN_STEP_TIME).toBe("approval_chain_step_time_seconds");
  });

  it("has HELP strings for all chain metrics", () => {
    expect(METRIC_HELP[METRIC.CHAIN_STEPS_TOTAL]).toBeTruthy();
    expect(METRIC_HELP[METRIC.CHAIN_STEP_DECIDED]).toBeTruthy();
    expect(METRIC_HELP[METRIC.CHAIN_COMPLETED]).toBeTruthy();
    expect(METRIC_HELP[METRIC.CHAIN_REJECTED]).toBeTruthy();
    expect(METRIC_HELP[METRIC.CHAIN_STEP_PENDING_GAUGE]).toBeTruthy();
    expect(METRIC_HELP[METRIC.CHAIN_STEP_TIME]).toBeTruthy();
  });
});

describe("Chain metrics instrumentation", () => {
  let metrics: ApprovalMetrics;

  beforeEach(() => {
    metrics = new ApprovalMetrics();
  });

  it("tracks chain steps created counter", () => {
    metrics.increment(METRIC.CHAIN_STEPS_TOTAL, 3);
    const snap = metrics.snapshot();
    const entry = snap.find((e) => e.name === METRIC.CHAIN_STEPS_TOTAL);
    expect(entry).toBeDefined();
    expect(entry!.type).toBe("counter");
    expect(entry!.value).toBe(3);
  });

  it("tracks chain step decided counter", () => {
    metrics.increment(METRIC.CHAIN_STEP_DECIDED);
    metrics.increment(METRIC.CHAIN_STEP_DECIDED);
    const snap = metrics.snapshot();
    const entry = snap.find((e) => e.name === METRIC.CHAIN_STEP_DECIDED);
    expect(entry!.value).toBe(2);
  });

  it("tracks chain completed counter", () => {
    metrics.increment(METRIC.CHAIN_COMPLETED);
    const snap = metrics.snapshot();
    const entry = snap.find((e) => e.name === METRIC.CHAIN_COMPLETED);
    expect(entry!.value).toBe(1);
  });

  it("tracks chain rejected counter", () => {
    metrics.increment(METRIC.CHAIN_REJECTED);
    const snap = metrics.snapshot();
    const entry = snap.find((e) => e.name === METRIC.CHAIN_REJECTED);
    expect(entry!.value).toBe(1);
  });

  it("tracks chain step pending gauge", () => {
    metrics.setGauge(METRIC.CHAIN_STEP_PENDING_GAUGE, 5);
    const snap = metrics.snapshot();
    const entry = snap.find((e) => e.name === METRIC.CHAIN_STEP_PENDING_GAUGE);
    expect(entry!.type).toBe("gauge");
    expect(entry!.value).toBe(5);
  });

  it("tracks chain step time histogram", () => {
    metrics.observe(METRIC.CHAIN_STEP_TIME, 120); // 2 minutes
    metrics.observe(METRIC.CHAIN_STEP_TIME, 3600); // 1 hour
    const snap = metrics.snapshot();
    const countEntry = snap.find((e) => e.name === `${METRIC.CHAIN_STEP_TIME}_count`);
    const sumEntry = snap.find((e) => e.name === `${METRIC.CHAIN_STEP_TIME}_sum`);
    expect(countEntry!.value).toBe(2);
    expect(sumEntry!.value).toBe(3720);
  });

  it("emits chain metrics in Prometheus format", () => {
    metrics.increment(METRIC.CHAIN_STEPS_TOTAL, 5);
    metrics.increment(METRIC.CHAIN_COMPLETED, 2);
    metrics.setGauge(METRIC.CHAIN_STEP_PENDING_GAUGE, 3);
    metrics.observe(METRIC.CHAIN_STEP_TIME, 60);

    const output = metrics.prometheus(METRIC_HELP);
    expect(output).toContain("# HELP approval_chain_steps_total");
    expect(output).toContain("# TYPE approval_chain_steps_total counter");
    expect(output).toContain("approval_chain_steps_total 5");
    expect(output).toContain("# HELP approval_chain_step_pending_gauge");
    expect(output).toContain("approval_chain_step_pending_gauge 3");
    expect(output).toContain("# TYPE approval_chain_step_time_seconds histogram");
  });

  it("reset clears chain metrics", () => {
    metrics.increment(METRIC.CHAIN_STEPS_TOTAL, 10);
    metrics.setGauge(METRIC.CHAIN_STEP_PENDING_GAUGE, 3);
    metrics.observe(METRIC.CHAIN_STEP_TIME, 60);
    metrics.reset();
    const snap = metrics.snapshot();
    expect(snap).toHaveLength(0);
  });
});
