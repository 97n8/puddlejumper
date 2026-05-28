import type { Municipality } from '@/data/maMunicipalities'
import {
  XCircle, Warning, Info, CheckCircle,
  TrendUp, TrendDown, Minus,
} from '@phosphor-icons/react'
import type {
  Severity, HealthStatus, PeerComparison, RiskFlag,
  TrendYear, FiscalSnapshot, ApiSnapshot,
} from './types'

// ── Persistent municipality preference ────────────────────────────────────────
export const SAVED_MUNI_KEY = 'logicdash-saved-muni'

export function getSavedMuniCode(): number | null {
  try { const v = localStorage.getItem(SAVED_MUNI_KEY); return v ? Number(v) : null } catch { return null }
}
export function saveMuniCode(code: number): void {
  try { localStorage.setItem(SAVED_MUNI_KEY, String(code)) } catch { /* ignore */ }
}
export function clearSavedMuniCode(): void {
  try { localStorage.removeItem(SAVED_MUNI_KEY) } catch { /* ignore */ }
}

// ── Fiscal API ────────────────────────────────────────────────────────────────
export async function fiscalFetch(path: string, init: RequestInit = {}): Promise<Response> {
  return fetch(path, { ...init })
}

// ── Demo snapshot ─────────────────────────────────────────────────────────────
export const DEMO_SNAPSHOT: FiscalSnapshot = {
  municipality: { dor_code: 297, name: 'Sutton', county: 'Worcester', population: 9500, is_client: true },
  fiscal_year: 2026,
  ingested_at: '2026-03-02T14:22:00Z',
  seal_hash: 'sha256-a1b2c3d4e5f67890abcdef1234567890',
  source_tier: 2,
  excess_levy_capacity: 420_000,
  levy_limit: 18_920_000,
  actual_levy: 18_500_000,
  levy_capacity_pct: 2.3,
  free_cash: 1_200_000,
  free_cash_pct_budget: 3.17,
  stabilization: 3_250_000,
  stabilization_pct_budget: 8.59,
  overlay: 450_000,
  total_debt: 9_400_000,
  debt_per_capita: 989,
  debt_pct_eqv: 0.75,
  bond_moodys: 'Aa3',
  bond_sp: 'AA',
  authorized_unissued: 2_000_000,
  total_state_aid: 3_400_000,
  chapter_70: 2_800_000,
  ugga: 450_000,
  state_aid_pct_revenue: 27.4,
  operating_budget: 37_850_000,
  total_employees: 332,
  total_salaries_wages: 24_480_000,
  average_salary: 73_735,
  salary_share_budget: 64.7,
  risk_flags: [
    { flag: 'LOW_FREE_CASH',        severity: 'warning', metric: 'free_cash_pct_budget',  value: 3.17, threshold: 5.0, message: 'Free cash at 3.2% of operating budget — below DLS-recommended 5% floor. Consider warrant article to restore reserves.' },
    { flag: 'LEVY_CAPACITY_LOW',    severity: 'warning', metric: 'levy_capacity_pct',      value: 2.3,  threshold: 3.0, message: 'Excess levy capacity at 2.3% ($420K) — limited tax headroom entering FY2027 budget season.' },
    { flag: 'STATE_AID_DEPENDENCY', severity: 'info',    metric: 'state_aid_pct_revenue',  value: 27.4, threshold: 35.0, message: 'State aid at 27.4% of revenue — within acceptable range. Monitor Chapter 70 formula changes.' },
    { flag: 'DEBT_OK',              severity: 'passing',  metric: 'debt_pct_eqv',           value: 0.75, threshold: 5.0, message: 'Debt at 0.75% of EQV — well within safe threshold. Authorized-but-unissued $2M may close capacity.' },
    { flag: 'STABILIZATION_OK',     severity: 'passing',  metric: 'stabilization_pct_budget', value: 8.59, threshold: 5.0, message: 'Stabilization fund at 8.6% of operating budget — above the 5% best-practice target.' },
  ],
  overall_health: 'CAUTION',
  peer_group: {
    criteria: 'MA towns · Worcester County · pop. 7,125–11,875 (±25%)',
    member_count: 12,
    members: ['Auburn', 'Charlton', 'Douglas', 'Dudley', 'Grafton', 'Leicester', 'Millbury', 'Oxford', 'Spencer', 'Sturbridge', 'Sutton', 'Webster'],
  },
  peer_comparisons: [
    { metric: 'Debt Per Capita',   unit: 'currency', town_value: 989,  peer_median: 820,  peer_mean: 875,  peer_min: 420,  peer_max: 1350, percentile: 72, assessment: 'above_median' },
    { metric: 'Free Cash %',       unit: 'percent',  town_value: 3.17, peer_median: 4.8,  peer_mean: 5.2,  peer_min: 1.1,  peer_max: 9.3,  percentile: 28, assessment: 'below_median' },
    { metric: 'Stabilization %',   unit: 'percent',  town_value: 8.59, peer_median: 6.4,  peer_mean: 6.8,  peer_min: 2.1,  peer_max: 12.3, percentile: 75, assessment: 'above_median' },
    { metric: 'Levy Capacity %',   unit: 'percent',  town_value: 2.3,  peer_median: 3.8,  peer_mean: 4.1,  peer_min: 0.4,  peer_max: 9.2,  percentile: 35, assessment: 'below_median' },
    { metric: 'State Aid %',       unit: 'percent',  town_value: 27.4, peer_median: 29.1, peer_mean: 30.5, peer_min: 18.2, peer_max: 44.6, percentile: 45, assessment: 'at_median' },
    { metric: 'Debt % of EQV',     unit: 'percent',  town_value: 0.75, peer_median: 0.82, peer_mean: 0.91, peer_min: 0.12, peer_max: 2.1,  percentile: 42, assessment: 'at_median' },
  ],
  trends: [
    { fy: 2022, free_cash_pct: 5.8,  stabilization_pct: 7.2,  debt_per_capita: 820, levy_capacity_pct: 4.1, state_aid_pct: 26.8, operating_budget: 33_200_000, total_employees: 314, total_salaries_wages: 21_050_000 },
    { fy: 2023, free_cash_pct: 4.9,  stabilization_pct: 7.8,  debt_per_capita: 880, levy_capacity_pct: 3.6, state_aid_pct: 27.0, operating_budget: 34_800_000, total_employees: 319, total_salaries_wages: 22_240_000 },
    { fy: 2024, free_cash_pct: 4.2,  stabilization_pct: 8.1,  debt_per_capita: 930, levy_capacity_pct: 3.0, state_aid_pct: 27.1, operating_budget: 36_100_000, total_employees: 324, total_salaries_wages: 23_100_000 },
    { fy: 2025, free_cash_pct: 3.8,  stabilization_pct: 8.4,  debt_per_capita: 960, levy_capacity_pct: 2.6, state_aid_pct: 27.2, operating_budget: 37_000_000, total_employees: 328, total_salaries_wages: 23_920_000 },
    { fy: 2026, free_cash_pct: 3.17, stabilization_pct: 8.59, debt_per_capita: 989, levy_capacity_pct: 2.3, state_aid_pct: 27.4, operating_budget: 37_850_000, total_employees: 332, total_salaries_wages: 24_480_000 },
  ],
  sync_log: [
    { id: 'sync-003', timestamp: '2026-03-02T14:22:00Z', status: 'NEW',       datasets: ['free_cash', 'levy_limit', 'schedule_a', 'cherry_sheet'], source_tier: 2, seal_hash: 'sha256-a1b2c3d4e5f6' },
    { id: 'sync-002', timestamp: '2026-01-15T09:00:00Z', status: 'UNCHANGED', datasets: ['cherry_sheet'],                                           source_tier: 2 },
    { id: 'sync-001', timestamp: '2025-10-01T02:00:00Z', status: 'NEW',       datasets: ['free_cash', 'levy_limit'],                                 source_tier: 1, seal_hash: 'sha256-9f8e7d6c5b4a' },
  ],
}

