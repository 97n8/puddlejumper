// Simple sequential migration runner.
// Each migration runs once; applied migrations tracked in db_migrations table.

import type Database from 'better-sqlite3';

export interface Migration {
  id: string;   // e.g. '001_initial_schema'
  sql: string;
}

export function runMigrations(db: Database.Database, migrations: Migration[]): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS db_migrations (
      id TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  const applied = new Set(
    (db.prepare('SELECT id FROM db_migrations').all() as {id: string}[]).map(r => r.id)
  );

  for (const m of migrations) {
    if (applied.has(m.id)) continue;
    try {
      db.transaction(() => {
        db.exec(m.sql);
        db.prepare('INSERT INTO db_migrations (id) VALUES (?)').run(m.id);
      })();
      console.info(`[migrations] applied: ${m.id}`);
    } catch (err) {
      console.error(`[migrations] failed: ${m.id}`, err);
      throw err;
    }
  }
}
