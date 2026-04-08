import express from 'express';
import type { Router, Request, Response } from 'express';
import type Database from 'better-sqlite3';
import { getAuthContext, createJwtAuthenticationMiddleware } from '@publiclogic/core';
import { createFeed, getFeed, updateFeed, listFeeds, setFeedStatus } from './feed-store.js';
import { createJob, getJob, listJobs, listJobsForTenant, countJobsToday } from './job-store.js';
import { listRecords, getRecord, tombstoneRecord, countRecordsIngested } from './record-store.js';
import { runSyncJob, scheduleFeed, getSyncronateHealth, getNextScheduleOccurrences } from './sync-engine.js';
import { verifyWebhookSignature, getWebhookSecretForFeed } from './connectors/polimorphic.js';
import { log as archieveLog } from '../archieve/logger.js';
import { ArchieveEventType } from '../archieve/event-catalog.js';
import crypto from 'node:crypto';
import type { FeedDef, ConnectorMetadata } from './types.js';

const SYSTEM_ACTOR = { userId: 'system:syncronate', role: 'system', sessionId: 'api', ip: undefined };

function safeLog(event: Parameters<typeof archieveLog>[0]): void {
  try { archieveLog(event); } catch (err) { console.warn('[syncronate] archieve log failed:', (err as Error).message); }
}

function reqId() { return crypto.randomUUID(); }

/** Send a successful response with a consistent envelope. */
function sendOk(res: Response, data: unknown, correlationId: string, status = 200): void {
  res.status(status).json({ success: true, correlationId, data });
}

/** Send an error response with a consistent envelope and a friendly user-facing message. */
function sendErr(res: Response, status: number, message: string, correlationId: string, code?: string): void {
  res.status(status).json({ success: false, correlationId, error: { message, ...(code ? { code } : {}) } });
}

const AVAILABLE_CONNECTORS: ConnectorMetadata[] = [
  {
    type: 'monday',
    displayName: 'Monday.com',
    direction: 'source',
    description: 'Sync items from a Monday.com board via GraphQL API',
    configSchema: { boardId: { type: 'string', required: true } },
  },
  {
    type: 'polimorphic',
    displayName: 'Polimorphic',
    direction: 'source',
    description: 'Receive webhook events or poll from Polimorphic platform',
    configSchema: { baseUrl: { type: 'string', required: true } },
  },
  {
    type: 'salesforce',
    displayName: 'Salesforce',
    direction: 'source',
    description: 'Sync Contacts/Accounts/Leads/Opportunities via SOQL',
    configSchema: { objectType: { type: 'string', enum: ['Contact', 'Account', 'Lead', 'Opportunity'] } },
  },
  {
    type: 'powerbi',
    displayName: 'Power BI',
    direction: 'sink',
    description: 'Push rows to a Power BI push dataset (100-row batches, SEAL signed)',
    configSchema: { datasetId: { type: 'string', required: true }, tableId: { type: 'string', required: true } },
  },
  {
    type: 'kahana',
    displayName: 'Kahana',
    direction: 'sink',
    description: 'Export ZIP bundles to Kahana enterprise endpoint',
    configSchema: { endpoint: { type: 'string' } },
  },
];

