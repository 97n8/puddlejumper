// CivicPulse — Shared TypeScript types
// LogicOS frontend type definitions for the CivicPulse transparency engine.

export type ActionType =
  | 'board_vote'
  | 'contract_award'
  | 'budget_transfer'
  | 'public_hearing'
  | 'capital_milestone'
  | 'debt_issuance'
  | 'emergency_declaration'
  | 'policy_adoption'
  | 'procurement_action'
  | 'zba_filing'

export type PublicationDetermination =
  | 'required'
  | 'recommended'
  | 'none'

export type ApprovalStatus =
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'legal_hold'
  | 'published'

export type OutputChannel =
  | 'website_post'
  | 'activity_feed'
  | 'weekly_digest'
  | 'email_summary'
  | 'social_draft'
  | 'quarterly_report'

export interface CivicSummary {
  id: string
  vaultRecordId: string
  actionType: ActionType
  actionDate: string
  governingBody: string
  department?: string
  summaryText: string
  voteOutcome?: string
  dollarAmount?: number
  fundingSource?: string
  timeline?: string
  determination: PublicationDetermination
  status: ApprovalStatus
  sealHash?: string
  legalHold: boolean
  createdAt: string
  updatedAt: string
  publishedAt?: string
  publishedChannels?: OutputChannel[]
  operatorId?: string
}

export interface ComplianceBackstop {
  id: string
  vaultRecordId: string
  actionType: ActionType
  actionDate: string
  determination: PublicationDetermination
  windowHours: number
  windowExpiresAt: string
  escalated: boolean
  escalatedAt?: string
  resolved: boolean
}

export interface PublicationLogEntry {
  id: string
  summaryId: string
  channel: OutputChannel
  publishedAt: string
  operatorId?: string
  sealHashRef: string
  version: number
  correctionOf?: string
}

export interface ChannelConfig {
  channel: OutputChannel
  enabled: boolean
  approvalBehavior: 'auto_release' | 'staff_review'
  recipientList?: string[]
}

export interface MunicipalityConfig {
  municipalityId: string
  name: string
  channels: ChannelConfig[]
  backstopIntervals: Partial<Record<ActionType, number>>
  escalationContacts: string[]
  archieveVersion: string
  civicPulseActive: boolean
}

export interface FeedEntry {
  id: string
  summaryId: string
  actionType: ActionType
  actionDate: string
  governingBody: string
  headline: string
  summaryText: string
  vaultRecordUrl?: string
  publishedAt: string
  channels: OutputChannel[]
}

export interface FeedFilters {
  actionTypes: ActionType[]
  departments: string[]
  dateFrom?: string
  dateTo?: string
  searchQuery: string
}

export interface CivicQueueItem {
  id: string
  caseId: string
  caseNumber: string
  moduleId: string
  envId: string
  envName: string
  town: string
  summary: string
  status: 'pending' | 'approved' | 'rejected'
  submittedAt: number
}
