import type Database from 'better-sqlite3';
import { initWatchStore, upsertRule } from './store.js';
import { runChecks, type CheckResult } from './evaluator.js';
import type { AlertDomain } from './types.js';

export type { CheckResult } from './evaluator.js';
export * from './types.js';
export { createWatchRouter } from './api.js';

const DEFAULT_RULES: Array<{
  domain: AlertDomain;
  name: string;
  checkIntervalMinutes: number;
  config: Record<string, unknown>;
}> = [
  { domain: 'compliance', name: 'PRR SLA Monitor', checkIntervalMinutes: 60, config: { slaWarningDays: 8, slaCriticalDays: 10 } },
  { domain: 'organizational', name: 'Org Gap Monitor', checkIntervalMinutes: 120, config: { minAuthorityLevel: 4 } },
  { domain: 'data_freshness', name: 'Feed Freshness Monitor', checkIntervalMinutes: 30, config: { defaultStaleThresholdHours: 24 } },
  { domain: 'workflow', name: 'Workflow Monitor', checkIntervalMinutes: 60, config: {} },
  { domain: 'financial', name: 'Financial Monitor', checkIntervalMinutes: 60, config: {} },
  { domain: 'access', name: 'Access Monitor', checkIntervalMinutes: 60, config: {} },
  { domain: 'ai_activity', name: 'AI Activity Monitor', checkIntervalMinutes: 60, config: {} },
  { domain: 'environment_health', name: 'Environment Health Monitor', checkIntervalMinutes: 15, config: {} },
];

let _schedulerHandle: ReturnType<typeof setInterval> | null = null;

export function initWatchLayer(db: Database.Database): Database.Database {
  initWatchStore(db);

  // Seed default rules for the 'default' tenant
  try {
    for (const rule of DEFAULT_RULES) {
      upsertRule(db, 'default', {
        domain: rule.domain,
        name: rule.name,
        enabled: true,
        checkIntervalMinutes: rule.checkIntervalMinutes,
        config: rule.config,
        lastRunAt: null,
        lastRunStatus: null,
      });
    }
  } catch (err) {
    console.warn('[watchlayer] Failed to seed default rules:', (err as Error).message);
  }

  console.log('[watchlayer] initialized');
  return db;
}

export async function runWatchChecks(db: Database.Database, tenantId: string): Promise<CheckResult[]> {
  return runChecks(db, tenantId);
}

function getAllTenantIds(db: Database.Database): string[] {
  try {
    const rows = db.prepare(
      `SELECT DISTINCT tenant_id FROM watch_rules`
    ).all() as { tenant_id: string }[];
    if (rows.length > 0) return rows.map(r => r.tenant_id);
  } catch { /* fall through */ }

  // Fallback: query prr table for known tenants
  try {
    const rows = db.prepare(
      `SELECT DISTINCT tenant_id FROM prr`
    ).all() as { tenant_id: string }[];
    if (rows.length > 0) return rows.map(r => r.tenant_id);
  } catch { /* fall through */ }

  return ['default'];
}

export function scheduleWatchLayer(db: Database.Database): void {
  if (_schedulerHandle) {
    clearInterval(_schedulerHandle);
  }

  const INTERVAL_MS = 15 * 60 * 1000; // 15 minutes

  const tick = async () => {
    const tenantIds = getAllTenantIds(db);
    for (const tenantId of tenantIds) {
      try {
        const results = await runChecks(db, tenantId);
        const totalAlerts = results.reduce((sum, r) => sum + r.alertsFired, 0);
        const errors = results.filter(r => r.status === 'error');
        if (errors.length > 0) {
          console.warn(`[watchlayer] scheduler: ${errors.length} check(s) errored for tenant ${tenantId}:`,
            errors.map(e => `${e.domain}: ${e.error}`).join('; '));
        }
        if (totalAlerts > 0) {
          console.log(`[watchlayer] scheduler: ${totalAlerts} alert(s) fired for tenant ${tenantId}`);
        }
      } catch (err) {
        console.error(`[watchlayer] scheduler: unexpected error for tenant ${tenantId}:`, (err as Error).message);
      }
    }
  };

  _schedulerHandle = setInterval(tick, INTERVAL_MS);
  console.log('[watchlayer] scheduler started (15m interval)');
}
