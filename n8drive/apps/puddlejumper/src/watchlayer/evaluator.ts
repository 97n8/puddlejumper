import type Database from 'better-sqlite3';
import { upsertAlert, updateRuleRunStatus } from './store.js';
import type { AlertDomain, AlertSeverity } from './types.js';

const DAY_MS = 24 * 60 * 60 * 1000;

export interface CheckResult {
  domain: AlertDomain;
  status: 'ok' | 'error' | 'skipped';
  alertsFired: number;
  error?: string;
}

// ── PRR SLA Check ─────────────────────────────────────────────────────────────

function checkPrrSla(db: Database.Database, tenantId: string): CheckResult {
  const alertsFired: number[] = [];
  try {
    // Verify the prr table exists
    const tableCheck = db.prepare(
      `SELECT name FROM sqlite_master WHERE type='table' AND name='prr'`
    ).get();
    if (!tableCheck) return { domain: 'compliance', status: 'skipped', alertsFired: 0 };

    const now = Date.now();
    const day8Cutoff = new Date(now - 8 * DAY_MS).toISOString();

    // Open PRR requests older than 8 days
    const openRequests = db.prepare(`
      SELECT id, received_at, status FROM prr
      WHERE tenant_id = ? AND status NOT IN ('closed') AND received_at < ?
    `).all(tenantId, day8Cutoff) as { id: string; received_at: string; status: string }[];

    for (const prr of openRequests) {
      try {
        const ageMs = now - new Date(prr.received_at).getTime();
        const ageDays = ageMs / DAY_MS;

        // Check if any acknowledgement exists in prr_audit
        const ack = db.prepare(`
          SELECT id FROM prr_audit
          WHERE prr_id = ? AND tenant_id = ? AND action IN ('acknowledged', 'in_progress', 'extended', 'closed')
          LIMIT 1
        `).get(prr.id, tenantId);

        if (ack) continue; // Acknowledged — no SLA breach

        const severity: AlertSeverity = ageDays > 10 ? 'critical' : 'high';
        const dayCount = Math.floor(ageDays);

        upsertAlert(db, tenantId, {
          domain: 'compliance',
          severity,
          title: `PRR SLA Breach: Request ${prr.id.slice(0, 8)} past ${dayCount} days`,
          detail: `Public Records Request received ${dayCount} days ago has not been acknowledged. Statutory response deadline may have passed.`,
          affectedObjectType: 'prr_request',
          affectedObjectId: prr.id,
          suggestedAction: 'Review and acknowledge the PRR request immediately to comply with statutory deadlines.',
          deduplicationKey: `prr-sla-${prr.id}`,
        });
        alertsFired.push(1);
      } catch (err) {
        console.warn(`[watchlayer] PRR SLA check failed for request ${prr.id}:`, (err as Error).message);
      }
    }

    updateRuleRunStatus(db, tenantId, 'compliance', 'ok');
    return { domain: 'compliance', status: 'ok', alertsFired: alertsFired.length };
  } catch (err) {
    updateRuleRunStatus(db, tenantId, 'compliance', 'error');
    return { domain: 'compliance', status: 'error', alertsFired: 0, error: (err as Error).message };
  }
}

// ── Org Gaps Check ────────────────────────────────────────────────────────────

function checkOrgGaps(db: Database.Database, tenantId: string): CheckResult {
  try {
    const tableCheck = db.prepare(
      `SELECT name FROM sqlite_master WHERE type='table' AND name='org_positions'`
    ).get();
    if (!tableCheck) {
      return { domain: 'organizational', status: 'skipped', alertsFired: 0 };
    }

    // Vacant positions with authority level >= 4 that have no acting coverage
    const vacantCritical = db.prepare(`
      SELECT p.id, p.authority_level
      FROM org_positions p
      WHERE p.tenant_id = ?
        AND p.employment_status = 'vacant'
        AND p.authority_level >= 4
        AND NOT EXISTS (
          SELECT 1 FROM org_positions coverage
          WHERE coverage.tenant_id = ?
            AND coverage.acting_for_position_id = p.id
        )
    `).all(tenantId, tenantId) as { id: string; authority_level: number }[];

    let count = 0;
    for (const position of vacantCritical) {
      try {
        upsertAlert(db, tenantId, {
          domain: 'organizational',
          severity: 'warning',
          title: `Critical Position Vacant: ${position.id.slice(0, 8)} (Authority Level ${position.authority_level})`,
          detail: `A critical organizational position (authority level ${position.authority_level}) is vacant with no acting coverage assigned.`,
          affectedObjectType: 'org_position',
          affectedObjectId: position.id,
          suggestedAction: 'Assign an acting officer or initiate a hiring process for this position.',
          deduplicationKey: `org-vacant-${position.id}`,
        });
        count++;
      } catch (err) {
        console.warn(`[watchlayer] Org gaps check failed for position ${position.id}:`, (err as Error).message);
      }
    }

    updateRuleRunStatus(db, tenantId, 'organizational', 'ok');
    return { domain: 'organizational', status: 'ok', alertsFired: count };
  } catch (err) {
    updateRuleRunStatus(db, tenantId, 'organizational', 'error');
    return { domain: 'organizational', status: 'error', alertsFired: 0, error: (err as Error).message };
  }
}

