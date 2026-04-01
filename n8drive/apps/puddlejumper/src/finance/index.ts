import type Database from 'better-sqlite3';
import { initFinanceStore } from './store.js';

export { createFinanceRouter } from './api.js';
export { initFinanceStore } from './store.js';
export * from './types.js';

export function initFinance(db: Database.Database): void {
  initFinanceStore(db);
  console.log('[finance] initialized');
}
