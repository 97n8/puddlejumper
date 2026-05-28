import { cn } from '@/lib/utils'
import { CloudArrowDown, Clock, ArrowsClockwise } from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import type { FiscalSnapshot } from '../types'
import { fmtDate, SYNC_STATUS_CFG } from '../utils'

export function SyncTab({ snap, onSync }: { snap: FiscalSnapshot; onSync: () => void }) {
  return (
    <div className="p-5 space-y-4">
      {/* Sync controls */}
      <div className="bg-card border rounded-xl p-4 flex items-center gap-4">
        <CloudArrowDown size={24} className="text-primary shrink-0" />
        <div className="flex-1">
          <div className="font-semibold text-sm">State finance data sync</div>
          <div className="text-xs text-muted-foreground mt-0.5">
            Pulls the latest Massachusetts state finance records for revenue, reserves, levy limits, and debt.
          </div>
        </div>
        <Button size="sm" onClick={onSync} className="shrink-0 gap-1.5">
          <ArrowsClockwise size={14} />
          Sync Now
        </Button>
      </div>

      {/* Datasets */}
      <div className="bg-card border rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b bg-muted/30">
          <h3 className="text-sm font-semibold">Data Sources</h3>
        </div>
        <div className="divide-y">
          {[
            { name: 'Schedule A',       tier: 1, desc: 'Annual revenue/expenditure detail', freq: 'Annual (Dec–Mar)',   last: 'FY2025 ✓' },
            { name: 'Cherry Sheets',    tier: 2, desc: 'State aid allocations + distributions', freq: 'Semi-annual',   last: 'FY2026 Preliminary ✓' },
            { name: 'Free Cash',        tier: 3, desc: 'DLS-certified free cash amount',    freq: 'Annual (Oct–Jan)',   last: 'FY2025 ✓' },
            { name: 'Levy Limit',       tier: 3, desc: 'Proposition 2½ levy limit detail',  freq: 'Annual (Oct–Dec)',   last: 'FY2026 ✓' },
            { name: 'Debt Analysis',    tier: 1, desc: 'Outstanding debt + indicators',     freq: 'Annual',             last: 'FY2025 ✓' },
          ].map(ds => (
            <div key={ds.name} className="flex items-center gap-3 px-4 py-3 text-sm">
              <div className="w-6 h-6 rounded flex items-center justify-center bg-primary/10 text-[10px] font-bold text-primary shrink-0">T{ds.tier}</div>
              <div className="flex-1">
                <div className="font-medium">{ds.name}</div>
                <div className="text-xs text-muted-foreground">{ds.desc}</div>
              </div>
              <div className="text-right">
                <div className="text-xs text-muted-foreground">{ds.freq}</div>
                <div className="text-xs text-emerald-600 font-medium">{ds.last}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Sync log */}
      <div className="bg-card border rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b bg-muted/30">
          <h3 className="text-sm font-semibold">Sync History</h3>
        </div>
        <div className="divide-y">
          {snap.sync_log.map(ev => {
            const cfg = SYNC_STATUS_CFG[ev.status]
            return (
              <div key={ev.id} className="flex items-center gap-3 px-4 py-3 text-sm">
                <Clock size={14} className="text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium">{fmtDate(ev.timestamp)}</span>
                    <span className={cn('px-2 py-0.5 rounded text-xs font-semibold', cfg.color)}>{cfg.label}</span>
                    <span className="text-xs text-muted-foreground">Tier {ev.source_tier}</span>
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5 truncate">
                    {ev.datasets.join(', ')}
                    {ev.seal_hash && <> · <span className="font-mono">{ev.seal_hash.slice(0, 20)}…</span></>}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
