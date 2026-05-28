import { useState, useEffect, useCallback } from 'react'
import { aedApi, type Obligation } from '../api/aedApi'
import { ArrowLeft, CheckCircle, ArrowClockwise } from '@phosphor-icons/react'
import {
  aedBackLinkClass,
  aedBadgeClass,
  aedEmptyStateClass,
  aedMetaTextClass,
  aedPageClass,
  aedPanelClass,
  aedPrimaryButtonClass,
  aedSectionTitleClass,
  aedSubtitleClass,
  aedSuccessButtonClass,
  aedTitleClass,
} from '../aedTheme'

interface ObligationsPageProps {
  onNavigate: (moduleId: string) => void
  initialFilter?: string
}

const DOMAIN_LABELS: Record<string, string> = {
  cde: 'CDE / CDFI Fund',
  irs: 'IRS',
  qalicb: 'QALICB',
  investor: 'Investor',
  organizational: 'Organizational',
  federal_grants: 'Federal Grants',
  legislative: 'Legislative',
}

function riskBadge(risk: string) {
  switch (risk) {
    case 'critical': return aedBadgeClass('red')
    case 'high':     return aedBadgeClass('orange')
    case 'medium':   return aedBadgeClass('yellow')
    default:         return aedBadgeClass('neutral')
  }
}

export function ObligationsPage({ onNavigate, initialFilter }: ObligationsPageProps) {
  const [obligations, setObligations] = useState<Obligation[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<string>(initialFilter ?? 'all')
  const [completing, setCompleting] = useState<string | null>(null)

  const load = useCallback(() => {
    setLoading(true)
    aedApi.obligations.list()
      .then(r => setObligations(r.obligations))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { load() }, [load])

  const handleComplete = async (id: string) => {
    setCompleting(id)
    try {
      await aedApi.obligations.complete(id)
      setObligations(prev => prev.map(o => o.id === id ? { ...o, status: 'complete' as const, completed_at: new Date().toISOString() } : o))
    } catch (e: any) {
      alert(e.message ?? 'Failed to complete obligation')
    } finally {
      setCompleting(null)
    }
  }

  if (loading) return <div className="flex-1 flex items-center justify-center"><span className="text-sm text-muted-foreground animate-pulse">Loading obligations…</span></div>
  if (error)   return <div className="flex-1 flex items-center justify-center flex-col gap-2"><span className="text-sm text-red-400">{error}</span><button onClick={load} className={aedPrimaryButtonClass}><ArrowClockwise size={12} />Retry</button></div>

  const filtered = filter === 'all' ? obligations : obligations.filter(o =>
    filter === 'overdue' ? o.status === 'overdue' :
    filter === 'pending' ? o.status === 'pending' :
    filter === 'complete' ? o.status === 'complete' : true
  )

  const counts = {
    all: obligations.length,
    pending: obligations.filter(o => o.status === 'pending').length,
    overdue: obligations.filter(o => o.status === 'overdue').length,
    complete: obligations.filter(o => o.status === 'complete').length,
  }

  return (
    <div className={`${aedPageClass} space-y-4`}>

      {/* Header */}
      <div>
        <button onClick={() => onNavigate('workbench')} className={aedBackLinkClass}>
          <ArrowLeft size={11} /> Back to Workbench
        </button>
        <h1 className={aedTitleClass}>Requirements</h1>
        <p className={aedSubtitleClass}>
          Everything the deal needs to stay compliant — reporting, certifications, filings, and governance steps.
          Mark each one complete to keep your health score up.
        </p>
      </div>

      {/* Progress bar */}
      {obligations.length > 0 && (
        <div className={aedPanelClass('amber', 'p-4')}>
          <div className="flex items-center justify-between mb-2 text-sm">
            <span className="text-zinc-700 dark:text-white/60">Completion Progress</span>
            <span className="font-bold text-amber-700 dark:text-amber-300">{counts.complete}/{counts.all}</span>
          </div>
          <div className="h-1.5 rounded-full bg-stone-200 dark:bg-zinc-800">
            <div className="h-full rounded-full bg-amber-500 transition-all" style={{ width: `${counts.all > 0 ? Math.round(counts.complete / counts.all * 100) : 0}%` }} />
          </div>
          {counts.overdue > 0 && (
            <p className="mt-2 text-[11px] text-red-700 dark:text-red-400">⚠ {counts.overdue} past due — action required</p>
          )}
        </div>
      )}

      {/* Filter tabs */}
      <div className="flex gap-2 flex-wrap">
        {(['all', 'overdue', 'pending', 'complete'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              filter === f
                ? f === 'overdue' ? 'border border-red-300 bg-red-100 text-red-900 dark:border-red-600/40 dark:bg-red-800/40 dark:text-red-200'
                : 'border border-amber-300 bg-amber-100 text-amber-900 dark:border-amber-600/40 dark:bg-amber-800/40 dark:text-amber-200'
                : 'text-zinc-500 hover:text-zinc-800 dark:text-white/50 dark:hover:text-white/70'
            }`}>
            {f.charAt(0).toUpperCase() + f.slice(1)} ({counts[f]})
          </button>
        ))}
      </div>

      {/* Obligation list */}
      {filtered.length === 0 ? (
        <div className={`${aedEmptyStateClass} py-8`}>
          <CheckCircle size={32} className="mx-auto mb-2 text-emerald-500/70 dark:text-emerald-400/50" />
          <p className="text-sm">No {filter === 'all' ? '' : filter} items here.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(o => (
            <div
              key={o.id}
              className={
                o.status === 'overdue'
                  ? aedPanelClass('red', 'p-4')
                  : o.status === 'complete'
                    ? aedPanelClass('emerald', 'p-4 opacity-80')
                    : aedPanelClass('neutral', 'p-4')
              }
            >
              <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="shrink-0 font-mono text-[11px] font-bold text-amber-700 dark:text-amber-400">{o.obligation_code}</span>
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${riskBadge(o.risk_level)}`}>{o.risk_level}</span>
                    <span className={`text-[10px] ${aedMetaTextClass}`}>{DOMAIN_LABELS[o.domain] ?? o.domain}</span>
                  </div>
                  <p className="text-sm text-zinc-800 dark:text-white/85">{o.description}</p>
                  <div className={`mt-1 flex flex-wrap gap-3 text-[11px] ${aedMetaTextClass}`}>
                    <span>Owner: {o.owner_role}</span>
                    <span>{o.frequency}</span>
                    {o.statute_ref && <span className="font-mono">{o.statute_ref}</span>}
                    {o.due_date && <span>Due: {o.due_date.slice(0, 10)}</span>}
                    {o.completed_at && <span className="text-emerald-700 dark:text-emerald-400">Completed: {o.completed_at.slice(0, 10)}</span>}
                  </div>
                </div>

                {/* Action */}
                {o.status !== 'complete' && o.status !== 'waived' && (
                  <button
                    onClick={() => handleComplete(o.id)}
                    disabled={completing === o.id}
                    className={`${aedSuccessButtonClass} shrink-0 disabled:opacity-50`}
                  >
                    <CheckCircle size={13} weight="bold" />
                    {completing === o.id ? 'Saving…' : 'Complete'}
                  </button>
                )}
                {o.status === 'complete' && (
                  <span className="shrink-0 flex items-center gap-1 text-[11px] text-emerald-700 dark:text-emerald-400">
                    <CheckCircle size={13} weight="fill" /> Done
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
