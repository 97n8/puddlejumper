import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { useKV } from '@/hooks/useKV'
import { Button } from '@/components/ui/button'
import { ArrowsClockwise, Lightning, Plus, X } from '@phosphor-icons/react'
import { Synchron8AutomationsPanel } from './Synchron8AutomationsPanel'
import type { FlowStatus, InstalledFlow } from '../types'
import { RECIPES } from '../data/recipes'
import { FlowCard } from './FlowCard'
import { AddFlowModal } from './AddFlowModal'
import { CatalogPage } from './CatalogPage'
import { RunHistoryPage } from './RunHistoryPage'
import { NavPlaceholder } from './NavPlaceholder'
import { civicApi, type CivicFlow, type CivicFlowFramework, type CivicFlowRun } from '@/features/civic/api/civicApi'

type NavPage = 'flows' | 'catalog' | 'runs' | 'audit' | 'governance'

const NAV: { id: NavPage; label: string; group: string }[] = [
  { id: 'flows',      label: 'Integrations', group: 'Automations' },
  { id: 'catalog',    label: 'Catalog',      group: 'Automations' },
  { id: 'runs',       label: 'Run History',  group: 'Automations' },
  { id: 'governance', label: 'Governance',   group: 'Governance' },
  { id: 'audit',      label: 'Audit Log',    group: 'Governance' },
]

const PAGE_META: Record<Exclude<NavPage, 'audit'>, { eyebrow: string; title: string; description: string }> = {
  flows: {
    eyebrow: 'Installed flows',
    title: 'Flows',
    description: 'The automations already wired into your workspace and ready to run or tune.',
  },
  catalog: {
    eyebrow: 'Automation library',
    title: 'Catalog',
    description: 'Browse prebuilt automations and promote the right ones into your workspace.',
  },
  runs: {
    eyebrow: 'Execution history',
    title: 'Run History',
    description: 'Track recent flow activity, outcomes, and execution volume across the workspace.',
  },
  governance: {
    eyebrow: 'Governed scenarios',
    title: 'Governance',
    description: 'Operational automations that need explicit control, evidence, and sign-off.',
  },
}

const STATUS_FILTERS: Array<FlowStatus | 'all'> = ['all', 'draft', 'active', 'paused', 'archived']

function scenarioToLogicSteps(flow: CivicFlow): InstalledFlow['logicSteps'] {
  const nodes = Array.isArray(flow.scenario?.nodes) ? flow.scenario.nodes : []
  return nodes
    .filter(node => node.id !== 'base-action')
    .map(node => ({
      id: node.id,
      kind: node.kind === 'condition' ? 'if' : 'then',
      title: node.title ?? (node.kind === 'condition' ? 'Condition' : 'Action'),
      detail: node.detail ?? '',
      humanReview: node.kind === 'review_gate' || node.humanReview,
    }))
}

function mapApiFlowToInstalled(flow: CivicFlow, frameworks: CivicFlowFramework[]): InstalledFlow {
  const recipeId = String(flow.trigger_spec.recipeId ?? '')
  const recipe = RECIPES.find(item => item.id === recipeId)
  const framework = frameworks.find(item => item.id === flow.framework_id)
  const lastStatus = flow.last_run_status === 'failed' ? 'error' : flow.last_run_status ? 'success' : undefined

  return {
    id: flow.id,
    recipeId,
    name: flow.name,
    trigger: String(flow.trigger_spec.label ?? recipe?.trigger ?? flow.linked_app),
    triggerType: recipe?.triggerType ?? 'manual',
    action: recipe?.action ?? flow.name,
    config: (flow.trigger_spec.config as Record<string, string> | undefined) ?? {},
    connection: flow.linked_app as InstalledFlow['connection'],
    frameworkId: flow.framework_id,
    frameworkLabel: framework?.name ?? flow.framework_id,
    frameworkChapter: framework?.chapter,
    logicSteps: scenarioToLogicSteps(flow),
    backendTriggerSpec: flow.trigger_spec,
    backendScenario: flow.scenario,
    enabled: flow.status === 'active',
    status: flow.status,
    installedAt: new Date(flow.created_at).getTime(),
    lastRun: flow.last_run_at ? new Date(flow.last_run_at).getTime() : undefined,
    lastStatus,
    lastMessage: flow.last_run_status === 'halted_for_review' ? 'Awaiting human review' : undefined,
    runCount: flow.last_run_at ? 1 : 0,
    canRunNow: flow.status === 'active',
  }
}

