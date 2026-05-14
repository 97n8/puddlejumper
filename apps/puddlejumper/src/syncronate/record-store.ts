import crypto from 'node:crypto';
import type Database from 'better-sqlite3';
import type { FederationRecord } from './types.js';

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS syncronate_records (
    record_id TEXT PRIMARY KEY,
    feed_id TEXT NOT NULL,
    tenant_id TEXT NOT NULL,
    external_id TEXT NOT NULL,
    source_connector_id TEXT NOT NULL,
    source_updated_at TEXT NOT NULL,
    record_json TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_sr_feed ON syncronate_records(feed_id);
  CREATE INDEX IF NOT EXISTS idx_sr_external ON syncronate_records(feed_id, source_connector_id, external_id);
  CREATE INDEX IF NOT EXISTS idx_sr_tenant ON syncronate_records(tenant_id);
`;

export function initRecordStore(db: Database.Database): void {
  db.exec(SCHEMA);
}

function row2record(row: { record_json: string }): FederationRecord {
  return JSON.parse(row.record_json) as FederationRecord;
}

export function findByExternalId(
  db: Database.Database,
  feedId: string,
  connectorId: string,
  externalId: string
): FederationRecord | null {
  const row = db.prepare(
    `SELECT record_json FROM syncronate_records WHERE feed_id = ? AND source_connector_id = ? AND external_id = ?`
  ).get(feedId, connectorId, externalId) as { record_json: string } | undefined;
  return row ? row2record(row) : null;
}

export function createRecord(db: Database.Database, record: Omit<FederationRecord, 'recordId' | 'createdAt' | 'updatedAt'>): FederationRecord {
  const now = new Date().toISOString();
  const recordId = crypto.randomUUID();
  const full: FederationRecord = { ...record, recordId, createdAt: now, updatedAt: now };
  db.prepare(
    `INSERT INTO syncronate_records (record_id, feed_id, tenant_id, external_id, source_connector_id, source_updated_at, record_json, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(recordId, full.feedId, full.tenantId, full.externalId, full.sourceConnectorId, full.sourceUpdatedAt, JSON.stringify(full), now, now);
  return full;
}

export function updateRecord(db: Database.Database, recordId: string, record: FederationRecord): FederationRecord | null {
  const now = new Date().toISOString();
  const updated = { ...record, recordId, updatedAt: now };
  const changes = db.prepare(
    `UPDATE syncronate_records SET record_json = ?, source_updated_at = ?, updated_at = ? WHERE record_id = ?`
  ).run(JSON.stringify(updated), updated.sourceUpdatedAt, now, recordId).changes;
  return changes > 0 ? updated : null;
}

export function getRecord(db: Database.Database, recordId: string): FederationRecord | null {
  const row = db.prepare(`SELECT record_json FROM syncronate_records WHERE record_id = ?`).get(recordId) as { record_json: string } | undefined;
  return row ? row2record(row) : null;
}

export function listRecords(
  db: Database.Database,
  feedId: string,
  filters?: { sourceConnectorId?: string },
  pagination?: { limit?: number; offset?: number }
): FederationRecord[] {
  let sql = `SELECT record_json FROM syncronate_records WHERE feed_id = ?`;
  const params: unknown[] = [feedId];
  if (filters?.sourceConnectorId) { sql += ` AND source_connector_id = ?`; params.push(filters.sourceConnectorId); }
  sql += ` ORDER BY created_at DESC LIMIT ? OFFSET ?`;
  params.push(pagination?.limit ?? 100, pagination?.offset ?? 0);
  const rows = db.prepare(sql).all(...params) as { record_json: string }[];
  return rows.map(row2record);
}

export function tombstoneRecord(db: Database.Database, recordId: string): boolean {
  const row = db.prepare(`SELECT record_json FROM syncronate_records WHERE record_id = ?`).get(recordId) as { record_json: string } | undefined;
  if (!row) return false;
  const record = row2record(row);
  const tombstoned = { ...record, tombstoned: true, updatedAt: new Date().toISOString() };
  db.prepare(`UPDATE syncronate_records SET record_json = ? WHERE record_id = ?`).run(JSON.stringify(tombstoned), recordId);
  return true;
}

export function countRecordsIngested(db: Database.Database, tenantId: string): number {
  const row = db.prepare(`SELECT COUNT(*) as cnt FROM syncronate_records WHERE tenant_id = ?`).get(tenantId) as { cnt: number };
  return row.cnt;
}
