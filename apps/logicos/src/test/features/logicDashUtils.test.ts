/**
 * logicDashUtils.test.ts
 *
 * Tests for pure utility functions extracted from LogicDASHPanel.tsx.
 * These functions are not currently exported from a separate module —
 * they are copied here inline for testability.
 *
 * TODO: Remove inline copies when LogicDASHPanel is refactored to export them
 * from a dedicated `src/features/logicdash/utils.ts`.
 */
import { describe, it, expect } from 'vitest'

// ── Inline copies of private functions from LogicDASHPanel.tsx ────────────────
// These are extracted copies of private functions — remove when LogicDASHPanel
// is refactored to export them.

type Severity = 'critical' | 'warning' | 'info' | 'passing'
type HealthStatus = 'HEALTHY' | 'CAUTION' | 'AT_RISK'

interface RiskFlag {
  flag: string
  severity: Severity
  metric: string
  value: number | null
  threshold: number | null
  message: string
}

interface FiscalSnapshot {
  fiscal_year: number
  overall_health: HealthStatus
  risk_flags: RiskFlag[]
  // Required fields (minimal for test purposes)
  [key: string]: unknown
}

function fmt$(n: number | null): string {
  if (n === null || Number.isNaN(n)) return '—'
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`
  if (n >= 1_000)     return `$${(n / 1_000).toFixed(0)}K`
  return `$${n.toLocaleString()}`
}

function fmtPct(n: number | null, decimals = 1): string {
  if (n === null || Number.isNaN(n)) return '—'
  return n.toFixed(decimals) + '%'
}

function describeMetric(metric: string) {
  switch (metric) {
    case 'free_cash_pct_budget':   return 'year-end cushion'
    case 'levy_capacity_pct':      return 'tax-room flexibility'
    case 'stabilization_pct_budget': return 'reserve strength'
    case 'debt_pct_eqv':           return 'borrowing load'
    case 'state_aid_pct_revenue':  return 'state-aid dependence'
    default: return metric.replace(/_/g, ' ')
  }
}

function buildFrameworkRiskFlags({
  fiscalYear,
  freeCashPct,
  levyCapacityPct,
  stabilizationPct,
  debtPctEqv,
  stateAidPctRevenue,
}: {
  fiscalYear: number
  freeCashPct: number | null
  levyCapacityPct: number | null
  stabilizationPct: number | null
  debtPctEqv: number | null
  stateAidPctRevenue: number | null
}): RiskFlag[] {
  return [
    {
      flag: 'FREE_CASH_PATTERN',
      severity: freeCashPct === null ? 'info' : freeCashPct < 5 ? 'warning' : 'passing',
      metric: 'free_cash_pct_budget',
      value: freeCashPct,
      threshold: 5,
      message: freeCashPct === null
        ? `Free cash data for FY${fiscalYear} isn't published yet.`
        : freeCashPct < 5
        ? `FY${fiscalYear} free cash is below the 5% comfort line.`
        : `FY${fiscalYear} free cash is above the 5% comfort line.`,
    },
    {
      flag: 'LEVY_CAPACITY_PATTERN',
      severity: levyCapacityPct === null ? 'info' : levyCapacityPct < 3 ? 'warning' : 'passing',
      metric: 'levy_capacity_pct',
      value: levyCapacityPct,
      threshold: 3,
      message: levyCapacityPct === null
        ? `Levy capacity for FY${fiscalYear} isn't available.`
        : levyCapacityPct < 3
        ? `FY${fiscalYear} levy capacity is below 3%.`
        : `FY${fiscalYear} levy capacity is above 3%.`,
    },
    {
      flag: 'STABILIZATION_PATTERN',
      severity: stabilizationPct === null ? 'info' : stabilizationPct < 5 ? 'warning' : 'passing',
      metric: 'stabilization_pct_budget',
      value: stabilizationPct,
      threshold: 5,
      message: stabilizationPct === null
        ? `FY${fiscalYear} stabilization detail is not available.`
        : stabilizationPct < 5
        ? `FY${fiscalYear} stabilization is below the 5% reserve target.`
        : `FY${fiscalYear} stabilization is above the 5% reserve target.`,
    },
    {
      flag: 'DEBT_PATTERN',
      severity: debtPctEqv === null ? 'info' : debtPctEqv > 2 ? 'warning' : 'passing',
      metric: 'debt_pct_eqv',
      value: debtPctEqv,
      threshold: 2,
      message: debtPctEqv === null
        ? `Debt service data for FY${fiscalYear} isn't available.`
        : debtPctEqv > 2
        ? `FY${fiscalYear} debt is above a conservative 2% of EQV.`
        : `FY${fiscalYear} debt stays inside a conservative 2% of EQV.`,
    },
    {
      flag: 'STATE_AID_PATTERN',
      severity: stateAidPctRevenue === null ? 'info' : stateAidPctRevenue > 30 ? 'info' : 'passing',
      metric: 'state_aid_pct_revenue',
      value: stateAidPctRevenue,
      threshold: 30,
      message: stateAidPctRevenue === null
        ? `State aid figures for FY${fiscalYear} aren't available.`
        : stateAidPctRevenue > 30
        ? `FY${fiscalYear} leans heavily on state aid.`
        : `FY${fiscalYear} keeps state-aid dependence in a moderate range.`,
    },
  ]
}

