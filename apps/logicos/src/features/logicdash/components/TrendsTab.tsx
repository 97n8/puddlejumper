import { cn } from '@/lib/utils'
import { TrendUp, TrendDown } from '@phosphor-icons/react'
import type { FiscalSnapshot, TrendYear } from '../types'
import { fmt$, fmtPct } from '../utils'

export function TrendsTab({ snap }: { snap: FiscalSnapshot }) {
  return (
    <div className="p-5 space-y-4">
      <div className="bg-card border rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b bg-muted/30">
          <h3 className="text-sm font-semibold">Fiscal Trend · FY{snap.trends[0]?.fy ?? snap.fiscal_year}–FY{snap.fiscal_year}</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/20">
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Metric</th>
                {snap.trends.map(t => (
                  <th key={t.fy} className={cn('text-right px-4 py-2.5 text-xs font-semibold uppercase tracking-wide', t.fy === snap.fiscal_year ? 'text-primary' : 'text-muted-foreground')}>
                    FY{t.fy}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y">
              {[
                { label: 'Operating Budget', fmt: (t: TrendYear) => fmt$(t.operating_budget) },
                { label: 'Free Cash %',      fmt: (t: TrendYear) => fmtPct(t.free_cash_pct) },
                { label: 'Stabilization %',  fmt: (t: TrendYear) => fmtPct(t.stabilization_pct) },
                 { label: 'Debt Per Capita',  fmt: (t: TrendYear) => t.debt_per_capita !== null ? `$${t.debt_per_capita}` : '—' },
                { label: 'Levy Capacity %',  fmt: (t: TrendYear) => fmtPct(t.levy_capacity_pct) },
                { label: 'State Aid %',      fmt: (t: TrendYear) => fmtPct(t.state_aid_pct) },
              ].map(row => (
                <tr key={row.label} className="hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-2.5 font-medium text-muted-foreground">{row.label}</td>
                  {snap.trends.map(t => (
                    <td key={t.fy} className={cn('text-right px-4 py-2.5 font-mono text-xs', t.fy === snap.fiscal_year ? 'font-semibold text-primary' : '')}>
                      {row.fmt(t)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Free Cash trend', note: 'Declining 3 years — approaching advisory threshold', Icon: TrendDown, color: 'text-amber-600', bg: 'bg-amber-50 dark:bg-amber-950/40', border: 'border-amber-200 dark:border-amber-800' },
          { label: 'Stabilization trend', note: 'Growing steadily — strong reserve-building posture', Icon: TrendUp, color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-950/40', border: 'border-emerald-200 dark:border-emerald-800' },
          { label: 'Debt Per Capita', note: 'Gradual increase · within safe EQV threshold', Icon: TrendUp, color: 'text-amber-600', bg: 'bg-amber-50 dark:bg-amber-950/40', border: 'border-amber-200 dark:border-amber-800' },
        ].map(item => (
          <div key={item.label} className={cn('p-3 rounded-xl border flex items-start gap-2', item.bg, item.border)}>
            <item.Icon size={16} className={cn('shrink-0 mt-0.5', item.color)} weight="bold" />
            <div>
              <div className={cn('text-xs font-bold', item.color)}>{item.label}</div>
              <div className="text-xs text-muted-foreground mt-0.5">{item.note}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
