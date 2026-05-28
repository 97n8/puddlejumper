/**
 * PuddleJumper API types — shared across pjApi.ts and domain modules.
 * Do not import from pjApi.ts here (circular dep).
 */

// Vault types
// ARCHIEVE — Immutable Audit Log types
export interface ArchieveEvent {
  eventId: string; requestId: string; tenantId: string; module: string
  eventType: string; severity: 'info' | 'warn' | 'error' | 'critical'
  actor: { userId: string; role: string; sessionId: string; ip?: string }
  timestamp: string; chainPos: number; hash: string; prevHash: string
  data: Record<string, unknown>
}
export interface ArchieveChainSummary {
  head: string; totalEvents: number; lastNotarizedAt?: string; status: 'ok' | 'chain_violation'
}
export interface ArchieveVerifyResult {
  result: 'CHAIN_VALID' | 'CHAIN_VIOLATION'; eventsVerified?: number
  chainHead?: string; eventId?: string; chainPos?: number; reason?: string
}
export interface ArchieveNotarization {
  date: string; chainHead: string; rootHash: string; tsaToken: string; tsaUrl: string
}

export type VaultStatus = 'draft' | 'review' | 'approved' | 'archived'
export type VaultClassification = 'public' | 'internal' | 'confidential' | 'restricted'

export interface VaultRecord {
  id: string
  moduleId: string
  envId: string
  status: string
  daysRemaining?: number
  [key: string]: unknown
}

export interface Synchron8Step {
  type: string
  [key: string]: unknown
}

export interface Synchron8Trigger {
  type: string
  [key: string]: unknown
}

export interface Synchron8Automation {
  id: string
  name: string
  envId: string
  moduleId?: string
  trigger: Synchron8Trigger
  steps: Synchron8Step[]
  complianceProfile?: string
  enabled: boolean
  createdAt?: string
  updatedAt?: string
}

export interface Synchron8Run {
  runId: string
  automationId: string
  status: 'running' | 'success' | 'failed' | 'skipped'
  startedAt: string
  completedAt?: string
  steps?: Array<{ stepIndex: number; status: string; output?: unknown }>
}

export interface LogicDashDeadline {
  id: string
  recordId: string
  caseNumber?: string
  title: string
  description?: string
  moduleId: string
  moduleName?: string
  officer?: string
  daysRemaining: number
  dueDate: string
  urgency: 'overdue' | 'soon' | 'normal'
}

export interface LogicDashStats {
  openRecords: number
  overdueRecords: number
  dueThisWeek: number
  sealedThisMonth: number
  [key: string]: unknown
}

export interface ConnectorInfo {
  connected: boolean
  scopes?: string[]
  account?: string
  connectedAt?: string
}
export interface ConnectorStatusResponse {
  connectors: Record<string, ConnectorInfo>
}

// PJ Health — spec §8.1
export interface PJSubsystemHealth {
  status: 'ok' | 'degraded' | 'down'
  [key: string]: unknown
}
export interface PJHealthResponse {
  status: 'ok' | 'degraded' | 'down'
  timestamp: string
  version: string
  region: string
  uptime_seconds: number
  subsystems: Record<string, PJSubsystemHealth>
  alerts: string[]
}

export interface VaultDoc {
  id: string; name: string; page_size: string
  status: VaultStatus; classification: VaultClassification
  created_at: number; updated_at: number
}
export interface VaultDocFull extends VaultDoc { html: string; css: string }

export interface VaultEvent {
  id: string; user_id: string; user_name: string
  event_type: string; details: string; created_at: number
}
export interface VaultSignature {
  id: string; user_id: string; user_name: string
  comment: string; content_hash: string; created_at: number
}
export interface VaultVersion {
  id: string; version_num: number; saved_by: string; content_hash: string; created_at: number
}
export interface VaultFile { id: string; name: string; mime_type: string; size: number; created_at: number }
export interface VaultFileFull extends VaultFile { content_b64: string }

// ── Case Tasks (dual-sided workflow) ─────────────────────────────────────────
export interface CaseTask {
  id: string
  document_id: string
  tenant_id: string
  created_by: string
  assigned_side: 'A' | 'B'
  title: string
  description: string
  status: 'open' | 'done' | 'cancelled'
  source_event_id: string | null
  due_at: string | null
  completed_by: string | null
  completed_at: string | null
  created_at: string
  updated_at: string
}

