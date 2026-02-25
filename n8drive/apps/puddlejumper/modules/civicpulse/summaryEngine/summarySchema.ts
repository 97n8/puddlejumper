import { type ActionType } from '../core/actionTypes.js';

export type ApprovalStatus =
  | 'pending_review'
  | 'auto_released'
  | 'approved'
  | 'legal_hold'
  | 'held_seal_mismatch'
  | 'rejected';

export interface CivicSummary {
  summaryId: string;
  vaultRecordId: string;
  actionType: ActionType;
  headline: string;
  body: string;
  approvalStatus: ApprovalStatus;
  version: number;
  municipalityId: string;
  fundingSource?: string;
  generatedAt: string;
  publishedAt?: string;
}
