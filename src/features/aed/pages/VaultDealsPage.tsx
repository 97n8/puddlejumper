import { useState, useEffect } from 'react'
import { aedApi, type NMTCDeal, type Obligation } from '../api/aedApi'
import { ArrowLeft } from '@phosphor-icons/react'
import {
  aedBackLinkClass,
  aedBadgeClass,
  aedBodyTextClass,
  aedEmptyStateClass,
  aedInteractivePanelClass,
  aedMetaTextClass,
  aedPageClass,
  aedPanelClass,
  aedSectionTitleClass,
  aedSubtitleClass,
  aedTitleClass,
} from '../aedTheme'

function statusBadge(status: string) {
  switch (status) {
    case 'active':     return aedBadgeClass('emerald')
    case 'at_risk':    return aedBadgeClass('red')
    case 'monitoring': return aedBadgeClass('yellow')
    case 'closed':     return aedBadgeClass('neutral')
    default:           return aedBadgeClass('neutral')
  }
}

function year7Progress(closeDate: string, year7Date: string) {
  const start = new Date(closeDate).getTime()
  const end   = new Date(year7Date).getTime()
  const now   = Date.now()
  const pct   = Math.min(100, Math.max(0, ((now - start) / (end - start)) * 100))
  const daysLeft = Math.max(0, Math.round((end - now) / 86_400_000))
  return { pct, daysLeft }
}

interface DealRowProps {
  deal: NMTCDeal
  selected: boolean
  onSelect: () => void
}

function DealRow({ deal, selected, onSelect }: DealRowProps) {
  const { pct, daysLeft } = year7Progress(deal.close_date, deal.year_7_date)
  return (
    <button
      onClick={onSelect}
      className={selected
        ? aedPanelClass('amber', 'w-full p-4 text-left transition-all')
        : aedInteractivePanelClass('neutral', 'w-full p-4 text-left')}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-bold text-zinc-900 dark:text-white/90">{deal.name}</span>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${statusBadge(deal.status)}`}>
              {deal.status.replace('_', ' ')}
            </span>
          </div>
          <p className={`mt-0.5 text-[11px] ${aedMetaTextClass}`}>{deal.deal_number} · {deal.cde_name}</p>
        </div>
        <div className="text-right shrink-0">
          <div className="text-sm font-bold text-amber-700 dark:text-amber-300">${(deal.qei_amount / 1_000_000).toFixed(1)}M QEI</div>
          <div className={`text-[11px] ${aedMetaTextClass}`}>Close: {deal.close_date.slice(0, 10)}</div>
        </div>
      </div>
      {/* 7-year progress */}
      <div className="mt-3">
        <div className={`mb-1 flex justify-between text-[11px] ${aedMetaTextClass}`}>
          <span>7-Year Compliance Clock</span>
          <span>{daysLeft > 0 ? `${daysLeft} days left` : 'Year 7 reached'}</span>
        </div>
        <div className="h-1.5 rounded-full bg-stone-200 dark:bg-zinc-800">
          <div
            className={`h-full rounded-full ${pct >= 90 ? 'bg-red-500' : pct >= 70 ? 'bg-yellow-500' : 'bg-amber-500'}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
    </button>
  )
}

export function VaultDealsPage({ onNavigate }: { onNavigate: (moduleId: string) => void }) {
  const [deals, setDeals] = useState<NMTCDeal[]>([])
  const [selectedDeal, setSelectedDeal] = useState<NMTCDeal | null>(null)
  const [obligations, setObligations] = useState<Obligation[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    aedApi.deals.list()
      .then(r => setDeals(r.deals))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (!selectedDeal) return
    aedApi.obligations.list(selectedDeal.id)
      .then(r => setObligations(r.obligations))
      .catch(() => setObligations([]))
  }, [selectedDeal])

  if (loading) return (
    <div className="flex-1 flex items-center justify-center">
      <span className="text-sm text-muted-foreground animate-pulse">Loading deals…</span>
    </div>
  )

  if (error) return (
    <div className="flex-1 flex items-center justify-center">
      <span className="text-sm text-red-400">{error}</span>
    </div>
  )

  return (
    <div className={`${aedPageClass} space-y-6`}>
      <div>
        <button onClick={() => onNavigate('workbench')} className={aedBackLinkClass}>
          <ArrowLeft size={11} /> Back to Workbench
        </button>
        <h1 className={aedTitleClass}>Tax Credit Deals</h1>
        <p className={aedSubtitleClass}>
          Each deal has a <strong className="text-zinc-800 dark:text-white/70">7-year compliance window</strong> from closing.
          The deal must stay compliant throughout — falling out can trigger repayment of tax credits.
        </p>
      </div>

      {deals.length === 0 ? (
        <div className={aedEmptyStateClass}>
          <div className="text-4xl mb-3">🏛</div>
          <p className="text-sm">No deals yet. An administrator can add the first tax credit deal.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {deals.map(d => (
            <DealRow
              key={d.id}
              deal={d}
              selected={selectedDeal?.id === d.id}
              onSelect={() => setSelectedDeal(prev => prev?.id === d.id ? null : d)}
            />
          ))}
        </div>
      )}

      {/* Obligation detail panel */}
      {selectedDeal && (
        <section>
          <h2 className={`${aedSectionTitleClass} mb-3`}>
            Obligations — {selectedDeal.name}
          </h2>
          {obligations.length === 0 ? (
            <p className={`text-sm ${aedMetaTextClass}`}>No obligations recorded.</p>
          ) : (
            <div className="space-y-2">
              {obligations.map(o => (
                <div key={o.id} className={aedPanelClass('neutral', 'flex items-start gap-3 p-3')}>
                  <span className="mt-0.5 w-20 shrink-0 font-mono text-xs font-bold text-amber-700 dark:text-amber-400">{o.obligation_code}</span>
                  <div className="flex-1 min-w-0">
                    <p className={aedBodyTextClass}>{o.description}</p>
                    <p className={`text-[11px] ${aedMetaTextClass}`}>{o.owner_role} · {o.frequency}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${
                      o.status === 'complete' ? aedBadgeClass('emerald') :
                      o.status === 'overdue'  ? aedBadgeClass('red') :
                      aedBadgeClass('neutral')
                    }`}>{o.status}</span>
                    {o.due_date && <div className={`mt-1 text-[11px] ${aedMetaTextClass}`}>{o.due_date.slice(0, 10)}</div>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  )
}
