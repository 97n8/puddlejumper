import crypto from 'node:crypto';
import type Database from 'better-sqlite3';
import {
  type ArchieveEvent,
  ArchieveError,
  ARCHIEVE_INVALID_EVENT,
  ARCHIEVE_KMS_UNAVAILABLE,
} from './types.js';
import { validateEventData } from './event-catalog.js';
import {
  getChainTail,
  getChainLength,
  computeEventHash,
  computeHmac,
  updateChainTail,
  jcsSerialize,
  initChainTail,
} from './chain.js';
import { openQueue, writeToQueue, getQueueDepth, replayOnStartup, runDeliveryLoop } from './queue.js';
import path from 'node:path';

let walDb: Database.Database | null = null;

export function initArchieve(db: Database.Database, dataDir: string): void {
  // Also init schema on the main DB (archieve_delivered lives there for query purposes)
  // But WAL queue gets its own DB file
  const walPath = process.env.ARCHIEVE_WAL_PATH ?? path.join(dataDir, 'archieve', 'queue.db');
  walDb = openQueue(walPath);

  // Init schema on the main DB for cross-query convenience (delivered + notarizations)
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS archieve_delivered (
        rowid INTEGER PRIMARY KEY AUTOINCREMENT,
        event_id TEXT NOT NULL UNIQUE,
        tenant_id TEXT NOT NULL,
        event_type TEXT NOT NULL,
        chain_pos INTEGER NOT NULL,
        hash TEXT NOT NULL,
        delivered_at TEXT NOT NULL,
        event_json TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_ad_tenant_pos ON archieve_delivered(tenant_id, chain_pos);
      CREATE INDEX IF NOT EXISTS idx_ad_tenant_time ON archieve_delivered(tenant_id, delivered_at);

      CREATE TABLE IF NOT EXISTS archieve_notarizations (
        rowid INTEGER PRIMARY KEY AUTOINCREMENT,
        tenant_id TEXT NOT NULL,
        date TEXT NOT NULL,
        chain_head TEXT NOT NULL,
        root_hash TEXT NOT NULL,
        tsa_token TEXT NOT NULL,
        tsa_url TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        UNIQUE(tenant_id, date)
      );
    `);
  } catch (err) {
    console.error('[archieve] failed to init schema on main db:', (err as Error).message);
  }

  // Restore chain tails from delivered table in WAL db
  try {
    const tenants = walDb.prepare(
      `SELECT tenant_id, MAX(chain_pos) as max_pos, hash FROM archieve_delivered
       WHERE chain_pos = (SELECT MAX(chain_pos) FROM archieve_delivered d2 WHERE d2.tenant_id = archieve_delivered.tenant_id)
       GROUP BY tenant_id`
    ).all() as Array<{ tenant_id: string; max_pos: number; hash: string }>;

    for (const row of tenants) {
      initChainTail(row.tenant_id, row.hash, row.max_pos + 1);
    }
  } catch { /* table might not have data yet */ }

  replayOnStartup(walDb);
  runDeliveryLoop(walDb);
  console.log('[archieve] initialized, WAL queue:', walPath);
}

function getWalDb(): Database.Database {
  if (!walDb) throw new ArchieveError('ARCHIEVE_NOT_INITIALIZED', 'Call initArchieve() before logging');
  return walDb;
}

export function log(event: ArchieveEvent): ArchieveEvent {
  // 1. Validate required top-level fields
  if (!event.requestId) throw new ArchieveError(ARCHIEVE_INVALID_EVENT, 'Missing requestId');
  if (!event.tenantId) throw new ArchieveError(ARCHIEVE_INVALID_EVENT, 'Missing tenantId');
  if (!event.module) throw new ArchieveError(ARCHIEVE_INVALID_EVENT, 'Missing module');
  if (!event.eventType) throw new ArchieveError(ARCHIEVE_INVALID_EVENT, 'Missing eventType');
  if (!event.actor?.userId) throw new ArchieveError(ARCHIEVE_INVALID_EVENT, 'Missing actor.userId');
  if (!event.severity) throw new ArchieveError(ARCHIEVE_INVALID_EVENT, 'Missing severity');

  // Validate eventType and required data fields
  validateEventData(event.eventType, event.data);

  // 2. Inject metadata
  const eventId = crypto.randomUUID();
  const timestamp = event.timestamp ?? new Date().toISOString();
  const module = event.module.toUpperCase();

  // 3. Compute hash chain
  const db = getWalDb();
  const prevHash = getChainTail(event.tenantId);
  const chainPos = getChainLength(event.tenantId);

  const partial: ArchieveEvent = {
    ...event,
    eventId,
    timestamp,
    module,
    chainPos,
    prevHash,
    hash: '',
    hmac: '',
  };

  const hash = computeEventHash(partial as object, prevHash);
  const jcs = jcsSerialize({ ...partial, hash });
  let hmac = '';
  try {
    hmac = computeHmac(jcs);
  } catch (err) {
    if ((err as ArchieveError).code === ARCHIEVE_KMS_UNAVAILABLE) {
      // Fail-closed: no HMAC key = no logging
      throw err;
    }
  }

  const final: ArchieveEvent = { ...partial, hash, hmac };

  // 4. Check queue depth & write to WAL (synchronous)
  writeToQueue(db, {
    event_id: eventId,
    tenant_id: event.tenantId,
    event_type: event.eventType,
    event_json: JSON.stringify(final),
    queued_at: new Date().toISOString(),
    delivery_attempts: 0,
  });

  // 5. Update in-memory chain tail
  updateChainTail(event.tenantId, hash, chainPos + 1);

  return final;
}

export function getArchieveQueueDepth(): number {
  try {
    return getQueueDepth(getWalDb());
  } catch {
    return 0;
  }
}

export function getArchieveWalDb(): Database.Database | null {
  return walDb;
}
