// ── Types ─────────────────────────────────────────────────────────────────────

export interface StaffRow {
  name: string
  title: string
  department: string
  email: string
  phone: string
}

export interface BudgetLine {
  department: string
  account: string
  description: string
  appropriation: number
  expended: number
  balance: number
}

export interface FiscalSnapshot {
  operatingBudget: number
  totalEmployees: number
  freeCash: number
  stateAid: number
  debtService: number
  fiscalYear: number
  synced: boolean
  computedAt?: string
}

export interface TownFinderPanelProps {
  onBack?: () => void
}

export type DocType = 'prr-response' | 'meeting-agenda' | 'budget-memo' | 'appointment-notice' | 'press-release' | 'annual-report-cover'

// ── Constants ─────────────────────────────────────────────────────────────────

export const MA_COUNTIES = [
  'Barnstable', 'Berkshire', 'Bristol', 'Dukes', 'Essex', 'Franklin',
  'Hampden', 'Hampshire', 'Middlesex', 'Nantucket', 'Norfolk', 'Plymouth',
  'Suffolk', 'Worcester',
]

// Population cutoff for "small town" focus
export const POPULATION_LIMIT = 25_000

export const REGISTRY_TIMEOUT_MS = 8_000
export const FISCAL_CACHE_TTL_MS = 6 * 60 * 60 * 1000 // 6 hours

// ── Pure utility functions ────────────────────────────────────────────────────

// Per-capita estimates when no DLS data is available
export function estimateFiscal(pop: number): FiscalSnapshot {
  const budget = pop * 3_400
  return {
    operatingBudget: budget,
    totalEmployees: Math.round(pop / 75),
    freeCash: Math.round(budget * 0.062),
    stateAid: Math.round(budget * 0.158),
    debtService: Math.round(budget * 0.082),
    fiscalYear: 2025,
    synced: false,
  }
}

// Generate a reasonable town website URL from name
export function townWebsiteUrl(name: string): string {
  const slug = name.toLowerCase().replace(/\s+/g, '')
  return `https://www.${slug}ma.gov`
}

export function parseStaffCsv(text: string): StaffRow[] {
  const lines = text.trim().split('\n').filter(Boolean)
  if (lines.length < 2) return []
  return lines.slice(1).map(line => {
    const cols = line.split(',').map(c => c.replace(/^"|"$/g, '').trim())
    return {
      name: cols[0] ?? '',
      title: cols[1] ?? '',
      department: cols[2] ?? '',
      email: cols[3] ?? '',
      phone: cols[4] ?? '',
    }
  }).filter(r => r.name)
}

export function parseBudgetCsv(text: string): BudgetLine[] {
  const lines = text.trim().split('\n').filter(Boolean)
  if (lines.length < 2) return []
  return lines.slice(1).map(line => {
    const cols = line.split(',').map(c => c.replace(/^"|"$/g, '').trim())
    const num = (s: string) => parseFloat(s?.replace(/[,$]/g, '') ?? '0') || 0
    return {
      department: cols[0] ?? '',
      account: cols[1] ?? '',
      description: cols[2] ?? '',
      appropriation: num(cols[3]),
      expended: num(cols[4]),
      balance: num(cols[5]) || (num(cols[3]) - num(cols[4])),
    }
  }).filter(r => r.department)
}

export function fmtMoney(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`
  return `$${n.toFixed(0)}`
}

export function fmtNum(n: number): string {
  return n.toLocaleString()
}
