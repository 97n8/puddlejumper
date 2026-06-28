import { useState, useEffect, useCallback } from 'react'
import { civicApi } from '../api/civicApi'
import type { DashboardSummary, CivicActor, CivicException } from '../api/civicApi'
import { ExceptionBanner } from '../components/ExceptionBanner'
import { useCivicTown } from '@/environments/civic/context/CivicTownContext'

interface Props {
  actor: CivicActor
  enabledCards?: Set<string> | null
  onNavigate: (page: string) => void
}

function relativeDay(dateStr: string): string {
  const target = new Date(dateStr)
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1)
  const diff = Math.floor((target.getTime() - today.getTime()) / 86400000)
  if (diff < 0) return 'OVERDUE'
  if (diff === 0) return 'TODAY'
  if (diff === 1) return 'TOMORROW'
  return target.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function deadlineColor(dateStr: string): string {
  const target = new Date(dateStr)
  const now = Date.now()
  const diff = target.getTime() - now
  if (diff < 0) return 'text-red-400'
  if (diff < 86400000) return 'text-red-400'
  if (diff < 3 * 86400000) return 'text-amber-400'
  if (diff < 7 * 86400000) return 'text-green-400'
  return 'text-muted-foreground'
}

function typeBadge(type: string): string {
  const map: Record<string, string> = {
    oml: 'bg-blue-700 text-blue-100',
    records: 'bg-amber-700 text-amber-100',
    contractual: 'bg-purple-700 text-purple-100',
  }
  return `text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded ${map[type] ?? 'bg-muted text-muted-foreground'}`
}


const MODULE_CARDS = [
  {
    id: 'records',
    label: 'Public Records',
    statute: 'c.66 §10',
    accent: '#D4A853',
    getCount: (s: DashboardSummary) => s.open_records_requests.length,
    getSub: (s: DashboardSummary) => `${s.open_records_requests.length} open · 10-day limit`,
    nav: 'records',
  },
  {
    id: 'meetings',
    label: 'Meetings & OML',
    statute: 'c.30A §20',
    accent: '#6B9EBB',
    getCount: (s: DashboardSummary) => s.due_this_week.filter(d => d.type === 'oml').length,
    getSub: () => '48-hr notice required',
    nav: 'documents',
    comingSoon: true,
  },
  {
    id: 'procurement',
    label: 'Procurement',
    statute: 'c.30B',
    accent: '#8BBF7A',
    getCount: (s: DashboardSummary) => s.active_procurements.length,
    getSub: (s: DashboardSummary) => `${s.active_procurements.length} active`,
    nav: 'procurement',
    comingSoon: true,
  },
  {
    id: 'contracts',
    label: 'Contracts',
    statute: 'c.30B',
    accent: '#CC7070',
    getCount: (s: DashboardSummary) => s.contracts_expiring.length,
    getSub: (s: DashboardSummary) => s.contracts_expiring.length > 0 ? `${s.contracts_expiring.length} expiring within 90d` : 'All current',
    nav: 'contracts',
    comingSoon: true,
  },
  {
    id: 'str',
    label: 'Short-Term Rentals',
    statute: 'c.64G',
    accent: '#6B9E8B',
    getCount: () => 0,
    getSub: () => 'Host licensing & lodging excise',
    nav: 'str',
  },
]

