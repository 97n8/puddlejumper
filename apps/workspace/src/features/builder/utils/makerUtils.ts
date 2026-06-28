import {
  VAULT_MODULES,
  MA_TOWNS,
  type BuilderSession,
  type BuilderDraftState,
  type VaultModule,
  type ModuleConfig,
} from '@/lib/vault-modules'
import type {
  Provider, WorkflowTeamSize, ActiveStep, Step,
  ModuleSetup, MakerState, MunicipalContext,
} from '../types'
import type { Municipality } from '@/data/maMunicipalities'

export const BLANK_STATE: MakerState = { town: '', workflowTeamSize: '', selectedIds: [], setups: {} }

export const STEP_ORDER: ActiveStep[] = ['town', 'configure', 'review', 'done']

export const WORKFLOW_TEAM_OPTIONS: Array<{ value: WorkflowTeamSize; label: string; hint: string }> = [
  { value: '1',   label: '1',   hint: 'Single owner' },
  { value: '2-3', label: '2–3', hint: 'Small office' },
  { value: '4-8', label: '4–8', hint: 'Shared staff' },
  { value: '9+',  label: '9+',  hint: 'Cross-department' },
]

export const DOMAIN_BADGE: Record<string, string> = {
  'Public Records':  'bg-blue-100 text-blue-800 border-blue-200',
  'Clerk Ops':       'bg-purple-100 text-purple-800 border-purple-200',
  'Fiscal':          'bg-emerald-100 text-emerald-800 border-emerald-200',
  'Payroll':         'bg-orange-100 text-orange-800 border-orange-200',
  'Facilities':      'bg-yellow-100 text-yellow-800 border-yellow-200',
  'Onboarding':      'bg-teal-100 text-teal-800 border-teal-200',
  'Permits':         'bg-amber-100 text-amber-800 border-amber-200',
  'Human Resources': 'bg-rose-100 text-rose-800 border-rose-200',
  'Procurement':     'bg-indigo-100 text-indigo-800 border-indigo-200',
  'Records':         'bg-sky-100 text-sky-800 border-sky-200',
  'Meetings':        'bg-violet-100 text-violet-800 border-violet-200',
}

export const DOMAIN_ACCENT: Record<string, string> = {
  'Public Records':  '#3b82f6',
  'Clerk Ops':       '#a855f7',
  'Fiscal':          '#10b981',
  'Payroll':         '#f97316',
  'Facilities':      '#eab308',
  'Onboarding':      '#14b8a6',
  'Permits':         '#f59e0b',
  'Human Resources': '#f43f5e',
  'Procurement':     '#6366f1',
  'Records':         '#0ea5e9',
  'Meetings':        '#8b5cf6',
}

export const MODULE_EMOJI: Record<string, string> = {
  VAULTPRR:     '📋',
  VAULTCLERK:   '🏛️',
  VAULTFISCAL:  '💰',
  VAULTTIME:    '⏱️',
  VAULTFIX:     '🔧',
  VAULTONBOARD: '👥',
  VAULTPERMIT:  '📄',
  VAULTHR:      '🗂️',
  VAULTPROCURE: '📦',
  VAULTRECS:    '🗃️',
  VAULTMEET:    '📅',
}

export const OFFICER_TITLE: Record<string, string> = {
  VAULTPRR:     'Records Access Officer',
  VAULTCLERK:   'Town Clerk',
  VAULTFISCAL:  'Finance Director',
  VAULTTIME:    'Town Accountant',
  VAULTFIX:     'Director of Public Works',
  VAULTONBOARD: 'HR Director',
  VAULTPERMIT:  'Building Commissioner',
  VAULTHR:      'HR Director',
  VAULTPROCURE: 'Procurement Officer',
  VAULTRECS:    'Records Manager',
  VAULTMEET:    'Town Clerk',
}

export function normalizeStep(step: Step): ActiveStep {
  return step === 'modules' ? 'town' : step
}

