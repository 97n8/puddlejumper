export interface BackstopEntry {
  vaultRecordId: string;
  actionType: string;
  recordedAt: string;
  backstopWindowHours: number;
  deadlineAt: string;
  municipalityId: string;
  resolvedAt?: string;
}

export interface EscalationConfig {
  primaryContactId: string;
  escalationContactId: string;
  promptThresholdPercent: number;
}

export interface BackstopResult {
  overdue: BackstopEntry[];
  approaching: BackstopEntry[];
}

export function computeDeadline(recordedAt: string, backstopWindowHours: number): string {
  return new Date(
    new Date(recordedAt).getTime() + backstopWindowHours * 60 * 60 * 1000,
  ).toISOString();
}

export function isOverdue(entry: BackstopEntry, now: Date = new Date()): boolean {
  if (entry.resolvedAt) return false;
  return now > new Date(entry.deadlineAt);
}

export function isApproaching(entry: BackstopEntry, thresholdPercent: number, now: Date = new Date()): boolean {
  if (entry.resolvedAt) return false;
  if (now >= new Date(entry.deadlineAt)) return false; // overdue, not just approaching
  const start   = new Date(entry.recordedAt).getTime();
  const end     = new Date(entry.deadlineAt).getTime();
  const elapsed = now.getTime() - start;
  const total   = end - start;
  return total > 0 && (elapsed / total) * 100 >= thresholdPercent;
}

export function checkBackstop(
  entries: BackstopEntry[],
  config: EscalationConfig,
  now: Date = new Date(),
): BackstopResult {
  const overdue    = entries.filter(e => isOverdue(e, now));
  const overdueSet = new Set(overdue.map(e => e.vaultRecordId));
  const approaching = entries.filter(
    e => !overdueSet.has(e.vaultRecordId) && isApproaching(e, config.promptThresholdPercent, now),
  );
  return { overdue, approaching };
}
