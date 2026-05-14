import { type CivicSummary } from '../summaryEngine/summarySchema.js';

// Produces a new version of a summary with incremented version number.
// Original summary is retained in the audit log — corrections never delete.
export function incrementVersion(summary: CivicSummary, corrections: Partial<Pick<CivicSummary, 'headline' | 'body'>>): CivicSummary {
  return {
    ...summary,
    ...corrections,
    version:        summary.version + 1,
    approvalStatus: 'pending_review',
    publishedAt:    undefined,
  };
}
