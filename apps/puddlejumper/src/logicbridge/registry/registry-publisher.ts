import crypto from 'node:crypto';
import { getDefinitionById, updateDefinition, listAllPublished } from './definition-store.js';
import { decryptHandler } from '../handler/encryptor.js';
import { verifyHandlerHash } from '../handler/hasher.js';
import type { ConnectorDefinition, ConnectorRegistryEntry, SealToken } from '../types.js';
import { log as archieveLog } from '../../archieve/logger.js';

// In-memory connector registry: tenantId → connectorId → entry
const registry = new Map<string, Map<string, ConnectorRegistryEntry>>();

export function getRegistry(): Map<string, Map<string, ConnectorRegistryEntry>> {
  return registry;
}

export function getRegistryEntry(tenantId: string, connectorId: string): ConnectorRegistryEntry | null {
  return registry.get(tenantId)?.get(connectorId) ?? null;
}

export function countRegistered(): number {
  let n = 0;
  for (const m of registry.values()) n += m.size;
  return n;
}

export function countSuspended(): number {
  let n = 0;
  for (const m of registry.values()) {
    for (const e of m.values()) {
      if (e.status === 'suspended_mismatch') n++;
    }
  }
  return n;
}

export function registerEntry(def: ConnectorDefinition): void {
  if (!def.sealToken) return;

  const entry: ConnectorRegistryEntry = {
    connectorId: def.id,
    displayName: def.name,
    version: def.version,
    provider: 'logicbridge',
    tenantId: def.tenantId,
    status: def.status === 'published' ? 'active'
      : def.status === 'deprecated' ? 'deprecated'
      : 'suspended_mismatch',
    capabilities: def.capabilities,
    dataTypes: def.dataTypes,
    allowedProfiles: def.allowedProfiles,
    handlerHash: def.handlerHash ?? '',
    sealToken: def.sealToken,
    sourceDefinitionId: def.id,
    publishedAt: def.updatedAt,
    registeredAt: new Date().toISOString(),
  };

  if (!registry.has(def.tenantId)) {
    registry.set(def.tenantId, new Map());
  }
  registry.get(def.tenantId)!.set(def.id, entry);
}

export async function publishConnector(
  connectorId: string,
  publishedBy: string
): Promise<{ success: boolean; error?: string; definition?: ConnectorDefinition }> {
  const def = getDefinitionById(connectorId);
  if (!def) return { success: false, error: 'Connector not found' };
  if (def.status !== 'simulated') return { success: false, error: 'Connector must be in simulated status to publish' };
  if (!def.simResult?.passed) return { success: false, error: 'Simulation must have passed before publishing' };
  if (!def.handlerEncrypted) return { success: false, error: 'No handler code found' };

  // Step 2: handler hash verification
  let handlerSource: string;
  try {
    handlerSource = decryptHandler(def.handlerEncrypted);
  } catch (err) {
    return { success: false, error: `Handler decrypt failed: ${(err as Error).message}` };
  }

  if (def.handlerHash && !verifyHandlerHash(handlerSource, def.handlerHash)) {
    return { success: false, error: 'Handler integrity failure — hash mismatch' };
  }

  // Step 3: create a SEAL-equivalent token (V1 — real SEAL integration is full pipeline)
  const sealToken: SealToken = {
    signature: crypto.createHash('sha256')
      .update(JSON.stringify({ id: def.id, handlerHash: def.handlerHash, tenantId: def.tenantId }))
      .digest('hex'),
    keyId: `lb-v1-${def.tenantId}`,
    signedAt: new Date().toISOString(),
    handlerHash: def.handlerHash ?? '',
    callerModule: 'logicbridge',
    callerContext: `${def.id}@${def.version}`,
  };

  // Step 4: mark published in DB
  const updated = updateDefinition(connectorId, {
    status: 'published',
    sealToken,
  });
  if (!updated) return { success: false, error: 'DB update failed' };

  // Step 5: register in memory
  registerEntry(updated);

  // Step 6: ARCHIEVE log
  try {
    archieveLog({
      requestId: crypto.randomUUID(),
      tenantId: def.tenantId,
      module: 'LOGICBRIDGE',
      eventType: 'LOGICBRIDGE_CONNECTOR_PUBLISHED',
      actor: { userId: publishedBy, sessionId: 'system', role: 'tenant-admin' },
      severity: 'info',
      data: { connectorId: def.id, version: def.version, publishedBy },
    });
  } catch { /* never throw from archieve */ }

  return { success: true, definition: updated };
}

export async function deprecateConnector(
  connectorId: string,
  deprecatedBy: string,
  supersededBy?: string
): Promise<{ success: boolean; error?: string }> {
  const def = getDefinitionById(connectorId);
  if (!def) return { success: false, error: 'Connector not found' };
  if (!['published', 'active'].includes(def.status)) {
    return { success: false, error: 'Only published connectors can be deprecated' };
  }

  const updated = updateDefinition(connectorId, {
    status: 'deprecated',
    supersededBy: supersededBy ?? null,
  });
  if (!updated) return { success: false, error: 'DB update failed' };

  // Update registry
  const entry = registry.get(def.tenantId)?.get(connectorId);
  if (entry) entry.status = 'deprecated';

  try {
    archieveLog({
      requestId: crypto.randomUUID(),
      tenantId: def.tenantId,
      module: 'LOGICBRIDGE',
      eventType: 'LOGICBRIDGE_CONNECTOR_DEPRECATED',
      actor: { userId: deprecatedBy, sessionId: 'system', role: 'tenant-admin' },
      severity: 'info',
      data: { connectorId: def.id, deprecatedBy, supersededBy: supersededBy ?? null },
    });
  } catch { /* never throw from archieve */ }

  return { success: true };
}

export function loadRegistryFromDb(): void {
  const published = listAllPublished();
  let loaded = 0;
  let corrupt = 0;

  for (const def of published) {
    try {
      registerEntry(def);
      loaded++;

      try {
        archieveLog({
          requestId: crypto.randomUUID(),
          tenantId: def.tenantId,
          module: 'LOGICBRIDGE',
          eventType: 'LOGICBRIDGE_CONNECTOR_LOADED',
          actor: { userId: 'system', sessionId: 'system', role: 'system' },
          severity: 'info',
          data: { connectorId: def.id },
        });
      } catch { /* never throw from archieve */ }
    } catch (err) {
      corrupt++;
      console.error(`[logicbridge/registry] Failed to load connector ${def.id}:`, (err as Error).message);

      try {
        archieveLog({
          requestId: crypto.randomUUID(),
          tenantId: def.tenantId,
          module: 'LOGICBRIDGE',
          eventType: 'LOGICBRIDGE_INIT_CONNECTOR_CORRUPT',
          actor: { userId: 'system', sessionId: 'system', role: 'system' },
          severity: 'error',
          data: { connectorId: def.id, error: (err as Error).message },
        });
      } catch { /* never throw from archieve */ }
    }
  }

  console.info(`[logicbridge/registry] loaded ${loaded} connectors (${corrupt} corrupt/skipped)`);
}