function buildHealthReason(snap: FiscalSnapshot): string {
  const active = snap.risk_flags.filter(flag => flag.severity === 'critical' || flag.severity === 'warning')
  if (active.length === 0) {
    return 'Why it looks steady: the connected reserve, levy, debt, and aid signals are sitting inside the framework comfort lines.'
  }
  const topics = Array.from(new Set(active.slice(0, 2).map(flag => describeMetric(flag.metric))))
  const topicSummary = topics.length > 1
    ? `${topics.slice(0, -1).join(', ')} and ${topics[topics.length - 1]}`
    : topics[0]
  const remaining = active.length - topics.length
  const tail = remaining > 0 ? ` plus ${remaining} more signal${remaining === 1 ? '' : 's'}` : ''
  const prefix = snap.overall_health === 'AT_RISK' ? 'Why it needs attention' : 'Why it is on watch'
  const verb = topics.length > 1 ? 'are' : 'is'
  return `${prefix}: ${topicSummary} ${verb} outside the framework comfort lines${tail}.`
}

// ── fmt$ ──────────────────────────────────────────────────────────────────────

describe('fmt$', () => {
  it('returns em-dash for null', () => {
    expect(fmt$(null)).toBe('—')
  })

  it('returns em-dash for NaN', () => {
    expect(fmt$(NaN)).toBe('—')
  })

  it('formats millions with 2 decimal places and M suffix', () => {
    expect(fmt$(1_000_000)).toBe('$1.00M')
    expect(fmt$(2_500_000)).toBe('$2.50M')
    expect(fmt$(1_234_567)).toBe('$1.23M')
  })

  it('formats thousands with K suffix (no decimals)', () => {
    expect(fmt$(500_000)).toBe('$500K')
    expect(fmt$(1_000)).toBe('$1K')
    expect(fmt$(999_999)).toBe('$1000K')
  })

  it('formats small amounts without K or M suffix', () => {
    expect(fmt$(100)).toBe('$100')
    expect(fmt$(0)).toBe('$0')
  })

  it('boundary: exactly 1,000,000 formats as millions', () => {
    expect(fmt$(1_000_000)).toContain('M')
  })

  it('boundary: exactly 1,000 formats as thousands', () => {
    expect(fmt$(1_000)).toContain('K')
  })
})

// ── fmtPct ───────────────────────────────────────────────────────────────────

describe('fmtPct', () => {
  it('returns em-dash for null', () => {
    expect(fmtPct(null)).toBe('—')
  })

  it('returns em-dash for NaN', () => {
    expect(fmtPct(NaN)).toBe('—')
  })

  it('formats with 1 decimal place by default', () => {
    expect(fmtPct(7.5)).toBe('7.5%')
    expect(fmtPct(0)).toBe('0.0%')
    expect(fmtPct(100)).toBe('100.0%')
  })

  it('respects the decimals parameter', () => {
    expect(fmtPct(50, 0)).toBe('50%')
    expect(fmtPct(3.14159, 2)).toBe('3.14%')
    expect(fmtPct(99.9, 0)).toBe('100%')
  })

  it('handles small percentages', () => {
    expect(fmtPct(0.1)).toBe('0.1%')
    expect(fmtPct(0.01, 2)).toBe('0.01%')
  })
})

// ── buildFrameworkRiskFlags ───────────────────────────────────────────────────

