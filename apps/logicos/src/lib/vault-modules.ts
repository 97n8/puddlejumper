/**
 * VAULT Module Catalog — LogicOS
 *
 * 11 governance module types for PublicLogic VAULT.
 * Connector routing lets each town pick where intake, documents,
 * and tracking land across SharePoint, Google, and GitHub.
 */

// ── Connector routing types ───────────────────────────────────────────────────

export type ConnectorDestination = 'sharepoint' | 'google' | 'github' | 'none'

export interface RoutingSlot {
  key: string
  label: string
  description: string
  supports: ConnectorDestination[]
}

// ── Module types ─────────────────────────────────────────────────────────────

export type EnforcementMode = 'core' | 'tailored'

export interface VaultModule {
  id: string
  name: string
  domain: string
  description: string
  mglCitation: string
  defaultRetentionYears: number
  defaultWorkflowSteps: string[]
  routingSlots: RoutingSlot[]
}

export interface RAOEntry { id: string; name: string; email: string; phone: string; isPrimary: boolean }
export interface TrainingLink { id: string; title: string; url: string }

export type CustomFieldType = 'text' | 'email' | 'url' | 'date' | 'datetime' | 'number' | 'boolean' | 'choice' | 'multi-choice' | 'multi-line'

export interface CustomField {
  id: string
  name: string        // snake_case identifier
  label: string       // display label
  type: CustomFieldType
  required: boolean
  options?: string[]  // for choice / multi-choice
  description?: string
}

export interface ModuleStatusLabels {
  open: string
  in_progress: string
  pending_approval: string
  approved: string
  closed: string
  archived: string
}

export interface ModuleView {
  id: string
  name: string
  filter: string
  sort: string
  accessRole: string
}

export interface ModuleConfig {
  moduleId: string
  enforcementMode: EnforcementMode
  primaryApprover: string
  statutoryBasis: string
  retentionYears: number
  workflowSteps: string[]
  connectorRoutes: Record<string, ConnectorDestination>
  notes: string
  raos: RAOEntry[]
  trainingLinks: TrainingLink[]
  // Magic Maker fields
  customFields: CustomField[]
  sealOnArchive: boolean
  legalHoldEligible: boolean
  namingPattern: string
  moduleCode: string
  // Compliance / governance
  track: 'municipal' | 'general' | 'shared'
  vaultGate: 'foundations' | 'boundary' | 'none'
  encodingPartner: 'polimorphic' | 'none'
  slaDefaultDays: number
  slaWarningDays: number
  slaExtensionDays: number | null
  slaEscalationRoles: string[]
  statusLabels: ModuleStatusLabels
  views: ModuleView[]
}

export interface BrandConfig {
  displayName: string
  color: string
  icon: string
}

export interface ConnectFolder { id: string; name: string; path?: string }
export interface ConnectTemplate { id: string; name: string; type?: string }

export interface ConnectConfig {
  connectors: string[]
  folders: ConnectFolder[]
  templates: ConnectTemplate[]
}

export interface BuilderDraftSetup {
  moduleId: string
  officerName: string
  officerTitle: string
  officerEmail: string
  officerPhone: string
  routing: Record<string, 'sharepoint' | 'google' | 'none'>
  folders: Record<string, string>
  retentionYears: number
  workflowSteps: string[]
  workflowAssignments: Record<string, string>
  notes: string
}

export interface BuilderDraftState {
  town: string
  workflowTeamSize: '' | '1' | '2-3' | '4-8' | '9+'
  selectedIds: string[]
  setups: Record<string, BuilderDraftSetup>
  activeStep?: 'town' | 'configure' | 'review'
}

export interface BuilderSession {
  id: string
  town: string
  selectedModuleIds: string[]
  configs: Record<string, ModuleConfig>
  status: 'draft' | 'review' | 'activated'
  createdAt: number
  updatedAt: number
  brandConfig: BrandConfig
  connectConfig: ConnectConfig
  source?: 'builder' | 'town-demo' | 'seed'
  draftState?: BuilderDraftState
}

