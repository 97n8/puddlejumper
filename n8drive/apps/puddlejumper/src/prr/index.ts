import type Database from 'better-sqlite3';
import { initPRRStore } from './store.js';

export { createPrrRouter } from './api.js';
export { initPRRStore } from './store.js';
export * from './types.js';

export function initPRR(db: Database.Database): void {
  initPRRStore(db);
  console.log('[prr] initialized');
}
