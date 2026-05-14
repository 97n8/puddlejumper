// ─────────────────────────────────────────────────────────────────────────────
// AXIS Credential Vault — PublicLogic System Architecture Boot Position 6
// ─────────────────────────────────────────────────────────────────────────────
// AXIS is the credential vault for all external API tokens and AI provider
// calls within PuddleJumper. SYNCHRON8 never holds credentials directly.
// All connector calls route through AXIS before dispatch.
//
// In the current implementation, AXIS credential vault functionality is
// embedded within LOGICBRIDGE (boot position 8). When AXIS is extracted as
// a standalone module, this file becomes the LOGICBRIDGE connector registry
// only, and credential management moves to src/axis/.
//
// Architecture reference: System Architecture FINAL, Part 6 — 13 Resident
// Modules, Boot Order #6 (AXIS) and #8 (LOGICBRIDGE).
// ─────────────────────────────────────────────────────────────────────────────
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

  console.info('[logicbridge] initializing...');

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
  console.info('[logicbridge] initialized');
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
