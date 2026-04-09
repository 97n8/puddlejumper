import type Database from 'better-sqlite3';
import { upsertAlert, updateRuleRunStatus, upsertBaseline, getBaseline } from './store.js';
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

// ── Workflow Backlog Check ─────────────────────────────────────────────────────

function checkWorkflowBacklog(db: Database.Database, tenantId: string): CheckResult {
  try {
    const tableCheck = db.prepare(
      `SELECT name FROM sqlite_master WHERE type='table' AND name='approvals'`
    ).get();
    if (!tableCheck) return { domain: 'workflow', status: 'skipped', alertsFired: 0 };

    const now = Date.now();
    const sla48h = new Date(now - 48 * 60 * 60 * 1000).toISOString();
    const sla72h = new Date(now - 72 * 60 * 60 * 1000).toISOString();

    // Pending approvals past 72h → critical; past 48h → warning
    const overdueCritical = db.prepare(`
      SELECT id, workflow_type, requested_at FROM approvals
      WHERE tenant_id = ? AND status = 'pending' AND requested_at < ?
    `).all(tenantId, sla72h) as { id: string; workflow_type: string; requested_at: string }[];

    const overdueWarning = db.prepare(`
      SELECT id, workflow_type, requested_at FROM approvals
      WHERE tenant_id = ? AND status = 'pending' AND requested_at >= ? AND requested_at < ?
    `).all(tenantId, sla72h, sla48h) as { id: string; workflow_type: string; requested_at: string }[];

    let count = 0;
    for (const item of overdueCritical) {
      const hoursWaiting = Math.floor((now - new Date(item.requested_at).getTime()) / (60 * 60 * 1000));
      upsertAlert(db, tenantId, {
        domain: 'workflow',
        severity: 'critical',
        title: `Approval Backlog: ${item.workflow_type ?? 'Request'} pending ${hoursWaiting}h`,
        detail: `Approval item ${item.id.slice(0, 8)} (${item.workflow_type}) has been waiting ${hoursWaiting} hours without action — past the 72-hour SLA.`,
        affectedObjectType: 'approval',
        affectedObjectId: item.id,
        suggestedAction: 'Assign and action this approval immediately to clear the backlog.',
        deduplicationKey: `workflow-backlog-${item.id}`,
      });
      count++;
    }
    for (const item of overdueWarning) {
      const hoursWaiting = Math.floor((now - new Date(item.requested_at).getTime()) / (60 * 60 * 1000));
      upsertAlert(db, tenantId, {
        domain: 'workflow',
        severity: 'warning',
        title: `Approaching SLA: ${item.workflow_type ?? 'Approval'} pending ${hoursWaiting}h`,
        detail: `Approval item ${item.id.slice(0, 8)} (${item.workflow_type}) has been waiting ${hoursWaiting} hours — approaching the 72-hour SLA limit.`,
        affectedObjectType: 'approval',
        affectedObjectId: item.id,
        suggestedAction: 'Review this approval soon to avoid missing the SLA.',
        deduplicationKey: `workflow-backlog-${item.id}`,
      });
      count++;
    }

    updateRuleRunStatus(db, tenantId, 'workflow', 'ok');
    return { domain: 'workflow', status: 'ok', alertsFired: count };
  } catch (err) {
    updateRuleRunStatus(db, tenantId, 'workflow', 'error');
    return { domain: 'workflow', status: 'error', alertsFired: 0, error: (err as Error).message };
  }
}

// ── Access Control Drift Check ─────────────────────────────────────────────────

function checkAccessControlDrift(db: Database.Database, tenantId: string): CheckResult {
  try {
    const tableCheck = db.prepare(
      `SELECT name FROM sqlite_master WHERE type='table' AND name='org_positions'`
    ).get();
    if (!tableCheck) return { domain: 'access', status: 'skipped', alertsFired: 0 };

    // Required governance roles that must always have at least one holder or acting assignment
    const REQUIRED_ROLES = ['administrator', 'finance_authority', 'records_authority'];
    let count = 0;

    for (const role of REQUIRED_ROLES) {
      const holders = db.prepare(`
        SELECT COUNT(*) as cnt FROM org_positions
        WHERE tenant_id = ?
          AND employment_status IN ('active', 'acting')
          AND governance_roles LIKE ?
      `).get(tenantId, `%${role}%`) as { cnt: number };

      if (holders.cnt === 0) {
        upsertAlert(db, tenantId, {
          domain: 'access',
          severity: 'high',
          title: `Access Gap: No active holder for role "${role}"`,
          detail: `No active or acting person holds the "${role}" governance role. Critical decisions requiring this role cannot be authorized.`,
          affectedObjectType: 'governance_role',
          affectedObjectId: role,
          suggestedAction: `Assign an active or acting person to the "${role}" governance role.`,
          deduplicationKey: `access-drift-role-${role}`,
        });
        count++;
      }
    }

    updateRuleRunStatus(db, tenantId, 'access', 'ok');
    return { domain: 'access', status: 'ok', alertsFired: count };
  } catch (err) {
    updateRuleRunStatus(db, tenantId, 'access', 'error');
    return { domain: 'access', status: 'error', alertsFired: 0, error: (err as Error).message };
  }
}

