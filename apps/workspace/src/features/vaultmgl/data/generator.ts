import type { Municipality } from '@/data/maMunicipalities'
import { MGL_PROCESSES } from './mglProcesses'

// ── Seeded deterministic random ────────────────────────────────────────────
function seededRand(seed: number) {
  let s = seed >>> 0
  return () => {
    s = Math.imul(s, 1664525) + 1013904223
    return (s >>> 0) / 0xffffffff
  }
}

// ── Types ──────────────────────────────────────────────────────────────────
export interface FiscalSnapshot {
  operatingBudget: number
  totalEmployees: number
  freeCash: number
  stateAid: number
  debtService: number
  salariesWages: number
  fiscalYear: number
  // MMA extras (present when data sourced from MMA registry)
  formOfGovt?: string
  chiefOfficialTitle?: string
  resTaxRate?: number
  localReceipts?: number
  incomePc?: number
  eqvPc?: number
}

export interface TownStats {
  casesOpen: number
  casesThisMonth: number
  avgResolutionDays: number
  complianceScore: number
  watchAlerts: number
  sealedThisMonth: number
  overdueCount: number
  staffActive: number
}

export interface OrgMember {
  id: string
  name: string
  email: string
  phone?: string
  title: string
  department: string
  role: string
  active: boolean
  lastActive: string
  sourceUrl?: string   // set when data came from real scrape
}

export interface OrgRole {
  id: string
  name: string
  display: string
  permissions: string[]
  canApprove: string[]
}

export interface MglCase {
  id: string
  procId: string
  procName: string
  currentStage: number
  totalStages: number
  status: 'ACTIVE' | 'BLOCKED' | 'CLOSED' | 'WITHDRAWN'
  risk: 'low' | 'medium' | 'high'
  subject: string
  source: 'public' | 'staff' | 'api'
  handler: string
  department: string
  openedAt: string
  dueAt: string
  blockedSince: string | null
  blockedReason: string | null
  closedAt: string | null
  seal: string | null
  fields: Record<string, string>
}

export interface WatchFlag {
  id: string
  caseId: string | null
  flagType: string
  level: 'critical' | 'urgent' | 'warn' | 'info'
  title: string
  body: string
  mglCitation: string | null
  createdAt: string
  resolvedAt: string | null
}

export interface RiskFlag {
  id: string
  label: string
  detail: string
  severity: 'critical' | 'urgent' | 'warn' | 'ok'
}

export interface Meeting {
  id: string
  board: string
  date: string
  time: string
  location: string
  posted: boolean
  agendaItems: string[]
}

export interface ActivityItem {
  id: string
  type: 'case_opened' | 'stage_advanced' | 'hard_stop' | 'case_closed' | 'member_added' | 'seal_generated' | 'case_blocked' | 'note_added'
  title: string
  description: string
  timestamp: string
  caseId?: string
  actorName?: string
}

export interface TownOrg {
  id: string
  name: string
  municipality: string
  plan: 'Starter' | 'Full' | 'Enterprise'
  modules: string[]
  active: boolean
}

export interface DataMeta {
  staffSource: 'live' | 'estimated'
  staffNotice: string | null
  staffWebsite: string | null
  fiscalSource: 'live' | 'estimated'
  fiscalYear: number
  loadedAt: string
}

export interface GeneratedTownData {
  org: TownOrg
  fiscal: FiscalSnapshot
  stats: TownStats
  members: OrgMember[]
  roles: OrgRole[]
  cases: MglCase[]
  watchFlags: WatchFlag[]
  riskFlags: RiskFlag[]
  meetings: Meeting[]
  activity: ActivityItem[]
  _meta: DataMeta
}

