/**
 * FiscalIntel Intelligence Engine
 * Computes derived metrics and risk flags from raw DLS data.
 *
 * Risk thresholds based on MA DLS advisory guidelines and best practices.
 */

import type { Database } from "better-sqlite3";
import { getRaw, upsertSnapshot, type FiscalMetrics, type RiskFlag } from "./db.js";
import { findByName, getPeers } from "./municipalities.js";

const DATASETS = {
  STAB: "stabilization",
  OVERLAY: "overlay",
} as const;

// ── Metric computation ────────────────────────────────────────────────────────

function trend(current: number | null, prior: number | null): "up" | "down" | "stable" | null {
  if (current === null || prior === null) return null;
  const pct = prior === 0 ? 0 : (current - prior) / Math.abs(prior);
  if (pct > 0.02) return "up";
  if (pct < -0.02) return "down";
  return "stable";
}

export function computeMetrics(db: Database, municipality: string, latestFy: number): FiscalMetrics {
  const stabData = getRaw(db, municipality, DATASETS.STAB);
  const overlayData = getRaw(db, municipality, DATASETS.OVERLAY);

  // Build keyed maps by fiscal year
  const stabByFy = Object.fromEntries(stabData.map((r) => [r.fiscal_year, r.data]));
  const overlayByFy = Object.fromEntries(overlayData.map((r) => [r.fiscal_year, r.data]));

  const latestStab = stabByFy[latestFy];
  const priorStab = stabByFy[latestFy - 1];
  const latestOverlay = overlayByFy[latestFy];
  const priorOverlay = overlayByFy[latestFy - 1];

  const stabilizationBalance = latestStab?.totalStab ?? null;
  const operatingBudget = latestStab?.operatingBudget ?? null;
  const stabilizationPctBudget = latestStab?.totalStabPct ?? null;
  const overlayAppropriation = latestOverlay?.overlayAppropriation ?? null;
  const totalLevy = latestOverlay?.totalLevy ?? null;
  const overlayPctLevy = latestOverlay?.overlayPctLevy ?? null;

  // Multi-year series for charts (last 5 years)
  const fyRange = [latestFy - 4, latestFy - 3, latestFy - 2, latestFy - 1, latestFy];
  const stabilizationSeries = fyRange
    .map((fy) => ({ fy, value: stabByFy[fy]?.totalStab as number ?? null }))
    .filter((p): p is { fy: number; value: number } => p.value !== null);

  const levySeries = fyRange
    .map((fy) => ({ fy, value: overlayByFy[fy]?.totalLevy as number ?? null }))
    .filter((p): p is { fy: number; value: number } => p.value !== null);

  return {
    stabilizationBalance: stabilizationBalance as number | null,
    stabilizationPctBudget: stabilizationPctBudget as number | null,
    operatingBudget: operatingBudget as number | null,
    overlayAppropriation: overlayAppropriation as number | null,
    totalLevy: totalLevy as number | null,
    overlayPctLevy: overlayPctLevy as number | null,
    certifiedFreeCash: null,       // populated when free cash data source added
    freeCashPctBudget: null,
    stabilizationTrend: trend(
      stabilizationBalance as number | null,
      priorStab?.totalStab as number | null ?? null
    ),
    levyTrend: trend(
      totalLevy as number | null,
      priorOverlay?.totalLevy as number | null ?? null
    ),
    stabilizationSeries,
    levySeries,
  };
}

// ── Risk flags ────────────────────────────────────────────────────────────────

/**
 * MA DLS advisory thresholds for fiscal health indicators.
 * Sources: DLS Best Practices, Free Cash Policy Guidance, FY2025 Review Criteria
 */
