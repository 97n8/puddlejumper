import type { Municipality } from '@/data/maMunicipalities'

export type Severity = 'critical' | 'warning' | 'info' | 'passing'
export type HealthStatus = 'HEALTHY' | 'CAUTION' | 'AT_RISK'
export type PeerAssessment = 'above_median' | 'at_median' | 'below_median'

export interface RiskFlag {
  flag: string
  severity: Severity
  metric: string
  value: number | null
  threshold: number | null
  message: string
}

export interface PeerComparison {
  metric: string
  unit: 'currency' | 'percent' | 'number'
  town_value: number
  peer_median: number
  peer_mean: number
  peer_min: number
  peer_max: number
  percentile: number
  assessment: PeerAssessment
}

export interface TrendYear {
  fy: number
  free_cash_pct: number | null
  stabilization_pct: number | null
  debt_per_capita: number | null
  levy_capacity_pct: number | null
  state_aid_pct: number | null
  operating_budget: number | null
  total_employees: number | null
  total_salaries_wages: number | null
}

export interface SyncEvent {
  id: string
  timestamp: string
  status: 'NEW' | 'UNCHANGED' | 'PARTIAL_SYNC' | 'FAILED'
  datasets: string[]
  source_tier: number
  seal_hash?: string
  message?: string
}

export interface FiscalSnapshot {
  municipality: Municipality
  fiscal_year: number
  ingested_at: string
  seal_hash: string
  source_tier: number
  // Levy
  excess_levy_capacity: number | null
  levy_limit: number | null
  actual_levy: number | null
  levy_capacity_pct: number | null
  // Reserves
  free_cash: number | null
  free_cash_pct_budget: number | null
  stabilization: number | null
  stabilization_pct_budget: number | null
  overlay: number | null
  // Debt
  total_debt: number | null
  debt_per_capita: number | null
  debt_pct_eqv: number | null
  bond_moodys: string
  bond_sp: string
  authorized_unissued: number | null
  // State Aid
  total_state_aid: number | null
  chapter_70: number | null
  ugga: number | null
  state_aid_pct_revenue: number | null
  // Budget
  operating_budget: number | null
  total_employees: number | null
  total_salaries_wages: number | null
  average_salary: number | null
  salary_share_budget: number | null
  // Intelligence
  risk_flags: RiskFlag[]
  overall_health: HealthStatus
  // Peers
  peer_group: { criteria: string; member_count: number; members: string[] }
  peer_comparisons: PeerComparison[]
  // Trends
  trends: TrendYear[]
  // Sync history
  sync_log: SyncEvent[]
}

export interface ApiMetrics {
  stabilizationBalance: number | null
  stabilizationPctBudget: number | null
  operatingBudget: number | null
  totalEmployees: number | null
  totalSalariesWages: number | null
  averageSalary: number | null
  salariesPctBudget: number | null
  overlayAppropriation: number | null
  totalLevy: number | null
  overlayPctLevy: number | null
  certifiedFreeCash: number | null
  freeCashPctBudget: number | null
  excessLevyCapacity: number | null
  excessLevyCapacityPct: number | null
  maximumLevyLimit: number | null
  totalStateAid: number | null
  stateAidPctBudget: number | null
  totalDebt: number | null
  debtPctEqv: number | null
  debtService: number | null
  debtServicePctBudget: number | null
  bondMoodys: string | null
  bondSp: string | null
  stabilizationTrend: 'up' | 'down' | 'stable' | null
  freeCashTrend: 'up' | 'down' | 'stable' | null
  levyTrend: 'up' | 'down' | 'stable' | null
  stabilizationSeries: Array<{ fy: number; value: number }>
  operatingBudgetSeries: Array<{ fy: number; value: number }>
  freeCashSeries: Array<{ fy: number; value: number }>
  levySeries: Array<{ fy: number; value: number }>
}

export interface ApiRiskFlag {
  code: string
  label: string
  severity: 'critical' | 'warning' | 'info' | 'passing'
  detail: string
  threshold: string
}

export interface ApiSnapshot {
  municipality: string
  dorCode: number
  county: string
  fiscalYear: number
  computedAt: string
  metrics: ApiMetrics
  riskFlags: ApiRiskFlag[]
}

export type DomainId = 'fiscal' | 'education' | 'retirement' | 'infra' | 'env' | 'parcels' | 'governance' | 'health' | 'intelligence'
