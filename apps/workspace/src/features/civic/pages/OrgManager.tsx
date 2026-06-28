/**
 * OrgManager — Civic Governance Setup Wizard
 *
 * Immersive 4-step setup for civic governance environments.
 * Mirrors VaultModuleMaker's rich module-selection and configure UI,
 * purpose-built for Massachusetts municipal governance.
 */
import { useState, useEffect, useCallback } from 'react'
import { civicApi } from '../api/civicApi'
import { pjApi, type ConnectorInfo } from '@/services/pjApi'
import {
  Buildings, CheckCircle, ArrowRight, ArrowLeft, Rocket,
  ShieldCheck, Warning, Plus, X, Spinner, User,
} from '@phosphor-icons/react'
import { VAULT_MODULES, type VaultModule } from '@/lib/vault-modules'
import { ModuleConfigureRow, type AutoItem } from '../components/ModuleConfigureRow'
import { DOMAIN_BADGE, DOMAIN_ACCENT, MODULE_EMOJI } from '../constants/design'

const OFFICER_TITLE: Record<string, string> = {
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

// ── Process flows — per-module step-by-step workflow ─────────────────────────

interface ProcessStep {
  label: string
  role: string
  system?: boolean   // fully automatic — no human
  isOfficer?: boolean // this is where the primary officer acts
}

const PROCESS_FLOWS: Record<string, ProcessStep[]> = {
  VAULTFISCAL: [
    { label: 'Vendor submits invoice',              role: 'Intake',               system: true },
    { label: 'Auto-log — FormKey + timestamp',      role: 'System',               system: true },
    { label: 'Assign to Finance Clerk',             role: 'Intake Clerk' },
    { label: 'Department Head approval',            role: 'Department Approver' },
    { label: 'Finance Director review',             role: 'Financial Authority',  isOfficer: true },
    { label: 'Select Board (if > threshold)',       role: 'Oversight Body' },
    { label: 'Payment issued',                      role: 'Financial Authority',  isOfficer: true },
    { label: 'Auto-archive + retention tag',        role: 'System',               system: true },
  ],
  VAULTPRR: [
    { label: 'Request received (web / email / in-person)', role: 'Intake',        system: true },
    { label: 'Assign tracking number + 10-day clock',      role: 'System',        system: true },
    { label: 'Gather responsive records',                  role: 'Records Access Officer', isOfficer: true },
    { label: 'Legal review (if needed)',                   role: 'Town Counsel' },
    { label: 'Redact & prepare for release',               role: 'Records Access Officer', isOfficer: true },
    { label: 'Deliver to requester',                       role: 'System',        system: true },
    { label: 'Auto-archive with seal',                     role: 'System',        system: true },
  ],
  VAULTMEET: [
    { label: 'Meeting scheduled',                  role: 'Town Clerk',           isOfficer: true },
    { label: 'Post public notice (48-hour MGL)',   role: 'System',               system: true },
    { label: 'Build & distribute agenda',          role: 'Meeting Secretary' },
    { label: 'Meeting held & recorded',            role: 'Chair / Moderator' },
    { label: 'Record votes & attendance',          role: 'Town Clerk',           isOfficer: true },
    { label: 'Post minutes (30-day MGL)',          role: 'System',               system: true },
    { label: 'Archive with vote index',            role: 'System',               system: true },
  ],
  VAULTPERMIT: [
    { label: 'Application submitted',              role: 'Intake',               system: true },
    { label: 'Auto-assign permit number',          role: 'System',               system: true },
    { label: 'Plan review',                        role: 'Building Commissioner', isOfficer: true },
    { label: 'Schedule inspection',                role: 'Inspector' },
    { label: 'Inspection sign-off',                role: 'Building Commissioner', isOfficer: true },
    { label: 'Issue permit',                       role: 'System',               system: true },
    { label: 'Archive with fee record',            role: 'System',               system: true },
  ],
  VAULTPROCURE: [
    { label: 'Need identified by department',      role: 'Department Head' },
    { label: 'Determine procurement type (c.30B)', role: 'Procurement Officer',  isOfficer: true },
    { label: 'Bid / quote / sole-source',          role: 'Procurement Officer',  isOfficer: true },
    { label: 'Award recommendation',               role: 'Procurement Officer',  isOfficer: true },
    { label: 'Select Board approval',              role: 'Oversight Body' },
    { label: 'Contract executed',                  role: 'Town Administrator' },
    { label: 'Archive contract & vendor record',   role: 'System',               system: true },
  ],
  VAULTCLERK: [
    { label: 'Record / filing received',           role: 'Intake',               system: true },
    { label: 'Classify & assign retention tag',    role: 'Town Clerk',           isOfficer: true },
    { label: 'Assign to department',               role: 'Town Clerk',           isOfficer: true },
    { label: 'Review & certify',                   role: 'Town Clerk',           isOfficer: true },
    { label: 'File in official record',            role: 'Records Authority' },
    { label: 'Auto-archive with seal',             role: 'System',               system: true },
  ],
  VAULTRECS: [
    { label: 'Record created or received',         role: 'Intake',               system: true },
    { label: 'Classify & assign retention',        role: 'Records Manager',      isOfficer: true },
    { label: 'Department review',                  role: 'Department Head' },
    { label: 'Seal & file',                        role: 'Records Manager',      isOfficer: true },
    { label: 'Auto-archive',                       role: 'System',               system: true },
  ],
  VAULTTIME: [
    { label: 'Invoice / obligation created',       role: 'Intake',               system: true },
    { label: 'Classify fiscal period',             role: 'System',               system: true },
    { label: 'Department review',                  role: 'Department Head' },
    { label: 'Accountant review',                  role: 'Town Accountant',      isOfficer: true },
    { label: 'Approve & post',                     role: 'Finance Director' },
    { label: 'Auto-archive with period tag',       role: 'System',               system: true },
  ],
  VAULTHR: [
    { label: 'Action initiated (hire / change / separate)', role: 'Department Head' },
    { label: 'HR review & documentation',          role: 'HR Director',          isOfficer: true },
    { label: 'Town Administrator approval',        role: 'Town Administrator' },
    { label: 'Personnel file updated',             role: 'HR Director',          isOfficer: true },
    { label: 'Notifications sent',                 role: 'System',               system: true },
    { label: 'Archive with retention tag',         role: 'System',               system: true },
  ],
  VAULTONBOARD: [
    { label: 'New hire confirmed',                 role: 'HR Director',          isOfficer: true },
    { label: 'Onboarding checklist generated',     role: 'System',               system: true },
    { label: 'Department orientation assigned',    role: 'Department Head' },
    { label: 'Systems access provisioned',         role: 'IT / Town Clerk' },
    { label: 'Forms completed',                    role: 'New Employee' },
    { label: 'Archive onboarding packet',          role: 'System',               system: true },
  ],
  VAULTFIX: [
    { label: 'Work order submitted',               role: 'Intake',               system: true },
    { label: 'Priority assigned',                  role: 'DPW Director',         isOfficer: true },
    { label: 'Crew assigned',                      role: 'DPW Director',         isOfficer: true },
    { label: 'Work completed',                     role: 'Field Crew' },
    { label: 'Inspection sign-off',                role: 'DPW Director',         isOfficer: true },
    { label: 'Archive with cost log',              role: 'System',               system: true },
  ],
}

// ── Automations — per-module, toggled during setup ────────────────────────────


const MODULE_AUTOMATIONS: Record<string, AutoItem[]> = {
  VAULTFISCAL: [
    { key: 'formkey',    label: 'Auto-assign FormKey on intake',      detail: 'Every invoice gets a unique tracking number instantly',         defaultOn: true  },
    { key: 'timer30',    label: '30-day payment compliance timer',     detail: 'Alert if invoice sits unapproved beyond 30 days',               defaultOn: true  },
    { key: 'threshold',  label: 'Amount threshold routing',           detail: 'Over $10,000 auto-routes to Select Board',                      defaultOn: true  },
    { key: 'archive',    label: 'Auto-archive on payment',            detail: 'Lock record and apply retention tag at payment',                 defaultOn: true  },
    { key: 'weekly',     label: 'Weekly fiscal snapshot (Friday)',     detail: 'Spend summary, pending items, and at-risk invoices every week',  defaultOn: false },
  ],
  VAULTPRR: [
    { key: 'clock',      label: 'Start 10-day statutory clock',       detail: 'MGL c.66 §10 — clock auto-starts and escalates at day 7',       defaultOn: true  },
    { key: 'notify',     label: 'Auto-notify requester on updates',   detail: 'Status email sent at every stage change',                        defaultOn: true  },
    { key: 'archive',    label: 'Auto-archive fulfilled requests',     detail: 'Seal and file with retention tag on completion',                 defaultOn: true  },
    { key: 'report',     label: 'Monthly PRR compliance report',      detail: 'On-time rate, average days, and volume by type',                 defaultOn: false },
  ],
  VAULTMEET: [
    { key: 'notice',     label: 'Auto-post 48-hour public notice',    detail: 'MGL c.30A — notice posts when meeting is confirmed',             defaultOn: true  },
    { key: 'agenda',     label: 'Distribute agenda 24 hours prior',   detail: 'Auto-email board and post to portal',                            defaultOn: true  },
    { key: 'minutes',    label: '30-day minutes compliance reminder',  detail: 'Alert if minutes not approved within 28 days of meeting',        defaultOn: true  },
    { key: 'archive',    label: 'Auto-archive when minutes approved',  detail: 'Seal vote record and file in official minutes',                  defaultOn: true  },
  ],
  VAULTPERMIT: [
    { key: 'number',     label: 'Auto-assign permit number',          detail: 'Sequential number with year prefix on submission',               defaultOn: true  },
    { key: 'clock',      label: 'Review deadline timer',              detail: 'Alert if permit sits in review past statutory period',            defaultOn: true  },
    { key: 'notify',     label: 'Auto-notify applicant on status',    detail: 'Email sent at each stage transition',                            defaultOn: true  },
    { key: 'archive',    label: 'Auto-archive on issuance',           detail: 'File with fee record and inspection log',                        defaultOn: true  },
  ],
  VAULTPROCURE: [
    { key: 'threshold',  label: 'Bid threshold enforcement',          detail: 'System flags when spend triggers c.30B bid requirements',        defaultOn: true  },
    { key: 'notify',     label: 'Auto-notify vendors on award',       detail: 'Award and rejection notices sent automatically',                 defaultOn: true  },
    { key: 'archive',    label: 'Auto-archive contracts',             detail: 'Seal and file with vendor record on execution',                  defaultOn: true  },
    { key: 'weekly',     label: 'Weekly procurement digest',          detail: 'Open bids, recent awards, and upcoming renewals',                defaultOn: false },
  ],
}

const DEFAULT_AUTOMATIONS: AutoItem[] = [
  { key: 'formkey',  label: 'Auto-assign tracking ID on intake',    detail: 'Every submission gets a unique ID instantly',          defaultOn: true  },
  { key: 'archive',  label: 'Auto-archive on completion',           detail: 'Lock record and apply retention tag on close',         defaultOn: true  },
  { key: 'notify',   label: 'Auto-notify responsible officer',      detail: 'Email when new items arrive or deadlines approach',    defaultOn: true  },
  { key: 'report',   label: 'Monthly activity report',              detail: 'Summary of volume, timing, and open items',            defaultOn: false },
]

function getAutomations(moduleId: string): AutoItem[] {
  return MODULE_AUTOMATIONS[moduleId] ?? DEFAULT_AUTOMATIONS
}

// ── Types ─────────────────────────────────────────────────────────────────────

type Step = 'modules' | 'configure' | 'team' | 'launch'
type Provider = 'sharepoint' | 'google' | 'none'

interface ModuleSetup {
  moduleId: string
  officerName: string
  officerTitle: string
  officerEmail: string
  officerPhone: string
  routing: Record<string, Provider>
  folders: Record<string, string>
  retentionYears: number
}

interface StaffRow { id: string; name: string; email: string; title: string; role: string }
interface BodyRow  { id: string; name: string; type: string; members: string }

const STEP_ORDER: Step[] = ['modules', 'configure', 'team', 'launch']

const LAUNCH_STEPS = ['Saving town profile…', 'Saving staff…', 'Saving governing bodies…', 'Finalizing…'] as const

async function withRetry<T>(fn: () => Promise<T>, maxAttempts = 3): Promise<T> {
  let lastErr: unknown
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try { return await fn() } catch (e) {
      lastErr = e
      if (attempt < maxAttempts - 1) await new Promise(r => setTimeout(r, 800 * Math.pow(2, attempt)))
    }
  }
  throw lastErr
}

