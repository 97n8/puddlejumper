import React, { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/services/auth/AuthContext'
import { isSuttonEnvironment, isSuttonRestrictedUser } from '@/lib/environmentAccess'
import type { ToolKey } from '@/lib/types'
import { WorkspaceHeader } from './WorkspaceHeader'
import { ModuleGrid } from './ModuleGrid'
import { ActivityFeed } from './ActivityFeed'
import { MemberPanel } from './MemberPanel'
import { ToolTile } from './ToolTile'
import { useEnvironmentWorkspace } from '../hooks/useEnvironmentWorkspace'
import { useEnvironmentActivity } from '../hooks/useEnvironmentActivity'
import { useEnvironmentMembers } from '../hooks/useEnvironmentMembers'
import { VaultEnvironmentWorkspace } from '@/features/vault/components/VaultEnvironmentWorkspace'
import { VaultModuleTemplateGallery } from '@/features/vault/components/VaultModuleTemplateGallery'
import { CivicWorkspace } from '@/environments/civic/components/CivicWorkspace'
import { AppsPanel } from '@/features/logicbuilder/components/AppsPanel'
import { BotsPanel } from '@/features/logicbuilder/components/BotsPanel'
import { ProjectsPanel } from '@/features/logicbuilder/components/ProjectsPanel'
import { GrantsPanel } from '@/features/logicbuilder/components/GrantsPanel'
import { BudgetsPanel } from '@/features/logicbuilder/components/BudgetsPanel'
import {
  Cube, AppWindow, Robot, Wrench,
  Lightning, Plugs, FolderSimple, ArrowsClockwise, FileDoc, Sparkle,
  IdentificationCard, ArrowRight, Folder, Tree, Money, Presentation,
  FilePlus, ChartBar, ClipboardText, PuzzlePiece, Brain,
} from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import { ConstituentView } from './ConstituentView'
import { MunicipalAutomationsPanel } from './MunicipalAutomationsPanel'
import { MunicipalTemplatesPanel } from './MunicipalTemplatesPanel'
import type { UserRole } from '../types/environment'
import { useMobileMode } from '@/hooks/useMobileMode'
import { CASESPACE_RETURN_TO_KEY } from '../constants/workspaceNavigation'

/** Count items in localStorage that belong to a specific environment. */
function getEnvItemCount(baseKey: string, envId: string): number {
  try {
    return (JSON.parse(localStorage.getItem(`${baseKey}-${envId}`) ?? '[]') as unknown[]).length
  } catch { return 0 }
}

type WorkspaceTab = 'modules' | 'apps' | 'bots' | 'projects' | 'grants' | 'budgets' | 'tools' | 'saved' | 'automations' | 'templates' | 'constituent'

interface EnvironmentWorkspaceProps {
  environmentId: string
  onBack: () => void
  onSelectTool: (tool: ToolKey) => void
  onOpenConnections?: () => void
  onNewFile?: () => void
  demoLocked?: boolean
  onSignOut?: () => void
}

export function EnvironmentWorkspace({
  environmentId,
  onBack,
  onSelectTool,
  onNewFile,
  demoLocked = false,
  onSignOut,
}: EnvironmentWorkspaceProps) {
  const { user, login } = useAuth()
  const navigate = useNavigate()
  const viewer = useMemo(
    () => user ? { sub: user.sub, email: user.email, name: user.name } : null,
    [user],
  )
  const workspaceState = useEnvironmentWorkspace(environmentId, viewer)
  const environment = workspaceState.status === 'ok' ? workspaceState.environment : null
  const workspaceEnvironmentId = environment?.id ?? null
  const { activities } = useEnvironmentActivity(workspaceEnvironmentId)
  const { members } = useEnvironmentMembers(workspaceEnvironmentId)
  const [showMembers, setShowMembers] = useState(false)
  const [activeTab, setActiveTab] = useState<WorkspaceTab>('modules')
  const [constituentOpen, setConstituentOpen] = useState(false)
  const [envSettingsTrigger, setEnvSettingsTrigger] = useState(0)
  const [modulesTrigger, setModulesTrigger] = useState(0)
  const [vaultModuleView, setVaultModuleView] = useState(false)
  const [, setTick] = useState(0)
  const { isMobile } = useMobileMode()

  // Derive the current user's role from the environment member list
  const userRole: UserRole | undefined = useMemo(() => {
    if (!user) return undefined
    const me = members.find(m => m.email === user.email)
    return me?.role
  }, [members, user])

  const handleSignIn = (provider: 'github' | 'google' | 'microsoft') => {
    const returnTo = `${window.location.pathname}${window.location.search}${window.location.hash}`
    sessionStorage.setItem(CASESPACE_RETURN_TO_KEY, returnTo)
    login(provider)
  }

  // Re-render when apps/bots saved in same tab
  useEffect(() => {
    const refresh = () => setTick(t => t + 1)
    window.addEventListener('storage', refresh)
    return () => window.removeEventListener('storage', refresh)
  }, [])

  useEffect(() => {
    setActiveTab('modules')
    setVaultModuleView(false)
  }, [environment?.type, environmentId])

  if (workspaceState.status === 'loading') {
    return (
      <div className="h-full flex items-center justify-center bg-background">
        <p className="text-muted-foreground text-sm">Loading…</p>
      </div>
    )
  }

  if (workspaceState.status === 'unauthenticated') {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-4 bg-background px-6 text-center">
        <div className="space-y-2">
          <p className="text-base font-semibold text-foreground">Sign in to open this casespace.</p>
          <p className="text-muted-foreground text-sm">{workspaceState.message}</p>
          <p className="text-muted-foreground text-sm">We&apos;ll return you to <span className="font-medium text-foreground">/casespaces/{environmentId}</span> after sign-in.</p>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-2">
          <Button size="sm" onClick={() => handleSignIn('github')}>Sign in with GitHub</Button>
          <Button size="sm" variant="outline" onClick={() => handleSignIn('google')}>Sign in with Google</Button>
          <Button size="sm" variant="outline" onClick={() => handleSignIn('microsoft')}>Sign in with Microsoft</Button>
        </div>
        <Button type="button" variant="ghost" size="sm" onClick={onBack}>
          ← Back to Environments
        </Button>
      </div>
    )
  }

  if (workspaceState.status === 'error') {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-4 bg-background px-6 text-center">
        <div className="space-y-2">
          <p className="text-base font-semibold text-foreground">Couldn&apos;t load this casespace.</p>
          <p className="text-muted-foreground text-sm">{workspaceState.message}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={() => void workspaceState.refresh()}>Retry</Button>
          <Button type="button" variant="ghost" size="sm" onClick={onBack}>
            ← Back to Environments
          </Button>
        </div>
      </div>
    )
  }

  if (workspaceState.status === 'empty') {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-4 bg-background px-6 text-center">
        <div className="space-y-2">
          <p className="text-base font-semibold text-foreground">You don&apos;t have any casespaces yet.</p>
          <p className="text-muted-foreground text-sm">
            Open the environments view to create a new casespace or seed the starter workspace for this scope.
          </p>
        </div>
        <Button type="button" size="sm" onClick={onBack}>
          Create or seed a casespace
        </Button>
      </div>
    )
  }

  if (workspaceState.status === 'not_found') {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-3 bg-background">
        <p className="text-muted-foreground text-sm">Environment not found.</p>
        <Button type="button" variant="ghost" size="sm" onClick={onBack}>
          ← Back to Environments
        </Button>
      </div>
    )
  }

  if (!environment) {
    return (
      <div className="h-full flex items-center justify-center bg-background">
        <p className="text-muted-foreground text-sm">Loading…</p>
      </div>
    )
  }

  const activeEnvironmentId = environment.id

  if (isSuttonRestrictedUser(user) && !isSuttonEnvironment(environment)) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-3 bg-background">
        <p className="text-muted-foreground text-sm">This login is restricted to the Sutton environment.</p>
        <button type="button" className="text-primary text-sm underline" onClick={onBack}>
          ← Back to Sutton
        </button>
      </div>
    )
  }

  // Civic environments get their own focused workspace
  if (environment.town && environment.id.startsWith('civic-')) {
    return <CivicWorkspace environment={environment} onBack={onBack} />
  }

  const isVault = environment.type === 'vault'
  const showMunicipalFlow = isVault

  // Live counts for org-chart feel in tab labels
  const appCount   = getEnvItemCount('appforge-apps',       activeEnvironmentId)
  const botCount   = getEnvItemCount('studio-bots',         activeEnvironmentId)
  const projCount  = getEnvItemCount('builder-projects',    activeEnvironmentId)
  const grantCount = getEnvItemCount('builder-grants',      activeEnvironmentId)
  const budgetCount= getEnvItemCount('builder-budgets',     activeEnvironmentId)
  const modCount  = environment.vaultModuleIds?.length ?? 0

  const TABS: { id: WorkspaceTab; label: string; mobileLabel?: string; count?: number; icon: React.ReactNode }[] = showMunicipalFlow
    ? [
        { id: 'modules',      label: 'Cases',       mobileLabel: 'Cases',     icon: <Cube size={13} weight="duotone" /> },
        { id: 'apps',         label: 'Apps',         count: appCount || undefined, icon: <AppWindow size={13} weight="duotone" /> },
        { id: 'bots',         label: 'Assistants',   count: botCount || undefined, icon: <Robot size={13} weight="duotone" /> },
        { id: 'projects',     label: 'Projects',     count: projCount || undefined, icon: <Folder size={13} weight="duotone" /> },
        { id: 'grants',       label: 'Grants',       count: grantCount || undefined, icon: <Tree size={13} weight="duotone" /> },
        { id: 'budgets',      label: 'Budgets',      count: budgetCount || undefined, icon: <Money size={13} weight="duotone" /> },
        { id: 'automations',  label: 'Automations',  icon: <Lightning size={13} weight="duotone" /> },
        { id: 'saved',        label: 'Templates',    mobileLabel: 'Templates', icon: <FileDoc size={13} weight="duotone" /> },
        { id: 'templates',    label: 'Add Modules',  mobileLabel: 'Modules',   icon: <Sparkle size={13} weight="duotone" /> },
      ]
    : [
        { id: 'modules',   label: 'Home',       count: modCount || undefined, icon: <Cube size={13} weight="duotone" /> },
        { id: 'apps',      label: 'Apps',        count: appCount || undefined, icon: <AppWindow size={13} weight="duotone" /> },
        { id: 'bots',      label: 'Assistants',  count: botCount || undefined, icon: <Robot size={13} weight="duotone" /> },
        { id: 'projects',  label: 'Projects',    count: projCount || undefined, icon: <Folder size={13} weight="duotone" /> },
        { id: 'grants',    label: 'Grants',      count: grantCount || undefined, icon: <Tree size={13} weight="duotone" /> },
        { id: 'budgets',   label: 'Budgets',     count: budgetCount || undefined, icon: <Money size={13} weight="duotone" /> },
        { id: 'tools',     label: 'Work tools',  icon: <Wrench size={13} weight="duotone" /> },
        { id: 'templates', label: 'Modules',     icon: <Sparkle size={13} weight="duotone" /> },
      ]

  const TAB_GUIDE: Record<WorkspaceTab, { title: string; description: string; actionLabel?: string; onAction?: () => void }> = {
    modules: showMunicipalFlow
      ? { title: 'Cases and governed work', description: 'Open the active modules in this workspace and start the work your team handles here.' }
      : { title: 'Workspace home', description: 'Start here to see the main modules, recent activity, and who is active in this workspace.' },
    apps: {
      title: 'Apps built for this team',
      description: 'Custom apps for internal workflows, dashboards, and service tools scoped to this environment.',
    },
    bots: {
      title: 'Assistants and helpers',
      description: 'Bots handle guided responses, scripted help, and routine staff support for this environment.',
    },
    tools: {
      title: 'Tools active in this workspace',
      description: 'Open the tool that matches the work — start with Vault for documents, Intake for incoming requests, Flows for automation.',
    },
    projects: {
      title: 'Projects',
      description: 'Track capital improvements, infrastructure work, and department initiatives scoped to this environment.',
    },
    grants: {
      title: 'Grants',
      description: 'Track grant opportunities, applications, and active awards for this environment.',
    },
    budgets: {
      title: 'Budgets',
      description: 'Track department budgets, fiscal years, and line-item breakdowns for this environment.',
    },
    saved: showMunicipalFlow
      ? { title: 'Templates and saved items', description: 'Use templates to repeat common town work without rebuilding it every time.' }
      : { title: 'Saved files', description: 'Review the files and saved outputs attached to this workspace.' },
    automations: {
      title: 'Automations',
      description: 'Set reminders, routing, and follow-up rules so work keeps moving without dropped handoffs.',
    },
    templates: {
      title: 'Module gallery',
      description: showMunicipalFlow
        ? 'Browse and deploy pre-configured governance modules — deadlines, workflows, and compliance built in.'
        : 'Turn on proven modules and starter frameworks inside this workspace.',
    },
    constituent: {
      title: 'Constituent management',
      description: 'Manage resident-facing records and interactions for this workspace.',
    },
  }

  return (
    <div className="flex-1 h-full min-h-0 flex flex-col bg-background overflow-hidden relative">
      <WorkspaceHeader
        environment={environment}
        userRole={userRole}
        onBack={onBack}
        onMembers={() => setShowMembers(v => !v)}
        onSettings={() => { setActiveTab('modules'); setEnvSettingsTrigger(t => t + 1) }}
        demoLocked={demoLocked}
        onSignOut={onSignOut}
        minimal={isMobile}
        onConstituents={showMunicipalFlow ? () => setConstituentOpen(v => !v) : undefined}
        constituentActive={constituentOpen}
      />

      {/* Tab bar — org chart depth nav */}
        <div className="flex items-center gap-0.5 overflow-x-auto px-2 sm:px-3 border-b border-border shrink-0 bg-muted/[0.04] shadow-[inset_0_-1px_0_oklch(0_0_0_/_0.03)]">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-1.5 whitespace-nowrap px-2.5 sm:px-3 py-2 text-[11px] sm:text-xs font-medium border-b-2 transition-colors ${
              activeTab === tab.id
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab.icon}
            <span className="sm:hidden">{tab.mobileLabel ?? tab.label}</span>
            <span className="hidden sm:inline">{tab.label}</span>
            {tab.count !== undefined && (
              <span className={`ml-0.5 text-[11px] sm:text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                activeTab === tab.id ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground'
              }`}>
                {tab.count}
              </span>
            )}
          </button>
         ))}
         </div>

      <div className="border-b border-border bg-card/60 px-4 py-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-sm font-semibold text-foreground">{TAB_GUIDE[activeTab].title}</div>
            <p className="text-xs text-muted-foreground">{TAB_GUIDE[activeTab].description}</p>
          </div>
          {TAB_GUIDE[activeTab].actionLabel && TAB_GUIDE[activeTab].onAction && (
            <Button variant="outline" size="sm" className="gap-1.5 self-start" onClick={TAB_GUIDE[activeTab].onAction}>
              {TAB_GUIDE[activeTab].actionLabel}
              <ArrowRight size={13} />
            </Button>
          )}
        </div>
      </div>

      {showMunicipalFlow && activeTab === 'automations' && (
        <MunicipalAutomationsPanel envId={activeEnvironmentId} town={environment.name} />
      )}

      {showMunicipalFlow && activeTab === 'saved' && (
        <MunicipalTemplatesPanel town={environment.name} />
      )}

      {constituentOpen && (
        <div className="absolute inset-0 z-20 flex flex-col bg-background transition-all duration-200 ease-out animate-in fade-in slide-in-from-right-2">
          <div className="flex items-center gap-3 px-4 py-2.5 border-b bg-background shrink-0">
            <button
              onClick={() => setConstituentOpen(false)}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1.5"
            >
              <IdentificationCard size={14} />
              ← Back to {environment.name}
            </button>
            <span className="text-xs font-semibold text-foreground ml-2">Constituent Management</span>
          </div>
          <div className="flex-1 min-h-0 overflow-hidden">
            <ConstituentView demoEmail={user?.email} municipalityName={environment.name} />
          </div>
        </div>
      )}

      {/* Vault module workspace overlay — opens when user clicks a module tile in a non-vault environment */}
      {!showMunicipalFlow && vaultModuleView && (
        <div className="absolute inset-0 z-20 flex flex-col bg-background animate-in slide-in-from-right-2 duration-200">
          <div className="flex items-center gap-3 px-4 py-2.5 border-b bg-background shrink-0">
            <button
              onClick={() => setVaultModuleView(false)}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1.5"
            >
              <Cube size={14} />
              ← Back to {environment.name}
            </button>
          </div>
          <div className="flex-1 min-h-0 overflow-hidden">
            <VaultEnvironmentWorkspace
              envId={activeEnvironmentId}
              onBack={() => setVaultModuleView(false)}
            />
          </div>
        </div>
      )}

      {/* Modules / Overview tab */}
      {activeTab === 'modules' && (
        isVault
          ? <div className="flex-1 overflow-hidden">
              <VaultEnvironmentWorkspace envId={activeEnvironmentId} onBack={onBack} envSettingsTrigger={envSettingsTrigger} modulesTrigger={modulesTrigger} />
            </div>
          : <div className="flex-1 flex flex-col overflow-hidden">
              <div className="px-4 py-2 border-b bg-muted/20 flex items-center gap-1.5 overflow-x-auto shrink-0">
                <span className="text-[10px] font-medium text-muted-foreground whitespace-nowrap">Lifecycle:</span>
                {['Intake', 'Record', 'VAULT governs', 'ARCHIEVE retains', 'SEAL proves'].map((s, i, arr) => (
                  <React.Fragment key={s}>
                    <span className="text-[10px] text-muted-foreground/70 whitespace-nowrap">{s}</span>
                    {i < arr.length - 1 && <span className="text-[10px] text-muted-foreground/30">→</span>}
                  </React.Fragment>
                ))}
              </div>
              <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
              <div className="flex-1 min-h-0 overflow-hidden md:border-r">
                <ModuleGrid
                  enabledModuleIds={environment.type === "vault" ? (environment.vaultModuleIds ?? []) : undefined}
                  userRole={userRole}
                  onSelectModule={() => setVaultModuleView(true)}
                  onSelectTool={onSelectTool}
                  onAddModules={() => setActiveTab('templates')}
                />
              </div>
              <div className="hidden md:flex w-80 flex-col gap-4 p-4 overflow-y-auto shrink-0">
                <ActivityFeed activities={activities} />
                {showMembers && (
                  <div className="border-t pt-4">
                    <MemberPanel members={members} currentUserRole={userRole} />
                  </div>
                )}
              </div>
              <div className="flex md:hidden w-full max-h-[38vh] flex-col gap-4 overflow-y-auto border-t bg-muted/10 p-4">
                <ActivityFeed activities={activities} />
                {showMembers && <MemberPanel members={members} currentUserRole={userRole} />}
              </div>
            </div>
            </div>
      )}

      {/* Apps tab — scoped to this environment */}
      {activeTab === 'apps' && (
        <div className="flex-1 overflow-hidden">
          <AppsPanel
            onOpenTool={onSelectTool}
            environmentId={activeEnvironmentId}
          />
        </div>
      )}

      {/* Bots tab — scoped to this environment */}
      {activeTab === 'bots' && (
        <div className="flex-1 overflow-hidden">
          <BotsPanel environmentId={activeEnvironmentId} />
        </div>
      )}

      {/* Projects tab — scoped to this environment */}
      {activeTab === 'projects' && (
        <div className="flex-1 overflow-hidden">
          <ProjectsPanel environmentId={activeEnvironmentId} />
        </div>
      )}

      {/* Grants tab — scoped to this environment */}
      {activeTab === 'grants' && (
        <div className="flex-1 overflow-hidden">
          <GrantsPanel environmentId={activeEnvironmentId} />
        </div>
      )}

      {/* Budgets tab — scoped to this environment */}
      {activeTab === 'budgets' && (
        <div className="flex-1 overflow-hidden">
          <BudgetsPanel environmentId={activeEnvironmentId} />
        </div>
      )}

      {/* Tools tab */}
      {activeTab === 'tools' && (
        <div className="flex-1 min-h-0 overflow-y-auto p-6 space-y-6">

          {/* Create & Edit */}
          <div>
            <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 mb-3">Create & Edit</div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 max-w-3xl">
              <ToolTile
                icon={<FilePlus size={20} className="text-primary" />}
                label="New File"
                description="Create a document, script, or note and save to any destination"
                onClick={onNewFile}
              />
              <ToolTile
                icon={<PuzzlePiece size={20} className="text-violet-500" />}
                label="Builder"
                description="Low-code app and module builder"
                onClick={() => onSelectTool('builder')}
              />
              <ToolTile
                icon={<FileDoc size={20} className="text-sky-500" />}
                label="FormKey"
                description="Public intake forms and resident portals"
                onClick={() => onSelectTool('formkey')}
              />
            </div>
          </div>

          {/* Intelligence */}
          <div>
            <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 mb-3">Intelligence</div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 max-w-3xl">
              <ToolTile
                icon={<ChartBar size={20} className="text-emerald-500" />}
                label="LogicDASH"
                description="MA fiscal intelligence — town budget and staff data"
                onClick={() => navigate('/dev')}
              />
              <ToolTile
                icon={<Brain size={20} className="text-amber-500" />}
                label="GovAI"
                description="AI-assisted governance tools and decision support"
                onClick={() => onSelectTool('govai')}
              />
              <ToolTile
                icon={<ClipboardText size={20} className="text-rose-500" />}
                label="Audit Log"
                description="Full governance audit trail for this environment"
                onClick={() => onSelectTool('audit')}
              />
            </div>
          </div>

          {/* Integrations */}
          <div>
            <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 mb-3">Integrations & Workflow</div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 max-w-3xl">
              <ToolTile
                icon={<IdentificationCard size={20} className="text-rose-500" />}
                label="Records Requests"
                description="Manage and track public records requests"
                onClick={() => onSelectTool('records')}
              />
              <ToolTile
                icon={<Lightning size={20} className="text-orange-500" />}
                label="Automations"
                description="Event-response automation — triggers and action chains"
                onClick={() => onSelectTool('automations')}
              />
              <ToolTile
                icon={<Plugs size={20} className="text-indigo-500" />}
                label="LogicBridge"
                description="Connect external systems and data feeds"
                onClick={() => onSelectTool('logicbridge')}
              />
              <ToolTile
                icon={<ArrowsClockwise size={20} className="text-violet-500" />}
                label="Syncronate"
                description="Pull data from external sources into governed records"
                onClick={() => onSelectTool('syncronate')}
              />
              <ToolTile
                icon={<FolderSimple size={20} className="text-sky-500" />}
                label="Vault"
                description="Governed storage with ARCHIEVE retention"
                onClick={() => onSelectTool('vault')}
              />
              <ToolTile
                icon={<ArrowRight size={20} className="text-emerald-500" />}
                label="Intake"
                description="Normalize and route all incoming channels"
                onClick={() => onSelectTool('intake')}
              />
              <ToolTile
                icon={<Presentation size={20} className="text-[#2C5F2D]" />}
                label="Live Demo"
                description="Explore the full PublicLogic V1 governance demo"
                onClick={() => navigate('/demo')}
              />
            </div>
          </div>
        </div>
      )}

      {/* Templates tab — module gallery for all environment types */}
      {activeTab === 'templates' && (
        <div className="flex-1 min-h-0 overflow-hidden">
          <VaultModuleTemplateGallery
            envId={activeEnvironmentId}
            currentModuleIds={environment.vaultModuleIds ?? []}
            municipalityName={environment.name}
            onDeployed={(_moduleId, updatedEnvironment) => {
              workspaceState.setEnvironment(updatedEnvironment)
              setModulesTrigger(t => t + 1)
              setActiveTab('modules')
            }}
          />
        </div>
      )}
    </div>
  )
}
