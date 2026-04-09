// ── Unified Task Queue API ────────────────────────────────────────────────────
//
// Aggregates urgent actions from every domain into a single prioritised list
// so the User Guidance Surface (Layer 8) can show "Do this next" tasks.
//
// Routes:
//   GET /api/tasks            — list tasks for the caller's tenant
//   GET /api/tasks/count      — fast count of pending tasks (for badges)

import express from 'express';
import type Database from 'better-sqlite3';
import { getAuthContext, requireAuthenticated } from '@publiclogic/core';

export interface TaskItem {
  id: string;
  domain: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  detail: string;
  dueBy?: string;
  actionUrl?: string;
  affectedObjectType?: string;
  affectedObjectId?: string;
  source: 'watch_alert' | 'approval' | 'pending_rule' | 'expiring_license';
  createdAt: string;
}

export function createTasksRoutes(opts: { db: Database.Database }): express.Router {
  const { db } = opts;
  const router = express.Router();
  router.use(requireAuthenticated());

  function auth(req: express.Request) {
    const ctx = getAuthContext(req)!;
    return { tenantId: ctx.tenantId ?? '', userId: ctx.userId ?? '' };
  }

  // ── GET /api/tasks ─────────────────────────────────────────────────────────

  router.get('/tasks', (req, res) => {
    const { tenantId } = auth(req);
    const tasks: TaskItem[] = [];

    // 1. Open WatchLayer alerts (critical + high)
    try {
      const alertsTable = db.prepare(
        `SELECT name FROM sqlite_master WHERE type='table' AND name='watch_alerts'`
      ).get();
      if (alertsTable) {
        const alerts = db.prepare(`
          SELECT id, domain, severity, title, detail, affected_object_type, affected_object_id,
                 suggested_action, first_seen_at
          FROM watch_alerts
          WHERE tenant_id = ? AND status = 'open' AND severity IN ('critical', 'high')
          ORDER BY CASE severity WHEN 'critical' THEN 0 WHEN 'high' THEN 1 ELSE 2 END,
                   first_seen_at ASC
          LIMIT 20
        `).all(tenantId) as {
          id: string; domain: string; severity: string; title: string; detail: string;
          affected_object_type: string | null; affected_object_id: string | null;
          suggested_action: string | null; first_seen_at: string;
        }[];

        for (const a of alerts) {
          tasks.push({
            id: `alert-${a.id}`,
            domain: a.domain,
            priority: a.severity as 'critical' | 'high',
            title: a.title,
            detail: a.suggested_action ?? a.detail,
            affectedObjectType: a.affected_object_type ?? undefined,
            affectedObjectId: a.affected_object_id ?? undefined,
            source: 'watch_alert',
            createdAt: a.first_seen_at,
          });
        }
      }
    } catch (err) {
      console.warn('[tasks] watch_alerts query failed:', (err as Error).message);
    }

    // 2. Pending approvals past 24h (stale)
    try {
      const approvalsTable = db.prepare(
        `SELECT name FROM sqlite_master WHERE type='table' AND name='approvals'`
      ).get();
      if (approvalsTable) {
        const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        const approvals = db.prepare(`
          SELECT id, workflow_type, requested_at, requested_by, assigned_to
          FROM approvals
          WHERE tenant_id = ? AND status = 'pending' AND requested_at < ?
          ORDER BY requested_at ASC
          LIMIT 10
        `).all(tenantId, since24h) as {
          id: string; workflow_type: string; requested_at: string;
          requested_by: string | null; assigned_to: string | null;
        }[];

        for (const a of approvals) {
          const hoursWaiting = Math.floor((Date.now() - new Date(a.requested_at).getTime()) / (60 * 60 * 1000));
          tasks.push({
            id: `approval-${a.id}`,
            domain: 'workflow',
            priority: hoursWaiting > 72 ? 'critical' : 'high',
            title: `Approval needed: ${a.workflow_type ?? 'Request'}`,
            detail: `Pending ${hoursWaiting} hours${a.requested_by ? ` — requested by ${a.requested_by}` : ''}. Action required.`,
            affectedObjectType: 'approval',
            affectedObjectId: a.id,
            actionUrl: `/approvals/${a.id}`,
            source: 'approval',
            createdAt: a.requested_at,
          });
        }
      }
    } catch (err) {
      console.warn('[tasks] approvals query failed:', (err as Error).message);
    }

    // 3. Pending AI rules awaiting approval
    try {
      const rulesTable = db.prepare(
        `SELECT name FROM sqlite_master WHERE type='table' AND name='archieve_rules'`
      ).get();
      if (rulesTable) {
        const pending = db.prepare(`
          SELECT id, title, category, created_at FROM archieve_rules
          WHERE tenant_id = ? AND status = 'pending'
          ORDER BY created_at ASC
          LIMIT 5
        `).all(tenantId) as { id: string; title: string; category: string; created_at: string }[];

        for (const r of pending) {
          tasks.push({
            id: `rule-${r.id}`,
            domain: 'governance',
            priority: 'medium',
            title: `Review AI rule: "${r.title}"`,
            detail: `An AI-suggested ${r.category} rule is pending your approval before it can go live.`,
            affectedObjectType: 'archieve_rule',
            affectedObjectId: r.id,
            actionUrl: '/govai?tab=pending',
            source: 'pending_rule',
            createdAt: r.created_at,
          });
        }
      }
    } catch (err) {
      console.warn('[tasks] archieve_rules query failed:', (err as Error).message);
    }

    // 4. Expiring licenses (within 30 days)
    try {
      const dogTable = db.prepare(
        `SELECT name FROM sqlite_master WHERE type='table' AND name='dog_licenses'`
      ).get();
      if (dogTable) {
        const soon = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
        const today = new Date().toISOString().slice(0, 10);
        const expiring = db.prepare(`
          SELECT id, owner_name, dog_name, expiry_date FROM dog_licenses
          WHERE tenant_id = ? AND expiry_date BETWEEN ? AND ? AND status = 'active'
          ORDER BY expiry_date ASC
          LIMIT 10
        `).all(tenantId, today, soon) as {
          id: string; owner_name: string; dog_name: string; expiry_date: string;
        }[];

        for (const lic of expiring) {
          const daysLeft = Math.ceil((new Date(lic.expiry_date).getTime() - Date.now()) / (24 * 60 * 60 * 1000));
          tasks.push({
            id: `license-${lic.id}`,
            domain: 'compliance',
            priority: daysLeft <= 7 ? 'high' : 'medium',
            title: `License expiring: ${lic.dog_name} (${lic.owner_name})`,
            detail: `Dog license expires in ${daysLeft} day${daysLeft !== 1 ? 's' : ''} on ${lic.expiry_date}. Send renewal notice.`,
            affectedObjectType: 'dog_license',
            affectedObjectId: lic.id,
            dueBy: lic.expiry_date,
            source: 'expiring_license',
            createdAt: new Date().toISOString(),
          });
        }
      }
    } catch (err) {
      console.warn('[tasks] dog_licenses query failed:', (err as Error).message);
    }

    // Sort: critical first, then high, then by date
    const PRIORITY_ORDER = { critical: 0, high: 1, medium: 2, low: 3 };
    tasks.sort((a, b) =>
      PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority] ||
      new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );

    res.json({ tasks, total: tasks.length });
  });

  // ── GET /api/tasks/count ──────────────────────────────────────────────────

  router.get('/tasks/count', (req, res) => {
    const { tenantId } = auth(req);
    let count = 0;

    try {
      const alertsTable = db.prepare(
        `SELECT name FROM sqlite_master WHERE type='table' AND name='watch_alerts'`
      ).get();
      if (alertsTable) {
        const r = db.prepare(
          `SELECT COUNT(*) as n FROM watch_alerts WHERE tenant_id=? AND status='open' AND severity IN ('critical','high')`
        ).get(tenantId) as { n: number };
        count += r.n;
      }
    } catch { /* skip */ }

    try {
      const approvalsTable = db.prepare(
        `SELECT name FROM sqlite_master WHERE type='table' AND name='approvals'`
      ).get();
      if (approvalsTable) {
        const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        const r = db.prepare(
          `SELECT COUNT(*) as n FROM approvals WHERE tenant_id=? AND status='pending' AND requested_at<?`
        ).get(tenantId, since24h) as { n: number };
        count += r.n;
      }
    } catch { /* skip */ }

    try {
      const rulesTable = db.prepare(
        `SELECT name FROM sqlite_master WHERE type='table' AND name='archieve_rules'`
      ).get();
      if (rulesTable) {
        const r = db.prepare(
          `SELECT COUNT(*) as n FROM archieve_rules WHERE tenant_id=? AND status='pending'`
        ).get(tenantId) as { n: number };
        count += r.n;
      }
    } catch { /* skip */ }

    res.json({ count });
  });

  return router;
}
