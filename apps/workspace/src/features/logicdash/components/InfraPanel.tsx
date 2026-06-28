import { cn } from '@/lib/utils'
import { Signpost, ChartBar, Warning, CurrencyDollar, Bank, ArrowsClockwise } from '@phosphor-icons/react'
import { toast } from 'sonner'
import type { Severity } from '../types'
import { SEV_CFG } from '../utils'
import { KPICard } from './KPICard'

export function InfraPanel() {
  return (
    <div className="p-5 space-y-5">
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        <KPICard label="Total Road Miles" value="87.4 mi" sub="82.1 municipal miles" Icon={Signpost} />
        <KPICard label="Avg Road Condition (PCI)" value="62/100" sub="Moderate condition" Icon={ChartBar} />
        <KPICard label="Miles Below PCI 55" value="18.4 mi" sub="Deferred maintenance risk" trend="⚠ Warning" trendDir="down" Icon={Warning} accentClass="bg-amber-50 dark:bg-amber-950/40" />
        <KPICard label="Total Bridges" value="12" sub="2 structurally deficient" trend="⚠ Warning" trendDir="down" Icon={Warning} accentClass="bg-red-50 dark:bg-red-950/40" />
        <KPICard label="Chapter 90 Allocation" value="$412K/yr" sub="FY2026" Icon={CurrencyDollar} />
        <KPICard label="DPW Budget" value="$4.5M" sub="11.9% of operating budget" Icon={Bank} />
      </div>

      <div className="bg-card border rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b bg-muted/30">
          <h3 className="text-sm font-semibold">Risk Flags</h3>
        </div>
        <div className="space-y-2 p-4">
          {[
            { flag: 'BRIDGE_DEFICIENT', sev: 'warning' as Severity, msg: '2 structurally deficient bridges — capital planning required. Combined replacement cost estimate exceeds 5× annual capital budget.' },
            { flag: 'ROAD_DEFERRED_MAINTENANCE', sev: 'warning' as Severity, msg: '18.4 miles of road below PCI 55 — deferred maintenance estimated at 3× annual Ch.90 allocation.' },
          ].map(f => {
            const cfg = SEV_CFG[f.sev]
            return (
              <div key={f.flag} className={cn('flex items-start gap-3 p-3 rounded-xl border', cfg.bg, cfg.border)}>
                <cfg.Icon size={16} className={cn('shrink-0 mt-0.5', cfg.color)} weight="fill" />
                <div>
                  <div className={cn('text-xs font-bold', cfg.color)}>{f.flag}</div>
                  <p className="text-sm text-foreground mt-0.5">{f.msg}</p>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <div className="bg-card border rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b bg-muted/30">
          <h3 className="text-sm font-semibold">Data Sources</h3>
        </div>
        <div className="divide-y">
          {[
            { name: 'MassDOT ArcGIS REST API', tier: 1, desc: 'Road inventory, bridge condition data' },
            { name: 'Chapter 90 Mass.gov', tier: 2, desc: 'Annual Ch.90 allocations by municipality' },
          ].map(ds => (
            <div key={ds.name} className="flex items-center gap-3 px-4 py-3 text-sm">
              <div className="w-6 h-6 rounded flex items-center justify-center bg-primary/10 text-[10px] font-bold text-primary shrink-0">T{ds.tier}</div>
              <div className="flex-1">
                <div className="font-medium">{ds.name}</div>
                <div className="text-xs text-muted-foreground">{ds.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex justify-end">
        <button
          onClick={() => toast.info('Infrastructure data sync is on the roadmap — check back soon.')}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border bg-card text-sm font-medium hover:bg-muted transition-colors"
        >
          <ArrowsClockwise size={14} />
          Sync Infrastructure
        </button>
      </div>
    </div>
  )
}
