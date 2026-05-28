import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/services/auth/AuthContext'
import { listCaseSpaces } from '@/services/casespaceApi'
import type { CaseSpace } from '@/lib/types'
import { pjApi, type ArchieveEvent, type ConnectorInfo } from '@/services/pjApi'
import { type ToolKey } from '@/lib/types'
import { format, formatDistanceToNow } from 'date-fns'
import { LOGICVILLE_ENVIRONMENT_ID } from '@/features/environments/constants/logicville'
import {
  Plugs, Vault, FolderOpen, Gavel, TreeStructure,
  ArrowRight, Bed, ArrowSquareOut,
  Warning, ClockCountdown, CheckCircle, Circle, ArrowClockwise, Lightning,
  FileText, Buildings, CurrencyDollar, Megaphone, ShieldCheck, Link,
  House, Terminal,
} from '@phosphor-icons/react'

interface StartScreenProps {
  onSelectTool: (tool: ToolKey) => void
  onOpenConnections: () => void
  onQuickCreate?: (type: string) => void
  onOpenVaultEnv?: (id: string) => void
  canUseTool?: (toolKey: string) => boolean
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function greeting(name: string | null) {
  const h = new Date().getHours()
  const g = h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'
  return `${g}${name ? `, ${name.split(' ')[0]}` : ''}`
}

function timeAgo(ts: string) {
  try { return formatDistanceToNow(new Date(ts), { addSuffix: true }) } catch { return ts }
}

function eventLabel(e: ArchieveEvent): string {
  const t = e.eventType ?? ''
  const m = e.module ?? ''
  if (t === 'record.created') return `New record in ${m}`
  if (t === 'record.sealed') return `Record sealed in ${m}`
  if (t === 'record.updated') return `Record updated in ${m}`
  if (t === 'prr.submitted') return 'Public records request submitted'
  if (t === 'prr.acknowledged') return 'Records request acknowledged'
  if (t === 'prr.closed') return 'Records request closed'
  if (t === 'user.login') return `${e.actor?.userId ?? 'User'} signed in`
  if (t === 'automation.triggered') return `Automation triggered in ${m}`
  if (t === 'automation.completed') return `Automation completed in ${m}`
  if (t === 'case.created') return `New case in ${m}`
  if (t === 'case.updated') return `Case updated in ${m}`
  if (t === 'document.uploaded') return `Document uploaded in ${m}`
  if (t === 'meeting.scheduled') return `Meeting scheduled`
  if (t === 'budget.approved') return `Budget action in ${m}`
  return `${t.replace(/\./g, ' ')} — ${m}`.trim().replace(/^ — $/, t)
}

function eventIcon(e: ArchieveEvent) {
  const t = e.eventType ?? ''
  const sz = 14
  const w = 'duotone' as const
  if (t.startsWith('prr.')) return <FileText size={sz} weight={w} className="text-amber-400" />
  if (t.startsWith('record.')) return <Vault size={sz} weight={w} className="text-blue-400" />
  if (t.startsWith('automation.')) return <Lightning size={sz} weight={w} className="text-violet-400" />
  if (t.startsWith('case.')) return <Buildings size={sz} weight={w} className="text-emerald-400" />
  if (t.startsWith('budget.')) return <CurrencyDollar size={sz} weight={w} className="text-green-400" />
  if (t.startsWith('meeting.')) return <Megaphone size={sz} weight={w} className="text-sky-400" />
  if (t === 'user.login') return <ShieldCheck size={sz} weight={w} className="text-muted-foreground/50" />
  return <Circle size={sz} weight={w} className="text-muted-foreground/40" />
}

// ── PRR helpers ───────────────────────────────────────────────────────────────

interface PRRItem {
  id: string
  caseNumber?: string
  requesterName?: string
  description?: string
  status: string
  createdAt?: string
  dueAt?: string | null
  isSlaBreached?: boolean
  daysSinceCreation?: number
}

function prrStatusColor(s: string) {
  if (s === 'new') return 'bg-amber-500/15 text-amber-400 border-amber-500/20'
  if (s === 'in_review' || s === 'acknowledged') return 'bg-blue-500/15 text-blue-400 border-blue-500/20'
  if (s === 'response_ready') return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20'
  return 'bg-muted/60 text-muted-foreground border-border/40'
}

// ── Connector row ─────────────────────────────────────────────────────────────

function ConnectorPill({ label, icon, info, onConnect }: {
  label: string
  icon: React.ReactNode
  info: ConnectorInfo | undefined
  onConnect: () => void
}) {
  if (!info) return null
  return info.connected ? (
    <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-muted/30 border border-border/50 text-xs font-medium text-foreground/70">
      {icon}
      <span>{label}</span>
      <CheckCircle size={11} weight="fill" className="text-emerald-500 ml-0.5" />
    </div>
  ) : (
    <button onClick={onConnect}
      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-muted/20 border border-dashed border-border/50 text-xs font-medium text-muted-foreground hover:text-foreground hover:border-border transition-colors">
      {icon}
      <span>{label}</span>
      <Plugs size={11} className="text-muted-foreground/50 ml-0.5" />
    </button>
  )
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg bg-muted/50 ${className}`} />
}

// ── Component ─────────────────────────────────────────────────────────────────

export function StartScreen({ onSelectTool, onOpenConnections, onOpenVaultEnv }: StartScreenProps) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [sysOk, setSysOk] = useState<boolean | null>(null)
  const [workspaces, setWorkspaces] = useState<CaseSpace[] | null>(null)
  const [connectors, setConnectors] = useState<Record<string, ConnectorInfo> | null>(null)
  const [activity, setActivity] = useState<ArchieveEvent[] | null>(null)
  const [prrs, setPrrs] = useState<PRRItem[] | null>(null)

  const [refreshTick, _setRefreshTick] = useState(0)

  useEffect(() => {
    // Parallel fetch everything
    pjApi.system.health()
      .then(h => setSysOk(h?.status === 'ok'))
      .catch(() => setSysOk(false))

    pjApi.connectors.status()
      .then(r => setConnectors(r?.connectors ?? {}))
      .catch(() => setConnectors({}))

    pjApi.archieve.events({ limit: 8 })
      .then(r => setActivity(
        (r?.events ?? []).filter(e => e.eventType !== 'user.login' || true)
      ))
      .catch(() => setActivity([]))

    pjApi.prr.list()
      .then(r => {
        const arr: PRRItem[] = Array.isArray(r) ? r : (r?.requests ?? r?.items ?? [])
        setPrrs(arr.filter((p: PRRItem) => p.status !== 'closed' && p.status !== 'denied'))
      })
      .catch(() => setPrrs([]))

    listCaseSpaces()
      .then(all => setWorkspaces(all.filter(ws =>
        !ws.id.startsWith('vault-logicville') &&
        !ws.id.startsWith('demo-') &&
        ws.name !== 'Town of Logicville'
      )))
      .catch(() => setWorkspaces([]))
  }, [refreshTick])

  const openPRRs = prrs?.filter(p => ['new', 'acknowledged', 'in_review'].includes(p.status)) ?? []
  const breachedPRRs = openPRRs.filter(p => p.isSlaBreached)
  const connectedConnectorCount = useMemo(
    () => Object.values(connectors ?? {}).filter(info => info.connected).length,
    [connectors],
  )
  const summaryCards = useMemo(() => ([
    {
      label: 'Open attention queue',
      value: openPRRs.length,
      detail: breachedPRRs.length > 0 ? `${breachedPRRs.length} breached` : 'Within SLA',
    },
    {
      label: 'Connected services',
      value: connectedConnectorCount,
      detail: connectors === null ? 'Checking status' : 'Ready for sync',
    },
    {
      label: 'Active workspaces',
      value: workspaces?.length ?? 0,
      detail: workspaces === null ? 'Loading' : 'Operational lanes',
    },
    {
      label: 'Recent activity',
      value: activity?.length ?? 0,
      detail: activity === null ? 'Refreshing' : 'Latest archive events',
    },
  ]), [activity, breachedPRRs.length, connectedConnectorCount, connectors, openPRRs.length, workspaces])

  return (
    <div className="h-full w-full flex flex-col bg-transparent overflow-auto">

      {/* Header */}
      <div className="sticky top-0 z-10 border-b border-border/60 bg-background/88 backdrop-blur-2xl">
        <div className="px-5 sm:px-8 pt-4 pb-4 flex items-center justify-between gap-4">
          <div>
            <h1 className="text-lg font-semibold text-foreground tracking-tight">
              {greeting(user?.name ?? null)}
            </h1>
            <div className="flex items-center gap-3 mt-0.5">
              <p className="text-xs text-muted-foreground">{format(new Date(), 'EEEE, MMMM d')}</p>
              <div className={`flex items-center gap-1.5 text-[10px] font-medium ${
                sysOk === null ? 'text-muted-foreground/40' :
                sysOk ? 'text-emerald-500' : 'text-amber-500'
              }`}>
                <div className={`w-1.5 h-1.5 rounded-full ${
                  sysOk === null ? 'bg-muted-foreground/30' : sysOk ? 'bg-emerald-500' : 'bg-amber-500'
                }`} />
                {sysOk === null ? '' : sysOk ? 'All systems running' : 'System degraded'}
              </div>
            </div>
          </div>
          <button onClick={() => onOpenConnections()}
            className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-card border hover:bg-muted/30 transition-colors text-muted-foreground hover:text-foreground">
            <Plugs size={12} weight="duotone" />
            Connect
          </button>
        </div>
      </div>

      <div className="flex-1 w-full max-w-5xl mx-auto px-5 sm:px-8 py-6 flex flex-col gap-8">
        <section className="surface-panel-strong rounded-[28px] px-5 py-5 sm:px-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <p className="section-kicker">Operator desk</p>
              <h2 className="mt-2 text-2xl font-black tracking-tight text-foreground sm:text-3xl">
                One place to see what needs attention, what is connected, and where work is moving.
              </h2>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">
                LogicOS now opens with a clearer desk view: priority work, live workspace access, and a tighter operational read on the state of the system.
              </p>
            </div>
            <button onClick={() => onOpenConnections()}
              className="status-chip self-start text-foreground hover:border-primary/25 hover:text-primary transition-colors">
              <Plugs size={12} weight="duotone" />
              Manage connections
            </button>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {summaryCards.map((card) => (
              <div key={card.label} className="surface-panel rounded-2xl px-4 py-4">
                <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">{card.label}</div>
                <div className="mt-2 text-3xl font-black tracking-tight text-foreground">{card.value}</div>
                <div className="mt-1 text-xs text-muted-foreground">{card.detail}</div>
              </div>
            ))}
          </div>
        </section>

        {/* Connected Services */}
        {connectors !== null && Object.keys(connectors).length > 0 && (
          <section>
            <p className="text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-widest mb-2">Connected Services</p>
            <div className="flex flex-wrap gap-2">
              <ConnectorPill label="GitHub" info={connectors['github']}
                icon={<Link size={13} />}
                onConnect={() => pjApi.connectors.connect('github')} />
              <ConnectorPill label="Microsoft 365" info={connectors['microsoft']}
                icon={<Link size={13} className="text-blue-400" />}
                onConnect={() => pjApi.connectors.connect('microsoft')} />
              <ConnectorPill label="Google" info={connectors['google']}
                icon={<Link size={13} className="text-red-400" />}
                onConnect={() => pjApi.connectors.connect('google')} />
            </div>
          </section>
        )}

        {/* Needs Attention */}
        {prrs === null ? (
          <section>
            <Skeleton className="h-4 w-36 mb-3" />
            <div className="flex flex-col gap-2">
              <Skeleton className="h-14 w-full" />
              <Skeleton className="h-14 w-full" />
            </div>
          </section>
        ) : openPRRs.length > 0 ? (
          <section>
            <div className="flex items-center gap-2 mb-3">
              <p className="text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-widest">
                Needs Attention
              </p>
              {breachedPRRs.length > 0 && (
                <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-500/15 text-red-400 border border-red-500/20">
                  <Warning size={9} weight="fill" />
                  {breachedPRRs.length} SLA breached
                </span>
              )}
            </div>
            <div className="flex flex-col gap-2">
              {openPRRs.slice(0, 5).map(prr => (
                <button key={prr.id} onClick={() => onSelectTool('records' as ToolKey)}
                  className="surface-panel flex items-start gap-3 p-3.5 rounded-2xl hover:border-border transition-colors text-left group">
                  <div className={`mt-0.5 shrink-0 flex items-center justify-center w-7 h-7 rounded-lg ${prr.isSlaBreached ? 'bg-red-500/15 text-red-400' : 'bg-amber-500/10 text-amber-400'}`}>
                    {prr.isSlaBreached ? <Warning size={14} weight="fill" /> : <ClockCountdown size={14} weight="duotone" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-semibold text-foreground">{prr.caseNumber ?? prr.id}</span>
                      <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-md border ${prrStatusColor(prr.status)}`}>
                        {prr.status.replace(/_/g, ' ')}
                      </span>
                      {prr.dueAt && (
                        <span className={`text-[10px] ${prr.isSlaBreached ? 'text-red-400 font-semibold' : 'text-muted-foreground'}`}>
                          due {format(new Date(prr.dueAt), 'MMM d')}
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-1">
                      {prr.requesterName && <span className="font-medium">{prr.requesterName} · </span>}
                      {prr.description}
                    </p>
                  </div>
                  <ArrowRight size={13} className="shrink-0 mt-1 text-muted-foreground/30 group-hover:text-muted-foreground transition-colors" />
                </button>
              ))}
              {openPRRs.length > 5 && (
                <button onClick={() => onSelectTool('records' as ToolKey)}
                  className="text-xs text-primary hover:underline text-center py-1">
                  View all {openPRRs.length} open requests →
                </button>
              )}
            </div>
          </section>
        ) : null}

        {/* Recent Activity */}
        {activity === null ? (
          <section>
            <Skeleton className="h-4 w-32 mb-3" />
            {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-8 w-full mb-2" />)}
          </section>
        ) : activity.length > 0 ? (
          <section>
            <div className="flex items-center justify-between mb-3">
              <p className="text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-widest">Recent Activity</p>
              <button onClick={() => setActivity(null) /* re-trigger */ }
                className="text-[10px] text-muted-foreground/50 hover:text-muted-foreground flex items-center gap-1 transition-colors">
                <ArrowClockwise size={10} />
                Refresh
              </button>
            </div>
            <div className="surface-panel overflow-hidden rounded-2xl divide-y divide-border/40">
              {activity.slice(0, 7).map(e => (
                <div key={e.eventId} className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted/20 transition-colors">
                  <div className="shrink-0 w-5 flex items-center justify-center">
                    {eventIcon(e)}
                  </div>
                  <p className="flex-1 text-xs text-foreground/80 leading-snug">{eventLabel(e)}</p>
                  <span className="shrink-0 text-[10px] text-muted-foreground/50 whitespace-nowrap">{timeAgo(e.timestamp)}</span>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {/* Active Workspaces */}
        <section>
          <div className="flex items-center mb-3">
            <p className="text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-widest">Active Workspaces</p>
          </div>

          {workspaces === null ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <Skeleton className="h-16" />
              <Skeleton className="h-16" />
            </div>
          ) : workspaces.length === 0 ? (
            <div className="flex items-center gap-3 py-6 px-4 rounded-xl border border-dashed border-border/50 text-center justify-center">
              <FolderOpen size={18} weight="duotone" className="text-muted-foreground/30" />
              <p className="text-xs text-muted-foreground">No workspaces yet — open a workspace to start.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {workspaces.map(ws => (
                <button key={ws.id} onClick={() => onOpenVaultEnv?.(ws.id)}
                  className="surface-panel flex items-center gap-3 p-3.5 rounded-2xl hover:border-border transition-colors text-left group">
                  <div className="w-8 h-8 rounded-lg bg-muted shrink-0 flex items-center justify-center text-muted-foreground group-hover:text-foreground transition-colors">
                    {ws.type === 'vault' ? <Vault size={16} weight="duotone" /> :
                     ws.type === 'stay' ? <Bed size={16} weight="duotone" /> :
                     ws.type === 'project' ? <TreeStructure size={16} weight="duotone" /> :
                     <FolderOpen size={16} weight="duotone" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-semibold text-foreground truncate">{ws.name}</div>
                    {ws.description && <div className="text-[10px] text-muted-foreground truncate">{ws.description}</div>}
                  </div>
                  <ArrowSquareOut size={12} className="shrink-0 text-muted-foreground/30 group-hover:text-muted-foreground transition-colors" />
                </button>
              ))}
            </div>
          )}
        </section>

        {/* Quick Launch — Environments */}
        <section>
          <p className="text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-widest mb-3">Environments</p>
          <div className="flex flex-col gap-2">
            {/* Civic */}
            <button onClick={() => onSelectTool('civic' as ToolKey)}
              className="w-full flex items-center gap-4 p-5 rounded-2xl border bg-gradient-to-br from-red-900/60 to-red-950/80 border-red-700/50 hover:border-red-600/70 hover:scale-[1.005] hover:shadow-lg hover:shadow-black/20 transition-all duration-200 text-left group">
              <div className="w-12 h-12 rounded-xl bg-red-800/60 flex items-center justify-center text-white/90 shrink-0">
                <Gavel size={26} weight="duotone" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-sm font-bold text-white/95">Civic</span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500 text-white">Live</span>
                </div>
                <p className="text-[11px] text-white/55">MGL-compliant municipal governance — records, meetings, procurement, budget</p>
              </div>
              <ArrowRight size={16} weight="bold" className="text-white/40 group-hover:text-white/70 transition-colors shrink-0" />
            </button>

            {/* Logicville Demo */}
            <button onClick={() => onOpenVaultEnv?.(LOGICVILLE_ENVIRONMENT_ID)}
              className="w-full flex items-center gap-4 p-4 rounded-2xl border bg-gradient-to-br from-indigo-900/50 to-indigo-950/70 border-indigo-700/40 hover:border-indigo-600/60 hover:scale-[1.005] hover:shadow-lg hover:shadow-black/20 transition-all duration-200 text-left group">
              <div className="w-10 h-10 rounded-xl bg-indigo-800/50 flex items-center justify-center text-white/80 shrink-0">
                <House size={20} weight="duotone" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-sm font-bold text-white/90">Logicville Demo</span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-500/80 text-white">Demo</span>
                </div>
                <p className="text-[11px] text-white/45">Fully-configured demo town — explore all modules with real workflows</p>
              </div>
              <ArrowRight size={14} weight="bold" className="text-white/30 group-hover:text-white/60 transition-colors shrink-0" />
            </button>

            {/* MGL-001 DEMO */}
            <button onClick={() => navigate('/dev')}
              className="w-full flex items-center gap-4 p-4 rounded-2xl border bg-gradient-to-br from-zinc-800/50 to-zinc-900/70 border-zinc-700/40 hover:border-zinc-600/60 hover:scale-[1.005] hover:shadow-lg hover:shadow-black/20 transition-all duration-200 text-left group">
              <div className="w-10 h-10 rounded-xl bg-zinc-700/50 flex items-center justify-center text-white/70 shrink-0">
                <Terminal size={20} weight="duotone" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-sm font-bold text-white/85">MGL-001 DEMO</span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-zinc-600/80 text-white/70">Demo</span>
                </div>
                <p className="text-[11px] text-white/40">VAULT MGL-001 — standalone municipal records &amp; compliance demo</p>
              </div>
              <ArrowRight size={14} weight="bold" className="text-white/25 group-hover:text-white/55 transition-colors shrink-0" />
            </button>

            {/* AED × PublicLogic */}
            <button onClick={() => onSelectTool('aed' as ToolKey)}
              className="w-full flex items-center gap-4 p-5 rounded-2xl border bg-gradient-to-br from-amber-900/60 to-amber-950/80 border-amber-700/50 hover:border-amber-600/70 hover:scale-[1.005] hover:shadow-lg hover:shadow-black/20 transition-all duration-200 text-left group">
              <div className="w-12 h-12 rounded-xl bg-amber-800/60 flex items-center justify-center text-white/90 shrink-0">
                <Buildings size={26} weight="duotone" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-sm font-bold text-white/95">AED × PublicLogic</span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500 text-white">Live</span>
                </div>
                <p className="text-[11px] text-white/55">NMTC compliance vault · 7-year clocks · institutional governance</p>
              </div>
              <ArrowRight size={16} weight="bold" className="text-white/40 group-hover:text-white/70 transition-colors shrink-0" />
            </button>
          </div>
        </section>

      </div>

      {/* Footer */}
      <footer className="border-t border-border/70 px-6 py-3 flex items-center justify-between flex-wrap gap-3 text-xs text-muted-foreground/40">
        <span>© 2026 PublicLogic, Inc.</span>
        <div className="flex gap-4">
          <a href="https://publiclogic.org/terms" target="_blank" rel="noreferrer" className="hover:text-muted-foreground transition-colors">Terms</a>
          <a href="https://publiclogic.org/privacy" target="_blank" rel="noreferrer" className="hover:text-muted-foreground transition-colors">Privacy</a>
          <a href="mailto:info@publiclogic.org" className="hover:text-muted-foreground transition-colors">info@publiclogic.org</a>
        </div>
      </footer>
    </div>
  )
}
