import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Buildings,
  ClipboardText,
  Database,
  DownloadSimple,
  EnvelopeSimple,
  Files,
  FlowArrow,
  Sparkle,
} from '@phosphor-icons/react'
import { LOGICVILLE_OPERATING_AREAS } from '@/features/environments/constants/logicville'
import type { Municipality } from '@/data/maMunicipalities'
import type {
  DemoModule,
  TrialApp,
  LiveTownData,
  DemoTownTab,
  VaultBuildTemplate,
  DataSource,
} from '../demo/townCaseDemoData'
import { mapTemplateIdToModuleId } from '../demo/townCaseDemoUtils'
import { formatCurrency } from '../demo/townCaseDemoUtils'

interface DemoTrialSectionProps {
  isLogicville: boolean
  townName: string
  municipalityName: string
  setMunicipalityName: (name: string) => void
  filteredMunicipalities: Municipality[]
  selectedMunicipality: Municipality | null | undefined
  onSelectTownCode?: (code: number) => void
  liveTownData: LiveTownData | null
  livePressureAreas: string[]
  featuredTemplates: VaultBuildTemplate[]
  loadingTownData: boolean
  townDataError: string | null
  selectedModule: DemoModule
  selectedTemplate: VaultBuildTemplate
  selectedApp: TrialApp
  activeSources: DataSource[]
  trialCatalogTab: 'areas' | 'templates' | 'apps'
  setTrialCatalogTab: (tab: 'areas' | 'templates' | 'apps') => void
  templateCatalogTab: 'priority' | string
  setTemplateCatalogTab: (tab: 'priority' | string) => void
  moduleQuery: string
  setModuleQuery: (q: string) => void
  featuredModules: DemoModule[]
  visibleTemplates: VaultBuildTemplate[]
  featuredApps: TrialApp[]
  setSelectedModuleId: (id: string) => void
  setSelectedTemplateId: (id: string) => void
  setSelectedAppId: (id: string) => void
  busyAction: string | null
  onCopyWalkthrough: () => void
  onPullTownData: () => void
  onProvisionEnvironmentPack: () => void
  onAddEnvironmentPackToWorkspace: () => void
  onSendEnvironmentPacketToSelf: () => void
  operatorEmail: string
  operatorStatusItems: { title: string; detail: string }[]
  onOpenTab?: (tab: DemoTownTab) => void
}

