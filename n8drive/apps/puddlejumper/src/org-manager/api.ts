import express from 'express';
import type { Router, Request, Response } from 'express';
import type Database from 'better-sqlite3';
import { getAuthContext, createJwtAuthenticationMiddleware } from '@publiclogic/core';
import { archieveLog } from '../archieve/index.js';
import {
  listPositions,
  getPosition,
  upsertPosition,
  getAuthChain,
  createImportJob,
  updateImportJob,
  getImportJob,
  publishImportJob,
  createDelegation,
  listDelegations,
  revokeDelegation,
} from './store.js';
import type { OrgPosition } from './types.js';

// ── Helpers ──────────────────────────────────────────────────────────────────

function resolveTenantId(req: Request): string | null {
  const auth = getAuthContext(req);
  const role = auth?.role;
  if (role === 'admin' || role === 'platform-admin') {
    return (req.query.tenantId as string) || auth?.tenantId || null;
  }
  return auth?.tenantId || null;
}

function actor(req: Request) {
  const auth = getAuthContext(req);
  return {
    userId: auth?.userId || auth?.sub || 'system',
    role: auth?.role || 'unknown',
    sessionId: auth?.sessionId || (req.headers['x-request-id'] as string) || 'none',
    ip: req.ip,
  };
}

// ── Validation ───────────────────────────────────────────────────────────────

const VALID_STATUSES = new Set(['active', 'inactive', 'vacant', 'acting', 'interim']);
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface ImportRow {
  row: number;
  employeeId?: unknown;
  fullName?: unknown;
  title?: unknown;
  department?: unknown;
  email?: unknown;
  employmentStatus?: unknown;
  supervisorId?: unknown;
  authorityLevel?: unknown;
  actingForPositionId?: unknown;
  [key: string]: unknown;
}

interface ImportError {
  row: number;
  field: string;
  message: string;
}

function validateImportRows(rows: ImportRow[], totalCount: number): {
  errors: ImportError[];
  valid: ImportRow[];
} {
  const errors: ImportError[] = [];
  const valid: ImportRow[] = [];

  for (const row of rows) {
    const rowNum = row.row ?? rows.indexOf(row) + 1;
    let rowErrors = 0;

    if (!row.employeeId || typeof row.employeeId !== 'string') {
      errors.push({ row: rowNum, field: 'employeeId', message: 'employeeId is required' });
      rowErrors++;
    }
    if (!row.fullName || typeof row.fullName !== 'string') {
      errors.push({ row: rowNum, field: 'fullName', message: 'fullName is required' });
      rowErrors++;
    }
    if (!row.title || typeof row.title !== 'string') {
      errors.push({ row: rowNum, field: 'title', message: 'title is required' });
      rowErrors++;
    }
    if (!row.department || typeof row.department !== 'string') {
      errors.push({ row: rowNum, field: 'department', message: 'department is required' });
      rowErrors++;
    }
    if (!row.email || typeof row.email !== 'string' || !EMAIL_RE.test(row.email as string)) {
      errors.push({ row: rowNum, field: 'email', message: 'email is required and must be a valid email address' });
      rowErrors++;
    }
    if (!row.employmentStatus || !VALID_STATUSES.has(row.employmentStatus as string)) {
      errors.push({ row: rowNum, field: 'employmentStatus', message: `employmentStatus must be one of: active, inactive, vacant, acting, interim` });
      rowErrors++;
    }

    // supervisorId required unless single row or vacant
    if (
      !row.supervisorId &&
      totalCount > 1 &&
      row.employmentStatus !== 'vacant'
    ) {
      errors.push({ row: rowNum, field: 'supervisorId', message: 'supervisorId is required (unless vacant or only row in import)' });
      rowErrors++;
    }

    // authorityLevel must be 1-5 if present
    if (row.authorityLevel !== undefined && row.authorityLevel !== null && row.authorityLevel !== '') {
      const level = Number(row.authorityLevel);
      if (!Number.isInteger(level) || level < 1 || level > 5) {
        errors.push({ row: rowNum, field: 'authorityLevel', message: 'authorityLevel must be an integer between 1 and 5' });
        rowErrors++;
      }
    }

    // actingForPositionId required if acting or interim
    if (
      (row.employmentStatus === 'acting' || row.employmentStatus === 'interim') &&
      !row.actingForPositionId
    ) {
      errors.push({ row: rowNum, field: 'actingForPositionId', message: 'actingForPositionId is required when employmentStatus is acting or interim' });
      rowErrors++;
    }

    if (rowErrors === 0) {
      valid.push(row);
    }
  }

  return { errors, valid };
}

