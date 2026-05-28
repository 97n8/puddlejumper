// ── CGM Types — Capital & Grant Management ────────────────────────────────────
// LOGICOS-CGM-01 · Part 4 Addendum to Master Build Spec v3.0
// Governing law: MGL c.44 · MGL c.30B · 2 CFR Part 200 · ARPA Final Rule

export type CgmCaseClassification =
  | 'capital_municipal'
  | 'capital_state_aided'
  | 'grant_federal'
  | 'grant_state'
  | 'grant_private'
  | 'hybrid'
  | 'ppp'

export type CgmCaseStatus =
  | 'setup'       // Not yet activated — funding + budget not fully loaded
  | 'active'      // Finance Authority approved; Watch Layer monitoring
  | 'compliance'  // Active; at least one obligation overdue
  | 'closed'      // Finance Authority certified closeout

export type FundingSourceType =
  | 'grant_federal'
  | 'grant_state'
  | 'grant_private'
  | 'capital_municipal'
  | 'capital_bond'
  | 'capital_state_aided'
  | 'ppp'
  | 'emergency'

export type ObligationType = 'report' | 'audit' | 'compliance' | 'legal' | 'other'

export type DisbursementStatus =
  | 'draft'
  | 'pending_project_owner'
  | 'pending_finance'
  | 'approved'
  | 'rejected'

// ── Core objects ──────────────────────────────────────────────────────────────

export interface CgmCase {
  id: string
  name: string
  classification: CgmCaseClassification
  status: CgmCaseStatus
  projectOwnerId: string | null
  financeAuthorityId: string | null
  grantManagerId?: string | null
  createdAt: string
  activatedAt?: string | null
  closedAt?: string | null
  sealHash?: string | null
  fundingSources?: FundingSource[]
  budget?: CgmBudget | null
  obligations?: Obligation[]
  openDisbursements?: number
  watchAlerts?: WatchAlert[]
}

export interface FundingSource {
  id: string
  caseId: string
  type: FundingSourceType
  label: string
  amount: number
  restrictionsFlag: boolean
  periodStart?: string | null
  periodEnd?: string | null
  reportingObligations: string[]
  remainingBalance?: number
}

export interface BudgetLineItem {
  category: string
  appropriated: number
  expended: number
  encumbered: number
  remaining: number
}

export interface CgmBudget {
  id: string
  caseId: string
  lineItems: BudgetLineItem[]
  approvedBy: string | null
  approvedAt: string | null
  sealHash?: string | null
}

export interface Disbursement {
  id: string
  caseId: string
  fundingSourceId: string
  budgetLineItemCategory: string
  amount: number
  purpose: string
  requestorId: string
  status: DisbursementStatus
  projectOwnerApproval?: string | null
  projectOwnerApprovedAt?: string | null
  financeAuthorityApproval?: string | null
  financeAuthorityApprovedAt?: string | null
  sealHash?: string | null
  createdAt: string
}

export interface Obligation {
  id: string
  caseId: string
  fundingSourceId: string
  type: ObligationType
  label: string
  dueDate: string
  status: 'open' | 'complete' | 'overdue' | 'waived'
  completedAt?: string | null
  proofDocumentId?: string | null
}

export interface WatchAlert {
  severity: 'critical' | 'high' | 'warning' | 'info'
  message: string
  triggeredAt: string
}

// ── Form state for new-case dialog ────────────────────────────────────────────

export interface NewCgmCaseForm {
  name: string
  classification: CgmCaseClassification
  description: string
}

// ── Display helpers ───────────────────────────────────────────────────────────

export const CLASSIFICATION_LABELS: Record<CgmCaseClassification, string> = {
  capital_municipal:  'Capital Project — Municipal',
  capital_state_aided:'Capital Project — State-Aided',
  grant_federal:      'Grant — Federal',
  grant_state:        'Grant — State',
  grant_private:      'Grant — Private / Foundation',
  hybrid:             'Hybrid',
  ppp:                'Public-Private Partnership',
}

export const STATUS_LABELS: Record<CgmCaseStatus, string> = {
  setup:      'Setup',
  active:     'Active',
  compliance: 'Compliance Alert',
  closed:     'Closed',
}

export const FUNDING_TYPE_LABELS: Record<FundingSourceType, string> = {
  grant_federal:      'Grant — Federal',
  grant_state:        'Grant — State',
  grant_private:      'Grant — Private',
  capital_municipal:  'Capital — Municipal',
  capital_bond:       'Capital — Bond',
  capital_state_aided:'Capital — State-Aided',
  ppp:                'Public-Private Partnership',
  emergency:          'Emergency Funding',
}