// ── Formatters ────────────────────────────────────────────────────────────────

export function fmt$(n: number | null): string {
  if (n === null || Number.isNaN(n)) return '—'
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`
  if (n >= 1_000)     return `$${(n / 1_000).toFixed(0)}K`
  return `$${n.toLocaleString()}`
}

export function fmtPct(n: number | null, decimals = 1): string {
  if (n === null || Number.isNaN(n)) return '—'
  return n.toFixed(decimals) + '%'
}

export function fmtValue(v: number | null, unit: PeerComparison['unit']): string {
  if (v === null || Number.isNaN(v)) return '—'
  if (unit === 'currency') return '$' + v.toLocaleString()
  if (unit === 'percent')  return fmtPct(v)
  return v.toLocaleString()
}

export function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

// ── Snapshot builders ─────────────────────────────────────────────────────────

export function buildPreviewSnapshot(muni: Municipality): FiscalSnapshot {
  const basePopulation = DEMO_SNAPSHOT.municipality.population || 9500
  const population = muni.population || basePopulation
  const scale = population / basePopulation
  const variance = ((muni.dor_code % 7) - 3) * 0.18
  const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))
  const pct = (value: number) => Math.round(value * 100) / 100

  const freeCashPct = pct(clamp((DEMO_SNAPSHOT.free_cash_pct_budget ?? 0) + variance * 0.8, 2.4, 7.4))
  const levyCapacityPct = pct(clamp((DEMO_SNAPSHOT.levy_capacity_pct ?? 0) + variance * 0.5, 1.2, 5.4))
  const stabilizationPct = pct(clamp((DEMO_SNAPSHOT.stabilization_pct_budget ?? 0) + variance * 0.6, 4.2, 10.6))
  const debtPerCapita = Math.round(clamp((DEMO_SNAPSHOT.debt_per_capita ?? 0) + variance * 120, 620, 1425))
  const operatingBudget = Math.round((DEMO_SNAPSHOT.operating_budget ?? 0) * scale)
  const freeCash = Math.round((freeCashPct / 100) * operatingBudget)
  const stabilization = Math.round((stabilizationPct / 100) * operatingBudget)
  const levyLimit = Math.round((DEMO_SNAPSHOT.levy_limit ?? 0) * scale)
  const actualLevy = Math.round(levyLimit * (1 - levyCapacityPct / 100))
  const totalStateAid = Math.round((DEMO_SNAPSHOT.total_state_aid ?? 0) * scale)
  const chapter70 = Math.round((DEMO_SNAPSHOT.chapter_70 ?? 0) * scale)
  const ugga = Math.round((DEMO_SNAPSHOT.ugga ?? 0) * scale)
  const totalEmployees = Math.max(12, Math.round((DEMO_SNAPSHOT.total_employees ?? 0) * scale))
  const totalSalariesWages = Math.round((DEMO_SNAPSHOT.total_salaries_wages ?? 0) * scale)

  return {
    ...DEMO_SNAPSHOT,
    municipality: {
      dor_code: muni.dor_code,
      name: muni.name,
      county: muni.county,
      population,
      is_client: muni.is_client,
    },
    ingested_at: new Date('2026-03-28T09:30:00Z').toISOString(),
    seal_hash: `sha256-preview-${muni.dor_code.toString(16)}${DEMO_SNAPSHOT.seal_hash.slice(14, 32)}`,
    free_cash: freeCash,
    free_cash_pct_budget: freeCashPct,
    stabilization,
    stabilization_pct_budget: stabilizationPct,
    levy_limit: levyLimit,
    actual_levy: actualLevy,
    levy_capacity_pct: levyCapacityPct,
    total_debt: debtPerCapita * population,
    debt_per_capita: debtPerCapita,
    total_state_aid: totalStateAid,
    chapter_70: chapter70,
    ugga,
    operating_budget: operatingBudget,
    total_employees: totalEmployees,
    total_salaries_wages: totalSalariesWages,
    average_salary: totalEmployees ? Math.round(totalSalariesWages / totalEmployees) : null,
    salary_share_budget: operatingBudget ? Number(((totalSalariesWages / operatingBudget) * 100).toFixed(1)) : null,
    peer_group: {
      ...DEMO_SNAPSHOT.peer_group,
      criteria: `MA towns · ${muni.county} County focus · DOR ${muni.dor_code}`,
      members: DEMO_SNAPSHOT.peer_group.members.map(member => member === 'Sutton' ? muni.name : member),
    },
    peer_comparisons: DEMO_SNAPSHOT.peer_comparisons.map(item => ({
      ...item,
      town_value:
        item.metric === 'Debt Per Capita' ? debtPerCapita :
        item.metric === 'Free Cash %' ? freeCashPct :
        item.metric === 'Stabilization %' ? stabilizationPct :
        item.metric === 'Levy Capacity %' ? levyCapacityPct :
        item.metric === 'State Aid %' ? (DEMO_SNAPSHOT.state_aid_pct_revenue ?? item.town_value) :
        item.metric === 'Debt % of EQV' ? (DEMO_SNAPSHOT.debt_pct_eqv ?? item.town_value) :
        item.town_value,
    })),
    trends: DEMO_SNAPSHOT.trends.map(entry => ({
      ...entry,
      operating_budget: entry.operating_budget !== null ? Math.round(entry.operating_budget * scale) : null,
      total_employees: entry.total_employees !== null ? Math.max(10, Math.round(entry.total_employees * scale)) : null,
      total_salaries_wages: entry.total_salaries_wages !== null ? Math.round(entry.total_salaries_wages * scale) : null,
    })),
    risk_flags: DEMO_SNAPSHOT.risk_flags.map(flag => ({
      ...flag,
      message: flag.message.replace('Consider warrant article to restore reserves.', `${muni.name} can restore reserves before the next budget turn.`),
    })),
    sync_log: [
      {
        id: `preview-${muni.dor_code}`,
        timestamp: new Date('2026-03-28T09:30:00Z').toISOString(),
        status: 'NEW',
        datasets: ['preview', 'fiscal', 'peer'],
        source_tier: 2,
        seal_hash: `sha256-preview-${muni.dor_code}`,
      },
      ...DEMO_SNAPSHOT.sync_log,
    ],
  }
}

export function apiToSnapshot(api: ApiSnapshot, muni: Municipality): FiscalSnapshot {
  const m = api.metrics
  const hasActualDebt = m.totalDebt !== null
  const hasActualStateAid = m.totalStateAid !== null

  const hasCritical = api.riskFlags.some(f => f.severity === 'critical')
  const hasWarning  = api.riskFlags.some(f => f.severity === 'warning')
  const overall_health: HealthStatus = hasCritical ? 'AT_RISK' : hasWarning ? 'CAUTION' : 'HEALTHY'

  const risk_flags: RiskFlag[] = api.riskFlags.map(f => ({
    flag: f.code,
    severity: f.severity as Severity,
    metric: f.code.toLowerCase(),
    value: null,
    threshold: null,
    message: f.detail,
  }))

  const fySet = new Set<number>()
  m.stabilizationSeries.forEach(p => fySet.add(p.fy))
  m.operatingBudgetSeries.forEach(p => fySet.add(p.fy))
  m.freeCashSeries.forEach(p => fySet.add(p.fy))
  m.levySeries.forEach(p => fySet.add(p.fy))
  const stabMap = Object.fromEntries(m.stabilizationSeries.map(p => [p.fy, p.value]))
  const budgetMap = Object.fromEntries(m.operatingBudgetSeries.map(p => [p.fy, p.value]))
  const freeCashMap = Object.fromEntries(m.freeCashSeries.map(p => [p.fy, p.value]))
  const trends: TrendYear[] = [...fySet].sort().map(fy => ({
    fy,
    free_cash_pct:       budgetMap[fy] !== undefined && freeCashMap[fy] !== undefined && budgetMap[fy] !== 0 ? (freeCashMap[fy] / budgetMap[fy]) * 100 : null,
    stabilization_pct:   budgetMap[fy] !== undefined && stabMap[fy] !== undefined && budgetMap[fy] !== 0 ? (stabMap[fy] / budgetMap[fy]) * 100 : null,
    debt_per_capita:     null,
    levy_capacity_pct:   fy === api.fiscalYear ? m.excessLevyCapacityPct : null,
    state_aid_pct:       fy === api.fiscalYear ? m.stateAidPctBudget : null,
    operating_budget:    budgetMap[fy] ?? null,
    total_employees:     fy === api.fiscalYear ? m.totalEmployees : null,
    total_salaries_wages: fy === api.fiscalYear ? m.totalSalariesWages : null,
  }))

  return {
    municipality: muni,
    fiscal_year: api.fiscalYear,
    ingested_at: api.computedAt,
    seal_hash: '',
    source_tier: 3,
    excess_levy_capacity: m.excessLevyCapacity,
    levy_limit: m.maximumLevyLimit ?? m.totalLevy,
    actual_levy: m.totalLevy,
    levy_capacity_pct: m.excessLevyCapacityPct,
    free_cash: m.certifiedFreeCash,
    free_cash_pct_budget: m.freeCashPctBudget,
    stabilization: m.stabilizationBalance,
    stabilization_pct_budget: m.stabilizationPctBudget,
    overlay: m.overlayAppropriation,
    total_debt: m.totalDebt,
    debt_per_capita: m.totalDebt !== null && muni.population ? Math.round(m.totalDebt / muni.population) : null,
    debt_pct_eqv: m.debtPctEqv,
    bond_moodys: m.bondMoodys ?? '—',
    bond_sp: m.bondSp ?? '—',
    authorized_unissued: null,
    total_state_aid: m.totalStateAid,
    chapter_70: null,
    ugga: null,
    state_aid_pct_revenue: m.stateAidPctBudget,
    operating_budget: m.operatingBudget,
    total_employees: m.totalEmployees,
    total_salaries_wages: m.totalSalariesWages,
    average_salary: m.averageSalary,
    salary_share_budget: m.salariesPctBudget,
    risk_flags: risk_flags.length > 0 ? risk_flags : [{
      flag: 'DATA_PARTIAL',
      severity: 'info',
      metric: 'data_coverage',
      value: null,
      threshold: null,
      message: hasActualDebt && hasActualStateAid
        ? 'Current stabilization, levy, free cash, debt, and state-aid context have been ingested from DLS community and finance reports.'
        : 'Some metrics are still missing because the current DLS report path does not expose every number year by year. Blank values mean unavailable, not zero.',
    }],
    overall_health,
    peer_group: { criteria: `${api.county} County · MA`, member_count: 0, members: [] },
    peer_comparisons: [],
    trends,
    sync_log: [{
      id: 'latest',
      timestamp: api.computedAt,
      status: 'NEW',
      datasets: ['stabilization', 'overlay'],
      source_tier: 3,
    }],
  }
}

// ── Risk flag builders ────────────────────────────────────────────────────────

export function buildFrameworkRiskFlags({
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
        ? `Free cash data for FY${fiscalYear} isn't published yet by the Massachusetts Department of Revenue. We'll sync it automatically when the report is available.`
        : freeCashPct < 5
        ? `FY${fiscalYear} free cash is below the 5% comfort line. In plain terms: the town has less cushion if something expensive happens late in the year.`
        : `FY${fiscalYear} free cash is above the 5% comfort line. In plain terms: the town has a healthier year-end cushion.`,
    },
    {
      flag: 'LEVY_CAPACITY_PATTERN',
      severity: levyCapacityPct === null ? 'info' : levyCapacityPct < 3 ? 'warning' : 'passing',
      metric: 'levy_capacity_pct',
      value: levyCapacityPct,
      threshold: 3,
      message: levyCapacityPct === null
        ? `Levy capacity for FY${fiscalYear} isn't broken out year-by-year in the current state report. The town's actual figure may be available from the Division of Local Services.`
        : levyCapacityPct < 3
        ? `FY${fiscalYear} levy capacity is below 3%. In plain terms: there is not much room left under Proposition 2½ without overrides or new growth.`
        : `FY${fiscalYear} levy capacity is still above 3%. In plain terms: the town still has some tax-room flexibility.`,
    },
    {
      flag: 'STABILIZATION_PATTERN',
      severity: stabilizationPct === null ? 'info' : stabilizationPct < 5 ? 'warning' : 'passing',
      metric: 'stabilization_pct_budget',
      value: stabilizationPct,
      threshold: 5,
      message: stabilizationPct === null
        ? `FY${fiscalYear} stabilization detail is not available for this view.`
        : stabilizationPct < 5
        ? `FY${fiscalYear} stabilization is below the 5% reserve target. In plain terms: the rainy-day fund may be too thin for a shock.`
        : `FY${fiscalYear} stabilization is above the 5% reserve target. In plain terms: the rainy-day fund is carrying its weight.`,
    },
    {
      flag: 'DEBT_PATTERN',
      severity: debtPctEqv === null ? 'info' : debtPctEqv > 2 ? 'warning' : 'passing',
      metric: 'debt_pct_eqv',
      value: debtPctEqv,
      threshold: 2,
      message: debtPctEqv === null
        ? `Debt service data for FY${fiscalYear} isn't available in the current MA DOR report cycle.`
        : debtPctEqv > 2
        ? `FY${fiscalYear} debt is above a conservative 2% of EQV pattern line. In plain terms: borrowing is becoming a bigger governance conversation.`
        : `FY${fiscalYear} debt stays inside a conservative 2% of EQV pattern line. In plain terms: borrowing is visible but not crowding out the whole picture.`,
    },
    {
      flag: 'STATE_AID_PATTERN',
      severity: stateAidPctRevenue === null ? 'info' : stateAidPctRevenue > 30 ? 'info' : 'passing',
      metric: 'state_aid_pct_revenue',
      value: stateAidPctRevenue,
      threshold: 30,
      message: stateAidPctRevenue === null
        ? `State aid figures for FY${fiscalYear} aren't available in the current MA DOR report cycle.`
        : stateAidPctRevenue > 30
        ? `FY${fiscalYear} leans more heavily on state aid than many towns. In plain terms: formula changes in Boston will matter more locally.`
        : `FY${fiscalYear} keeps state-aid dependence in a moderate range. In plain terms: the town is not overexposed to one outside funding stream.`,
    },
  ]
}

