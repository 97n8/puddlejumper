import crypto from 'node:crypto';
import type Database from 'better-sqlite3';
import type { SyncJob, SyncJobStatus, SyncJobStats } from './types.js';

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS syncronate_jobs (
    job_id TEXT PRIMARY KEY,
    feed_id TEXT NOT NULL,
    tenant_id TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'queued',
    trigger_type TEXT NOT NULL DEFAULT 'manual',
    started_at TEXT NOT NULL DEFAULT (datetime('now')),
    completed_at TEXT,
    stats_json TEXT NOT NULL DEFAULT '{}',
    cursor TEXT,
    error_json TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_sj_feed ON syncronate_jobs(feed_id);
  CREATE INDEX IF NOT EXISTS idx_sj_tenant ON syncronate_jobs(tenant_id);
  CREATE INDEX IF NOT EXISTS idx_sj_status ON syncronate_jobs(status);
`;

export function initJobStore(db: Database.Database): void {
  db.exec(SCHEMA);
}

function row2job(row: {
  job_id: string; feed_id: string; tenant_id: string; status: string;
  trigger_type: string; started_at: string; completed_at: string | null;
  stats_json: string; cursor: string | null; error_json: string | null;
}): SyncJob {
  return {
    jobId: row.job_id,
    feedId: row.feed_id,
    tenantId: row.tenant_id,
    status: row.status as SyncJobStatus,
    triggerType: row.trigger_type as SyncJob['triggerType'],
    startedAt: row.started_at,
    completedAt: row.completed_at ?? undefined,
    stats: row.stats_json ? JSON.parse(row.stats_json) : emptyStats(),
    cursor: row.cursor ?? undefined,
    error: row.error_json ? JSON.parse(row.error_json) : undefined,
  };
}

function emptyStats(): SyncJobStats {
  return { ingested: 0, updated: 0, skipped: 0, blocked: 0, transformErrors: 0, delivered: 0, deliveryFailed: 0 };
}

export function createJob(db: Database.Database, feedId: string, tenantId: string, triggerType: SyncJob['triggerType']): SyncJob {
  const jobId = crypto.randomUUID();
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO syncronate_jobs (job_id, feed_id, tenant_id, status, trigger_type, started_at, stats_json)
     VALUES (?, ?, ?, 'queued', ?, ?, ?)`
  ).run(jobId, feedId, tenantId, triggerType, now, JSON.stringify(emptyStats()));
  return getJob(db, jobId)!;
}

export function getJob(db: Database.Database, jobId: string): SyncJob | null {
  const row = db.prepare(`SELECT * FROM syncronate_jobs WHERE job_id = ?`).get(jobId) as any;
  return row ? row2job(row) : null;
}

export function updateJob(db: Database.Database, jobId: string, patch: Partial<SyncJob>): SyncJob | null {
  const existing = getJob(db, jobId);
  if (!existing) return null;
  const updated = { ...existing, ...patch };
  db.prepare(
    `UPDATE syncronate_jobs SET status = ?, completed_at = ?, stats_json = ?, cursor = ?, error_json = ? WHERE job_id = ?`
  ).run(
    updated.status,
    updated.completedAt ?? null,
    JSON.stringify(updated.stats),
    updated.cursor ?? null,
    updated.error ? JSON.stringify(updated.error) : null,
    jobId
  );
  return getJob(db, jobId);
}

export function listJobs(db: Database.Database, feedId: string, filters?: { status?: string }): SyncJob[] {
  let sql = `SELECT * FROM syncronate_jobs WHERE feed_id = ?`;
  const params: unknown[] = [feedId];
  if (filters?.status) { sql += ` AND status = ?`; params.push(filters.status); }
  sql += ` ORDER BY started_at DESC LIMIT 100`;
  const rows = db.prepare(sql).all(...params) as any[];
  return rows.map(row2job);
}

export function listJobsForTenant(db: Database.Database, tenantId: string, limit = 20): SyncJob[] {
  const rows = db.prepare(`SELECT * FROM syncronate_jobs WHERE tenant_id = ? ORDER BY started_at DESC LIMIT ?`).all(tenantId, limit) as any[];
  return rows.map(row2job);
}

export function countRunningJobs(db: Database.Database): number {
  const row = db.prepare(`SELECT COUNT(*) as cnt FROM syncronate_jobs WHERE status IN ('queued','running','transforming','writing','delivering')`).get() as { cnt: number };
  return row.cnt;
}

export function countJobsToday(db: Database.Database, tenantId: string): number {
  const row = db.prepare(
    `SELECT COUNT(*) as cnt FROM syncronate_jobs WHERE tenant_id = ? AND started_at >= date('now')`
  ).get(tenantId) as { cnt: number };
  return row.cnt;
}
