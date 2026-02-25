import { type CivicSummary, type ApprovalStatus } from '../summaryEngine/summarySchema.js';
import { type ActionType } from '../core/actionTypes.js';

export interface RoutingConfig {
  autoReleaseTypes?: ActionType[];
  legalHoldTypes?: ActionType[];
  requireReviewForAiAssisted?: boolean;
}

export type RoutingTarget = 'auto_release' | 'staff_review' | 'legal_hold';

export interface RoutingDecision {
  target: RoutingTarget;
  reason: string;
}

export function routeSummary(
  summary: CivicSummary,
  config: RoutingConfig,
  legalHoldRequired: boolean,
): RoutingDecision {
  if (legalHoldRequired) {
    return { target: 'legal_hold', reason: 'Legal hold required for this action type' };
  }
  if (summary.aiAssisted && config.requireReviewForAiAssisted) {
    return { target: 'staff_review', reason: 'AI-assisted summaries require staff review' };
  }
  if (config.autoReleaseTypes?.includes(summary.actionType)) {
    return { target: 'auto_release', reason: 'Action type configured for auto-release' };
  }
  return { target: 'staff_review', reason: 'Default routing to staff review' };
}

const STATUS_MAP: Record<RoutingTarget, ApprovalStatus> = {
  auto_release: 'auto_released',
  staff_review: 'pending_review',
  legal_hold:   'legal_hold',
};

export function applyRoutingDecision(summary: CivicSummary, decision: RoutingDecision): CivicSummary {
  return { ...summary, approvalStatus: STATUS_MAP[decision.target] };
}
