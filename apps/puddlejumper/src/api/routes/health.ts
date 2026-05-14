import express from 'express';
import fs from 'node:fs';
import { getAuthContext, requireAuthenticated } from '@publiclogic/core';
import type Database from 'better-sqlite3';
import { DB_BACKEND, getDbPath } from '../../db/adapter.js';
import { getArchieveQueueDepth } from '../../archieve/index.js';

// ── In-memory request counter (rolling 1-hour window) ────────────────────────
let requestCount1h = 0;
let windowStart = Date.now();

function tickRequest() {
  const now = Date.now();
  if (now - windowStart > 3_600_000) { requestCount1h = 0; windowStart = now; }
  requestCount1h++;
}

export function getRequestMetrics() { return { last1h: requestCount1h }; }

export function requestCounterMiddleware(_req: express.Request, _res: express.Response, next: express.NextFunction) {
  tickRequest();
  next();
}

// ─────────────────────────────────────────────────────────────────────────────

export interface HealthRouteOptions {
  db: Database.Database;
  dataDir: string;
}

export function createHealthRoutes(opts: HealthRouteOptions): express.Router {
  const router = express.Router();
  const { db, dataDir } = opts;

  // GET /api/health — public, no auth required
  router.get('/health', (_req, res) => {
    res.json({
      status: 'ok',
      uptime: process.uptime(),
      version: process.env.npm_package_version ?? 'unknown',
      timestamp: new Date().toISOString(),
    });
  });

  // GET /api/health/metrics — requires authenticated + admin role
  router.get('/health/metrics', requireAuthenticated(), (req, res) => {
    const auth = getAuthContext(req);
    if (!auth || auth.role !== 'admin') {
      res.status(403).json({ error: 'Admin only' });
      return;
    }

    const safeCount = (sql: string): number => {
      try {
        const row = db.prepare(sql).get() as { cnt: number } | undefined;
        return row?.cnt ?? 0;
      } catch {
        return 0;
      }
    };

    const safeGroupBy = (sql: string): Record<string, number> => {
      try {
        const rows = db.prepare(sql).all() as { status: string; cnt: number }[];
        return Object.fromEntries(rows.map(r => [r.status, r.cnt]));
      } catch {
        return {};
      }
    };

    const dbSizeBytes = DB_BACKEND === 'sqlite'
      ? (() => { try { return fs.statSync(getDbPath(dataDir)).size; } catch { return 0; } })()
      : null;

    const chainLength = safeCount(`SELECT COUNT(*) as cnt FROM archieve_delivered WHERE tenant_id = 'default'`);

    let queueDepth = 0;
    try { queueDepth = getArchieveQueueDepth(); } catch { /* not initialized */ }

    const tenantTotal = safeCount('SELECT COUNT(*) as cnt FROM tenant_registry');
    const tenantActive = safeCount(`SELECT COUNT(*) as cnt FROM tenant_registry WHERE status = 'active'`);

    const docTotal = safeCount('SELECT COUNT(*) as cnt FROM vault_documents');
    const docByStatus = safeGroupBy('SELECT status, COUNT(*) as cnt FROM vault_documents GROUP BY status');

    const sealKeyCount = safeCount('SELECT COUNT(*) as cnt FROM seal_keys');

    res.json({
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      dbBackend: DB_BACKEND,
      dbSizeBytes,
      archieve: {
        chainLength,
        queueDepth,
      },
      tenants: {
        total: tenantTotal,
        active: tenantActive,
      },
      documents: {
        total: docTotal,
        byStatus: docByStatus,
      },
      requests: getRequestMetrics(),
      seal: {
        keyCount: sealKeyCount,
      },
      timestamp: new Date().toISOString(),
    });
  });

  return router;
}
