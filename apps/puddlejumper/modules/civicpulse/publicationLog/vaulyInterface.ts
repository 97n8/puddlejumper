import { type CivicSummary } from '../summaryEngine/summarySchema.js';
import { type Seal } from '../integrity/sealValidator.js';

export interface PublicationEvent {
  summaryId: string;
  vaultRecordId: string;
  actionType: string;
  channel: string;
  sealHash: string;
  operatorId?: string;
  publishedAt: string;
}

export function buildPublicationEvent(
  summary: CivicSummary,
  seal: Seal,
  channel: string,
  operatorId?: string,
): PublicationEvent {
  return {
    summaryId:    summary.summaryId,
    vaultRecordId: summary.vaultRecordId,
    actionType:   summary.actionType,
    channel,
    sealHash:     seal.hash,
    operatorId,
    publishedAt:  new Date().toISOString(),
  };
}

// Production adapter interface — implement against the real Vauly API.
export interface VaulyAdapter {
  logPublication(event: PublicationEvent): Promise<void>;
  getPublicationLog(summaryId: string): Promise<PublicationEvent[]>;
}

// Mock adapter for tests and local development.
export class VaulyMockAdapter implements VaulyAdapter {
  private store = new Map<string, PublicationEvent[]>();

  async logPublication(event: PublicationEvent): Promise<void> {
    const events = this.store.get(event.summaryId) ?? [];
    events.push(event);
    this.store.set(event.summaryId, events);
  }

  async getPublicationLog(summaryId: string): Promise<PublicationEvent[]> {
    return this.store.get(summaryId) ?? [];
  }
}
