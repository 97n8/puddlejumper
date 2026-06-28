/**
 * VAULT Module Types — production case management types
 * Based on CASE Workspace canonical spec from 97N8-Drafts
 */

// ── Deadline types ────────────────────────────────────────────────────────────

export interface DeadlineDef {
  key: string
  label: string
  days: number
  type: 'business' | 'calendar'
  triggersOn: 'creation' | 'closure'
  feeProhibitionIfMissed?: boolean
}

export interface CaseDeadline {
  key: string
  label: string
  dueDate: string           // ISO date string
  status: 'OPEN' | 'MET' | 'MISSED' | 'N/A'
  metAt?: string
}

export interface TollingEvent {
  id: string
  startDate: string
  endDate?: string
  reason: string
  loggedBy: string
  loggedAt: number
}

// ── Asset types ───────────────────────────────────────────────────────────────

export type AssetRetentionClass = 'KEEPER' | 'REFERENCE' | 'TRANSACTIONAL'

export interface CaseAsset {
  id: string
  assetType: string
  filename: string
  description?: string
  retentionClass: AssetRetentionClass
  isLocked: boolean
  lockedAt?: number
  lockedBy?: string
  createdAt: number
  createdBy: string
  tags: string[]
  contentType?: string
  contentBase64?: string    // for small docs stored locally
  externalUrl?: string      // for connector-stored files
}

// ── Audit log ─────────────────────────────────────────────────────────────────

export type AuditAction =
  | 'CREATE'
  | 'UPDATE'
  | 'STAGE_TRANSITION'
  | 'ASSET_ADD'
  | 'ASSET_LOCK'
  | 'DEADLINE_MET'
  | 'DEADLINE_MISSED'
  | 'ENFORCEMENT'
  | 'ESCALATION'
  | 'ASSIGN_RAO'
  | 'TROLL_START'
  | 'TROLL_END'
  | 'ASSIGN'
  | 'NOTE'
  | 'CLOSE'
  | 'BACKUP'
  | 'EMAIL_SENT'
  | 'APPROVAL'

export interface AuditEntry {
  id: string
  timestamp: number
  actor: string
  action: AuditAction
  stage?: string
  assetIds?: string[]
  oldValue?: unknown
  newValue?: unknown
  reason?: string
  ruleApplied?: string
  notes?: string
}

// ── Scope versioning ──────────────────────────────────────────────────────────

export interface ScopeVersion {
  version: number
  definition: string
  changedAt: number
  changedBy: string
  reason: string
}

// ── Enforcement flags ─────────────────────────────────────────────────────────

export interface EnforcementFlags {
  feesAllowed?: boolean
  extensionRequired?: boolean
  escalationTriggered?: boolean
  [key: string]: boolean | undefined
}

// ── Approval records ──────────────────────────────────────────────────────────

export type ApprovalDecision =
  | 'FULL_DISCLOSURE'
  | 'PARTIAL_DISCLOSURE'
  | 'FULL_DENIAL'
  | 'EXTENSION_GRANTED'
  | 'FEE_ASSESSED'
  | 'AWAITING_CLARIFICATION'

export interface ApprovalRecord {
  id: string
  timestamp: number
  actor: string
  decision: ApprovalDecision
  exemptionsCited: string[]  // M.G.L. c. 4, §7(26) exemption letters/names
  feeAmount?: number
  extensionDays?: number
  notes: string
  isLocked: true  // immutable once created
  lockedAt: number
}

// ── The CASE ──────────────────────────────────────────────────────────────────

export interface VaultCase {
  // Identity (immutable after creation)
  id: string
  caseNumber: string          // human-readable e.g. "PRR-2026-001"
  moduleId: string            // e.g. "VAULTPRR"
  envId: string               // parent VAULT environment casespace ID
  caseType: string            // module domain label
  createdAt: number
  createdBy: string           // email of staff who opened case

  // Subject (intake form responses — indexable without opening)
  subject: Record<string, string>

  // Scope (versioned)
  scopeDefinition: string
  scopeVersion: number
  scopeHistory: ScopeVersion[]

  // Deadlines
  deadlines: Record<string, CaseDeadline>
  tollingHistory: TollingEvent[]
  enforcementFlags: EnforcementFlags

  // Status
  currentStage: string
  transitionBlockers: string[]
  closureReason?: string
  closedAt?: number

  // Processing (stage-by-stage staff work — keyed by stage name)
  processing: Record<string, Record<string, string>>

  // Assets
  assets: CaseAsset[]

  // Audit log (append-only)
  auditLog: AuditEntry[]

  // Assignment
  assignedRAO: string

