import crypto from 'node:crypto';
import type Database from 'better-sqlite3';
import type { FeedDef, SyncJob, FederationRecord, FederationField } from './types.js';
import { getFeed, listFeeds, updateFeed } from './feed-store.js';
import { createJob, getJob, updateJob, listJobsForTenant, countRunningJobs } from './job-store.js';
import { kvGet, kvSet } from './kv-store.js';
import { findByExternalId, createRecord, updateRecord } from './record-store.js';
import { applyFieldMap, evaluateFilterRules } from './transform-engine.js';
import { scan as dlpScan, applyDlp } from './dlp-engine.js';
import { sealSign } from '../seal/index.js';
import { log as archieveLog } from '../archieve/logger.js';
import { ArchieveEventType } from '../archieve/event-catalog.js';

// Source connectors
import { fetchPage as mondayFetchPage } from './connectors/monday.js';
import { pollEvents as polimorphicPollEvents } from './connectors/polimorphic.js';
import { fetchRecords as salesforceFetchRecords } from './connectors/salesforce.js';

// Sinks
import { deliverRows as powerBiDeliverRows } from './sinks/powerbi.js';
import { buildBundle, deliver as kahanaDeliver } from './sinks/kahana.js';

const SYSTEM_ACTOR = { userId: 'system:syncronate', role: 'system', sessionId: 'syncronate-engine', ip: undefined };

function safeLog(event: Parameters<typeof archieveLog>[0]): void {
  try { archieveLog(event); } catch (err) { console.warn('[syncronate] archieve log failed:', (err as Error).message); }
}

function requestId(): string { return crypto.randomUUID(); }

async function fetchSourceRecords(
  feedDef: FeedDef,
  cursor: string | null
): Promise<{ records: Record<string, unknown>[]; nextCursor: string | null }> {
  const src = feedDef.source;
  const batchSize = feedDef.syncConfig.batchSize ?? 50;

  switch (src.type) {
    case 'monday': {
      const page = await mondayFetchPage(feedDef, cursor, batchSize);
      const records = page.items.map(item => ({
        id: item.id,
        name: item.name,
        updated_at: item.updated_at ?? new Date().toISOString(),
        ...Object.fromEntries((item.column_values ?? []).map(cv => [cv.id, cv.text])),
      }));
      return { records, nextCursor: page.nextCursor };
    }
    case 'polimorphic': {
      const since = cursor ?? new Date(Date.now() - 86400000).toISOString();
      const events = await polimorphicPollEvents(feedDef, since);
      const records = events.map(e => ({ id: e.eventId, updated_at: e.occurredAt, ...e.payload }));
      const nextCursor = events.length > 0 ? events[events.length - 1].occurredAt : cursor;
      return { records, nextCursor: nextCursor ?? null };
    }
    case 'salesforce': {
      const since = cursor ?? new Date(Date.now() - 86400000).toISOString();
      const objectType = (feedDef.source.config.objectType as 'Contact' | 'Account' | 'Lead' | 'Opportunity') ?? 'Contact';
      const sfRecords = await salesforceFetchRecords(feedDef, since, objectType);
      const records = sfRecords.map(r => ({ ...r, id: r.Id, updated_at: r.LastModifiedDate }));
      const lastModified = sfRecords.length > 0 ? sfRecords[sfRecords.length - 1].LastModifiedDate : null;
      return { records, nextCursor: lastModified ?? cursor };
    }
    default:
      throw new Error(`Unknown source connector type: ${(src as any).type}`);
  }
}

