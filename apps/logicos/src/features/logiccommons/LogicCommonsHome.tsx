import { useNavigate } from 'react-router-dom'
import { useCommonsContext } from './hooks/useCommonsContext'
import { useCommonsAlerts } from './hooks/useCommonsAlerts'
import { useDashboard } from './hooks/useDashboard'
import { useSeedDemoData } from './hooks/useIntakeRecord'
import { AlertTriangle, FileText, Clock, Activity } from 'lucide-react'

const SEVERITY_ORDER: Record<string, number> = { critical: 0, high: 1, warning: 2, info: 3 }

const SEVERITY_BORDER: Record<string, string> = {
  critical: 'border-l-4 border-l-red-600',
  high:     'border-l-4 border-l-amber-500',
  warning:  'border-l-4 border-l-yellow-400',
  info:     'border-l-4 border-l-slate-300',
}

const SEVERITY_BADGE: Record<string, string> = {
  critical: 'bg-red-100 text-red-800',
  high:     'bg-amber-100 text-amber-800',
  warning:  'bg-yellow-100 text-yellow-800',
  info:     'bg-slate-100 text-slate-600',
}

const CONNECTORS = [
  { key: 'civicplus', label: 'CivicPlus' },
  { key: 'm365',      label: 'M365' },
  { key: 'google',    label: 'Google' },
]

export function LogicCommonsHome() {
  const navigate = useNavigate()
  const { data: ctx, isLoading: ctxLoading } = useCommonsContext()
  const { data: alerts } = useCommonsAlerts()
  const { data: dashboard, isLoading: dashLoading } = useDashboard()
  const seed = useSeedDemoData()

  const topAlerts = alerts
    ? [...alerts]
        .filter(a => a.status === 'open')
        .sort((a, b) => (SEVERITY_ORDER[a.severity] ?? 9) - (SEVERITY_ORDER[b.severity] ?? 9))
        .slice(0, 5)
    : []

  const isEmpty = !dashLoading && (dashboard?.summary.total_records ?? 0) === 0

  return (
    <div className="p-6 space-y-8 max-w-5xl">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">LogicCommons</h1>
          {ctxLoading ? (
            <div className="h-4 w-48 bg-muted animate-pulse rounded mt-1" />
          ) : (
            <p className="text-sm text-muted-foreground mt-1">{ctx?.municipality_name}</p>
          )}
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {CONNECTORS.map(c => {
            const active = ctx?.active_connectors?.includes(c.key)
            return (
              <div key={c.key} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className={`w-2 h-2 rounded-full ${active ? 'bg-green-500' : 'bg-slate-300'}`} />
                {c.label}
              </div>
            )
          })}
        </div>
      </div>

      {/* Empty state — no seed data yet */}
      {isEmpty && (
        <div className="rounded-xl border-2 border-dashed border-border bg-card/30 p-10 flex flex-col items-center gap-4 text-center">
          <div className="text-5xl">🏛️</div>
          <div>
            <p className="text-base font-semibold">Welcome to Logicville</p>
            <p className="text-sm text-muted-foreground mt-1 max-w-sm">
              Load the demo to see all 9 governance modules in action — public records, meetings, procurement, grants, permits, and more.
            </p>
          </div>
          <button
            onClick={() => seed.mutate()}
            disabled={seed.isPending}
            className="text-sm font-semibold px-6 py-2.5 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {seed.isPending ? 'Loading Logicville…' : 'Load Logicville Demo'}
          </button>
        </div>
      )}

      {/* Summary stats */}
      {!isEmpty && dashboard && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { icon: <FileText size={16} />, label: 'Active Records', value: dashboard.summary.total_records, sub: 'across all modules', color: 'text-primary' },
            { icon: <AlertTriangle size={16} />, label: 'Open Alerts', value: dashboard.summary.open_alerts, sub: 'requiring attention', color: dashboard.summary.open_alerts > 0 ? 'text-amber-600' : 'text-green-600' },
            { icon: <Clock size={16} />, label: 'Overdue', value: dashboard.summary.overdue_records, sub: 'past SLA deadline', color: dashboard.summary.overdue_records > 0 ? 'text-red-600' : 'text-green-600' },
            { icon: <Activity size={16} />, label: 'Active Modules', value: dashboard.summary.active_modules, sub: 'of 9 deployed', color: 'text-primary' },
          ].map(s => (
            <div key={s.label} className="rounded-lg border bg-card/50 p-4">
              <div className={`flex items-center gap-1.5 ${s.color} mb-1`}>{s.icon}<span className="text-xs font-semibold">{s.label}</span></div>
              <p className="text-2xl font-bold">{s.value}</p>
              <p className="text-xs text-muted-foreground">{s.sub}</p>
            </div>
          ))}
        </div>
      )}

      {/* Alert Digest */}
      {!isEmpty && (
        <section>
          <h2 className="text-base font-semibold mb-3">Alert Digest</h2>
          {topAlerts.length === 0 ? (
            <p className="text-sm text-muted-foreground">No open alerts. All systems nominal.</p>
          ) : (
            <div className="space-y-2">
              {topAlerts.map(a => (
                <button
                  key={a.id}
                  onClick={() => navigate('/commons/alerts')}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border bg-card/50 hover:bg-card transition-colors text-left ${SEVERITY_BORDER[a.severity] ?? ''}`}
                >
                  <span className={`text-xs font-semibold rounded-md px-2 py-0.5 shrink-0 ${SEVERITY_BADGE[a.severity] ?? ''}`}>
                    {a.severity}
                  </span>
                  <span className="text-sm flex-1 min-w-0 truncate">{a.title}</span>
                  <span className="text-xs text-muted-foreground shrink-0">{a.domain.replace('_', ' ')}</span>
                </button>
              ))}
              <button onClick={() => navigate('/commons/alerts')} className="text-xs text-primary hover:underline">
                View all alerts →
              </button>
            </div>
          )}
        </section>
      )}

    </div>
  )
}
