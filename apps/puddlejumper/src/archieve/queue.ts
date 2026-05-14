import path from 'node:path';
import fs from 'node:fs';
import Database from 'better-sqlite3';
import { ArchieveError, ARCHIEVE_WAL_WRITE_FAILED, ARCHIEVE_QUEUE_FULL, type WALQueueEntry } from './types.js';

const DEFAULT_QUEUE_MAX_DEPTH = 10_000;

function getMaxDepth(): number {
  const val = process.env.ARCHIEVE_QUEUE_MAX_DEPTH;
  if (val) {
    const n = parseInt(val, 10);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return DEFAULT_QUEUE_MAX_DEPTH;
}

export function openQueue(walPath: string): Database.Database {
  const dir = path.dirname(walPath);
  fs.mkdirSync(dir, { recursive: true });
  const db = new Database(walPath);
  db.pragma('journal_mode = WAL');
  db.pragma('synchronous = FULL');
  initSchema(db);
  return db;
}

export function initSchema(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS archieve_queue (
      rowid INTEGER PRIMARY KEY AUTOINCREMENT,
      event_id TEXT NOT NULL UNIQUE,
      tenant_id TEXT NOT NULL,
      event_type TEXT NOT NULL,
      event_json TEXT NOT NULL,
      queued_at TEXT NOT NULL,
      delivery_attempts INTEGER NOT NULL DEFAULT 0,
      last_attempt_at TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_archieve_queue_tenant
      ON archieve_queue(tenant_id, queued_at);

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

    CREATE INDEX IF NOT EXISTS idx_archieve_delivered_tenant_pos
      ON archieve_delivered(tenant_id, chain_pos);

    CREATE INDEX IF NOT EXISTS idx_archieve_delivered_tenant_time
      ON archieve_delivered(tenant_id, delivered_at);

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
}

export function getQueueDepth(db: Database.Database): number {
  const row = db.prepare('SELECT COUNT(*) as cnt FROM archieve_queue').get() as { cnt: number };
  return row.cnt;
}

export function writeToQueue(db: Database.Database, entry: WALQueueEntry): void {
  const maxDepth = getMaxDepth();
  const depth = getQueueDepth(db);
  if (depth >= maxDepth) {
    throw new ArchieveError(ARCHIEVE_QUEUE_FULL, `ARCHIEVE WAL queue is full (depth=${depth}, max=${maxDepth})`);
  }
  try {
    db.prepare(`
      INSERT INTO archieve_queue (event_id, tenant_id, event_type, event_json, queued_at, delivery_attempts)
      VALUES (@event_id, @tenant_id, @event_type, @event_json, @queued_at, @delivery_attempts)
    `).run({
      event_id: entry.event_id,
      tenant_id: entry.tenant_id,
      event_type: entry.event_type,
      event_json: entry.event_json,
      queued_at: entry.queued_at,
      delivery_attempts: entry.delivery_attempts,
    });
  } catch (err) {
    throw new ArchieveError(ARCHIEVE_WAL_WRITE_FAILED, `Failed to write to ARCHIEVE WAL queue: ${(err as Error).message}`);
  }
}

// Move pending events from queue -> delivered, maintaining per-tenant chain positions.
export function deliverPending(db: Database.Database): void {
  const pending = db.prepare(
    `SELECT rowid, event_id, tenant_id, event_type, event_json, queued_at FROM archieve_queue
     ORDER BY rowid ASC LIMIT 500`
  ).all() as Array<WALQueueEntry & { rowid: number }>;

  if (pending.length === 0) return;

  const deliverOne = db.transaction((entry: WALQueueEntry & { rowid: number }) => {
    const posRow = db.prepare(
      `SELECT MAX(chain_pos) as max_pos FROM archieve_delivered WHERE tenant_id = ?`
    ).get(entry.tenant_id) as { max_pos: number | null };
    const nextPos = (posRow.max_pos ?? -1) + 1;

    let eventHash = '';
    try {
      const evt = JSON.parse(entry.event_json) as Record<string, unknown>;
      eventHash = typeof evt.hash === 'string' ? evt.hash : '';
    } catch { /* ignore */ }

    db.prepare(`
      INSERT OR IGNORE INTO archieve_delivered
        (event_id, tenant_id, event_type, chain_pos, hash, delivered_at, event_json)
      VALUES
        (@event_id, @tenant_id, @event_type, @chain_pos, @hash, @delivered_at, @event_json)
    `).run({
      event_id: entry.event_id,
      tenant_id: entry.tenant_id,
      event_type: entry.event_type,
      chain_pos: nextPos,
      hash: eventHash,
      delivered_at: new Date().toISOString(),
      event_json: entry.event_json,
    });

    db.prepare('DELETE FROM archieve_queue WHERE rowid = ?').run(entry.rowid);
  });

  for (const entry of pending) {
    try {
      deliverOne(entry);
    } catch (err) {
      db.prepare(
        `UPDATE archieve_queue SET delivery_attempts = delivery_attempts + 1, last_attempt_at = ? WHERE rowid = ?`
      ).run(new Date().toISOString(), entry.rowid);
      console.error('[archieve] delivery error for event', entry.event_id, (err as Error).message);
    }
  }
}

export function replayOnStartup(db: Database.Database): void {
  deliverPending(db);
}

export function runDeliveryLoop(db: Database.Database): void {
  const INTERVAL_MS = 5_000;
  setInterval(() => {
    try {
      deliverPending(db);
    } catch (err) {
      console.error('[archieve] delivery loop error:', (err as Error).message);
    }
  }, INTERVAL_MS).unref();
}