export function WorkbenchPage({ actor, enabledCards, onNavigate }: Props) {
  const { townName, governanceForm } = useCivicTown()
  const [summary, setSummary] = useState<DashboardSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [exceptions, setExceptions] = useState<CivicException[]>([])

  const load = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await civicApi.dashboard()
      setSummary(data)
      setExceptions(data.exceptions.filter(e => e.status === 'active'))
    } catch {
      setError('Couldn\'t load dashboard. Check your connection.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const handleExceptionAcknowledged = (id: string) => {
    setExceptions(prev => prev.map(e => e.id === id ? { ...e, status: 'acknowledged' } : e))
  }

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-red-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-muted-foreground text-sm">Loading workbench…</p>
        </div>
      </div>
    )
  }

  if (error || !summary) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center max-w-sm">
          <p className="text-red-400 text-sm mb-3">{error ?? 'Unknown error'}</p>
          <button onClick={load} className="text-xs text-muted-foreground hover:text-foreground underline">Retry</button>
        </div>
      </div>
    )
  }

  const activeExceptions = exceptions.filter(e => e.status === 'active')

  return (
    <div className="flex-1 min-h-0 overflow-y-auto p-6">
      {/* Greeting */}
      <div className="mb-5">
        <h2 className="text-foreground text-xl font-black">
          Good {new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 17 ? 'afternoon' : 'evening'},{' '}
          {actor.display_name.split(' ')[0]}.
        </h2>
        <p className="text-muted-foreground text-sm mt-0.5">
          Civic{townName ? ` · ${townName}` : ''}{governanceForm ? ` · ${governanceForm.replace(/_/g, ' ')}` : ''}
        </p>
      </div>

      {/* Exception Banner */}
      <ExceptionBanner exceptions={activeExceptions} onAcknowledged={handleExceptionAcknowledged} />

      {/* Module Cards — only show cards for modules selected during setup */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {MODULE_CARDS.filter(m => !enabledCards || enabledCards.has(m.id)).map(m => {
          const count = summary ? m.getCount(summary) : 0
          const sub = summary ? m.getSub(summary) : ''
          const urgent = m.id === 'records' && summary
            ? summary.due_this_week.filter(d => d.type === 'records').length
            : 0
          return (
            <button
              key={m.id}
              onClick={m.comingSoon ? undefined : () => onNavigate(m.nav)}
              disabled={m.comingSoon}
              className={`bg-card border border-border rounded-xl px-4 py-4 text-left transition-all overflow-hidden relative
                ${m.comingSoon
                  ? 'opacity-50 cursor-not-allowed'
                  : 'hover:-translate-y-0.5 hover:shadow-md cursor-pointer group'
                }`}
              style={{ borderLeftColor: m.accent, borderLeftWidth: 3 }}
            >
              <div className="text-[9px] font-bold uppercase tracking-wider mb-0.5" style={{ color: m.accent }}>
                {m.statute}
              </div>
              <div className="text-xs font-semibold text-foreground mb-2 flex items-center gap-1.5">
                {m.label}
                {m.comingSoon && <span className="text-[9px] font-bold uppercase tracking-wider bg-muted text-muted-foreground px-1 py-0.5 rounded">Soon</span>}
              </div>
              <div className="flex items-end justify-between">
                <span className="text-3xl font-black text-foreground">{count}</span>
                {urgent > 0 && (
                  <span className="text-xs font-bold text-amber-400">{urgent} urgent</span>
                )}
              </div>
              <p className="text-[10px] text-muted-foreground mt-1">{sub}</p>
              {!m.comingSoon && (
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/30 group-hover:text-muted-foreground/60 text-xs transition-colors">→</span>
              )}
            </button>
          )
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Deadline Strip */}
        <div className="lg:col-span-2 bg-muted/50 border border-border rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-foreground text-sm font-bold">Upcoming Deadlines</h3>
            <button onClick={() => onNavigate('records')} className="text-muted-foreground text-xs hover:text-foreground">View all →</button>
          </div>
          {summary.due_this_week.length === 0 ? (
            <p className="text-muted-foreground/60 text-sm">No deadlines due this week.</p>
          ) : (
            <div className="space-y-2">
              {summary.due_this_week.map(d => (
                <div key={d.id} className="flex items-center gap-3">
                  <span className={`text-xs font-mono font-bold w-20 shrink-0 ${deadlineColor(d.due_at)}`}>
                    {relativeDay(d.due_at)}
                  </span>
                  <span className="text-foreground/80 text-xs flex-1 truncate">{d.label}</span>
                  <span className={typeBadge(d.type)}>{d.type}</span>
                </div>
              ))}
            </div>
          )}
          {/* Quick actions — only show items that have live routes */}
          <div className="flex gap-2 mt-4 pt-3 border-t border-border">
            <button
              onClick={() => onNavigate('records')}
              className="flex-1 py-1.5 text-xs font-medium bg-muted hover:bg-muted/80 text-foreground rounded-lg transition"
            >
              + Log Records Req.
            </button>
            <button
              disabled
              title="Coming in V2"
              className="flex-1 py-1.5 text-xs font-medium bg-muted/40 text-muted-foreground/40 rounded-lg cursor-not-allowed"
            >
              + New Meeting
            </button>
            <button
              disabled
              title="Coming in V2"
              className="flex-1 py-1.5 text-xs font-medium bg-muted/40 text-muted-foreground/40 rounded-lg cursor-not-allowed"
            >
              + Procurement
            </button>
          </div>
        </div>

        {/* Right column: Exceptions + PJ Feed */}
        <div className="space-y-4">
          {/* Active Exceptions Panel */}
          <div className="bg-muted/50 border border-border rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-foreground text-sm font-bold">Exceptions</h3>
              <button onClick={() => onNavigate('workbench')} className="text-muted-foreground text-xs hover:text-foreground">All →</button>
            </div>
            {activeExceptions.length === 0 ? (
              <p className="text-muted-foreground/60 text-xs">No active exceptions. ✓</p>
            ) : (
              <div className="space-y-2">
                {activeExceptions.slice(0, 4).map(exc => {
                  const badge = { critical: 'text-red-400', high: 'text-amber-400', medium: 'text-muted-foreground', low: 'text-muted-foreground' }[exc.severity] ?? 'text-muted-foreground'
                  return (
                    <div key={exc.id} className="flex items-start gap-2">
                      <span className={`text-[10px] font-bold uppercase shrink-0 mt-0.5 ${badge}`}>{exc.severity}</span>
                      <span className="text-foreground/80 text-xs leading-tight">{exc.title}</span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Statute Quick Reference */}
          <div className="bg-muted/50 border border-border rounded-xl p-4">
            <h3 className="text-foreground text-sm font-bold mb-3">Key Statutes</h3>
            <div className="space-y-2">
              {[
                { label: 'Public Records', ref: 'M.G.L. c.66 §10', note: '10 business days', url: 'https://www.sec.state.ma.us/pre/preidx.htm', color: '#D4A853' },
                { label: 'Open Meeting Law', ref: 'M.G.L. c.30A §20', note: '48-hr notice', url: 'https://www.mass.gov/guides/open-meeting-law-guide-for-public-bodies', color: '#6B9EBB' },
                { label: 'Procurement', ref: 'M.G.L. c.30B', note: 'Competitive bidding', url: 'https://malegislature.gov/Laws/GeneralLaws/PartI/TitleVII/Chapter30B', color: '#8BBF7A' },
              ].map(s => (
                <a
                  key={s.ref}
                  href={s.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2.5 hover:bg-muted/50 rounded-lg px-1.5 py-1 -mx-1.5 transition group"
                >
                  <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: s.color }} />
                  <div className="min-w-0 flex-1">
                    <div className="text-[10px] font-semibold text-foreground/80 leading-tight">{s.label}</div>
                    <div className="text-[9px] text-muted-foreground font-mono">{s.ref} · {s.note}</div>
                  </div>
                  <span className="text-muted-foreground/30 group-hover:text-muted-foreground/60 text-xs transition-colors">↗</span>
                </a>
              ))}
            </div>
          </div>
          <div className="bg-muted/50 border border-border rounded-xl p-4">
            <h3 className="text-foreground text-sm font-bold mb-3">Compliance Score</h3>
            <div className="space-y-1.5">
              {[
                { k: 'Authority', v: summary.vault_score.authority },
                { k: 'Accountability', v: summary.vault_score.accountability },
                { k: 'Boundary', v: summary.vault_score.boundary },
                { k: 'Continuity', v: summary.vault_score.continuity },
                { k: 'Records', v: summary.vault_score.records },
              ].map(({ k, v }) => (
                <div key={k} className="flex items-center gap-2">
                  <span className="text-muted-foreground text-[10px] w-24 shrink-0">{k}</span>
                  <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${v >= 75 ? 'bg-green-500' : v >= 55 ? 'bg-amber-400' : 'bg-red-500'}`}
                      style={{ width: `${v}%` }}
                    />
                  </div>
                  <span className="text-muted-foreground text-[10px] w-6 text-right">{v}</span>
                </div>
              ))}
            </div>
            <div className="mt-3 pt-2 border-t border-border flex items-center justify-between">
              <span className="text-muted-foreground text-xs">Overall</span>
              <span className="text-amber-400 font-black text-xl">{summary.vault_score.overall}</span>
            </div>
            {summary.ownerless_count > 0 && (
              <p className="text-red-400 text-[10px] mt-1">⚠ {summary.ownerless_count} ownerless object{summary.ownerless_count > 1 ? 's' : ''}</p>
            )}
            {summary.unclassified_count > 0 && (
              <p className="text-amber-400 text-[10px]">⚠ {summary.unclassified_count} unclassified object{summary.unclassified_count > 1 ? 's' : ''}</p>
            )}
          </div>
        </div>
      </div>

      {/* Activity Feed */}
      <div className="mt-4 bg-muted/50 border border-border rounded-xl p-4">
        <h3 className="text-foreground text-sm font-bold mb-3">Activity Feed</h3>
        {summary.pj_feed.length === 0 ? (
          <p className="text-muted-foreground/60 text-xs">No system activity yet.</p>
        ) : (
          <div className="space-y-1.5">
            {summary.pj_feed.map(entry => (
              <div key={entry.id} className="flex items-start gap-3 text-xs">
                <span className="text-muted-foreground/60 font-mono shrink-0">{new Date(entry.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</span>
                <span className="text-muted-foreground font-medium shrink-0">{entry.action}</span>
                {entry.notes && <span className="text-muted-foreground/60 truncate">{entry.notes}</span>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