describe('buildFrameworkRiskFlags', () => {
  const healthyParams = {
    fiscalYear: 2026,
    freeCashPct: 8.5,
    levyCapacityPct: 5.0,
    stabilizationPct: 7.0,
    debtPctEqv: 1.5,
    stateAidPctRevenue: 20.0,
  }

  it('returns exactly 5 risk flags', () => {
    const flags = buildFrameworkRiskFlags(healthyParams)
    expect(flags).toHaveLength(5)
  })

  it('all flags have required fields: flag, severity, metric, message', () => {
    const flags = buildFrameworkRiskFlags(healthyParams)
    for (const f of flags) {
      expect(typeof f.flag).toBe('string')
      expect(['critical', 'warning', 'info', 'passing']).toContain(f.severity)
      expect(typeof f.metric).toBe('string')
      expect(typeof f.message).toBe('string')
    }
  })

  it('FREE_CASH_PATTERN is "passing" when free cash ≥ 5%', () => {
    const flags = buildFrameworkRiskFlags(healthyParams)
    const flag = flags.find(f => f.flag === 'FREE_CASH_PATTERN')!
    expect(flag.severity).toBe('passing')
  })

  it('FREE_CASH_PATTERN is "warning" when free cash < 5%', () => {
    const flags = buildFrameworkRiskFlags({ ...healthyParams, freeCashPct: 3.2 })
    const flag = flags.find(f => f.flag === 'FREE_CASH_PATTERN')!
    expect(flag.severity).toBe('warning')
  })

  it('FREE_CASH_PATTERN is "info" when free cash is null (data unavailable)', () => {
    const flags = buildFrameworkRiskFlags({ ...healthyParams, freeCashPct: null })
    const flag = flags.find(f => f.flag === 'FREE_CASH_PATTERN')!
    expect(flag.severity).toBe('info')
    expect(flag.value).toBeNull()
  })

  it('DEBT_PATTERN is "warning" when debtPctEqv > 2', () => {
    const flags = buildFrameworkRiskFlags({ ...healthyParams, debtPctEqv: 3.5 })
    const flag = flags.find(f => f.flag === 'DEBT_PATTERN')!
    expect(flag.severity).toBe('warning')
  })

  it('DEBT_PATTERN is "passing" when debtPctEqv ≤ 2', () => {
    const flags = buildFrameworkRiskFlags({ ...healthyParams, debtPctEqv: 1.5 })
    const flag = flags.find(f => f.flag === 'DEBT_PATTERN')!
    expect(flag.severity).toBe('passing')
  })

  it('LEVY_CAPACITY_PATTERN is "warning" when levyCapacityPct < 3', () => {
    const flags = buildFrameworkRiskFlags({ ...healthyParams, levyCapacityPct: 1.5 })
    const flag = flags.find(f => f.flag === 'LEVY_CAPACITY_PATTERN')!
    expect(flag.severity).toBe('warning')
  })

  it('STABILIZATION_PATTERN is "warning" when stabilizationPct < 5', () => {
    const flags = buildFrameworkRiskFlags({ ...healthyParams, stabilizationPct: 2.0 })
    const flag = flags.find(f => f.flag === 'STABILIZATION_PATTERN')!
    expect(flag.severity).toBe('warning')
  })

  it('STATE_AID_PATTERN is "info" (not warning) even when > 30%', () => {
    const flags = buildFrameworkRiskFlags({ ...healthyParams, stateAidPctRevenue: 45.0 })
    const flag = flags.find(f => f.flag === 'STATE_AID_PATTERN')!
    // State aid high is "info" (note-worthy but not a warning)
    expect(flag.severity).toBe('info')
  })

  it('STATE_AID_PATTERN is "passing" when ≤ 30%', () => {
    const flags = buildFrameworkRiskFlags({ ...healthyParams, stateAidPctRevenue: 25.0 })
    const flag = flags.find(f => f.flag === 'STATE_AID_PATTERN')!
    expect(flag.severity).toBe('passing')
  })

  it('flag messages include the fiscal year', () => {
    const flags = buildFrameworkRiskFlags({ ...healthyParams, fiscalYear: 2027 })
    const cashFlag = flags.find(f => f.flag === 'FREE_CASH_PATTERN')!
    expect(cashFlag.message).toContain('2027')
  })

  it('all-null inputs produce 5 "info" flags', () => {
    const flags = buildFrameworkRiskFlags({
      fiscalYear: 2026,
      freeCashPct: null,
      levyCapacityPct: null,
      stabilizationPct: null,
      debtPctEqv: null,
      stateAidPctRevenue: null,
    })
    expect(flags.every(f => f.severity === 'info')).toBe(true)
  })
})

// ── buildHealthReason ─────────────────────────────────────────────────────────

