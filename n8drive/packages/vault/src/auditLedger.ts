import Database from 'better-sqlite3';
import { z } from 'zod';
import path from 'path';
import fs from 'fs';

/**
 * Audit event schema matching PuddleJumper's AuditEvent type
 */
export const AuditEventSchema = z.object({
  eventId: z.string().optional(), // Generated server-side
  eventType: z.enum([
    'authorization_check',
    'chain_template_fetch',
    'manifest_register',
    'release_authorize',
    'drift_classify',
    'process_deploy',
    'process_update',
    'approval_granted',
    'approval_denied',
  ]),
  workspaceId: z.string(),
  operatorId: z.string().optional(),
  timestamp: z.string().optional(), // ISO 8601, generated server-side
  details: z.record(z.any()),
});

export type AuditEvent = z.infer<typeof AuditEventSchema>;

/**
 * Append-only audit ledger using SQLite
 * Provides immutable compliance trail for VAULT operations
 */
export class AuditLedger {
  private db: Database.Database;

  constructor(dbPath: string) {
    // Ensure directory exists
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    this.db = new Database(dbPath);
    this.initializeSchema();
  }

  private initializeSchema(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS audit_events (
        event_id TEXT PRIMARY KEY,
        event_type TEXT NOT NULL,
        workspace_id TEXT NOT NULL,
        operator_id TEXT,
        timestamp TEXT NOT NULL,
        details_json TEXT NOT NULL,
        created_at INTEGER NOT NULL DEFAULT (unixepoch())
      );

      CREATE INDEX IF NOT EXISTS idx_audit_workspace ON audit_events(workspace_id);
      CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON audit_events(timestamp);
      CREATE INDEX IF NOT EXISTS idx_audit_type ON audit_events(event_type);
    `);
  }

  /**
   * Append audit event (idempotent by event_id)
   * Returns true if inserted, false if already exists
   */
  append(event: AuditEvent): boolean {
    const eventId = event.eventId || this.generateEventId();
    const timestamp = event.timestamp || new Date().toISOString();

    try {
      const stmt = this.db.prepare(`
        INSERT INTO audit_events (event_id, event_type, workspace_id, operator_id, timestamp, details_json)
        VALUES (?, ?, ?, ?, ?, ?)
      `);

      stmt.run(
        eventId,
        event.eventType,
        event.workspaceId,
        event.operatorId || null,
        timestamp,
        JSON.stringify(event.details)
      );

      return true;
    } catch (err: any) {
      // UNIQUE constraint violation = idempotent duplicate
      if (err.code === 'SQLITE_CONSTRAINT' && err.message.includes('UNIQUE')) {
        return false;
      }
      throw err;
    }
  }

  /**
   * Read audit events with filtering and pagination
   */
  read(options: {
    workspaceId?: string;
    eventType?: string;
    limit?: number;
    offset?: number;
    startDate?: string;
    endDate?: string;
  }): AuditEvent[] {
    let query = 'SELECT * FROM audit_events WHERE 1=1';
    const params: any[] = [];

    if (options.workspaceId) {
      query += ' AND workspace_id = ?';
      params.push(options.workspaceId);
    }

    if (options.eventType) {
      query += ' AND event_type = ?';
      params.push(options.eventType);
    }

    if (options.startDate) {
      query += ' AND timestamp >= ?';
      params.push(options.startDate);
    }

    if (options.endDate) {
      query += ' AND timestamp <= ?';
      params.push(options.endDate);
    }

    query += ' ORDER BY timestamp DESC';

    if (options.limit) {
      query += ' LIMIT ?';
      params.push(options.limit);
    }

    if (options.offset) {
      query += ' OFFSET ?';
      params.push(options.offset);
    }

    const stmt = this.db.prepare(query);
    const rows = stmt.all(...params) as any[];

    return rows.map((row) => ({
      eventId: row.event_id,
      eventType: row.event_type,
      workspaceId: row.workspace_id,
      operatorId: row.operator_id,
      timestamp: row.timestamp,
      details: JSON.parse(row.details_json),
    }));
  }

  /**
   * Count audit events (for pagination)
   */
  count(options: { workspaceId?: string; eventType?: string }): number {
    let query = 'SELECT COUNT(*) as count FROM audit_events WHERE 1=1';
    const params: any[] = [];

    if (options.workspaceId) {
      query += ' AND workspace_id = ?';
      params.push(options.workspaceId);
    }

    if (options.eventType) {
      query += ' AND event_type = ?';
      params.push(options.eventType);
    }

    const stmt = this.db.prepare(query);
    const result = stmt.get(...params) as { count: number };
    return result.count;
  }

  private generateEventId(): string {
    return `evt_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
  }

  close(): void {
    this.db.close();
  }
}
