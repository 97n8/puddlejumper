import crypto from 'node:crypto';
import { archieveLog } from '../archieve/index.js';
import { ArchieveEventType } from '../archieve/event-catalog.js';

export async function handleSealMismatch(opts: {
  connectorId: string;
  version: string;
  tenantId: string;
  expectedHash: string;
  foundHash: string;
  keyId: string;
  invocationRequestId: string;
}): Promise<void> {
  const { connectorId, version, tenantId, expectedHash, foundHash, keyId, invocationRequestId } = opts;

  console.error(
    `[seal] CRITICAL SEAL_MISMATCH_VIOLATION: connectorId=${connectorId} version=${version} ` +
    `tenantId=${tenantId} expectedHash=${expectedHash} foundHash=${foundHash} keyId=${keyId} ` +
    `invocationRequestId=${invocationRequestId}`
  );

  try {
    archieveLog({
      requestId: invocationRequestId ?? crypto.randomUUID(),
      tenantId,
      module: 'seal',
      eventType: ArchieveEventType.SEAL_MISMATCH_VIOLATION,
      actor: { userId: 'system', role: 'system', sessionId: 'seal-mismatch-handler' },
      severity: 'critical',
      data: { connectorId, expectedHash, foundHash, keyId, version },
    });
  } catch (err) {
    console.warn('[seal] Failed to log SEAL_MISMATCH_VIOLATION to ARCHIEVE:', (err as Error).message);
  }
}
