import Database from 'better-sqlite3';
import { z } from 'zod';
import path from 'path';
import fs from 'fs';

/**
 * Manifest status lifecycle
 */
export type ManifestStatus = 'registered' | 'approved' | 'authorized' | 'deployed' | 'rejected';

/**
 * Manifest record schema
 */
export const ManifestRecordSchema = z.object({
  manifestId: z.string(),
  workspaceId: z.string(),
  processId: z.string(),
  processVersion: z.string(),
  planHash: z.string(),
  status: z.enum(['registered', 'approved', 'authorized', 'deployed', 'rejected']),
  tenantScope: z.string().optional(),
  registeredBy: z.string(),
  registeredAt: z.string(),
  approvedBy: z.string().optional(),
  approvedAt: z.string().optional(),
  authorizedAt: z.string().optional(),
  deployedAt: z.string().optional(),
  expiresAt: z.string().optional(),
  metadata: z.record(z.any()).optional(),
});

export type ManifestRecord = z.infer<typeof ManifestRecordSchema>;

/**
 * Manifest registry for tracking process deployments
 * Provides release authorization and lifecycle management
 */
export class ManifestRegistry {
  private db: Database.Database;

  constructor(dbPath: string) {
    // Ensure directory exists
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    this.db = new Database(dbPath);
    this.initializeSchema();
  }

  private initializeSchema(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS manifests (
        manifest_id TEXT PRIMARY KEY,
        workspace_id TEXT NOT NULL,
        process_id TEXT NOT NULL,
        process_version TEXT NOT NULL,
        plan_hash TEXT NOT NULL,
        status TEXT NOT NULL,
        tenant_scope TEXT,
        registered_by TEXT NOT NULL,
        registered_at TEXT NOT NULL,
        approved_by TEXT,
        approved_at TEXT,
        authorized_at TEXT,
        deployed_at TEXT,
        expires_at TEXT,
        metadata_json TEXT,
        created_at INTEGER NOT NULL DEFAULT (unixepoch())
      );

      CREATE INDEX IF NOT EXISTS idx_manifest_workspace ON manifests(workspace_id);
      CREATE INDEX IF NOT EXISTS idx_manifest_process ON manifests(process_id);
      CREATE INDEX IF NOT EXISTS idx_manifest_status ON manifests(status);
      CREATE INDEX IF NOT EXISTS idx_manifest_hash ON manifests(plan_hash);
    `);
  }

  /**
   * Register new manifest (preflight)
   */
  register(manifest: Omit<ManifestRecord, 'manifestId'>): ManifestRecord {
    const manifestId = this.generateManifestId();
    const registeredAt = new Date().toISOString();

    const stmt = this.db.prepare(`
      INSERT INTO manifests (
        manifest_id, workspace_id, process_id, process_version, plan_hash,
        status, tenant_scope, registered_by, registered_at, metadata_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      manifestId,
      manifest.workspaceId,
      manifest.processId,
      manifest.processVersion,
      manifest.planHash,
      'registered',
      manifest.tenantScope || null,
      manifest.registeredBy,
      registeredAt,
      manifest.metadata ? JSON.stringify(manifest.metadata) : null
    );

    return {
      manifestId,
      ...manifest,
      status: 'registered',
      registeredAt,
    };
  }

  /**
   * Update manifest status with authorization details
   */
  updateStatus(
    manifestId: string,
    status: ManifestStatus,
    options?: {
      approvedBy?: string;
      expiresAt?: string;
    }
  ): boolean {
    const now = new Date().toISOString();
    let query = 'UPDATE manifests SET status = ?';
    const params: any[] = [status];

    if (status === 'approved' && options?.approvedBy) {
      query += ', approved_by = ?, approved_at = ?';
      params.push(options.approvedBy, now);
    }

    if (status === 'authorized') {
      query += ', authorized_at = ?';
      params.push(now);
      if (options?.expiresAt) {
        query += ', expires_at = ?';
        params.push(options.expiresAt);
      }
    }

    if (status === 'deployed') {
      query += ', deployed_at = ?';
      params.push(now);
    }

    query += ' WHERE manifest_id = ?';
    params.push(manifestId);

    const stmt = this.db.prepare(query);
    const result = stmt.run(...params);
    return result.changes > 0;
  }

  /**
   * Get manifest by ID
   */
  get(manifestId: string): ManifestRecord | null {
    const stmt = this.db.prepare('SELECT * FROM manifests WHERE manifest_id = ?');
    const row = stmt.get(manifestId) as any;

    if (!row) return null;

    return this.rowToRecord(row);
  }

  /**
   * Find manifest by planHash and workspace
   */
  findByPlanHash(planHash: string, workspaceId?: string): ManifestRecord | null {
    let query = 'SELECT * FROM manifests WHERE plan_hash = ?';
    const params: any[] = [planHash];

    if (workspaceId) {
      query += ' AND workspace_id = ?';
      params.push(workspaceId);
    }

    query += ' ORDER BY registered_at DESC LIMIT 1';

    const stmt = this.db.prepare(query);
    const row = stmt.get(...params) as any;

    if (!row) return null;

    return this.rowToRecord(row);
  }

  /**
   * List manifests with filtering
   */
  list(options: {
    workspaceId?: string;
    processId?: string;
    status?: ManifestStatus;
    limit?: number;
    offset?: number;
  }): ManifestRecord[] {
    let query = 'SELECT * FROM manifests WHERE 1=1';
    const params: any[] = [];

    if (options.workspaceId) {
      query += ' AND workspace_id = ?';
      params.push(options.workspaceId);
    }

    if (options.processId) {
      query += ' AND process_id = ?';
      params.push(options.processId);
    }

    if (options.status) {
      query += ' AND status = ?';
      params.push(options.status);
    }

    query += ' ORDER BY registered_at DESC';

    if (options.limit) {
      query += ' LIMIT ?';
      params.push(options.limit);
    }

    if (options.offset) {
      query += ' OFFSET ?';
      params.push(options.offset);
    }

    const stmt = this.db.prepare(query);
    const rows = stmt.all(...params) as any[];

    return rows.map(this.rowToRecord);
  }

  private rowToRecord(row: any): ManifestRecord {
    return {
      manifestId: row.manifest_id,
      workspaceId: row.workspace_id,
      processId: row.process_id,
      processVersion: row.process_version,
      planHash: row.plan_hash,
      status: row.status,
      tenantScope: row.tenant_scope,
      registeredBy: row.registered_by,
      registeredAt: row.registered_at,
      approvedBy: row.approved_by,
      approvedAt: row.approved_at,
      authorizedAt: row.authorized_at,
      deployedAt: row.deployed_at,
      expiresAt: row.expires_at,
      metadata: row.metadata_json ? JSON.parse(row.metadata_json) : undefined,
    };
  }

  private generateManifestId(): string {
    return `mfst_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
  }

  close(): void {
    this.db.close();
  }
}
