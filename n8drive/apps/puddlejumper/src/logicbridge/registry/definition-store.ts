import crypto from 'node:crypto';
import type Database from 'better-sqlite3';
import type { ConnectorDefinition, ConnectorStatus } from '../types.js';
import { encryptHandler as _encryptHandler } from '../handler/encryptor.js';

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS logicbridge_definitions (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    name TEXT NOT NULL,
    version TEXT NOT NULL DEFAULT '1.0.0',
    status TEXT NOT NULL DEFAULT 'draft',
    handler_encrypted TEXT,
    handler_hash TEXT,
    seal_token TEXT,
    capabilities TEXT,
    data_types TEXT,
    allowed_profiles TEXT,
    sample_payload TEXT,
    sim_result TEXT,
    residency_attestation TEXT,
    metadata TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    superseded_by TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_lb_def_tenant ON logicbridge_definitions(tenant_id);
  CREATE INDEX IF NOT EXISTS idx_lb_def_status ON logicbridge_definitions(status);
`;

let _db: Database.Database | null = null;

export function initDefinitionStore(db: Database.Database): void {
  _db = db;
  db.exec(SCHEMA);
}

function getDb(): Database.Database {
  if (!_db) throw new Error('LogicBridge definition store not initialized');
  return _db;
}

function rowToDefinition(row: Record<string, unknown>): ConnectorDefinition {
  return {
    id: row.id as string,
    tenantId: row.tenant_id as string,
    name: row.name as string,
    version: row.version as string,
    status: row.status as ConnectorStatus,
    handlerEncrypted: (row.handler_encrypted as string | null) ?? null,
    handlerHash: (row.handler_hash as string | null) ?? null,
    sealToken: row.seal_token ? JSON.parse(row.seal_token as string) : null,
    capabilities: row.capabilities ? JSON.parse(row.capabilities as string) : [],
    dataTypes: row.data_types ? JSON.parse(row.data_types as string) : [],
    allowedProfiles: row.allowed_profiles ? JSON.parse(row.allowed_profiles as string) : [],
    samplePayload: row.sample_payload ? JSON.parse(row.sample_payload as string) : null,
    simResult: row.sim_result ? JSON.parse(row.sim_result as string) : null,
    residencyAttestation: (row.residency_attestation as string | null) ?? null,
    metadata: row.metadata ? JSON.parse(row.metadata as string) : {},
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
    supersededBy: (row.superseded_by as string | null) ?? null,
  };
}

export function createDefinition(
  tenantId: string,
  input: {
    name: string;
    version?: string;
    capabilities?: string[];
    dataTypes?: string[];
    allowedProfiles?: string[];
    metadata?: Record<string, unknown>;
    handlerSource?: string;
    samplePayload?: Record<string, unknown> | string;
    residencyAttestation?: string;
  }
): ConnectorDefinition {
  const db = getDb();
  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  let handlerEncrypted: string | null = null;
  let handlerHash: string | null = null;

  if (input.handlerSource) {
    const result = _encryptHandler(input.handlerSource);
    handlerEncrypted = result.ciphertext;
    handlerHash = result.handlerHash;
  }

  // samplePayload may be a JSON string from the frontend or an object
  let samplePayloadStr: string | null = null;
  if (input.samplePayload) {
    samplePayloadStr = typeof input.samplePayload === 'string' ? input.samplePayload : JSON.stringify(input.samplePayload);
  }

  db.prepare(`
    INSERT INTO logicbridge_definitions
    (id, tenant_id, name, version, status, handler_encrypted, handler_hash, seal_token,
     capabilities, data_types, allowed_profiles, sample_payload, sim_result,
     residency_attestation, metadata, created_at, updated_at, superseded_by)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  `).run(
    id, tenantId, input.name, input.version ?? '1.0.0', 'draft',
    handlerEncrypted, handlerHash, null,
    JSON.stringify(input.capabilities ?? []),
    JSON.stringify(input.dataTypes ?? []),
    JSON.stringify(input.allowedProfiles ?? []),
    samplePayloadStr,
    null,
    input.residencyAttestation ?? null,
    JSON.stringify(input.metadata ?? {}),
    now, now, null
  );

  return getDefinitionById(id)!;
}

export function getDefinitionById(id: string): ConnectorDefinition | null {
  const db = getDb();
  const row = db.prepare('SELECT * FROM logicbridge_definitions WHERE id=?').get(id);
  return row ? rowToDefinition(row as Record<string, unknown>) : null;
}

export function listDefinitions(tenantId: string, status?: ConnectorStatus): ConnectorDefinition[] {
  const db = getDb();
  const rows = status
    ? db.prepare('SELECT * FROM logicbridge_definitions WHERE tenant_id=? AND status=? ORDER BY created_at DESC').all(tenantId, status)
    : db.prepare('SELECT * FROM logicbridge_definitions WHERE tenant_id=? ORDER BY created_at DESC').all(tenantId);
  return (rows as Record<string, unknown>[]).map(rowToDefinition);
}

export function listAllPublished(): ConnectorDefinition[] {
  const db = getDb();
  const rows = db.prepare("SELECT * FROM logicbridge_definitions WHERE status='published'").all();
  return (rows as Record<string, unknown>[]).map(rowToDefinition);
}

export function updateDefinition(
  id: string,
  updates: Partial<Pick<ConnectorDefinition, 'status' | 'simResult' | 'sealToken' | 'handlerHash' | 'handlerEncrypted' | 'capabilities' | 'allowedProfiles' | 'supersededBy'>> & {
    handlerSource?: string;
    name?: string;
    dataTypes?: string[];
    samplePayload?: string;
    metadata?: Record<string, unknown>;
  }
): ConnectorDefinition | null {
  const db = getDb();
  const existing = getDefinitionById(id);
  if (!existing) return null;

  const now = new Date().toISOString();

  let handlerEncrypted = existing.handlerEncrypted;
  let handlerHash = existing.handlerHash;

  if (updates.handlerSource) {
    const result = _encryptHandler(updates.handlerSource);
    handlerEncrypted = result.ciphertext;
    handlerHash = result.handlerHash;
  } else if (updates.handlerEncrypted !== undefined) {
    handlerEncrypted = updates.handlerEncrypted;
  }
  if (updates.handlerHash !== undefined) handlerHash = updates.handlerHash;

  const name = updates.name ?? existing.name;
  const capabilities = updates.capabilities ? JSON.stringify(updates.capabilities) : JSON.stringify(existing.capabilities);
  const allowedProfiles = updates.allowedProfiles ? JSON.stringify(updates.allowedProfiles) : JSON.stringify(existing.allowedProfiles);
  const dataTypes = updates.dataTypes ? JSON.stringify(updates.dataTypes) : JSON.stringify(existing.dataTypes);
  const samplePayload = updates.samplePayload !== undefined
    ? (updates.samplePayload ? updates.samplePayload : null)
    : (existing.samplePayload ? JSON.stringify(existing.samplePayload) : null);
  const metadata = updates.metadata !== undefined
    ? JSON.stringify(updates.metadata)
    : (existing.metadata ? JSON.stringify(existing.metadata) : JSON.stringify({}));

  db.prepare(`
    UPDATE logicbridge_definitions SET
      name=?, status=?, handler_encrypted=?, handler_hash=?, seal_token=?,
      sim_result=?, capabilities=?, data_types=?, allowed_profiles=?, sample_payload=?,
      metadata=?, superseded_by=?, updated_at=?
    WHERE id=?
  `).run(
    name,
    updates.status ?? existing.status,
    handlerEncrypted,
    handlerHash,
    updates.sealToken ? JSON.stringify(updates.sealToken) : existing.sealToken ? JSON.stringify(existing.sealToken) : null,
    updates.simResult ? JSON.stringify(updates.simResult) : existing.simResult ? JSON.stringify(existing.simResult) : null,
    capabilities,
    dataTypes,
    allowedProfiles,
    samplePayload,
    metadata,
    updates.supersededBy ?? existing.supersededBy,
    now,
    id
  );

  return getDefinitionById(id);
}

export function countByStatus(tenantId?: string): Record<ConnectorStatus, number> {
  const db = getDb();
  const rows = tenantId
    ? db.prepare('SELECT status, COUNT(*) as cnt FROM logicbridge_definitions WHERE tenant_id=? GROUP BY status').all(tenantId)
    : db.prepare('SELECT status, COUNT(*) as cnt FROM logicbridge_definitions GROUP BY status').all();

  const counts = {} as Record<ConnectorStatus, number>;
  for (const row of rows as Array<{ status: string; cnt: number }>) {
    counts[row.status as ConnectorStatus] = row.cnt;
  }
  return counts;
}
