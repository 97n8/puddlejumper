import { listAllPublished, getDefinitionById } from './definition-store.js';
import { registerEntry, getRegistryEntry } from './registry-publisher.js';
import { log as archieveLog } from '../../archieve/logger.js';
import crypto from 'node:crypto';

const RECONCILE_INTERVAL_MS = 30_000;

let reconcileTimer: ReturnType<typeof setInterval> | null = null;

export function startReconciler(): void {
  if (reconcileTimer) return;
  reconcileTimer = setInterval(runReconciliation, RECONCILE_INTERVAL_MS);
  reconcileTimer.unref?.();
}

export function stopReconciler(): void {
  if (reconcileTimer) {
    clearInterval(reconcileTimer);
    reconcileTimer = null;
  }
}

export function runReconciliation(): void {
  try {
    const published = listAllPublished();
    let reregistered = 0;

    for (const def of published) {
      const existing = getRegistryEntry(def.tenantId, def.id);
      if (!existing && def.sealToken) {
        registerEntry(def);
        reregistered++;
      }
    }

    if (reregistered > 0) {
      console.info(`[logicbridge/reconciler] re-registered ${reregistered} connectors`);

      try {
        archieveLog({
          requestId: crypto.randomUUID(),
          tenantId: 'system',
          module: 'LOGICBRIDGE',
          eventType: 'LOGICBRIDGE_REGISTRY_RELOAD',
          actor: { userId: 'system', sessionId: 'system', role: 'system' },
          severity: 'info',
          data: { connectorId: 'reconciler', reregistered },
        });
      } catch { /* never throw from archieve */ }
    }
  } catch (err) {
    console.error('[logicbridge/reconciler] error:', (err as Error).message);
  }
}
