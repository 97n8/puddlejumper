import { beforeEach, describe, expect, it } from 'vitest';
import { getDb, migrate, type DatabaseHandle } from '../src/index.js';

function freshDb(): DatabaseHandle {
  const db = getDb(':memory:');
  migrate(db);
  return db;
}

function tableExists(db: DatabaseHandle, name: string): boolean {
  const row = db
    .prepare(`SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?`)
    .get(name) as { name: string } | undefined;
  return row?.name === name;
}

function columnNames(db: DatabaseHandle, table: string): string[] {
  return (
    db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>
  ).map((row) => row.name);
}

describe('@pj/db — migration 008 LogicCommons runtime schema', () => {
  let db: DatabaseHandle;

  beforeEach(() => {
    db = freshDb();
  });

  it('creates the canonical casespaces, work_items, and seals tables', () => {
    expect(tableExists(db, 'casespaces')).toBe(true);
    expect(tableExists(db, 'work_items')).toBe(true);
    expect(tableExists(db, 'seals')).toBe(true);
    expect(columnNames(db, 'seals')).toEqual(
      expect.arrayContaining(['seal_sequence', 'seal_id', 'prev_seal_hash']),
    );
  });

  it('extends holds for PRM resource windows without replacing the table', () => {
    expect(columnNames(db, 'holds')).toEqual(
      expect.arrayContaining([
        'work_item_id',
        'hold_kind',
        'pool',
        'resource_ref',
        'starts_at',
        'ends_at',
        'needed_by',
        'resources_json',
      ]),
    );
  });

  it('records the runtime migration exactly once across repeated boots', () => {
    const firstCount = (
      db.prepare(`SELECT COUNT(*) AS count FROM pj_db_migrations WHERE filename = ?`)
        .get('008_logic_commons_runtime.sql') as { count: number }
    ).count;
    expect(firstCount).toBe(1);

    const second = migrate(db);
    expect(second.applied).toEqual([]);
    expect(second.skipped).toContain('008_logic_commons_runtime.sql');

    const secondCount = (
      db.prepare(`SELECT COUNT(*) AS count FROM pj_db_migrations WHERE filename = ?`)
        .get('008_logic_commons_runtime.sql') as { count: number }
    ).count;
    expect(secondCount).toBe(1);
  });
});
