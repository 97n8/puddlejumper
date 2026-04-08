// Database abstraction layer.
// Default: SQLite via better-sqlite3 (DATABASE_URL not set)
// Future: Postgres via DATABASE_URL=postgres://...
//
// Usage:
//   import { openMainDb, DB_BACKEND } from '../../db/adapter.js'
//   const db = openMainDb(dataDir)  // returns better-sqlite3 Database

import Database from 'better-sqlite3';
import path from 'node:path';
import fs from 'node:fs';

export type DbBackend = 'sqlite' | 'postgres';

export const DB_BACKEND: DbBackend = process.env.DATABASE_URL?.startsWith('postgres') ? 'postgres' : 'sqlite';

export function openMainDb(dataDir: string): Database.Database {
  if (DB_BACKEND === 'postgres') {
    // Postgres path: throw a clear actionable error until the adapter is wired
    throw new Error(
      '[db/adapter] Postgres backend is configured (DATABASE_URL is set) but the pg adapter is not yet implemented. ' +
      'To use Postgres: run the migration scripts in docs/migrations/ and implement the pg adapter in this file. ' +
      'To use SQLite (default): unset DATABASE_URL.'
    );
  }
  const dbPath = path.join(dataDir, 'puddlejumper.db');
  fs.mkdirSync(dataDir, { recursive: true });
  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  return db;
}

export function getDbPath(dataDir: string): string {
  return path.join(dataDir, 'puddlejumper.db');
}
