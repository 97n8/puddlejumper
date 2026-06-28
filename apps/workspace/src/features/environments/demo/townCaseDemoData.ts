import { VAULT_BUILD_TEMPLATES as FULL_VAULT_BUILD_TEMPLATES } from './vaultBuildTemplates'

export type DemoModule = {
  id: string
  label: string
  icon: string
  color: string
  desc: string
  summary: string
  authorityChain: string[]
  accountabilityTriggers: string[]
  boundaryRules: string[]
  continuityRequirements: string[]
  mglCitations: string[]
  riskFlags: string[]
  suggestedAutomations: string[]
  operatorProtections: string[]
  proofCases: Array<{
    id: string
    title: string
    owner: string
    status: string
    note: string
  }>
  metrics: {
    records: number
    openItems: number
    automations: number
  }
}

export type DataSource = {
  id: string
  label: string
  icon: string
  status: 'demo-ready' | 'live-on-connect'
  category: 'town' | 'state' | 'platform'
  summary: string
  liveNote: string
}

export type ProvisioningTool = {
  id: string
  label: string
  summary: string
  outcome: string
}

export type TrialCommandCard = {
  id: string
  title: string
  metric: string
  note: string
  detail: string
}

export type TrialApp = {
  id: string
  name: string
  audience: string
  summary: string
  primaryAction: string
  outcome: string
  keyFields: string[]
}

export type DemoArtifact = {
  filename: string
  mimeType: string
  content: string
}

export type LiveTownRiskFlag = {
  code: string
  label: string
  severity: 'critical' | 'warning' | 'info' | 'passing'
  detail: string
  threshold: string
}

export type LiveTownMetrics = {
  operatingBudget: number | null
  totalEmployees: number | null
  totalSalariesWages: number | null
  averageSalary: number | null
  salariesPctBudget: number | null
  certifiedFreeCash: number | null
  freeCashPctBudget: number | null
  excessLevyCapacityPct: number | null
  totalStateAid: number | null
  debtServicePctBudget: number | null
}

export type LiveTownData = {
  municipality: string
  dorCode: number
  county: string
  fiscalYear: number
  computedAt: string
  metrics: LiveTownMetrics
  riskFlags: LiveTownRiskFlag[]
}

export type DemoTownTab = 'dashboard' | 'maker' | 'saved' | 'automations' | 'connections'

export type VaultBuildTemplate = {
  id: string
  moduleId: string
  code: string
  name: string
  department: string
  workspace: string
  statutoryAuthority: string
  retentionCode: string
  retentionDescription: string
  statutoryDeadline: string
  summary: string
  stages: string[]
  keyFields: string[]
  acceptanceCriteria: string[]
  stopRules: string[]
  trainingFocus: string
  archieveFolder: string
  archieveNaming: string
  deploymentPrerequisites: string[]
}

export const LIFECYCLE_STAGES = ['Discover', 'Design', 'Build', 'Encode', 'Transfer', 'Monitor'] as const

export const DATA_SOURCES: DataSource[] = [
  {
    id: 'town-docs',
    label: 'Town bylaws, policies, and records',
    icon: '📁',
    status: 'demo-ready',
    category: 'town',
    summary: 'Existing town documents, clerk files, agendas, packets, and local policies.',
    liveNote: 'Connected live in the town environment through LogicBridge / Files & Connections.',
  },
  {
    id: 'state-guidance',
    label: 'Massachusetts law and state guidance',
    icon: '🏛️',
    status: 'demo-ready',
    category: 'state',
    summary: 'M.G.L., state-level compliance references, and operating guidance relevant to the lane.',
    liveNote: 'Mapped into live environment references so staff can work against current state requirements.',
  },
  {
    id: 'meeting-history',
    label: 'Board agendas, minutes, and posting history',
    icon: '🗂️',
    status: 'demo-ready',
    category: 'town',
    summary: 'Clerk and committee history used to seed board compliance and appointment workflows.',
    liveNote: 'Connected from live town folders, posting exports, and retained packet libraries.',
  },
  {
    id: 'gis-parcels',
    label: 'GIS parcels, zoning, and district layers',
    icon: '🗺️',
    status: 'live-on-connect',
    category: 'town',
    summary: 'Parcel fabric, zoning layers, utility districts, road segments, and board geography that tie town decisions to place.',
    liveNote: 'Connected live through ArcGIS, assessor exports, and parcel-layer services so permits, hearings, and projects can snap to the map.',
  },
  {
    id: 'clerk-media',
    label: 'Clerk packets, recordings, and certified minutes',
    icon: '🎙️',
    status: 'live-on-connect',
    category: 'town',
    summary: 'Minutes, packet PDFs, vote summaries, and meeting recordings ready for OCR, search, and publication.',
    liveNote: 'Connected live from clerk archives, website posting tools, and video platforms so board memory survives staff turnover.',
  },
  {
    id: 'finance',
    label: 'Finance, payroll, and procurement extracts',
    icon: '💳',
    status: 'live-on-connect',
    category: 'town',
    summary: 'Budget backups, payroll exports, grant trackers, and procurement records.',
    liveNote: 'Connected live in implementation through the town’s own exports and systems.',
  },
  {
    id: 'platform',
    label: 'PublicLogic environment architecture',
    icon: '🔐',
    status: 'demo-ready',
    category: 'platform',
    summary: 'Module structure, LogicDASH snapshots, environment blueprinting, implementation packets, and module build logic.',
    liveNote: 'Provisioned directly into the town’s environment and fully customizable for white-label use.',
  },
]

