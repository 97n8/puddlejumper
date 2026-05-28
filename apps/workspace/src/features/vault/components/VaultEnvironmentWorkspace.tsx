/**
 * VaultEnvironmentWorkspace — Production VAULT case management system
 * Enforces statute without discretion per VAULT Core Canon
 */
import { useState, useCallback, useEffect } from 'react'
import { useKV } from '@/hooks/useKV'
import { Buildings, ArrowLeft } from '@phosphor-icons/react'
import type { VaultCase, VaultModuleSettings, ArchiveEntry } from '../types'
import type { CaseSpace } from '@/lib/types'
import { getBuilderSession } from '@/lib/vault-modules'
import { calendarDaysUntil, isOverdue } from '../utils/deadlines'
import { listCaseSpaces } from '@/services/casespaceApi'
import { defaultSettings, downloadArtifact } from '../utils/vaultHelpers'
import { ModuleDashboard } from './ModuleDashboard'
import { CaseList } from './CaseList'
import { CaseIntake } from './CaseIntake'
import { CaseDetail } from './CaseDetail'
import { ApprovalsQueue } from './ApprovalsQueue'
import { ArchiveEngine } from './ArchiveEngine'
import { ModuleSettingsView } from './ModuleSettingsView'
import { TownProfilePanel } from './TownProfilePanel'
import { useVaultSeedEffects } from '../hooks/useVaultSeedEffects'
import { useVaultExports } from '../hooks/useVaultExports'
import { AdminDashboardPanel } from './AdminDashboardPanel'
import { VaultEnvironmentSettingsPanel } from './VaultEnvironmentSettingsPanel'

type View = 'modules' | 'cases' | 'intake' | 'detail' | 'settings' | 'archive' | 'approvals' | 'env-settings' | 'town-profile'

// ─── MAIN WORKSPACE ────────────────────────────────────────────────────────────

interface Props {
  envId: string
  onBack: () => void
  envSettingsTrigger?: number
  modulesTrigger?: number
}