export function createSyncronateRouter(db: Database.Database): Router {
  const router = express.Router();
  const authMiddleware = createJwtAuthenticationMiddleware();

  // ── System health (no JWT required — safe to expose under requireToolAccess) ──
  router.get('/health', (_req, res) => {
    const cid = reqId();
    const health = getSyncronateHealth(db);
    sendOk(res, {
      status: health.status,
      message: health.status === 'ok'
        ? 'Syncron8 is running normally.'
        : 'Syncron8 is running but some things need attention. Check active feeds and running jobs.',
      activeFeeds: health.activeFeeds,
      jobsRunning: health.jobsRunning,
      timestamp: new Date().toISOString(),
    }, cid);
  });

  // ── Polimorphic webhook (no JWT — HMAC is auth) ──
  router.post(
    '/polimorphic/webhook',
    express.raw({ type: 'application/json' }),
    async (req: Request, res: Response) => {
      const cid = reqId();
      const body = req.body as Buffer;
      const signature = (req.headers['x-polimorphic-signature'] ?? req.headers['x-hub-signature-256'] ?? '') as string;

      // Find feed by connector type (pick first active polimorphic feed for this webhook)
      const rows = db.prepare(`SELECT feed_json FROM syncronate_feeds WHERE status = 'active'`).all() as { feed_json: string }[];
      const feed = rows.map(r => JSON.parse(r.feed_json) as FeedDef).find(f => f.source.type === 'polimorphic');

      if (!feed) {
        sendErr(res, 404, 'No active data feed is set up to receive webhook events right now.', cid, 'FEED_NOT_FOUND');
        return;
      }

      const secret = getWebhookSecretForFeed(feed);
      if (!secret || !verifyWebhookSignature(body, signature, secret)) {
        safeLog({
          requestId: cid, tenantId: feed.tenantId, module: 'SYNCRONATE',
          eventType: ArchieveEventType.SYNCRONATE_WEBHOOK_SIGNATURE_INVALID,
          actor: SYSTEM_ACTOR, severity: 'warn',
          data: { feedId: feed.feedId, sourceConnectorId: feed.source.connectorId },
        });
        sendErr(res, 401, 'The webhook signature could not be verified. Please check your secret configuration.', cid, 'SIGNATURE_INVALID');
        return;
      }

      let event: Record<string, unknown>;
      try {
        event = JSON.parse(body.toString('utf-8'));
      } catch {
        sendErr(res, 400, 'The request body could not be read. Please send valid JSON.', cid, 'INVALID_BODY');
        return;
      }

      safeLog({
        requestId: cid, tenantId: feed.tenantId, module: 'SYNCRONATE',
        eventType: ArchieveEventType.SYNCRONATE_WEBHOOK_RECEIVED,
        actor: SYSTEM_ACTOR, severity: 'info',
        data: { feedId: feed.feedId, eventType: event.eventType ?? 'unknown' },
      });

      // Trigger async sync for this feed
      runSyncJob(feed.feedId, 'webhook', db).catch(err =>
        console.error('[syncronate] webhook-triggered sync failed:', err)
      );

      sendOk(res, { status: 'accepted', message: 'Webhook received. A sync has been queued.' }, cid);
    }
  );

  // Polimorphic webhook health (no auth)
  router.get('/polimorphic/webhook/health', (_req, res) => {
    const cid = reqId();
    sendOk(res, { status: 'ok', timestamp: new Date().toISOString() }, cid);
  });

  // ── All other routes require JWT ──
  router.use(authMiddleware);

  function getTenantId(req: Request): string | null {
    const auth = getAuthContext(req);
    if (!auth) return null;
    if (auth.role === 'admin' || auth.role === 'platform-admin') {
      return (req.query.tenantId as string) || req.body?.tenantId || auth.tenantId || null;
    }
    return auth.tenantId || null;
  }

  function actorFrom(req: Request) {
    const auth = getAuthContext(req);
    return {
      userId: auth?.userId || auth?.sub || 'unknown',
      role: auth?.role || 'unknown',
      sessionId: auth?.sessionId || (req.headers['x-request-id'] as string) || 'none',
      ip: req.ip,
    };
  }

  // ── Dashboard ──
  router.get('/dashboard', (req: Request, res: Response) => {
    const cid = reqId();
    const tenantId = getTenantId(req);
    if (!tenantId) { sendErr(res, 403, 'Your account is not linked to a workspace. Please contact your administrator.', cid, 'TENANT_UNRESOLVABLE'); return; }

    try {
      const activeFeeds = (db.prepare(`SELECT COUNT(*) as cnt FROM syncronate_feeds WHERE tenant_id = ? AND status = 'active'`).get(tenantId) as { cnt: number }).cnt;
      const jobsToday = countJobsToday(db, tenantId);
      const recordsIngested = countRecordsIngested(db, tenantId);
      const dlpBlocks = (db.prepare(
        `SELECT COUNT(*) as cnt FROM syncronate_jobs WHERE tenant_id = ? AND stats_json LIKE '%"blocked"%'`
      ).get(tenantId) as { cnt: number }).cnt;
      const recentJobs = listJobsForTenant(db, tenantId, 10);
      sendOk(res, { activeFeeds, jobsToday, recordsIngested, dlpBlocks, recentJobs }, cid);
    } catch (err) {
      console.error('[syncronate] dashboard error:', (err as Error).message);
      sendErr(res, 500, 'Could not load dashboard data. Please try again in a moment.', cid, 'DASHBOARD_ERROR');
    }
  });

  // ── Connectors list ──
  router.get('/connectors', (_req, res) => {
    const cid = reqId();
    sendOk(res, { connectors: AVAILABLE_CONNECTORS }, cid);
  });

  // ── Feed Management ──

  // POST /api/syncronate/feeds — create FeedDef
  router.post('/feeds', (req: Request, res: Response) => {
    const cid = reqId();
    const tenantId = getTenantId(req);
    if (!tenantId) { sendErr(res, 403, 'Your account is not linked to a workspace. Please contact your administrator.', cid, 'TENANT_UNRESOLVABLE'); return; }

    try {
      const body = req.body as Partial<FeedDef>;
      if (!body.displayName || !body.source || !body.sinks || !body.fieldMap) {
        sendErr(res, 400, 'Please provide all required fields: displayName, source, sinks, and fieldMap.', cid, 'MISSING_FIELDS');
        return;
      }
      const feed = createFeed(db, {
        tenantId,
        displayName: body.displayName,
        source: body.source,
        sinks: body.sinks ?? [],
        fieldMap: body.fieldMap ?? [],
        syncConfig: body.syncConfig ?? {},
      });
      safeLog({
        requestId: cid, tenantId, module: 'SYNCRONATE',
        eventType: ArchieveEventType.SYNCRONATE_FEED_CREATED,
        actor: actorFrom(req), severity: 'info',
        data: { feedId: feed.feedId },
      });
      sendOk(res, feed, cid, 201);
    } catch (err) {
      console.error('[syncronate] create feed error:', (err as Error).message);
      sendErr(res, 500, 'The feed could not be created. Please try again or contact support.', cid, 'CREATE_FEED_ERROR');
    }
  });

  // GET /api/syncronate/feeds — list feeds
  router.get('/feeds', (req: Request, res: Response) => {
    const cid = reqId();
    const tenantId = getTenantId(req);
    if (!tenantId) { sendErr(res, 403, 'Your account is not linked to a workspace. Please contact your administrator.', cid, 'TENANT_UNRESOLVABLE'); return; }
    try {
      const feeds = listFeeds(db, tenantId);
      sendOk(res, { feeds }, cid);
    } catch (err) {
      console.error('[syncronate] list feeds error:', (err as Error).message);
      sendErr(res, 500, 'Could not retrieve feeds. Please try again in a moment.', cid, 'LIST_FEEDS_ERROR');
    }
  });

  // GET /api/syncronate/feeds/:feedId — get feed detail
  router.get('/feeds/:feedId', (req: Request, res: Response) => {
    const cid = reqId();
    const tenantId = getTenantId(req);
    if (!tenantId) { sendErr(res, 403, 'Your account is not linked to a workspace. Please contact your administrator.', cid, 'TENANT_UNRESOLVABLE'); return; }
    const feed = getFeed(db, req.params.feedId);
    if (!feed || feed.tenantId !== tenantId) { sendErr(res, 404, 'Feed not found. It may have been removed or the ID is incorrect.', cid, 'FEED_NOT_FOUND'); return; }
    sendOk(res, feed, cid);
  });

  // PATCH /api/syncronate/feeds/:feedId — update draft FeedDef
  router.patch('/feeds/:feedId', (req: Request, res: Response) => {
    const cid = reqId();
    const tenantId = getTenantId(req);
    if (!tenantId) { sendErr(res, 403, 'Your account is not linked to a workspace. Please contact your administrator.', cid, 'TENANT_UNRESOLVABLE'); return; }
    const feed = getFeed(db, req.params.feedId);
    if (!feed || feed.tenantId !== tenantId) { sendErr(res, 404, 'Feed not found. It may have been removed or the ID is incorrect.', cid, 'FEED_NOT_FOUND'); return; }
    if (feed.status !== 'draft') { sendErr(res, 409, 'Only feeds in "draft" status can be edited. Pause the feed first if you need to make changes.', cid, 'FEED_NOT_DRAFT'); return; }
    try {
      const updated = updateFeed(db, req.params.feedId, req.body as Partial<FeedDef>);
      sendOk(res, updated, cid);
    } catch (err) {
      console.error('[syncronate] update feed error:', (err as Error).message);
      sendErr(res, 500, 'The feed could not be updated. Please try again or contact support.', cid, 'UPDATE_FEED_ERROR');
    }
  });

  // POST /api/syncronate/feeds/:feedId/activate
  router.post('/feeds/:feedId/activate', async (req: Request, res: Response) => {
    const cid = reqId();
    const tenantId = getTenantId(req);
    if (!tenantId) { sendErr(res, 403, 'Your account is not linked to a workspace. Please contact your administrator.', cid, 'TENANT_UNRESOLVABLE'); return; }
    const feed = getFeed(db, req.params.feedId);
    if (!feed || feed.tenantId !== tenantId) { sendErr(res, 404, 'Feed not found. It may have been removed or the ID is incorrect.', cid, 'FEED_NOT_FOUND'); return; }
    try {
      const updated = setFeedStatus(db, req.params.feedId, 'active');
      safeLog({
        requestId: cid, tenantId, module: 'SYNCRONATE',
        eventType: ArchieveEventType.SYNCRONATE_FEED_ACTIVATED,
        actor: actorFrom(req), severity: 'info',
        data: { feedId: req.params.feedId, tenantId },
      });
      if (updated?.syncConfig.scheduleExpression) {
        scheduleFeed(updated, db);
      }
      sendOk(res, updated, cid);
    } catch (err) {
      console.error('[syncronate] activate feed error:', (err as Error).message);
      sendErr(res, 500, 'The feed could not be activated. Please try again or contact support.', cid, 'ACTIVATE_FEED_ERROR');
    }
  });

  // POST /api/syncronate/feeds/:feedId/pause
  router.post('/feeds/:feedId/pause', (req: Request, res: Response) => {
    const cid = reqId();
    const tenantId = getTenantId(req);
    if (!tenantId) { sendErr(res, 403, 'Your account is not linked to a workspace. Please contact your administrator.', cid, 'TENANT_UNRESOLVABLE'); return; }
    const feed = getFeed(db, req.params.feedId);
    if (!feed || feed.tenantId !== tenantId) { sendErr(res, 404, 'Feed not found. It may have been removed or the ID is incorrect.', cid, 'FEED_NOT_FOUND'); return; }
    try {
      const updated = setFeedStatus(db, req.params.feedId, 'paused');
      sendOk(res, updated, cid);
    } catch (err) {
      console.error('[syncronate] pause feed error:', (err as Error).message);
      sendErr(res, 500, 'The feed could not be paused. Please try again or contact support.', cid, 'PAUSE_FEED_ERROR');
    }
  });

  // POST /api/syncronate/feeds/:feedId/retire
  router.post('/feeds/:feedId/retire', (req: Request, res: Response) => {
    const cid = reqId();
    const tenantId = getTenantId(req);
    if (!tenantId) { sendErr(res, 403, 'Your account is not linked to a workspace. Please contact your administrator.', cid, 'TENANT_UNRESOLVABLE'); return; }
    const feed = getFeed(db, req.params.feedId);
    if (!feed || feed.tenantId !== tenantId) { sendErr(res, 404, 'Feed not found. It may have been removed or the ID is incorrect.', cid, 'FEED_NOT_FOUND'); return; }
    try {
      const updated = setFeedStatus(db, req.params.feedId, 'retired');
      sendOk(res, updated, cid);
    } catch (err) {
      console.error('[syncronate] retire feed error:', (err as Error).message);
      sendErr(res, 500, 'The feed could not be retired. Please try again or contact support.', cid, 'RETIRE_FEED_ERROR');
    }
  });

  // ── Feed Status ──

  // GET /api/syncronate/feeds/:feedId/schedule-preview — next N occurrences
  router.get('/feeds/:feedId/schedule-preview', (req: Request, res: Response) => {
    const cid = reqId();
    const tenantId = getTenantId(req);
    if (!tenantId) { sendErr(res, 403, 'Workspace not linked.', cid, 'TENANT_UNRESOLVABLE'); return; }
    const feed = getFeed(db, req.params.feedId);
    if (!feed || feed.tenantId !== tenantId) { sendErr(res, 404, 'Feed not found.', cid, 'FEED_NOT_FOUND'); return; }

    const count = Math.min(Math.max(parseInt((req.query.count as string) ?? '5', 10), 1), 20);
    const expr = feed.syncConfig?.scheduleExpression;
    if (!expr) {
      sendOk(res, { feedId: feed.feedId, scheduleExpression: null, nextOccurrences: [] }, cid);
      return;
    }

    try {
      const nextOccurrences = getNextScheduleOccurrences(expr, count);
      sendOk(res, { feedId: feed.feedId, scheduleExpression: expr, nextOccurrences }, cid);
    } catch (err) {
      sendErr(res, 400, `Invalid schedule expression: ${(err as Error).message}`, cid, 'INVALID_CRON');
    }
  });

  // GET /api/syncronate/feeds/:feedId/status — human-friendly feed status summary
  router.get('/feeds/:feedId/status', (req: Request, res: Response) => {
    const cid = reqId();
    const tenantId = getTenantId(req);
    if (!tenantId) { sendErr(res, 403, 'Your account is not linked to a workspace. Please contact your administrator.', cid, 'TENANT_UNRESOLVABLE'); return; }
    const feed = getFeed(db, req.params.feedId);
    if (!feed || feed.tenantId !== tenantId) { sendErr(res, 404, 'Feed not found. It may have been removed or the ID is incorrect.', cid, 'FEED_NOT_FOUND'); return; }

    try {
      const jobs = listJobs(db, req.params.feedId);
      const lastJob = jobs[0] ?? null;
      const runningStatuses = new Set(['queued', 'running', 'transforming', 'writing', 'delivering']);
      const syncRunning = lastJob ? runningStatuses.has(lastJob.status) : false;

      sendOk(res, {
        feedId: feed.feedId,
        displayName: feed.displayName,
        status: feed.status,
        lastSyncAt: feed.lastSyncAt ?? null,
        syncRunning,
        lastJobResult: lastJob
          ? { jobId: lastJob.jobId, status: lastJob.status, completedAt: lastJob.completedAt ?? null, stats: lastJob.stats }
          : null,
      }, cid);
    } catch (err) {
      console.error('[syncronate] feed status error:', (err as Error).message);
      sendErr(res, 500, 'Could not retrieve feed status. Please try again in a moment.', cid, 'FEED_STATUS_ERROR');
    }
  });

  // ── Sync Jobs ──

  // POST /api/syncronate/feeds/:feedId/sync — manual trigger
  router.post('/feeds/:feedId/sync', async (req: Request, res: Response) => {
    const cid = reqId();
    const tenantId = getTenantId(req);
    if (!tenantId) { sendErr(res, 403, 'Your account is not linked to a workspace. Please contact your administrator.', cid, 'TENANT_UNRESOLVABLE'); return; }
    const feed = getFeed(db, req.params.feedId);
    if (!feed || feed.tenantId !== tenantId) { sendErr(res, 404, 'Feed not found. It may have been removed or the ID is incorrect.', cid, 'FEED_NOT_FOUND'); return; }
    if (feed.status !== 'active') { sendErr(res, 409, 'This feed is not active. Please activate it before starting a sync.', cid, 'FEED_NOT_ACTIVE'); return; }

    // Create job immediately and respond; run async
    const job = createJob(db, feed.feedId, tenantId, 'manual');
    safeLog({
      requestId: cid, tenantId, module: 'SYNCRONATE',
      eventType: ArchieveEventType.SYNCRONATE_SYNC_STARTED,
      actor: actorFrom(req), severity: 'info',
      data: { feedId: feed.feedId },
    });

    runSyncJob(feed.feedId, 'manual', db).catch(err =>
      console.error('[syncronate] manual sync failed:', err)
    );

    sendOk(res, { jobId: job.jobId, status: 'queued', message: 'Sync started. You can track progress via the job status endpoint.' }, cid, 202);
  });

  // GET /api/syncronate/feeds/:feedId/jobs — list jobs
  router.get('/feeds/:feedId/jobs', (req: Request, res: Response) => {
    const cid = reqId();
    const tenantId = getTenantId(req);
    if (!tenantId) { sendErr(res, 403, 'Your account is not linked to a workspace. Please contact your administrator.', cid, 'TENANT_UNRESOLVABLE'); return; }
    const feed = getFeed(db, req.params.feedId);
    if (!feed || feed.tenantId !== tenantId) { sendErr(res, 404, 'Feed not found. It may have been removed or the ID is incorrect.', cid, 'FEED_NOT_FOUND'); return; }
    const status = req.query.status as string | undefined;
    const jobs = listJobs(db, req.params.feedId, status ? { status } : undefined);
    sendOk(res, { jobs }, cid);
  });

  // GET /api/syncronate/feeds/:feedId/jobs/:jobId — job detail
  router.get('/feeds/:feedId/jobs/:jobId', (req: Request, res: Response) => {
    const cid = reqId();
    const tenantId = getTenantId(req);
    if (!tenantId) { sendErr(res, 403, 'Your account is not linked to a workspace. Please contact your administrator.', cid, 'TENANT_UNRESOLVABLE'); return; }
    const job = getJob(db, req.params.jobId);
    if (!job || job.tenantId !== tenantId || job.feedId !== req.params.feedId) {
      sendErr(res, 404, 'Sync job not found. It may have been removed or the ID is incorrect.', cid, 'JOB_NOT_FOUND'); return;
    }
    sendOk(res, job, cid);
  });

  // POST /api/syncronate/feeds/:feedId/jobs/:jobId/retry-sinks
  router.post('/feeds/:feedId/jobs/:jobId/retry-sinks', async (req: Request, res: Response) => {
    const cid = reqId();
    const tenantId = getTenantId(req);
    if (!tenantId) { sendErr(res, 403, 'Your account is not linked to a workspace. Please contact your administrator.', cid, 'TENANT_UNRESOLVABLE'); return; }
    const job = getJob(db, req.params.jobId);
    if (!job || job.tenantId !== tenantId) { sendErr(res, 404, 'Sync job not found. It may have been removed or the ID is incorrect.', cid, 'JOB_NOT_FOUND'); return; }

    const newJob = createJob(db, job.feedId, tenantId, 'manual');
    runSyncJob(job.feedId, 'manual', db).catch(err =>
      console.error('[syncronate] retry-sinks failed:', err)
    );
    sendOk(res, { jobId: newJob.jobId, status: 'queued', message: 'Retry started. Delivery to destinations will be reattempted.' }, cid, 202);
  });

  // POST /api/syncronate/feeds/:feedId/jobs/:jobId/cancel
  router.post('/feeds/:feedId/jobs/:jobId/cancel', (req: Request, res: Response) => {
    const cid = reqId();
    const tenantId = getTenantId(req);
    if (!tenantId) { sendErr(res, 403, 'Your account is not linked to a workspace. Please contact your administrator.', cid, 'TENANT_UNRESOLVABLE'); return; }
    const { updateJob } = require('./job-store.js');
    const job = getJob(db, req.params.jobId);
    if (!job || job.tenantId !== tenantId) { sendErr(res, 404, 'Sync job not found. It may have been removed or the ID is incorrect.', cid, 'JOB_NOT_FOUND'); return; }
    if (job.status === 'completed' || job.status === 'failed') {
      sendErr(res, 409, 'This job has already finished and cannot be cancelled.', cid, 'JOB_ALREADY_FINISHED'); return;
    }
    const updated = updateJob(db, req.params.jobId, { status: 'failed', completedAt: new Date().toISOString(), error: { message: 'Cancelled by user' } });
    sendOk(res, updated, cid);
  });

  // ── Federation Records ──

  // GET /api/syncronate/feeds/:feedId/records — list records
  router.get('/feeds/:feedId/records', (req: Request, res: Response) => {
    const cid = reqId();
    const tenantId = getTenantId(req);
    if (!tenantId) { sendErr(res, 403, 'Your account is not linked to a workspace. Please contact your administrator.', cid, 'TENANT_UNRESOLVABLE'); return; }
    const feed = getFeed(db, req.params.feedId);
    if (!feed || feed.tenantId !== tenantId) { sendErr(res, 404, 'Feed not found. It may have been removed or the ID is incorrect.', cid, 'FEED_NOT_FOUND'); return; }
    const limit = parseInt(req.query.limit as string ?? '100', 10);
    const offset = parseInt(req.query.offset as string ?? '0', 10);
    const records = listRecords(db, req.params.feedId, {}, { limit, offset });
    sendOk(res, { records }, cid);
  });

  // GET /api/syncronate/feeds/:feedId/records/:recordId — get record
  router.get('/feeds/:feedId/records/:recordId', (req: Request, res: Response) => {
    const cid = reqId();
    const tenantId = getTenantId(req);
    if (!tenantId) { sendErr(res, 403, 'Your account is not linked to a workspace. Please contact your administrator.', cid, 'TENANT_UNRESOLVABLE'); return; }
    const record = getRecord(db, req.params.recordId);
    if (!record || record.tenantId !== tenantId || record.feedId !== req.params.feedId) {
      sendErr(res, 404, 'Record not found. It may have been removed or the ID is incorrect.', cid, 'RECORD_NOT_FOUND'); return;
    }
    sendOk(res, record, cid);
  });

  // DELETE /api/syncronate/feeds/:feedId/records/:recordId — tombstone
  router.delete('/feeds/:feedId/records/:recordId', (req: Request, res: Response) => {
    const cid = reqId();
    const tenantId = getTenantId(req);
    if (!tenantId) { sendErr(res, 403, 'Your account is not linked to a workspace. Please contact your administrator.', cid, 'TENANT_UNRESOLVABLE'); return; }
    const record = getRecord(db, req.params.recordId);
    if (!record || record.tenantId !== tenantId || record.feedId !== req.params.feedId) {
      sendErr(res, 404, 'Record not found. It may have been removed or the ID is incorrect.', cid, 'RECORD_NOT_FOUND'); return;
    }
    const removed = tombstoneRecord(db, req.params.recordId);
    if (!removed) { sendErr(res, 500, 'The record could not be removed at this time. Please try again.', cid, 'TOMBSTONE_ERROR'); return; }
    sendOk(res, { status: 'tombstoned', recordId: req.params.recordId }, cid);
  });

  // ── Audit ──

  // GET /api/syncronate/feeds/:feedId/audit — activity log for this feed
  router.get('/feeds/:feedId/audit', (req: Request, res: Response) => {
    const cid = reqId();
    const tenantId = getTenantId(req);
    if (!tenantId) { sendErr(res, 403, 'Your account is not linked to a workspace. Please contact your administrator.', cid, 'TENANT_UNRESOLVABLE'); return; }
    const feed = getFeed(db, req.params.feedId);
    if (!feed || feed.tenantId !== tenantId) { sendErr(res, 404, 'Feed not found. It may have been removed or the ID is incorrect.', cid, 'FEED_NOT_FOUND'); return; }

    try {
      const rows = db.prepare(
        `SELECT event_json FROM archieve_delivered
         WHERE tenant_id = ? AND event_json LIKE ?
         ORDER BY chain_pos DESC LIMIT 100`
      ).all(tenantId, `%"feedId":"${req.params.feedId}"%`) as { event_json: string }[];
      const events = rows.map(r => JSON.parse(r.event_json));
      sendOk(res, { events }, cid);
    } catch {
      sendOk(res, { events: [] }, cid);
    }
  });

  // GET /api/syncronate/feeds/:feedId/dlp-report — data protection summary
  router.get('/feeds/:feedId/dlp-report', (req: Request, res: Response) => {
    const cid = reqId();
    const tenantId = getTenantId(req);
    if (!tenantId) { sendErr(res, 403, 'Your account is not linked to a workspace. Please contact your administrator.', cid, 'TENANT_UNRESOLVABLE'); return; }
    const feed = getFeed(db, req.params.feedId);
    if (!feed || feed.tenantId !== tenantId) { sendErr(res, 404, 'Feed not found. It may have been removed or the ID is incorrect.', cid, 'FEED_NOT_FOUND'); return; }

    try {
      const jobs = listJobs(db, req.params.feedId);
      const totalBlocked = jobs.reduce((acc, j) => acc + (j.stats.blocked ?? 0), 0);
      const totalIngested = jobs.reduce((acc, j) => acc + (j.stats.ingested ?? 0), 0);
      sendOk(res, {
        feedId: req.params.feedId,
        totalBlocked,
        totalIngested,
        blockRate: totalIngested > 0 ? totalBlocked / totalIngested : 0,
        jobs: jobs.length,
      }, cid);
    } catch (err) {
      console.error('[syncronate] dlp-report error:', (err as Error).message);
      sendErr(res, 500, 'Could not retrieve the data protection report. Please try again in a moment.', cid, 'DLP_REPORT_ERROR');
    }
  });

  return router;
}
