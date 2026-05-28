import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  ClipboardText,
  Database,
  DownloadSimple,
  Files,
  FlowArrow,
  ShieldCheck,
  Sparkle,
} from '@phosphor-icons/react'
import type { Municipality } from '@/data/maMunicipalities'
import type {
  DemoModule,
  TrialApp,
  DemoArtifact,
  LiveTownData,
  DemoTownTab,
  VaultBuildTemplate,
  DataSource,
} from '../demo/townCaseDemoData'
import {
  LIFECYCLE_STAGES,
  TRIAL_COMMAND_CARDS,
  DEMO_MODULES,
  TRIAL_APPS,
  DATA_SOURCES,
} from '../demo/townCaseDemoData'
import {
  formatCurrency,
  formatPopulation,
  mapTemplateIdToModuleId,
  getMunicipalityProfile,
} from '../demo/townCaseDemoUtils'

interface DemoDashboardSectionProps {
  townName: string
  municipalityName: string
  setMunicipalityName: (name: string) => void
  filteredMunicipalities: Municipality[]
  selectedMunicipality: Municipality | null | undefined
  onSelectTownCode?: (code: number) => void
  liveTownData: LiveTownData | null
  loadingTownData: boolean
  townDataError: string | null
  livePressureAreas: string[]
  priorityTemplates: VaultBuildTemplate[]
  lifecycleStageIndex: number
  setLifecycleStageIndex: (index: number) => void
  selectedModule: DemoModule
  selectedTemplate: VaultBuildTemplate
  selectedApp: TrialApp
  filteredTemplates: VaultBuildTemplate[]
  moduleQuery: string
  setModuleQuery: (q: string) => void
  municipalityProfile: ReturnType<typeof getMunicipalityProfile>
  projectedVolume: string
  activeSourceIds: string[]
  onToggleSource: (sourceId: string) => void
  activeSources: DataSource[]
  busyAction: string | null
  onProvisionEnvironmentPack: () => void
  onAddEnvironmentPackToWorkspace: () => void
  onDownloadPacket: () => void
  onSendEnvironmentPacketToSelf: () => void
  onCopyWalkthrough: () => void
  onProvisionModulePack: () => void
  onAddModulePackToWorkspace: () => void
  onSendModuleSpecToSelf: () => void
  onProvisionAppPack: () => void
  onAddAppPackToWorkspace: () => void
  onSendAppSpecToSelf: () => void
  onPullTownData: () => void
  onOpenTab?: (tab: DemoTownTab) => void
  operatorEmail: string
  setSelectedTemplateId: (id: string) => void
  setSelectedModuleId: (id: string) => void
  setSelectedAppId: (id: string) => void
  environmentArtifacts: DemoArtifact[]
  appPreviewDoc: string
}

