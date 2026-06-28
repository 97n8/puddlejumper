import { useState, useEffect, useCallback } from 'react'
import { aedApi, type MaterialEvent } from '../api/aedApi'
import { ArrowLeft, Bell, ArrowClockwise } from '@phosphor-icons/react'
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

interface MaterialEventsPageProps {
  onNavigate: (moduleId: string) => void
}

function severityBadge(s: string) {
  switch (s) {
    case 'critical': return aedBadgeClass('red')
    case 'high':     return aedBadgeClass('orange')
    case 'medium':   return aedBadgeClass('yellow')
    default:         return aedBadgeClass('neutral')
  }
}

export function MaterialEventsPage({ onNavigate }: MaterialEventsPageProps) {
  const [events, setEvents]      = useState<MaterialEvent[]>([])
  const [loading, setLoading]    = useState(true)
  const [error, setError]        = useState<string | null>(null)
  const [notifying, setNotifying] = useState<string | null>(null)

  const load = useCallback(() => {
    setLoading(true)
    aedApi.materialEvents.list()
      .then(r => setEvents(r.events))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { load() }, [load])

  const handleNotify = async (id: string) => {
    setNotifying(id)
    try {
      const updated = await aedApi.materialEvents.notify(id)
      setEvents(prev => prev.map(e => e.id === id ? updated : e))
    } catch (e: any) {
      alert(e.message ?? 'Failed to mark notified')
    } finally {
      setNotifying(null)
    }
  }

  if (loading) return <div className="flex-1 flex items-center justify-center"><span className="text-sm text-muted-foreground animate-pulse">Loading events…</span></div>
  if (error)   return <div className="flex-1 flex items-center justify-center flex-col gap-2"><span className="text-sm text-red-400">{error}</span><button onClick={load} className={aedPrimaryButtonClass}><ArrowClockwise size={12} />Retry</button></div>

  const open = events.filter(e => !e.notified_at)
  const closed = events.filter(e => e.notified_at)

  return (
    <div className={`${aedPageClass} space-y-4`}>

      {/* Header */}
      <div>
        <button onClick={() => onNavigate('workbench')} className={aedBackLinkClass}>
          <ArrowLeft size={11} /> Back to Workbench
        </button>
        <h1 className={aedTitleClass}>Events & Alerts</h1>
        <p className={aedSubtitleClass}>
          Anything that could affect the deal — a business change, investor transfer, or governance update.
          Once discovered, the relevant parties must be notified within <strong className="text-zinc-800 dark:text-white/70">30 days</strong>.
        </p>
      </div>

      {/* Status banner */}
      {open.length > 0 ? (
        <div className={`${aedPanelClass('orange')} flex items-center gap-3 p-4`}>
          <Bell size={18} weight="duotone" className="shrink-0 text-orange-600 dark:text-orange-400" />
          <div>
            <p className="text-sm font-semibold text-orange-800 dark:text-orange-200">{open.length} open event{open.length > 1 ? 's' : ''} need notification</p>
            <p className="text-[11px] text-orange-700/80 dark:text-orange-300/70">Mark each one notified once you've sent notice to the relevant parties.</p>
          </div>
        </div>
      ) : (
        <div className={`${aedPanelClass('emerald')} flex items-center gap-3 p-4`}>
          <span className="text-lg text-emerald-600 dark:text-emerald-400">✓</span>
          <p className="text-sm text-emerald-800 dark:text-emerald-300">All material events have been notified.</p>
        </div>
      )}

      {/* Open events */}
      {open.length > 0 && (
        <section>
          <h2 className={`${aedSectionTitleClass} mb-2`}>Open — Awaiting Notification</h2>
          <div className="space-y-3">
            {open.map(ev => {
              const dueDate = new Date(ev.notification_due)
              const overdue = dueDate < new Date()
              const daysLeft = Math.round((dueDate.getTime() - Date.now()) / 86_400_000)
              return (
                <div key={ev.id} className={overdue ? aedPanelClass('red', 'p-4') : aedPanelClass('orange', 'p-4')}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${severityBadge(ev.severity)}`}>{ev.severity}</span>
                        <span className="text-sm font-bold text-zinc-900 dark:text-white/90">{ev.event_type}</span>
                      </div>
                      <p className="mb-2 text-xs text-zinc-700 dark:text-white/70">{ev.description}</p>
                      <div className={`flex flex-wrap gap-3 text-[11px] ${aedMetaTextClass}`}>
                        <span>Discovered: {ev.discovered_at.slice(0, 10)}</span>
                        <span className={overdue ? 'font-semibold text-red-700 dark:text-red-400' : 'font-semibold text-orange-700 dark:text-orange-300'}>
                          {overdue ? `OVERDUE by ${Math.abs(daysLeft)}d` : `Notify by ${ev.notification_due.slice(0, 10)} (${daysLeft}d)`}
                        </span>
                        <span className="font-mono text-[10px] text-zinc-400 dark:text-white/20">{ev.seal_hash.slice(0, 12)}…</span>
                      </div>
                    </div>
                    <button
                      onClick={() => handleNotify(ev.id)}
                      disabled={notifying === ev.id}
                      className={`${aedSuccessButtonClass} shrink-0 disabled:opacity-50`}
                    >
                      <Bell size={13} weight="bold" />
                      {notifying === ev.id ? 'Saving…' : 'Mark Notified'}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {/* Closed events */}
      {closed.length > 0 && (
        <section>
          <h2 className={`${aedSectionTitleClass} mb-2`}>Notified</h2>
          <div className="space-y-2">
            {closed.map(ev => (
              <div key={ev.id} className={`${aedPanelClass('neutral')} p-3 opacity-80`}>
                <div className="flex items-center gap-3">
                  <span className="text-sm text-emerald-600 dark:text-emerald-400">✓</span>
                  <div className="flex-1 min-w-0">
                    <span className="text-xs font-medium text-zinc-700 dark:text-white/70">{ev.event_type}</span>
                    <span className={`ml-2 text-[10px] ${aedMetaTextClass}`}>{ev.description}</span>
                  </div>
                  <span className={`shrink-0 text-[11px] ${aedMetaTextClass}`}>Notified {ev.notified_at?.slice(0, 10)} by {ev.notified_by}</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {events.length === 0 && (
        <div className={aedEmptyStateClass}>
          <div className="text-4xl mb-3">⚠</div>
          <p className="mb-1 text-sm font-medium text-zinc-700 dark:text-white/50">No material events recorded</p>
          <p className="text-xs">If a compliance-relevant event occurs, log it here immediately to start the 30-day notification clock.</p>
        </div>
      )}
    </div>
  )
}