// ── Discovery ────────────────────────────────────────────────────────────────
export interface DiscoveryObligation {
  title: string
  description: string
  required: boolean
}
export interface DiscoveryResult {
  queryId: string
  caseType: 'permit' | 'license' | 'compliance' | 'grant' | 'records' | 'general'
  suggestedTitle: string
  obligations: DiscoveryObligation[]
  jurisdiction: string
  confidence: number
  source: 'ai' | 'rules' | 'fallback'
  reasoning?: string
}
export interface DiscoveryRule {
  id: string
  tenant_id: string
  jurisdiction_id: string | null
  case_type: string
  title: string
  description: string
  keywords: string[]
  obligations: DiscoveryObligation[]
  created_at: string
}

// ── ARCHIEVE Rules ────────────────────────────────────────────────────────────
export interface ArchieveRule {
  id: string
  tenant_id: string
  rule_id: string
  title: string
  description: string
  jurisdiction: string
  category: 'permit' | 'license' | 'compliance' | 'zoning' | 'grant' | 'general'
  conditions: Array<{ field: string; operator: string; value: unknown }>
  actions: Array<{ type: string; object: string; dueDays?: number }>
  version: number
  status: 'draft' | 'pending' | 'active' | 'archived'
  source: 'manual' | 'ai' | 'imported'
  ai_confidence: number | null
  created_by: string
  archieve_event_id: string | null
  approved_by: string | null
  approved_at: string | null
  rejection_reason: string | null
  created_at: string
  updated_at: string
}

export interface RuleRecommendation {
  suggestedRuleId: string
  title: string
  description: string
  caseType: string
  frequency: number
  avgConfidence: number
  lastSeen: string
  category: ArchieveRule['category']
}

// ── Task Queue (Layer 8 — User Guidance Surface) ──────────────────────────────
export interface TaskItem {
  id: string
  domain: string
  priority: 'critical' | 'high' | 'medium' | 'low'
  title: string
  detail: string
  dueBy?: string
  actionUrl?: string
  affectedObjectType?: string
  affectedObjectId?: string
  source: 'watch_alert' | 'approval' | 'pending_rule' | 'expiring_license'
  createdAt: string
}

// ── FormKey Normalize (Layer 3/4 — AI-Assisted Intake) ───────────────────────
export interface NormalizeResult {
  matched: boolean
  formId?: string
  formTitle?: string
  confidence: number
  prefill: Record<string, string | number | boolean>
  mode: 'ai' | 'keyword' | 'none'
  reason?: string
}

// ── Tenant Registry ───────────────────────────────────────────────────────────
export interface TenantRecord {
  id: string
  slug: string
  name: string
  jurisdiction_type: 'municipality' | 'county' | 'state' | 'utility' | 'nonprofit'
  jurisdiction_id: string | null
  state: string | null
  contact_email: string | null
  status: 'active' | 'suspended' | 'trial'
  plan: 'trial' | 'standard' | 'enterprise'
  provisioned_by: string
  seal_provisioned: number
  created_at: string
  updated_at: string
}

// ── Health Metrics ────────────────────────────────────────────────────────────
export interface HealthMetrics {
  uptime: number
  memory: { rss: number; heapUsed: number; heapTotal: number; external: number }
  dbBackend: 'sqlite' | 'postgres'
  dbSizeBytes: number | null
  archieve: { chainLength: number; queueDepth: number }
  tenants: { total: number; active: number }
  documents: { total: number; byStatus: Record<string, number> }
  requests: { last1h: number }
  seal: { keyCount: number }
  timestamp: string
}

export interface CloudSaveBatchItem {
  provider: 'google' | 'microsoft' | 'github'
  filename: string
  contentBase64: string
  mimeType?: string
  targetMimeType?: string  // Google: convert-to format (e.g. application/vnd.google-apps.document)
  folderId?: string
  driveId?: string
  conflictBehavior?: 'rename' | 'replace' | 'fail'  // OneDrive conflict handling
  githubRepo?: string
  githubPath?: string
  githubMessage?: string
}
export interface CloudSaveBatchResult {
  filename: string
  path?: string
  success: boolean
  fileId?: string
  url?: string
  error?: string
}
export interface ImportRepoRequest {
  owner: string
  repo: string
  branch?: string
  paths?: string[]
  targetProvider: 'google' | 'microsoft' | 'github'
  targetFolderId?: string
  targetDriveId?: string
  targetRepo?: string
  targetBasePath?: string
  commitMessage?: string
}
export interface ImportRepoResult {
  manifest: Array<{ path: string; filename: string; success: boolean; url?: string; error?: string }>
  total: number
  succeeded: number
  failed: number
  skipped: number
}