export const PROVISIONING_TOOLS: ProvisioningTool[] = [
  {
    id: 'logicdash',
    label: 'LogicDASH',
    summary: 'Turns town and state inputs into leadership snapshots, risk flags, and digestible operating visibility.',
    outcome: 'Town leadership sees where deadlines, backlog, and risk are stacking up before staff has to explain it manually.',
  },
  {
    id: 'modulemaker',
    label: 'ModuleMaker',
    summary: 'Maps the operating lane into a real municipal module with forms, stages, controls, and ownership.',
    outcome: 'Town gets a repeatable build sheet for records, boards, permitting, appointments, fiscal, and more.',
  },
  {
    id: 'workspace',
    label: 'Workspace Flows',
    summary: 'Generates files right into the workspace or Vault so the demo shows something tangible immediately.',
    outcome: 'The town sees real packets, specs, and runbooks land where staff would actually use them.',
  },
  {
    id: 'connections',
    label: 'Live Connections',
    summary: 'Shows what is demo-previewed now and what connects live from actual town and state sources later.',
    outcome: 'Demo stays safe while implementation path remains honest and concrete.',
  },
  {
    id: 'logicbridge',
    label: 'LogicBridge',
    summary: 'Connects parcel systems, clerk archives, and municipal software without forcing staff into another IT project.',
    outcome: 'Town data starts feeding the same workspace leadership is already looking at, including maps, packets, and vote history.',
  },
]

export const TRIAL_COMMAND_CARDS: TrialCommandCard[] = [
  {
    id: 'prr',
    title: 'Public-records deadline',
    metric: '10 business days',
    note: 'Grounded in the public-records workflow build spec.',
    detail: 'Show intake, review, and response steps so leadership can see deadline pressure before the deadline slips.',
  },
  {
    id: 'payroll',
    title: 'Payroll approval run',
    metric: 'Bi-weekly cycle',
    note: 'Pulled from the payroll module structure.',
    detail: 'Show the finance lane with missing timesheets and unresolved discrepancies before payroll locks.',
  },
  {
    id: 'control-plane',
    title: 'Approval chain control',
    metric: 'Queue + templates',
    note: 'Inspired by the governance control-plane review capture.',
    detail: 'Give the town a concrete picture of approvals, routing templates, and queue counts as daily operating infrastructure.',
  },
]

export const AUTOMATION_EXHIBITS = [
  {
    title: 'Public-records day-8 escalation',
    summary: 'Escalate unresolved records requests before the 10-business-day deadline expires.',
    output: 'Supervisor digest + response packet reminder + Vault runbook entry',
  },
  {
    title: 'Payroll exception digest',
    summary: 'Package missing timesheets, approval status, and discrepancy notes for the town finance lead.',
    output: 'Approval packet + Workspace drop + finance review brief',
  },
  {
    title: 'DPW closeout handoff',
    summary: 'Move completed work-order evidence into a clean archive and push the summary back to leadership.',
    output: 'Completion memo + archive packet + dashboard-ready status update',
  },
  {
    title: 'Board packet + parcel brief',
    summary: 'Assemble agenda, affected parcels, zoning context, prior votes, and recording links before the chair walks into the room.',
    output: 'Meeting-room packet + parcel map brief + certified archive trail',
  },
  {
    title: 'Board packet posting deadline alert',
    summary: 'Fire a structured reminder when posting window is under 8 hours — flags incomplete items and routes to the clerk and chair before the deadline closes.',
    output: 'Clerk alert + chair notification + posting-ready checklist with outstanding items highlighted',
  },
]