export async function runSyncJob(
  feedId: string,
  triggerType: SyncJob['triggerType'],
  db: Database.Database
): Promise<SyncJob> {
  const feed = getFeed(db, feedId);
  if (!feed) throw new Error(`Feed not found: ${feedId}`);

  const job = createJob(db, feedId, feed.tenantId, triggerType);
  const jobId = job.jobId;
  const tenantId = feed.tenantId;

  const log = (eventType: string, severity: 'info' | 'warn' | 'error', data: Record<string, unknown>) =>
    safeLog({ requestId: requestId(), tenantId, module: 'SYNCRONATE', eventType, actor: SYSTEM_ACTOR, severity, data });

  log(ArchieveEventType.SYNCRONATE_SYNC_JOB_QUEUED, 'info', { feedId, syncJobId: jobId });
  updateJob(db, jobId, { status: 'running' });
  log(ArchieveEventType.SYNCRONATE_SYNC_JOB_STARTED, 'info', { feedId, syncJobId: jobId });

  const stats = { ingested: 0, updated: 0, skipped: 0, blocked: 0, transformErrors: 0, delivered: 0, deliveryFailed: 0 };

  try {
    // Fetch source records
    const cursorKey = `cursor:${feedId}`;
    let cursor = kvGet(db, cursorKey);
    let nextCursor: string | null = null;

    const { records, nextCursor: nc } = await fetchSourceRecords(feed, cursor);
    nextCursor = nc;

    updateJob(db, jobId, { status: 'transforming' });

    const readyToWrite: FederationRecord[] = [];

    for (const rawRecord of records) {
      const externalId = String(rawRecord.id ?? rawRecord.Id ?? '');

      // 1. FilterRule eval
      if (!evaluateFilterRules(rawRecord, feed.syncConfig.filterRules ?? [])) {
        stats.skipped++;
        log(ArchieveEventType.SYNCRONATE_RECORD_SKIPPED, 'info', { feedId, syncJobId: jobId, reason: 'filter' });
        continue;
      }

      // 2. DLP inbound scan
      const inboundFindings = dlpScan(rawRecord);
      const dlpAction = feed.syncConfig.dlpInboundAction ?? 'mask';

      if (inboundFindings.length > 0) {
        const { result, blocked } = applyDlp(rawRecord, inboundFindings, dlpAction);
        if (blocked) {
          stats.blocked++;
          log(ArchieveEventType.SYNCRONATE_RECORD_BLOCKED, 'warn', { feedId, syncJobId: jobId });
          continue;
        }
        Object.assign(rawRecord, result);
      }

      // 3. Transform (FieldMapDef)
      const { mapped, unmapped, errors } = applyFieldMap(rawRecord, feed.fieldMap);

      if (errors.length > 0) {
        stats.transformErrors += errors.length;
        for (const err of errors) {
          log(ArchieveEventType.SYNCRONATE_TRANSFORM_ERROR, 'warn', { feedId, syncJobId: jobId, errorMessage: err.message });
        }
      }

      // Check for unmapped PII
      const unmappedFindings = dlpScan(unmapped);
      if (unmappedFindings.length > 0) {
        log(ArchieveEventType.SYNCRONATE_UNMAPPED_PII_DETECTED, 'warn', {
          feedId, syncJobId: jobId, fieldName: unmappedFindings[0].field
        });
      }

      // 4. Dedup check
      const sourceConnectorId = feed.source.connectorId;
      const existing = findByExternalId(db, feedId, sourceConnectorId, externalId);
      const sourceUpdatedAt = String(rawRecord.updated_at ?? new Date().toISOString());

      if (existing) {
        // Update existing record
        const updatedRecord = updateRecord(db, existing.recordId, {
          ...existing,
          fields: mapped,
          sourceUpdatedAt,
        });
        if (updatedRecord) {
          stats.updated++;
          log(ArchieveEventType.SYNCRONATE_RECORD_UPDATED, 'info', { feedId, syncJobId: jobId });
          readyToWrite.push(updatedRecord);
        }
      } else {
        // 5. Write to record-store (VAULT proxy)
        const newRecord = createRecord(db, {
          feedId,
          tenantId,
          externalId,
          sourceConnectorId,
          sourceUpdatedAt,
          fields: mapped,
        });
        stats.ingested++;
        log(ArchieveEventType.SYNCRONATE_RECORD_INGESTED, 'info', { feedId, syncJobId: jobId });
        readyToWrite.push(newRecord);
      }
    }

    // Update cursor
    if (nextCursor) {
      kvSet(db, cursorKey, nextCursor);
    }

    // Deliver to sinks
    updateJob(db, jobId, { status: 'delivering', stats });

    const rowsForDelivery = readyToWrite.map(r => {
      const flat: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(r.fields)) {
        flat[k] = (v as FederationField).value;
      }
      flat.__recordId = r.recordId;
      flat.__feedId = r.feedId;
      flat.__sourceUpdatedAt = r.sourceUpdatedAt;
      return flat;
    });

    for (const sink of feed.sinks) {
      try {
        if (sink.type === 'powerbi') {
          const result = await powerBiDeliverRows(feed, sink, rowsForDelivery, jobId);
          if (result.blocked) {
            log(ArchieveEventType.SYNCRONATE_OUTBOUND_DLP_BLOCK, 'warn', { feedId, syncJobId: jobId, sinkConnectorId: sink.connectorId });
            stats.deliveryFailed++;
          } else {
            stats.delivered += result.totalRows;
            log(ArchieveEventType.SYNCRONATE_PAYLOAD_DELIVERED, 'info', { feedId, syncJobId: jobId, sinkConnectorId: sink.connectorId });
          }
        } else if (sink.type === 'kahana') {
          const documents = rowsForDelivery.map(row => ({
            id: String(row.__recordId ?? crypto.randomUUID()),
            name: `record-${row.__recordId}.json`,
            content: JSON.stringify(row),
            mimeType: 'application/json',
          }));
          const bundle = await buildBundle(feed, sink, documents, jobId);
          await kahanaDeliver(bundle, feed, sink);
          stats.delivered += documents.length;
          log(ArchieveEventType.SYNCRONATE_PAYLOAD_DELIVERED, 'info', { feedId, syncJobId: jobId, sinkConnectorId: sink.connectorId });
        }
      } catch (err) {
        stats.deliveryFailed++;
        console.error(`[syncronate] sink delivery failed (${sink.connectorId}):`, (err as Error).message);
      }
    }

    // Determine final status
    const finalStatus = stats.deliveryFailed > 0 ? 'partial' : 'completed';
    const now = new Date().toISOString();
    const finalJob = updateJob(db, jobId, { status: finalStatus, completedAt: now, stats, cursor: nextCursor ?? undefined });

    // Update feed lastSyncAt
    updateFeed(db, feedId, { lastSyncAt: now } as any);

    const completedEvent = finalStatus === 'partial'
      ? ArchieveEventType.SYNCRONATE_SYNC_JOB_PARTIAL
      : ArchieveEventType.SYNCRONATE_SYNC_JOB_COMPLETED;
    log(completedEvent, 'info', { feedId, syncJobId: jobId });

    return finalJob!;
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    const failedJob = updateJob(db, jobId, {
      status: 'failed',
      completedAt: new Date().toISOString(),
      stats,
      error: { message: errorMsg },
    });
    log(ArchieveEventType.SYNCRONATE_SYNC_JOB_FAILED, 'error', { feedId, syncJobId: jobId, errorMessage: errorMsg });
    return failedJob ?? job;
  }
}

