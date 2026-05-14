import crypto from 'node:crypto';
import {
  type SealToken,
  type VerificationResult,
  SealError,
  SEAL_ESK_NOT_FOUND,
  SEAL_SIGNING_FAILED,
  SEAL_INVALID_ARTIFACT,
} from './types.js';
import { getActiveESKForTenant } from './key-store.js';
import { requestTsaTimestamp } from './tsa-client.js';
import { jcsSerialize } from '../archieve/chain.js';
import { archieveLog } from '../archieve/index.js';
import { ArchieveEventType } from '../archieve/event-catalog.js';

export async function sign(
  artifact: Buffer,
  opts?: {
    tenantId?: string;
    requestTimestamp?: boolean;
    handlerHash?: string;
    intakeFields?: string[];
    callerModule?: string;
    callerContext?: string;
  }
): Promise<SealToken> {
  const callerModule = opts?.callerModule ?? 'seal';
  const callerContext = opts?.callerContext ?? 'seal-internal';
  const tenantId = opts?.tenantId ?? 'default';

  try {
    // 1. Validate artifact
    if (!artifact || !Buffer.isBuffer(artifact) || artifact.length === 0) {
      throw new SealError(SEAL_INVALID_ARTIFACT, 'Artifact must be a non-empty Buffer');
    }

    // 2. Look up active ESK
    const esk = getActiveESKForTenant(tenantId);
    if (!esk) {
      throw new SealError(SEAL_ESK_NOT_FOUND, `No active ESK found for tenant '${tenantId}'`);
    }

    // 3. Compute SHA-256 of artifact
    const artifactHash = crypto.createHash('sha256').update(artifact).digest('hex');

    // 4. Sign: create temp buffer for private key, zero it after use
    const pkBuf = Buffer.from(esk.privateKeyPem, 'utf8');
    let signature: string;
    try {
      const signer = crypto.createSign('SHA256');
      signer.update(artifact);
      signature = signer.sign(pkBuf.toString('utf8'), 'base64url');
    } finally {
      pkBuf.fill(0);
    }

    const signedAt = new Date().toISOString();

    // 5. Optional TSA timestamp
    let tsaToken: string | undefined;
    let tsaUrl: string | undefined;
    if (opts?.requestTimestamp) {
      const tsa = await requestTsaTimestamp(artifactHash);
      tsaToken = tsa.tsaToken;
      tsaUrl = tsa.tsaUrl;
    }

    // 6. Assemble SealToken
    const token: SealToken = {
      artifactHash,
      signature,
      algorithm: 'ECDSA-P256',
      keyId: esk.keyId,
      tenantId,
      signedAt,
      ...(tsaToken !== undefined ? { tsaToken, tsaUrl } : {}),
      ...(opts?.handlerHash !== undefined ? { handlerHash: opts.handlerHash } : {}),
      ...(opts?.intakeFields !== undefined ? { intakeFields: opts.intakeFields } : {}),
    };

    // 7. Log SEAL_SIGNING_COMPLETED to ARCHIEVE
    try {
      archieveLog({
        requestId: crypto.randomUUID(),
        tenantId,
        module: 'seal',
        eventType: ArchieveEventType.SEAL_SIGNING_COMPLETED,
        actor: { userId: 'system', role: 'system', sessionId: callerContext },
        severity: 'info',
        data: { artifactHash, keyId: esk.keyId, callerModule },
      });
    } catch (err) {
      console.warn('[seal] Failed to log SEAL_SIGNING_COMPLETED:', (err as Error).message);
    }

    return token;
  } catch (err) {
    // Log SEAL_SIGNING_FAILED
    try {
      archieveLog({
        requestId: crypto.randomUUID(),
        tenantId,
        module: 'seal',
        eventType: ArchieveEventType.SEAL_SIGNING_FAILED,
        actor: { userId: 'system', role: 'system', sessionId: callerContext },
        severity: 'error',
        data: { failureReason: (err as Error).message, callerModule },
      });
    } catch (logErr) {
      console.warn('[seal] Failed to log SEAL_SIGNING_FAILED:', (logErr as Error).message);
    }

    if (err instanceof SealError) throw err;
    throw new SealError(SEAL_SIGNING_FAILED, (err as Error).message);
  }
}

export async function signManifest(
  manifest: object,
  opts?: {
    tenantId?: string;
    requestTimestamp?: boolean;
    handlerHash?: string;
    intakeFields?: string[];
    callerModule?: string;
    callerContext?: string;
  }
): Promise<{ token: SealToken; canonicalBytes: Buffer }> {
  const canonical = jcsSerialize(manifest);
  const canonicalBytes = Buffer.from(canonical, 'utf8');
  const token = await sign(canonicalBytes, opts);

  try {
    archieveLog({
      requestId: crypto.randomUUID(),
      tenantId: opts?.tenantId ?? 'default',
      module: 'seal',
      eventType: ArchieveEventType.SEAL_MANIFEST_SIGNED,
      actor: { userId: 'system', role: 'system', sessionId: opts?.callerContext ?? 'seal-internal' },
      severity: 'info',
      data: { manifestHash: token.artifactHash, keyId: token.keyId },
    });
  } catch (err) {
    console.warn('[seal] Failed to log SEAL_MANIFEST_SIGNED:', (err as Error).message);
  }

  return { token, canonicalBytes };
}