export function buildHistoricalSnapshot(base: FiscalSnapshot, fiscalYear: number): FiscalSnapshot {
  if (fiscalYear === base.fiscal_year) return base

  const trend = base.trends.find(entry => entry.fy === fiscalYear)
  const latestTrend = base.trends.find(entry => entry.fy === base.fiscal_year) ?? base.trends[base.trends.length - 1]

  if (!trend || !latestTrend) return base

  const ratio = trend.operating_budget !== null && latestTrend.operating_budget
    ? trend.operating_budget / latestTrend.operating_budget
    : 1
  const totalStateAid = trend.state_aid_pct !== null && trend.operating_budget !== null
    ? Math.round((trend.state_aid_pct / 100) * trend.operating_budget)
    : null
  const chapter70Share = base.total_state_aid && base.chapter_70 ? base.chapter_70 / base.total_state_aid : 0.82
  const uggaShare = base.total_state_aid && base.ugga ? base.ugga / base.total_state_aid : 0.13
  const chapter70 = totalStateAid !== null ? Math.round(totalStateAid * chapter70Share) : null
  const ugga = totalStateAid !== null ? Math.round(totalStateAid * uggaShare) : null
  const levyLimit = base.levy_limit !== null ? Math.round(base.levy_limit * ratio) : null
  const actualLevy = levyLimit !== null && trend.levy_capacity_pct !== null
    ? Math.round(levyLimit * (1 - trend.levy_capacity_pct / 100))
    : null
  const freeCash = trend.free_cash_pct !== null && trend.operating_budget !== null
    ? Math.round((trend.free_cash_pct / 100) * trend.operating_budget)
    : null
  const stabilization = trend.stabilization_pct !== null && trend.operating_budget !== null
    ? Math.round((trend.stabilization_pct / 100) * trend.operating_budget)
    : null
  const totalEmployees = trend.total_employees ?? base.total_employees
  const totalSalariesWages = trend.total_salaries_wages ?? base.total_salaries_wages
  const debtPctEqv = base.debt_pct_eqv !== null && trend.debt_per_capita !== null && latestTrend.debt_per_capita
    ? Number(((base.debt_pct_eqv * trend.debt_per_capita) / latestTrend.debt_per_capita).toFixed(2))
    : null
  const riskFlags = buildFrameworkRiskFlags({
    fiscalYear,
    freeCashPct: trend.free_cash_pct,
    levyCapacityPct: trend.levy_capacity_pct,
    stabilizationPct: trend.stabilization_pct,
    debtPctEqv,
    stateAidPctRevenue: trend.state_aid_pct,
  })
  const overall_health: HealthStatus = riskFlags.some(flag => flag.severity === 'warning') ? 'CAUTION' : 'HEALTHY'

  return {
    ...base,
    fiscal_year: fiscalYear,
    excess_levy_capacity: levyLimit !== null && actualLevy !== null ? Math.round(levyLimit - actualLevy) : null,
    levy_limit: levyLimit,
    actual_levy: actualLevy,
    levy_capacity_pct: trend.levy_capacity_pct,
    free_cash: freeCash,
    free_cash_pct_budget: trend.free_cash_pct,
    stabilization,
    stabilization_pct_budget: trend.stabilization_pct,
    total_debt: trend.debt_per_capita !== null ? Math.round(trend.debt_per_capita * (base.municipality.population || 0)) : null,
    debt_per_capita: trend.debt_per_capita,
    debt_pct_eqv: debtPctEqv,
    total_state_aid: totalStateAid,
    chapter_70: chapter70,
    ugga,
    state_aid_pct_revenue: trend.state_aid_pct,
    operating_budget: trend.operating_budget,
    total_employees: totalEmployees,
    total_salaries_wages: totalSalariesWages,
    average_salary: totalEmployees && totalSalariesWages !== null ? Math.round(totalSalariesWages / totalEmployees) : null,
    salary_share_budget: trend.operating_budget && totalSalariesWages !== null ? Number(((totalSalariesWages / trend.operating_budget) * 100).toFixed(1)) : null,
    ingested_at: base.ingested_at,
    risk_flags: riskFlags,
    overall_health,
    sync_log: [
      {
        id: `history-fy-${fiscalYear}`,
        timestamp: base.ingested_at,
        status: 'NEW',
        datasets: ['historical-trend-view', 'framework-estimate'],
        source_tier: base.source_tier,
        message: `Historical reconstruction for FY${fiscalYear}`,
      },
      ...base.sync_log,
    ],
  }
}