// ── Name pools ─────────────────────────────────────────────────────────────
const FIRST_NAMES = ['James', 'Mary', 'Robert', 'Patricia', 'John', 'Jennifer', 'Michael', 'Linda', 'William', 'Barbara', 'David', 'Susan', 'Richard', 'Jessica', 'Joseph', 'Sarah', 'Thomas', 'Karen', 'Charles', 'Lisa', 'Margaret', 'Nancy', 'Elizabeth', 'Dorothy', 'Sandra', 'Helen', 'Donna']
const LAST_NAMES = ['Sullivan', 'Murphy', 'McCarthy', "O'Brien", 'Kelly', 'Walsh', 'Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Wilson', 'Moore', 'Taylor', 'Anderson', 'Thomas', 'Jackson', 'White', 'Harris', 'Martin', 'Thompson']
const DEPARTMENTS = ['Town Clerk', 'Board of Selectmen', 'Finance', 'DPW', 'Board of Health', 'Planning', 'Building', 'Police', 'Fire', 'Library', 'Conservation']

const ROLE_TITLES: Record<string, string> = {
  'Town Clerk': 'Town Clerk',
  'Board of Selectmen': 'Selectboard Member',
  'Finance': 'Finance Director',
  'DPW': 'DPW Director',
  'Board of Health': 'Board of Health Chair',
  'Planning': 'Planning Board Chair',
  'Building': 'Building Inspector',
  'Police': 'Police Chief',
  'Fire': 'Fire Chief',
  'Library': 'Library Director',
  'Conservation': 'Conservation Agent',
}

// ── Fiscal estimates ───────────────────────────────────────────────────────
function estimateFiscal(pop: number): FiscalSnapshot {
  const budget = pop * 3400
  return {
    operatingBudget: budget,
    totalEmployees: Math.round(pop / 75),
    freeCash: Math.round(budget * 0.062),
    stateAid: Math.round(budget * 0.158),
    debtService: Math.round(budget * 0.082),
    salariesWages: Math.round(budget * 0.336),
    fiscalYear: 2025,
  }
}

function planTier(pop: number): 'Starter' | 'Full' | 'Enterprise' {
  if (pop < 3000) return 'Starter'
  if (pop < 10000) return 'Full'
  return 'Enterprise'
}

// ── Seeded date helpers ────────────────────────────────────────────────────
function daysAgoDate(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() - days)
  return d.toISOString()
}

function daysFromNow(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return d.toISOString()
}

function futureDateStr(offsetDays: number): string {
  return daysFromNow(offsetDays).split('T')[0]
}

function pastDateStr(offsetDays: number): string {
  return daysAgoDate(offsetDays).split('T')[0]
}

// ── Subjects / subjects pools ──────────────────────────────────────────────
const PRR_SUBJECTS = [
  'Police incident report — Main St',
  'Town Meeting vote records FY24',
  'DPW contract documents 2023',
  'Board of Health inspection logs',
  'Building permit history — 42 Oak Ave',
  'Finance committee minutes Q3',
  'Personnel file request — former employee',
  'Conservation commission orders',
  'Selectboard executive session notes',
  'Planning board variance applications',
]

const PERMIT_SUBJECTS = [
  'New residential construction — 15 Elm St',
  'Deck addition — 88 River Rd',
  'Commercial renovation — 3 Main St',
  'Accessory dwelling unit — 22 Pine Ave',
  'Solar panel installation — 7 Maple Dr',
  'Garage conversion — 45 Oak St',
  'Pool installation — 101 Lakeview',
  'Roof replacement — 33 Center St',
]

const BOARD_SUBJECTS = [
  'Board of Selectmen — Regular Meeting',
  'Planning Board — Special Permit Hearing',
  'Finance Committee — Budget Review',
  'Board of Health — Monthly Meeting',
  'Conservation Commission — Wetlands Review',
  'Zoning Board of Appeals — Variance Hearing',
]

const PROCUREMENT_SUBJECTS = [
  'Road resurfacing materials FY25',
  'IT infrastructure upgrade — servers',
  'Fleet vehicle replacement — DPW trucks',
  'Landscaping services contract renewal',
  'Security camera system installation',
  'Financial software licensing agreement',
]

