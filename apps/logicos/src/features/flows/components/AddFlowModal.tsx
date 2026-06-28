import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  ArrowRight, ArrowsClockwise, CaretDown, Lightning, Plus, ShieldCheck, X,
} from '@phosphor-icons/react'
import type { Connection, FrameworkId, InstalledFlow, Recipe, ScenarioLogicStep } from '../types'
import { RECIPES } from '../data/recipes'
import { RecipeIcon } from './RecipeIcon'
import { RiskBadge } from './FlowCard'
import { ConfigForm } from './ConfigForm'
import {
  civicApi,
  type CivicFlowFramework,
  type CivicFlow,
  type CivicFlowScenario,
  type CivicFlowScenarioNode,
} from '@/features/civic/api/civicApi'

type LinkedApp = Connection | 'framework'

const FALLBACK_FRAMEWORKS: CivicFlowFramework[] = [
  {
    id: 'VAULTCLERK.PublicRecords',
    name: 'Public Records',
    chapter: 'c.66',
    primaryStatute: 'M.G.L. c.66 §10',
    domain: 'clerk',
    linkedApps: ['civicplus', 'google', 'microsoft', 'logicsuite'],
    routing: {},
    configured: false,
  },
]

const LINKED_APPS: Array<{
  id: LinkedApp
  label: string
  desc: string
}> = [
  { id: 'microsoft', label: 'Microsoft 365', desc: 'Outlook, calendar, SharePoint, Teams' },
  { id: 'google', label: 'Google', desc: 'Gmail, Calendar, Drive, Sheets' },
  { id: 'github', label: 'GitHub', desc: 'Repos, issues, PRs, releases' },
  { id: 'logicsuite', label: 'LogicSuite', desc: 'SEAL, ARCHIEVE, Syncronate, platform ops' },
  { id: 'civicplus', label: 'CivicPlus', desc: 'Public intake and civic workflows' },
  { id: 'framework', label: 'Framework-only', desc: 'Start from governance and framework utilities' },
]

function frameworkRisk(chapter?: string): 'low' | 'med' | 'high' {
  if (!chapter) return 'low'
  if (chapter === 'c.268A' || chapter === '2 CFR 200') return 'high'
  if (chapter.startsWith('c.30')) return 'med'
  return 'low'
}

function frameworkById(frameworks: CivicFlowFramework[], id: FrameworkId) {
  return frameworks.find(item => item.id === id) ?? frameworks[0]
}

function newLogicStep(kind: ScenarioLogicStep['kind'], seed = ''): ScenarioLogicStep {
  return {
    id: crypto.randomUUID(),
    kind,
    title: kind === 'if' ? (seed || 'Condition') : (seed || 'Action'),
    detail: '',
  }
}

function suggestedLogicSteps(frameworkId: FrameworkId, recipe: Recipe): ScenarioLogicStep[] {
  if (frameworkId === 'VAULTCLERK.BoardCompliance') {
    return [
      {
        id: crypto.randomUUID(),
        kind: 'if',
        title: 'If a board ethics check is required',
        detail: 'Route the branch into human review before publishing.',
        humanReview: true,
      },
      {
        id: crypto.randomUUID(),
        kind: 'then',
        title: 'Then write the compliance note',
        detail: 'Record the attestation and chapter citation in the run trail.',
      },
    ]
  }

  if (frameworkId === 'VAULTFISCAL.Procurement') {
    return [
      {
        id: crypto.randomUUID(),
        kind: 'if',
        title: 'If procurement review is required',
        detail: `Pause after "${recipe.trigger}" and route to the procurement authority.`,
      },
      {
        id: crypto.randomUUID(),
        kind: 'then',
        title: 'Then escalate on delay',
        detail: 'Notify the fallback authority when approval is still pending.',
      },
    ]
  }

  return [
    {
      id: crypto.randomUUID(),
      kind: 'if',
      title: 'If the record is high risk',
      detail: 'Add attestation before continuing the scenario.',
    },
    {
      id: crypto.randomUUID(),
      kind: 'then',
      title: 'Then capture evidence',
      detail: `Write the outcome back after "${recipe.action}" completes.`,
    },
  ]
}