// FormKey types
export type FKStatus = 'draft' | 'published' | 'deprecated' | 'suspended_mismatch'
export type FKLegalBasis = 'legal_obligation' | 'public_task' | 'consent' | 'contract'
export type FKFieldType = 'text' | 'textarea' | 'number' | 'date' | 'select' | 'multiselect' | 'checkbox' | 'file' | 'signature' | 'consent_checkbox'

export interface FKFormField {
  id: string
  label: string
  type: FKFieldType
  required: boolean
  order: number
  validation?: { minLength?: number; maxLength?: number; pattern?: string; min?: number; max?: number; allowedValues?: string[]; fileTypes?: string[]; maxFileSizeMb?: number }
  pii: boolean
  sensitive: boolean
  dlpExempt: boolean
  consentCovered: boolean
  showIf?: { fieldId: string; operator: 'equals' | 'not_equals' | 'contains'; value: string }
  outputPlaceholder?: string
}

export interface FKFormDefinition {
  id: string
  formId: string
  tenantId: string
  version: string
  name: string
  description: string
  status: FKStatus
  purpose?: string
  legalBasis?: FKLegalBasis
  retentionTier?: string
  dataTypes?: string[]
  sensitivity?: string
  consentConfig?: { required: boolean; consentText: string; consentVersion: string; expiryDays?: number; withdrawable: boolean }
  fields: FKFormField[]
  vaultMapping?: {
    recordType: string
    namespace: string
    fieldMap: Record<string, string>
    slaHours?: number
    requiresApproval?: boolean
    approvalRole?: string
    recurrence?: 'once' | 'annual' | 'quarterly' | 'monthly'
  }
  outputConfig?: { templateId: string; fieldBindings: Record<string, string>; includeConsentStamp: boolean; includeSealToken: boolean; includeRetentionTier: boolean; pageSize: string; orientation: string }
  sealToken?: unknown
  createdAt: string
  publishedAt?: string
  deprecatedAt?: string
}

export type FKIntakeStatus = 'received' | 'under_review' | 'responded' | 'closed'

export interface FKIntakeRecord {
  id: string
  tenantId: string
  formId: string
  formVersion: string
  recordType: string
  namespace: string
  governance: {
    purpose: string
    legalBasis: string
    retentionTier: string
    sensitivity: string
    dataTypes: string[]
    formId: string
    formVersion: string
    consentVersion?: string
    submittedAt: string
    intakeSealToken: unknown
    consentStampId?: string
  }
  fields: Record<string, unknown>
  createdAt: string
  status?: FKIntakeStatus
  slaDueAt?: string | null
  reviewId?: string | null
}

export interface FKReview {
  id: string
  tenantId: string
  recordId: string
  formId: string
  requiredRole: string | null
  status: 'pending' | 'approved' | 'rejected'
  submittedBy: string | null
  reviewedBy: string | null
  reviewedAt: string | null
  reviewNote: string | null
  createdAt: string
  intakeStatus?: FKIntakeStatus
  sla_due_at?: string | null
}

export interface FKConsentRecord {
  id: string
  tenantId: string
  submitterId: string
  formId: string
  consentVersion: string
  consentTextHash: string
  grantedAt: string
  expiresAt?: string
  withdrawn: boolean
  withdrawnAt?: string
}

export interface LBConnector {
  id: string
  name: string
  connectorId: string
  version: string
  status: 'draft' | 'validated' | 'simulated' | 'published' | 'deprecated' | 'suspended_mismatch'
  capabilities: string[]
  dataTypes: string[]
  allowedProfiles: string[]
  samplePayload: string
  simResult?: LBSimResult
  residencyAttestation?: string
  metadata?: { description?: string; author?: string; tags?: string[]; baseUrl?: string }
  createdAt: string
  updatedAt: string
  supersededBy?: string
}

export interface LBSimResult {
  passed: boolean
  runAt: string
  handlerExitStatus: 'ok' | 'error' | 'timeout'
  dlpFindings: { field: string; type: string; severity: 'block' | 'warn' | 'info' }[]
  dlpActionRequired: boolean
  capabilityAnalysisSummary: string
  undeclaredCapabilities: string[]
  governanceGaps: { type: string; severity: 'blocking' | 'warning'; message: string }[]
  residencyVerified: boolean
}

export interface DemoMemberTemplate {
  id: string
  label: string
  description: string
  name: string
  username: string
  email: string
  role: 'admin' | 'member' | 'viewer'
  toolAccess: string[] | null
  mustChangePassword: boolean
}


