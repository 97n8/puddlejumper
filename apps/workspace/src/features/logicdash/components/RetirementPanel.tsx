import { cn } from '@/lib/utils'
import { Shield, Bank, CurrencyDollar, Users, Clock, ChartBar, ArrowsClockwise } from '@phosphor-icons/react'
import { toast } from 'sonner'
import type { Severity } from '../types'
import { SEV_CFG } from '../utils'
import { KPICard } from './KPICard'

export function RetirementPanel() {
  return (
    <div className="p-5 space-y-5">
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        <KPICard label="Funded Ratio" value="67.2%" sub="Below 70% advisory threshold" trend="⚠ Warning" trendDir="down" Icon={Shield} accentClass="bg-amber-50 dark:bg-amber-950/40" />
        <KPICard label="Unfunded Liability" value="$18.3M" sub="$1,926 per capita" Icon={Bank} accentClass="bg-red-50 dark:bg-red-950/40" />
        <KPICard label="Employer Contribution" value="$2.5M/yr" sub="6.8% CAGR (5yr)" trend="↑ 6.8% CAGR" trendDir="up" Icon={CurrencyDollar} />
        <KPICard label="Active/Retiree Ratio" value="1.30" sub="142 active · 109 retirees" Icon={Users} />
        <KPICard label="Full Funding Year" value="2040" sub="14 years remaining" Icon={Clock} />
        <KPICard label="Assumed Return" value="7.15%" sub="Investment return assumption" Icon={ChartBar} />
      </div>

      <div className="bg-card border rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b bg-muted/30">
          <h3 className="text-sm font-semibold">Risk Flags</h3>
        </div>
        <div className="space-y-2 p-4">
          {[
            { flag: 'FUNDED_RATIO_LOW', sev: 'warning' as Severity, msg: 'Funded ratio at 67.2% — below the 70% advisory threshold. Employer contribution growing at 6.8% vs 3.6% revenue growth — pension crowdout risk.' },
            { flag: 'RETIREE_RATIO_DECLINING', sev: 'info' as Severity, msg: 'Active-to-retiree ratio 1.30 — healthy but declining trend over 5 years.' },
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
            { name: 'PERAC Funded Ratios', tier: 1, desc: 'Annual funded ratio CSV' },
            { name: 'PERAC Annual Report', tier: 2, desc: 'Detailed pension financials (PDF)' },
            { name: 'DLS Schedule A Org 911', tier: 3, desc: 'Retirement appropriation line items' },
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
          onClick={() => toast.info('Retirement data sync is on the roadmap — check back soon.')}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border bg-card text-sm font-medium hover:bg-muted transition-colors"
        >
          <ArrowsClockwise size={14} />
          Sync Retirement
        </button>
      </div>
    </div>
  )
}
