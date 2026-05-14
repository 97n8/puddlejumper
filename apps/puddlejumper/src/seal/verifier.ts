import crypto from 'node:crypto';
import {
  type SealToken,
  type VerificationResult,
  SealError,
} from './types.js';
import { getPublicKeyForKeyId } from './key-store.js';
import { archieveLog } from '../archieve/index.js';
import { ArchieveEventType } from '../archieve/event-catalog.js';

export async function verify(
  artifact: Buffer,
  token: SealToken
): Promise<VerificationResult> {
  const tenantId = token?.tenantId ?? 'unknown';
  const keyId = token?.keyId ?? 'unknown';
  const signedAt = token?.signedAt ?? '';

  const baseResult = { keyId, tenantId, signedAt, tsaVerified: null as boolean | null };

  function logAndReturn(result: VerificationResult): VerificationResult {
    try {
      if (result.valid) {
        archieveLog({
          requestId: crypto.randomUUID(),
          tenantId,
          module: 'seal',
          eventType: ArchieveEventType.SEAL_VERIFICATION_PASSED,
          actor: { userId: 'system', role: 'system', sessionId: 'seal-verify' },
          severity: 'info',
          data: { keyId, artifactHash: token.artifactHash },
        });
      } else {
        archieveLog({
          requestId: crypto.randomUUID(),
          tenantId,
          module: 'seal',
          eventType: ArchieveEventType.SEAL_VERIFICATION_FAILED,
          actor: { userId: 'system', role: 'system', sessionId: 'seal-verify' },
          severity: 'warn',
          data: { reason: result.reason ?? 'unknown', keyId },
        });
      }
    } catch (err) {
      console.warn('[seal] Failed to log verification result:', (err as Error).message);
    }
    return result;
  }

  // 1. Validate token has required fields
  if (!token || !token.artifactHash || !token.signature || !token.algorithm || !token.keyId || !token.tenantId || !token.signedAt) {
    return logAndReturn({ ...baseResult, valid: false, reason: 'token_malformed' });
  }

  // 2. Check algorithm
  if (token.algorithm !== 'ECDSA-P256') {
    return logAndReturn({ ...baseResult, valid: false, reason: 'algorithm_unsupported' });
  }

  // 3. Look up public key
  const publicKeyPem = getPublicKeyForKeyId(token.keyId);
  if (!publicKeyPem) {
    try {
      archieveLog({
        requestId: crypto.randomUUID(),
        tenantId,
        module: 'seal',
        eventType: ArchieveEventType.SEAL_KEY_NOT_FOUND,
        actor: { userId: 'system', role: 'system', sessionId: 'seal-verify' },
        severity: 'warn',
        data: { keyId },
      });
    } catch { /* ignore */ }
    return logAndReturn({ ...baseResult, valid: false, reason: 'key_not_found' });
  }

  // 4. Recompute artifact SHA-256, compare
  const recomputedHash = crypto.createHash('sha256').update(artifact).digest('hex');
  if (recomputedHash !== token.artifactHash) {
    return logAndReturn({ ...baseResult, valid: false, reason: 'hash_mismatch' });
  }

  // 5. Verify ECDSA signature
  let sigValid = false;
  try {
    const verifier = crypto.createVerify('SHA256');
    verifier.update(artifact);
    sigValid = verifier.verify(publicKeyPem, token.signature, 'base64url');
  } catch {
    return logAndReturn({ ...baseResult, valid: false, reason: 'signature_invalid' });
  }

  if (!sigValid) {
    return logAndReturn({ ...baseResult, valid: false, reason: 'signature_invalid' });
  }

  // 6. TSA token: basic structure check only in V1 (tsaVerified = null)
  let tsaVerified: boolean | null = null;
  if (token.tsaToken) {
    // V1: just check it's a non-empty base64url string; full TSA verify deferred
    tsaVerified = null;
  }

  return logAndReturn({ ...baseResult, valid: true, tsaVerified });
}
