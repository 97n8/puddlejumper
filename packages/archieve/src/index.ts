/**
 * ARCHIEVE — Retention Enforcement
 * 
 * Records retention as a runtime constraint.
 * Policies define what must be kept, for how long, and under what authority.
 * ARCHIEVE enforces them — you can't accidentally delete a governed record.
 * 
 * Slot: drop existing ARCHIEVE logic here.
 * 
 * // GPR
 */

export interface RetentionPolicy {
  id: string;
  tenantId: string;
  name: string;
  recordType: string;
  retentionYears: number;
  authority: string; // statutory or policy basis
  enforced: boolean;
}

export interface RetentionHold {
  id: string;
  policyId: string;
  recordId: string;
  expiresAt: string;
  reason: string;
}
