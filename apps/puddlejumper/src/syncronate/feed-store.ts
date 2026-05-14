import crypto from 'node:crypto';
import type Database from 'better-sqlite3';
import type { FeedDef, FeedStatus } from './types.js';

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS syncronate_feeds (
    feed_id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'draft',
    display_name TEXT NOT NULL,
    feed_json TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_sf_tenant ON syncronate_feeds(tenant_id);
  CREATE INDEX IF NOT EXISTS idx_sf_status ON syncronate_feeds(status);
`;

export function initFeedStore(db: Database.Database): void {
  db.exec(SCHEMA);
}

function row2feed(row: { feed_json: string }): FeedDef {
  return JSON.parse(row.feed_json) as FeedDef;
}

export function createFeed(db: Database.Database, feed: Omit<FeedDef, 'feedId' | 'createdAt' | 'updatedAt' | 'status'>): FeedDef {
  const now = new Date().toISOString();
  const feedId = crypto.randomUUID();
  const full: FeedDef = { ...feed, feedId, status: 'draft', createdAt: now, updatedAt: now };
  db.prepare(
    `INSERT INTO syncronate_feeds (feed_id, tenant_id, status, display_name, feed_json, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(feedId, full.tenantId, full.status, full.displayName, JSON.stringify(full), now, now);
  return full;
}

export function getFeed(db: Database.Database, feedId: string): FeedDef | null {
  const row = db.prepare(`SELECT feed_json FROM syncronate_feeds WHERE feed_id = ?`).get(feedId) as { feed_json: string } | undefined;
  return row ? row2feed(row) : null;
}

export function updateFeed(db: Database.Database, feedId: string, patch: Partial<FeedDef>): FeedDef | null {
  const existing = getFeed(db, feedId);
  if (!existing) return null;
  const now = new Date().toISOString();
  const updated: FeedDef = { ...existing, ...patch, feedId, updatedAt: now };
  db.prepare(
    `UPDATE syncronate_feeds SET feed_json = ?, display_name = ?, status = ?, updated_at = ? WHERE feed_id = ?`
  ).run(JSON.stringify(updated), updated.displayName, updated.status, now, feedId);
  return updated;
}

export function listFeeds(db: Database.Database, tenantId: string): FeedDef[] {
  const rows = db.prepare(`SELECT feed_json FROM syncronate_feeds WHERE tenant_id = ? ORDER BY created_at DESC`).all(tenantId) as { feed_json: string }[];
  return rows.map(row2feed);
}

export function setFeedStatus(db: Database.Database, feedId: string, status: FeedStatus): FeedDef | null {
  return updateFeed(db, feedId, { status });
}

export function initSyncronate(db: Database.Database): void {
  initFeedStore(db);
}