// Schedule feeds using setTimeout pattern (no node-cron)
function parseCronIntervalMs(expr: string): number {
  // Simple: handle "*/N * * * *" → every N minutes
  const match = expr.match(/^\*\/(\d+)\s/);
  if (match) return parseInt(match[1], 10) * 60 * 1000;
  // Default: 15 minutes
  return 15 * 60 * 1000;
}

export function scheduleFeed(feedDef: FeedDef, db: Database.Database): void {
  const schedule = feedDef.syncConfig.scheduleExpression;
  if (!schedule) return;

  const intervalMs = parseCronIntervalMs(schedule);

  function scheduleNext() {
    setTimeout(() => {
      const current = getFeed(db, feedDef.feedId);
      if (current?.status === 'active') {
        runSyncJob(feedDef.feedId, 'scheduled', db).catch(err =>
          console.error(`[syncronate] scheduled sync error (${feedDef.feedId}):`, err)
        );
      }
      scheduleNext();
    }, intervalMs).unref();
  }

  scheduleNext();
  console.log(`[syncronate] feed ${feedDef.feedId} scheduled every ${intervalMs / 1000}s`);
}

export function scheduleAllActiveFeeds(db: Database.Database): void {
  // Schedule all active feeds on startup
  try {
    const allFeeds = db.prepare(`SELECT feed_json FROM syncronate_feeds WHERE status = 'active'`).all() as { feed_json: string }[];
    for (const row of allFeeds) {
      const feed = JSON.parse(row.feed_json) as FeedDef;
      if (feed.syncConfig.scheduleExpression) {
        scheduleFeed(feed, db);
      }
    }
  } catch (err) {
    console.warn('[syncronate] failed to schedule active feeds:', (err as Error).message);
  }
}

export function getSyncronateHealth(db?: Database.Database): { status: 'ok' | 'degraded'; activeFeeds: number; jobsRunning: number } {
  if (!db) return { status: 'ok', activeFeeds: 0, jobsRunning: 0 };
  try {
    const activeFeeds = (db.prepare(`SELECT COUNT(*) as cnt FROM syncronate_feeds WHERE status = 'active'`).get() as { cnt: number }).cnt;
    const jobsRunning = countRunningJobs(db);
    return { status: 'ok', activeFeeds, jobsRunning };
  } catch {
    return { status: 'degraded', activeFeeds: 0, jobsRunning: 0 };
  }
}