export function DemoTrialSection({
  isLogicville,
  townName: _townName,
  municipalityName,
  setMunicipalityName,
  filteredMunicipalities,
  selectedMunicipality,
  onSelectTownCode,
  liveTownData,
  livePressureAreas,
  featuredTemplates,
  loadingTownData,
  townDataError,
  selectedModule,
  selectedTemplate,
  selectedApp,
  activeSources,
  trialCatalogTab,
  setTrialCatalogTab,
  templateCatalogTab,
  setTemplateCatalogTab,
  moduleQuery,
  setModuleQuery,
  featuredModules,
  visibleTemplates,
  featuredApps,
  setSelectedModuleId,
  setSelectedTemplateId,
  setSelectedAppId,
  busyAction,
  onCopyWalkthrough,
  onPullTownData,
  onProvisionEnvironmentPack,
  onAddEnvironmentPackToWorkspace,
  onSendEnvironmentPacketToSelf,
  operatorEmail,
  operatorStatusItems,
  onOpenTab,
}: DemoTrialSectionProps) {
  return (
    <div className="h-full min-h-0 overflow-y-auto bg-muted/10 text-foreground">
      <div className="mx-auto grid min-h-full max-w-7xl gap-4 px-5 py-5 xl:grid-cols-[1.15fr_0.85fr] xl:h-full">
        <section className="min-h-0 rounded-3xl border border-emerald-400/20 bg-card/95 p-5 shadow-[0_20px_60px_-30px_rgba(52,211,153,0.28)] backdrop-blur">
          <div className="flex h-full flex-col gap-4">
            <div>
              <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.24em] text-emerald-700 dark:text-emerald-300">
                <Database size={14} weight="fill" />
                {isLogicville ? 'Logicville · Middlesex County, MA' : 'Town dashboard'}
              </div>
              <h1 className="text-3xl font-semibold tracking-tight text-foreground">
                {isLogicville ? 'Town of Logicville.' : 'Start with the town.'}
              </h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
                {isLogicville
                  ? 'The primary municipal environment — see where pressure is showing, explore each operating lane, and generate real-world implementation artifacts.'
                  : 'Pull the public record once, see where pressure is showing, and open the next view from the same municipal context.'}
              </p>
            </div>

            {isLogicville ? (
              <div className="flex flex-wrap items-center gap-2">
                {LOGICVILLE_OPERATING_AREAS.map(area => (
                  <span
                    key={area.id}
                    className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${area.bg} ${area.border} ${area.text}`}
                  >
                    {area.label}
                  </span>
                ))}
                <Button variant="secondary" className="ml-auto gap-2" onClick={onCopyWalkthrough} disabled={busyAction !== null}>
                  <ClipboardText size={16} />
                  {busyAction === 'copy' ? 'Preparing brief…' : 'Copy leadership brief'}
                </Button>
              </div>
            ) : (
            <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto]">
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
                  {loadingTownData ? 'Pulling town data…' : 'Pull town data'}
                </Button>
                <Button variant="secondary" className="gap-2" onClick={onCopyWalkthrough} disabled={busyAction !== null}>
                  <ClipboardText size={16} />
                  {busyAction === 'copy' ? 'Preparing brief…' : 'Copy leadership brief'}
                </Button>
              </div>
            </div>
            )}

            {townDataError && (
              <div className="rounded-2xl border border-rose-300/20 bg-rose-300/10 px-4 py-3 text-sm text-rose-700 dark:text-rose-100">
                {townDataError}
              </div>
            )}

            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-2xl border border-border/80 bg-card/95 p-3">
                <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Operating budget</div>
                <div className="mt-1.5 text-xl font-semibold text-foreground">{formatCurrency(liveTownData?.metrics.operatingBudget ?? null)}</div>
                <div className="mt-1 text-xs text-muted-foreground">{isLogicville ? 'Logicville FY2025 demo profile' : liveTownData ? `FY${liveTownData.fiscalYear} DLS snapshot` : 'Loads from DLS community data'}</div>
              </div>
              <div className="rounded-2xl border border-border/80 bg-card/95 p-3">
                <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Employees</div>
                <div className="mt-1.5 text-xl font-semibold text-foreground">{liveTownData?.metrics.totalEmployees?.toLocaleString() ?? '—'}</div>
                <div className="mt-1 text-xs text-muted-foreground">{isLogicville ? 'Town Hall headcount' : 'Public DLS personnel total'}</div>
              </div>
              <div className="rounded-2xl border border-border/80 bg-card/95 p-3">
                <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Immediate pressure</div>
                <div className="mt-1.5 text-sm font-medium text-foreground">{livePressureAreas[0] ?? 'Choose a town to read the room'}</div>
                <div className="mt-1.5 text-xs text-muted-foreground">{isLogicville ? 'Active risk · click Modules for details' : liveTownData ? `Pulled ${new Date(liveTownData.computedAt).toLocaleDateString()}` : 'Plain-language signal, not an assessment'}</div>
              </div>
              <div className="rounded-2xl border border-border/80 bg-card/95 p-3">
                <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Recommended start</div>
                <div className="mt-1.5 text-sm font-medium text-foreground">{featuredTemplates[0]?.name ?? 'Pick a lane'}</div>
                <div className="mt-1.5 text-xs text-muted-foreground">{isLogicville ? 'Pre-matched to Logicville priorities' : 'Based on the town profile and connected public data.'}</div>
              </div>
            </div>

            <div className="rounded-2xl border border-border/80 bg-card/95 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Selector workspace</div>
                  <div className="mt-1 text-xs text-muted-foreground">Switch tabs instead of scrolling through stacked lists.</div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {[
                    { id: 'areas' as const, label: 'Priority areas' },
                    { id: 'templates' as const, label: 'Ready modules' },
                    { id: 'apps' as const, label: 'Public entry' },
                  ].map(tab => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setTrialCatalogTab(tab.id)}
                      className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
                        trialCatalogTab === tab.id
                          ? 'bg-foreground text-background'
                          : 'border border-border/80 bg-muted/25 text-muted-foreground hover:border-border'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>

              {trialCatalogTab === 'areas' && (
                <div className="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                  {featuredModules.map(module => (
                    <button
                      key={module.id}
                      type="button"
                      onClick={() => {
                        setSelectedModuleId(module.id)
                        setTemplateCatalogTab(module.id)
                      }}
                      className={`rounded-2xl border px-3 py-3 text-left transition ${
                        selectedModule.id === module.id
                          ? 'border-transparent bg-primary/8 text-foreground'
                          : 'border-border/80 bg-muted/25 text-muted-foreground hover:border-border'
                      }`}
                      style={selectedModule.id === module.id ? { boxShadow: `0 0 0 1px ${module.color}40 inset` } : undefined}
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-2xl text-lg" style={{ backgroundColor: `${module.color}22`, color: module.color }}>
                          {module.icon}
                        </div>
                        <div>
                          <div className="text-sm font-medium">{module.label}</div>
                          <div className="mt-0.5 text-xs text-muted-foreground">{module.desc}</div>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {trialCatalogTab === 'templates' && (
                <div className="mt-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setTemplateCatalogTab('priority')}
                      className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
                        templateCatalogTab === 'priority'
                          ? 'bg-amber-300/15 text-amber-700 dark:text-amber-100'
                          : 'border border-border/80 bg-muted/25 text-muted-foreground hover:border-border'
                      }`}
                    >
                      Recommended
                    </button>
                    {featuredModules.map(module => (
                      <button
                        key={module.id}
                        type="button"
                        onClick={() => setTemplateCatalogTab(module.id)}
                        className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
                          templateCatalogTab === module.id
                            ? 'bg-foreground text-background'
                            : 'border border-border/80 bg-muted/25 text-muted-foreground hover:border-border'
                        }`}
                      >
                        {module.label}
                      </button>
                    ))}
                  </div>
                  <input
                    value={moduleQuery}
                    onChange={(event) => setModuleQuery(event.target.value)}
                    className="mt-3 w-full rounded-2xl border border-border/80 bg-background/90 px-3 py-3 text-sm text-foreground outline-none"
                    placeholder="Search payroll, permitting, records, clerk..."
                  />
                  <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                    {visibleTemplates.map(template => (
                      <button
                        key={template.id}
                        type="button"
                        onClick={() => {
                          setSelectedTemplateId(template.id)
                          setSelectedModuleId(mapTemplateIdToModuleId(template.id))
                        }}
                        className={`rounded-2xl border px-3 py-3 text-left transition ${
                          selectedTemplate.id === template.id
                            ? 'border-amber-300/40 bg-amber-300/10 text-foreground'
                            : 'border-border/80 bg-muted/25 text-muted-foreground hover:border-border'
                        }`}
                      >
                        <div className="text-sm font-medium">{template.name}</div>
                        <div className="mt-1 text-xs text-muted-foreground">{template.code} · {template.department}</div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {trialCatalogTab === 'apps' && (
                <div className="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-4">
                  {featuredApps.map(app => (
                    <button
                      key={app.id}
                      type="button"
                      onClick={() => setSelectedAppId(app.id)}
                      className={`rounded-2xl border px-3 py-3 text-left transition ${
                        selectedApp.id === app.id
                          ? 'border-cyan-300/40 bg-cyan-300/10 text-foreground'
                          : 'border-border/80 bg-muted/25 text-muted-foreground hover:border-border'
                      }`}
                    >
                      <div className="text-sm font-medium">{app.name}</div>
                      <div className="mt-1 text-xs text-muted-foreground">{app.audience}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>

        <aside className="flex h-full min-h-0 flex-col gap-4">
          <div className="rounded-3xl border border-amber-400/20 bg-card/95 p-4 shadow-[0_20px_60px_-30px_rgba(212,168,83,0.35)] backdrop-blur">
              <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-amber-700 dark:text-amber-300">
                <Sparkle size={14} weight="fill" />
                Open a view
              </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <Button className="justify-start gap-2" onClick={() => onOpenTab?.('dashboard')}>
                <Files size={16} />
                Open LogicDASH
              </Button>
              <Button variant="secondary" className="justify-start gap-2" onClick={() => onOpenTab?.('maker')}>
                <Buildings size={16} />
                Open Module Maker
              </Button>
              <Button variant="secondary" className="justify-start gap-2" onClick={() => onOpenTab?.('saved')}>
                <ClipboardText size={16} />
                My saved modules
              </Button>
              <Button variant="secondary" className="justify-start gap-2" onClick={() => onOpenTab?.('automations')}>
                <FlowArrow size={16} />
                Open Automations
              </Button>
              <Button variant="outline" className="justify-start gap-2 border-border/80 bg-transparent text-foreground hover:bg-muted/60 hover:text-foreground" onClick={() => onOpenTab?.('connections')}>
                <Database size={16} />
                Open Connections
              </Button>
            </div>
          </div>

          <div className="rounded-3xl border border-border/80 bg-card/95 p-4">
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Current setup</div>
            <div className="mt-3 grid gap-2">
              <div className="rounded-2xl border border-border/80 bg-muted/25 p-3">
                <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Priority area</div>
                <div className="mt-1.5 text-sm font-medium text-foreground">{selectedModule.label}</div>
              </div>
              <div className="rounded-2xl border border-border/80 bg-muted/25 p-3">
                <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Ready module</div>
                <div className="mt-1.5 text-sm font-medium text-foreground">{selectedTemplate.name}</div>
              </div>
              <div className="rounded-2xl border border-border/80 bg-muted/25 p-3">
                <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Public entry</div>
                <div className="mt-1.5 text-sm font-medium text-foreground">{selectedApp.name}</div>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {activeSources.slice(0, 4).map(source => (
                <Badge key={source.id} variant="secondary" className="bg-muted/40 text-foreground">
                  {source.label}
                </Badge>
              ))}
            </div>
          </div>

          <div className="rounded-3xl border border-border/80 bg-card/95 p-4">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              <EnvelopeSimple size={14} />
              Live status flow
            </div>
            <div className="mt-3 space-y-2">
              {operatorStatusItems.map(item => (
                <div key={item.title} className="rounded-2xl border border-border/80 bg-muted/25 px-3 py-3">
                  <div className="text-sm font-medium text-foreground">{item.title}</div>
                  <div className="mt-1 text-xs leading-5 text-muted-foreground">{item.detail}</div>
                </div>
              ))}
            </div>
            <Button variant="outline" className="mt-3 w-full justify-start gap-2 border-border/80 bg-transparent text-foreground hover:bg-muted/60 hover:text-foreground" onClick={() => onOpenTab?.('connections')}>
              <EnvelopeSimple size={16} />
              Review routing + notice paths
            </Button>
          </div>

          <div className="grid gap-2 sm:grid-cols-3">
            <Button className="justify-start gap-2" onClick={onProvisionEnvironmentPack} disabled={busyAction !== null}>
              <Files size={16} />
              {busyAction === 'provision-env' ? 'Staging starter pack…' : 'Stage starter pack'}
            </Button>
            <Button variant="secondary" className="justify-start gap-2" onClick={onAddEnvironmentPackToWorkspace} disabled={busyAction !== null}>
              <DownloadSimple size={16} />
              {busyAction === 'workspace-env' ? 'Saving + downloading…' : 'Save + download'}
            </Button>
            <Button variant="outline" className="justify-start gap-2 border-border/80 bg-transparent text-foreground hover:bg-muted/60 hover:text-foreground" onClick={onSendEnvironmentPacketToSelf} disabled={busyAction !== null}>
              <ClipboardText size={16} />
              {busyAction === 'send-env' ? 'Preparing send flow…' : `Send starter packet to ${operatorEmail}`}
            </Button>
          </div>
        </aside>
      </div>
    </div>
    )
}