// ── Module catalog ────────────────────────────────────────────────────────────

export const VAULT_MODULES: VaultModule[] = [
  {
    id: 'VAULTPRR',
    name: 'Public Records Requests',
    domain: 'Public Records',
    description: 'Full PRR lifecycle with T10/T25/T90 deadline enforcement, exemption logging, fee waiver automation, and appeal window tracking.',
    mglCitation: 'M.G.L. c.66 §10 · 950 CMR 32.00',
    defaultRetentionYears: 6,
    defaultWorkflowSteps: ['Intake', 'Assessment', 'Gathering', 'Review', 'Response', 'Closure'],
    routingSlots: [
      { key: 'intake', label: 'Requests come in via', description: 'Where new public records requests are received', supports: ['sharepoint', 'google', 'github', 'none'] },
      { key: 'documents', label: 'Released records stored in', description: 'Where approved records are delivered and retained', supports: ['sharepoint', 'google', 'github', 'none'] },
      { key: 'tracking', label: 'Case tracking in', description: 'Where deadline status and case state is tracked', supports: ['sharepoint', 'github', 'none'] },
    ],
  },
  {
    id: 'VAULTCLERK',
    name: 'Licensing & Permitting',
    domain: 'Clerk Ops',
    description: 'License applications through inspection, approval or denial, and issuance. Enforces deemed-approval rules if deadlines are missed.',
    mglCitation: 'M.G.L. c.101 · c.41 §15',
    defaultRetentionYears: 10,
    defaultWorkflowSteps: ['Application Intake', 'Completeness Review', 'Inspection (if required)', 'Decision', 'Issuance', 'Appeal Window'],
    routingSlots: [
      { key: 'intake', label: 'Applications come in via', description: 'Where license and permit applications are submitted', supports: ['sharepoint', 'google', 'github', 'none'] },
      { key: 'documents', label: 'Issued licenses stored in', description: 'Where approved license documents are filed', supports: ['sharepoint', 'google', 'none'] },
      { key: 'tracking', label: 'Application tracking in', description: 'Where status and deadline tracking lives', supports: ['sharepoint', 'github', 'none'] },
    ],
  },
  {
    id: 'VAULTFISCAL',
    name: 'Fiscal Controls & AP',
    domain: 'Fiscal',
    description: '3-way match enforcement (invoice / PO / receipt), budget availability gating, approval chain by amount, and warrant-equivalent payment records.',
    mglCitation: 'M.G.L. c.41 §56 · c.30B · c.149',
    defaultRetentionYears: 10,
    defaultWorkflowSteps: ['Invoice Intake', '3-Way Match', 'Budget Check', 'Approval Chain', 'Payment', 'GL Posting'],
    routingSlots: [
      { key: 'intake', label: 'Invoices received in', description: 'Where vendor invoices and POs land', supports: ['sharepoint', 'google', 'none'] },
      { key: 'documents', label: 'Financial records stored in', description: 'Where approved invoices, POs, and receipts are filed', supports: ['sharepoint', 'google', 'none'] },
      { key: 'tracking', label: 'Approval tracking in', description: 'Where approval chain status is tracked', supports: ['sharepoint', 'github', 'none'] },
    ],
  },
  {
    id: 'VAULTTIME',
    name: 'Timesheets & Payroll',
    domain: 'Payroll',
    description: 'Weekly timesheet entry with supervisor approval, overtime authorization routing, and immutable payroll-posted records.',
    mglCitation: 'M.G.L. c.149',
    defaultRetentionYears: 7,
    defaultWorkflowSteps: ['Entry (by EOD Friday)', 'Supervisor Review', 'Overtime Routing (if >40h)', 'Payroll Submission', 'Post & Lock'],
    routingSlots: [
      { key: 'intake', label: 'Timesheets submitted via', description: 'Where staff enter and submit their hours', supports: ['sharepoint', 'google', 'none'] },
      { key: 'documents', label: 'Payroll records stored in', description: 'Where locked payroll records are retained', supports: ['sharepoint', 'google', 'none'] },
    ],
  },
  {
    id: 'VAULTFIX',
    name: 'Work Orders & Maintenance',
    domain: 'Facilities',
    description: 'Work requests from intake through assignment, completion, and verification. Priority-based SLA tracking with skill routing.',
    mglCitation: 'M.G.L. c.30 §39K',
    defaultRetentionYears: 5,
    defaultWorkflowSteps: ['Request Intake', 'Priority Assessment', 'Assignment', 'Work in Progress', 'Verification', 'Closure'],
    routingSlots: [
      { key: 'intake', label: 'Requests submitted via', description: 'Where facilities and IT requests come in', supports: ['sharepoint', 'google', 'github', 'none'] },
      { key: 'tracking', label: 'Work orders tracked in', description: 'Where open work orders and SLA status live', supports: ['sharepoint', 'github', 'none'] },
    ],
  },
  {
    id: 'VAULTONBOARD',
    name: 'Staff & Vendor Onboarding',
    domain: 'Onboarding',
    description: 'New hire and vendor onboarding with mandatory task sequencing, background check gate, and locked training records.',
    mglCitation: 'M.G.L. c.149 · c.30B',
    defaultRetentionYears: 5,
    defaultWorkflowSteps: ['Background Check Gate', 'Pre-Start Setup', 'Day 1 Checklist', 'Systems Access', 'Training Lock', 'Manager Sign-Off'],
    routingSlots: [
      { key: 'documents', label: 'Onboarding records stored in', description: 'Where I-9s, training certs, and onboarding docs go', supports: ['sharepoint', 'google', 'none'] },
      { key: 'tracking', label: 'Task checklist tracked in', description: 'Where onboarding task progress is visible', supports: ['sharepoint', 'github', 'none'] },
    ],
  },
  {
    id: 'VAULTPERMIT',
    name: 'Permit Issuance & Compliance',
    domain: 'Permits',
    description: 'Building and zoning permit issuance, condition tracking, and ongoing compliance monitoring after issuance.',
    mglCitation: 'M.G.L. c.40A §9',
    defaultRetentionYears: 7,
    defaultWorkflowSteps: ['Application', 'Verification', 'Conditions Review', 'Fee Collection', 'Issuance', 'Compliance Check'],
    routingSlots: [
      { key: 'intake', label: 'Applications received via', description: 'Where permit applications come in', supports: ['sharepoint', 'google', 'none'] },
      { key: 'documents', label: 'Permits stored in', description: 'Where issued permits and compliance records are filed', supports: ['sharepoint', 'google', 'none'] },
      { key: 'tracking', label: 'Compliance tracking in', description: 'Where active permits and conditions are monitored', supports: ['sharepoint', 'github', 'none'] },
    ],
  },
  {
    id: 'VAULTHR',
    name: 'HR & Personnel',
    domain: 'Human Resources',
    description: 'Personnel actions, evaluations, grievances, and HR compliance with approval routing and locked personnel records.',
    mglCitation: 'M.G.L. c.41 §108',
    defaultRetentionYears: 10,
    defaultWorkflowSteps: ['Request', 'HR Review', 'Department Head', 'Town Manager', 'Execution & Record'],
    routingSlots: [
      { key: 'documents', label: 'Personnel records stored in', description: 'Where personnel files and HR documents are kept', supports: ['sharepoint', 'google', 'none'] },
      { key: 'tracking', label: 'Actions tracked in', description: 'Where HR action status and approvals are tracked', supports: ['sharepoint', 'github', 'none'] },
    ],
  },
  {
    id: 'VAULTPROCURE',
    name: 'Procurement & Contracts',
    domain: 'Procurement',
    description: 'Bid solicitation, vendor evaluation, contract execution, and ongoing contract monitoring with compliance gates.',
    mglCitation: 'M.G.L. c.30B',
    defaultRetentionYears: 10,
    defaultWorkflowSteps: ['Specification', 'Solicitation', 'Bid Evaluation', 'Award', 'Contract Execution', 'Monitoring'],
    routingSlots: [
      { key: 'intake', label: 'Bids received via', description: 'Where vendor bids and proposals come in', supports: ['sharepoint', 'google', 'github', 'none'] },
      { key: 'documents', label: 'Contracts stored in', description: 'Where executed contracts and bid documents are filed', supports: ['sharepoint', 'google', 'none'] },
      { key: 'tracking', label: 'Procurement tracked in', description: 'Where bid status and contract milestones are tracked', supports: ['sharepoint', 'github', 'none'] },
    ],
  },
  {
    id: 'VAULTRECS',
    name: 'Records Management',
    domain: 'Records',
    description: 'Retention schedule management, public records request triage, and records disposition with destruction authorization.',
    mglCitation: 'M.G.L. c.66 §10 · c.30 §42',
    defaultRetentionYears: 6,
    defaultWorkflowSteps: ['Classification', 'Schedule Assignment', 'Active Retention', 'Review at Maturity', 'Disposition Authorization', 'Destruction or Transfer'],
    routingSlots: [
      { key: 'documents', label: 'Records repository in', description: 'Where active records are stored and indexed', supports: ['sharepoint', 'google', 'none'] },
      { key: 'tracking', label: 'Retention schedule in', description: 'Where retention deadlines and disposition status live', supports: ['sharepoint', 'github', 'none'] },
    ],
  },
  {
    id: 'VAULTMEET',
    name: 'Meetings & Open Meeting Law',
    domain: 'Governance',
    description: '48-hour notice enforcement, agenda management, vote recording, and 30-day minutes approval cycle for all public bodies. Full OML compliance per M.G.L. c.30A §§18-25.',
    mglCitation: 'M.G.L. c.30A §§18-25 · 940 CMR 29.00',
    defaultRetentionYears: 7,
    defaultWorkflowSteps: ['Notice', 'Agenda', 'In-Meeting', 'Draft Minutes', 'Minutes Approval', 'Posted', 'Closed'],
    routingSlots: [
      { key: 'notice', label: 'Meeting notices posted to', description: 'Where 48-hour notices are published (must include town website)', supports: ['sharepoint', 'google', 'none'] },
      { key: 'minutes', label: 'Approved minutes stored in', description: 'Where posted minutes are retained for public access', supports: ['sharepoint', 'google', 'none'] },
      { key: 'tracking', label: 'Meeting calendar tracked in', description: 'Where scheduled meetings and OML deadlines are tracked', supports: ['sharepoint', 'github', 'none'] },
    ],
  },
  {
    id: 'SUTTONCLERK',
    name: 'Town Clerk Operations',
    domain: 'Town Clerk',
    description: 'Vital records, business licensing, dog licenses, election administration, and Open Meeting Law compliance for the Town Clerk\'s office.',
    mglCitation: 'M.G.L. c.41 §19 · c.30A · c.51',
    defaultRetentionYears: 7,
    defaultWorkflowSteps: ['Intake', 'Completeness Review', 'Processing', 'Approval / Issuance', 'Filing', 'Archive'],
    routingSlots: [
      { key: 'intake', label: 'Requests and applications received via', description: 'Where clerk requests, license applications, and meeting postings come in', supports: ['sharepoint', 'google', 'github', 'none'] },
      { key: 'documents', label: 'Issued documents and vital records stored in', description: 'Where licenses, certificates, and OML-filed minutes are retained', supports: ['sharepoint', 'google', 'none'] },
      { key: 'tracking', label: 'Election and compliance tracking in', description: 'Where election calendars, OML posting deadlines, and license renewals are tracked', supports: ['sharepoint', 'github', 'none'] },
    ],
  },
  {
    id: 'VAULTDOG',
    name: 'Animal Control & Dog Licensing',
    domain: 'Animal Control',
    description: 'Annual dog license registration with rabies cert tracking, fee collection, and renewal enforcement. Assigns a Dog Officer and issues license tags.',
    mglCitation: 'M.G.L. c.140 §§137–141',
    defaultRetentionYears: 3,
    defaultWorkflowSteps: ['Application', 'Verification', 'Fee Collection', 'Issuance', 'Renewal / Expiry'],
    routingSlots: [
      { key: 'intake', label: 'Applications received via', description: 'Where dog license applications are submitted', supports: ['sharepoint', 'google', 'github', 'none'] },
      { key: 'documents', label: 'Issued licenses stored in', description: 'Where license records and rabies certs are retained', supports: ['sharepoint', 'google', 'github', 'none'] },
    ],
  },
]

