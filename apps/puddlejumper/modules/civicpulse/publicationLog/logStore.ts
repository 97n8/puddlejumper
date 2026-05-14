import { type PublicationEvent } from './vaulyInterface.js';

// Append-only in-memory log store. No deletions permitted (constraint: VAULY_APPEND_ONLY).
export class LogStore {
  private events: PublicationEvent[] = [];

  append(event: PublicationEvent): void {
    this.events.push({ ...event });
  }

  count(): number {
    return this.events.length;
  }

  getAll(): readonly PublicationEvent[] {
    return this.events;
  }

  getBySummary(summaryId: string): PublicationEvent[] {
    return this.events.filter(e => e.summaryId === summaryId);
  }
}