function makeSnap(overrides: Partial<FiscalSnapshot> = {}): FiscalSnapshot {
  return {
    fiscal_year: 2026,
    overall_health: 'HEALTHY',
    risk_flags: [],
    ...overrides,
  }
}

describe('buildHealthReason', () => {
  it('returns a non-empty string', () => {
    const reason = buildHealthReason(makeSnap())
    expect(typeof reason).toBe('string')
    expect(reason.length).toBeGreaterThan(0)
  })

  it('returns "steady" message when no warnings or critical flags', () => {
    const snap = makeSnap({
      risk_flags: [
        { flag: 'FREE_CASH_PATTERN', severity: 'passing', metric: 'free_cash_pct_budget', value: 8, threshold: 5, message: '' },
        { flag: 'DEBT_PATTERN', severity: 'passing', metric: 'debt_pct_eqv', value: 1.5, threshold: 2, message: '' },
      ],
    })
    const reason = buildHealthReason(snap)
    expect(reason).toContain('steady')
  })

  it('returns "on watch" prefix when there are warning flags and health is not AT_RISK', () => {
    const snap = makeSnap({
      overall_health: 'CAUTION',
      risk_flags: [
        { flag: 'FREE_CASH_PATTERN', severity: 'warning', metric: 'free_cash_pct_budget', value: 3, threshold: 5, message: '' },
      ],
    })
    const reason = buildHealthReason(snap)
    expect(reason).toContain('on watch')
  })

  it('returns "needs attention" prefix when health is AT_RISK', () => {
    const snap = makeSnap({
      overall_health: 'AT_RISK',
      risk_flags: [
        { flag: 'FREE_CASH_PATTERN', severity: 'warning', metric: 'free_cash_pct_budget', value: 2, threshold: 5, message: '' },
        { flag: 'DEBT_PATTERN', severity: 'warning', metric: 'debt_pct_eqv', value: 3.5, threshold: 2, message: '' },
      ],
    })
    const reason = buildHealthReason(snap)
    expect(reason).toContain('needs attention')
  })

  it('includes a human-readable metric name in the reason text', () => {
    const snap = makeSnap({
      overall_health: 'CAUTION',
      risk_flags: [
        { flag: 'FREE_CASH_PATTERN', severity: 'warning', metric: 'free_cash_pct_budget', value: 2, threshold: 5, message: '' },
      ],
    })
    const reason = buildHealthReason(snap)
    // 'free_cash_pct_budget' should be described as 'year-end cushion'
    expect(reason).toContain('year-end cushion')
  })

  it('mentions two metrics when two flags are active', () => {
    const snap = makeSnap({
      overall_health: 'AT_RISK',
      risk_flags: [
        { flag: 'FREE_CASH_PATTERN', severity: 'warning', metric: 'free_cash_pct_budget', value: 2, threshold: 5, message: '' },
        { flag: 'DEBT_PATTERN', severity: 'warning', metric: 'debt_pct_eqv', value: 3, threshold: 2, message: '' },
      ],
    })
    const reason = buildHealthReason(snap)
    expect(reason).toContain('year-end cushion')
    expect(reason).toContain('borrowing load')
    expect(reason).toContain('are outside')
  })

  it('mentions "plus N more signals" when more than 2 flags are active', () => {
    const snap = makeSnap({
      overall_health: 'AT_RISK',
      risk_flags: [
        { flag: 'FREE_CASH_PATTERN', severity: 'warning', metric: 'free_cash_pct_budget', value: 2, threshold: 5, message: '' },
        { flag: 'DEBT_PATTERN', severity: 'warning', metric: 'debt_pct_eqv', value: 3, threshold: 2, message: '' },
        { flag: 'STABILIZATION_PATTERN', severity: 'warning', metric: 'stabilization_pct_budget', value: 1, threshold: 5, message: '' },
      ],
    })
    const reason = buildHealthReason(snap)
    expect(reason).toContain('plus 1 more signal')
  })

  it('ignores "passing" and "info" flags — only counts warning/critical', () => {
    const snap = makeSnap({
      overall_health: 'HEALTHY',
      risk_flags: [
        { flag: 'STATE_AID', severity: 'info', metric: 'state_aid_pct_revenue', value: 35, threshold: 30, message: '' },
        { flag: 'FREE_CASH', severity: 'passing', metric: 'free_cash_pct_budget', value: 8, threshold: 5, message: '' },
      ],
    })
    const reason = buildHealthReason(snap)
    expect(reason).toContain('steady')
  })
})