export function VaultEnvironmentWorkspace({ envId, onBack, envSettingsTrigger, modulesTrigger }: Props) {
  const [view, setView] = useState<View>('modules')
  const [activeModuleId, setActiveModuleId] = useState<string | null>(null)
  const [activeCaseId, setActiveCaseId] = useState<string | null>(null)
  const [exportBusyId, setExportBusyId] = useState<string | null>(null)

  // Allow parent to trigger env-settings navigation (e.g. settings gear in header)
  useEffect(() => {
    if (envSettingsTrigger && envSettingsTrigger > 0) setView('env-settings')
  }, [envSettingsTrigger])

  const [allCases, setAllCases] = useKV<VaultCase[]>(`vault-cases-${envId}`, [])
  const [allSettings, setAllSettings] = useKV<Record<string, VaultModuleSettings>>(`vault-settings-${envId}`, {})
  const [casespaces, setCasespaces] = useState<CaseSpace[]>([])
  useEffect(() => {
    const CACHE_KEY = 'casespaces:list'
    const CACHE_TTL = 5 * 60 * 1000
    async function loadCaseSpaces(bust = false) {
      if (!bust) {
        try {
          const cached = sessionStorage.getItem(CACHE_KEY)
          if (cached) {
            const { data, ts } = JSON.parse(cached) as { data: CaseSpace[]; ts: number }
            if (Date.now() - ts < CACHE_TTL) { setCasespaces(data); return }
          }
        } catch { /* ignore */ }
      } else {
        try { sessionStorage.removeItem(CACHE_KEY) } catch { /* ignore */ }
      }
      try {
        const data = await listCaseSpaces()
        setCasespaces(data)
        try { sessionStorage.setItem(CACHE_KEY, JSON.stringify({ data, ts: Date.now() })) } catch { /* quota */ }
      } catch { /* network error — leave casespaces empty */ }
    }
    void loadCaseSpaces(modulesTrigger !== undefined && modulesTrigger > 0)
  }, [modulesTrigger])
  const [archiveLog, setArchiveLog] = useKV<ArchiveEntry[]>(`vault-archive-log-${envId}`, [])

  // Normalize old cases that may be missing fields added after initial creation
  const normalizedCases: VaultCase[] = (allCases || []).map(c => ({
    ...c,
    assets: c.assets ?? [],
    auditLog: c.auditLog ?? [],
    deadlines: c.deadlines ?? {},
    processing: c.processing ?? {},
    approvals: c.approvals ?? [],
    scopeHistory: c.scopeHistory ?? [],
    subject: c.subject ?? {},
  }))

  const caseSpace = (casespaces || []).find(cs => cs.id === envId)
  // Fall back to builder session for environments not in the API (e.g. localStorage-only demos)
  const builderSession = !caseSpace ? getBuilderSession(envId) : undefined
  const town = caseSpace?.town ?? builderSession?.brandConfig?.displayName ?? builderSession?.town ?? 'Your Town'
  // Normalize any legacy LOGICVILLE* IDs to canonical VAULT* IDs (server may still have old values)
  const modules = (caseSpace?.vaultModuleIds ?? builderSession?.selectedModuleIds ?? []).map(m =>
    m.startsWith('LOGICVILLE') ? m.replace('LOGICVILLE', 'VAULT') : m
  )

  useVaultSeedEffects({ envId, allSettings, allCases, setAllSettings, setAllCases, setCasespaces, casespaces })

  // Get connector destination from builder session
  // Get connector destination from builder session
  const connectorSession = caseSpace ? getBuilderSession(caseSpace.id.replace('vault-', '')) : (builderSession ?? null)
  const getConnector = (moduleId: string): string => {
    const routes = connectorSession?.configs?.[moduleId]?.connectorRoutes as Record<string, string> | undefined
    return routes?.['documents'] ?? 'none'
  }

  const actor = 'staff@' + town.toLowerCase().replace(/\s/g, '') + '.gov'

  const updateCase = useCallback((updated: VaultCase) => {
    setAllCases(prev => {
      const idx = prev.findIndex(c => c.id === updated.id)
      if (idx === -1) return [...prev, updated]
      return prev.map(c => c.id === updated.id ? updated : c)
    })
  }, [setAllCases])

  const addCase = useCallback((c: VaultCase) => {
    setAllCases(prev => [...prev, { ...c, envId }])
    setActiveCaseId(c.id)
    setView('detail')
  }, [setAllCases, envId])

  const addArchiveEntry = useCallback((entry: ArchiveEntry) => {
    setArchiveLog(prev => [...prev, entry])
  }, [setArchiveLog])

  const getSettings = (moduleId: string): VaultModuleSettings =>
    allSettings[moduleId] ?? defaultSettings(moduleId, envId)

  const saveSettings = (moduleId: string, s: VaultModuleSettings) =>
    setAllSettings(prev => ({ ...prev, [moduleId]: s }))

  const moduleCases = activeModuleId ? normalizedCases.filter(c => c.moduleId === activeModuleId) : []
  const activeCase = activeCaseId ? normalizedCases.find(c => c.id === activeCaseId) : null

  const { createPublicFormArtifact, handleCopyExecutiveUpdate, handleDownloadPublicForms, handleExportOperationsPack, handleExportArchivePacket } = useVaultExports({
    envId, town, modules, normalizedCases, allSettings, exportBusyId, setExportBusyId
  })

  // ── Admin overview (replaces old demo bar) ────────────────────────────────
  const openCasesForOverview = normalizedCases.filter(c => c.currentStage !== 'CLOSED')
  const dueThisWeekCases = openCasesForOverview.filter(c =>
    Object.values(c.deadlines).some(d => {
      if (d.status !== 'OPEN' || !d.dueDate) return false
      const days = calendarDaysUntil(d.dueDate)
      return days >= 0 && days <= 7
    })
  )
  const pendingApprovalCases = normalizedCases.filter(c =>
    c.currentStage === 'REVIEW' || c.currentStage === 'RESPONSE' || c.currentStage === 'APPROVAL'
  )
  const overdueCasesForOverview = openCasesForOverview.filter(c =>
    Object.values(c.deadlines).some(d => d.status === 'OPEN' && d.dueDate && isOverdue(d.dueDate))
  )
  const thirtyDaysAgo = Date.now() - 30 * 86400000
  const closedThisMonth = normalizedCases.filter(c => c.currentStage === 'CLOSED' && c.closedAt != null && c.closedAt >= thirtyDaysAgo)
  const urgentCases = openCasesForOverview
    .filter(c => Object.values(c.deadlines).some(d => d.status === 'OPEN' && d.dueDate && calendarDaysUntil(d.dueDate) <= 3))
    .sort((a, b) => {
      const minDays = (c: VaultCase) => Math.min(...Object.values(c.deadlines).filter(d => d.status === 'OPEN' && d.dueDate).map(d => calendarDaysUntil(d.dueDate)))
      return minDays(a) - minDays(b)
    })

  return (
    <div className="flex flex-col h-full w-full bg-background text-foreground">
      {/* Environment header */}
      <div className="flex shrink-0 items-center gap-2 overflow-x-auto border-b border-slate-800/70 bg-[linear-gradient(135deg,#0f172a_0%,#111827_60%,#172554_100%)] px-3 py-1 sm:gap-4 sm:px-5">
        <button aria-label="Go back" onClick={onBack} className="flex-shrink-0 p-2 text-slate-400 transition-colors hover:text-white -ml-2">
          <ArrowLeft size={16} />
        </button>
        <div className="flex items-center gap-2.5 py-3 flex-shrink-0">
          <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl border border-indigo-300/30 bg-indigo-400/12">
            <Buildings size={14} className="text-indigo-200" />
          </div>
          <div>
            <div className="text-sm font-semibold leading-tight text-white">{town}</div>
            <div className="text-[10px] font-medium uppercase tracking-widest leading-tight text-indigo-200/80">Municipal Operations</div>
          </div>
        </div>

        {/* Stats pills — hidden on mobile */}
        <div className="hidden flex-shrink-0 items-center gap-2 border-l border-white/10 pl-3 sm:flex">
          <span className="rounded-full border border-white/10 bg-white/6 px-2.5 py-1 text-[11px] text-slate-200">{openCasesForOverview.length} open</span>
          {urgentCases.length > 0 && <span className="rounded-full border border-amber-300/25 bg-amber-400/10 px-2.5 py-1 text-[11px] text-amber-200">{urgentCases.length} urgent</span>}
          {overdueCasesForOverview.length > 0 && <span className="rounded-full border border-rose-300/25 bg-rose-400/10 px-2.5 py-1 text-[11px] text-rose-200">{overdueCasesForOverview.length} overdue</span>}
        </div>

        {/* Nav tabs — flush to bottom border */}
        <nav className="flex items-stretch gap-0.5 ml-auto self-stretch flex-shrink-0">
          {view !== 'modules' && (
            <button onClick={() => { setView('modules'); setActiveModuleId(null); setActiveCaseId(null) }}
              className="border-b-2 border-transparent px-3 text-xs font-medium text-slate-400 transition-all hover:border-white/30 hover:text-white">
              ← Modules
            </button>
          )}
          <button onClick={() => setView('approvals')}
            className={`flex items-center gap-1.5 border-b-2 px-3 text-xs font-medium transition-all ${view === 'approvals' ? 'border-indigo-300 bg-white/8 text-white' : 'border-transparent text-slate-400 hover:border-white/20 hover:text-white'}`}>
            Approvals
            {normalizedCases.filter(c => c.currentStage === 'REVIEW' || c.currentStage === 'RESPONSE').length > 0 && (
              <span className="bg-indigo-500 text-white rounded-full px-1.5 text-[10px] font-bold leading-4">
                {normalizedCases.filter(c => c.currentStage === 'REVIEW' || c.currentStage === 'RESPONSE').length}
              </span>
            )}
          </button>
          <button onClick={() => setView('archive')}
            className={`border-b-2 px-3 text-xs font-medium transition-all ${view === 'archive' ? 'border-emerald-300 bg-white/8 text-white' : 'border-transparent text-slate-400 hover:border-white/20 hover:text-white'}`}>
            Archive
          </button>
          <button onClick={() => setView('town-profile')}
            className={`border-b-2 px-3 text-xs font-medium transition-all ${view === 'town-profile' ? 'border-sky-300 bg-white/8 text-white' : 'border-transparent text-slate-400 hover:border-white/20 hover:text-white'}`}>
            Town
          </button>
          <button onClick={() => setView('env-settings')}
            className={`border-b-2 px-3 text-xs font-medium transition-all ${view === 'env-settings' ? 'border-white/40 bg-white/8 text-white' : 'border-transparent text-slate-400 hover:border-white/20 hover:text-white'}`}>
            ⚙ Settings
          </button>
        </nav>
      </div>

      {/* View routing */}
      {view === 'modules' && (
        <ModuleDashboard
          modules={modules}
          cases={normalizedCases}
          allSettings={allSettings}
          hero={
            <AdminDashboardPanel
              town={town}
              modules={modules}
              openCases={openCasesForOverview}
              dueThisWeek={dueThisWeekCases}
              pendingApproval={pendingApprovalCases}
              overdueCases={overdueCasesForOverview}
              closedThisMonth={closedThisMonth}
              urgentCases={urgentCases}
              totalCasesCount={normalizedCases.length}
              exportBusyId={exportBusyId}
              onNewCase={() => { setActiveModuleId(modules[0]); setView('intake') }}
              onViewApprovals={() => setView('approvals')}
              onCopyUpdate={handleCopyExecutiveUpdate}
              onDownloadForms={handleDownloadPublicForms}
              onExportOps={handleExportOperationsPack}
              onExportArchive={handleExportArchivePacket}
              onCaseClick={(caseId, moduleId) => { setActiveModuleId(moduleId); setActiveCaseId(caseId); setView('detail') }}
            />
          }
          onSelect={mid => { setActiveModuleId(mid); setView('cases') }}
          onSettings={mid => { setActiveModuleId(mid); setView('settings') }}
          onPublicForm={mid => {
            const artifact = createPublicFormArtifact(mid)
            downloadArtifact(artifact.filename, artifact.content, artifact.mimeType)
          }}
        />
      )}

      {view === 'cases' && activeModuleId && (
        <CaseList
          moduleId={activeModuleId}
          cases={moduleCases}
          onNewCase={() => setView('intake')}
          onOpenCase={id => { setActiveCaseId(id); setView('detail') }}
          onBack={() => setView('modules')}
        />
      )}

      {view === 'intake' && activeModuleId && (
        <CaseIntake
          moduleId={activeModuleId}
          settings={getSettings(activeModuleId)}
          existingCases={moduleCases}
          actor={actor}
          onSubmit={addCase}
          onBack={() => setView('cases')}
        />
      )}

      {view === 'detail' && activeCase && activeModuleId && (
        <CaseDetail
          vaultCase={activeCase}
          settings={getSettings(activeModuleId)}
          actor={actor}
          connectorProvider={getConnector(activeModuleId)}
          onUpdate={updateCase}
          onBack={() => { setActiveCaseId(null); setView('cases') }}
        />
      )}

      {view === 'settings' && activeModuleId && (
        <ModuleSettingsView
          moduleId={activeModuleId}
          settings={getSettings(activeModuleId)}
          onSave={s => { saveSettings(activeModuleId, s); setView('modules') }}
          onBack={() => setView('modules')}
        />
      )}

      {view === 'archive' && (
        <ArchiveEngine
          envId={envId}
          town={town}
          allCases={normalizedCases}
          archiveLog={archiveLog}
          getConnector={getConnector}
          onArchive={addArchiveEntry}
          onBack={() => setView('modules')}
        />
      )}

      {view === 'approvals' && (
        <ApprovalsQueue
          allCases={normalizedCases}
          town={town}
          onOpenCase={(caseId) => {
            setActiveCaseId(caseId)
            const c = normalizedCases.find(x => x.id === caseId)
            if (c) setActiveModuleId(c.moduleId)
            setView('detail')
          }}
        />
      )}

      {view === 'env-settings' && (
        <VaultEnvironmentSettingsPanel
          town={town}
          envId={envId}
          caseSpace={caseSpace}
          modules={modules}
          normalizedCases={normalizedCases}
          onModuleSettings={modId => { setActiveModuleId(modId); setView('settings') }}
        />
      )}

      {view === 'town-profile' && (
        <TownProfilePanel town={town} />
      )}
    </div>
  )
}
