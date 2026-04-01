import crypto from 'node:crypto';
import express from 'express';
import type { Router } from 'express';
import type Database from 'better-sqlite3';
import { getAuthContext, createJwtAuthenticationMiddleware } from '@publiclogic/core';
import { listAlerts, getAlert, resolveAlert, getDigest } from './store.js';
import { runChecks } from './evaluator.js';
import { archieveLog } from '../archieve/index.js';
import type { AlertDomain, AlertSeverity, AlertStatus } from './types.js';

function getTenantId(req: express.Request, auth: ReturnType<typeof getAuthContext>): string | null {
  const role = auth?.role;
  if (role === 'platform-admin' || role === 'admin') {
    return (req.query.tenantId as string) || auth?.tenantId || null;
  }
  if (role === 'tenant-admin') {
    return auth?.tenantId || null;
  }
  return auth?.tenantId || null;
}

function systemActor(req: express.Request, auth: ReturnType<typeof getAuthContext>) {
  return {
    userId: auth?.userId || auth?.sub || 'system',
    role: auth?.role || 'system',
    sessionId: auth?.sessionId || (req.headers['x-request-id'] as string) || 'none',
    ip: req.ip,
  };
}

interface FeedRow {
  feed_id: string;
  feed_json: string;
}

interface FeedDef {
  feedId: string;
  displayName: string;
  status: string;
  lastSyncAt?: string;
  syncConfig?: { staleThresholdHours?: number };
}

export function createWatchRouter(db: Database.Database): Router {
  const router = express.Router();
  const authMiddleware = createJwtAuthenticationMiddleware();

  router.use(authMiddleware);

  // GET /watch/alerts
  router.get('/alerts', (req, res) => {
    const auth = getAuthContext(req);
    const tenantId = getTenantId(req, auth);
    if (!tenantId) { res.status(403).json({ errors: ['Tenant not resolvable'] }); return; }

    const {
      domain,
      severity,
      status,
      limit: limitStr,
      after,
    } = req.query as Record<string, string>;

    const limit = Math.min(200, Math.max(1, parseInt(limitStr ?? '50', 10)));

    try {
      const alerts = listAlerts(db, tenantId, {
        domain: domain as AlertDomain | undefined,
        severity: severity as AlertSeverity | undefined,
        status: status as AlertStatus | undefined,
        limit,
        after,
      });

      res.json({
        data: alerts,
        meta: {
          count: alerts.length,
          limit,
          tenantId,
        },
      });
    } catch (err) {
      res.status(500).json({ errors: [(err as Error).message] });
    }
  });

  // PATCH /watch/alerts/:id/resolve
  router.patch('/alerts/:id/resolve', (req, res) => {
    const auth = getAuthContext(req);
    const tenantId = getTenantId(req, auth);
    if (!tenantId) { res.status(403).json({ errors: ['Tenant not resolvable'] }); return; }

    const { id } = req.params;
    const { note } = req.body as { note?: string };
    const actor = systemActor(req, auth);

    try {
      const existing = getAlert(db, id, tenantId);
      if (!existing) { res.status(404).json({ errors: ['Alert not found'] }); return; }
      if (existing.status === 'resolved') { res.status(409).json({ errors: ['Alert is already resolved'] }); return; }

      const resolved = resolveAlert(db, id, tenantId, actor.userId, note ?? null);

      try {
        archieveLog({
          requestId: (req.headers['x-request-id'] as string) || crypto.randomUUID(),
          tenantId,
          module: 'WATCHLAYER',
          eventType: 'WATCH_ALERT_RESOLVED',
          actor,
          severity: 'info',
          data: {
            alertId: id,
            deduplicationKey: existing.deduplicationKey,
            domain: existing.domain,
            previousSeverity: existing.severity,
            note: note ?? null,
          },
        });
      } catch (logErr) {
        console.warn('[watchlayer] Failed to log alert resolution to ARCHIEVE:', (logErr as Error).message);
      }

      res.json({ data: resolved });
    } catch (err) {
      res.status(500).json({ errors: [(err as Error).message] });
    }
  });

  // GET /watch/digest
  router.get('/digest', (req, res) => {
    const auth = getAuthContext(req);
    const tenantId = getTenantId(req, auth);
    if (!tenantId) { res.status(403).json({ errors: ['Tenant not resolvable'] }); return; }

    try {
      const digest = getDigest(db, tenantId);
      res.json({ data: digest });
    } catch (err) {
      res.status(500).json({ errors: [(err as Error).message] });
    }
  });

  // GET /watch/freshness
  router.get('/freshness', (req, res) => {
    const auth = getAuthContext(req);
    const tenantId = getTenantId(req, auth);
    if (!tenantId) { res.status(403).json({ errors: ['Tenant not resolvable'] }); return; }

    try {
      const tableCheck = db.prepare(
        `SELECT name FROM sqlite_master WHERE type='table' AND name='syncronate_feeds'`
      ).get();

      if (!tableCheck) {
        res.json({ data: { feeds: [], available: false } });
        return;
      }

      const now = Date.now();
      const feedRows = db.prepare(
        `SELECT feed_id, feed_json FROM syncronate_feeds WHERE tenant_id = ?`
      ).all(tenantId) as FeedRow[];

      const feeds = feedRows.map((row) => {
        const feed: FeedDef = JSON.parse(row.feed_json);
        const staleThresholdHours = feed.syncConfig?.staleThresholdHours ?? 24;
        const staleThresholdMs = staleThresholdHours * 60 * 60 * 1000;

        let feedStatus: 'live' | 'stale' | 'never_synced' | 'unavailable';
        let lastSyncAt: string | null = feed.lastSyncAt ?? null;

        if (feed.status === 'draft' || feed.status === 'retired' || feed.status === 'paused') {
          feedStatus = 'unavailable';
        } else if (!feed.lastSyncAt) {
          feedStatus = 'never_synced';
        } else {
          const age = now - new Date(feed.lastSyncAt).getTime();
          feedStatus = age > staleThresholdMs ? 'stale' : 'live';
        }

        return {
          feedId: feed.feedId,
          displayName: feed.displayName,
          status: feedStatus,
          feedLifecycle: feed.status,
          lastSyncAt,
          staleThresholdHours,
        };
      });

      res.json({
        data: {
          feeds,
          available: true,
          generatedAt: new Date().toISOString(),
        },
      });
    } catch (err) {
      res.status(500).json({ errors: [(err as Error).message] });
    }
  });

  // POST /watch/run — admin-only manual trigger
  router.post('/run', async (req, res) => {
    const auth = getAuthContext(req);
    const tenantId = getTenantId(req, auth);
    if (!tenantId) { res.status(403).json({ errors: ['Tenant not resolvable'] }); return; }

    const role = auth?.role;
    if (role !== 'admin' && role !== 'platform-admin' && role !== 'tenant-admin') {
      res.status(403).json({ errors: ['Admin role required to trigger watch checks'] });
      return;
    }

    try {
      const results = await runChecks(db, tenantId);

      const totalAlerts = results.reduce((sum, r) => sum + r.alertsFired, 0);
      const errored = results.filter(r => r.status === 'error');

      res.json({
        data: {
          tenantId,
          ranAt: new Date().toISOString(),
          checksRun: results.length,
          totalAlertsFired: totalAlerts,
          results,
        },
        meta: {
          errors: errored.length > 0 ? errored.map(r => ({ domain: r.domain, error: r.error })) : undefined,
        },
      });
    } catch (err) {
      res.status(500).json({ errors: [(err as Error).message] });
    }
  });

  return router;
}
