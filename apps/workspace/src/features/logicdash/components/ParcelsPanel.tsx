import { MapPin, CurrencyDollar, ChartBar, Star, TrendUp, CheckCircle, ArrowsClockwise } from '@phosphor-icons/react'
import { toast } from 'sonner'
import { KPICard } from './KPICard'

export function ParcelsPanel() {
  return (
    <div className="p-5 space-y-5">
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        <KPICard label="Total Parcels" value="4,218" sub="All parcel classes" Icon={MapPin} />
        <KPICard label="Total Assessed Value" value="$1.25B" sub="FY2026 assessment" Icon={CurrencyDollar} />
        <KPICard label="Residential %" value="76.8%" sub="3,640 parcels · % of total value" Icon={ChartBar} />
        <KPICard label="Median Sale Price" value="$485,000" sub="Trailing 12 months" Icon={Star} />
        <KPICard label="New Growth" value="$470K" sub="2.5% of levy limit" Icon={TrendUp} accentClass="bg-emerald-50 dark:bg-emerald-950/40" />
        <KPICard label="ASR Ratio" value="0.94" sub="Acceptable range: 0.90–1.10" trendDir="up" Icon={CheckCircle} accentClass="bg-emerald-50 dark:bg-emerald-950/40" />
      </div>

      <div className="bg-card border rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b bg-muted/30">
          <h3 className="text-sm font-semibold">Data Sources</h3>
        </div>
        <div className="divide-y">
          {[
            { name: 'MassGIS L3 Parcels', tier: 1, desc: 'Standardized parcel layer, assessed values' },
            { name: 'BLA Sales', tier: 2, desc: 'Bureau of Local Assessment sales data' },
            { name: 'DLS Reports', tier: 3, desc: 'New growth, levy limit detail' },
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
          onClick={() => toast.info('Parcel data sync is on the roadmap — check back soon.')}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border bg-card text-sm font-medium hover:bg-muted transition-colors"
        >
          <ArrowsClockwise size={14} />
          Sync Parcels
        </button>
      </div>
    </div>
  )
}
