/**
 * Canonical anchor object types for the LogicOS governance platform.
 *
 * Every captured artifact links to one or more of these anchors.
 * Anchors are the shared context that creates institutional memory —
 * connecting documents, meetings, people, decisions, and history.
 */

// ── Anchor object types ────────────────────────────────────────────────────

export type AnchorType =
  | 'matter'        // Case / file / project
  | 'meeting'       // Meeting / session / hearing
  | 'person'        // Resident / staff / vendor contact
  | 'parcel'        // Property / GIS / assessor record
  | 'vendor'        // Vendor / contractor / supplier
  | 'contract'      // Contract / agreement / MOU
  | 'project'       // Capital project / build spec / implementation
  | 'policy'        // Policy / bylaw / procedure / SOP
  | 'request'       // Resident request / complaint / service ticket
  | 'financial'     // Invoice / payment / budget line / AP record
  | 'decision'      // Formal decision / vote / approval
  | 'archive'       // Historical / legacy / import record

export interface AnchorRef {
  type: AnchorType
  id: string
  label: string          // Human-readable: "Main St. Project", "Invoice #4421"
  envId?: string         // CaseSpace / environment this lives in
}

// ── Source types (where the artifact came from) ────────────────────────────

export type SourceType =
  | 'email'
  | 'form'             // FormKey submission
  | 'upload'           // Manual file upload
  | 'scan'             // Physical document scanned
  | 'calendar'         // Calendar event / meeting import
  | 'drive'            // Google Drive / OneDrive sync
  | 'finance'          // ERP / AP system
  | 'permitting'       // Permit / work order system
  | 'gis'              // GIS / assessor / parcel data
  | 'api'              // External API / webhook
  | 'chat'             // Teams / Slack (where lawful)
  | 'voicemail'        // Voicemail / call log
  | 'website'          // Website submission / portal
  | 'manual'           // Entered directly in LogicOS

// ── Document classification ────────────────────────────────────────────────

export type DocClass =
  | 'invoice'
  | 'contract'
  | 'minutes'
  | 'agenda'
  | 'permit'
  | 'application'
  | 'correspondence'
  | 'policy'
  | 'report'
  | 'ordinance'
  | 'resolution'
  | 'notice'
  | 'procurement'
  | 'budget'
  | 'payroll'
  | 'request'
  | 'complaint'
  | 'deed'
  | 'map'
  | 'photo'
  | 'other'

// ── Intake item — the core unit after capture ──────────────────────────────

export type ConfidenceLevel = 'high' | 'medium' | 'low' | 'unclassified'
export type IntakeStatus = 'pending' | 'reviewing' | 'routed' | 'archived' | 'rejected'
export type RetentionClass = '1yr' | '3yr' | '5yr' | '7yr' | '10yr' | '25yr' | 'permanent'

export interface IntakeItem {
  id: string
  // What arrived
  title: string
  rawText?: string
  fileUrl?: string
  fileType?: string     // pdf, docx, jpg, msg, …
  fileSize?: number

  // When / who / where
  receivedAt: string    // ISO timestamp
  submitter?: string    // Name or email
  department?: string
  municipality?: string

  // Auto-structured metadata
  source: SourceType
  docClass: DocClass
  topic?: string
  confidence: ConfidenceLevel
  confidenceScore: number   // 0–100
  retentionClass?: RetentionClass

  // Status / routing
  status: IntakeStatus
  assignedTo?: string
  dueDate?: string
  notes?: string

  // Linked anchors
  anchors: AnchorRef[]

  // Audit
  extractedAt?: string
  reviewedBy?: string
  reviewedAt?: string
  routedAt?: string
}

// ── Rules engine condition / action types ─────────────────────────────────

export type RuleConditionField =
  | 'docClass'
  | 'source'
  | 'confidence'
  | 'department'
  | 'fileType'
  | 'topic'
  | 'amount'           // For invoices / financial
  | 'submitter'

export type RuleOperator = 'equals' | 'contains' | 'greaterThan' | 'lessThan' | 'isOneOf'

export interface RuleCondition {
  field: RuleConditionField
  operator: RuleOperator
  value: string | number | string[]
}

export type RuleActionType =
  | 'route_to_department'
  | 'assign_to_user'
  | 'link_to_anchor'
  | 'set_retention'
  | 'set_status'
  | 'trigger_synchron8'
  | 'flag_for_review'
  | 'archive_immediately'
  | 'notify'
  | 'require_approval'

export interface RuleAction {
  type: RuleActionType
  value: string           // department name, user ID, anchor ID, etc.
}

export interface IngestionRule {
  id: string
  name: string
  description?: string
  enabled: boolean
  priority: number        // Lower = runs first
  conditions: RuleCondition[]
  conditionLogic: 'all' | 'any'
  actions: RuleAction[]
  createdAt: string
  updatedAt: string
}

// ── Ingestion pipeline stats ───────────────────────────────────────────────

export interface IngestionStats {
  total: number
  pending: number
  highConfidence: number
  mediumConfidence: number
  lowConfidence: number
  routedToday: number
  avgConfidenceScore: number
}