function buildScenarioGraph(recipe: Recipe, logicSteps: ScenarioLogicStep[]): CivicFlowScenario {
  const nodes: CivicFlowScenarioNode[] = [
    {
      id: 'base-action',
      kind: 'action',
      title: recipe.action,
      detail: `When ${recipe.trigger}`,
      next: logicSteps[0]?.id ?? null,
    },
  ]

  logicSteps.forEach((logicStep, index) => {
    const nextId = logicSteps[index + 1]?.id ?? null
    const humanReview = logicStep.humanReview || /human review|review/i.test(`${logicStep.title} ${logicStep.detail}`)

    if (logicStep.kind === 'if') {
      nodes.push({
        id: logicStep.id,
        kind: 'condition',
        title: logicStep.title.trim(),
        detail: logicStep.detail.trim(),
        next: nextId,
        onTrue: nextId,
        onFalse: null,
      })
      return
    }

    nodes.push({
      id: logicStep.id,
      kind: humanReview ? 'review_gate' : 'action',
      title: logicStep.title.trim(),
      detail: logicStep.detail.trim(),
      next: nextId,
      humanReview,
    })
  })

  return {
    version: 1,
    rootId: 'base-action',
    nodes,
  }
}

function mapCreatedFlow(
  recipe: Recipe,
  framework: CivicFlowFramework,
  flow: CivicFlow,
  logicSteps: ScenarioLogicStep[],
): InstalledFlow {
  return {
    id: flow.id,
    recipeId: String(flow.trigger_spec.recipeId ?? recipe.id),
    name: flow.name,
    trigger: String(flow.trigger_spec.label ?? recipe.trigger),
    triggerType: recipe.triggerType,
    action: recipe.action,
    config: (flow.trigger_spec.config as Record<string, string> | undefined) ?? {},
    connection: flow.linked_app as Connection,
    frameworkId: flow.framework_id,
    frameworkLabel: framework.name,
    frameworkChapter: framework.chapter,
    backendTriggerSpec: flow.trigger_spec,
    backendScenario: flow.scenario,
    logicSteps,
    enabled: flow.status === 'active',
    status: flow.status,
    installedAt: new Date(flow.created_at).getTime(),
    lastRun: flow.last_run_at ? new Date(flow.last_run_at).getTime() : undefined,
    lastStatus: flow.last_run_status === 'failed' ? 'error' : flow.last_run_status ? 'success' : undefined,
    runCount: 0,
    canRunNow: flow.status === 'active',
  }
}

