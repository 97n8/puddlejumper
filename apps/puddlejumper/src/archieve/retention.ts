// Retention floors (years) per regulatory profile
const RETENTION_FLOORS: Record<string, number> = {
  hipaa: 6,
  gdpr: 3,
  sox: 7,
  pci: 1,
  ferpa: 5,
  glba: 5,
  ccpa: 3,
  default: 1,
};

// Legal hold index: tenantId -> Set of recordIds (or '*' for tenant-wide hold)
const legalHolds = new Map<string, Set<string>>();

export function placeLegalHold(tenantId: string, recordId: string = '*'): void {
  if (!legalHolds.has(tenantId)) {
    legalHolds.set(tenantId, new Set());
  }
  legalHolds.get(tenantId)!.add(recordId);
}

export function releaseLegalHold(tenantId: string, recordId: string = '*'): void {
  legalHolds.get(tenantId)?.delete(recordId);
}

export function hasLegalHold(tenantId: string, recordId?: string): boolean {
  const holds = legalHolds.get(tenantId);
  if (!holds) return false;
  if (holds.has('*')) return true;
  if (recordId && holds.has(recordId)) return true;
  return false;
}

export function getRetentionFloorYears(profiles: string[]): number {
  let max = RETENTION_FLOORS['default'];
  for (const profile of profiles) {
    const floor = RETENTION_FLOORS[profile.toLowerCase()];
    if (floor !== undefined && floor > max) max = floor;
  }
  return max;
}