export function DemoDashboardSection({
  townName,
  municipalityName,
  setMunicipalityName,
  filteredMunicipalities,
  selectedMunicipality,
  onSelectTownCode,
  liveTownData,
  loadingTownData,
  townDataError,
  livePressureAreas,
  priorityTemplates,
  lifecycleStageIndex,
  setLifecycleStageIndex,
  selectedModule,
  selectedTemplate,
  selectedApp,
  filteredTemplates,
  moduleQuery,
  setModuleQuery,
  municipalityProfile,
  projectedVolume,
  activeSourceIds,
  onToggleSource,
  busyAction,
  onProvisionEnvironmentPack,
  onAddEnvironmentPackToWorkspace,
  onDownloadPacket,
  onSendEnvironmentPacketToSelf,
  onCopyWalkthrough,
  onProvisionModulePack,
  onAddModulePackToWorkspace,
  onSendModuleSpecToSelf,
  onProvisionAppPack,
  onAddAppPackToWorkspace,
  onSendAppSpecToSelf,
  onPullTownData,
  onOpenTab,
  operatorEmail,
  setSelectedTemplateId,
  setSelectedModuleId,
  setSelectedAppId,
  environmentArtifacts,
  appPreviewDoc,
}: DemoDashboardSectionProps) {
  const lifecycleStage = LIFECYCLE_STAGES[lifecycleStageIndex] ?? LIFECYCLE_STAGES[0]

  return (
    <div className="h-full min-h-0 overflow-y-auto bg-muted/10 text-foreground">
      <div className="mx-auto flex max-w-7xl flex-col gap-6 px-6 py-6">
        <section className="rounded-3xl border border-emerald-400/20 bg-card/95 p-6 shadow-[0_20px_60px_-30px_rgba(52,211,153,0.28)] backdrop-blur">
          <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
            <div>
              <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.24em] text-emerald-700 dark:text-emerald-300">
                <Database size={14} weight="fill" />
                Start with the town
              </div>
              <h1 className="text-3xl font-semibold tracking-tight text-foreground">Pull the public governance spine first</h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground">
                Choose a municipality, pull the most reliable public finance and personnel records, then move through the demo in order:
                town snapshot, LogicDASH, Module Maker, automations, and live connections. This is not a tech showcase. It is a governance
                framework at work.
              </p>

              <div className="mt-5 grid gap-3 md:grid-cols-[minmax(0,1fr)_auto]">
                <div>
                  <input
                    value={municipalityName}
                    onChange={(event) => setMunicipalityName(event.target.value)}
                    className="w-full rounded-2xl border border-border/80 bg-background/90 px-3 py-3 text-sm text-foreground outline-none"
                    placeholder="Start with Sutton, Worcester, Framingham, Salem..."
                  />
                  <div className="mt-2 flex flex-wrap gap-2">
                    {filteredMunicipalities.map(municipality => (
                      <button
                        key={municipality.dor_code}
                        type="button"
                        onClick={() => {
                          setMunicipalityName(municipality.name)
                          onSelectTownCode?.(municipality.dor_code)
                        }}
                        className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                          selectedMunicipality?.dor_code === municipality.dor_code
                            ? 'border-emerald-300/40 bg-emerald-300/15 text-emerald-700 dark:text-emerald-100'
                            : 'border-border/80 bg-card/95 text-muted-foreground hover:border-border'
                        }`}
                      >
                        {municipality.name}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <Button onClick={onPullTownData} disabled={loadingTownData || !selectedMunicipality} className="gap-2">
                    <Database size={16} />
                    {loadingTownData ? 'Pulling town data…' : 'Pull live town data'}
                  </Button>
                  <Button variant="secondary" className="gap-2" onClick={() => onOpenTab?.('dashboard')}>
                    <Files size={16} />
                    Open LogicDASH
                  </Button>
                </div>
              </div>

              <div className="mt-5 flex flex-wrap gap-2">
                {['1. Town Demo', '2. LogicDASH', '3. Module Maker', '4. Automations', '5. Connections'].map(step => (
                  <div key={step} className="rounded-full border border-border/80 bg-card/95 px-3 py-1.5 text-[11px] font-medium text-foreground">
                    {step}
                  </div>
                ))}
              </div>

              {townDataError && (
                <div className="mt-4 rounded-2xl border border-rose-300/20 bg-rose-300/10 px-4 py-3 text-sm text-rose-700 dark:text-rose-100">
                  {townDataError}
                </div>
              )}
            </div>

            <div className="space-y-3">
              <div className="rounded-2xl border border-border/80 bg-card/95 p-4">
                <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Reliable public pulls used here</div>
                <div className="mt-3 space-y-2 text-sm text-muted-foreground">
                  <div className="rounded-xl border border-border/80 bg-muted/25 px-3 py-2">DLS community snapshot for budget, levy, state aid, debt, and reserves</div>
                  <div className="rounded-xl border border-border/80 bg-muted/25 px-3 py-2">DLS personnel expenditures for employee count and total salaries</div>
                  <div className="rounded-xl border border-border/80 bg-muted/25 px-3 py-2">Municipality master list for county, DOR code, and population</div>
                </div>
              </div>
              <div className="rounded-2xl border border-border/80 bg-card/95 p-4">
                <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">What happens next</div>
                <div className="mt-3 space-y-2 text-sm text-muted-foreground">
                  <div className="rounded-xl border border-border/80 bg-muted/25 px-3 py-2">Show the pressure in plain language</div>
                  <div className="rounded-xl border border-border/80 bg-muted/25 px-3 py-2">Open the first governed lane one click away</div>
                  <div className="rounded-xl border border-border/80 bg-muted/25 px-3 py-2">Carry the same town into automation and connection setup</div>
                  <div className="rounded-xl border border-border/80 bg-muted/25 px-3 py-2">Use the governance tab to open policy pages, law, legislators, and CivicPlus-style meeting trails without breaking context</div>
                </div>
              </div>
            </div>
          </div>

          {liveTownData && (
            <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
              <div className="rounded-2xl border border-border/80 bg-card/95 p-4">
                <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Operating budget</div>
                <div className="mt-2 text-2xl font-semibold text-foreground">{formatCurrency(liveTownData.metrics.operatingBudget)}</div>
                <div className="mt-1 text-xs text-muted-foreground">FY{liveTownData.fiscalYear} DLS community snapshot</div>
              </div>
              <div className="rounded-2xl border border-border/80 bg-card/95 p-4">
                <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Employees</div>
                <div className="mt-2 text-2xl font-semibold text-foreground">{liveTownData.metrics.totalEmployees?.toLocaleString() ?? '—'}</div>
                <div className="mt-1 text-xs text-muted-foreground">Total town employees in DLS personnel report</div>
              </div>
              <div className="rounded-2xl border border-border/80 bg-card/95 p-4">
                <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Total salaries</div>
                <div className="mt-2 text-2xl font-semibold text-foreground">{formatCurrency(liveTownData.metrics.totalSalariesWages)}</div>
                <div className="mt-1 text-xs text-muted-foreground">{liveTownData.metrics.salariesPctBudget !== null ? `${liveTownData.metrics.salariesPctBudget.toFixed(1)}% of budget` : 'Share of budget unavailable'}</div>
              </div>
              <div className="rounded-2xl border border-border/80 bg-card/95 p-4">
                <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Free cash</div>
                <div className="mt-2 text-2xl font-semibold text-foreground">{formatCurrency(liveTownData.metrics.certifiedFreeCash)}</div>
                <div className="mt-1 text-xs text-muted-foreground">{liveTownData.metrics.freeCashPctBudget !== null ? `${liveTownData.metrics.freeCashPctBudget.toFixed(1)}% of budget` : 'Published when certified'}</div>
              </div>
              <div className="rounded-2xl border border-border/80 bg-card/95 p-4">
                <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Immediate pressure</div>
                <div className="mt-2 text-sm font-medium text-foreground">{livePressureAreas[0] ?? 'No acute warning from current public pull'}</div>
                <div className="mt-2 text-xs text-muted-foreground">Pulled {new Date(liveTownData.computedAt).toLocaleDateString()}</div>
              </div>
            </div>
          )}

          {liveTownData && (
            <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_auto]">
              <div className="rounded-2xl border border-border/80 bg-card/95 p-4">
                <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Quiet recommendations from the pulled town data</div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {priorityTemplates.map(template => (
                    <Badge key={template.id} variant="secondary" className="bg-muted/40 text-foreground">
                      {template.code} · {template.name}
                    </Badge>
                  ))}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button onClick={() => onOpenTab?.('maker')} className="gap-2">
                  <Files size={16} />
                  Open Module Maker
                </Button>
                <Button variant="secondary" onClick={() => onOpenTab?.('automations')} className="gap-2">
                  <FlowArrow size={16} />
                  Open Automations
                </Button>
                <Button variant="outline" className="gap-2 border-border/80 bg-transparent text-foreground hover:bg-muted/60 hover:text-foreground" onClick={() => onOpenTab?.('connections')}>
                  <Database size={16} />
                  Open Connections
                </Button>
              </div>
            </div>
          )}
        </section>

        <section className="rounded-3xl border border-amber-400/20 bg-card/95 p-6 shadow-[0_20px_60px_-30px_rgba(212,168,83,0.35)] backdrop-blur">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
            <div className="max-w-4xl">
              <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.24em] text-amber-700 dark:text-amber-300">
                <Sparkle size={14} weight="fill" />
                LogicOS governance framework
              </div>
              <h1 className="text-3xl font-semibold tracking-tight text-foreground">{townName}</h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground">
                Board packet tonight. Public-records deadline tomorrow. Payroll closes Friday. Quietly powerful is the point: one town, one operating
                surface, fewer silos.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                {['Work to shared files', 'Work to website', 'Work to finance systems', 'Work to town systems'].map(flow => (
                  <div key={flow} className="rounded-full border border-border/80 bg-card/95 px-3 py-1.5 text-[11px] font-medium text-foreground">
                    {flow}
                  </div>
                ))}
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-border/80 bg-card/95 p-4">
                <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Dash</div>
                <div className="mt-2 text-2xl font-semibold text-foreground">Live</div>
              </div>
              <div className="rounded-2xl border border-border/80 bg-card/95 p-4">
                <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Lanes</div>
                <div className="mt-2 text-2xl font-semibold text-foreground">{DEMO_MODULES.length}</div>
              </div>
              <div className="rounded-2xl border border-border/80 bg-card/95 p-4">
                <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Files</div>
                <div className="mt-2 text-2xl font-semibold text-foreground">{environmentArtifacts.length}</div>
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-4 xl:grid-cols-[1.35fr_0.65fr]">
          <div className="rounded-3xl border border-border/80 bg-card/95 p-5">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Showcase</div>
              </div>
              <Badge variant="secondary" className="bg-emerald-400/10 text-emerald-700 dark:text-emerald-100">Trial-ready</Badge>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              {TRIAL_COMMAND_CARDS.map(card => (
                <div key={card.id} className="rounded-3xl border border-border/80 bg-muted/25 p-4">
                  <div className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">{card.title}</div>
                  <div className="mt-3 text-2xl font-semibold text-foreground">{card.metric}</div>
                  <div className="mt-2 text-sm leading-6 text-muted-foreground">{card.detail}</div>
                  <div className="mt-3 rounded-2xl border border-border/80 bg-card/95 px-3 py-2 text-xs text-muted-foreground">
                    {card.note}
                  </div>
                </div>
              ))}
            </div>

          </div>

          <div className="space-y-4">
            <div className="rounded-3xl border border-border/80 bg-card/95 p-4">
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Fast actions</div>
              <div className="mt-3 grid gap-2">
                <Button className="justify-start gap-2" onClick={onProvisionAppPack} disabled={busyAction !== null}>
                  <Files size={16} />
                  {busyAction === 'provision-app' ? 'Routing app pack…' : 'Route app pack'}
                </Button>
                <Button variant="secondary" className="justify-start gap-2" onClick={onAddAppPackToWorkspace} disabled={busyAction !== null}>
                  <DownloadSimple size={16} />
                  {busyAction === 'workspace-app' ? 'Staging app pack…' : 'Stage in Workspace'}
                </Button>
                <Button variant="outline" className="justify-start gap-2 border-border/80 bg-transparent text-foreground hover:bg-muted/60 hover:text-foreground" onClick={onSendAppSpecToSelf} disabled={busyAction !== null}>
                  <ClipboardText size={16} />
                  {busyAction === 'send-app' ? 'Preparing app spec…' : 'Send app spec'}
                </Button>
              </div>
            </div>

            <div className="rounded-3xl border border-amber-300/20 bg-amber-300/10 p-4">
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-700 dark:text-amber-200">More</div>
              <div className="mt-3 grid gap-2">
                <Button className="justify-start gap-2" onClick={onProvisionEnvironmentPack} disabled={busyAction !== null}>
                  <Files size={16} />
                  {busyAction === 'provision-env' ? 'Staging showcase pack…' : 'Stage showcase pack'}
                </Button>
                <Button variant="secondary" className="justify-start gap-2" onClick={onAddModulePackToWorkspace} disabled={busyAction !== null}>
                  <DownloadSimple size={16} />
                  {busyAction === 'workspace-module' ? 'Staging module pack…' : 'Stage module pack'}
                </Button>
                <Button variant="outline" className="justify-start gap-2 border-border/80 bg-transparent text-foreground hover:bg-muted/60 hover:text-foreground" onClick={onSendEnvironmentPacketToSelf} disabled={busyAction !== null}>
                  <ClipboardText size={16} />
                  {busyAction === 'send-env' ? 'Preparing send flow…' : 'Send packet'}
                </Button>
              </div>
            </div>
          </div>
        </section>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
          <main className="space-y-4">
            <section className="rounded-3xl border border-border/80 bg-card/95 p-5">
              <div className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Apps</div>

              <div className="grid gap-5 lg:grid-cols-[320px_minmax(0,1fr)]">
                <div className="space-y-3">
                  {TRIAL_APPS.map(app => (
                    <button
                      key={app.id}
                      type="button"
                      onClick={() => setSelectedAppId(app.id)}
                      className={`w-full rounded-2xl border p-4 text-left transition ${
                        selectedApp.id === app.id
                          ? 'border-amber-300/40 bg-amber-300/10 text-foreground'
                          : 'border-border/80 bg-muted/25 text-muted-foreground hover:border-border'
                      }`}
                    >
                      <div className="text-sm font-medium">{app.name}</div>
                      <div className="mt-1 text-xs uppercase tracking-[0.16em] text-muted-foreground">{app.audience}</div>
                      <div className="mt-2 text-sm leading-6 text-muted-foreground">{app.summary}</div>
                    </button>
                  ))}
                </div>

                <div className="space-y-4">
                  <div className="rounded-2xl border border-border/80 bg-muted/25 p-3">
                    <iframe
                      srcDoc={appPreviewDoc}
                      title="Trial app preview"
                      className="h-[360px] w-full rounded-2xl border-0"
                      sandbox="allow-scripts"
                    />
                  </div>

                  <div className="grid gap-4 md:grid-cols-[1fr_0.9fr]">
                    <div className="rounded-2xl border border-border/80 bg-muted/25 p-4">
                      <div className="text-sm font-medium text-foreground">{selectedApp.name}</div>
                      <div className="mt-4 text-xs uppercase tracking-[0.16em] text-muted-foreground">Key fields held inside the app</div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {selectedApp.keyFields.map(field => (
                          <Badge key={field} variant="secondary" className="bg-muted/40 text-foreground">{field}</Badge>
                        ))}
                      </div>
                    </div>

                    <div className="rounded-2xl border border-border/80 bg-muted/25 p-4">
                      <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">App pack contents</div>
                      <div className="mt-3 space-y-2 text-sm text-muted-foreground">
                        <div className="rounded-xl border border-border/80 bg-muted/30 px-3 py-2">App spec JSON</div>
                        <div className="rounded-xl border border-border/80 bg-muted/30 px-3 py-2">Operator card</div>
                        <div className="rounded-xl border border-border/80 bg-muted/30 px-3 py-2">Embedded preview HTML</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            <div className="rounded-3xl border border-border/80 bg-card/95 p-5">
              <div className="flex flex-wrap gap-2">
                {LIFECYCLE_STAGES.map((stage, index) => (
                  <button
                    key={stage}
                    type="button"
                    onClick={() => setLifecycleStageIndex(index)}
                    className={`rounded-full border px-3 py-1.5 text-xs font-medium uppercase tracking-[0.16em] transition ${
                      lifecycleStageIndex === index
                        ? 'border-amber-300 bg-amber-300/15 text-amber-700 dark:text-amber-200'
                        : 'border-border/80 bg-card/95 text-muted-foreground hover:border-border hover:text-foreground'
                    }`}
                  >
                    {stage}
                  </button>
                ))}
              </div>
            </div>

            <section className="rounded-3xl border border-border/80 bg-card/95 p-6">
              <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                <div className="max-w-3xl">
                  <div className="mb-3 flex items-center gap-3">
                    <div
                      className="flex h-12 w-12 items-center justify-center rounded-2xl text-2xl"
                      style={{ backgroundColor: `${selectedModule.color}22`, color: selectedModule.color }}
                    >
                      {selectedModule.icon}
                    </div>
                    <div>
                      <h2 className="text-2xl font-semibold text-foreground">{selectedModule.label}</h2>
                      <p className="mt-1 text-sm text-muted-foreground">{selectedModule.desc}</p>
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-amber-300/20 bg-amber-300/10 p-4 lg:max-w-xs">
                  <div className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-700 dark:text-amber-200">Current stage</div>
                  <div className="mt-2 text-lg font-semibold text-foreground">{lifecycleStage}</div>
                </div>
              </div>

              <div className="mt-6 grid gap-4 md:grid-cols-2">
                {[
                  { title: 'Authority chain', items: selectedModule.authorityChain, icon: <FlowArrow size={16} className="text-amber-700 dark:text-amber-200" /> },
                  { title: 'Accountability triggers', items: selectedModule.accountabilityTriggers, icon: <ShieldCheck size={16} className="text-emerald-700 dark:text-emerald-200" /> },
                  { title: 'Boundary rules', items: selectedModule.boundaryRules, icon: <Files size={16} className="text-sky-200" /> },
                  { title: 'Continuity requirements', items: selectedModule.continuityRequirements, icon: <Database size={16} className="text-fuchsia-200" /> },
                ].map(section => (
                  <div key={section.title} className="rounded-2xl border border-border/80 bg-card/95 p-4">
                    <div className="mb-3 flex items-center gap-2 text-sm font-medium text-foreground">
                      {section.icon}
                      {section.title}
                    </div>
                    <div className="space-y-2 text-sm text-muted-foreground">
                      {section.items.map(item => (
                        <div key={item} className="rounded-xl border border-border/80 bg-muted/25 px-3 py-2">
                          {item}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-6 grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
                <div className="rounded-2xl border border-border/80 bg-card/95 p-4">
                  <div className="mb-3 text-sm font-medium text-foreground">Live case snapshots</div>
                  <div className="space-y-3">
                    {selectedModule.proofCases.map(caseItem => (
                      <div key={caseItem.id} className="rounded-2xl border border-border/80 bg-muted/25 p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="text-sm font-medium text-foreground">{caseItem.title}</div>
                            <div className="mt-1 text-xs uppercase tracking-[0.16em] text-muted-foreground">{caseItem.id}</div>
                          </div>
                          <Badge variant="secondary" className="bg-muted/40 text-foreground">{caseItem.status}</Badge>
                        </div>
                        <div className="mt-3 text-sm text-muted-foreground">{caseItem.note}</div>
                        <div className="mt-2 text-xs text-muted-foreground">Owner: {caseItem.owner}</div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="rounded-2xl border border-border/80 bg-card/95 p-4">
                    <div className="mb-3 text-sm font-medium text-foreground">LogicDASH signals</div>
                    <div className="grid gap-2">
                      <div className="rounded-xl border border-border/80 bg-muted/25 px-3 py-3 text-sm text-muted-foreground">
                        {selectedModule.metrics.records} governed records in the demo lane.
                      </div>
                      <div className="rounded-xl border border-border/80 bg-muted/25 px-3 py-3 text-sm text-muted-foreground">
                        {selectedModule.metrics.openItems} active items visible to leadership.
                      </div>
                      <div className="rounded-xl border border-border/80 bg-muted/25 px-3 py-3 text-sm text-muted-foreground">
                        {selectedModule.metrics.automations} automation hooks ready for rollout.
                      </div>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-border/80 bg-card/95 p-4">
                    <div className="mb-3 text-sm font-medium text-foreground">Risk flags</div>
                    <div className="space-y-2">
                      {selectedModule.riskFlags.map(flag => (
                        <div key={flag} className="rounded-xl border border-rose-300/10 bg-rose-300/10 px-3 py-2 text-sm text-rose-700 dark:text-rose-100">
                          {flag}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-border/80 bg-card/95 p-4">
                    <div className="mb-3 text-sm font-medium text-foreground">Automations that show the power</div>
                    <div className="flex flex-wrap gap-2">
                      {selectedModule.suggestedAutomations.map(automation => (
                        <Badge key={automation} variant="secondary" className="bg-cyan-400/10 text-cyan-700 dark:text-cyan-100">
                          {automation}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </section>

            <section className="rounded-3xl border border-border/80 bg-card/95 p-5">
              <div className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Apps + ModuleMaker</div>
              <div className="grid gap-5 lg:grid-cols-[340px_minmax(0,1fr)]">
                <div className="space-y-4">
                  <div className="rounded-2xl border border-border/80 bg-muted/25 p-4">
                    <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Municipality</div>
                    <input
                      value={municipalityName}
                      onChange={(event) => setMunicipalityName(event.target.value)}
                      className="mt-3 w-full rounded-2xl border border-border/80 bg-background/90 px-3 py-3 text-sm text-foreground outline-none"
                      placeholder="Start with Sutton, Worcester, Framingham, Salem..."
                    />
                    <div className="mt-2 text-xs text-muted-foreground">Build-ready for all 351 Massachusetts municipalities. The live environment later connects their own town data and files.</div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {filteredMunicipalities.map(municipality => (
                        <button
                          key={municipality.dor_code}
                          type="button"
                          onClick={() => setMunicipalityName(municipality.name)}
                          className={`rounded-full border px-3 py-1.5 text-xs transition ${
                            selectedMunicipality?.dor_code === municipality.dor_code
                              ? 'border-amber-300/40 bg-amber-300/10 text-amber-700 dark:text-amber-100'
                              : 'border-border/80 bg-card/95 text-muted-foreground hover:border-border'
                          }`}
                        >
                          {municipality.name}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-border/80 bg-muted/25 p-4">
                    <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Module catalog</div>
                    <input
                      value={moduleQuery}
                      onChange={(event) => setModuleQuery(event.target.value)}
                      className="mt-3 w-full rounded-2xl border border-border/80 bg-background/90 px-3 py-3 text-sm text-foreground outline-none"
                      placeholder="Search payroll, permitting, records, clerk..."
                    />
                    {priorityTemplates.length > 0 && (
                      <div className="mt-4">
                        <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Recommended starting modules</div>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {priorityTemplates.map(template => (
                            <button
                              key={template.id}
                              type="button"
                              onClick={() => {
                                setSelectedTemplateId(template.id)
                                setSelectedModuleId(mapTemplateIdToModuleId(template.id))
                              }}
                              className={`rounded-full border px-3 py-1.5 text-xs transition ${
                                selectedTemplate.id === template.id
                                  ? 'border-emerald-300/40 bg-emerald-300/10 text-emerald-700 dark:text-emerald-100'
                                  : 'border-border/80 bg-card/95 text-muted-foreground hover:border-border'
                              }`}
                            >
                              {template.code} · {template.name}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                    <div className="mt-3 space-y-2">
                      {filteredTemplates.map(template => (
                        <button
                          key={template.id}
                          type="button"
                          onClick={() => {
                            setSelectedTemplateId(template.id)
                            setSelectedModuleId(mapTemplateIdToModuleId(template.id))
                          }}
                          className={`w-full rounded-2xl border px-3 py-3 text-left transition ${
                            selectedTemplate.id === template.id
                              ? 'border-amber-300/40 bg-amber-300/10 text-foreground'
                              : 'border-border/80 bg-muted/25 text-muted-foreground hover:border-border'
                          }`}
                        >
                          <div className="text-sm font-medium">{template.name}</div>
                            <div className="mt-1 text-xs text-muted-foreground">{template.department} · {template.code}</div>
                          </button>
                        ))}
                      {filteredTemplates.length === 0 && (
                        <div className="rounded-2xl border border-dashed border-border/80 bg-muted/25 px-3 py-4 text-sm text-muted-foreground">
                          No module matched that search. Try a department name like `Finance`, `Clerk`, `Building`, or `Health`.
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="rounded-2xl border border-amber-300/20 bg-amber-300/10 p-4">
                    <div className="text-xs uppercase tracking-[0.16em] text-amber-700 dark:text-amber-200">Municipality profile</div>
                    <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                      <div className="rounded-xl border border-border/80 bg-muted/25 p-3">
                        <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Town</div>
                        <div className="mt-2 text-sm font-medium text-foreground">{(selectedMunicipality?.name ?? municipalityName) || 'Choose a municipality'}</div>
                      </div>
                      <div className="rounded-xl border border-border/80 bg-muted/25 p-3">
                        <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">County</div>
                        <div className="mt-2 text-sm font-medium text-foreground">{selectedMunicipality?.county ?? 'Pulled when a town is selected'}</div>
                      </div>
                      <div className="rounded-xl border border-border/80 bg-muted/25 p-3">
                        <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Population</div>
                        <div className="mt-2 text-sm font-medium text-foreground">{formatPopulation(selectedMunicipality?.population)}</div>
                      </div>
                      <div className="rounded-xl border border-border/80 bg-muted/25 p-3">
                        <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">DOR code</div>
                        <div className="mt-2 text-sm font-medium text-foreground">{selectedMunicipality?.dor_code ?? 'Will auto-fill'}</div>
                      </div>
                    </div>
                    <div className="mt-4 grid gap-4 md:grid-cols-[1.1fr_0.9fr]">
                      <div className="rounded-2xl border border-border/80 bg-muted/25 p-4">
                        <div className="text-sm font-medium text-foreground">{municipalityProfile.label}</div>
                        <div className="mt-2 text-sm leading-6 text-muted-foreground">{municipalityProfile.operatingShape}</div>
                        <div className="mt-4 text-xs uppercase tracking-[0.16em] text-muted-foreground">Likely first pressure areas</div>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {livePressureAreas.map(item => (
                            <Badge key={item} variant="secondary" className="bg-muted/40 text-foreground">{item}</Badge>
                          ))}
                        </div>
                      </div>
                      <div className="rounded-2xl border border-border/80 bg-muted/25 p-4">
                        <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Pack contents</div>
                        <div className="mt-3 space-y-2 text-sm text-muted-foreground">
                          {[
                            'Build spec JSON',
                            'Workflow stage map',
                            'FormKey schema',
                            'Training guide',
                            'Deployment checklist',
                            'Archive manifest',
                            'Quick reference card',
                            'Escalation playbook',
                          ].map(item => (
                            <div key={item} className="rounded-xl border border-border/80 bg-muted/30 px-3 py-2">
                              {item}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-border/80 bg-muted/25 p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="text-lg font-semibold text-foreground">{selectedTemplate.name}</div>
                        <div className="mt-1 text-sm text-muted-foreground">{selectedTemplate.summary}</div>
                      </div>
                      <Badge variant="secondary" className="bg-muted/40 text-foreground">{selectedTemplate.moduleId}</Badge>
                    </div>

                    <div className="mt-4 grid gap-3 md:grid-cols-3">
                      <div className="rounded-xl border border-border/80 bg-muted/30 p-3">
                        <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Authority</div>
                        <div className="mt-2 text-sm text-foreground">{selectedTemplate.statutoryAuthority}</div>
                      </div>
                      <div className="rounded-xl border border-border/80 bg-muted/30 p-3">
                        <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Deadline</div>
                        <div className="mt-2 text-sm text-foreground">{selectedTemplate.statutoryDeadline}</div>
                      </div>
                      <div className="rounded-xl border border-border/80 bg-muted/30 p-3">
                        <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Retention</div>
                        <div className="mt-2 text-sm text-foreground">{selectedTemplate.retentionCode} · {selectedTemplate.retentionDescription}</div>
                      </div>
                      <div className="rounded-xl border border-border/80 bg-muted/30 p-3">
                        <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Projected volume</div>
                        <div className="mt-2 text-sm text-foreground">{projectedVolume}</div>
                      </div>
                    </div>

                    <div className="mt-4 grid gap-4 md:grid-cols-2">
                      <div className="rounded-xl border border-border/80 bg-muted/30 p-4">
                        <div className="text-sm font-medium text-foreground">Workflow stages</div>
                        <div className="mt-3 space-y-2 text-sm text-muted-foreground">
                          {selectedTemplate.stages.map((stage, index) => (
                            <div key={stage} className="rounded-lg border border-border/80 bg-muted/25 px-3 py-2">
                              {index + 1}. {stage}
                            </div>
                          ))}
                        </div>
                      </div>
                      <div className="rounded-xl border border-border/80 bg-muted/30 p-4">
                        <div className="text-sm font-medium text-foreground">Key FormKey fields</div>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {selectedTemplate.keyFields.map(field => (
                            <Badge key={field} variant="secondary" className="bg-cyan-400/10 text-cyan-700 dark:text-cyan-100">
                              {field}
                            </Badge>
                          ))}
                        </div>
                        <div className="mt-4 text-sm font-medium text-foreground">Training focus</div>
                        <div className="mt-2 text-sm leading-6 text-muted-foreground">{selectedTemplate.trainingFocus}</div>
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-3 md:grid-cols-3">
                    <Button className="justify-start gap-2" onClick={onProvisionModulePack} disabled={busyAction !== null}>
                      <Files size={16} />
                      {busyAction === 'provision-module' ? 'Building module pack…' : 'Build ModuleMaker pack'}
                    </Button>
                    <Button variant="secondary" className="justify-start gap-2" onClick={onAddModulePackToWorkspace} disabled={busyAction !== null}>
                      <DownloadSimple size={16} />
                      {busyAction === 'workspace-module' ? 'Saving module pack…' : 'Save + download module pack'}
                    </Button>
                    <Button variant="outline" className="justify-start gap-2 border-border/80 bg-transparent text-foreground hover:bg-muted/60 hover:text-foreground" onClick={onSendModuleSpecToSelf} disabled={busyAction !== null}>
                      <ClipboardText size={16} />
                      {busyAction === 'send-module' ? 'Preparing send flow…' : `Send build spec to ${operatorEmail}`}
                    </Button>
                  </div>
                </div>
              </div>
            </section>
          </main>

          <aside className="space-y-4">
            <div className="rounded-3xl border border-border/80 bg-card/95 p-4">
              <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                <Database size={14} />
                Sources and live connection path
              </div>
              <div className="space-y-2">
                {DATA_SOURCES.map(source => {
                  const active = activeSourceIds.includes(source.id)
                  return (
                    <button
                      key={source.id}
                      type="button"
                      onClick={() => onToggleSource(source.id)}
                      className={`w-full rounded-2xl border px-3 py-3 text-left transition ${
                        active
                          ? 'border-amber-300/30 bg-amber-300/10 text-foreground'
                          : 'border-border/80 bg-muted/25 text-muted-foreground hover:border-border'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3">
                          <span className="mt-0.5 text-lg">{source.icon}</span>
                          <div>
                            <div className="text-sm font-medium">{source.label}</div>
                            <div className="mt-1 text-xs uppercase tracking-[0.16em] text-muted-foreground">
                              {source.category} · {source.status === 'demo-ready' ? 'shown in demo' : 'connects live'}
                            </div>
                            <div className="mt-2 text-xs leading-5 text-muted-foreground">{source.summary}</div>
                            <div className="mt-2 text-xs leading-5 text-muted-foreground">{source.liveNote}</div>
                          </div>
                        </div>
                        <div className={`mt-1 h-2.5 w-2.5 rounded-full ${active ? 'bg-emerald-400' : 'bg-border'}`} />
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="rounded-3xl border border-border/80 bg-card/95 p-4">
              <div className="mb-3 text-sm font-medium text-foreground">Flow paths</div>
              <div className="space-y-3 text-sm text-muted-foreground">
                <div className="rounded-2xl border border-border/80 bg-muted/25 p-3">
                  Governed work to shared files
                </div>
                <div className="rounded-2xl border border-border/80 bg-muted/25 p-3">
                  Governed work to website / outbound packet
                </div>
                <div className="rounded-2xl border border-border/80 bg-muted/25 p-3">
                  Governed work to archive / finance / civic systems
                </div>
              </div>
            </div>

            <div className="rounded-3xl border border-border/80 bg-card/95 p-4">
              <div className="mb-3 text-sm font-medium text-foreground">Environment actions</div>
              <div className="space-y-2">
                <Button className="w-full justify-start gap-2" onClick={onProvisionEnvironmentPack} disabled={busyAction !== null}>
                  <Files size={16} />
                  {busyAction === 'provision-env' ? 'Provisioning environment pack…' : 'Provision environment pack'}
                </Button>
                <Button variant="secondary" className="w-full justify-start gap-2" onClick={onAddEnvironmentPackToWorkspace} disabled={busyAction !== null}>
                  <DownloadSimple size={16} />
                  {busyAction === 'workspace-env' ? 'Adding pack to Workspace…' : 'Drop pack in Workspace'}
                </Button>
                <Button variant="secondary" className="w-full justify-start gap-2" onClick={onDownloadPacket} disabled={busyAction !== null}>
                  <DownloadSimple size={16} />
                  {busyAction === 'download' ? 'Downloading packet…' : 'Download implementation packet'}
                </Button>
                <Button variant="outline" className="w-full justify-start gap-2 border-border/80 bg-transparent text-foreground hover:bg-muted/60 hover:text-foreground" onClick={onSendEnvironmentPacketToSelf} disabled={busyAction !== null}>
                  <ClipboardText size={16} />
                  {busyAction === 'send-env' ? 'Preparing send flow…' : 'Send packet to yourself'}
                </Button>
                <Button variant="outline" className="w-full justify-start gap-2 border-border/80 bg-transparent text-foreground hover:bg-muted/60 hover:text-foreground" onClick={onCopyWalkthrough} disabled={busyAction !== null}>
                  <ClipboardText size={16} />
                  {busyAction === 'copy' ? 'Copying leadership walkthrough…' : 'Copy leadership walkthrough'}
                </Button>
              </div>
            </div>

            <div className="rounded-3xl border border-border/80 bg-card/95 p-4">
              <div className="mb-3 text-sm font-medium text-foreground">Municipal citations and protections</div>
              <div className="space-y-3">
                <div>
                  <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Citations</div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {selectedModule.mglCitations.map(citation => (
                      <Badge key={citation} variant="secondary" className="bg-muted/40 text-foreground">{citation}</Badge>
                    ))}
                  </div>
                </div>
                <div>
                  <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Operator protections</div>
                  <div className="mt-2 space-y-2 text-sm text-muted-foreground">
                    {selectedModule.operatorProtections.map(item => (
                      <div key={item} className="rounded-xl border border-border/80 bg-muted/25 px-3 py-2">
                        {item}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </aside>
        </div>

        <section className="rounded-3xl border border-border/80 bg-card/95 p-5">
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Bottom line for town leadership</div>
          <p className="mt-3 max-w-5xl text-sm leading-6 text-muted-foreground">
            The governed work queue holds the work. LogicOS lets it move outward when you want: into shared files, archives, connected systems, finance software, civic tools, or the website, without handing control back to the silo.
          </p>
        </section>
      </div>
    </div>
  )
}