export function generateRiskFlags(metrics: FiscalMetrics): RiskFlag[] {
  const flags: RiskFlag[] = [];

  // Free cash check
  if (metrics.freeCashPctBudget !== null) {
    if (metrics.freeCashPctBudget < 2.5) {
      flags.push({
        code: "FREE_CASH_CRITICAL",
        label: "Free Cash Critically Low",
        severity: "critical",
        detail: `Certified free cash is ${metrics.freeCashPctBudget.toFixed(1)}% of operating budget. DLS recommends maintaining ≥5%.`,
        threshold: "< 2.5% of budget",
      });
    } else if (metrics.freeCashPctBudget < 5) {
      flags.push({
        code: "FREE_CASH_LOW",
        label: "Free Cash Below Recommended Level",
        severity: "warning",
        detail: `Free cash at ${metrics.freeCashPctBudget.toFixed(1)}% of operating budget. DLS recommends ≥5% as a buffer.`,
        threshold: "< 5% of budget",
      });
    }
  }

  // Stabilization check
  if (metrics.stabilizationPctBudget !== null) {
    if (metrics.stabilizationPctBudget < 2) {
      flags.push({
        code: "STAB_CRITICAL",
        label: "Stabilization Fund Critically Low",
        severity: "critical",
        detail: `Stabilization fund is ${metrics.stabilizationPctBudget.toFixed(1)}% of budget. This provides minimal protection against revenue shortfalls.`,
        threshold: "< 2% of budget",
      });
    } else if (metrics.stabilizationPctBudget < 5) {
      flags.push({
        code: "STAB_LOW",
        label: "Stabilization Fund Below Best Practice",
        severity: "warning",
        detail: `Stabilization at ${metrics.stabilizationPctBudget.toFixed(1)}% of operating budget. DLS best practice is ≥5%.`,
        threshold: "< 5% of budget",
      });
    }
  }

  // Overlay check — high overlay eats into the levy
  if (metrics.overlayPctLevy !== null) {
    if (metrics.overlayPctLevy > 3) {
      flags.push({
        code: "OVERLAY_HIGH",
        label: "Overlay Appropriation Elevated",
        severity: "warning",
        detail: `Overlay is ${metrics.overlayPctLevy.toFixed(1)}% of total levy — may signal significant abatement risk or assessment appeals.`,
        threshold: "> 3% of levy",
      });
    } else if (metrics.overlayPctLevy > 2) {
      flags.push({
        code: "OVERLAY_ELEVATED",
        label: "Overlay Above Average",
        severity: "info",
        detail: `Overlay at ${metrics.overlayPctLevy.toFixed(1)}% of levy. Worth monitoring — typical range is 1–2%.`,
        threshold: "> 2% of levy",
      });
    }
  }

  // Stabilization trend
  if (metrics.stabilizationTrend === "down" && metrics.stabilizationBalance !== null) {
    flags.push({
      code: "STAB_DECLINING",
      label: "Stabilization Fund Decreasing",
      severity: "info",
      detail: "Stabilization fund balance declined year-over-year. If the trend continues, fund adequacy may be at risk.",
      threshold: "YoY decline",
    });
  }

  return flags;
}

// ── Peer benchmarking ─────────────────────────────────────────────────────────

export interface PeerComparison {
  municipality: string;
  metric: string;
  value: number | null;
  peerMedian: number | null;
  peerCount: number;
  percentile: number | null;    // 0–100, where town falls among peers
  rank: number | null;          // 1 = best
}

export function computePeerComparisons(
  db: Database,
  municipality: string,
  fiscalYear: number,
  metrics: FiscalMetrics
): PeerComparison[] {
  const peers = getPeers(municipality);
  const peerNames = peers.map((p) => p.name);

  // Get stabilization % for all peers
  const peerStabRows = peerNames.flatMap((name) => {
    const raw = getRaw(db, name, DATASETS.STAB).find((r) => r.fiscal_year === fiscalYear);
    if (!raw) return [];
    const pct = raw.data.totalStabPct as number | null;
    return pct !== null ? [{ name, value: pct }] : [];
  });

  const peerOverlayRows = peerNames.flatMap((name) => {
    const raw = getRaw(db, name, DATASETS.OVERLAY).find((r) => r.fiscal_year === fiscalYear);
    if (!raw) return [];
    const pct = raw.data.overlayPctLevy as number | null;
    return pct !== null ? [{ name, value: pct }] : [];
  });

  const results: PeerComparison[] = [];

  const mkComparison = (
    metric: string,
    myValue: number | null,
    peerValues: Array<{ name: string; value: number }>,
    lowerIsBetter = false
  ): PeerComparison => {
    const sorted = [...peerValues].sort((a, b) =>
      lowerIsBetter ? a.value - b.value : b.value - a.value
    );
    const median =
      sorted.length === 0
        ? null
        : sorted.length % 2 === 0
        ? (sorted[sorted.length / 2 - 1].value + sorted[sorted.length / 2].value) / 2
        : sorted[Math.floor(sorted.length / 2)].value;

    let percentile: number | null = null;
    let rank: number | null = null;
    if (myValue !== null && peerValues.length > 0) {
      const below = peerValues.filter((p) =>
        lowerIsBetter ? p.value > myValue : p.value < myValue
      ).length;
      percentile = Math.round((below / peerValues.length) * 100);
      const allWithMe = [...peerValues, { name: municipality, value: myValue }].sort(
        (a, b) => (lowerIsBetter ? a.value - b.value : b.value - a.value)
      );
      rank = allWithMe.findIndex((p) => p.name === municipality) + 1;
    }

    return {
      municipality,
      metric,
      value: myValue,
      peerMedian: median,
      peerCount: peerValues.length,
      percentile,
      rank,
    };
  };

  results.push(
    mkComparison("stabilizationPctBudget", metrics.stabilizationPctBudget, peerStabRows),
    mkComparison("overlayPctLevy", metrics.overlayPctLevy, peerOverlayRows, true)
  );

  return results;
}

// ── Compute & store a full snapshot ─────────────────────────────────────────

export function buildAndStoreSnapshot(
  db: Database,
  municipality: string,
  fiscalYear: number
): void {
  const muni = findByName(municipality);
  const metrics = computeMetrics(db, municipality, fiscalYear);
  const risks = generateRiskFlags(metrics);
  upsertSnapshot(db, {
    municipality,
    fiscalYear,
    metrics,
    risks,
    computedAt: new Date().toISOString(),
  });
}
