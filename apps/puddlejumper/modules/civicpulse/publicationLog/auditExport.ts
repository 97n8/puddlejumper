import { type LogStore } from './logStore.js';
import { type PublicationEvent } from './vaulyInterface.js';

export interface AuditExport {
  summaryId: string;
  totalEvents: number;
  exportedAt: string;
  events: PublicationEvent[];
}

export function exportBySummary(store: LogStore, summaryId: string): AuditExport {
  const events = store.getBySummary(summaryId);
  return {
    summaryId,
    totalEvents:  events.length,
    exportedAt:   new Date().toISOString(),
    events,
  };
}