// ── Feed Latency Anomaly Check ─────────────────────────────────────────────────

interface SyncJobRow {
  feed_id: string;
  duration_ms: number;
  started_at: string;
  status: string;
}

function checkFeedLatencyAnomalies(db: Database.Database, tenantId: string): CheckResult {
  try {
    const tableCheck = db.prepare(
      `SELECT name FROM sqlite_master WHERE type='table' AND name='syncronate_jobs'`
    ).get();
    if (!tableCheck) return { domain: 'data_freshness', status: 'skipped', alertsFired: 0 };

    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const recentJobs = db.prepare(`
      SELECT feed_id, duration_ms, started_at, status
      FROM syncronate_jobs
      WHERE tenant_id = ? AND started_at > ? AND duration_ms IS NOT NULL
      ORDER BY started_at DESC
    `).all(tenantId, since24h) as SyncJobRow[];

    // Group by feed_id
    const byFeed = new Map<string, SyncJobRow[]>();
    for (const job of recentJobs) {
      if (!byFeed.has(job.feed_id)) byFeed.set(job.feed_id, []);
      byFeed.get(job.feed_id)!.push(job);
    }

    let count = 0;
    for (const [feedId, jobs] of byFeed) {
      const latestJob = jobs[0];
      const avgDuration = jobs.reduce((s, j) => s + j.duration_ms, 0) / jobs.length;

      // Update rolling baseline
      upsertBaseline(db, tenantId, 'data_freshness', `feed-latency-${feedId}`, avgDuration);
      const baseline = getBaseline(db, tenantId, 'data_freshness', `feed-latency-${feedId}`);

      if (baseline && latestJob.duration_ms > baseline * 3) {
        upsertAlert(db, tenantId, {
          domain: 'data_freshness',
          severity: 'warning',
          title: `Feed Latency Anomaly: ${feedId.slice(0, 12)}`,
          detail: `Latest sync took ${Math.round(latestJob.duration_ms / 1000)}s vs baseline ${Math.round(baseline / 1000)}s (${Math.round(latestJob.duration_ms / baseline)}× slower). May indicate upstream degradation.`,
          affectedObjectType: 'feed',
          affectedObjectId: feedId,
          suggestedAction: 'Check upstream connector health and recent sync logs.',
          deduplicationKey: `feed-latency-anomaly-${feedId}`,
        });
        count++;
      }
    }

    return { domain: 'data_freshness', status: 'ok', alertsFired: count };
  } catch (err) {
    return { domain: 'data_freshness', status: 'error', alertsFired: 0, error: (err as Error).message };
  }
}

// ── FormKey SLA Breach Check ───────────────────────────────────────────────────
function checkFormKeySlaBreaches(db: Database.Database, tenantId: string): CheckResult {
  try {
    const tableExists = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='formkey_intake_records'"
    ).get();
    if (!tableExists) return { domain: 'compliance', status: 'ok', alertsFired: 0 };

    const cols = (db.prepare("PRAGMA table_info(formkey_intake_records)").all() as { name: string }[]).map(c => c.name);
    if (!cols.includes('sla_due_at')) return { domain: 'compliance', status: 'ok', alertsFired: 0 };

    const now = new Date().toISOString();
    const breached = db.prepare(`
      SELECT id, form_id, sla_due_at, status
      FROM formkey_intake_records
      WHERE tenant_id = ?
        AND sla_due_at IS NOT NULL
        AND sla_due_at < ?
        AND status NOT IN ('responded', 'closed')
    `).all(tenantId, now) as { id: string; form_id: string; sla_due_at: string; status: string }[];

    let count = 0;
    for (const rec of breached) {
      const hoursOver = Math.round(
        (Date.now() - new Date(rec.sla_due_at).getTime()) / (1000 * 60 * 60)
      );
      upsertAlert(db, tenantId, {
        domain: 'compliance',
        severity: hoursOver > 48 ? 'critical' : 'warning',
        title: `FormKey SLA breach — ${rec.form_id}`,
        detail: `Intake record ${rec.id} is ${hoursOver}h past SLA. Current status: ${rec.status}.`,
        affectedObjectType: 'formkey_intake_record',
        affectedObjectId: rec.id,
        suggestedAction: 'Review and update the intake record status to resolved or responded.',
        deduplicationKey: `fk-sla-${rec.id}`,
      });
      count++;
    }

    return { domain: 'compliance', status: 'ok', alertsFired: count };
  } catch (err) {
    return { domain: 'compliance', status: 'error', alertsFired: 0, error: (err as Error).message };
  }
}

// ── Main Runner ───────────────────────────────────────────────────────────────

export async function runChecks(db: Database.Database, tenantId: string): Promise<CheckResult[]> {
  const results: CheckResult[] = [];

  const checks: Array<() => CheckResult> = [
    () => checkPrrSla(db, tenantId),
    () => checkOrgGaps(db, tenantId),
    () => checkFeedFreshness(db, tenantId),
    () => checkWorkflowBacklog(db, tenantId),
    () => checkAccessControlDrift(db, tenantId),
    () => checkFeedLatencyAnomalies(db, tenantId),
    () => checkFormKeySlaBreaches(db, tenantId),
    () => placeholderCheck('financial'),
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