const WARRANT_SUBJECTS = [
  'DPW supplies — Ace Hardware',
  'Legal services — Town Counsel Q2',
  'Utilities — National Grid April',
  'Office supplies — Staples',
  'Vehicle maintenance — Fleet Repair Co.',
  'Insurance premiums — MIIA',
]

// ── Main generator ─────────────────────────────────────────────────────────
export function generateTownData(muni: Municipality): GeneratedTownData {
  const pop = muni.population ?? 5000
  const seed = muni.dor_code
  const rand = seededRand(seed)

  const pick = <T,>(arr: T[]): T => arr[Math.floor(rand() * arr.length)]
  const randInt = (min: number, max: number) => Math.floor(rand() * (max - min + 1)) + min

  // ── Org ──────────────────────────────────────────────────────────────────
  const plan = planTier(pop)
  const org: TownOrg = {
    id: `org_${muni.dor_code}`,
    name: `Town of ${muni.name}`,
    municipality: muni.name,
    plan,
    modules: plan === 'Starter'
      ? ['vault', 'records', 'orgmanager']
      : plan === 'Full'
        ? ['vault', 'records', 'orgmanager', 'logicdash', 'formkey', 'watchlayer']
        : ['vault', 'records', 'orgmanager', 'logicdash', 'formkey', 'watchlayer', 'procurement', 'budgeting', 'govai'],
    active: true,
  }

  // ── Fiscal ───────────────────────────────────────────────────────────────
  const fiscal = estimateFiscal(pop)

  // ── Members ──────────────────────────────────────────────────────────────
  const memberCount = Math.max(4, Math.round(pop / 75))
  const members: OrgMember[] = []
  for (let i = 0; i < memberCount; i++) {
    const dept = DEPARTMENTS[i % DEPARTMENTS.length]
    const firstName = pick(FIRST_NAMES)
    const lastName = pick(LAST_NAMES)
    members.push({
      id: `mem_${seed}_${i}`,
      name: `${firstName} ${lastName}`,
      email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}@${muni.name.toLowerCase().replace(/\s+/g, '')}.ma.gov`,
      title: ROLE_TITLES[dept] ?? dept,
      department: dept,
      role: i === 0 ? 'admin' : i < 3 ? 'manager' : 'staff',
      active: rand() > 0.08,
      lastActive: daysAgoDate(randInt(0, 14)),
    })
  }

  // ── Roles ────────────────────────────────────────────────────────────────
  const roles: OrgRole[] = [
    { id: 'role_clerk', name: 'clerk', display: 'Town Clerk', permissions: ['records.read', 'records.write', 'prr.manage', 'meetings.post', 'seal.apply'], canApprove: ['proc_prr', 'proc_oml'] },
    { id: 'role_admin', name: 'admin', display: 'Town Administrator', permissions: ['*'], canApprove: ['*'] },
    { id: 'role_selectboard', name: 'selectboard', display: 'Selectboard Member', permissions: ['cases.read', 'meetings.read', 'warrants.approve'], canApprove: ['proc_apwarrant'] },
    { id: 'role_dpw', name: 'dpw', display: 'DPW Director', permissions: ['permits.read', 'procurement.initiate', 'cases.read'], canApprove: ['proc_permit', 'proc_procurement'] },
    { id: 'role_boh', name: 'boh', display: 'Board of Health Chair', permissions: ['cases.read', 'records.read', 'meetings.post'], canApprove: ['proc_oml'] },
    { id: 'role_finance', name: 'finance', display: 'Finance Director', permissions: ['finance.read', 'finance.write', 'warrants.review', 'procurement.review'], canApprove: ['proc_apwarrant', 'proc_procurement'] },
  ]

  // ── Compliance score ─────────────────────────────────────────────────────
  const complianceScore = randInt(62, 97)

  // ── Cases ────────────────────────────────────────────────────────────────
  const caseCount = Math.max(8, Math.round(pop / 200))
  const cases: MglCase[] = []
  const procTypes = ['proc_prr', 'proc_oml', 'proc_permit', 'proc_apwarrant', 'proc_procurement']
  const procNames: Record<string, string> = {
    proc_prr: 'Public Records Request',
    proc_oml: 'Open Meeting Notice',
    proc_permit: 'Building Permit',
    proc_apwarrant: 'AP Warrant',
    proc_procurement: 'Procurement / Vendor Intake',
  }
  const subjectPools: Record<string, string[]> = {
    proc_prr: PRR_SUBJECTS,
    proc_oml: BOARD_SUBJECTS,
    proc_permit: PERMIT_SUBJECTS,
    proc_apwarrant: WARRANT_SUBJECTS,
    proc_procurement: PROCUREMENT_SUBJECTS,
  }

  let overdueCount = 0
  let sealedCount = 0

  for (let i = 0; i < caseCount; i++) {
    const procId = procTypes[i % procTypes.length]
    const proc = MGL_PROCESSES.find(p => p.id === procId)!
    const totalStages = proc.stageCount
    const currentStage = randInt(1, totalStages)
    const isSealed = currentStage === totalStages && rand() > 0.5
    const isBlocked = !isSealed && rand() < 0.12
    const isClosed = isSealed && rand() > 0.3
    const daysOpen = randInt(1, 45)
    const dueInDays = proc.defaultDueDays - daysOpen
    const isOverdue = dueInDays < 0 && !isClosed

    if (isOverdue) overdueCount++
    if (isSealed) sealedCount++

    const handler = members[i % members.length]?.name ?? 'Unassigned'
    const dept = DEPARTMENTS[i % DEPARTMENTS.length]

    const statusVal: MglCase['status'] = isClosed
      ? 'CLOSED'
      : isBlocked
        ? 'BLOCKED'
        : 'ACTIVE'

    cases.push({
      id: `CASE-2025-${String(seed).padStart(2, '0')}${String(i + 1).padStart(3, '0')}`,
      procId,
      procName: procNames[procId],
      currentStage,
      totalStages,
      status: statusVal,
      risk: isOverdue ? 'high' : isBlocked ? 'medium' : 'low',
      subject: pick(subjectPools[procId]),
      source: pick(['public', 'staff', 'api']),
      handler,
      department: dept,
      openedAt: daysAgoDate(daysOpen),
      dueAt: daysFromNow(Math.max(dueInDays, -30)),
      blockedSince: isBlocked ? daysAgoDate(randInt(1, 7)) : null,
      blockedReason: isBlocked ? 'Awaiting required documentation from requestor' : null,
      closedAt: isClosed ? daysAgoDate(randInt(0, 5)) : null,
      seal: isSealed ? `SEAL-${seed.toString(16).toUpperCase()}-${i.toString(16).padStart(4, '0')}` : null,
      fields: procId === 'proc_prr'
        ? { requestor: pick(FIRST_NAMES) + ' ' + pick(LAST_NAMES), format: pick(['electronic', 'paper']), description: 'Records as described in subject' }
        : procId === 'proc_permit'
          ? { address: pick(['15 Elm St', '88 River Rd', '3 Main St', '22 Pine Ave']), owner: pick(FIRST_NAMES) + ' ' + pick(LAST_NAMES), estimatedValue: '$' + randInt(5, 500) + ',000' }
          : {},
    })
  }

  // ── Stats ────────────────────────────────────────────────────────────────
  const openCases = cases.filter(c => c.status !== 'CLOSED' && c.status !== 'WITHDRAWN')
  const stats: TownStats = {
    casesOpen: openCases.length,
    casesThisMonth: Math.round(caseCount * 0.4),
    avgResolutionDays: randInt(6, 18),
    complianceScore,
    watchAlerts: Math.max(1, Math.round((100 - complianceScore) / 10)),
    sealedThisMonth: sealedCount,
    overdueCount,
    staffActive: members.filter(m => m.active).length,
  }

  // ── Watch Flags ──────────────────────────────────────────────────────────
  const watchFlags: WatchFlag[] = []
  const flagCount = Math.max(2, Math.round((100 - complianceScore) / 12))

  const flagTemplates: Array<Omit<WatchFlag, 'id' | 'createdAt' | 'resolvedAt' | 'caseId'>> = [
    { flagType: 'prr_overdue', level: 'critical', title: 'PRR Overdue — Statutory Limit Approaching', body: 'One or more public records requests are past the 10-business-day statutory deadline under MGL c.66 §10.', mglCitation: 'MGL c.66 §10' },
    { flagType: 'oml_posting', level: 'urgent', title: 'OML Posting Window at Risk', body: 'A meeting agenda has not been posted 48 hours in advance as required by the Open Meeting Law.', mglCitation: 'MGL c.30A §20' },
    { flagType: 'permit_queue', level: 'warn', title: 'Building Permit Queue Depth', body: 'Permit application backlog exceeds 5 active cases. Review staffing capacity.', mglCitation: null },
    { flagType: 'free_cash', level: 'warn', title: 'Free Cash Below 5% Threshold', body: 'Free cash balance is below the 5% operating budget benchmark. Finance committee review recommended.', mglCitation: null },
    { flagType: 'board_vacancy', level: 'info', title: 'Board Vacancy — Unfilled Position', body: 'Conservation Commission has 1 unfilled position. Appointment process should begin.', mglCitation: null },
    { flagType: 'warrant_blocked', level: 'urgent', title: 'AP Warrant Blocked — Selectboard Signature Pending', body: 'AP warrant has been in Finance Review for 5 business days without Selectboard signature.', mglCitation: 'MGL c.41 §52' },
    { flagType: 'procurement_threshold', level: 'warn', title: 'Procurement Threshold Review Required', body: 'A pending purchase may exceed the $10,000 threshold requiring formal bid under MGL c.30B.', mglCitation: 'MGL c.30B §5' },
    { flagType: 'hard_stop', level: 'critical', title: 'Hard Stop: Zoning Check Incomplete', body: 'Building permit cannot advance — zoning compliance check has not been completed as required.', mglCitation: 'MGL c.40A §6' },
  ]

  for (let i = 0; i < Math.min(flagCount, flagTemplates.length); i++) {
    const template = flagTemplates[i]
    const relatedCase = cases.find(c => c.procId === (template.flagType === 'prr_overdue' ? 'proc_prr' : template.flagType === 'oml_posting' ? 'proc_oml' : 'proc_permit'))
    watchFlags.push({
      id: `watch_${seed}_${i}`,
      caseId: relatedCase?.id ?? null,
      ...template,
      createdAt: daysAgoDate(randInt(1, 10)),
      resolvedAt: null,
    })
  }

  // ── Risk Flags ────────────────────────────────────────────────────────────
  const prrBacklog = overdueCount > 0
  const riskFlags: RiskFlag[] = [
    {
      id: 'risk_prr',
      label: 'PRR Backlog',
      detail: prrBacklog
        ? `${overdueCount} request(s) past 10-day statutory limit (MGL c.66 §10)`
        : 'All requests within statutory window',
      severity: prrBacklog ? 'critical' : 'ok',
    },
    {
      id: 'risk_oml',
      label: 'Board Packet Prep',
      detail: complianceScore < 80
        ? 'Meeting agendas not consistently posted 48 hrs in advance'
        : 'OML posting on track for active boards',
      severity: complianceScore < 70 ? 'urgent' : complianceScore < 85 ? 'warn' : 'ok',
    },
    {
      id: 'risk_permit',
      label: 'Permit Queue Depth',
      detail: openCases.filter(c => c.procId === 'proc_permit').length > 3
        ? `${openCases.filter(c => c.procId === 'proc_permit').length} permits active — review capacity`
        : 'Permit queue within normal range',
      severity: openCases.filter(c => c.procId === 'proc_permit').length > 5 ? 'urgent' : openCases.filter(c => c.procId === 'proc_permit').length > 3 ? 'warn' : 'ok',
    },
    {
      id: 'risk_freecash',
      label: 'Free Cash Status',
      detail: fiscal.freeCash / fiscal.operatingBudget < 0.05
        ? 'Free cash below 5% — Finance Committee review required'
        : `Free cash at ${(fiscal.freeCash / fiscal.operatingBudget * 100).toFixed(1)}% — within acceptable range`,
      severity: fiscal.freeCash / fiscal.operatingBudget < 0.04 ? 'critical' : fiscal.freeCash / fiscal.operatingBudget < 0.05 ? 'warn' : 'ok',
    },
  ]

  // ── Meetings ─────────────────────────────────────────────────────────────
  const meetings: Meeting[] = [
    {
      id: `mtg_${seed}_1`,
      board: 'Board of Selectmen',
      date: futureDateStr(7),
      time: '7:00 PM',
      location: 'Town Hall, Main Meeting Room',
      posted: rand() > 0.2,
      agendaItems: ['Call to Order', 'Approve Minutes', 'DPW Director Report', 'License Renewals', 'Public Comment', 'Adjourn'],
    },
    {
      id: `mtg_${seed}_2`,
      board: 'Planning Board',
      date: futureDateStr(14),
      time: '6:30 PM',
      location: 'Town Hall, Planning Room',
      posted: rand() > 0.3,
      agendaItems: ['Approval of Minutes', 'Continued Hearing — Special Permit', 'ANR Review', 'Correspondence', 'Adjourn'],
    },
    {
      id: `mtg_${seed}_3`,
      board: 'Finance Committee',
      date: futureDateStr(21),
      time: '7:00 PM',
      location: 'Town Hall, Main Meeting Room',
      posted: false,
      agendaItems: ['Budget Review FY26', 'Department Presentations', 'Free Cash Certification Update'],
    },
    {
      id: `mtg_${seed}_4`,
      board: 'Board of Selectmen',
      date: pastDateStr(7),
      time: '7:00 PM',
      location: 'Town Hall, Main Meeting Room',
      posted: true,
      agendaItems: ['Approve Minutes', 'Town Administrator Report', 'MGL c.30B Procurement Vote', 'Adjourn'],
    },
    {
      id: `mtg_${seed}_5`,
      board: 'Board of Health',
      date: futureDateStr(10),
      time: '6:00 PM',
      location: 'Town Hall, Conference Room B',
      posted: rand() > 0.4,
      agendaItems: ['Monthly Report', 'Food Establishment Inspections', 'Complaint Review', 'Adjourn'],
    },
  ]

  // ── Activity ──────────────────────────────────────────────────────────────
  const activityTypes: ActivityItem['type'][] = ['case_opened', 'stage_advanced', 'case_closed', 'seal_generated', 'case_blocked', 'note_added']
  const activity: ActivityItem[] = cases.slice(0, 6).map((c, i) => ({
    id: `act_${seed}_${i}`,
    type: activityTypes[i % activityTypes.length],
    title: activityTypes[i % activityTypes.length] === 'case_opened' ? 'Case Opened' : activityTypes[i % activityTypes.length] === 'stage_advanced' ? 'Stage Advanced' : activityTypes[i % activityTypes.length] === 'case_closed' ? 'Case Closed' : activityTypes[i % activityTypes.length] === 'seal_generated' ? 'SEAL Generated' : activityTypes[i % activityTypes.length] === 'case_blocked' ? 'Case Blocked' : 'Note Added',
    description: `${c.id} — ${c.subject} (${c.procName})`,
    timestamp: daysAgoDate(i + 1),
    caseId: c.id,
    actorName: members[i % members.length]?.name ?? 'System',
  }))

  return {
    org,
    fiscal,
    stats,
    members,
    roles,
    cases,
    watchFlags,
    riskFlags,
    meetings,
    activity,
    _meta: {
      staffSource: 'estimated' as const,
      staffNotice: null,
      staffWebsite: null,
      fiscalSource: 'estimated' as const,
      fiscalYear: fiscal.fiscalYear,
      loadedAt: new Date().toISOString(),
    },
  }
}
