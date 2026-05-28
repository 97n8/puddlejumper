/**
 * FiscalIntel — MA DLS data shapes matching puddlejumper/src/fiscalintel
 * 
 * Real connector (connector.ts) POSTs to DLS rdPage.aspx with iclMuni + iclYear filters.
 * htmlParser.ts extracts rows from HTML tables.
 * This file provides the parsed/computed snapshots per town.
 * 
 * DLS Reports:
 *   STABILIZATION = "Dashboard.Cat_1_Reports.StablPerBudget351"
 *   OVERLAY_LEVY  = "Dashboard.Cat_1_Reports.OL1PerLevy351"
 *   FREE_CASH_PROOF = "BalanceSheet.FreecashProofComp"
 */

export interface FiscalSnapshot {
  municipality: string;
  fiscalYear: number;
  computedAt: string;
  metrics: {
    totalLevy: number;
    operatingBudget: number;
    stabilizationBalance: number;
    freeCash: number;
    overlayBalance: number;
    excessLevy: number;
    debtService: number;
    reserveRatio: number;        // stabilization / operatingBudget
    freeCashRatio: number;       // freeCash / operatingBudget
  };
  riskFlags: RiskFlag[];
}

export interface RiskFlag {
  code: string;
  severity: 'high' | 'medium' | 'low';
  message: string;
  threshold: string;
  actual: string;
}

// DLS-shaped fiscal data for each town (matches parseDlsTable output)
export const FISCAL_SNAPSHOTS: Record<string, FiscalSnapshot> = {
  phillipston: {
    municipality: 'Phillipston',
    fiscalYear: 2026,
    computedAt: '2026-04-01T06:00:00Z',
    metrics: {
      totalLevy: 4_218_450,
      operatingBudget: 5_842_100,
      stabilizationBalance: 412_300,
      freeCash: 287_600,
      overlayBalance: 45_200,
      excessLevy: 198_700,
      debtService: 142_000,
      reserveRatio: 0.0706,
      freeCashRatio: 0.0492,
    },
    riskFlags: [
      { code: 'LOW_FREE_CASH', severity: 'medium', message: 'Free cash below 5% of operating budget', threshold: '≥5%', actual: '4.92%' },
    ],
  },
  westminster: {
    municipality: 'Westminster',
    fiscalYear: 2026,
    computedAt: '2026-04-01T06:00:00Z',
    metrics: {
      totalLevy: 18_742_300,
      operatingBudget: 24_150_000,
      stabilizationBalance: 1_890_400,
      freeCash: 1_450_200,
      overlayBalance: 189_000,
      excessLevy: 845_000,
      debtService: 1_240_000,
      reserveRatio: 0.0783,
      freeCashRatio: 0.0600,
    },
    riskFlags: [],
  },
  sutton: {
    municipality: 'Sutton',
    fiscalYear: 2026,
    computedAt: '2026-04-01T06:00:00Z',
    metrics: {
      totalLevy: 24_891_000,
      operatingBudget: 31_200_000,
      stabilizationBalance: 3_120_000,
      freeCash: 2_184_000,
      overlayBalance: 312_000,
      excessLevy: 1_120_000,
      debtService: 2_100_000,
      reserveRatio: 0.1000,
      freeCashRatio: 0.0700,
    },
    riskFlags: [],
  },
  arlington: {
    municipality: 'Arlington',
    fiscalYear: 2026,
    computedAt: '2026-04-01T06:00:00Z',
    metrics: {
      totalLevy: 142_500_000,
      operatingBudget: 198_400_000,
      stabilizationBalance: 8_920_000,
      freeCash: 7_140_000,
      overlayBalance: 2_180_000,
      excessLevy: 4_250_000,
      debtService: 18_900_000,
      reserveRatio: 0.0450,
      freeCashRatio: 0.0360,
    },
    riskFlags: [
      { code: 'LOW_RESERVE', severity: 'medium', message: 'Stabilization fund below 5% of operating budget', threshold: '≥5%', actual: '4.50%' },
      { code: 'LOW_FREE_CASH', severity: 'high', message: 'Free cash below 4% of operating budget', threshold: '≥5%', actual: '3.60%' },
      { code: 'HIGH_DEBT', severity: 'medium', message: 'Debt service exceeds 8% of operating budget', threshold: '≤8%', actual: '9.53%' },
    ],
  },
  templeton: {
    municipality: 'Templeton',
    fiscalYear: 2026,
    computedAt: '2026-04-01T06:00:00Z',
    metrics: {
      totalLevy: 14_280_000,
      operatingBudget: 19_800_000,
      stabilizationBalance: 1_584_000,
      freeCash: 1_188_000,
      overlayBalance: 148_000,
      excessLevy: 620_000,
      debtService: 890_000,
      reserveRatio: 0.0800,
      freeCashRatio: 0.0600,
    },
    riskFlags: [],
  },
  royalston: {
    municipality: 'Royalston',
    fiscalYear: 2026,
    computedAt: '2026-04-01T06:00:00Z',
    metrics: {
      totalLevy: 2_890_000,
      operatingBudget: 3_920_000,
      stabilizationBalance: 196_000,
      freeCash: 137_200,
      overlayBalance: 28_000,
      excessLevy: 112_000,
      debtService: 65_000,
      reserveRatio: 0.0500,
      freeCashRatio: 0.0350,
    },
    riskFlags: [
      { code: 'LOW_FREE_CASH', severity: 'medium', message: 'Free cash below 5% of operating budget', threshold: '≥5%', actual: '3.50%' },
    ],
  },
};

export function formatCurrency(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toLocaleString()}`;
}