// ── Feed Freshness Check ──────────────────────────────────────────────────────

interface FeedRow {
  feed_id: string;
  feed_json: string;
}

interface FeedDef {
  feedId: string;
  tenantId: string;
  displayName: string;
  status: string;
  lastSyncAt?: string;
  syncConfig?: {
    scheduleExpression?: string;
    staleThresholdHours?: number;
  };
}

function checkFeedFreshness(db: Database.Database, tenantId: string): CheckResult {
  try {
    const tableCheck = db.prepare(
      `SELECT name FROM sqlite_master WHERE type='table' AND name='syncronate_feeds'`
    ).get();
    if (!tableCheck) {
      return { domain: 'data_freshness', status: 'skipped', alertsFired: 0 };
    }

    const now = Date.now();
    const feedRows = db.prepare(
      `SELECT feed_id, feed_json FROM syncronate_feeds WHERE tenant_id = ? AND status = 'active'`
    ).all(tenantId) as FeedRow[];

    let count = 0;
    for (const row of feedRows) {
      try {
        const feed: FeedDef = JSON.parse(row.feed_json);
        if (!feed.lastSyncAt) continue; // Never synced — don't alert yet

        const staleThresholdHours = feed.syncConfig?.staleThresholdHours ?? 24;
        const staleThresholdMs = staleThresholdHours * 60 * 60 * 1000;
        const lastSync = new Date(feed.lastSyncAt).getTime();

        if (now - lastSync > staleThresholdMs) {
          const hoursStale = Math.floor((now - lastSync) / (60 * 60 * 1000));
          upsertAlert(db, tenantId, {
            domain: 'data_freshness',
            severity: 'warning',
            title: `Feed Stale: ${feed.displayName ?? feed.feedId}`,
            detail: `Feed "${feed.displayName}" has not synced in ${hoursStale} hours (threshold: ${staleThresholdHours}h). Last sync: ${feed.lastSyncAt}.`,
            affectedObjectType: 'feed',
            affectedObjectId: feed.feedId,
            suggestedAction: 'Check the feed connector configuration and trigger a manual sync if needed.',
            deduplicationKey: `feed-stale-${feed.feedId}`,
          });
          count++;
        }
      } catch (err) {
        console.warn(`[watchlayer] Feed freshness check failed for feed ${row.feed_id}:`, (err as Error).message);
      }
    }

    updateRuleRunStatus(db, tenantId, 'data_freshness', 'ok');
    return { domain: 'data_freshness', status: 'ok', alertsFired: count };
  } catch (err) {
    updateRuleRunStatus(db, tenantId, 'data_freshness', 'error');
    return { domain: 'data_freshness', status: 'error', alertsFired: 0, error: (err as Error).message };
  }
}

// ── Placeholder Checks ────────────────────────────────────────────────────────

function placeholderCheck(domain: AlertDomain): CheckResult {
  return { domain, status: 'skipped', alertsFired: 0 };
}

// ── Main Runner ───────────────────────────────────────────────────────────────

export async function runChecks(db: Database.Database, tenantId: string): Promise<CheckResult[]> {
  const results: CheckResult[] = [];

  const checks: Array<() => CheckResult> = [
    () => checkPrrSla(db, tenantId),
    () => checkOrgGaps(db, tenantId),
    () => checkFeedFreshness(db, tenantId),
    () => placeholderCheck('workflow'),
    () => placeholderCheck('financial'),
    () => placeholderCheck('access'),
    () => placeholderCheck('ai_activity'),
    () => placeholderCheck('environment_health'),
  ];

  for (const check of checks) {
    try {
      results.push(check());
    } catch (err) {
      console.error(`[watchlayer] Unexpected error in check:`, (err as Error).message);
    }
  }

  return results;
}
