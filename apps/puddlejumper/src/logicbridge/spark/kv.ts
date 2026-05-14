import type Database from 'better-sqlite3';

// spark.kv — simple key/value store per tenant/connector

let _db: Database.Database | null = null;

export function initSparkKv(db: Database.Database): void {
  _db = db;
  db.exec(`
    CREATE TABLE IF NOT EXISTS logicbridge_kv (
      tenant_id TEXT NOT NULL,
      connector_id TEXT NOT NULL,
      key TEXT NOT NULL,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (tenant_id, connector_id, key)
    )
  `);
}

export function createSparkKv(tenantId: string, connectorId: string) {
  return {
    async get(key: string): Promise<unknown | null> {
      if (!_db) throw new Error('KV store not initialized');
      const row = _db.prepare('SELECT value FROM logicbridge_kv WHERE tenant_id=? AND connector_id=? AND key=?')
        .get(tenantId, connectorId, key) as { value: string } | undefined;
      return row ? JSON.parse(row.value) : null;
    },
    async set(key: string, value: unknown): Promise<void> {
      if (!_db) throw new Error('KV store not initialized');
      _db.prepare(`
        INSERT INTO logicbridge_kv (tenant_id, connector_id, key, value, updated_at)
        VALUES (?,?,?,?,datetime('now'))
        ON CONFLICT(tenant_id, connector_id, key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at
      `).run(tenantId, connectorId, key, JSON.stringify(value));
    },
    async delete(key: string): Promise<void> {
      if (!_db) throw new Error('KV store not initialized');
      _db.prepare('DELETE FROM logicbridge_kv WHERE tenant_id=? AND connector_id=? AND key=?')
        .run(tenantId, connectorId, key);
    },
    async list(prefix?: string): Promise<string[]> {
      if (!_db) throw new Error('KV store not initialized');
      const rows = prefix
        ? _db.prepare('SELECT key FROM logicbridge_kv WHERE tenant_id=? AND connector_id=? AND key LIKE ?').all(tenantId, connectorId, `${prefix}%`) as Array<{ key: string }>
        : _db.prepare('SELECT key FROM logicbridge_kv WHERE tenant_id=? AND connector_id=?').all(tenantId, connectorId) as Array<{ key: string }>;
      return rows.map(r => r.key);
    },
  };
}
