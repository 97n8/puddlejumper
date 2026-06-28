import { useState, useEffect, useCallback } from 'react'
import { aedApi, type AEDDashboard, type Obligation, type MaterialEvent, type QALICB, type VaultScore } from '../api/aedApi'
import { ArrowRight, ArrowClockwise, Warning, Clock, CheckCircle, Buildings, Key } from '@phosphor-icons/react'
import {
  aedAccentLinkClass,
  aedBodyTextClass,
  aedEmptyStateClass,
  aedInteractivePanelClass,
  aedMetaTextClass,
  aedPageClass,
  aedPanelClass,
  aedSectionTitleClass,
  aedSubtitleClass,
  aedTitleClass,
  aedSuccessButtonClass,
} from '../aedTheme'

interface AEDWorkbenchProps {
  actorRole: string
  onNavigate: (moduleId: string) => void
}

function scoreColor(score: number) {
  if (score >= 80) return { bar: 'bg-emerald-500', text: 'text-emerald-700 dark:text-emerald-300' }
  if (score >= 60) return { bar: 'bg-yellow-500', text: 'text-yellow-700 dark:text-yellow-300' }
  return { bar: 'bg-red-500', text: 'text-red-700 dark:text-red-300' }
}

function year7Countdown(year7Date: string) {
  const days = Math.max(0, Math.round((new Date(year7Date).getTime() - Date.now()) / 86_400_000))
  if (days === 0) return { label: 'Year 7 reached', color: 'text-emerald-400' }
  if (days <= 180) return { label: `${days}d to Year 7`, color: 'text-red-400' }
  if (days <= 365) return { label: `${days}d to Year 7`, color: 'text-orange-400' }
  return { label: `${days}d to Year 7`, color: 'text-white/50' }
}

