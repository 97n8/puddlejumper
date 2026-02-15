// ── SQLite-backed audit event persistence ───────────────────────────────────
//
// Generic structured audit log. Not auth-specific — any subsystem can log
// events here.
import path from "node:path";
import fs from "node:fs";
import Database from "better-sqlite3";

// ── Types ───────────────────────────────────────────────────────────────────

export type AuditEventRow = {
  id: number;
  timestamp: string;
  event_type: string;
  actor_id: string | null;
  target_id: string | null;
  ip_address: string | null;
  user_agent: string | null;
  request_id: string | null;
  metadata: string | null;
};

export type InsertAuditEvent = {
  event_type: string;
  actor_id?: string | null;
  target_id?: string | null;
  ip_address?: string | null;
  user_agent?: string | null;
  request_id?: string | null;
  metadata?: Record<string, unknown> | null;
};

export type AuditQueryOptions = {
  event_type?: string;
  actor_id?: string;
  limit?: number;
  after?: string; // ISO date string
};

// ── Store (module-level singleton) ──────────────────────────────────────────

let _dataDir: string | null = null;
let _db: Database.Database | null = null;

/** Override the data directory. Call before any store operations. */
export function configureAuditStore(dataDir: string): void {
  _dataDir = dataDir;
}

function resolveDataDir(): string {
  if (_dataDir) return _dataDir;
  return process.env.CONTROLLED_DATA_DIR || path.resolve(process.cwd(), "data");
}

function getDb(): Database.Database {
  if (_db) return _db;
  const dir = resolveDataDir();
  fs.mkdirSync(dir, { recursive: true });
  const dbPath = path.join(dir, "audit.db");
  _db = new Database(dbPath);
  _db.pragma("journal_mode = WAL");
  _db.exec(`
    CREATE TABLE IF NOT EXISTS audit_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp TEXT NOT NULL DEFAULT (datetime('now')),
      event_type TEXT NOT NULL,
      actor_id TEXT,
      target_id TEXT,
      ip_address TEXT,
      user_agent TEXT,
      request_id TEXT,
      metadata TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_audit_type ON audit_events(event_type);
    CREATE INDEX IF NOT EXISTS idx_audit_actor ON audit_events(actor_id);
    CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON audit_events(timestamp);
  `);
  return _db;
}

/** For tests: close the DB and reset so next call re-opens a fresh store. */
export function resetAuditDb(): void {
  if (_db) {
    try {
      _db.exec("DELETE FROM audit_events");
    } catch {
      /* table may not exist yet */
    }
    _db.close();
    _db = null;
  }
}

// ── Operations ──────────────────────────────────────────────────────────────

/** Insert an audit event into the database. */
export function insertAuditEvent(event: InsertAuditEvent): AuditEventRow {
  const db = getDb();
  const metadataStr = event.metadata ? JSON.stringify(event.metadata) : null;
  const stmt = db.prepare(`
    INSERT INTO audit_events (event_type, actor_id, target_id, ip_address, user_agent, request_id, metadata)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  const result = stmt.run(
    event.event_type,
    event.actor_id ?? null,
    event.target_id ?? null,
    event.ip_address ?? null,
    event.user_agent ?? null,
    event.request_id ?? null,
    metadataStr,
  );
  return db
    .prepare("SELECT * FROM audit_events WHERE id = ?")
    .get(result.lastInsertRowid) as AuditEventRow;
}

/** Query audit events with optional filters. */
export function queryAuditEvents(opts: AuditQueryOptions = {}): AuditEventRow[] {
  const db = getDb();
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (opts.event_type) {
    conditions.push("event_type = ?");
    params.push(opts.event_type);
  }
  if (opts.actor_id) {
    conditions.push("actor_id = ?");
    params.push(opts.actor_id);
  }
  if (opts.after) {
    conditions.push("timestamp > ?");
    params.push(opts.after);
  }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const limit = Math.min(opts.limit ?? 50, 500);

  return db
    .prepare(`SELECT * FROM audit_events ${where} ORDER BY id DESC LIMIT ?`)
    .all(...params, limit) as AuditEventRow[];
}
