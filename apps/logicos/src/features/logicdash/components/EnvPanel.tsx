import { CheckCircle, Warning, Tree, ArrowsClockwise } from '@phosphor-icons/react'
import { toast } from 'sonner'
import { KPICard } from './KPICard'

export function EnvPanel() {
  return (
    <div className="p-5 space-y-5">
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        <KPICard label="DEP Compliance" value="✓ Compliant" sub="0 open enforcement actions" trendDir="up" Icon={CheckCircle} accentClass="bg-emerald-50 dark:bg-emerald-950/40" />
        <KPICard label="Drinking Water" value="✓ No Violations" sub="PWS MA2297000" trendDir="up" Icon={CheckCircle} accentClass="bg-emerald-50 dark:bg-emerald-950/40" />
        <KPICard label="Lead in Schools" value="✓ 0 of 4" sub="No schools above action level" trendDir="up" Icon={CheckCircle} accentClass="bg-emerald-50 dark:bg-emerald-950/40" />
        <KPICard label="Active 21E Sites" value="3 sites" sub="0 with municipal liability" Icon={Warning} />
        <KPICard label="Wetland NOI Active" value="8 permits" sub="Active NOI permits" Icon={Tree} />
        <KPICard label="MS4 Stormwater" value="✓ Filed" sub="Annual report filed" trendDir="up" Icon={CheckCircle} accentClass="bg-emerald-50 dark:bg-emerald-950/40" />
      </div>

      <div className="bg-card border rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b bg-muted/30">
          <h3 className="text-sm font-semibold">Data Sources</h3>
        </div>
        <div className="divide-y">
          {[
            { name: 'EPA ECHO API', tier: 1, desc: 'Enforcement & compliance history' },
            { name: 'EEA Portal', tier: 2, desc: 'Wetlands, 21E sites, MS4 permits' },
            { name: 'Mass.gov DEP', tier: 3, desc: 'Drinking water system records' },
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
          onClick={() => toast.info('Environmental data sync is on the roadmap — check back soon.')}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border bg-card text-sm font-medium hover:bg-muted transition-colors"
        >
          <ArrowsClockwise size={14} />
          Sync Environment
        </button>
      </div>
    </div>
  )
}