// ── Governance utilities ──────────────────────────────────────────────────────

export function buildTownGovernanceSources(muni: Municipality) {
  const town = `${muni.name}, Massachusetts`
  const search = (query: string) => `https://duckduckgo.com/?q=${encodeURIComponent(`${town} ${query}`)}`

  return [
    {
      title: `${muni.name} minutes + agendas`,
      helper: 'Official town site or CivicPlus meeting pages',
      detail: 'Usually the fastest path to agendas, minutes, packets, and board calendars.',
      url: search('official site CivicPlus agendas minutes board meetings'),
      action: 'Open source path',
    },
    {
      title: `${muni.name} bylaws + policies`,
      helper: 'Town policy pages, bylaws, charter, and rules',
      detail: 'Keeps local rules next to the workflow so staff are not guessing which policy governs the lane.',
      url: search('official site bylaws policies charter PDF'),
      action: 'Open policy path',
    },
    {
      title: `${muni.name} packets + recordings`,
      helper: 'Meeting packets, exhibits, recordings, and vote context',
      detail: 'Where the board-room memory usually lives before it gets governed into one searchable record.',
      url: search('official site agenda packet recording video archive'),
      action: 'Open meeting trail',
    },
    {
      title: `${muni.name} boards + appointments`,
      helper: 'Board rosters, open seats, and committee structure',
      detail: 'Useful for clerks, administrators, and chairs when vacancies or appointments become urgent.',
      url: search('official site boards committees appointments vacancies'),
      action: 'Open board path',
    },
  ]
}