// ── Router ───────────────────────────────────────────────────────────────────

export function createOrgManagerRouter(db: Database.Database): Router {
  const router = express.Router();
  const authMiddleware = createJwtAuthenticationMiddleware();
  router.use(authMiddleware);

  // ── Positions ──────────────────────────────────────────────────────────────

  // GET /org/chart — flat list for all positions
  router.get('/chart', (req: Request, res: Response) => {
    const tenantId = resolveTenantId(req);
    if (!tenantId) { res.status(403).json({ errors: ['Tenant not resolvable'] }); return; }

    const { department, status } = req.query as Record<string, string>;
    const positions = listPositions(db, tenantId, { department, status });

    res.json({ data: positions, meta: { count: positions.length } });
  });

  // POST /org/positions — create or update a position
  router.post('/positions', (req: Request, res: Response) => {
    const tenantId = resolveTenantId(req);
    if (!tenantId) { res.status(403).json({ errors: ['Tenant not resolvable'] }); return; }

    const body = req.body as Partial<OrgPosition>;
    const missing: string[] = [];
    if (!body.employeeId) missing.push('employeeId');
    if (!body.fullName) missing.push('fullName');
    if (!body.title) missing.push('title');
    if (!body.department) missing.push('department');
    if (!body.email) missing.push('email');
    if (!body.employmentStatus) missing.push('employmentStatus');

    if (missing.length > 0) {
      res.status(400).json({ errors: [`Missing required fields: ${missing.join(', ')}`] });
      return;
    }

    try {
      const position = upsertPosition(db, tenantId, {
        employeeId: body.employeeId!,
        fullName: body.fullName!,
        title: body.title!,
        department: body.department!,
        supervisorId: body.supervisorId ?? null,
        email: body.email!,
        employmentStatus: body.employmentStatus!,
        authorityLevel: body.authorityLevel ?? 1,
        actingForPositionId: body.actingForPositionId ?? null,
        separationDate: body.separationDate ?? null,
      });

      const act = actor(req);
      archieveLog({
        requestId: req.headers['x-request-id'] as string || crypto.randomUUID(),
        tenantId,
        module: 'org-manager',
        eventType: 'ORG_POSITION_UPSERTED',
        actor: act,
        severity: 'info',
        data: { positionId: position.id, employeeId: position.employeeId },
      });

      res.status(201).json({ data: position });
    } catch (err) {
      res.status(500).json({ errors: [(err as Error).message] });
    }
  });

  // GET /org/positions/:id — get position with auth chain
  router.get('/positions/:id', (req: Request, res: Response) => {
    const tenantId = resolveTenantId(req);
    if (!tenantId) { res.status(403).json({ errors: ['Tenant not resolvable'] }); return; }

    const position = getPosition(db, tenantId, req.params.id);
    if (!position) { res.status(404).json({ errors: ['Position not found'] }); return; }

    const chain = getAuthChain(db, tenantId, position.id);
    res.json({ data: position, meta: { authChain: chain } });
  });

  // GET /org/chain/:positionId — full authority chain
  router.get('/chain/:positionId', (req: Request, res: Response) => {
    const tenantId = resolveTenantId(req);
    if (!tenantId) { res.status(403).json({ errors: ['Tenant not resolvable'] }); return; }

    const chain = getAuthChain(db, tenantId, req.params.positionId);
    if (chain.length === 0) { res.status(404).json({ errors: ['Position not found'] }); return; }

    res.json({ data: chain, meta: { length: chain.length } });
  });

  // ── Import ─────────────────────────────────────────────────────────────────

  // POST /org/import — validate rows, create job, return errors
  router.post('/import', (req: Request, res: Response) => {
    const tenantId = resolveTenantId(req);
    if (!tenantId) { res.status(403).json({ errors: ['Tenant not resolvable'] }); return; }

    const { rows } = req.body as { rows?: unknown[] };
    if (!Array.isArray(rows) || rows.length === 0) {
      res.status(400).json({ errors: ['Body must include a non-empty rows array'] });
      return;
    }

    const act = actor(req);
    const job = createImportJob(db, tenantId, act.userId);

    // Tag each row with its index for error reporting
    const taggedRows = (rows as Record<string, unknown>[]).map((r, i) => ({ ...r, row: i + 1 })) as ImportRow[];

    updateImportJob(db, job.id, { status: 'processing', rowCount: rows.length });

    const { errors, valid } = validateImportRows(taggedRows, rows.length);
    const status = errors.length === 0 ? 'validated' : (valid.length > 0 ? 'validated' : 'failed');

    updateImportJob(db, job.id, {
      status,
      rowCount: rows.length,
      validCount: valid.length,
      errorCount: errors.length,
      errors,
    });

    archieveLog({
      requestId: req.headers['x-request-id'] as string || crypto.randomUUID(),
      tenantId,
      module: 'org-manager',
      eventType: 'ORG_IMPORT_VALIDATED',
      actor: act,
      severity: errors.length > 0 ? 'warn' : 'info',
      data: { jobId: job.id, rowCount: rows.length, validCount: valid.length, errorCount: errors.length },
    });

    const updatedJob = getImportJob(db, job.id, tenantId);
    res.status(201).json({ data: updatedJob });
  });

  // GET /org/import/:id — get job status and errors
  router.get('/import/:id', (req: Request, res: Response) => {
    const tenantId = resolveTenantId(req);
    if (!tenantId) { res.status(403).json({ errors: ['Tenant not resolvable'] }); return; }

    const job = getImportJob(db, req.params.id, tenantId);
    if (!job) { res.status(404).json({ errors: ['Import job not found'] }); return; }

    res.json({
      data: job,
      meta: {
        discrepancyReport: {
          totalRows: job.rowCount,
          validRows: job.validCount,
          errorRows: job.errorCount,
          errors: job.errors,
        },
      },
    });
  });

  // POST /org/import/:id/publish — publish validated import
  router.post('/import/:id/publish', (req: Request, res: Response) => {
    const tenantId = resolveTenantId(req);
    if (!tenantId) { res.status(403).json({ errors: ['Tenant not resolvable'] }); return; }

    const job = getImportJob(db, req.params.id, tenantId);
    if (!job) { res.status(404).json({ errors: ['Import job not found'] }); return; }
    if (job.status !== 'validated') {
      res.status(409).json({ errors: [`Import job must be in 'validated' state to publish (current: ${job.status})`] });
      return;
    }

    // Re-read original rows from request body (caller re-sends) or use the job's row count
    // Caller must re-POST the rows to publish
    const { rows } = req.body as { rows?: unknown[] };
    if (!Array.isArray(rows) || rows.length === 0) {
      res.status(400).json({ errors: ['Body must include the rows array to publish'] });
      return;
    }

    const positions = (rows as Record<string, unknown>[]).map(r => ({
      employeeId: r.employeeId as string,
      fullName: r.fullName as string,
      title: r.title as string,
      department: r.department as string,
      supervisorId: (r.supervisorId as string) || null,
      email: r.email as string,
      employmentStatus: r.employmentStatus as OrgPosition['employmentStatus'],
      authorityLevel: r.authorityLevel ? Number(r.authorityLevel) : 1,
      actingForPositionId: (r.actingForPositionId as string) || null,
      separationDate: (r.separationDate as string) || null,
    }));

    try {
      const count = publishImportJob(db, tenantId, job.id, positions);
      const act = actor(req);

      archieveLog({
        requestId: req.headers['x-request-id'] as string || crypto.randomUUID(),
        tenantId,
        module: 'org-manager',
        eventType: 'ORG_IMPORT_PUBLISHED',
        actor: act,
        severity: 'info',
        data: { jobId: job.id, upsertedCount: count },
      });

      res.json({ data: { jobId: job.id, upsertedCount: count } });
    } catch (err) {
      res.status(500).json({ errors: [(err as Error).message] });
    }
  });

  // ── Delegations ────────────────────────────────────────────────────────────

  // GET /org/delegations — list active delegations
  router.get('/delegations', (req: Request, res: Response) => {
    const tenantId = resolveTenantId(req);
    if (!tenantId) { res.status(403).json({ errors: ['Tenant not resolvable'] }); return; }

    const delegations = listDelegations(db, tenantId);
    res.json({ data: delegations, meta: { count: delegations.length } });
  });

  // POST /org/delegations — create delegation
  router.post('/delegations', (req: Request, res: Response) => {
    const tenantId = resolveTenantId(req);
    if (!tenantId) { res.status(403).json({ errors: ['Tenant not resolvable'] }); return; }

    const body = req.body as Record<string, string>;
    const missing: string[] = [];
    if (!body.delegatorId) missing.push('delegatorId');
    if (!body.delegateeId) missing.push('delegateeId');
    if (!body.scope) missing.push('scope');
    if (!body.startDate) missing.push('startDate');
    if (!body.reason) missing.push('reason');

    if (missing.length > 0) {
      res.status(400).json({ errors: [`Missing required fields: ${missing.join(', ')}`] });
      return;
    }

    const act = actor(req);
    try {
      const delegation = createDelegation(db, tenantId, {
        delegatorId: body.delegatorId,
        delegateeId: body.delegateeId,
        scope: body.scope,
        startDate: body.startDate,
        endDate: body.endDate || null,
        reason: body.reason,
        createdBy: act.userId,
      });

      archieveLog({
        requestId: req.headers['x-request-id'] as string || crypto.randomUUID(),
        tenantId,
        module: 'org-manager',
        eventType: 'ORG_DELEGATION_CREATED',
        actor: act,
        severity: 'info',
        data: { delegationId: delegation.id, delegatorId: delegation.delegatorId, delegateeId: delegation.delegateeId, scope: delegation.scope },
      });

      res.status(201).json({ data: delegation });
    } catch (err) {
      res.status(500).json({ errors: [(err as Error).message] });
    }
  });

  // DELETE /org/delegations/:id — revoke delegation
  router.delete('/delegations/:id', (req: Request, res: Response) => {
    const tenantId = resolveTenantId(req);
    if (!tenantId) { res.status(403).json({ errors: ['Tenant not resolvable'] }); return; }

    const act = actor(req);
    const revoked = revokeDelegation(db, tenantId, req.params.id, act.userId);
    if (!revoked) {
      res.status(404).json({ errors: ['Delegation not found or already revoked'] });
      return;
    }

    archieveLog({
      requestId: req.headers['x-request-id'] as string || crypto.randomUUID(),
      tenantId,
      module: 'org-manager',
      eventType: 'ORG_DELEGATION_REVOKED',
      actor: act,
      severity: 'info',
      data: { delegationId: req.params.id },
    });

    res.json({ data: { id: req.params.id, revokedAt: new Date().toISOString() } });
  });

  return router;
}