export const CONNECTION_EXHIBITS = [
  'Town clerk folders and posting history for meeting-law and board workflows',
  'Finance / payroll exports for AP, payroll, and procurement lanes',
  'Massachusetts law and state guidance for deadline, retention, and authority mapping',
  'ArcGIS parcel, zoning, and district layers for hearings, permits, and capital planning',
  'Minutes archives, packet libraries, and recordings for searchable board memory',
]

export const LOGICDOC_EXHIBITS = [
  'Leadership kickoff brief for town administrators, clerks, and department heads',
  'Public-records and payroll quick-reference sheets for supervisors',
  'Implementation packet, archive map, and training-ready handoff materials',
  'Meeting-room packet guide with parcel context, prior votes, and clerk certification notes',
]

export const TRIAL_APPS: TrialApp[] = [
  {
    id: 'board-packet',
    name: 'Board packet review',
    audience: 'Town administrator + board chairs',
    summary: 'A clean front-door surface for agenda packet assembly, review, and signoff before posting.',
    primaryAction: 'Open packet review',
    outcome: 'The town sees a real app front end sitting on the governed board-compliance lane.',
    keyFields: ['meeting_body', 'agenda_deadline', 'posting_window', 'packet_status'],
  },
  {
    id: 'records-intake',
    name: 'Public records intake',
    audience: 'Clerk office + residents',
    summary: 'A contained intake surface for request capture, status clarity, and immediate routing into the governed queue.',
    primaryAction: 'Start records request',
    outcome: 'The town sees intake and operations connected inside one enclosed module.',
    keyFields: ['requestor_name', 'delivery_preference', 'department_scope', 'deadline_track'],
  },
  {
    id: 'service-hub',
    name: 'Service hub',
    audience: 'Residents + counter staff',
    summary: 'A simple request app for permits, appointment packets, and service-routing handoff inside the environment.',
    primaryAction: 'Launch service request',
    outcome: 'The town sees how app entry points can feed ModuleMaker and LogicDASH without leaving the trial.',
    keyFields: ['service_lane', 'property_address', 'priority_level', 'assigned_owner'],
  },
  {
    id: 'meeting-room',
    name: 'Meeting room board view',
    audience: 'Board chairs + clerks + town administrator',
    summary: 'A room-ready surface that opens the agenda, packet, parcel map, prior votes, and live minutes in one place.',
    primaryAction: 'Open board view',
    outcome: 'The town sees the board room and the back office running on the same governed record.',
    keyFields: ['meeting_body', 'packet_status', 'related_parcels', 'vote_log'],
  },
  {
    id: 'parcel-brief',
    name: 'Parcel decision brief',
    audience: 'Planning, zoning, conservation, and capital teams',
    summary: 'A location-first app that pulls parcel context, district rules, prior board actions, and active cases into one operator surface.',
    primaryAction: 'Open parcel brief',
    outcome: 'The town sees GIS, permitting, and meeting history behaving like one operating layer.',
    keyFields: ['parcel_id', 'property_address', 'districts', 'meeting_history'],
  },
]