function formatDuration(run: CivicFlowRun) {
  if (!run.finished_at) return 'In progress'
  const started = new Date(run.started_at).getTime()
  const finished = new Date(run.finished_at).getTime()
  const ms = Math.max(0, finished - started)
  const seconds = Math.round(ms / 1000)
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  const remainder = seconds % 60
  return `${minutes}m ${remainder}s`
}

export function FlowsPanel({ onOpenAudit }: { onOpenAudit?: () => void }) {
  const [flows, setFlows] = useKV<InstalledFlow[]>('logicworkspace-flows', [])
  const [showAdd, setShowAdd] = useState(false)
  const [page, setPage] = useState<NavPage>('flows')
  const [statusFilter, setStatusFilter] = useState<FlowStatus | 'all'>('all')
  const [remoteFlows, setRemoteFlows] = useState<CivicFlow[]>([])
  const [frameworks, setFrameworks] = useState<CivicFlowFramework[]>([])
  const [remoteAvailable, setRemoteAvailable] = useState(false)
  const [loadingRemote, setLoadingRemote] = useState(false)
  const [remoteError, setRemoteError] = useState<string | null>(null)
  const [selectedRunsFlow, setSelectedRunsFlow] = useState<InstalledFlow | null>(null)
  const [selectedRuns, setSelectedRuns] = useState<CivicFlowRun[]>([])
  const [runsLoading, setRunsLoading] = useState(false)

  const localFlows = flows ?? []

  async function loadRemoteFlows(nextStatus = statusFilter) {
    setLoadingRemote(true)
    try {
      const [frameworkResponse, flowResponse] = await Promise.all([
        civicApi.flows.frameworks(),
        civicApi.flows.list(nextStatus === 'all' ? undefined : nextStatus),
      ])
      setFrameworks(frameworkResponse.frameworks)
      setRemoteFlows(flowResponse.flows)
      setRemoteAvailable(true)
      setRemoteError(null)
    } catch (error) {
      setRemoteAvailable(false)
      setRemoteError(error instanceof Error ? error.message : 'Could not load Civic Flows')
    } finally {
      setLoadingRemote(false)
    }
  }

  useEffect(() => {
    void loadRemoteFlows(statusFilter)
  }, [statusFilter])

  const installed = useMemo(() => {
    if (remoteAvailable) {
      return remoteFlows.map(flow => mapApiFlowToInstalled(flow, frameworks))
    }
    return localFlows.filter(flow => {
      if (statusFilter === 'all') return true
      const localStatus = flow.status ?? (flow.enabled ? 'active' : 'paused')
      return localStatus === statusFilter
    })
  }, [frameworks, localFlows, remoteAvailable, remoteFlows, statusFilter])

  const activeCount = installed.filter(flow => (flow.status ?? (flow.enabled ? 'active' : 'paused')) === 'active').length
  const draftCount = installed.filter(flow => (flow.status ?? (flow.enabled ? 'active' : 'paused')) === 'draft').length
  const manualCount = installed.filter(flow => flow.canRunNow).length
  const recentRuns = installed.filter(flow => flow.lastRun).length

  const addFlow = (flow: InstalledFlow) => {
    setFlows(prev => [...(prev ?? []), flow])
    void loadRemoteFlows()
  }

  const deleteFlow = async (flow: InstalledFlow) => {
    if (remoteAvailable && flow.id) {
      try {
        await civicApi.flows.archive(flow.id)
        toast.success('Flow archived')
        void loadRemoteFlows()
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Could not archive flow')
      }
      return
    }
    setFlows(prev => (prev ?? []).filter(item => item.id !== flow.id))
  }

  const toggleFlow = async (flow: InstalledFlow) => {
    if (remoteAvailable && flow.id) {
      try {
        if ((flow.status ?? (flow.enabled ? 'active' : 'paused')) === 'active') {
          await civicApi.flows.pause(flow.id)
        } else {
          await civicApi.flows.activate(flow.id)
        }
        void loadRemoteFlows()
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Could not update flow status')
      }
      return
    }
    setFlows(prev => (prev ?? []).map(item => item.id === flow.id ? { ...item, enabled: !item.enabled } : item))
  }

  const updateFlow = async (flow: InstalledFlow, cfg: Record<string, string>) => {
    if (remoteAvailable && flow.id) {
      try {
        await civicApi.flows.update(flow.id, {
          trigger_spec: {
            ...(flow.backendTriggerSpec ?? {}),
            config: cfg,
          },
        })
        toast.success('Flow updated')
        void loadRemoteFlows()
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Could not update flow')
      }
      return
    }

    setFlows(prev => (prev ?? []).map(item =>
      item.id === flow.id ? { ...item, config: cfg, lastRun: Date.now(), lastStatus: 'success' as const, runCount: item.runCount + 1 } : item,
    ))
  }

  const openRunsDrawer = async (flow: InstalledFlow) => {
    setSelectedRunsFlow(flow)
    if (!remoteAvailable) {
      setSelectedRuns([])
      return
    }
    setRunsLoading(true)
    try {
      const response = await civicApi.flows.runs(flow.id, 1, 10)
      setSelectedRuns(response.runs)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not load run history')
      setSelectedRuns([])
    } finally {
      setRunsLoading(false)
    }
  }

  const runFlowNow = async (flow: InstalledFlow) => {
    if (!window.confirm(`Run "${flow.name}" now?`)) {
      return
    }

    if (remoteAvailable) {
      try {
        const response = await civicApi.flows.run(flow.id)
        toast.success(`Run queued: ${response.run_id}`)
        await loadRemoteFlows()
        if (selectedRunsFlow?.id === flow.id) {
          await openRunsDrawer(flow)
        }
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Could not start run')
      }
      return
    }

    const recipe = RECIPES.find(item => item.id === flow.recipeId)
    if (!recipe?.run) return
    try {
      await recipe.run(flow.config)
      setFlows(prev => (prev ?? []).map(item =>
        item.id === flow.id
          ? { ...item, lastRun: Date.now(), lastStatus: 'success' as const, runCount: item.runCount + 1 }
          : item,
      ))
      toast.success('Run complete')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Run failed')
    }
  }

  const groups = ['Automations', 'Governance', 'Compliance']
  const currentMeta = page === 'audit' ? null : PAGE_META[page]

  return (
    <div className="flex-1 flex overflow-hidden bg-background">
      <aside className="w-60 border-r border-border bg-card/80 flex flex-col shrink-0">
        <div className="px-4 py-4 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/10 text-amber-500">
              <Lightning size={16} weight="duotone" />
            </div>
            <div>
              <div className="text-xs font-mono font-medium tracking-widest text-muted-foreground">SYNCHRON8</div>
              <div className="mt-0.5 text-[11px] text-muted-foreground">Workflow control plane</div>
            </div>
          </div>
        </div>
        <nav className="flex-1 p-3 overflow-y-auto">
          {groups.map((group, gi) => (
            <div key={group} className={gi > 0 ? 'mt-4' : ''}>
              <div className="px-2 py-1 text-[10px] font-mono tracking-widest text-muted-foreground/60 uppercase">{group}</div>
              {NAV.filter(item => item.group === group).map(item => (
                <button
                  key={item.id}
                  onClick={() => { if (item.id === 'audit' && onOpenAudit) { onOpenAudit(); } else { setPage(item.id); } }}
                  className={`flex items-center gap-2 w-full text-left px-3 py-2 rounded-xl text-sm transition-colors
                    ${page === item.id ? 'bg-primary/10 text-primary font-medium shadow-sm' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`}
                >
                  <span className={`flex h-7 w-7 items-center justify-center rounded-lg ${page === item.id ? 'bg-background text-primary' : 'bg-muted/60 text-muted-foreground'}`}>
                    <Lightning size={13} weight={page === item.id ? 'duotone' : 'regular'} />
                  </span>
                  <span className="min-w-0 flex-1 truncate">{item.label}</span>
                  {((item.id === 'flows' && installed.length > 0) || (item.id === 'runs' && recentRuns > 0)) && (
                    <span className="ml-auto rounded-full bg-background px-1.5 py-0.5 text-[10px] text-muted-foreground">
                      {item.id === 'flows' ? installed.length : recentRuns}
                    </span>
                  )}
                </button>
              ))}
            </div>
          ))}
        </nav>

        <div className="border-t border-border p-3">
          <div className="rounded-2xl border border-border bg-background/70 p-3">
            <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">Workspace pulse</div>
            <div className="mt-3 grid grid-cols-3 gap-2">
              {[
                { label: 'Installed', value: installed.length },
                { label: 'Active', value: activeCount },
                { label: 'Draft', value: draftCount },
              ].map(item => (
                <div key={item.label} className="rounded-xl bg-muted/40 px-2 py-2 text-center">
                  <div className="text-sm font-semibold text-foreground">{item.value}</div>
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{item.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </aside>

      <div className="flex-1 flex flex-col overflow-hidden bg-gradient-to-b from-muted/20 via-background to-background">
        {currentMeta && (
          <div className="shrink-0 border-b border-border bg-background/80 px-5 py-4 backdrop-blur">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
              <div className="max-w-2xl">
                <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-muted-foreground">{currentMeta.eyebrow}</div>
                <h2 className="mt-1 text-lg font-semibold text-foreground">{currentMeta.title}</h2>
                <p className="mt-1 text-sm text-muted-foreground">{currentMeta.description}</p>
              </div>

              {page === 'flows' && (
                <div className="grid grid-cols-3 gap-2 xl:min-w-[360px]">
                  {[
                    { label: 'Installed', value: installed.length },
                    { label: 'Active', value: activeCount },
                    { label: 'Run-capable', value: manualCount },
                  ].map(card => (
                    <div key={card.label} className="rounded-2xl border border-border bg-card px-4 py-3">
                      <div className="text-base font-semibold text-foreground">{card.value}</div>
                      <div className="text-[11px] text-muted-foreground">{card.label}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {page === 'catalog' ? (
          <CatalogPage installed={installed} onAdd={addFlow} onInstall={() => {}} />
        ) : page === 'runs' ? (
          <RunHistoryPage flows={installed} />
        ) : page === 'governance' ? (
          <Synchron8AutomationsPanel />
        ) : page !== 'flows' ? (
          <NavPlaceholder label={NAV.find(item => item.id === page)?.label ?? page} />
        ) : (
          <>
            <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0 bg-background/80">
              <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                <span className="rounded-full bg-muted px-2 py-1">{installed.length === 0 ? 'No flows installed' : `${activeCount} of ${installed.length} active`}</span>
                <span className="rounded-full bg-muted px-2 py-1">{recentRuns} with run history</span>
                {remoteError && <span className="rounded-full bg-destructive/10 px-2 py-1 text-destructive">Offline fallback</span>}
              </div>
              <Button size="sm" className="gap-1.5 h-8 text-xs shadow-sm" onClick={() => setShowAdd(true)}>
                <Plus size={12} /> Build Scenario
              </Button>
            </div>

            <div className="px-5 pt-4 flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2 flex-wrap">
                {STATUS_FILTERS.map(filter => (
                  <button
                    key={filter}
                    onClick={() => setStatusFilter(filter)}
                    className={`rounded-full border px-3 py-1 text-xs font-medium ${
                      statusFilter === filter
                        ? 'border-primary/30 bg-primary/10 text-primary'
                        : 'border-border bg-background text-muted-foreground'
                    }`}
                  >
                    {filter}
                  </button>
                ))}
              </div>
              {remoteAvailable && (
                <button onClick={() => void loadRemoteFlows()} className="flex items-center gap-1 text-xs text-muted-foreground">
                  <ArrowsClockwise size={12} />
                  Refresh
                </button>
              )}
            </div>

            {installed.length === 0 ? (
              <div className="flex-1 flex items-center justify-center p-8">
                <div className="w-full max-w-lg rounded-3xl border border-dashed border-border bg-card/80 p-8 text-center shadow-sm">
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-500">
                    <Lightning size={24} weight="duotone" />
                  </div>
                  <div className="mt-4">
                    <p className="text-base font-semibold">No flows yet</p>
                    <p className="mt-1 text-sm text-muted-foreground">Start with a linked app, choose what happens, then stack what-if branches under a framework.</p>
                  </div>
                  <div className="mt-5 flex items-center justify-center gap-2 text-xs text-muted-foreground">
                    <span className="rounded-full bg-muted px-2 py-1">Draft</span>
                    <span className="rounded-full bg-muted px-2 py-1">Run history</span>
                    <span className="rounded-full bg-muted px-2 py-1">Framework registry</span>
                  </div>
                  <Button size="sm" variant="outline" className="gap-1.5 mt-5" onClick={() => setShowAdd(true)}>
                    <Plus size={12} /> Build your first scenario
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex-1 min-h-0 overflow-y-auto p-5">
                <div className="grid gap-3 lg:grid-cols-3">
                  {[
                    { label: 'Active automations', value: activeCount, note: 'Currently armed and running.' },
                    { label: 'Manual utilities', value: manualCount, note: 'Can be launched on demand.' },
                    { label: 'Recent activity', value: recentRuns, note: 'Flows with run history recorded.' },
                  ].map(card => (
                    <div key={card.label} className="rounded-2xl border border-border bg-card px-4 py-3 shadow-sm">
                      <div className="text-base font-semibold text-foreground">{card.value}</div>
                      <div className="mt-0.5 text-sm font-medium text-foreground">{card.label}</div>
                      <div className="mt-1 text-xs text-muted-foreground">{card.note}</div>
                    </div>
                  ))}
                </div>

                <div className="mt-4 rounded-3xl border border-border bg-card p-3 shadow-sm">
                  <div className="mb-3 flex items-center justify-between px-2">
                    <div>
                      <div className="text-sm font-semibold text-foreground">Installed flows</div>
                      <div className="text-xs text-muted-foreground">Tune configuration, review run history, or pause automations without leaving the workspace.</div>
                    </div>
                    <div className="flex items-center gap-2 rounded-full bg-muted px-2.5 py-1 text-[11px] text-muted-foreground">
                      <ArrowsClockwise size={11} />
                      <span>{loadingRemote ? 'Syncing…' : remoteAvailable ? 'Civic-backed' : 'Workspace fallback'}</span>
                    </div>
                  </div>

                  <div className="flex flex-col gap-3">
                    {installed.map(flow => {
                      const recipe = RECIPES.find(item => item.id === flow.recipeId)
                      return (
                        <FlowCard
                          key={flow.id}
                          flow={flow}
                          recipe={recipe}
                          onDelete={() => { void deleteFlow(flow) }}
                          onToggle={() => { void toggleFlow(flow) }}
                          onUpdate={(cfg) => { void updateFlow(flow, cfg) }}
                          onRunNow={flow.status === 'active' ? () => runFlowNow(flow) : undefined}
                          onOpenRuns={() => { void openRunsDrawer(flow) }}
                        />
                      )
                    })}
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {selectedRunsFlow && (
        <div className="w-[360px] border-l border-border bg-background/95 p-4 shadow-xl">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">Run history</div>
              <div className="mt-1 text-sm font-semibold text-foreground">{selectedRunsFlow.name}</div>
              <div className="mt-1 text-xs text-muted-foreground">Last 10 runs with status and duration</div>
            </div>
            <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => setSelectedRunsFlow(null)} aria-label="Close runs drawer">
              <X size={14} />
            </Button>
          </div>

          <div className="mt-4 space-y-3">
            {runsLoading ? (
              <div className="text-sm text-muted-foreground">Loading runs…</div>
            ) : selectedRuns.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border px-4 py-6 text-sm text-muted-foreground">No run history yet.</div>
            ) : (
              selectedRuns.map(run => (
                <div key={run.id} className="rounded-2xl border border-border bg-card px-4 py-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium text-foreground">{run.status}</span>
                    <span className="text-xs text-muted-foreground">{formatDuration(run)}</span>
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">{new Date(run.started_at).toLocaleString()}</div>
                  {run.error && <div className="mt-2 text-xs text-destructive">{run.error}</div>}
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {showAdd && (
        <AddFlowModal
          installed={installed}
          onAdd={addFlow}
          onClose={() => setShowAdd(false)}
          persist={true}
          onPersisted={() => { void loadRemoteFlows() }}
        />
      )}
    </div>
  )
}
