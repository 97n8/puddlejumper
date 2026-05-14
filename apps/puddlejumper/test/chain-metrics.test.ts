import { describe, it, expect, beforeEach } from "vitest";
import { ApprovalMetrics, METRIC, METRIC_HELP } from "../src/engine/approvalMetrics.js";

describe("Chain metrics constants", () => {
  it("defines chain metric names", () => {
    expect(METRIC.CHAIN_STEPS_TOTAL).toBe("approval_chain_steps_total");
    expect(METRIC.CHAIN_STEP_DECIDED).toBe("approval_chain_step_decided_total");
    expect(METRIC.CHAIN_COMPLETED).toBe("approval_chain_completed_total");
    expect(METRIC.CHAIN_REJECTED).toBe("approval_chain_rejected_total");
    expect(METRIC.CHAIN_STEP_PENDING_GAUGE).toBe("approval_chain_step_pending_gauge");
    expect(METRIC.CHAIN_STEP_TIME).toBe("approval_chain_step_time_seconds");
  });

  it("has HELP strings for chain metrics", () => {
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

  it("tracks chain counters and gauges", () => {
    metrics.increment(METRIC.CHAIN_STEPS_TOTAL, 3);
    metrics.increment(METRIC.CHAIN_STEP_DECIDED, 2);
    metrics.increment(METRIC.CHAIN_COMPLETED);
    metrics.increment(METRIC.CHAIN_REJECTED);
    metrics.setGauge(METRIC.CHAIN_STEP_PENDING_GAUGE, 5);

    const snap = metrics.snapshot();
    expect(snap.find((entry) => entry.name === METRIC.CHAIN_STEPS_TOTAL)?.value).toBe(3);
    expect(snap.find((entry) => entry.name === METRIC.CHAIN_STEP_DECIDED)?.value).toBe(2);
    expect(snap.find((entry) => entry.name === METRIC.CHAIN_COMPLETED)?.value).toBe(1);
    expect(snap.find((entry) => entry.name === METRIC.CHAIN_REJECTED)?.value).toBe(1);
    expect(snap.find((entry) => entry.name === METRIC.CHAIN_STEP_PENDING_GAUGE)?.value).toBe(5);
  });

  it("tracks chain step latency histogram and emits Prometheus output", () => {
    metrics.observe(METRIC.CHAIN_STEP_TIME, 120);
    metrics.observe(METRIC.CHAIN_STEP_TIME, 3600);

    const snap = metrics.snapshot();
    expect(snap.find((entry) => entry.name === `${METRIC.CHAIN_STEP_TIME}_count`)?.value).toBe(2);
    expect(snap.find((entry) => entry.name === `${METRIC.CHAIN_STEP_TIME}_sum`)?.value).toBe(3720);

    const prometheus = metrics.prometheus(METRIC_HELP);
    expect(prometheus).toContain(`# HELP ${METRIC.CHAIN_STEP_TIME}`);
    expect(prometheus).toContain(`# TYPE ${METRIC.CHAIN_STEP_TIME} histogram`);
    expect(prometheus).toContain(`${METRIC.CHAIN_STEP_TIME}_count 2`);
  });

  it("reset clears chain metrics", () => {
    metrics.increment(METRIC.CHAIN_STEPS_TOTAL, 10);
    metrics.setGauge(METRIC.CHAIN_STEP_PENDING_GAUGE, 3);
    metrics.observe(METRIC.CHAIN_STEP_TIME, 60);
    metrics.reset();
    expect(metrics.snapshot()).toHaveLength(0);
  });
});
