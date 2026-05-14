import crypto from 'node:crypto';
import type Database from 'better-sqlite3';
import { SealError, SEAL_ESK_NOT_FOUND } from './types.js';
import { getPublicKeyRecord, listKeysForTenant, rotateKey as rotateKeyStore } from './key-store.js';
import { archieveLog } from '../archieve/index.js';
import { ArchieveEventType } from '../archieve/event-catalog.js';

export function provisionTenantESK(tenantId: string, db: Database.Database): {
  keyId: string;
  publicKeyPem: string;
  privateKeyPem: string;
  warning: string;
} {
  if (!tenantId || typeof tenantId !== 'string' || !/^[a-zA-Z0-9_-]+$/.test(tenantId)) {
    throw new SealError(SEAL_ESK_NOT_FOUND, `Invalid tenantId: ${tenantId}`);
  }

  // Use rotateKey which handles versioning, DB insert, and cache update
  const { newKeyId, publicKeyPem, privateKeyPem } = rotateKeyStore(tenantId, db);

  const warning = `Store this private key in SEAL_ESK_${tenantId.toUpperCase()} env var. It will not be saved.`;

  try {
    archieveLog({
      requestId: crypto.randomUUID(),
      tenantId,
      module: 'seal',
      eventType: ArchieveEventType.SEAL_KEY_ROTATED,
      actor: { userId: 'system', role: 'system', sessionId: 'seal-provision' },
      severity: 'info',
      data: { previousKeyId: null, newKeyId },
    });
  } catch (err) {
    console.warn('[seal] Failed to log provisioning to ARCHIEVE:', (err as Error).message);
  }

  return { keyId: newKeyId, publicKeyPem, privateKeyPem, warning };
}
