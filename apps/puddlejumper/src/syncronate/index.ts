import type Database from 'better-sqlite3';
import { initFeedStore } from './feed-store.js';
import { initJobStore } from './job-store.js';
import { initRecordStore } from './record-store.js';
import { initKvStore } from './kv-store.js';
import { scheduleAllActiveFeeds, getSyncronateHealth as _getHealth } from './sync-engine.js';

export { createSyncronateRouter } from './api.js';
export * from './types.js';

// Keep a reference to db for health checks
let _db: Database.Database | null = null;

export function initSyncronate(db: Database.Database): void {
  _db = db;
  initKvStore(db);
  initFeedStore(db);
  initJobStore(db);
  initRecordStore(db);
  scheduleAllActiveFeeds(db);
  console.info('[syncronate] initialized');
}

export function getSyncronateHealth(): { status: 'ok' | 'degraded'; activeFeeds: number; jobsRunning: number } {
  return _getHealth(_db ?? undefined);
}
