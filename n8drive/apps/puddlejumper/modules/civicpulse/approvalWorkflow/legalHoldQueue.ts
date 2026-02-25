import { type CivicSummary } from '../summaryEngine/summarySchema.js';

export interface LegalHoldEntry {
  summary: CivicSummary;
  heldAt: string;
  clearedAt?: string;
  clearedBy?: string;
  notes?: string;
}

export class LegalHoldQueue {
  private entries: LegalHoldEntry[] = [];

  hold(summary: CivicSummary, notes?: string): void {
    this.entries.push({ summary, heldAt: new Date().toISOString(), notes });
  }

  clear(summaryId: string, clearedBy: string): LegalHoldEntry | undefined {
    const entry = this.entries.find(e => e.summary.summaryId === summaryId);
    if (!entry) return undefined;
    entry.clearedAt = new Date().toISOString();
    entry.clearedBy = clearedBy;
    return entry;
  }

  list(): LegalHoldEntry[] {
    return this.entries.filter(e => !e.clearedAt);
  }
}