export const DEMO_MODULES: DemoModule[] = [
  {
    id: 'public_records',
    label: 'Public Records',
    icon: '📋',
    color: '#D4A853',
    desc: 'FOIA intake, deadline routing, redaction handoff, and release history.',
    summary: 'System-held records routing keeps public requests moving even when a single clerk is out. The town gets one chain of custody from intake through release.',
    authorityChain: ['Requestor intake -> Clerk review', 'Town counsel redaction review', 'Department response owner', 'Release approval log'],
    accountabilityTriggers: ['Deadline nearing 3 business days', 'Redaction request missing rationale', 'Appeal packet requested'],
    boundaryRules: ['No release without source record link', 'Every exemption claim needs a named reviewer', 'Only approved records move to public packet'],
    continuityRequirements: ['Template response library', 'Shared request queue', 'Archive copy of every release packet'],
    mglCitations: ['M.G.L. c.66 §10', '950 CMR 32.00'],
    riskFlags: ['Holiday backlog can hide missed deadlines', 'Email-only tracking breaks appeal defense'],
    suggestedAutomations: ['Daily due-soon digest', 'Auto-generate acknowledgement letter', 'Release packet export with disposition log'],
    operatorProtections: ['One-click release packet', 'Role-based review chain instead of personal inboxes'],
    proofCases: [
      { id: 'PR-241', title: 'Police log request', owner: 'Clerk office', status: 'Due tomorrow', note: 'Counsel review attached. Response due April 9 — needs final release sign-off today.' },
      { id: 'PR-233', title: 'Budget backup request', owner: 'Finance office', status: 'Released', note: 'Packet exported with full response trail.' },
      { id: 'PR-227', title: 'Zoning correspondence search', owner: 'Planning office', status: 'Awaiting records', note: 'Department follow-up scheduled automatically.' },
    ],
    metrics: { records: 146, openItems: 7, automations: 3 },
  },
  {
    id: 'permitting',
    label: 'Permitting',
    icon: '🏗️',
    color: '#6B9EBB',
    desc: 'Application intake, parcel context, review routing, inspections, and issuance checkpoints.',
    summary: 'Permits move through one visible lane instead of bouncing between counter staff, inspectors, and boards. Applicants, staff, and hearings can all work from the same parcel-aware record.',
    authorityChain: ['Applicant intake -> Permit clerk', 'Department review owners', 'Inspector signoff', 'Issuance record'],
    accountabilityTriggers: ['Inspection overdue', 'Board review required', 'Fee exception requested'],
    boundaryRules: ['No issuance before all departmental checks clear', 'Inspection notes must attach to permit record', 'Variance cases escalate to board packet'],
    continuityRequirements: ['Reusable intake fields', 'Inspector note templates', 'Decision packet archive'],
    mglCitations: ['M.G.L. c.40A', '780 CMR workflow alignment'],
    riskFlags: ['Paper notes create missed inspection callbacks', 'Permit status confusion causes applicant churn'],
    suggestedAutomations: ['Inspection reminder sequence', 'Board packet compilation', 'Permit issuance notice', 'Parcel brief sync into hearings'],
    operatorProtections: ['Single permit timeline', 'Checklist-driven issuance gates', 'Parcel-linked record instead of address guesswork'],
    proofCases: [
      { id: 'PM-118', title: 'Main Street sign permit', owner: 'Building dept.', status: 'Inspection scheduled', note: 'Applicant packet already assembled.' },
      { id: 'PM-114', title: 'Accessory dwelling review', owner: 'Planning + zoning', status: 'Board routing', note: 'Variance hearing dates preloaded.' },
      { id: 'PM-109', title: 'Solar installation permit', owner: 'Electrical inspector', status: 'Issued', note: 'Release email and record export complete.' },
    ],
    metrics: { records: 89, openItems: 5, automations: 4 },
  },
  {
    id: 'board_compliance',
    label: 'Board Compliance',
    icon: '⚖️',
    color: '#8BBF7A',
    desc: 'Agenda prep, packets, quorum coverage, posting windows, votes, and meeting artifacts.',
    summary: 'Board work becomes durable and legible even when chairs, clerks, or counsel change. Agenda, packet, parcel context, recording, vote, and certified minutes all live in one governed record.',
    authorityChain: ['Board chair request -> Clerk agenda assembly', 'Posting compliance check', 'Packet release and minutes archive'],
    accountabilityTriggers: ['Posting window under 48 hours', 'Missing attendance confirmation', 'Minutes not certified', 'Parcel exhibit missing for hearing item'],
    boundaryRules: ['No agenda publish without posting timestamp', 'Every vote requires attendance record', 'Executive-session material stays sealed by role', 'Parcel-linked items require packet and map references'],
    continuityRequirements: ['Board packet template', 'Attendance register', 'Minutes certification workflow', 'Meeting-room display with agenda and parcel context'],
    mglCitations: ['M.G.L. c.30A §§18-25', 'Attorney General OML guidance'],
    riskFlags: ['Late attachments can undermine posting compliance', 'Minutes drafts disappear in email chains'],
    suggestedAutomations: ['Agenda posting checklist', 'Minutes certification reminders', 'Board packet export with vote tracker', 'Recording + transcript archive sync'],
    operatorProtections: ['Shared board calendar', 'Reusable compliance checklist per meeting', 'Searchable board memory instead of inbox archaeology'],
    proofCases: [
      { id: 'BC-084', title: 'Select board agenda — April 9', owner: 'Town clerk', status: 'Ready to post', note: 'Packet assembly closes tonight. Select Board meets April 9 at 7 PM — posting deadline in 6 hours.' },
      { id: 'BC-081', title: 'Conservation hearing', owner: 'Planning admin', status: 'Minutes in review', note: 'Parcel exhibits and certification reminder already attached.' },
      { id: 'BC-076', title: 'Capital committee packet', owner: 'Finance director', status: 'Posted', note: 'Public packet, internal backup, and prior-vote thread split cleanly.' },
    ],
    metrics: { records: 62, openItems: 4, automations: 3 },
  },
  {
    id: 'appointments',
    label: 'Appointments',
    icon: '🗓️',
    color: '#B07FBB',
    desc: 'Vacancy tracking, interview packets, term calendars, and vote handoff.',
    summary: 'The town can see every open seat, who owns recruitment, and when terms expire. Appointment records stop depending on someone remembering the spreadsheet.',
    authorityChain: ['Seat inventory -> Admin owner', 'Recruitment and interview packet', 'Board vote', 'Term and oath record'],
    accountabilityTriggers: ['Seat expires within 60 days', 'Applicant packet incomplete', 'Oath not recorded'],
    boundaryRules: ['Applicants stay private until packet is finalized', 'Only appointed seats generate oath workflow', 'Term dates must be system-held'],
    continuityRequirements: ['Seat roster', 'Interview packet template', 'Renewal reminders'],
    mglCitations: ['Town bylaw and board appointment schedule', 'Open appointment notice requirements'],
    riskFlags: ['Volunteer boards go dark when seats lapse silently', 'No centralized term calendar means surprise vacancies'],
    suggestedAutomations: ['Seat expiration digest', 'Interview packet compile', 'Appointment confirmation sequence'],
    operatorProtections: ['One board roster across the town', 'Renewal notices generated before seats lapse'],
    proofCases: [
      { id: 'AP-041', title: 'Council on Aging vacancy', owner: 'Town manager office', status: 'Interview packet ready', note: 'Three applicants normalized into one packet.' },
      { id: 'AP-036', title: 'ZBA alternate renewal', owner: 'Select board', status: 'Vote pending', note: 'Term record already staged.' },
      { id: 'AP-029', title: 'Cultural council seat', owner: 'Clerk office', status: 'Public notice open', note: 'Notice auto-closes on deadline.' },
    ],
    metrics: { records: 37, openItems: 6, automations: 2 },
  },
  {
    id: 'fiscal',
    label: 'Fiscal Operations',
    icon: '💰',
    color: '#CC7070',
    desc: 'Budget controls, procurement routing, and grant oversight.',
    summary: 'Fiscal work gets a visible control layer instead of living in a shared drive and someone’s head. Procurement, budget backup, and grant deliverables stay tied to the same operating record.',
    authorityChain: ['Department request', 'Finance review', 'Approving authority', 'Audit-ready archive'],
    accountabilityTriggers: ['Purchase exceeds threshold', 'Grant report due inside 10 days', 'Budget transfer missing authority note'],
    boundaryRules: ['No purchase order without line-item trace', 'Grant deliverables attach before closeout', 'Threshold exceptions require named approver'],
    continuityRequirements: ['Budget transfer forms', 'Grant milestone calendar', 'Procurement packet archive'],
    mglCitations: ['M.G.L. c.30B', 'Uniform procurement controls'],
    riskFlags: ['Threshold exceptions drift into email', 'Grant closeout knowledge leaves with one coordinator'],
    suggestedAutomations: ['Procurement threshold alert', 'Grant milestone digest', 'Board-ready budget transfer memo'],
    operatorProtections: ['Request packet assembled once', 'Procurement trail survives staff turnover'],
    proofCases: [
      { id: 'FI-067', title: 'DPW vehicle replacement', owner: 'Finance + DPW', status: 'Threshold review', note: 'Procurement packet auto-assembled.' },
      { id: 'FI-061', title: 'Library HVAC grant', owner: 'Town manager office', status: 'Reporting due', note: 'Q2 milestone report due April 30. Deliverable tracker and milestones loaded into daily digest.' },
      { id: 'FI-054', title: 'Police overtime transfer', owner: 'Finance office', status: 'Board memo drafted', note: 'Authority note and backup linked.' },
    ],
    metrics: { records: 74, openItems: 5, automations: 3 },
  },
]

export const VAULT_BUILD_TEMPLATES: VaultBuildTemplate[] = FULL_VAULT_BUILD_TEMPLATES


