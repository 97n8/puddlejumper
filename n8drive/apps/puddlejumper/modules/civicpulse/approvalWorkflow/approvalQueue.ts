import { type CivicSummary } from '../summaryEngine/summarySchema.js';

export interface ApprovalQueueItem {
  summary: CivicSummary;
  queuedAt: string;
  operatorId?: string;
}

export class ApprovalQueue {
  private items: ApprovalQueueItem[] = [];

  enqueue(summary: CivicSummary, operatorId?: string): void {
    this.items.push({ summary, queuedAt: new Date().toISOString(), operatorId });
  }

  dequeue(summaryId: string): ApprovalQueueItem | undefined {
    const idx = this.items.findIndex(i => i.summary.summaryId === summaryId);
    if (idx === -1) return undefined;
    return this.items.splice(idx, 1)[0];
  }

  list(): ApprovalQueueItem[] {
    return [...this.items];
  }

  count(): number {
    return this.items.length;
  }
}