export function stepIndex(s: Step | ActiveStep) {
  return STEP_ORDER.indexOf(normalizeStep(s as Step))
}

export function formatMoney(value: number | null) {
  if (value === null) return '—'
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value)
}

export function buildCivicSourceLinks(town: string) {
  const query = (suffix: string) => `https://duckduckgo.com/?q=${encodeURIComponent(`${town} Massachusetts ${suffix}`)}`

  return [
    { label: 'Minutes + agendas', url: query('official site CivicPlus minutes agendas') },
    { label: 'Policies + bylaws', url: query('official site bylaws policies charter') },
    { label: 'Boards + notices', url: query('official site boards committees meeting notices') },
  ]
}

export function recommendedMunicipalModuleIds(context: MunicipalContext | null, municipality: Municipality | null) {
  const ids = ['VAULTMEET', 'VAULTRECS', 'VAULTPRR']

  if ((context?.operatingBudget ?? 0) > 10_000_000) ids.push('VAULTFISCAL', 'VAULTPROCURE')
  if ((context?.totalEmployees ?? 0) > 75 || (context?.salariesPctBudget ?? 0) > 40) ids.push('VAULTTIME', 'VAULTHR')
  if ((municipality?.population ?? 0) > 7000) ids.push('VAULTPERMIT')
  if ((municipality?.population ?? 0) > 12000) ids.push('VAULTCLERK')

  return Array.from(new Set(ids))
}

export function withToggledModule(state: MakerState, id: string) {
  const selectedIds = state.selectedIds.includes(id)
    ? state.selectedIds.filter(item => item !== id)
    : [...state.selectedIds, id]
  const setups = { ...state.setups }
  if (!selectedIds.includes(id)) {
    delete setups[id]
  } else if (!setups[id]) {
    const module = VAULT_MODULES.find(item => item.id === id)
    if (module) setups[id] = defaultSetup(module, state.town)
  }

  return { ...state, selectedIds, setups }
}

export function withRecommendedModules(state: MakerState, recommendedIds: string[]) {
  const selectedIds = Array.from(new Set([...state.selectedIds, ...recommendedIds]))
  const setups = { ...state.setups }

  for (const id of recommendedIds) {
    if (!setups[id]) {
      const module = VAULT_MODULES.find(item => item.id === id)
      if (module) setups[id] = defaultSetup(module, state.town)
    }
  }

  return { ...state, selectedIds, setups }
}

export function defaultSetup(m: VaultModule, _town = ''): ModuleSetup {
  const routing: Record<string, Provider> = {}
  const folders: Record<string, string> = {}
  for (const slot of m.routingSlots) {
    routing[slot.key] = 'none'
    folders[slot.key] = ''
  }
  return {
    moduleId: m.id,
    officerName: '',
    officerTitle: OFFICER_TITLE[m.id] ?? '',
    officerEmail: '',
    officerPhone: '',
    routing,
    folders,
    retentionYears: m.defaultRetentionYears,
    workflowSteps: [...m.defaultWorkflowSteps],
    workflowAssignments: {},
    notes: '',
  }
}

