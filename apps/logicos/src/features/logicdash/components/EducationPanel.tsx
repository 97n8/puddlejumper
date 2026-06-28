import { cn } from '@/lib/utils'
import { Users, CurrencyDollar, ChartBar, Star, Buildings, ArrowsClockwise } from '@phosphor-icons/react'
import { toast } from 'sonner'
import type { Severity } from '../types'
import { SEV_CFG } from '../utils'
import { KPICard } from './KPICard'

export function EducationPanel() {
  return (
    <div className="p-5 space-y-5">
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        <KPICard label="Enrollment" value="1,680 students" sub="−0.9% vs prior year" trend="−0.9%/yr" trendDir="down" Icon={Users} accentClass="bg-blue-50 dark:bg-blue-950/40" />
        <KPICard label="Per Pupil Expenditure" value="$17,240" sub="−2.4% vs state avg" trend="Below avg" trendDir="down" Icon={CurrencyDollar} accentClass="bg-amber-50 dark:bg-amber-950/40" />
        <KPICard label="Net School Spending" value="$12.8M actual" sub="Required: $11.9M" trend="Above required" trendDir="up" Icon={ChartBar} accentClass="bg-emerald-50 dark:bg-emerald-950/40" />
        <KPICard label="Chapter 70 Aid" value="$2.8M" sub="DESE Foundation Budget" Icon={Buildings} />
        <KPICard label="MCAS ELA" value="62%" sub="Meeting/Exceeding expectations" Icon={Star} />
        <KPICard label="Teacher Ratio" value="13.2:1" sub="Students per teacher" Icon={Users} />
      </div>

      <div className="bg-card border rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b bg-muted/30">
          <h3 className="text-sm font-semibold">Risk Flags</h3>
        </div>
        <div className="space-y-2 p-4">
          {[
            { flag: 'ENROLLMENT_DECLINE', sev: 'info' as Severity, msg: 'Enrollment declining 0.9%/yr — monitor Foundation Budget impact on Chapter 70 aid' },
            { flag: 'PER_PUPIL_BELOW_AVG', sev: 'info' as Severity, msg: 'Per-pupil $17,240 is 7.6% below state average — review allocation efficiency' },
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
            { name: 'DESE RADAR', tier: 1, desc: 'Per-pupil expenditure, enrollment' },
            { name: 'DESE Profiles', tier: 2, desc: 'MCAS scores, teacher data' },
            { name: 'Cherry Sheet', tier: 2, desc: 'Chapter 70 aid allocations' },
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
          onClick={() => toast.info('Education data sync is on the roadmap — check back soon.')}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border bg-card text-sm font-medium hover:bg-muted transition-colors"
        >
          <ArrowsClockwise size={14} />
          Sync Education
        </button>
      </div>
    </div>
  )
}
