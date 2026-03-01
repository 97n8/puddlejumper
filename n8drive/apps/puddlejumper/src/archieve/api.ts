import express from 'express';
import type { Router } from 'express';
import type Database from 'better-sqlite3';
import { getAuthContext, createJwtAuthenticationMiddleware } from '@publiclogic/core';
import { verifyChain } from './chain.js';
import { log as archieveLog } from './logger.js';
import { buildExport } from './export.js';
import { ArchieveEventType } from './event-catalog.js';
import type { ArchieveEvent } from './types.js';

function getTenantId(req: express.Request, auth: ReturnType<typeof getAuthContext>): string | null {
  const role = auth?.role;
  if (role === 'platform-admin' || role === 'admin') {
    return (req.query.tenantId as string) || auth?.tenantId || null;
  }
  if (role === 'tenant-admin') {
    // tenant-admin can only access their own tenant
    return auth?.tenantId || null;
  }
  return null;
}

function systemActor(req: express.Request, auth: ReturnType<typeof getAuthContext>) {
  return {
    userId: auth?.userId || auth?.sub || 'system',
    role: auth?.role || 'system',
    sessionId: auth?.sessionId || req.headers['x-request-id'] as string || 'none',
    ip: req.ip,
  };
}

export function createArchieveRouter(db: Database.Database): Router {
  const router = express.Router();
  const authMiddleware = createJwtAuthenticationMiddleware();

  router.use(authMiddleware);

  // Check RBAC — must be tenant-admin or admin/platform-admin
  router.use((req, res, next) => {
    const auth = getAuthContext(req);
    const role = auth?.role;
    if (role === 'admin' || role === 'platform-admin' || role === 'tenant-admin') {
      return next();
    }
    res.status(403).json({ error: 'Forbidden: insufficient role for ARCHIEVE access' });
  });

  // GET /api/archieve/events
  router.get('/events', (req, res) => {
    const auth = getAuthContext(req);
    const tenantId = getTenantId(req, auth);
    if (!tenantId) { res.status(403).json({ error: 'Tenant not resolvable' }); return; }

    const {
      eventType, module: mod, severity, after, before,
      page: pageStr, pageSize: pageSizeStr,
    } = req.query as Record<string, string>;

    const page = Math.max(1, parseInt(pageStr ?? '1', 10));
    const pageSize = Math.min(500, Math.max(1, parseInt(pageSizeStr ?? '50', 10)));
    const offset = (page - 1) * pageSize;

    let sql = `SELECT event_id, tenant_id, event_type, chain_pos, hash, delivered_at, event_json
               FROM archieve_delivered WHERE tenant_id = ?`;
    const params: (string | number)[] = [tenantId];

    if (eventType) { sql += ' AND event_type = ?'; params.push(eventType); }
    if (mod) { sql += ` AND json_extract(event_json, '$.module') = ?`; params.push(mod.toUpperCase()); }
    if (severity) { sql += ` AND json_extract(event_json, '$.severity') = ?`; params.push(severity); }
    if (after) { sql += ' AND delivered_at >= ?'; params.push(after); }
    if (before) { sql += ' AND delivered_at <= ?'; params.push(before); }

    sql += ' ORDER BY chain_pos DESC';
    sql += ` LIMIT ${pageSize} OFFSET ${offset}`;

    try {
      const rows = db.prepare(sql).all(...params);
      const countRow = db.prepare(
        `SELECT COUNT(*) as cnt FROM archieve_delivered WHERE tenant_id = ?`
      ).get(tenantId) as { cnt: number };
      res.json({ tenantId, page, pageSize, total: countRow.cnt, events: rows });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  // GET /api/archieve/events/:eventId
  router.get('/events/:eventId', (req, res) => {
    const auth = getAuthContext(req);
    const tenantId = getTenantId(req, auth);
    if (!tenantId) { res.status(403).json({ error: 'Tenant not resolvable' }); return; }

    try {
      const row = db.prepare(
        `SELECT * FROM archieve_delivered WHERE event_id = ? AND tenant_id = ?`
      ).get(req.params.eventId, tenantId);
      if (!row) { res.status(404).json({ error: 'Event not found' }); return; }
      res.json(row);
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  // GET /api/archieve/chain
  router.get('/chain', (req, res) => {
    const auth = getAuthContext(req);
    const tenantId = getTenantId(req, auth);
    if (!tenantId) { res.status(403).json({ error: 'Tenant not resolvable' }); return; }

    try {
      const countRow = db.prepare(
        `SELECT COUNT(*) as cnt, MAX(chain_pos) as head_pos FROM archieve_delivered WHERE tenant_id = ?`
      ).get(tenantId) as { cnt: number; head_pos: number | null };
      const headRow = db.prepare(
        `SELECT event_id, hash FROM archieve_delivered WHERE tenant_id = ? ORDER BY chain_pos DESC LIMIT 1`
      ).get(tenantId) as { event_id: string; hash: string } | undefined;

      res.json({
        tenantId,
        totalEvents: countRow.cnt,
        headPos: countRow.head_pos,
        headEventId: headRow?.event_id ?? null,
        headHash: headRow?.hash ?? null,
      });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  // POST /api/archieve/verify
  router.post('/verify', (req, res) => {
    const auth = getAuthContext(req);
    const tenantId = getTenantId(req, auth);
    if (!tenantId) { res.status(403).json({ error: 'Tenant not resolvable' }); return; }

    try {
      const result = verifyChain(db, tenantId);
      const actor = systemActor(req, auth);

      // Log verification result as an ARCHIEVE event
      try {
        const eventType = result.result === 'CHAIN_VALID'
          ? ArchieveEventType.ARCHIEVE_CHAIN_VERIFICATION_PASSED
          : ArchieveEventType.ARCHIEVE_CHAIN_VERIFICATION_FAILED;

        archieveLog({
          requestId: req.headers['x-request-id'] as string || crypto.randomUUID(),
          tenantId,
          module: 'ARCHIEVE',
          eventType,
          actor,
          severity: result.result === 'CHAIN_VALID' ? 'info' : 'error',
          data: { ...result },
        } as ArchieveEvent);
      } catch { /* don't fail verify if logging fails */ }

      res.json(result);
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  // GET /api/archieve/notarizations
  router.get('/notarizations', (req, res) => {
    const auth = getAuthContext(req);
    const tenantId = getTenantId(req, auth);
    if (!tenantId) { res.status(403).json({ error: 'Tenant not resolvable' }); return; }

    try {
      const rows = db.prepare(
        `SELECT date, chain_head, root_hash, tsa_token, tsa_url, created_at
         FROM archieve_notarizations WHERE tenant_id = ? ORDER BY date DESC`
      ).all(tenantId);
      res.json({ tenantId, notarizations: rows });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  // GET /api/archieve/export
  router.get('/export', (req, res) => {
    const auth = getAuthContext(req);
    const tenantId = getTenantId(req, auth);
    if (!tenantId) { res.status(403).json({ error: 'Tenant not resolvable' }); return; }

    const { after, before } = req.query as Record<string, string>;
    const exportedBy = auth?.userId || auth?.sub || 'unknown';

    try {
      const exported = buildExport(db, tenantId, after, before, exportedBy);
      res.json(exported);
    } catch (err) {
      const msg = (err as Error).message;
      if (msg.includes('CHAIN_VIOLATION') || msg.includes('Chain violation')) {
        res.status(409).json({ error: msg });
      } else {
        res.status(500).json({ error: msg });
      }
    }
  });

  return router;
}
