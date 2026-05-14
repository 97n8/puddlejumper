import type Database from 'better-sqlite3';
import { initOrgStore } from './store.js';

export { createOrgManagerRouter } from './api.js';
export { initOrgStore } from './store.js';
export * from './types.js';

export function initOrgManager(db: Database.Database): void {
  initOrgStore(db);
  console.info('[org-manager] initialized');
}