// ── All 351 Massachusetts Cities & Towns ──────────────────────────────────────

export const MA_TOWNS: string[] = [
  // Barnstable
  'Barnstable','Bourne','Brewster','Chatham','Dennis','Eastham','Falmouth',
  'Harwich','Mashpee','Orleans','Provincetown','Sandwich','Truro','Wellfleet','Yarmouth',
  // Berkshire
  'Adams','Alford','Becket','Cheshire','Clarksburg','Dalton','Egremont','Florida',
  'Great Barrington','Hancock','Hinsdale','Lanesborough','Lee','Lenox','Monterey',
  'Mount Washington','New Ashford','New Marlborough','North Adams','Otis','Peru',
  'Pittsfield','Richmond','Sandisfield','Savoy','Sheffield','Stockbridge','Tyringham',
  'Washington','West Stockbridge','Williamstown','Windsor',
  // Bristol
  'Acushnet','Attleboro','Berkley','Dartmouth','Dighton','Easton','Fairhaven',
  'Fall River','Freetown','Mansfield','New Bedford','North Attleborough','Norton',
  'Raynham','Rehoboth','Seekonk','Somerset','Swansea','Taunton','Westport',
  // Dukes
  'Aquinnah','Chilmark','Edgartown','Gosnold','Oak Bluffs','Tisbury','West Tisbury',
  // Essex
  'Amesbury','Andover','Beverly','Boxford','Danvers','Essex','Georgetown','Gloucester',
  'Groveland','Hamilton','Haverhill','Ipswich','Lawrence','Lynn','Lynnfield',
  'Manchester-by-the-Sea','Marblehead','Merrimac','Methuen','Middleton','Nahant',
  'Newbury','Newburyport','North Andover','Peabody','Rockport','Rowley','Salem',
  'Salisbury','Saugus','Swampscott','Topsfield','Wenham','West Newbury',
  // Franklin
  'Ashfield','Bernardston','Buckland','Charlemont','Colrain','Conway','Deerfield',
  'Erving','Gill','Greenfield','Hawley','Heath','Leverett','Leyden','Monroe',
  'Montague','New Salem','Northfield','Orange','Rowe','Shelburne','Shutesbury',
  'Sunderland','Warwick','Wendell','Whately',
  // Hampden
  'Agawam','Blandford','Brimfield','Chester','Chicopee','East Longmeadow','Granville',
  'Hampden','Holland','Holyoke','Longmeadow','Ludlow','Monson','Montgomery','Palmer',
  'Russell','Southwick','Springfield','Tolland','Wales','West Springfield','Westfield',
  'Wilbraham',
  // Hampshire
  'Amherst','Belchertown','Chesterfield','Cummington','Easthampton','Goshen','Granby',
  'Hadley','Hatfield','Huntington','Middlefield','Northampton','Pelham','Plainfield',
  'South Hadley','Southampton','Ware','Westhampton','Williamsburg','Worthington',
  // Middlesex
  'Acton','Arlington','Ashby','Ashland','Ayer','Bedford','Belmont','Billerica',
  'Boxborough','Burlington','Cambridge','Carlisle','Chelmsford','Concord','Dracut',
  'Dunstable','Everett','Framingham','Groton','Holliston','Hopkinton','Hudson',
  'Lexington','Lincoln','Littleton','Lowell','Malden','Marlborough','Maynard',
  'Medford','Melrose','Natick','Newton','North Reading','Pepperell','Reading',
  'Sherborn','Shirley','Somerville','Stoneham','Stow','Sudbury','Tewksbury',
  'Townsend','Tyngsborough','Wakefield','Waltham','Watertown','Wayland','Westford',
  'Weston','Wilmington','Winchester','Woburn',
  // Nantucket
  'Nantucket',
  // Norfolk
  'Avon','Bellingham','Braintree','Brookline','Canton','Cohasset','Dedham','Dover',
  'Foxborough','Franklin','Holbrook','Medfield','Medway','Millis','Milton','Needham',
  'Norfolk','Norwood','Plainville','Quincy','Randolph','Sharon','Stoughton','Walpole',
  'Wellesley','Westwood','Weymouth','Wrentham',
  // Plymouth
  'Abington','Bridgewater','Brockton','Carver','Duxbury','East Bridgewater','Halifax',
  'Hanover','Hanson','Hingham','Hull','Kingston','Lakeville','Marion','Marshfield',
  'Mattapoisett','Middleborough','Norwell','Pembroke','Plymouth','Plympton','Rochester',
  'Rockland','Scituate','Wareham','West Bridgewater','Whitman',
  // Suffolk
  'Boston','Chelsea','Revere','Winthrop',
  // Worcester
  'Ashburnham','Athol','Auburn','Barre','Berlin','Blackstone','Bolton','Boylston',
  'Brookfield','Charlton','Clinton','Douglas','Dudley','East Brookfield','Fitchburg',
  'Gardner','Grafton','Hardwick','Harvard','Holden','Hopedale','Hubbardston',
  'Lancaster','Leicester','Leominster','Lunenburg','Mendon','Milford','Millbury',
  'Millville','New Braintree','North Brookfield','Northborough','Northbridge','Oakham',
  'Oxford','Paxton','Petersham','Phillipston','Princeton','Royalston','Rutland',
  'Shrewsbury','Southborough','Southbridge','Spencer','Sterling','Sturbridge','Sutton',
  'Templeton','Upton','Uxbridge','Warren','Webster','West Boylston','West Brookfield',
  'Westborough','Westminster','Winchendon','Worcester',
]

