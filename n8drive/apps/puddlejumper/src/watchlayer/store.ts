import crypto from 'node:crypto';
import type Database from 'better-sqlite3';
import type { WatchAlert, WatchRule, AlertDomain, AlertSeverity, AlertStatus, DigestSummary } from './types.js';

const SEVERITY_RANK: Record<AlertSeverity, number> = {
  info: 1,
  warning: 2,
  high: 3,
  critical: 4,
};

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS watch_alerts (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    domain TEXT NOT NULL,
    severity TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'open',
    title TEXT NOT NULL,
    detail TEXT NOT NULL,
    affected_object_type TEXT,
    affected_object_id TEXT,
    suggested_action TEXT,
    deduplication_key TEXT NOT NULL,
    first_occurred_at TEXT NOT NULL,
    last_occurred_at TEXT NOT NULL,
    occurence_count INTEGER NOT NULL DEFAULT 1,
    resolved_at TEXT,
    resolved_by TEXT,
    resolution_note TEXT,
    created_at TEXT NOT NULL,
    UNIQUE(tenant_id, deduplication_key)
  );
  CREATE INDEX IF NOT EXISTS idx_wa_tenant_status ON watch_alerts(tenant_id, status);
  CREATE INDEX IF NOT EXISTS idx_wa_tenant_domain ON watch_alerts(tenant_id, domain);
  CREATE INDEX IF NOT EXISTS idx_wa_tenant_severity ON watch_alerts(tenant_id, severity);

  CREATE TABLE IF NOT EXISTS watch_rules (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    domain TEXT NOT NULL,
    name TEXT NOT NULL,
    enabled INTEGER NOT NULL DEFAULT 1,
    check_interval_minutes INTEGER NOT NULL DEFAULT 15,
    config TEXT NOT NULL DEFAULT '{}',
    last_run_at TEXT,
    last_run_status TEXT,
    created_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_wr_tenant ON watch_rules(tenant_id);
`;

function rowToAlert(row: Record<string, unknown>): WatchAlert {
  return {
    id: row.id as string,
    tenantId: row.tenant_id as string,
    domain: row.domain as AlertDomain,
    severity: row.severity as AlertSeverity,
    status: row.status as AlertStatus,
    title: row.title as string,
    detail: row.detail as string,
    affectedObjectType: (row.affected_object_type as string) ?? null,
    affectedObjectId: (row.affected_object_id as string) ?? null,
    suggestedAction: (row.suggested_action as string) ?? null,
    deduplicationKey: row.deduplication_key as string,
    firstOccurredAt: row.first_occurred_at as string,
    lastOccurredAt: row.last_occurred_at as string,
    occurenceCount: row.occurence_count as number,
    resolvedAt: (row.resolved_at as string) ?? null,
    resolvedBy: (row.resolved_by as string) ?? null,
    resolutionNote: (row.resolution_note as string) ?? null,
    createdAt: row.created_at as string,
  };
}

function rowToRule(row: Record<string, unknown>): WatchRule {
  return {
    id: row.id as string,
    tenantId: row.tenant_id as string,
    domain: row.domain as AlertDomain,
    name: row.name as string,
    enabled: Boolean(row.enabled),
    checkIntervalMinutes: row.check_interval_minutes as number,
    config: JSON.parse((row.config as string) || '{}') as Record<string, unknown>,
    lastRunAt: (row.last_run_at as string) ?? null,
    lastRunStatus: (row.last_run_status as WatchRule['lastRunStatus']) ?? null,
    createdAt: row.created_at as string,
  };
}

export function initWatchStore(db: Database.Database): void {
  db.exec(SCHEMA);
}

export function upsertAlert(
  db: Database.Database,
  tenantId: string,
  alert: Omit<WatchAlert, 'id' | 'tenantId' | 'createdAt' | 'status' | 'firstOccurredAt' | 'lastOccurredAt' | 'occurenceCount' | 'resolvedAt' | 'resolvedBy' | 'resolutionNote'>
): WatchAlert {
  const now = new Date().toISOString();
  const id = crypto.randomUUID();

  db.prepare(`
    INSERT INTO watch_alerts (
      id, tenant_id, domain, severity, status, title, detail,
      affected_object_type, affected_object_id, suggested_action,
      deduplication_key, first_occurred_at, last_occurred_at,
      occurence_count, resolved_at, resolved_by, resolution_note, created_at
    ) VALUES (?, ?, ?, ?, 'open', ?, ?, ?, ?, ?, ?, ?, ?, 1, NULL, NULL, NULL, ?)
    ON CONFLICT(tenant_id, deduplication_key) DO NOTHING
  `).run(
    id, tenantId, alert.domain, alert.severity, alert.title, alert.detail,
    alert.affectedObjectType, alert.affectedObjectId, alert.suggestedAction,
    alert.deduplicationKey, now, now, now
  );

  // If INSERT was ignored (conflict), update occurrence count, timestamp, and escalate severity
  const existing = db.prepare(
    `SELECT * FROM watch_alerts WHERE tenant_id = ? AND deduplication_key = ?`
  ).get(tenantId, alert.deduplicationKey) as Record<string, unknown>;

  if (existing && existing.id !== id) {
    const currentRank = SEVERITY_RANK[existing.severity as AlertSeverity] ?? 0;
    const newRank = SEVERITY_RANK[alert.severity] ?? 0;
    const escalatedSeverity = newRank > currentRank ? alert.severity : (existing.severity as AlertSeverity);

    // Re-open alert if it was resolved/dismissed and the condition recurred
    const reopen = existing.status === 'resolved' || existing.status === 'dismissed';
    db.prepare(`
      UPDATE watch_alerts
      SET last_occurred_at = ?,
          occurence_count = occurence_count + 1,
          severity = ?,
          status = CASE WHEN status IN ('resolved', 'dismissed') THEN 'open' ELSE status END,
          resolved_at = CASE WHEN ? THEN NULL ELSE resolved_at END,
          resolved_by = CASE WHEN ? THEN NULL ELSE resolved_by END,
          resolution_note = CASE WHEN ? THEN NULL ELSE resolution_note END
      WHERE tenant_id = ? AND deduplication_key = ?
    `).run(now, escalatedSeverity, reopen ? 1 : 0, reopen ? 1 : 0, reopen ? 1 : 0, tenantId, alert.deduplicationKey);
  }

  return rowToAlert(
    db.prepare(`SELECT * FROM watch_alerts WHERE tenant_id = ? AND deduplication_key = ?`)
      .get(tenantId, alert.deduplicationKey) as Record<string, unknown>
  );
}

export interface AlertFilters {
  domain?: AlertDomain;
  severity?: AlertSeverity;
  status?: AlertStatus;
  limit?: number;
  after?: string;  // cursor: last created_at for pagination
}

export function listAlerts(
  db: Database.Database,
  tenantId: string,
  filters: AlertFilters = {}
): WatchAlert[] {
  const { domain, severity, status, limit = 50, after } = filters;

  let sql = `
    SELECT * FROM watch_alerts WHERE tenant_id = ?
  `;
  const params: (string | number)[] = [tenantId];

  if (domain) { sql += ' AND domain = ?'; params.push(domain); }
  if (severity) { sql += ' AND severity = ?'; params.push(severity); }
  if (status) { sql += ' AND status = ?'; params.push(status); }
  if (after) { sql += ' AND created_at < ?'; params.push(after); }

  // Order: critical first (by severity rank), then newest first
  sql += `
    ORDER BY
      CASE severity WHEN 'critical' THEN 4 WHEN 'high' THEN 3 WHEN 'warning' THEN 2 ELSE 1 END DESC,
      created_at DESC
    LIMIT ?
  `;
  params.push(limit);

  const rows = db.prepare(sql).all(...params) as Record<string, unknown>[];
  return rows.map(rowToAlert);
}

export function getAlert(db: Database.Database, id: string, tenantId: string): WatchAlert | null {
  const row = db.prepare(
    `SELECT * FROM watch_alerts WHERE id = ? AND tenant_id = ?`
  ).get(id, tenantId) as Record<string, unknown> | undefined;
  return row ? rowToAlert(row) : null;
}

export function resolveAlert(
  db: Database.Database,
  id: string,
  tenantId: string,
  resolvedBy: string,
  note: string | null
): WatchAlert | null {
  const now = new Date().toISOString();
  db.prepare(`
    UPDATE watch_alerts
    SET status = 'resolved', resolved_at = ?, resolved_by = ?, resolution_note = ?
    WHERE id = ? AND tenant_id = ?
  `).run(now, resolvedBy, note ?? null, id, tenantId);

  return getAlert(db, id, tenantId);
}

export function getDigest(db: Database.Database, tenantId: string): DigestSummary {
  const openAlerts = listAlerts(db, tenantId, { status: 'open', limit: 1000 });

  const bySeverity: Record<string, number> = { info: 0, warning: 0, high: 0, critical: 0 };
  const byDomain: Record<string, number> = {
    data_freshness: 0, organizational: 0, workflow: 0, financial: 0,
    compliance: 0, access: 0, ai_activity: 0, environment_health: 0,
  };

  for (const alert of openAlerts) {
    bySeverity[alert.severity] = (bySeverity[alert.severity] ?? 0) + 1;
    byDomain[alert.domain] = (byDomain[alert.domain] ?? 0) + 1;
  }

  const oldest = openAlerts.length > 0
    ? openAlerts.reduce((a, b) => a.firstOccurredAt < b.firstOccurredAt ? a : b)
    : null;

  const recentCritical = listAlerts(db, tenantId, { status: 'open', severity: 'critical', limit: 5 });

  return {
    tenantId,
    generatedAt: new Date().toISOString(),
    totalOpen: openAlerts.length,
    bySeverity: bySeverity as DigestSummary['bySeverity'],
    byDomain: byDomain as DigestSummary['byDomain'],
    oldestOpenAlert: oldest,
    recentCritical,
  };
}

export function listRules(db: Database.Database, tenantId: string): WatchRule[] {
  const rows = db.prepare(
    `SELECT * FROM watch_rules WHERE tenant_id = ? ORDER BY created_at ASC`
  ).all(tenantId) as Record<string, unknown>[];
  return rows.map(rowToRule);
}

export function upsertRule(db: Database.Database, tenantId: string, rule: Omit<WatchRule, 'id' | 'tenantId' | 'createdAt'>): WatchRule {
  const now = new Date().toISOString();
  const id = crypto.randomUUID();

  db.prepare(`
    INSERT INTO watch_rules (id, tenant_id, domain, name, enabled, check_interval_minutes, config, last_run_at, last_run_status, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT DO NOTHING
  `).run(
    id, tenantId, rule.domain, rule.name, rule.enabled ? 1 : 0,
    rule.checkIntervalMinutes, JSON.stringify(rule.config ?? {}),
    rule.lastRunAt ?? null, rule.lastRunStatus ?? null, now
  );

  return rowToRule(
    db.prepare(`SELECT * FROM watch_rules WHERE tenant_id = ? AND domain = ? AND name = ?`)
      .get(tenantId, rule.domain, rule.name) as Record<string, unknown>
  );
}

export function updateRuleRunStatus(
  db: Database.Database,
  tenantId: string,
  domain: AlertDomain,
  status: 'ok' | 'error' | 'skipped'
): void {
  const now = new Date().toISOString();
  db.prepare(`
    UPDATE watch_rules SET last_run_at = ?, last_run_status = ?
    WHERE tenant_id = ? AND domain = ?
  `).run(now, status, tenantId, domain);
}