export function AEDWorkbench({ actorRole, onNavigate }: AEDWorkbenchProps) {
  const [dash, setDash] = useState<AEDDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(() => {
    setLoading(true)
    aedApi.dashboard()
      .then(setDash)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { load() }, [load])

  if (loading) return (
    <div className="flex-1 flex items-center justify-center">
      <span className="text-sm text-muted-foreground animate-pulse">Loading workbench…</span>
    </div>
  )

  if (error) return (
    <div className="flex-1 flex items-center justify-center flex-col gap-3">
      <span className="text-sm text-red-400">{error}</span>
      <button onClick={load} className={aedSuccessButtonClass}>
        <ArrowClockwise size={12} /> Retry
      </button>
    </div>
  )

  if (!dash) return null

  const s = dash.summary ?? { active_deals: 0, total_obligations: 0, complete_obligations: 0, overdue_obligations: 0, open_material_events: 0, qalicbs_needing_cert: 0 }
  const vaultScores = dash.vault_scores ?? []
  const criticalObligations = dash.critical_obligations ?? []
  const openMaterialEvents = dash.open_material_events ?? []
  const qalicbsCertDue = dash.qalicbs_needing_cert ?? []

  const pctComplete = s.total_obligations > 0
    ? Math.round((s.complete_obligations / s.total_obligations) * 100)
    : 100

  return (
    <div className={`${aedPageClass} space-y-6`}>

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className={aedTitleClass}>AED Overview</h1>
          <p className={aedSubtitleClass}>
            Tax credit deals · Seven-year compliance · Real-time tracking
          </p>
        </div>
        <button onClick={load} className="shrink-0 text-zinc-500 transition-colors hover:text-zinc-800 dark:text-white/30 dark:hover:text-white/60" title="Refresh">
          <ArrowClockwise size={16} />
        </button>
      </div>

      {/* Overall health bar */}
      <div className={aedPanelClass('amber', 'p-5')}>
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-bold text-zinc-800 dark:text-white/80">Overall Health</span>
          <span className={`text-2xl font-black ${scoreColor(pctComplete).text}`}>{pctComplete}%</span>
        </div>
        <div className="mb-3 h-2 rounded-full bg-stone-200 dark:bg-zinc-800">
          <div className={`h-full rounded-full transition-all ${scoreColor(pctComplete).bar}`} style={{ width: `${pctComplete}%` }} />
        </div>
        <div className="flex gap-4 text-[11px]">
          <span className="text-emerald-700 dark:text-emerald-400">✓ {s.complete_obligations} done</span>
          {s.overdue_obligations > 0 && <span className="text-red-700 dark:text-red-400">⚠ {s.overdue_obligations} past due</span>}
          <span className={aedMetaTextClass}>{s.total_obligations} total requirements</span>
          <span className={aedMetaTextClass}>{s.active_deals} active deals</span>
        </div>
      </div>

      {/* Alert cards — action gateways */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">

        {/* Critical Obligations */}
        <button
          onClick={() => onNavigate('obligations')}
          className={s.overdue_obligations > 0
            ? aedInteractivePanelClass('red', 'group p-4 text-left hover:scale-[1.01]')
            : aedInteractivePanelClass('amber', 'group p-4 text-left hover:scale-[1.01]')}
        >
          <div className="flex items-start justify-between">
            <Warning size={20} weight="duotone" className={s.overdue_obligations > 0 ? 'text-red-600 dark:text-red-400' : 'text-amber-600 dark:text-amber-400'} />
            <ArrowRight size={14} className="text-zinc-400 transition-colors group-hover:text-zinc-700 dark:text-white/30 dark:group-hover:text-white/60" />
          </div>
          <div className={`mt-2 text-3xl font-black ${s.overdue_obligations > 0 ? 'text-red-700 dark:text-red-300' : 'text-amber-700 dark:text-amber-300'}`}>
            {s.overdue_obligations > 0 ? s.overdue_obligations : criticalObligations.length}
          </div>
          <div className="mt-1 text-xs font-semibold text-zinc-800 dark:text-white/70">
            {s.overdue_obligations > 0 ? 'Past Due' : 'Needs Attention'}
          </div>
          <div className={`mt-0.5 text-[10px] ${aedMetaTextClass}`}>
            {s.overdue_obligations > 0 ? 'Action required now' : 'Tap to review & complete'}
          </div>
        </button>

        {/* Material Events */}
        <button
          onClick={() => onNavigate('material-events')}
          className={s.open_material_events > 0
            ? aedInteractivePanelClass('orange', 'group p-4 text-left hover:scale-[1.01]')
            : aedInteractivePanelClass('neutral', 'group p-4 text-left hover:scale-[1.01]')}
        >
          <div className="flex items-start justify-between">
            <Clock size={20} weight="duotone" className={s.open_material_events > 0 ? 'text-orange-500 dark:text-orange-400' : 'text-zinc-500 dark:text-zinc-400'} />
            <ArrowRight size={14} className="text-zinc-400 transition-colors group-hover:text-zinc-700 dark:text-white/30 dark:group-hover:text-white/60" />
          </div>
          <div className={`mt-2 text-3xl font-black ${s.open_material_events > 0 ? 'text-orange-700 dark:text-orange-300' : 'text-zinc-600 dark:text-zinc-400'}`}>
            {s.open_material_events}
          </div>
          <div className="mt-1 text-xs font-semibold text-zinc-800 dark:text-white/70">Open Events</div>
          <div className={`mt-0.5 text-[10px] ${aedMetaTextClass}`}>Must notify within 30 days · Tap to update</div>
        </button>

        {/* QALICB Certs */}
        <button
          onClick={() => onNavigate('qalicbs')}
          className={s.qalicbs_needing_cert > 0
            ? aedInteractivePanelClass('yellow', 'group p-4 text-left hover:scale-[1.01]')
            : aedInteractivePanelClass('neutral', 'group p-4 text-left hover:scale-[1.01]')}
        >
          <div className="flex items-start justify-between">
            <Buildings size={20} weight="duotone" className={s.qalicbs_needing_cert > 0 ? 'text-yellow-500 dark:text-yellow-400' : 'text-zinc-500 dark:text-zinc-400'} />
            <ArrowRight size={14} className="text-zinc-400 transition-colors group-hover:text-zinc-700 dark:text-white/30 dark:group-hover:text-white/60" />
          </div>
          <div className={`mt-2 text-3xl font-black ${s.qalicbs_needing_cert > 0 ? 'text-yellow-700 dark:text-yellow-300' : 'text-zinc-600 dark:text-zinc-400'}`}>
            {s.qalicbs_needing_cert}
          </div>
          <div className="mt-1 text-xs font-semibold text-zinc-800 dark:text-white/70">Business Certs Due Soon</div>
          <div className={`mt-0.5 text-[10px] ${aedMetaTextClass}`}>Annual recertification · Tap to certify</div>
        </button>

      </div>

      {/* Deal vault scores with 7-year clocks */}
      {vaultScores.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className={aedSectionTitleClass}>Active Deals</h2>
            <button onClick={() => onNavigate('deals')} className={aedAccentLinkClass}>
              View all deals →
            </button>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {vaultScores.map((vs: VaultScore & { year_7_date?: string }) => {
              const c = scoreColor(vs.score)
              return (
                <button
                  key={vs.deal_id}
                  onClick={() => onNavigate('deals')}
                  className={aedInteractivePanelClass('amber', 'group p-4 text-left hover:scale-[1.01]')}
                >
                  <div className="flex items-start justify-between mb-2">
                    <span className="flex-1 truncate text-sm font-bold text-zinc-900 dark:text-white/90">{vs.deal_name}</span>
                    <span className={`text-xl font-black ml-2 shrink-0 ${c.text}`}>{vs.score}</span>
                  </div>
                  <div className="mb-2 h-1.5 rounded-full bg-stone-200 dark:bg-zinc-800">
                    <div className={`h-full rounded-full ${c.bar}`} style={{ width: `${Math.min(100, vs.score)}%` }} />
                  </div>
                  <div className={`flex items-center justify-between text-[11px] ${aedMetaTextClass}`}>
                    <span>{vs.complete}/{vs.total} obligations complete</span>
                    {vs.overdue > 0 && <span className="text-red-700 dark:text-red-400">{vs.overdue} overdue</span>}
                  </div>
                </button>
              )
            })}
          </div>
        </section>
      )}

      {/* Critical obligations preview */}
      {criticalObligations.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className={aedSectionTitleClass}>Needs Attention</h2>
            <button onClick={() => onNavigate('obligations')} className={aedAccentLinkClass}>
              View all →
            </button>
          </div>
          <div className="space-y-2">
            {criticalObligations.slice(0, 4).map((o: Obligation) => (
              <button
                key={o.id}
                onClick={() => onNavigate('obligations')}
                className={aedInteractivePanelClass('red', 'w-full p-3 text-left flex items-start gap-3')}
              >
                <span className="mt-0.5 w-20 shrink-0 font-mono text-[11px] font-bold text-red-700 dark:text-red-400">{o.obligation_code}</span>
                <div className="flex-1 min-w-0">
                  <p className="truncate text-xs text-zinc-800 dark:text-white/80">{o.description}</p>
                  <p className={aedMetaTextClass}>{o.owner_role}</p>
                </div>
                {o.due_date && <span className={`shrink-0 text-[10px] ${aedMetaTextClass}`}>{o.due_date.slice(0, 10)}</span>}
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Open material events preview */}
      {openMaterialEvents.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className={aedSectionTitleClass}>Open Events</h2>
            <button onClick={() => onNavigate('material-events')} className={aedAccentLinkClass}>
              Notify all →
            </button>
          </div>
          <div className="space-y-2">
            {openMaterialEvents.slice(0, 3).map((ev: MaterialEvent) => {
              const overdue = new Date(ev.notification_due) < new Date()
              return (
                <button
                  key={ev.id}
                  onClick={() => onNavigate('material-events')}
                  className={aedInteractivePanelClass('orange', 'w-full p-3 text-left flex items-center gap-3')}
                >
                  <span className={`shrink-0 text-[10px] font-bold ${overdue ? 'text-red-700 dark:text-red-400' : 'text-orange-700 dark:text-orange-400'}`}>
                    {overdue ? 'OVERDUE' : ev.severity.toUpperCase()}
                  </span>
                  <span className="flex-1 truncate text-xs text-zinc-800 dark:text-white/80">{ev.event_type} — {ev.description}</span>
                  <span className={`shrink-0 text-[10px] ${aedMetaTextClass}`}>Due {ev.notification_due.slice(0, 10)}</span>
                </button>
              )
            })}
          </div>
        </section>
      )}

      {/* QALICB certs due preview */}
      {qalicbsCertDue.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className={aedSectionTitleClass}>Business Certifications Due</h2>
            <button onClick={() => onNavigate('qalicbs')} className={aedAccentLinkClass}>
              Certify →
            </button>
          </div>
          <div className="space-y-2">
            {qalicbsCertDue.slice(0, 3).map((q: QALICB) => (
              <button
                key={q.id}
                onClick={() => onNavigate('qalicbs')}
                className={aedInteractivePanelClass('yellow', 'w-full p-3 text-left flex items-center gap-3')}
              >
                <Buildings size={14} weight="duotone" className="shrink-0 text-yellow-600 dark:text-yellow-400" />
                <div className="flex-1 min-w-0">
                  <span className="text-xs font-semibold text-zinc-900 dark:text-white/85">{q.business_name}</span>
                  <span className={`ml-2 text-[10px] ${aedMetaTextClass}`}>{q.county}, {q.state}</span>
                </div>
                <span className="shrink-0 text-[10px] text-yellow-700 dark:text-yellow-400">Due {q.next_cert_due?.slice(0, 10)}</span>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Governance shortcut */}
      <button
        onClick={() => onNavigate('governance')}
        className={aedInteractivePanelClass('neutral', 'group w-full p-4 text-left flex items-center gap-4')}
      >
        <Key size={20} weight="duotone" className="shrink-0 text-amber-700/70 dark:text-amber-400/60" />
        <div>
          <div className="text-sm font-semibold text-zinc-900 dark:text-white/70">Team & Permissions</div>
          <div className={aedMetaTextClass}>Who has access and what they can do</div>
        </div>
        <ArrowRight size={14} className="ml-auto shrink-0 text-zinc-400 transition-colors group-hover:text-zinc-700 dark:text-white/20 dark:group-hover:text-white/50" />
      </button>

      {/* Empty state */}
      {s.active_deals === 0 && s.total_obligations === 0 && (
        <div className={aedEmptyStateClass}>
          <div className="text-4xl mb-3">🏛</div>
          <p className="mb-1 text-sm font-medium text-zinc-700 dark:text-white/60">No active deals yet</p>
          <p className="text-xs mb-3">Add your first deal to start tracking compliance milestones.</p>
          {actorRole === 'aed_administrator' && (
            <button onClick={() => onNavigate('deals')} className={aedSuccessButtonClass}>
              Add first deal →
            </button>
          )}
        </div>
      )}

    </div>
  )
}