// ── Helpers ───────────────────────────────────────────────────────────────────

export function getVaultModule(id: string): VaultModule | undefined {
  const direct = VAULT_MODULES.find((m) => m.id === id)
  if (direct) return direct
  // Town-branded IDs: SUTTONCLERK → VAULTCLERK, LOGICVILLEPRR → VAULTPRR, etc.
  const knownSuffixes = ['PRR','CLERK','FISCAL','TIME','FIX','ONBOARD','PERMIT','HR','PROCURE','RECS','MEET']
  for (const suffix of knownSuffixes) {
    if (id.endsWith(suffix)) return VAULT_MODULES.find(m => m.id === `VAULT${suffix}`)
  }
  return undefined
}

export function defaultModuleConfig(moduleId: string): ModuleConfig {
  const mod = getVaultModule(moduleId)
  const connectorRoutes: Record<string, ConnectorDestination> = {}
  for (const slot of mod?.routingSlots ?? []) {
    connectorRoutes[slot.key] = 'none'
  }
  return {
    moduleId,
    enforcementMode: 'core',
    primaryApprover: '',
    statutoryBasis: mod?.mglCitation ?? '',
    retentionYears: mod?.defaultRetentionYears ?? 7,
    workflowSteps: mod?.defaultWorkflowSteps ?? [],
    connectorRoutes,
    notes: '',
    raos: [],
    trainingLinks: [],
    customFields: [],
    sealOnArchive: true,
    legalHoldEligible: true,
    namingPattern: `${moduleId.toLowerCase()}-{year}-{seq}`,
    moduleCode: moduleId.replace('VAULT', '').replace('vault', '').slice(0, 6).toUpperCase() || moduleId.slice(0, 6).toUpperCase(),
    track: 'municipal',
    vaultGate: 'foundations',
    encodingPartner: 'none',
    slaDefaultDays: mod?.defaultRetentionYears ? 10 : 30,
    slaWarningDays: 3,
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
  }
}