  // PuddleJumper integration (optional — best-effort sync)
  pjPrrId?: string            // PJ internal PRR id
  pjPrrPublicId?: string      // Public tracking token
  pjPrrTrackingUrl?: string   // Public tracking URL
  pjProvider?: string         // Cloud storage provider used ('github'|'microsoft'|'google')

  // Approvals
  approvals: ApprovalRecord[]

  // General notes
  notes: string
}

// ── Module settings ───────────────────────────────────────────────────────────

export interface RAOContact {
  id: string
  name: string
  email: string
  phone?: string
  title: string
  isPrimary: boolean
}

export interface EscalationContact {
  id: string
  name: string
  email: string
  title: string
  severity: 'critical' | 'high' | 'normal'
  triggerDaysBeforeDeadline: number
}

export interface TrainingLink {
  id: string
  title: string
  url: string
  description?: string
}

export type TeamMemberRole = 'viewer' | 'editor' | 'approver' | 'admin'

export interface TeamMember {
  id: string
  name: string
  email: string
  role: TeamMemberRole
  canSeeAllCases: boolean   // false = only cases assigned to them
  department?: string
}

export type NotificationProvider = 'microsoft' | 'google' | 'mailto'

export interface VaultModuleSettings {
  moduleId: string
  envId: string
  raos: RAOContact[]
  escalation: EscalationContact[]
  emailNotificationsEnabled: boolean
  notificationEmail: string
  notificationProvider?: NotificationProvider  // cloud email provider; falls back to mailto
  trainingLinks: TrainingLink[]
  publicFormUrl?: string
  updatedAt: number
  workflow?: WorkflowConfig
  team?: TeamMember[]
  // Municipality / environment info
  municipalityName?: string
  municipalityAddress?: string
  municipalityPhone?: string
  municipalityWebsite?: string
  accentColor?: string
  slaDaysOverride?: number      // overrides module default SLA if set
  retentionYears?: number       // overrides module default retention if set
}

// ── Workflow configuration ────────────────────────────────────────────────────

export type WorkflowTrigger =
  | 'INTAKE_RECEIVED'
  | 'STAGE_CHANGE'
  | 'T10_WARNING'
  | 'T10_MISSED'
  | 'T25_WARNING'
  | 'APPROVAL_ISSUED'
  | 'CASE_CLOSED'
  | 'CUSTOM_TIMER'

export type WorkflowRecipient = 'REQUESTER' | 'RAO' | 'SUPERVISOR' | 'CUSTOM'

export interface WorkflowEmailTemplate {
  id: string
  trigger: WorkflowTrigger
  triggerStage?: string        // for STAGE_CHANGE — which stage
  toRecipient: WorkflowRecipient
  customEmail?: string
  subject: string
  body: string                 // supports {{requesterName}} {{caseNumber}} {{town}} {{deadline}} {{raoName}} {{stage}}
  enabled: boolean
}

export interface WorkflowTimer {
  id: string
  name: string
  businessDays: number
  statutory: boolean           // true = non-negotiable, read-only in UI
  statutorycitation?: string   // e.g. "M.G.L. c. 66, §10"
  startEvent: 'CASE_CREATED' | 'STAGE_ENTERED'
  startStage?: string
  warningDaysBefore: number
  onMiss: ('WAIVE_FEES' | 'AUTO_ESCALATE' | 'SEND_EMAIL' | 'BLOCK_CLOSE')[]
}

export interface WorkflowConfig {
  timers: WorkflowTimer[]
  emailTemplates: WorkflowEmailTemplate[]
}

// ── Module definition (state machine + intake fields) ─────────────────────────

export interface ArchiveEntry {
  id: string
  caseId: string
  caseNumber: string
  timestamp: number
  provider: string
  filename: string
  success: boolean
  error?: string
}

export type FieldType = 'text' | 'email' | 'phone' | 'textarea' | 'select' | 'date' | 'number' | 'radio'

export interface FieldDef {
  key: string
  label: string
  type: FieldType
  required?: boolean
  placeholder?: string
  options?: string[]           // for select/radio
  hint?: string
}

export interface StageFieldDef {
  stage: string
  label: string
  fields: FieldDef[]
  requiredToAdvance?: string[]  // field keys that must be filled to proceed
  gateChecks?: string[]         // human-readable gate descriptions shown to staff
}

export interface ModuleDef {
  moduleId: string
  casePrefix: string            // e.g. "PRR" → "PRR-2026-001"
  intakeFields: FieldDef[]      // public-facing intake form
  stages: string[]
  stageFields: Record<string, StageFieldDef>  // keyed by stage name
  deadlineDefs: DeadlineDef[]
  closureReasons: string[]
  defaultRetentionYears: number
}