const STEP_META: Array<{ id: Step; label: string }> = [
  { id: 'modules',   label: 'Modules'   },
  { id: 'configure', label: 'Configure' },
  { id: 'team',      label: 'Team'      },
  { id: 'launch',    label: 'Launch'    },
]

// ── Helpers ───────────────────────────────────────────────────────────────────

function recommendedIds(population: number): string[] {
  const ids = ['VAULTMEET', 'VAULTRECS', 'VAULTPRR']
  if (population > 7000)  ids.push('VAULTPERMIT')
  if (population > 12000) ids.push('VAULTCLERK')
  return ids
}

function defaultSetup(m: VaultModule): ModuleSetup {
  const routing: Record<string, Provider> = {}
  const folders: Record<string, string>   = {}
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
  }
}


const BODY_TYPE_LABELS: Record<string, string> = {
  select_board:      'Select Board',
  city_council:      'City Council',
  town_council:      'Town Council',
  planning_board:    'Planning Board',
  board_of_health:   'Board of Health',
  conservation:      'Conservation Commission',
  board_of_appeals:  'Board of Appeals',
  school_committee:  'School Committee',
  finance_committee: 'Finance Committee',
}

function defaultBodyName(type: string, town: string): string {
  const label = BODY_TYPE_LABELS[type] ?? type
  return town ? `${town} ${label}` : label
}