export const BUILDER_SESSION_STORAGE_KEY_PREFIX = 'logicvault-builder-sessions'

function normalizeScope(scope: string | null | undefined) {
  return (scope ?? '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
}

export function getBuilderSessionStorageKey(scope?: string | null) {
  const normalizedScope = normalizeScope(scope)
  return normalizedScope
    ? `${BUILDER_SESSION_STORAGE_KEY_PREFIX}:${normalizedScope}`
    : BUILDER_SESSION_STORAGE_KEY_PREFIX
}

function loadSessions(scope?: string | null): BuilderSession[] {
  try {
    return JSON.parse(localStorage.getItem(getBuilderSessionStorageKey(scope)) ?? '[]')
  } catch {
    return []
  }
}

function saveSessions(sessions: BuilderSession[], scope?: string | null) {
  const storageKey = getBuilderSessionStorageKey(scope)
  localStorage.setItem(storageKey, JSON.stringify(sessions))
  // Dispatch a storage event so same-tab listeners (useEnvironments) see the change
  window.dispatchEvent(new StorageEvent('storage', { key: storageKey }))
}

export function newBuilderSession(
  town: string,
  scope?: string | null,
  seed: Partial<BuilderSession> = {},
): BuilderSession {
  const now = Date.now()
  const id =
    seed.id ?? (typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `session-${now}-${Math.random().toString(36).slice(2, 9)}`)
  const session: BuilderSession = {
    id,
    town,
    selectedModuleIds: seed.selectedModuleIds ?? [],
    configs: seed.configs ?? {},
    status: seed.status ?? 'draft',
    createdAt: seed.createdAt ?? now,
    updatedAt: now,
    brandConfig: seed.brandConfig ?? {
      displayName: `${town} Governance`,
      color: '#3B6FD4',
      icon: '🏛️',
    },
    connectConfig: seed.connectConfig ?? {
      connectors: [],
      folders: [],
      templates: [],
    },
    source: seed.source,
    draftState: seed.draftState,
  }
  const sessions = loadSessions(scope)
  sessions.push(session)
  saveSessions(sessions, scope)
  return session
}

export function saveBuilderSession(session: BuilderSession, scope?: string | null): BuilderSession {
  const updated = { ...session, updatedAt: Date.now() }
  const sessions = loadSessions(scope)
  const idx = sessions.findIndex((s) => s.id === session.id)
  if (idx >= 0) {
    sessions[idx] = updated
  } else {
    sessions.push(updated)
  }
  saveSessions(sessions, scope)
  return updated
}

export function deleteBuilderSession(id: string, scope?: string | null): void {
  const sessions = loadSessions(scope)
  saveSessions(sessions.filter(s => s.id !== id), scope)
}

export function listBuilderSessions(scope?: string | null): BuilderSession[] {
  return loadSessions(scope)
}

export function getBuilderSession(id: string, scope?: string | null): BuilderSession | undefined {
  return loadSessions(scope).find((s) => s.id === id)
}

export function isModuleComplete(config: ModuleConfig | undefined): boolean {
  if (!config) return false
  const primaryRAO = (config.raos ?? []).find((r: RAOEntry) => r.isPrimary && r.name?.trim())
  const hasOfficer = !!primaryRAO || !!config.primaryApprover?.trim()
  if (!hasOfficer) return false
  if (!config.retentionYears || config.retentionYears < 1) return false
  return true
}
