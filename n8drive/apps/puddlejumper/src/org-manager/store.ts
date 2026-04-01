import crypto from 'node:crypto';
import type Database from 'better-sqlite3';
import type { OrgPosition, OrgDelegation, OrgImportJob } from './types.js';

// ── Row types from SQLite ────────────────────────────────────────────────────

interface PositionRow {
  id: string;
  tenant_id: string;
  employee_id: string;
  full_name: string;
  title: string;
  department: string;
  supervisor_id: string | null;
  email: string;
  employment_status: OrgPosition['employmentStatus'];
  authority_level: number;
  acting_for_position_id: string | null;
  separation_date: string | null;
  created_at: string;
  updated_at: string;
}

interface DelegationRow {
  id: string;
  tenant_id: string;
  delegator_id: string;
  delegatee_id: string;
  scope: string;
  start_date: string;
  end_date: string | null;
  revoked_at: string | null;
  reason: string;
  created_by: string;
  created_at: string;
}

interface ImportJobRow {
  id: string;
  tenant_id: string;
  status: OrgImportJob['status'];
  row_count: number;
  valid_count: number;
  error_count: number;
  errors: string; // JSON
  created_by: string;
  created_at: string;
  published_at: string | null;
}

// ── Mappers ──────────────────────────────────────────────────────────────────

function rowToPosition(row: PositionRow): OrgPosition {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    employeeId: row.employee_id,
    fullName: row.full_name,
    title: row.title,
    department: row.department,
    supervisorId: row.supervisor_id,
    email: row.email,
    employmentStatus: row.employment_status,
    authorityLevel: row.authority_level,
    actingForPositionId: row.acting_for_position_id,
    separationDate: row.separation_date,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function rowToDelegation(row: DelegationRow): OrgDelegation {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    delegatorId: row.delegator_id,
    delegateeId: row.delegatee_id,
    scope: row.scope,
    startDate: row.start_date,
    endDate: row.end_date,
    revokedAt: row.revoked_at,
    reason: row.reason,
    createdBy: row.created_by,
    createdAt: row.created_at,
  };
}

function rowToImportJob(row: ImportJobRow): OrgImportJob {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    status: row.status,
    rowCount: row.row_count,
    validCount: row.valid_count,
    errorCount: row.error_count,
    errors: JSON.parse(row.errors || '[]'),
    createdBy: row.created_by,
    createdAt: row.created_at,
    publishedAt: row.published_at,
  };
}

// ── Schema init ──────────────────────────────────────────────────────────────

