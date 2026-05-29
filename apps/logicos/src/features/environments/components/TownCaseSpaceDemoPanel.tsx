import { useCallback, useEffect, useMemo, useState } from 'react'
import { useKV } from '@/hooks/useKV'
import { MA_MUNICIPALITIES } from '@/data/maMunicipalities'
import type { CaseSpace, FileItem } from '@/lib/types'
import { useAuth } from '@/services/auth/AuthContext'
import { toast } from 'sonner'
import { BUILDER_SESSION_STORAGE_KEY_PREFIX, listBuilderSessions, type BuilderSession } from '@/lib/vault-modules'
import { getDemoUserScope } from '@/lib/environmentAccess'
import { createLogger } from '@/lib/logger'
import { pjApi } from '@/services/pjApi'

import { isLogicvilleEnvironmentId, LOGICVILLE_LIVE_DATA } from '@/features/environments/constants/logicville'

// ── Extracted data, types, and utilities ──────────────────────────────────────
import type {
  DemoModule,
  TrialApp,
  DemoArtifact,
  LiveTownData,
  DemoTownTab,
  VaultBuildTemplate,
} from '../demo/townCaseDemoData'
import {
  LIFECYCLE_STAGES,
  DATA_SOURCES,
  TRIAL_APPS,
  DEMO_MODULES,
  VAULT_BUILD_TEMPLATES,
} from '../demo/townCaseDemoData'
import {
  normalizeValue,
  findMunicipalityByName,
  getMunicipalityProfile,
  estimateModuleVolume,
  mapTemplateIdToModuleId,
  getPriorityTemplateIdsFromTownData,
  buildTrialAppPreviewDoc,
  buildLogicDocsPreviewDoc,
  downloadArtifact,
  buildStageNarrative,
  buildImplementationPacket,
  buildEnvironmentArtifacts,
  buildModuleArtifacts,
  buildTrialAppArtifacts,
  artifactsToWorkspaceFiles,
  uploadArtifactsToVault,
  shareArtifactToSelf,
  slugifyName,
  type TownCaseSpaceDemoSection,
} from '../demo/townCaseDemoUtils'
import type { Municipality } from '@/data/maMunicipalities'
import { DemoTrialSection } from './DemoTrialSection'
import { DemoSavedSection } from './DemoSavedSection'
import { DemoAppsSection } from './DemoAppsSection'
import { DemoAutomationsSection } from './DemoAutomationsSection'
import { DemoConnectionsSection } from './DemoConnectionsSection'
import { DemoLogicDocsSection } from './DemoLogicDocsSection'
import { DemoDashboardSection } from './DemoDashboardSection'

export type { TownCaseSpaceDemoSection } from '../demo/townCaseDemoUtils'

const logger = createLogger('TownCaseSpaceDemoPanel')

