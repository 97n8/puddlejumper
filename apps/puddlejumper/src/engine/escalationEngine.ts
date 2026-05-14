// ── Escalation Engine (Layer 5 — VAULT Decision Layer) ───────────────────────
//
// Scans pending approvals that have exceeded their SLA thresholds and escalates
// them to the next authority tier. Designed to be called periodically (e.g.
// from a watch-layer cron or startup scheduler).
//
// SLA tiers:
//   Level 0 (initial):  24h  → escalate to level 1
//   Level 1:            72h  → escalate to level 2 (critical)
//   Level 2+:           96h  → mark as critical-escalated (human intervention)

import type Database from 'better-sqlite3';
import { archieveLog } from '../archieve/index.js';

export interface EscalationSummary {
  escalated: number;
  critical: number;
  skipped: number;
}

const SLA_HOURS: Record<number, number> = {
  0: 24,
  1: 72,
  2: 96,
};

export function runEscalationPass(db: Database.Database): EscalationSummary {
  const summary: EscalationSummary = { escalated: 0, critical: 0, skipped: 0 };

  // Ensure escalation_level column exists (migration-safe)
  const pragmaRows = db.prepare("PRAGMA table_info(approvals)").all() as { name: string }[];
  const hasEscLevel = pragmaRows.some(r => r.name === 'escalation_level');
  const hasTenantId = pragmaRows.some(r => r.name === 'tenant_id');

  if (!hasEscLevel) {
    db.exec("ALTER TABLE approvals ADD COLUMN escalation_level INTEGER NOT NULL DEFAULT 0");
  }

  // Build query based on available columns
  const tenantFilter = hasTenantId ? '' : '';
  const rows = db.prepare(`
    SELECT id, workspace_id, action_intent, created_at, escalation_level
    FROM approvals
    WHERE approval_status = 'pending'
    ORDER BY created_at ASC
  `).all() as {
    id: string;
    workspace_id: string;
    action_intent: string;
    created_at: string;
    escalation_level: number;
  }[];

  const now = Date.now();

  for (const row of rows) {
    const ageHours = (now - new Date(row.created_at).getTime()) / (1000 * 60 * 60);
    const currentLevel = row.escalation_level ?? 0;
    const slaHours = SLA_HOURS[currentLevel] ?? 96;

    if (ageHours < slaHours) {
      summary.skipped++;
      continue;
    }

    const nextLevel = currentLevel + 1;
    const isCritical = nextLevel >= 2;

    db.prepare(`
      UPDATE approvals SET escalation_level = ?, updated_at = ? WHERE id = ?
    `).run(nextLevel, new Date().toISOString(), row.id);

    try {
      archieveLog({
        requestId: `escalation-${row.id}-${Date.now()}`,
        tenantId: row.workspace_id ?? 'default',
        module: 'escalation-engine',
        eventType: 'APPROVAL_ESCALATED',
        severity: isCritical ? 'critical' : 'warn',
        actor: { userId: 'system', role: 'escalation-engine', sessionId: 'system' },
        data: {
          action_intent: row.action_intent,
          age_hours: Math.round(ageHours),
          from_level: currentLevel,
          to_level: nextLevel,
          is_critical: isCritical,
        },
      });
    } catch {
      // archieve logging is best-effort
    }

    if (isCritical) {
      summary.critical++;
    } else {
      summary.escalated++;
    }
  }

  return summary;
}
