import { type CivicSummary } from '../summaryEngine/summarySchema.js';

export interface WebsitePost {
  headline: string;
  body: string;
  vaultRecordLink: string;
  fundingLine?: string;
  actionType: string;
  publishedAt: string;
}

export interface SocialDraft {
  text: string;
  characterCount: number;
}

export function renderWebsitePost(summary: CivicSummary, vaultBaseUrl: string): WebsitePost {
  return {
    headline:         summary.headline,
    body:             summary.body,
    vaultRecordLink:  `${vaultBaseUrl.replace(/\/$/, '')}/records/${summary.vaultRecordId}`,
    fundingLine:      summary.fundingSource,
    actionType:       summary.actionType,
    publishedAt:      summary.publishedAt ?? new Date().toISOString(),
  };
}

export function renderSocialDraft(summary: CivicSummary, maxChars: number): SocialDraft {
  const full = `${summary.headline} — ${summary.body}`;
  const text = full.length > maxChars ? full.slice(0, maxChars) : full;
  return { text, characterCount: text.length };
}
