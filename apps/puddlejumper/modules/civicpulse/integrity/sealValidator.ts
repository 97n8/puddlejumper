import crypto from 'node:crypto';
import { type CivicSummary } from '../summaryEngine/summarySchema.js';

export interface Seal {
  hash: string;
  operatorId?: string;
  timestamp: string;
}

export interface SealValidationResult {
  valid: boolean;
  reason?: string;
}

// Canonical fields hashed for integrity — order is fixed to ensure determinism.
const SEAL_FIELDS: (keyof CivicSummary)[] = [
  'actionType', 'body', 'headline', 'summaryId', 'vaultRecordId', 'version',
];

export function canonicalize(summary: CivicSummary): string {
  const payload: Record<string, unknown> = {};
  for (const key of SEAL_FIELDS) {
    payload[key] = summary[key];
  }
  return JSON.stringify(payload);
}

export function generateHash(summary: CivicSummary): string {
  return crypto.createHash('sha256').update(canonicalize(summary)).digest('hex');
}

export function sealSummary(summary: CivicSummary, operatorId?: string): Seal {
  return {
    hash:       generateHash(summary),
    operatorId,
    timestamp:  new Date().toISOString(),
  };
}

export function validateSeal(summary: CivicSummary, seal: Seal): SealValidationResult {
  const current = generateHash(summary);
  if (current !== seal.hash) {
    return { valid: false, reason: 'Summary content has changed since sealing' };
  }
  return { valid: true };
}