/** Returns true if the name looks auto-generated (i.e. "{anything} {typeLabel}") */
function isAutoBodyName(name: string, type: string): boolean {
  const label = BODY_TYPE_LABELS[type] ?? type
  return name.trim().endsWith(label)
}

function detectBoardType(policyBoard: string | undefined): string {
  const s = (policyBoard ?? '').toLowerCase()
  if (s.includes('city council')) return 'city_council'
  if (s.includes('town council')) return 'town_council'
  return 'select_board'
}

interface MMAGovProfile {
  policyBoard?: string; policyBoardSize?: number
  legislativeBody?: string; formOfGovernment?: string
}

/** Build a standard set of MA statutory bodies from MMA public data. */
function deriveBodiesFromMMA(profile: MMAGovProfile, town: string): BodyRow[] {
  const boardType  = detectBoardType(profile.policyBoard)
  const boardLabel = profile.policyBoard ?? BODY_TYPE_LABELS['select_board']
  const boardName  = town ? `${town} ${boardLabel}` : boardLabel
  const isOTM      = (profile.legislativeBody ?? '').toLowerCase().includes('town meeting')
  const rows: BodyRow[] = [
    { id: crypto.randomUUID(), name: boardName,                                            type: boardType,          members: String(profile.policyBoardSize ?? 5) },
    { id: crypto.randomUUID(), name: defaultBodyName('planning_board',   town),            type: 'planning_board',   members: '5' },
    { id: crypto.randomUUID(), name: defaultBodyName('board_of_health',  town),            type: 'board_of_health',  members: '3' },
    { id: crypto.randomUUID(), name: defaultBodyName('board_of_appeals', town),            type: 'board_of_appeals', members: '5' },
    { id: crypto.randomUUID(), name: defaultBodyName('conservation',     town),            type: 'conservation',     members: '7' },
    { id: crypto.randomUUID(), name: defaultBodyName('school_committee', town),            type: 'school_committee', members: '5' },
  ]
  if (isOTM)
    rows.push({ id: crypto.randomUUID(), name: defaultBodyName('finance_committee', town), type: 'finance_committee', members: '9' })
  return rows
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface OrgManagerProps {
  onComplete: (selectedModuleIds: string[]) => void
  actor: { display_name: string; email: string }
  prefill?: Record<string, unknown>
}

// ── Main component ────────────────────────────────────────────────────────────

export function OrgManager({ onComplete, actor, prefill = {} }: OrgManagerProps) {
  const [step, setStep] = useState<Step>('modules')
  const [saving, setSaving] = useState(false)
  const [launchStep, setLaunchStep] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [expandedModule, setExpandedModule] = useState<string | null>(null)

  // Per-module automation toggles — { moduleId: { autoKey: enabled } }
  const [automationState, setAutomationState] = useState<Record<string, Record<string, boolean>>>({})

  function toggleAuto(moduleId: string, key: string) {
    setAutomationState(prev => {
      const curr = prev[moduleId] ?? {}
      return { ...prev, [moduleId]: { ...curr, [key]: !curr[key] } }
    })
  }

  function isAutoOn(moduleId: string, key: string, defaultOn: boolean): boolean {
    return automationState[moduleId]?.[key] ?? defaultOn
  }

  // Connectors
  const [connectors, setConnectors] = useState<Record<string, ConnectorInfo>>({})

  // Prefill data — read-only; town profile was saved before this wizard opens
  const pt          = (prefill.town as Record<string, unknown> | undefined) ?? {}
  const townName    = String(pt.town_name    ?? '')
  const population  = Number(pt.population   ?? 0)
  const county      = String(pt.county       ?? '')
  const dlsCode     = String(pt.dls_muni_code ?? '')
  const fyEnd       = String(pt.fiscal_year_end ?? 'June 30')
  const govForm     = String(pt.governance_form ?? 'open_town_meeting')

  // Module selection — pre-seed with recommended modules
  const recommended = recommendedIds(population)
  const [selectedIds, setSelectedIds] = useState<string[]>(recommended)
  const [setups, setSetups] = useState<Record<string, ModuleSetup>>(() => {
    const s: Record<string, ModuleSetup> = {}
    for (const id of recommended) {
      const m = VAULT_MODULES.find(x => x.id === id)
      if (m) s[id] = defaultSetup(m)
    }
    return s
  })

  // Staff
  const prefillStaff = prefill.staff as { email: string; display_name: string; role: string; title: string }[] | undefined
  const [staffRows, setStaffRows] = useState<StaffRow[]>(
    prefillStaff && prefillStaff.length > 0
      ? prefillStaff.map(s => ({ id: s.email || crypto.randomUUID(), name: s.display_name, email: s.email, title: s.title ?? '', role: s.role }))
      : [{ id: actor.email, name: actor.display_name, email: actor.email, title: '', role: 'town_administrator' }]
  )

  // Governing bodies
  const prefillBodies = prefill.bodies as { subtype: string; data: string }[] | undefined
  // "Diverse" = multiple bodies with no duplicate types → user previously customized this list
  const savedTypes     = (prefillBodies ?? []).map(b => b.subtype)
  const hasDiverseTypes = !!prefillBodies && prefillBodies.length > 1
    && new Set(savedTypes).size === savedTypes.length
  const [bodies, setBodies] = useState<BodyRow[]>(
    hasDiverseTypes
      ? prefillBodies!.map(b => {
          let d: { name?: string; member_count?: number } = {}
          try { d = (typeof b.data === 'string' ? JSON.parse(b.data) : b.data) as typeof d } catch { /* use defaults */ }
          return { id: b.subtype + '-' + crypto.randomUUID(), name: defaultBodyName(b.subtype, townName), type: b.subtype, members: String(d.member_count ?? 3) }
        })
      : [{ id: 'select_board', name: defaultBodyName('select_board', townName), type: 'select_board', members: '5' }]
  )
  const [mmaLoading, setMmaLoading] = useState(!!townName)
  const [mmaSourced, setMmaSourced] = useState(false)

  // Always fetch MMA for the selected town. Skip only if user has a genuinely diverse
  // saved list (different body types = real prior customization worth preserving).
  useEffect(() => {
    if (!townName || hasDiverseTypes) { setMmaLoading(false); return }
    pjApi.registry.mmaProfile(townName)
      .then(({ profile }) => {
        setBodies(deriveBodiesFromMMA(profile, townName))
        setMmaSourced(true)
      })
      .catch(() => { /* non-critical; keep default row */ })
      .finally(() => setMmaLoading(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Fetch connector status once on mount
  const refreshConnectors = useCallback(() => {
    pjApi.connectors.status()
      .then(d => setConnectors(d.connectors ?? {}))
      .catch(() => { /* connector status is non-critical */ })
  }, [])
  useEffect(() => { refreshConnectors() }, [refreshConnectors])

  // Load saved module configs on mount
  useEffect(() => {
    civicApi.get<{ configs: Array<ModuleSetup & { automations?: Record<string, boolean> }> }>('/org-manager/configure')
      .then(({ configs }) => {
        for (const c of configs) {
          const { automations: savedAutos, ...setup } = c
          updateSetup(c.moduleId, setup)
          if (savedAutos) {
            setAutomationState(prev => ({ ...prev, [c.moduleId]: savedAutos }))
          }
        }
      })
      .catch(() => {/* first-time user — no saved config yet */})
  }, [])

  // Auto-expand first module when entering configure step
  useEffect(() => {
    if (step === 'configure' && selectedIds.length > 0 && expandedModule === null) {
      setExpandedModule(selectedIds[0])
    }
  }, [step, selectedIds, expandedModule])

  // Module helpers
  function toggleModule(id: string) {
    if (selectedIds.includes(id)) {
      setSelectedIds(prev => prev.filter(x => x !== id))
      setSetups(prev => { const n = { ...prev }; delete n[id]; return n })
    } else {
      setSelectedIds(prev => [...prev, id])
      setSetups(prev => {
        const m = VAULT_MODULES.find(x => x.id === id)
        return m ? { ...prev, [id]: defaultSetup(m) } : prev
      })
    }
  }

  function selectAll() {
    setSelectedIds(VAULT_MODULES.map(m => m.id))
    setSetups(prev => {
      const n = { ...prev }
      for (const m of VAULT_MODULES) { if (!n[m.id]) n[m.id] = defaultSetup(m) }
      return n
    })
  }

  function useRecommended() {
    setSelectedIds(recommended)
    setSetups(() => {
      const s: Record<string, ModuleSetup> = {}
      for (const id of recommended) {
        const m = VAULT_MODULES.find(x => x.id === id)
        if (m) s[id] = defaultSetup(m)
      }
      return s
    })
  }

  function updateSetup(id: string, patch: Partial<ModuleSetup>) {
    setSetups(prev => ({ ...prev, [id]: { ...prev[id], ...patch } }))
  }

  // Navigation
  const stepIndex = STEP_ORDER.indexOf(step)

  function goNext() {
    setError(null)
    if (step === 'modules') {
      if (selectedIds.length === 0) { setError('Select at least one module to continue.'); return }
      setStep('configure')
    } else if (step === 'configure') {
      // Validate: each selected module with an officer name must also have an officer email
      for (const id of selectedIds) {
        const cfg = setups[id]
        if (cfg?.officerName && !cfg?.officerEmail) {
          setError(`Officer email is required for ${VAULT_MODULES.find(m => m.id === id)?.name ?? id}. Please enter an email or clear the name.`)
          return
        }
      }
      const modules = selectedIds.map(id => ({
        ...setups[id],
        automations: Object.fromEntries(
          getAutomations(id).map(a => [a.key, isAutoOn(id, a.key, a.defaultOn)])
        ),
      }))
      civicApi.post('/org-manager/configure', { modules }).catch(() => {})
      setStep('team')
    } else if (step === 'team') {
      // Validate: at least one staff member must have both name and email
      const validStaff = staffRows.filter(r => r.name.trim() && r.email.trim())
      if (validStaff.length === 0) {
        setError('Add at least one staff member with a name and email before continuing.')
        return
      }
      setStep('launch')
    }
  }

  function goBack() {
    if (stepIndex > 0) setStep(STEP_ORDER[stepIndex - 1])
  }

  // Final launch — all API calls happen here
  async function launch() {
    setSaving(true); setError(null); setLaunchStep(null)
    try {
      setLaunchStep(LAUNCH_STEPS[0])
      await withRetry(() => civicApi.post('/org-manager/town', {
        town_name: townName, population, county,
        governance_form: govForm, dls_muni_code: dlsCode, fiscal_year_end: fyEnd,
      }))
      setLaunchStep(LAUNCH_STEPS[1])
      await withRetry(() => civicApi.post('/org-manager/staff',  { staff:  staffRows.filter(r => r.name && r.email) }))
      setLaunchStep(LAUNCH_STEPS[2])
      await withRetry(() => civicApi.post('/org-manager/bodies',  { bodies: bodies.filter(b => b.name) }))
      setLaunchStep(LAUNCH_STEPS[3])
      await withRetry(() => civicApi.post('/org-manager/complete', {}))
      setLaunchStep(null)
      onComplete(selectedIds)
    } catch (e) {
      const msg = (e as { message?: string })?.message
      setError(msg && msg !== 'Civic API error' ? msg : 'Launch failed. Please try again.')
      setLaunchStep(null)
    }
    setSaving(false)
  }

  const msConnected = connectors['microsoft']?.connected ?? false
  const gConnected  = connectors['google']?.connected    ?? false

  return (
    <div className="min-h-screen bg-background flex flex-col items-center py-10 px-4">
      <div className="w-full max-w-4xl">

        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-red-900/50 border border-red-800/50 flex items-center justify-center text-2xl mx-auto mb-3">⚖</div>
          <h1 className="text-foreground font-black text-2xl">Civic Setup</h1>
          {townName && <p className="text-red-400 text-sm font-semibold mt-1">{townName}</p>}
          <p className="text-muted-foreground/60 text-xs mt-0.5">Welcome, {actor.display_name}</p>
        </div>

        {/* Stage rail */}
        <div className="flex items-center justify-center mb-8 select-none">
          {STEP_META.map((s, i) => {
            const idx        = STEP_ORDER.indexOf(s.id)
            const currentIdx = stepIndex
            const isDone     = idx < currentIdx
            const isActive   = idx === currentIdx
            return (
              <div key={s.id} className="flex items-center">
                <div className="flex flex-col items-center gap-1.5">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all ${
                    isDone   ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400' :
                    isActive ? 'bg-red-700 border-red-600 text-white shadow-lg shadow-red-900/30' :
                               'bg-muted/40 border-border text-muted-foreground/50'
                  }`}>
                    {isDone ? <CheckCircle size={14} weight="fill" /> : <span>{i + 1}</span>}
                  </div>
                  <span className={`text-[10px] font-medium tracking-wide transition-colors ${
                    isActive ? 'text-foreground' : isDone ? 'text-emerald-500/70' : 'text-muted-foreground/40'
                  }`}>{s.label.toUpperCase()}</span>
                </div>
                {i < STEP_META.length - 1 && (
                  <div className={`w-16 h-px mx-2 mb-5 transition-colors ${isDone ? 'bg-emerald-700/50' : 'bg-border/50'}`} />
                )}
              </div>
            )
          })}
        </div>

        {/* ── Step: Modules ─────────────────────────────────────────────────── */}
        {step === 'modules' && (
          <div>
            <div className="flex items-start justify-between mb-5 gap-4">
              <div>
                <h2 className="text-foreground font-bold text-xl">Choose Your Modules</h2>
                <p className="text-muted-foreground text-sm mt-0.5">
                  Select the governance systems to activate. Recommended ones are pre-selected based on your town's size.
                </p>
              </div>
              <div className="flex gap-2 shrink-0">
                <button onClick={useRecommended}
                  className="px-3 py-1.5 text-xs font-medium border border-red-800/50 text-red-400 hover:bg-red-900/20 rounded-lg transition">
                  Use Recommended
                </button>
                <button onClick={selectAll}
                  className="px-3 py-1.5 text-xs font-medium border border-border text-muted-foreground hover:text-foreground hover:bg-muted/60 rounded-lg transition">
                  Select All
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {VAULT_MODULES.map(m => {
                const isSelected    = selectedIds.includes(m.id)
                const isRecommended = recommended.includes(m.id)
                const accent = DOMAIN_ACCENT[m.domain] ?? '#6b7280'
                const badge  = DOMAIN_BADGE[m.domain]  ?? 'bg-muted text-muted-foreground border-muted'
                return (
                  <button
                    key={m.id}
                    onClick={() => toggleModule(m.id)}
                    className={`text-left p-4 rounded-xl border transition-all relative ${
                      isSelected
                        ? 'bg-card border-red-700/60 ring-1 ring-red-700/30'
                        : 'bg-card/60 border-border hover:border-border/80 hover:bg-card'
                    }`}
                  >
                    {isSelected && (
                      <div className="absolute top-3 right-3">
                        <CheckCircle size={17} weight="fill" className="text-red-500" />
                      </div>
                    )}
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0"
                        style={{ background: `${accent}20`, border: `1px solid ${accent}30` }}>
                        {MODULE_EMOJI[m.id] ?? '⚙️'}
                      </div>
                      <div className="flex-1 min-w-0 pr-4">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-foreground font-semibold text-sm">{m.name}</span>
                          {isRecommended && (
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-red-900/40 text-red-400 border border-red-800/40">
                              Recommended
                            </span>
                          )}
                        </div>
                        <div className="mt-1 flex items-center gap-2 flex-wrap">
                          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${badge}`}>
                            {m.domain}
                          </span>
                          <span className="text-[10px] text-muted-foreground/60 font-mono">{m.mglCitation}</span>
                        </div>
                        <p className="text-muted-foreground text-xs mt-1.5 leading-relaxed line-clamp-2">{m.description}</p>
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>

            <p className="text-xs text-muted-foreground text-center mt-4">
              {selectedIds.length} of {VAULT_MODULES.length} modules selected
            </p>
          </div>
        )}

        {/* ── Step: Configure ───────────────────────────────────────────────── */}
        {step === 'configure' && (
          <div>
            <div className="mb-6">
              <h2 className="text-foreground font-bold text-xl">Define How Each Function Runs</h2>
              <p className="text-muted-foreground text-sm mt-0.5">
                Assign who handles each step, what runs automatically, and where work is filed.
              </p>
            </div>

            <div className="flex flex-col gap-3">
              {selectedIds.map(id => {
                const m = VAULT_MODULES.find(x => x.id === id)
                if (!m || !setups[id]) return null
                return (
                  <ModuleConfigureRow
                    key={id}
                    module={m}
                    setup={setups[id]}
                    isOpen={expandedModule === id}
                    flow={PROCESS_FLOWS[id] ?? []}
                    automations={getAutomations(id)}
                    townName={townName}
                    msConnected={msConnected}
                    gConnected={gConnected}
                    onToggleOpen={() => setExpandedModule(expandedModule === id ? null : id)}
                    onUpdateSetup={patch => updateSetup(id, patch)}
                    isAutoOn={key => isAutoOn(id, key, getAutomations(id).find(a => a.key === key)?.defaultOn ?? true)}
                    onToggleAuto={key => toggleAuto(id, key)}
                  />
                )
              })}
            </div>
          </div>
        )}

        {/* ── Step: Team ────────────────────────────────────────────────────── */}
        {step === 'team' && (
          <div className="flex flex-col gap-6">
            {/* Staff */}
            <div className="bg-card border border-border rounded-xl p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-foreground font-semibold text-base">Staff</h3>
                  <p className="text-muted-foreground text-xs mt-0.5">People who will use CIVIC. More can be added later.</p>
                </div>
                <button
                  onClick={() => setStaffRows(r => [...r, { id: crypto.randomUUID(), name: '', email: '', title: '', role: 'staff' }])}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-400 border border-red-800/40 hover:bg-red-900/20 rounded-lg transition"
                >
                  <Plus size={13} /> Add person
                </button>
              </div>
              <div className="flex flex-col gap-2">
                {staffRows.map((row, i) => (
                  <div key={row.id} className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_1fr_auto_auto] gap-2 items-center">
                    <input
                      value={row.name}
                      onChange={e => setStaffRows(r => r.map((x, j) => j === i ? { ...x, name: e.target.value } : x))}
                      placeholder="Full name"
                      className="px-2.5 py-2 bg-muted border border-border rounded-lg text-foreground text-xs focus:outline-none focus:border-red-700/60"
                    />
                    <input
                      value={row.email}
                      onChange={e => setStaffRows(r => r.map((x, j) => j === i ? { ...x, email: e.target.value } : x))}
                      placeholder="Email"
                      className="px-2.5 py-2 bg-muted border border-border rounded-lg text-foreground text-xs focus:outline-none focus:border-red-700/60"
                    />
                    <input
                      value={row.title}
                      onChange={e => setStaffRows(r => r.map((x, j) => j === i ? { ...x, title: e.target.value } : x))}
                      placeholder="Title"
                      className="px-2.5 py-2 bg-muted border border-border rounded-lg text-foreground text-xs focus:outline-none focus:border-red-700/60"
                    />
                    <select
                      value={row.role}
                      onChange={e => setStaffRows(r => r.map((x, j) => j === i ? { ...x, role: e.target.value } : x))}
                      className="px-2.5 py-2 bg-muted border border-border rounded-lg text-foreground text-xs focus:outline-none focus:border-red-700/60"
                    >
                      <option value="town_administrator">Admin</option>
                      <option value="staff">Staff</option>
                      <option value="board_member">Board</option>
                      <option value="clerk">Clerk</option>
                    </select>
                    <button
                      onClick={() => setStaffRows(r => r.filter(x => x.id !== row.id))}
                      disabled={staffRows.length === 1}
                      className="p-1.5 text-muted-foreground hover:text-red-400 disabled:opacity-30 transition rounded"
                    >
                      <X size={13} />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Governing Bodies */}
            <div className="bg-card border border-border rounded-xl p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-foreground font-semibold text-base">Governing Bodies</h3>
                  <p className="text-muted-foreground text-xs mt-0.5">
                    Boards and committees for open meeting law and quorum tracking.
                    {mmaSourced && <span className="ml-2 text-emerald-400 font-medium">✓ Sourced from MMA.org</span>}
                  </p>
                </div>
                <button
                  onClick={() => setBodies(b => [...b, { id: crypto.randomUUID(), name: defaultBodyName('select_board', townName), type: 'select_board', members: '3' }])}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-400 border border-red-800/40 hover:bg-red-900/20 rounded-lg transition"
                >
                  <Plus size={13} /> Add body
                </button>
              </div>
              {mmaLoading ? (
                <div className="flex items-center gap-2 text-muted-foreground text-xs py-4">
                  <Spinner size={14} className="animate-spin" /> Loading {townName} governing bodies from MMA public data…
                </div>
              ) : (
              <div className="flex flex-col gap-2">
                {bodies.map((body, i) => (
                  <div key={body.id} className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_80px_auto] gap-2 items-center">
                    <input
                      value={body.name}
                      onChange={e => setBodies(b => b.map((x, j) => j === i ? { ...x, name: e.target.value } : x))}
                      placeholder="Body name"
                      className="px-2.5 py-2 bg-muted border border-border rounded-lg text-foreground text-xs focus:outline-none focus:border-red-700/60"
                    />
                    <select
                      value={body.type}
                      onChange={e => {
                        const newType = e.target.value
                        setBodies(b => b.map((x, j) => j === i ? {
                          ...x,
                          type: newType,
                          name: isAutoBodyName(x.name, x.type) ? defaultBodyName(newType, townName) : x.name,
                        } : x))
                      }}
                      className="px-2.5 py-2 bg-muted border border-border rounded-lg text-foreground text-xs focus:outline-none focus:border-red-700/60"
                    >
                      <option value="select_board">Select Board</option>
                      <option value="city_council">City Council</option>
                      <option value="town_council">Town Council</option>
                      <option value="planning_board">Planning Board</option>
                      <option value="board_of_health">Board of Health</option>
                      <option value="conservation">Conservation Comm.</option>
                      <option value="board_of_appeals">Board of Appeals</option>
                      <option value="school_committee">School Committee</option>
                      <option value="finance_committee">Finance Committee</option>
                    </select>
                    <input
                      value={body.members}
                      onChange={e => setBodies(b => b.map((x, j) => j === i ? { ...x, members: e.target.value } : x))}
                      placeholder="Members" type="number"
                      className="px-2.5 py-2 bg-muted border border-border rounded-lg text-foreground text-xs focus:outline-none focus:border-red-700/60"
                    />
                    <button
                      onClick={() => setBodies(b => b.filter(x => x.id !== body.id))}
                      disabled={bodies.length === 1}
                      className="p-1.5 text-muted-foreground hover:text-red-400 disabled:opacity-30 transition rounded"
                    >
                      <X size={13} />
                    </button>
                  </div>
                ))}
              </div>
              )}
            </div>
          </div>
        )}

        {/* ── Step: Launch ──────────────────────────────────────────────────── */}
        {step === 'launch' && (
          <div className="bg-card border border-border rounded-2xl p-8">
            <div className="text-center mb-8">
              <div className="w-16 h-16 rounded-2xl bg-red-900/40 border border-red-800/40 flex items-center justify-center text-3xl mx-auto mb-4">⚖</div>
              <h2 className="text-foreground font-bold text-xl">Ready to Launch</h2>
              <p className="text-muted-foreground text-sm mt-1">Review your configuration and launch your CIVIC environment.</p>
            </div>

            <div className="bg-muted/40 border border-border/50 rounded-xl p-5 flex flex-col gap-3 mb-6">
              {[
                { icon: <ShieldCheck size={15} className="text-red-400" />,         label: 'Municipality',      value: townName || 'Not set' },
                { icon: <Buildings   size={15} className="text-muted-foreground" />, label: 'Modules activated', value: `${selectedIds.length} governance module${selectedIds.length !== 1 ? 's' : ''}` },
                { icon: <User        size={15} className="text-muted-foreground" />, label: 'Staff members',     value: `${staffRows.filter(r => r.name && r.email).length} people` },
                { icon: <Buildings   size={15} className="text-muted-foreground" />, label: 'Governing bodies',  value: `${bodies.filter(b => b.name).length} configured` },
              ].map(item => (
                <div key={item.label} className="flex items-center gap-3">
                  <div className="shrink-0">{item.icon}</div>
                  <span className="text-muted-foreground text-sm flex-1">{item.label}</span>
                  <span className="text-foreground text-sm font-semibold">{item.value}</span>
                </div>
              ))}
            </div>

            <div className="mb-6">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Activated Modules</p>
              <div className="flex flex-wrap gap-2">
                {selectedIds.map(id => {
                  const m = VAULT_MODULES.find(x => x.id === id)
                  if (!m) return null
                  return (
                    <div key={id} className="flex items-center gap-1.5 px-2.5 py-1 bg-muted/60 border border-border rounded-lg text-xs text-foreground">
                      <span>{MODULE_EMOJI[id] ?? '⚙️'}</span>
                      <span>{m.name}</span>
                    </div>
                  )
                })}
              </div>
            </div>

            <p className="text-muted-foreground/60 text-xs text-center">
              All actions within CIVIC are governed by Massachusetts Open Meetings Law and Public Records Law.
            </p>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="mt-4 flex items-center gap-2 p-3 bg-red-900/20 border border-red-800/40 rounded-lg">
            <Warning size={14} className="text-red-400 shrink-0" />
            <p className="text-red-400 text-xs">{error}</p>
          </div>
        )}

        {/* Navigation */}
        <div className="flex items-center justify-between mt-6">
          <button
            onClick={goBack}
            disabled={stepIndex === 0}
            className="flex items-center gap-1.5 px-3 py-2 text-sm text-muted-foreground hover:text-foreground transition disabled:opacity-30"
          >
            <ArrowLeft size={15} /> Back
          </button>

          {step !== 'launch' ? (
            <button
              onClick={goNext}
              className="flex items-center gap-2 px-6 py-2.5 bg-red-700 hover:bg-red-600 text-white text-sm font-semibold rounded-xl transition"
            >
              Continue <ArrowRight size={15} />
            </button>
          ) : (
            <button
              onClick={launch}
              disabled={saving}
              className="flex items-center gap-2 px-6 py-3 bg-red-700 hover:bg-red-600 text-white text-sm font-bold rounded-xl transition disabled:opacity-50"
            >
              {saving ? (
                <><Spinner size={16} className="animate-spin" /> {launchStep ?? 'Launching…'}</>
              ) : (
                <><Rocket size={16} weight="fill" /> Launch CIVIC</>
              )}
            </button>
          )}
        </div>

      </div>
    </div>
  )
}
