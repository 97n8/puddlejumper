import { cn } from '@/lib/utils'
import { Users, TrendUp, TrendDown, Minus } from '@phosphor-icons/react'
import type { FiscalSnapshot, PeerAssessment } from '../types'
import { fmtValue } from '../utils'

const ASSESS_CFG: Record<PeerAssessment, { Icon: React.ElementType; color: string; label: string }> = {
  above_median: { Icon: TrendUp,   color: 'text-amber-600',  label: 'Above Median' },
  at_median:    { Icon: Minus,     color: 'text-blue-600',   label: 'At Median' },
  below_median: { Icon: TrendDown, color: 'text-red-600',    label: 'Below Median' },
}

export function PeersTab({ snap }: { snap: FiscalSnapshot }) {
  return (
    <div className="p-5 space-y-4">
      {/* Peer group info */}
      <div className="bg-card border rounded-xl p-4 flex items-start gap-3">
        <Users size={18} className="text-primary shrink-0 mt-0.5" />
        <div className="text-sm">
          <div className="font-semibold mb-0.5">Peer Group · {snap.peer_group.member_count} municipalities</div>
          <div className="text-muted-foreground text-xs">{snap.peer_group.criteria}</div>
          <div className="mt-2 flex flex-wrap gap-1">
            {snap.peer_group.members.map(m => (
              <span key={m} className={cn(
                'px-2 py-0.5 rounded text-xs font-medium',
                m === snap.municipality.name
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground'
              )}>{m}</span>
            ))}
          </div>
        </div>
      </div>

      {/* Comparison table */}
      <div className="bg-card border rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b bg-muted/30 grid grid-cols-6 gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            <span className="col-span-2">Metric</span>
            <span className="text-right">Town</span>
            <span className="text-right">Peer Median</span>
            <span className="text-right">Percentile</span>
            <span className="text-right">Context</span>
          </div>
        <div className="divide-y">
          {snap.peer_comparisons.map(row => {
            const cfg = ASSESS_CFG[row.assessment]
            return (
              <div key={row.metric} className="grid grid-cols-6 gap-2 px-4 py-3 text-sm items-center hover:bg-muted/30 transition-colors">
                <span className="col-span-2 font-medium">{row.metric}</span>
                <span className="text-right font-semibold">{fmtValue(row.town_value, row.unit)}</span>
                <span className="text-right text-muted-foreground">{fmtValue(row.peer_median, row.unit)}</span>
                <span className="text-right">
                  <span className={cn('px-2 py-0.5 rounded-full text-xs font-bold', row.percentile >= 60 ? 'bg-amber-100 text-amber-700' : row.percentile <= 40 ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700')}>
                    {row.percentile}th
                  </span>
                </span>
                <span className={cn('text-right flex items-center justify-end gap-1 text-xs font-semibold', cfg.color)}>
                  <cfg.Icon size={12} weight="bold" />
                  {cfg.label}
                </span>
              </div>
            )
          })}
        </div>
        <div className="px-4 py-2 border-t bg-muted/20">
          <p className="text-[11px] text-muted-foreground">Peer range shown across {snap.peer_group.member_count} comparable municipalities using Massachusetts public-finance records · FY{snap.fiscal_year}</p>
        </div>
      </div>
    </div>
  )
}
