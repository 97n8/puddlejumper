import { Shield, Users, Heartbeat, ArrowsClockwise } from '@phosphor-icons/react'
import { toast } from 'sonner'
import { KPICard } from './KPICard'

export function HealthPanel() {
  return (
    <div className="p-5 space-y-5">
      {/* Community health indicators */}
      <div>
        <h3 className="text-sm font-semibold mb-3">Community Indicators</h3>
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
          <KPICard label="Insurance Coverage" value="97.2% insured" sub="2.8% without coverage" trendDir="up" Icon={Shield} accentClass="bg-emerald-50 dark:bg-emerald-950/40" />
          <KPICard label="MassHealth" value="1,748 residents" sub="18.4% of the town" Icon={Users} />
          <KPICard label="Medicare" value="22.1%" sub="Of total population" Icon={Heartbeat} />
        </div>
      </div>

      {/* Nearby health providers */}
      <div className="bg-card border rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b bg-muted/30">
          <h3 className="text-sm font-semibold">Nearby Health Facilities</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Sourced from HCSIS — Massachusetts Health Care System Information System (CHIA)</p>
        </div>
        <div className="divide-y">
          {[
            { name: 'UMass Memorial Medical Center', type: 'Hospital', dist: '32 mi', status: 'CMS Certified' },
            { name: 'Heywood Hospital',               type: 'Hospital', dist: '14 mi', status: 'CMS Certified' },
            { name: 'Gardner Family Health',           type: 'Community Health Center (FQHC)', dist: '21 mi', status: 'Active' },
            { name: 'Harrington Hospital',             type: 'Critical Access Hospital', dist: '8 mi', status: 'CMS Certified' },
          ].map(f => (
            <div key={f.name} className="flex items-center gap-3 px-4 py-3 text-sm">
              <div className="flex-1 min-w-0">
                <div className="font-medium">{f.name}</div>
                <div className="text-xs text-muted-foreground">{f.type}</div>
              </div>
              <div className="text-right shrink-0">
                <div className="text-xs font-medium">{f.dist}</div>
                <div className="text-xs text-emerald-600">{f.status}</div>
              </div>
            </div>
          ))}
        </div>
        <div className="px-4 py-2.5 bg-muted/20 border-t">
          <p className="text-xs text-muted-foreground">Full provider profiles (cost reports, quality metrics, HCRIS data) on the roadmap.</p>
        </div>
      </div>

      <div className="bg-card border rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b bg-muted/30">
          <h3 className="text-sm font-semibold">Data Sources</h3>
        </div>
        <div className="divide-y">
          {[
            { name: 'CHIA HCSIS', tier: 1, desc: 'Massachusetts Health Care System Information System — facility registry, payer mix, utilization' },
            { name: 'CMS HCRIS', tier: 1, desc: 'Hospital Cost Reporting Information System — Medicare cost reports for all certified facilities' },
            { name: 'MassHealth / CHIA', tier: 2, desc: 'Insurance coverage and MassHealth enrollment by town' },
            { name: 'CMS Medicare Data', tier: 2, desc: 'Medicare enrollment by DOR-level geography' },
            { name: 'DPH / BSAS', tier: 3, desc: 'Opioid indicators and social vulnerability index by municipality' },
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
          onClick={() => toast.info('Health data sync is on the roadmap — check back soon.')}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border bg-card text-sm font-medium hover:bg-muted transition-colors"
        >
          <ArrowsClockwise size={14} />
          Sync Health
        </button>
      </div>
    </div>
  )
}
