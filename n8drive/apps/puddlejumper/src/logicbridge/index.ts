import type Database from 'better-sqlite3';
import { initDefinitionStore } from './registry/definition-store.js';
import { loadRegistryFromDb, countRegistered, countSuspended } from './registry/registry-publisher.js';
import { initSandboxPool, getSandboxPoolInfo } from './handler/sandbox.js';
import { initSparkKv } from './spark/kv.js';
import { startReconciler } from './registry/reconciler.js';
import type { LogicBridgeHealth } from './types.js';
import type { ConnectorStore } from '../api/connectorStore.js';
import { initExplorer } from './explorer/router.js';

export { createLogicBridgeRouter } from './api.js';
export type { LogicBridgeHealth } from './types.js';

let _initialized = false;

export async function initLogicBridge(db: Database.Database, connectorStore?: ConnectorStore): Promise<void> {
  if (_initialized) return;

  console.log('[logicbridge] initializing...');

  // Step 1: Init definition store (SQLite schema)
  initDefinitionStore(db);

  // Step 2: Init KV store
  initSparkKv(db);

  // Step 3: Load registry from DB
  try {
    loadRegistryFromDb();
  } catch (err) {
    console.error('[logicbridge] Failed to load registry:', (err as Error).message);
    // Non-fatal — continue with empty registry
  }

  // Step 4: Init sandbox pool (isolated-vm required — throws on failure)
  await initSandboxPool();

  // Step 5: Init explorer
  if (connectorStore) {
    initExplorer(connectorStore);
  }

  // Step 6: Start background reconciler
  startReconciler();

  _initialized = true;
  console.log('[logicbridge] initialized');
}

export function getLogicBridgeHealth(): LogicBridgeHealth {
  try {
    const { poolSize, available, isolatedVmActive } = getSandboxPoolInfo();
    const connectorsRegistered = countRegistered();
    const suspendedConnectors = countSuspended();

    const status: LogicBridgeHealth['status'] =
      connectorsRegistered >= 0 ? 'ok' : 'degraded';

    return {
      status,
      isolatedVm: isolatedVmActive,
      connectorsRegistered,
      suspendedConnectors,
      sandboxPoolSize: poolSize,
      sandboxAvailable: available,
    };
  } catch {
    return {
      status: 'error',
      isolatedVm: false,
      connectorsRegistered: 0,
      suspendedConnectors: 0,
      sandboxPoolSize: 0,
      sandboxAvailable: 0,
    };
  }
}
