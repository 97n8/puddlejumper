
import {
  ArrowsLeftRight, CurrencyDollar, Shield, Bank, ChartBar, Users, Seal,
} from '@phosphor-icons/react'
import type { FiscalSnapshot } from '../types'
import { fmt$, fmtPct, buildHealthReason } from '../utils'
import { KPICard, SealBadge } from './KPICard'

const COMMON_HELPER_TERMS = [
  {
    term: 'Free cash',
    helper: 'Your year-end cushion',
    detail: 'Money left after the books close and DLS certifies it. This is the town breath-room number.',
  },
  {
    term: 'Levy capacity',
    helper: 'Room left under Prop 2½',
    detail: 'How much tax-room is still available before the town runs into its annual property-tax ceiling.',
  },
  {
    term: 'Stabilization',
    helper: 'Rainy-day reserve',
    detail: 'Money the town can vote to use later for shocks, capital pressure, or one-time needs.',
  },
  {
    term: 'Debt per capita',
    helper: 'Borrowing spread across residents',
    detail: 'Not a bill to each resident — just a quick way to compare debt weight across years and towns.',
  },
]

export function SnapshotTab({ snap }: { snap: FiscalSnapshot }) {
  const coverageRows = [
    {
      label: 'Reserves',
      detail: snap.stabilization !== null ? 'Reserve detail is connected from the current DLS path.' : 'Reserve detail has not landed yet.',
    },
    {
      label: 'Levy room',
      detail: snap.levy_capacity_pct !== null ? 'Levy headroom is connected from the levy-capacity report.' : 'Levy headroom has not landed yet.',
    },
    {
      label: 'Liquidity',
      detail: snap.free_cash !== null ? 'Free cash is connected from the certified free-cash report.' : 'Free cash has not been published for this year.',
    },
  ]

  const glossaryRows = COMMON_HELPER_TERMS.slice(0, 2)

  const revenueRows = [
    {
      label: 'Tax Levy',
      amount: snap.actual_levy,
      pct: snap.actual_levy !== null && snap.operating_budget ? (snap.actual_levy / snap.operating_budget) * 100 : null,
    },
    {
      label: 'Known State Aid',
      amount: snap.total_state_aid,
      pct: snap.total_state_aid !== null && snap.operating_budget ? (snap.total_state_aid / snap.operating_budget) * 100 : null,
    },
  ]

  const compactCards = [
    {
      label: 'Levy Room',
      value: fmt$(snap.excess_levy_capacity),
      sub: snap.levy_capacity_pct !== null ? `${fmtPct(snap.levy_capacity_pct)} of max levy` : 'Tax-room share unavailable',
      trend: snap.levy_capacity_pct === null ? undefined : snap.levy_capacity_pct < 3 ? 'Tight tax room' : 'Room available',
      trendDir: snap.levy_capacity_pct === null ? 'flat' as const : snap.levy_capacity_pct < 3 ? 'down' as const : 'up' as const,
      Icon: ArrowsLeftRight,
      accentClass: 'bg-blue-50 dark:bg-blue-950/40',
    },
    {
      label: 'Free Cash',
      value: fmt$(snap.free_cash),
      sub: snap.free_cash_pct_budget !== null ? `${fmtPct(snap.free_cash_pct_budget)} of budget` : 'Awaiting DOR certification',
      trend: snap.free_cash_pct_budget === null ? undefined : snap.free_cash_pct_budget < 5 ? 'Below comfort line' : 'On target',
      trendDir: snap.free_cash_pct_budget === null ? 'flat' as const : snap.free_cash_pct_budget < 5 ? 'down' as const : 'up' as const,
      Icon: CurrencyDollar,
      accentClass: snap.free_cash_pct_budget !== null && snap.free_cash_pct_budget < 5 ? 'bg-amber-50 dark:bg-amber-950/40' : 'bg-emerald-50 dark:bg-emerald-950/40',
    },
    {
      label: 'Stabilization',
      value: fmt$(snap.stabilization),
      sub: snap.stabilization_pct_budget !== null ? `${fmtPct(snap.stabilization_pct_budget)} of budget` : 'Reserve detail unavailable',
      trend: snap.stabilization_pct_budget === null ? undefined : snap.stabilization_pct_budget >= 5 ? 'Above target' : 'Below target',
      trendDir: snap.stabilization_pct_budget === null ? 'flat' as const : snap.stabilization_pct_budget >= 5 ? 'up' as const : 'down' as const,
      Icon: Shield,
      accentClass: snap.stabilization_pct_budget !== null && snap.stabilization_pct_budget < 5 ? 'bg-amber-50 dark:bg-amber-950/40' : 'bg-emerald-50 dark:bg-emerald-950/40',
    },
    {
      label: 'Debt / Capita',
      value: snap.debt_per_capita !== null ? `$${snap.debt_per_capita.toLocaleString()}` : '—',
      sub: snap.debt_pct_eqv !== null ? `${fmtPct(snap.debt_pct_eqv)} of EQV` : 'Debt share unavailable',
      trend: snap.debt_per_capita === null ? undefined : 'Debt context loaded',
      trendDir: snap.debt_per_capita === null ? 'flat' as const : 'down' as const,
      Icon: Bank,
      accentClass: 'bg-slate-50 dark:bg-slate-800',
    },
    {
      label: 'Budget Base',
      value: fmt$(snap.operating_budget),
      sub: `State aid ${fmt$(snap.total_state_aid)}`,
      trend: snap.state_aid_pct_revenue !== null ? `${fmtPct(snap.state_aid_pct_revenue)} aid share` : undefined,
      trendDir: 'flat' as const,
      Icon: ChartBar,
    },
    {
      label: 'Workforce',
      value: snap.total_employees !== null ? snap.total_employees.toLocaleString() : '—',
      sub: snap.total_salaries_wages !== null ? `${fmt$(snap.total_salaries_wages)} salary load` : 'Personnel totals unavailable',
      trend: snap.salary_share_budget !== null ? `${fmtPct(snap.salary_share_budget)} of budget` : undefined,
      trendDir: 'flat' as const,
      Icon: Users,
    },
  ]

  return (
    <div className="flex flex-col gap-3 p-3.5">
      <div className="grid flex-none grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-6">
        {compactCards.map(card => (
          <KPICard key={card.label} {...card} compact />
        ))}
      </div>

      <div className="grid min-h-0 flex-1 gap-3 lg:grid-cols-3 xl:grid-cols-[1.2fr_0.9fr_1fr]">
        <div className="rounded-xl border bg-card p-3">
          <div className="flex items-center justify-between gap-3">
            <div className="text-sm font-semibold">Revenue mix</div>
            <div className="text-[11px] text-muted-foreground">Levy limit {fmt$(snap.levy_limit)}</div>
          </div>
          <div className="mt-2.5 space-y-2.5">
            {revenueRows.map(row => (
              <div key={row.label} className="space-y-1.5">
                <div className="flex items-center justify-between gap-3 text-xs">
                  <span className="font-medium text-foreground">{row.label}</span>
                  <span className="text-muted-foreground">{fmt$(row.amount)} · {fmtPct(row.pct, 0)}</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-primary/60" style={{ width: `${Math.min(row.pct ?? 0, 100)}%` }} />
                </div>
              </div>
            ))}
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2">
            <div className="rounded-lg bg-muted/25 px-3 py-2">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Bond ratings</div>
              <div className="mt-1 text-sm font-semibold">{snap.bond_moodys} / {snap.bond_sp}</div>
            </div>
            <div className="rounded-lg bg-muted/25 px-3 py-2">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Authorized unissued</div>
              <div className="mt-1 text-sm font-semibold">{fmt$(snap.authorized_unissued)}</div>
            </div>
          </div>
        </div>

        <div className="rounded-xl border bg-card p-3">
          <div className="text-sm font-semibold">Coverage</div>
          <div className="mt-2.5 space-y-2">
            {coverageRows.map(row => (
              <div key={row.label} className="rounded-lg bg-muted/25 px-3 py-2">
                <div className="text-sm font-medium">{row.label}</div>
                <div className="text-xs text-muted-foreground">{row.detail}</div>
              </div>
            ))}
          </div>

          <div className="mt-3 rounded-lg border bg-muted/10 px-3 py-2.5">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Current watch note</div>
            <div className="mt-1 text-sm text-foreground">{buildHealthReason(snap)}</div>
          </div>
        </div>

        <div className="rounded-xl border bg-card p-3">
          <div className="text-sm font-semibold">Quick guide</div>
          <div className="mt-2.5 grid gap-2">
            {glossaryRows.map(item => (
              <div key={item.term} className="rounded-lg border bg-muted/10 px-3 py-2">
                <div className="text-sm font-medium">{item.term}</div>
                <div className="text-xs text-primary">{item.helper}</div>
              </div>
            ))}
          </div>

          <div className="mt-3 flex items-center gap-3 rounded-lg border bg-muted/20 px-3 py-2.5">
            <Seal size={18} className="shrink-0 text-emerald-600" weight="fill" />
            <div className="min-w-0 text-xs text-muted-foreground">
              <span className="font-semibold text-foreground">SEAL integrity</span> keeps an audit hash on every DLS ingest.
            </div>
            <SealBadge hash={snap.seal_hash} />
          </div>
        </div>
      </div>
    </div>
  )
}