export function AddFlowModal({ installed, onAdd, onClose, persist = false, onPersisted }: {
  installed: InstalledFlow[]
  onAdd: (flow: InstalledFlow) => void
  onClose: () => void
  persist?: boolean
  onPersisted?: () => void
}) {
  const [step, setStep] = useState<'link' | 'pick' | 'build'>('link')
  const [linkedApp, setLinkedApp] = useState<LinkedApp | null>(null)
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null)
  const [frameworkId, setFrameworkId] = useState<FrameworkId>(FALLBACK_FRAMEWORKS[0]?.id ?? '')
  const [cfg, setCfg] = useState<Record<string, string>>({})
  const [logicSteps, setLogicSteps] = useState<ScenarioLogicStep[]>([])
  const [saving, setSaving] = useState(false)
  const [frameworks, setFrameworks] = useState<CivicFlowFramework[]>(FALLBACK_FRAMEWORKS)
  const [frameworksLoading, setFrameworksLoading] = useState(false)
  const [frameworksError, setFrameworksError] = useState<string | null>(null)

  const framework = frameworkById(frameworks, frameworkId)

  useEffect(() => {
    if (!persist) return

    let alive = true
    setFrameworksLoading(true)
    setFrameworksError(null)

    ;(async () => {
      try {
        const me = await civicApi.me()
        const cacheKey = `civic-flow-frameworks:${me.actor.town_id ?? me.actor.object_id}`
        const cached = sessionStorage.getItem(cacheKey)
        if (alive && cached) {
          const parsed = JSON.parse(cached) as CivicFlowFramework[]
          if (parsed.length > 0) {
            setFrameworks(parsed)
            setFrameworkId(current => parsed.some(item => item.id === current) ? current : parsed[0].id)
          }
        }

        const response = await civicApi.flows.frameworks()
        if (!alive) return
        if (response.frameworks.length === 0) {
          setFrameworks([])
          setFrameworksError('No frameworks are available for this org yet. Configure the VAULT registry before saving a flow.')
          return
        }

        sessionStorage.setItem(cacheKey, JSON.stringify(response.frameworks))
        setFrameworks(response.frameworks)
        setFrameworkId(current => response.frameworks.some(item => item.id === current) ? current : response.frameworks[0].id)
      } catch {
        if (!alive) return
        setFrameworks([])
        setFrameworksError('The VAULT framework registry is unavailable. Saving is disabled until the registry can be reached.')
      } finally {
        if (alive) setFrameworksLoading(false)
      }
    })()

    return () => { alive = false }
  }, [persist])

  const available = useMemo(() => {
    const installedIds = new Set(installed.map(flow => flow.recipeId))
    return RECIPES
      .filter(recipe => !installedIds.has(recipe.id))
      .filter(recipe => {
        if (!linkedApp) return false
        if (linkedApp === 'framework') return !recipe.connection
        return recipe.connection === linkedApp
      })
  }, [installed, linkedApp])

  function handleLinkPick(nextLinkedApp: LinkedApp) {
    setLinkedApp(nextLinkedApp)
    setSelectedRecipe(null)
    setCfg({})
    setLogicSteps([])
    setStep('pick')
  }

  function handleRecipePick(recipe: Recipe) {
    setSelectedRecipe(recipe)
    setCfg({})
    setLogicSteps(suggestedLogicSteps(frameworkId, recipe))
    setStep('build')
  }

  function updateLogicStep(id: string, patch: Partial<ScenarioLogicStep>) {
    setLogicSteps(current => current.map(item => item.id === id ? { ...item, ...patch } : item))
  }

  function removeLogicStep(id: string) {
    setLogicSteps(current => current.filter(item => item.id !== id))
  }

  async function enable() {
    if (!selectedRecipe || !framework) return

    setSaving(true)
    try {
      const trimmedLogicSteps = logicSteps
        .map(item => ({
          ...item,
          title: item.title.trim(),
          detail: item.detail.trim(),
        }))
        .filter(item => item.title || item.detail)

      if (persist) {
        if (frameworksError) {
          throw new Error(frameworksError)
        }
        if (!frameworks.some(item => item.id === frameworkId)) {
          throw new Error('Selected framework is no longer available for this org.')
        }

        const created = await civicApi.flows.create({
          name: selectedRecipe.name,
          linked_app: selectedRecipe.connection ?? linkedApp ?? 'logicsuite',
          framework_id: frameworkId,
          trigger_spec: {
            type: selectedRecipe.triggerType,
            eventType: selectedRecipe.triggerType,
            label: selectedRecipe.trigger,
            recipeId: selectedRecipe.id,
            config: cfg,
          },
          scenario: buildScenarioGraph(selectedRecipe, trimmedLogicSteps),
          status: 'draft',
        })

        onAdd(mapCreatedFlow(selectedRecipe, framework, created, trimmedLogicSteps))
        onPersisted?.()
        toast.success(`${selectedRecipe.name} saved to Civic Flows`)
      } else {
        onAdd({
          id: crypto.randomUUID(),
          recipeId: selectedRecipe.id,
          name: selectedRecipe.name,
          trigger: selectedRecipe.trigger,
          triggerType: selectedRecipe.triggerType,
          action: selectedRecipe.action,
          config: cfg,
          connection: selectedRecipe.connection,
          frameworkId,
          frameworkLabel: framework.name,
          frameworkChapter: framework.chapter,
          logicSteps: trimmedLogicSteps,
          enabled: true,
          status: 'active',
          installedAt: Date.now(),
          runCount: 0,
          canRunNow: selectedRecipe.canRunNow,
        })
        toast.success(`${selectedRecipe.name} added as a scenario`)
      }

      onClose()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not save scenario')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="flex max-h-[88vh] w-[920px] max-w-full flex-col overflow-hidden rounded-3xl border border-border bg-background shadow-xl"
        onClick={event => event.stopPropagation()}
      >
        <div className="border-b border-border px-6 py-5">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              {step !== 'link' && (
                <Button size="sm" variant="ghost" className="h-8 px-2 text-xs gap-1" onClick={() => setStep(step === 'build' ? 'pick' : 'link')}>
                  <ArrowsClockwise size={11} /> Back
                </Button>
              )}
              <div>
                <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-muted-foreground">Scenario builder</div>
                <div className="mt-1 text-lg font-semibold text-foreground">
                  {step === 'link' ? 'Pick your linked app' : step === 'pick' ? 'Choose what happens' : 'Build the logic lane'}
                </div>
                <div className="mt-1 text-sm text-muted-foreground">
                  {step === 'link'
                    ? 'Start from the connected system you want to automate.'
                    : step === 'pick'
                      ? 'Choose the base recipe that anchors the scenario.'
                      : 'Layer in frameworks, what-if branches, and follow-on actions.'}
                </div>
              </div>
            </div>
            <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={onClose} aria-label="Close">
              <X size={14} />
            </Button>
          </div>
        </div>

        <div className="grid min-h-0 flex-1 grid-cols-1 xl:grid-cols-[260px,1fr]">
          <aside className="border-r border-border bg-card/60 p-5">
            <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">Build path</div>
            <div className="mt-4 flex flex-col gap-3">
              {[
                { id: 'link', label: '1. Linked app', value: linkedApp ? LINKED_APPS.find(item => item.id === linkedApp)?.label : 'Pick one' },
                { id: 'pick', label: '2. Base recipe', value: selectedRecipe?.name ?? 'Choose what happens' },
                { id: 'build', label: '3. Framework logic', value: framework?.name ?? 'Choose a framework' },
              ].map(item => (
                <div
                  key={item.id}
                  className={`rounded-2xl border px-4 py-3 ${step === item.id ? 'border-primary/30 bg-primary/10' : 'border-border bg-background/70'}`}
                >
                  <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">{item.label}</div>
                  <div className="mt-1 text-sm font-medium text-foreground">{item.value}</div>
                </div>
              ))}
            </div>

            <div className="mt-5 rounded-2xl border border-border bg-background/70 p-4">
              <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
                <ShieldCheck size={12} />
                Framework
              </div>
              <div className="mt-2 text-sm font-medium text-foreground">{framework?.name ?? 'Framework unavailable'}</div>
              <div className="mt-1 text-xs text-muted-foreground">{framework?.primaryStatute ?? 'Load a VAULT framework to continue'}</div>
              <div className="mt-3 flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Risk</span>
                <RiskBadge level={frameworkRisk(framework?.chapter)} />
                {framework?.chapter && (
                  <span className="rounded-full border border-amber-300/40 bg-amber-500/10 px-2 py-0.5 text-[10px] font-mono text-amber-700 dark:text-amber-300">
                    {framework.chapter}
                  </span>
                )}
              </div>
            </div>
          </aside>

          <div className="min-h-0 overflow-y-auto p-6">
            {step === 'link' && (
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {LINKED_APPS.map(app => (
                  <button
                    key={app.id}
                    onClick={() => handleLinkPick(app.id)}
                    className="rounded-2xl border border-border bg-card p-4 text-left transition-colors hover:bg-muted/30 hover:border-primary/20"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted/60">
                        <RecipeIcon connection={app.id === 'framework' ? undefined : app.id} size={18} />
                      </div>
                      <div>
                        <div className="text-sm font-medium text-foreground">{app.label}</div>
                        <div className="mt-1 text-xs text-muted-foreground">{app.desc}</div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {step === 'pick' && (
              <div className="flex flex-col gap-3">
                <div className="rounded-2xl border border-border bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
                  Showing recipes for <span className="font-medium text-foreground">{LINKED_APPS.find(item => item.id === linkedApp)?.label}</span>
                </div>

                {available.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-border px-6 py-10 text-center">
                    <div className="text-sm font-medium text-foreground">No recipes available</div>
                    <div className="mt-1 text-xs text-muted-foreground">Everything in this lane is already installed, or this connection does not have recipes yet.</div>
                  </div>
                ) : (
                  <div className="grid gap-3">
                    {available.map(recipe => (
                      <button
                        key={recipe.id}
                        onClick={() => handleRecipePick(recipe)}
                        className="flex items-center gap-4 rounded-2xl border border-border bg-card px-4 py-4 text-left transition-colors hover:bg-muted/30 hover:border-primary/20"
                      >
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted/60">
                          <RecipeIcon connection={recipe.connection} id={recipe.id} size={18} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-medium text-foreground">{recipe.name}</span>
                            {recipe.canRunNow && (
                              <span className="rounded-full border border-border bg-muted px-2 py-0.5 text-[10px] font-mono text-muted-foreground">manual</span>
                            )}
                          </div>
                          <div className="mt-1 flex items-center gap-1.5 text-[11px] font-mono text-muted-foreground">
                            <span>{recipe.trigger}</span>
                            <ArrowRight size={10} />
                            <span>{recipe.action}</span>
                          </div>
                        </div>
                        <CaretDown size={12} className="shrink-0 rotate-[-90deg] text-muted-foreground" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {step === 'build' && selectedRecipe && (
              <div className="flex flex-col gap-5">
                <div className="grid gap-4 xl:grid-cols-[1.4fr,1fr]">
                  <div className="rounded-3xl border border-border bg-card p-4">
                    <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">Scenario path</div>
                    <div className="mt-4 flex flex-wrap items-center gap-2">
                      <span className="rounded-2xl border border-border bg-background px-3 py-2 text-sm text-foreground">
                        {LINKED_APPS.find(item => item.id === linkedApp)?.label}
                      </span>
                      <ArrowRight size={12} className="text-muted-foreground" />
                      <span className="rounded-2xl border border-border bg-background px-3 py-2 text-sm text-foreground">
                        When {selectedRecipe.trigger}
                      </span>
                      <ArrowRight size={12} className="text-muted-foreground" />
                      <span className="rounded-2xl border border-primary/20 bg-primary/10 px-3 py-2 text-sm text-foreground">
                        Then {selectedRecipe.action}
                      </span>
                      <ArrowRight size={12} className="text-muted-foreground" />
                      <span className="rounded-2xl border border-amber-400/30 bg-amber-500/10 px-3 py-2 text-sm text-foreground">
                        Framework {framework?.name ?? 'Unassigned'}
                      </span>
                    </div>
                  </div>

                  <div className="rounded-3xl border border-border bg-card p-4">
                    <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">Framework effects</div>
                    {framework ? (
                      <div className="mt-3 space-y-2">
                        {[
                          `${framework.chapter} controls stay visible on the card and run trail.`,
                          Object.keys(framework.routing ?? {}).length > 0
                            ? `Org Manager will resolve ${Object.keys(framework.routing).length} routing slot(s) at runtime.`
                            : 'Org Manager routing will resolve at runtime when the module is configured.',
                          framework.configured
                            ? 'This framework is already configured for the current org.'
                            : 'This framework is not fully configured yet; execution may surface unresolved routing.',
                        ].map(impact => (
                          <div key={impact} className="flex gap-2 text-xs text-muted-foreground">
                            <span className="text-primary">•</span>
                            <span>{impact}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="mt-3 text-xs text-muted-foreground">No policy layer will be added to this scenario.</div>
                    )}
                  </div>
                </div>

                <div className="rounded-3xl border border-border bg-card p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">Framework selector</div>
                      <div className="mt-1 text-sm text-muted-foreground">Choose the framework that should govern this scenario.</div>
                    </div>
                    <div className="w-full max-w-sm">
                      <select
                        value={frameworkId}
                        onChange={event => {
                          const nextId = event.target.value as FrameworkId
                          setFrameworkId(nextId)
                          if (selectedRecipe) setLogicSteps(suggestedLogicSteps(nextId, selectedRecipe))
                        }}
                        className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground"
                      >
                        {frameworks.map(item => (
                          <option key={item.id} value={item.id}>{item.name} — {item.chapter}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  {persist && frameworksLoading && (
                    <div className="mt-3 text-xs text-muted-foreground">Loading VAULT framework registry…</div>
                  )}
                  {persist && frameworksError && (
                    <div className="mt-3 rounded-2xl border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
                      {frameworksError}
                    </div>
                  )}
                </div>

                {selectedRecipe.configFields.length > 0 && (
                  <div className="rounded-3xl border border-border bg-card p-4">
                    <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">Base recipe config</div>
                    <div className="mt-1 text-sm text-muted-foreground">Set the inputs for the linked trigger/action pair.</div>
                    <div className="mt-4">
                      <ConfigForm fields={selectedRecipe.configFields} values={cfg} onChange={(key, value) => setCfg(prev => ({ ...prev, [key]: value }))} />
                    </div>
                  </div>
                )}

                <div className="rounded-3xl border border-border bg-card p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">What if / then logic</div>
                      <div className="mt-1 text-sm text-muted-foreground">Add branch points the way you think through a Make scenario, but keep the framework attached.</div>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setLogicSteps(current => [...current, newLogicStep('if')])}>
                        <Plus size={12} /> What if
                      </Button>
                      <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setLogicSteps(current => [...current, newLogicStep('then')])}>
                        <Plus size={12} /> Then
                      </Button>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-col gap-3">
                    {logicSteps.map((logicStep, index) => (
                      <div key={logicStep.id} className="rounded-2xl border border-border bg-background p-4">
                        <div className="flex items-center gap-2">
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-mono uppercase ${
                            logicStep.kind === 'if'
                              ? 'bg-amber-500/10 text-amber-600 dark:text-amber-300'
                              : 'bg-blue-500/10 text-blue-600 dark:text-blue-300'
                          }`}>
                            {logicStep.kind === 'if' ? `What if ${index + 1}` : `Then ${index + 1}`}
                          </span>
                          <button onClick={() => removeLogicStep(logicStep.id)} className="ml-auto text-xs text-muted-foreground hover:text-destructive">
                            Remove
                          </button>
                        </div>

                        <div className="mt-3 grid gap-3 lg:grid-cols-2">
                          <div>
                            <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-muted-foreground">
                              {logicStep.kind === 'if' ? 'Condition' : 'Step'}
                            </label>
                            <Input
                              value={logicStep.title}
                              onChange={event => updateLogicStep(logicStep.id, { title: event.target.value })}
                              placeholder={logicStep.kind === 'if' ? 'If the request is sensitive...' : 'Then notify the owner...'}
                              className="h-9 text-sm"
                            />
                          </div>
                          <div>
                            <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-muted-foreground">Outcome</label>
                            <textarea
                              value={logicStep.detail}
                              onChange={event => updateLogicStep(logicStep.id, { detail: event.target.value })}
                              rows={3}
                              placeholder="Describe the branch action, fallback, or governance effect..."
                              className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground"
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {step === 'build' && selectedRecipe && (
          <div className="flex gap-2 border-t border-border px-6 py-4">
            <Button variant="outline" className="flex-1 text-sm" onClick={onClose}>Cancel</Button>
            <Button
              className="flex-[2] gap-1.5 text-sm"
              disabled={saving || (persist && (frameworksLoading || !!frameworksError || !framework))}
              onClick={enable}
            >
              <Lightning size={12} />
              {saving ? 'Building scenario…' : persist ? 'Save scenario' : 'Add scenario'}
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