export function initOrgStore(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS org_positions (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL,
      employee_id TEXT NOT NULL,
      full_name TEXT NOT NULL,
      title TEXT NOT NULL,
      department TEXT NOT NULL,
      supervisor_id TEXT,
      email TEXT NOT NULL,
      employment_status TEXT NOT NULL DEFAULT 'active',
      authority_level INTEGER NOT NULL DEFAULT 1,
      acting_for_position_id TEXT,
      separation_date TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(tenant_id, employee_id)
    );
    CREATE INDEX IF NOT EXISTS idx_org_pos_tenant ON org_positions(tenant_id);
    CREATE INDEX IF NOT EXISTS idx_org_pos_supervisor ON org_positions(tenant_id, supervisor_id);
    CREATE INDEX IF NOT EXISTS idx_org_pos_dept ON org_positions(tenant_id, department);
    CREATE INDEX IF NOT EXISTS idx_org_pos_status ON org_positions(tenant_id, employment_status);

    CREATE TABLE IF NOT EXISTS org_delegations (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL,
      delegator_id TEXT NOT NULL,
      delegatee_id TEXT NOT NULL,
      scope TEXT NOT NULL,
      start_date TEXT NOT NULL,
      end_date TEXT,
      revoked_at TEXT,
      reason TEXT NOT NULL,
      created_by TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_org_del_tenant ON org_delegations(tenant_id);
    CREATE INDEX IF NOT EXISTS idx_org_del_delegator ON org_delegations(tenant_id, delegator_id);

    CREATE TABLE IF NOT EXISTS org_import_jobs (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      row_count INTEGER NOT NULL DEFAULT 0,
      valid_count INTEGER NOT NULL DEFAULT 0,
      error_count INTEGER NOT NULL DEFAULT 0,
      errors TEXT NOT NULL DEFAULT '[]',
      created_by TEXT NOT NULL,
      created_at TEXT NOT NULL,
      published_at TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_org_import_tenant ON org_import_jobs(tenant_id);
  `);
}

// ── Positions ────────────────────────────────────────────────────────────────

export function upsertPosition(
  db: Database.Database,
  tenantId: string,
  data: Omit<OrgPosition, 'id' | 'tenantId' | 'createdAt' | 'updatedAt'> & { id?: string }
): OrgPosition {
  const now = new Date().toISOString();

  // Check if existing by employeeId
  const existing = db
    .prepare(`SELECT id, created_at FROM org_positions WHERE tenant_id = ? AND employee_id = ?`)
    .get(tenantId, data.employeeId) as { id: string; created_at: string } | undefined;

  const id = existing?.id ?? data.id ?? crypto.randomUUID();
  const createdAt = existing?.created_at ?? now;

  db.prepare(`
    INSERT INTO org_positions (
      id, tenant_id, employee_id, full_name, title, department,
      supervisor_id, email, employment_status, authority_level,
      acting_for_position_id, separation_date, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(tenant_id, employee_id) DO UPDATE SET
      full_name = excluded.full_name,
      title = excluded.title,
      department = excluded.department,
      supervisor_id = excluded.supervisor_id,
      email = excluded.email,
      employment_status = excluded.employment_status,
      authority_level = excluded.authority_level,
      acting_for_position_id = excluded.acting_for_position_id,
      separation_date = excluded.separation_date,
      updated_at = excluded.updated_at
  `).run(
    id, tenantId, data.employeeId, data.fullName, data.title, data.department,
    data.supervisorId ?? null, data.email, data.employmentStatus, data.authorityLevel ?? 1,
    data.actingForPositionId ?? null, data.separationDate ?? null, createdAt, now
  );

  return rowToPosition(
    db.prepare(`SELECT * FROM org_positions WHERE id = ?`).get(id) as PositionRow
  );
}

export function getPosition(db: Database.Database, tenantId: string, id: string): OrgPosition | null {
  const row = db
    .prepare(`SELECT * FROM org_positions WHERE id = ? AND tenant_id = ?`)
    .get(id, tenantId) as PositionRow | undefined;
  return row ? rowToPosition(row) : null;
}

export function listPositions(
  db: Database.Database,
  tenantId: string,
  filters?: { department?: string; status?: string }
): OrgPosition[] {
  let sql = `SELECT * FROM org_positions WHERE tenant_id = ?`;
  const params: string[] = [tenantId];

  if (filters?.department) {
    sql += ` AND department = ?`;
    params.push(filters.department);
  }
  if (filters?.status) {
    sql += ` AND employment_status = ?`;
    params.push(filters.status);
  }

  sql += ` ORDER BY full_name ASC`;
  return (db.prepare(sql).all(...params) as PositionRow[]).map(rowToPosition);
}

export function getAuthChain(
  db: Database.Database,
  tenantId: string,
  positionId: string
): OrgPosition[] {
  const chain: OrgPosition[] = [];
  const visited = new Set<string>();
  let currentId: string | null = positionId;

  while (currentId && !visited.has(currentId)) {
    visited.add(currentId);
    const row = db
      .prepare(`SELECT * FROM org_positions WHERE id = ? AND tenant_id = ?`)
      .get(currentId, tenantId) as PositionRow | undefined;

    if (!row) break;
    chain.push(rowToPosition(row));
    currentId = row.supervisor_id;
  }

  return chain;
}

// ── Import Jobs ──────────────────────────────────────────────────────────────

export function createImportJob(
  db: Database.Database,
  tenantId: string,
  createdBy: string
): OrgImportJob {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO org_import_jobs (id, tenant_id, status, row_count, valid_count, error_count, errors, created_by, created_at)
    VALUES (?, ?, 'pending', 0, 0, 0, '[]', ?, ?)
  `).run(id, tenantId, createdBy, now);

  return rowToImportJob(
    db.prepare(`SELECT * FROM org_import_jobs WHERE id = ?`).get(id) as ImportJobRow
  );
}

export function updateImportJob(
  db: Database.Database,
  id: string,
  patch: Partial<Pick<OrgImportJob, 'status' | 'rowCount' | 'validCount' | 'errorCount' | 'errors' | 'publishedAt'>>
): void {
  const sets: string[] = [];
  const params: (string | number)[] = [];

  if (patch.status !== undefined) { sets.push('status = ?'); params.push(patch.status); }
  if (patch.rowCount !== undefined) { sets.push('row_count = ?'); params.push(patch.rowCount); }
  if (patch.validCount !== undefined) { sets.push('valid_count = ?'); params.push(patch.validCount); }
  if (patch.errorCount !== undefined) { sets.push('error_count = ?'); params.push(patch.errorCount); }
  if (patch.errors !== undefined) { sets.push('errors = ?'); params.push(JSON.stringify(patch.errors)); }
  if (patch.publishedAt !== undefined) { sets.push('published_at = ?'); params.push(patch.publishedAt ?? ''); }

  if (sets.length === 0) return;
  params.push(id);
  db.prepare(`UPDATE org_import_jobs SET ${sets.join(', ')} WHERE id = ?`).run(...params);
}

export function getImportJob(
  db: Database.Database,
  id: string,
  tenantId: string
): OrgImportJob | null {
  const row = db
    .prepare(`SELECT * FROM org_import_jobs WHERE id = ? AND tenant_id = ?`)
    .get(id, tenantId) as ImportJobRow | undefined;
  return row ? rowToImportJob(row) : null;
}

export function publishImportJob(
  db: Database.Database,
  tenantId: string,
  jobId: string,
  positions: Array<Omit<OrgPosition, 'id' | 'tenantId' | 'createdAt' | 'updatedAt'>>
): number {
  const publishFn = db.transaction(() => {
    let upserted = 0;
    for (const pos of positions) {
      upsertPosition(db, tenantId, pos);
      upserted++;
    }
    updateImportJob(db, jobId, {
      status: 'published',
      publishedAt: new Date().toISOString(),
    });
    return upserted;
  });

  return publishFn() as number;
}

// ── Delegations ──────────────────────────────────────────────────────────────

export function createDelegation(
  db: Database.Database,
  tenantId: string,
  data: Omit<OrgDelegation, 'id' | 'tenantId' | 'createdAt' | 'revokedAt'>
): OrgDelegation {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO org_delegations (
      id, tenant_id, delegator_id, delegatee_id, scope,
      start_date, end_date, revoked_at, reason, created_by, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, ?)
  `).run(
    id, tenantId, data.delegatorId, data.delegateeId, data.scope,
    data.startDate, data.endDate ?? null, data.reason, data.createdBy, now
  );

  return rowToDelegation(
    db.prepare(`SELECT * FROM org_delegations WHERE id = ?`).get(id) as DelegationRow
  );
}

export function listDelegations(
  db: Database.Database,
  tenantId: string,
  opts?: { activeOnly?: boolean }
): OrgDelegation[] {
  let sql = `SELECT * FROM org_delegations WHERE tenant_id = ?`;
  const params: string[] = [tenantId];

  if (opts?.activeOnly !== false) {
    // Default: active only — not revoked, and either no end date or end date in the future
    sql += ` AND revoked_at IS NULL AND (end_date IS NULL OR end_date > datetime('now'))`;
  }

  sql += ` ORDER BY created_at DESC`;
  return (db.prepare(sql).all(...params) as DelegationRow[]).map(rowToDelegation);
}

export function revokeDelegation(
  db: Database.Database,
  tenantId: string,
  id: string,
  _revokedBy: string
): boolean {
  const now = new Date().toISOString();
  const result = db
    .prepare(`UPDATE org_delegations SET revoked_at = ? WHERE id = ? AND tenant_id = ? AND revoked_at IS NULL`)
    .run(now, id, tenantId);
  return result.changes > 0;
}
