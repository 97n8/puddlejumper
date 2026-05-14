import { getConsentRecord } from './store.js';

interface CacheEntry {
  result: { valid: boolean; reason?: string };
  cachedAt: number;
}

const consentCache = new Map<string, CacheEntry>();

const DEFAULT_TTL_MS = 60000;

function getCacheTtl(): number {
  const env = process.env.FORMKEY_CONSENT_CACHE_TTL_MS;
  if (env !== undefined) return parseInt(env, 10);
  return DEFAULT_TTL_MS;
}

export function verifyConsent(
  tenantId: string,
  submitterId: string,
  formId: string,
  consentVersion: string,
  cacheEnabled = true
): { valid: boolean; reason?: string } {
  const ttl = getCacheTtl();
  const cacheKey = `${tenantId}:${submitterId}:${formId}:${consentVersion}`;

  if (cacheEnabled && ttl > 0) {
    const entry = consentCache.get(cacheKey);
    if (entry && Date.now() - entry.cachedAt < ttl) {
      return entry.result;
    }
  }

  const record = getConsentRecord(tenantId, submitterId, formId, consentVersion);

  let result: { valid: boolean; reason?: string };

  if (!record) {
    result = { valid: false, reason: 'NO_CONSENT_RECORD' };
  } else if (record.withdrawn) {
    result = { valid: false, reason: 'CONSENT_WITHDRAWN' };
  } else if (record.expiresAt && new Date(record.expiresAt) < new Date()) {
    result = { valid: false, reason: 'CONSENT_EXPIRED' };
  } else if (record.consentVersion !== consentVersion) {
    result = { valid: false, reason: 'CONSENT_VERSION_MISMATCH' };
  } else {
    result = { valid: true };
  }

  if (cacheEnabled && ttl > 0) {
    consentCache.set(cacheKey, { result, cachedAt: Date.now() });
  }

  return result;
}