export function TownCaseSpaceDemoPanel({
  environment,
  section = 'trial',
  selectedTownCode,
  onSelectTownCode,
  onOpenTab,
  onResumeSavedSession,
}: {
  environment: CaseSpace
  section?: TownCaseSpaceDemoSection
  selectedTownCode?: number | null
  onSelectTownCode?: (code: number) => void
  onOpenTab?: (tab: DemoTownTab) => void
  onResumeSavedSession?: (sessionId: string) => void
}) {
  const { user } = useAuth()
  const demoScope = getDemoUserScope(user)
  const isLogicville = isLogicvilleEnvironmentId(environment.id)
  const [selectedModuleId, setSelectedModuleId] = useState(DEMO_MODULES[0].id)
  const [selectedAppId, setSelectedAppId] = useState(TRIAL_APPS[0].id)
  const [selectedTemplateId, setSelectedTemplateId] = useState(VAULT_BUILD_TEMPLATES[0].id)
  const [trialCatalogTab, setTrialCatalogTab] = useState<'areas' | 'templates' | 'apps'>('areas')
  const [templateCatalogTab, setTemplateCatalogTab] = useState<'priority' | DemoModule['id']>('priority')
  const [moduleQuery, setModuleQuery] = useState('')
  const [activeSourceIds, setActiveSourceIds] = useState<string[]>(['town-docs', 'state-guidance', 'meeting-history', 'gis-parcels', 'clerk-media', 'platform'])
  const [lifecycleStageIndex, setLifecycleStageIndex] = useState(2)
  const [townContext] = useState(
    isLogicville
      ? 'Logicville is a mid-sized New England town (pop. 8,400) with a lean Town Hall staff of 127, board-heavy governance, and pressure on public records compliance, permit turnaround, and board packet quality. Active pressure this week: Select Board meeting April 9 (board packet closes tonight), a public records response due April 9 (counsel review attached, awaiting final sign-off), and payroll closing April 10.'
      : 'Any Massachusetts town under 25,000 residents, lean staff capacity, board-heavy governance, and a need to make leadership visibility and staff handoffs more durable.'
  )
  const [busyAction, setBusyAction] = useState<string | null>(null)
  const [liveTownData, setLiveTownData] = useState<LiveTownData | null>(isLogicville ? LOGICVILLE_LIVE_DATA : null)
  const [loadingTownData, setLoadingTownData] = useState(false)
  const [townDataError, setTownDataError] = useState<string | null>(null)
  const [savedSessions, setSavedSessions] = useState<BuilderSession[]>([])
  const townName = environment.town && environment.town !== 'AnyTown' ? environment.town : environment.name
  const operatorEmail = user?.email?.trim() || 'operator@logicvillema.gov'
  const [municipalityName, setMunicipalityName] = useState(isLogicville ? 'Logicville' : townName)
  const [, setWorkspaceFiles] = useKV<FileItem[]>('logicworkspace-files', [])

  const selectedModule = useMemo(
    () => DEMO_MODULES.find(module => module.id === selectedModuleId) ?? DEMO_MODULES[0],
    [selectedModuleId],
  )
  const selectedTemplate = useMemo(
    () => VAULT_BUILD_TEMPLATES.find(template => template.id === selectedTemplateId) ?? VAULT_BUILD_TEMPLATES[0],
    [selectedTemplateId],
  )
  const selectedApp = useMemo(
    () => TRIAL_APPS.find(app => app.id === selectedAppId) ?? TRIAL_APPS[0],
    [selectedAppId],
  )
  const selectedMunicipality = useMemo(
    () => findMunicipalityByName(municipalityName.trim()),
    [municipalityName],
  )
  const filteredMunicipalities = useMemo(() => {
    const query = normalizeValue(municipalityName)
    if (!query) return MA_MUNICIPALITIES.slice(0, 8)

    return MA_MUNICIPALITIES.filter(municipality => normalizeValue(municipality.name).includes(query)).slice(0, 8)
  }, [municipalityName])
  const filteredTemplates = useMemo(() => {
    const query = moduleQuery.trim().toLowerCase()
    if (!query) return VAULT_BUILD_TEMPLATES

    return VAULT_BUILD_TEMPLATES.filter(template =>
      [template.name, template.department, template.code, template.workspace].some(value =>
        value.toLowerCase().includes(query),
      ),
    )
  }, [moduleQuery])
  const municipalityProfile = useMemo(
    () => getMunicipalityProfile(selectedMunicipality?.population),
    [selectedMunicipality],
  )
  const priorityTemplateIds = useMemo(
    () => getPriorityTemplateIdsFromTownData(liveTownData, selectedMunicipality),
    [liveTownData, selectedMunicipality],
  )
  const priorityTemplates = useMemo(
    () => VAULT_BUILD_TEMPLATES.filter(template => priorityTemplateIds.includes(template.id)),
    [priorityTemplateIds],
  )
  const projectedVolume = useMemo(
    () => estimateModuleVolume(selectedTemplate, selectedMunicipality?.population),
    [selectedMunicipality, selectedTemplate],
  )
  const activeSources = useMemo(
    () => DATA_SOURCES.filter(source => activeSourceIds.includes(source.id)),
    [activeSourceIds],
  )
  const livePressureAreas = useMemo(() => {
    const meaningfulFlags = liveTownData?.riskFlags.filter(flag => flag.severity !== 'passing').slice(0, 4) ?? []
    return meaningfulFlags.length > 0
      ? meaningfulFlags.map(flag => flag.label)
      : municipalityProfile.pressureAreas
  }, [liveTownData, municipalityProfile.pressureAreas])
  const lifecycleStage = LIFECYCLE_STAGES[lifecycleStageIndex] ?? LIFECYCLE_STAGES[0]
  const stageNarrative = buildStageNarrative(lifecycleStage, selectedModule, townContext)
  const implementationPacket = useMemo(
    () => buildImplementationPacket(townName, selectedModule, lifecycleStage, townContext, activeSources),
    [activeSources, lifecycleStage, selectedModule, townContext, townName],
  )
  const appPreviewDoc = useMemo(
    () => buildTrialAppPreviewDoc(townName, selectedApp, selectedModule),
    [selectedApp, selectedModule, townName],
  )
  const logicDocsPreviewDoc = useMemo(
    () => buildLogicDocsPreviewDoc(townName, selectedModule, townContext),
    [selectedModule, townContext, townName],
  )
  const environmentArtifacts = useMemo(
    () => buildEnvironmentArtifacts(townName, selectedModule, lifecycleStage, townContext, activeSources, implementationPacket, stageNarrative),
    [activeSources, implementationPacket, lifecycleStage, selectedModule, stageNarrative, townContext, townName],
  )
  const appArtifacts = useMemo(
    () => buildTrialAppArtifacts(townName, selectedApp, selectedModule),
    [selectedApp, selectedModule, townName],
  )
  const moduleArtifacts = useMemo(
    () => buildModuleArtifacts(municipalityName.trim() || townName, selectedTemplate, selectedMunicipality),
    [municipalityName, selectedMunicipality, selectedTemplate, townName],
  )
  const implementationPacketArtifact = environmentArtifacts[0] ?? null
  const moduleBuildSheetArtifact = environmentArtifacts[2] ?? null
  const logicDashSourceMapArtifact = environmentArtifacts[3] ?? null
  const automationRunbookArtifact = environmentArtifacts[4] ?? null
  const logicDocsArtifacts = [implementationPacketArtifact, moduleBuildSheetArtifact].filter(Boolean) as DemoArtifact[]
  const demoSavedSessions = useMemo(
    () => savedSessions
      .filter(session => session.source === 'town-demo')
      .sort((a, b) => b.updatedAt - a.updatedAt),
    [savedSessions],
  )

  useEffect(() => {
    if (!selectedTownCode) return
    const municipality = MA_MUNICIPALITIES.find(item => item.dor_code === selectedTownCode)
    if (municipality && municipality.name !== municipalityName) {
      setMunicipalityName(municipality.name)
    }
  }, [municipalityName, selectedTownCode])

  useEffect(() => {
    const refreshSavedSessions = () => {
      setSavedSessions(demoScope ? listBuilderSessions(demoScope) : [])
    }

    refreshSavedSessions()

    const onStorage = (event: StorageEvent) => {
      if (!event.key || event.key.startsWith(BUILDER_SESSION_STORAGE_KEY_PREFIX)) {
        refreshSavedSessions()
      }
    }

    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [demoScope])

  const handlePullTownData = useCallback(async (municipalityOverride?: Municipality | null) => {
    const municipality = municipalityOverride ?? selectedMunicipality
    if (!municipality) {
      toast.error('Choose a municipality first.')
      return
    }

    setLoadingTownData(true)
    setTownDataError(null)
    toast.loading(`Pulling public town data for ${municipality.name}…`, { id: 'town-data-pull' })
    try {
      const data = await pjApi.fiscal.sync(municipality.name) as LiveTownData
      setLiveTownData(data)
      onSelectTownCode?.(municipality.dor_code)

      const nextTemplateId = getPriorityTemplateIdsFromTownData(data, municipality)[0]
      if (nextTemplateId) {
        setSelectedTemplateId(nextTemplateId)
        setSelectedModuleId(mapTemplateIdToModuleId(nextTemplateId))
      }

      toast.success(`${municipality.name} loaded from DLS public finance and personnel reports.`, { id: 'town-data-pull' })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      setTownDataError(message)
      toast.error(`Could not pull town data: ${message}`, { id: 'town-data-pull' })
    } finally {
      setLoadingTownData(false)
    }
  }, [onSelectTownCode, selectedMunicipality])

  const toggleSource = useCallback((sourceId: string) => {
    setActiveSourceIds(current =>
      current.includes(sourceId)
        ? current.filter(id => id !== sourceId)
        : [...current, sourceId],
    )
  }, [])

  const addArtifactsToWorkspace = useCallback((artifacts: DemoArtifact[], label: string) => {
    const newFiles = artifactsToWorkspaceFiles(artifacts)
    setWorkspaceFiles(prev => {
      const existingNames = new Set(newFiles.map(file => file.name))
      return [...newFiles, ...prev.filter(file => !existingNames.has(file.name))]
    })
    artifacts.forEach(artifact => downloadArtifact(artifact.filename, artifact.content, artifact.mimeType))
    toast.success(`${label} saved in the Case Space and downloaded. In live use, Logicville can auto-route it, remind the next owner, and notify ${operatorEmail}.`)
  }, [operatorEmail, setWorkspaceFiles])

  const handleCopyWalkthrough = useCallback(async () => {
    setBusyAction('copy')
    const liveContext = isLogicville
      ? "Right now: Select Board packet closes tonight for tomorrow's April 9 meeting. A public records response (PR-241) is due April 9. Payroll closes Friday."
      : ''
    const summary = [
      `${townName} — ${selectedModule.label}: ${selectedModule.summary}`,
      liveContext,
      `LogicDASH gives leadership visibility into where ${selectedModule.label.toLowerCase()} stands without waiting for a staff brief. ModuleMaker maps the operating lane into a real governed build. The environment pack provisions templates, retention rules, and automation hooks.`,
      'The demo can drop generated files into the workspace, provision them to Vault, and send selected packets to the operator or to yourself.',
      'Everything is customizable for municipal use and can be white-labeled whether the town continues with PublicLogic or not.',
    ].filter(Boolean).join(' ')

    try {
      await navigator.clipboard.writeText(summary)
      toast.success('Leadership walkthrough copied.')
    } catch (error) {
      downloadArtifact(`${slugifyName(townName)}-${selectedModule.id}-ta-walkthrough.txt`, summary, 'text/plain')
      toast.success('Clipboard was unavailable, so the leadership walkthrough downloaded instead.')
      logger.error('Clipboard copy fell back to file download for the leadership walkthrough.', error, { townName, moduleId: selectedModule.id })
    } finally {
      setBusyAction(null)
    }
  }, [isLogicville, selectedModule.id, selectedModule.label, selectedModule.summary, townName])

  const handleDownloadPacket = useCallback(() => {
    setBusyAction('download')
    try {
      const artifact = environmentArtifacts[0]
      downloadArtifact(artifact.filename, artifact.content, artifact.mimeType)
      toast.success('Implementation packet downloaded.')
    } finally {
      setBusyAction(null)
    }
  }, [environmentArtifacts])

  const handleProvisionEnvironmentPack = useCallback(async () => {
    setBusyAction('provision-env')
    await uploadArtifactsToVault(
      environmentArtifacts,
      `Provisioned ${environmentArtifacts.length} environment files into Vault.`,
      'Vault provisioning fell back to downloads, so the environment pack still landed immediately.',
    )
    setBusyAction(null)
  }, [environmentArtifacts])

  const handleAddEnvironmentPackToWorkspace = useCallback(() => {
    setBusyAction('workspace-env')
    try {
      addArtifactsToWorkspace(environmentArtifacts, 'Environment pack')
    } finally {
      setBusyAction(null)
    }
  }, [addArtifactsToWorkspace, environmentArtifacts])

  const handleSendEnvironmentPacketToSelf = useCallback(async () => {
    setBusyAction('send-env')
    await shareArtifactToSelf(townName, environmentArtifacts[0], 'Implementation packet', operatorEmail)
    setBusyAction(null)
  }, [environmentArtifacts, operatorEmail, townName])

  const handleProvisionModulePack = useCallback(async () => {
    setBusyAction('provision-module')
    await uploadArtifactsToVault(
      moduleArtifacts,
      `Provisioned ${moduleArtifacts.length} VAULT module files into Vault.`,
      'Vault provisioning fell back to downloads, so the full VAULT module pack still landed immediately.',
    )
    setBusyAction(null)
  }, [moduleArtifacts])

  const handleAddModulePackToWorkspace = useCallback(() => {
    setBusyAction('workspace-module')
    try {
      addArtifactsToWorkspace(moduleArtifacts, 'Full VAULT module pack')
    } finally {
      setBusyAction(null)
    }
  }, [addArtifactsToWorkspace, moduleArtifacts])

  const handleSendModuleSpecToSelf = useCallback(async () => {
    setBusyAction('send-module')
    await shareArtifactToSelf(municipalityName.trim() || townName, moduleArtifacts[0], 'Module build spec', operatorEmail)
    setBusyAction(null)
  }, [moduleArtifacts, municipalityName, operatorEmail, townName])

  const handleProvisionAppPack = useCallback(async () => {
    setBusyAction('provision-app')
    await uploadArtifactsToVault(
      appArtifacts,
      `Provisioned ${appArtifacts.length} app files into Vault.`,
      'App provisioning fell back to downloads, so the app pack still landed immediately.',
    )
    setBusyAction(null)
  }, [appArtifacts])

  const handleAddAppPackToWorkspace = useCallback(() => {
    setBusyAction('workspace-app')
    try {
      addArtifactsToWorkspace(appArtifacts, 'Trial app pack')
    } finally {
      setBusyAction(null)
    }
  }, [addArtifactsToWorkspace, appArtifacts])

  const handleSendAppSpecToSelf = useCallback(async () => {
    setBusyAction('send-app')
    await shareArtifactToSelf(townName, appArtifacts[0], 'App spec', operatorEmail)
    setBusyAction(null)
  }, [appArtifacts, operatorEmail, townName])

  const handleProvisionAutomationPreview = useCallback(async () => {
    if (!automationRunbookArtifact) return
    setBusyAction('provision-automation')
    await uploadArtifactsToVault(
      [automationRunbookArtifact],
      'Provisioned automation preview into Vault.',
      'Automation preview fell back to download so it still landed immediately.',
    )
    setBusyAction(null)
  }, [automationRunbookArtifact])

  const handleAddAutomationPreviewToWorkspace = useCallback(() => {
    if (!automationRunbookArtifact) return
    setBusyAction('workspace-automation')
    try {
      addArtifactsToWorkspace([automationRunbookArtifact], 'Automation preview')
    } finally {
      setBusyAction(null)
    }
  }, [addArtifactsToWorkspace, automationRunbookArtifact])

  const handleSendAutomationPreview = useCallback(async () => {
    if (!automationRunbookArtifact) return
    setBusyAction('send-automation')
    await shareArtifactToSelf(townName, automationRunbookArtifact, 'Automation preview', operatorEmail)
    setBusyAction(null)
  }, [automationRunbookArtifact, operatorEmail, townName])

  const handleProvisionConnectionPreview = useCallback(async () => {
    if (!logicDashSourceMapArtifact) return
    setBusyAction('provision-connections')
    await uploadArtifactsToVault(
      [logicDashSourceMapArtifact],
      'Provisioned connection preview into Vault.',
      'Connection preview fell back to download so it still landed immediately.',
    )
    setBusyAction(null)
  }, [logicDashSourceMapArtifact])

  const handleAddConnectionPreviewToWorkspace = useCallback(() => {
    if (!logicDashSourceMapArtifact) return
    setBusyAction('workspace-connections')
    try {
      addArtifactsToWorkspace([logicDashSourceMapArtifact], 'Connection preview')
    } finally {
      setBusyAction(null)
    }
  }, [addArtifactsToWorkspace, logicDashSourceMapArtifact])

  const handleSendConnectionPreview = useCallback(async () => {
    if (!logicDashSourceMapArtifact) return
    setBusyAction('send-connections')
    await shareArtifactToSelf(townName, logicDashSourceMapArtifact, 'Connection preview', operatorEmail)
    setBusyAction(null)
  }, [logicDashSourceMapArtifact, operatorEmail, townName])

  const handleAddLogicDocsPreviewToWorkspace = useCallback(() => {
    if (logicDocsArtifacts.length === 0) return
    setBusyAction('workspace-logicdocs')
    try {
      addArtifactsToWorkspace(logicDocsArtifacts, 'LogicDocs preview')
    } finally {
      setBusyAction(null)
    }
  }, [addArtifactsToWorkspace, logicDocsArtifacts])

  const handleSendLogicDocsPreview = useCallback(async () => {
    if (!implementationPacketArtifact) return
    setBusyAction('send-logicdocs')
    await shareArtifactToSelf(townName, implementationPacketArtifact, 'LogicDocs preview', operatorEmail)
    setBusyAction(null)
  }, [implementationPacketArtifact, operatorEmail, townName])

  const handleDownloadLogicDocsPreview = useCallback(() => {
    if (!implementationPacketArtifact) return
    setBusyAction('download-logicdocs')
    try {
      downloadArtifact(implementationPacketArtifact.filename, implementationPacketArtifact.content, implementationPacketArtifact.mimeType)
      toast.success('LogicDocs preview downloaded.')
    } finally {
      setBusyAction(null)
    }
  }, [implementationPacketArtifact])

  const operatorStatusItems = useMemo(() => ([
    {
      title: 'Operator inbox',
      detail: `Status copies, packet notices, and escalation alerts can go to ${operatorEmail}. In live use these route automatically based on lane and role.`,
    },
    {
      title: 'Constituent updates',
      detail: `When the public side is used, acknowledgements and next-step notices can also be addressed to ${operatorEmail} in this demo. The same flow handles resident-facing records requests and permit status.`,
    },
    {
      title: 'Saved files',
      detail: `When you save a packet here, Logicville downloads it now. In live use it auto-routes into Vault with reminders, escalation rules, and a governed retention trail. Nothing depends on someone remembering to file it.`,
    },
  ]), [operatorEmail])

  const featuredModules = useMemo(() => {
    const orderedIds = Array.from(new Set([
      selectedModule.id,
      ...priorityTemplates.map(template => mapTemplateIdToModuleId(template.id)),
      ...DEMO_MODULES.map(module => module.id),
    ]))

    return orderedIds
      .map(moduleId => DEMO_MODULES.find(module => module.id === moduleId))
      .filter((module): module is DemoModule => Boolean(module))
  }, [priorityTemplates, selectedModule.id])

  const featuredTemplates = useMemo(() => {
    const orderedIds = Array.from(new Set([
      selectedTemplate.id,
      ...priorityTemplates.map(template => template.id),
      ...filteredTemplates.map(template => template.id),
    ]))

    return orderedIds
      .map(templateId => VAULT_BUILD_TEMPLATES.find(template => template.id === templateId))
      .filter((template): template is VaultBuildTemplate => Boolean(template))
  }, [filteredTemplates, priorityTemplates, selectedTemplate.id])

  const featuredApps = useMemo(() => {
    const orderedIds = Array.from(new Set([selectedApp.id, ...TRIAL_APPS.map(app => app.id)]))

    return orderedIds
      .map(appId => TRIAL_APPS.find(app => app.id === appId))
      .filter((app): app is TrialApp => Boolean(app))
  }, [selectedApp.id])
  const visibleTemplates = useMemo(() => {
    const scopedTemplates = templateCatalogTab === 'priority'
      ? (priorityTemplates.length > 0 ? priorityTemplates : featuredTemplates)
      : featuredTemplates.filter(template => mapTemplateIdToModuleId(template.id) === templateCatalogTab)

    if (!moduleQuery.trim()) return scopedTemplates

    const query = moduleQuery.trim().toLowerCase()
    return scopedTemplates.filter(template =>
      [template.name, template.department, template.code, template.workspace].some(value =>
        value.toLowerCase().includes(query),
      ),
    )
  }, [featuredTemplates, moduleQuery, priorityTemplates, templateCatalogTab])

  if (section === 'trial') {
    return (
      <DemoTrialSection
        isLogicville={isLogicville}
        townName={townName}
        municipalityName={municipalityName}
        setMunicipalityName={setMunicipalityName}
        filteredMunicipalities={filteredMunicipalities}
        selectedMunicipality={selectedMunicipality}
        onSelectTownCode={onSelectTownCode}
        liveTownData={liveTownData}
        livePressureAreas={livePressureAreas}
        featuredTemplates={featuredTemplates}
        loadingTownData={loadingTownData}
        townDataError={townDataError}
        selectedModule={selectedModule}
        selectedTemplate={selectedTemplate}
        selectedApp={selectedApp}
        activeSources={activeSources}
        trialCatalogTab={trialCatalogTab}
        setTrialCatalogTab={setTrialCatalogTab}
        templateCatalogTab={templateCatalogTab}
        setTemplateCatalogTab={setTemplateCatalogTab}
        moduleQuery={moduleQuery}
        setModuleQuery={setModuleQuery}
        featuredModules={featuredModules}
        visibleTemplates={visibleTemplates}
        featuredApps={featuredApps}
        setSelectedModuleId={setSelectedModuleId}
        setSelectedTemplateId={setSelectedTemplateId}
        setSelectedAppId={setSelectedAppId}
        busyAction={busyAction}
        onCopyWalkthrough={handleCopyWalkthrough}
        onPullTownData={() => void handlePullTownData()}
        onProvisionEnvironmentPack={handleProvisionEnvironmentPack}
        onAddEnvironmentPackToWorkspace={handleAddEnvironmentPackToWorkspace}
        onSendEnvironmentPacketToSelf={handleSendEnvironmentPacketToSelf}
        operatorEmail={operatorEmail}
        operatorStatusItems={operatorStatusItems}
        onOpenTab={onOpenTab}
      />
    )
  }

  if (section === 'saved') {
    return (
      <DemoSavedSection
        demoSavedSessions={demoSavedSessions}
        onResumeSavedSession={onResumeSavedSession}
        onOpenTab={onOpenTab}
      />
    )
  }

  if (section === 'apps') {
    return (
      <DemoAppsSection
        selectedApp={selectedApp}
        setSelectedAppId={setSelectedAppId}
        appPreviewDoc={appPreviewDoc}
        operatorEmail={operatorEmail}
        busyAction={busyAction}
        onProvisionAppPack={handleProvisionAppPack}
        onAddAppPackToWorkspace={handleAddAppPackToWorkspace}
        onSendAppSpecToSelf={handleSendAppSpecToSelf}
      />
    )
  }

  if (section === 'automations') {
    return (
      <DemoAutomationsSection
        selectedModule={selectedModule}
        busyAction={busyAction}
        automationRunbookArtifact={automationRunbookArtifact}
        onProvisionAutomationPreview={handleProvisionAutomationPreview}
        onAddAutomationPreviewToWorkspace={handleAddAutomationPreviewToWorkspace}
        onSendAutomationPreview={handleSendAutomationPreview}
        operatorEmail={operatorEmail}
      />
    )
  }

  if (section === 'connections') {
    return (
      <DemoConnectionsSection
        activeSourceIds={activeSourceIds}
        onToggleSource={toggleSource}
        busyAction={busyAction}
        logicDashSourceMapArtifact={logicDashSourceMapArtifact}
        onProvisionConnectionPreview={handleProvisionConnectionPreview}
        onAddConnectionPreviewToWorkspace={handleAddConnectionPreviewToWorkspace}
        onSendConnectionPreview={handleSendConnectionPreview}
        operatorEmail={operatorEmail}
      />
    )
  }

  if (section === 'logicdocs') {
    return (
      <DemoLogicDocsSection
        logicDocsPreviewDoc={logicDocsPreviewDoc}
        busyAction={busyAction}
        implementationPacketArtifact={implementationPacketArtifact}
        logicDocsArtifacts={logicDocsArtifacts}
        onDownloadLogicDocsPreview={handleDownloadLogicDocsPreview}
        onAddLogicDocsPreviewToWorkspace={handleAddLogicDocsPreviewToWorkspace}
        onSendLogicDocsPreview={handleSendLogicDocsPreview}
        operatorEmail={operatorEmail}
      />
    )
  }

  return (
    <DemoDashboardSection
      townName={townName}
      municipalityName={municipalityName}
      setMunicipalityName={setMunicipalityName}
      filteredMunicipalities={filteredMunicipalities}
      selectedMunicipality={selectedMunicipality}
      onSelectTownCode={onSelectTownCode}
      liveTownData={liveTownData}
      loadingTownData={loadingTownData}
      townDataError={townDataError}
      livePressureAreas={livePressureAreas}
      priorityTemplates={priorityTemplates}
      lifecycleStageIndex={lifecycleStageIndex}
      setLifecycleStageIndex={setLifecycleStageIndex}
      selectedModule={selectedModule}
      selectedTemplate={selectedTemplate}
      selectedApp={selectedApp}
      filteredTemplates={filteredTemplates}
      moduleQuery={moduleQuery}
      setModuleQuery={setModuleQuery}
      municipalityProfile={municipalityProfile}
      projectedVolume={projectedVolume}
      activeSourceIds={activeSourceIds}
      onToggleSource={toggleSource}
      activeSources={activeSources}
      busyAction={busyAction}
      onProvisionEnvironmentPack={handleProvisionEnvironmentPack}
      onAddEnvironmentPackToWorkspace={handleAddEnvironmentPackToWorkspace}
      onDownloadPacket={handleDownloadPacket}
      onSendEnvironmentPacketToSelf={handleSendEnvironmentPacketToSelf}
      onCopyWalkthrough={handleCopyWalkthrough}
      onProvisionModulePack={handleProvisionModulePack}
      onAddModulePackToWorkspace={handleAddModulePackToWorkspace}
      onSendModuleSpecToSelf={handleSendModuleSpecToSelf}
      onProvisionAppPack={handleProvisionAppPack}
      onAddAppPackToWorkspace={handleAddAppPackToWorkspace}
      onSendAppSpecToSelf={handleSendAppSpecToSelf}
      onPullTownData={() => void handlePullTownData()}
      onOpenTab={onOpenTab}
      operatorEmail={operatorEmail}
      setSelectedTemplateId={setSelectedTemplateId}
      setSelectedModuleId={setSelectedModuleId}
      setSelectedAppId={setSelectedAppId}
      environmentArtifacts={environmentArtifacts}
      appPreviewDoc={appPreviewDoc}
    />
  )
}