export function describeMetric(metric: string) {
  switch (metric) {
    case 'free_cash_pct_budget':
      return 'year-end cushion'
    case 'levy_capacity_pct':
      return 'tax-room flexibility'
    case 'stabilization_pct_budget':
      return 'reserve strength'
    case 'debt_pct_eqv':
      return 'borrowing load'
    case 'state_aid_pct_revenue':
      return 'state-aid dependence'
    default:
      return metric.replace(/_/g, ' ')
  }
}

export function buildHealthReason(snap: FiscalSnapshot) {
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

// ── Shared display config ─────────────────────────────────────────────────────

export const SEV_CFG: Record<Severity, { Icon: React.ElementType; color: string; bg: string; border: string; label: string }> = {
  critical: { Icon: XCircle,      color: 'text-red-600 dark:text-red-400',     bg: 'bg-red-50 dark:bg-red-950/40',     border: 'border-red-200 dark:border-red-800',     label: 'Critical' },
  warning:  { Icon: Warning,       color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-950/40', border: 'border-amber-200 dark:border-amber-800', label: 'Warning' },
  info:     { Icon: Info,          color: 'text-blue-600 dark:text-blue-400',   bg: 'bg-blue-50 dark:bg-blue-950/40',   border: 'border-blue-200 dark:border-blue-800',   label: 'Info' },
  passing:  { Icon: CheckCircle,   color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-950/40', border: 'border-emerald-200 dark:border-emerald-800', label: 'Passing' },
}

export const ASSESS_CFG: Record<import('./types').PeerAssessment, { Icon: React.ElementType; color: string; label: string }> = {
  above_median: { Icon: TrendUp,   color: 'text-amber-600',  label: 'Above Median' },
  at_median:    { Icon: Minus,     color: 'text-blue-600',   label: 'At Median' },
  below_median: { Icon: TrendDown, color: 'text-red-600',    label: 'Below Median' },
}

export const SYNC_STATUS_CFG: Record<import('./types').SyncEvent['status'], { color: string; label: string }> = {
  NEW:          { color: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300', label: 'New Data' },
  UNCHANGED:    { color: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',            label: 'Unchanged' },
  PARTIAL_SYNC: { color: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',         label: 'Partial' },
  FAILED:       { color: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',                 label: 'Failed' },
}