export function buildSessionConfigsFromState(state: MakerState): Record<string, ModuleConfig> {
  return Object.fromEntries(
    state.selectedIds.map((id) => {
      const module = VAULT_MODULES.find(item => item.id === id)
      const setup = state.setups[id] ?? (module ? defaultSetup(module, state.town) : null)
      if (!setup) {
        return [id, {
          moduleId: id,
          enforcementMode: 'core',
          primaryApprover: '',
          statutoryBasis: '',
          retentionYears: 7,
          workflowSteps: [],
          connectorRoutes: {},
          notes: '',
          raos: [],
          trainingLinks: [],
          customFields: [],
          sealOnArchive: false,
          legalHoldEligible: false,
          namingPattern: '',
          moduleCode: id,
          track: 'municipal',
          vaultGate: 'foundations',
          encodingPartner: 'none',
          slaDefaultDays: 10,
          slaWarningDays: 7,
          slaExtensionDays: null,
          slaEscalationRoles: [],
          statusLabels: {
            open: 'Open',
            in_progress: 'In Progress',
            pending_approval: 'Pending Approval',
            approved: 'Approved',
            closed: 'Closed',
            archived: 'Archived',
          },
          views: [],
        }]
      }

      return [id, {
        moduleId: id,
        enforcementMode: 'core',
        primaryApprover: setup.officerName,
        statutoryBasis: module?.mglCitation ?? '',
        retentionYears: setup.retentionYears,
        workflowSteps: setup.workflowSteps,
        connectorRoutes: setup.routing,
        notes: setup.notes,
        raos: [],
        trainingLinks: [],
        customFields: [],
        sealOnArchive: false,
        legalHoldEligible: false,
        namingPattern: '',
        moduleCode: id,
        track: 'municipal',
        vaultGate: 'foundations',
        encodingPartner: 'none',
        slaDefaultDays: 10,
        slaWarningDays: 7,
        slaExtensionDays: null,
        slaEscalationRoles: [],
        statusLabels: {
          open: 'Open',
          in_progress: 'In Progress',
          pending_approval: 'Pending Approval',
          approved: 'Approved',
          closed: 'Closed',
          archived: 'Archived',
        },
        views: [],
      }]
    }),
  )
}

export function buildDraftState(state: MakerState, step: ActiveStep): BuilderDraftState {
  return {
    town: state.town,
    workflowTeamSize: state.workflowTeamSize,
    selectedIds: state.selectedIds,
    setups: state.setups,
    activeStep: step === 'done' ? 'review' : step,
  }
}

export function hydrateStateFromSession(session: BuilderSession): { state: MakerState; step: ActiveStep } {
  if (session.draftState) {
    return {
      state: {
        town: session.draftState.town,
        workflowTeamSize: session.draftState.workflowTeamSize,
        selectedIds: session.draftState.selectedIds,
        setups: session.draftState.setups,
      },
      step: session.draftState.activeStep ?? (session.status === 'review' ? 'review' : 'configure'),
    }
  }

  const selectedIds = session.selectedModuleIds
  const setups = Object.fromEntries(
    selectedIds.map((id) => {
      const module = VAULT_MODULES.find(item => item.id === id)
      const base = module ? defaultSetup(module, session.town) : {
        moduleId: id,
        officerName: '',
        officerTitle: '',
        officerEmail: '',
        officerPhone: '',
        routing: {},
        folders: {},
        retentionYears: 7,
        workflowSteps: [],
        workflowAssignments: {},
        notes: '',
      }
      const config = session.configs[id]
      return [id, {
        ...base,
        officerName: config?.primaryApprover ?? base.officerName,
        retentionYears: config?.retentionYears ?? base.retentionYears,
        workflowSteps: config?.workflowSteps ?? base.workflowSteps,
        routing: (config?.connectorRoutes as Record<string, Provider> | undefined) ?? base.routing,
        notes: config?.notes ?? base.notes,
      }]
    }),
  )

  return {
    state: {
      town: session.town,
      workflowTeamSize: '',
      selectedIds,
      setups,
    },
    step: session.status === 'review' || session.status === 'activated' ? 'review' : 'configure',
  }
}

export function suggestFolder(provider: Provider, town: string, moduleName: string, slotLabel: string): string {
  if (provider === 'none') return ''
  const clean = (s: string) => s.replace(/[^a-zA-Z0-9 ]/g, '').trim()
  if (provider === 'sharepoint') {
    return `/VAULT/${clean(town)}/${clean(moduleName)}/${clean(slotLabel)}`
  }
  return `VAULT > ${clean(town)} > ${clean(moduleName)} > ${clean(slotLabel)}`
}

export { MA_TOWNS }
