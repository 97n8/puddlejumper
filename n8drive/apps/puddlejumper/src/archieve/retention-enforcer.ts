// ── Retention Enforcer (Layer 10 — ARCHIEVE Lifecycle) ───────────────────────
//
// Scans form intake records and archieve events for records that have aged past
// their governing retention schedule, then marks them as deletion-eligible and
// logs a provenance event into the ARCHIEVE hash chain.
//
// Default retention schedules (overridden per record by `regulatory_profile`):
//   hipaa: 6y, gdpr: 3y, sox: 7y, default: 1y
//
// Call `runRetentionPass(db)` from a daily/weekly scheduled job.

import type Database from 'better-sqlite3';
import { archieveLog } from './index.js';
import { getRetentionFloorYears, hasLegalHold } from './retention.js';

export interface RetentionResult {
  scanned: number;
  markedEligible: number;
  skippedLegalHold: number;
  skippedNotDue: number;
}

const YEARS_MS = 365.25 * 24 * 60 * 60 * 1000;

export function runRetentionPass(db: Database.Database): RetentionResult {
  const result: RetentionResult = {
    scanned: 0,
    markedEligible: 0,
    skippedLegalHold: 0,
    skippedNotDue: 0,
  };

  // Ensure deletion_eligible column exists on intake records (migration-safe)
  const intakePragma = db.prepare(
    "SELECT name FROM sqlite_master WHERE type='table' AND name='formkey_intake_records'"
  ).get();

  if (!intakePragma) return result;

  const cols = db.prepare("PRAGMA table_info(formkey_intake_records)").all() as { name: string }[];
  if (!cols.some(c => c.name === 'deletion_eligible')) {
    db.exec("ALTER TABLE formkey_intake_records ADD COLUMN deletion_eligible INTEGER NOT NULL DEFAULT 0");
  }
  if (!cols.some(c => c.name === 'deletion_eligible_at')) {
    db.exec("ALTER TABLE formkey_intake_records ADD COLUMN deletion_eligible_at TEXT");
  }

  const hasTenant = cols.some(c => c.name === 'tenant_id');
  const hasProfile = cols.some(c => c.name === 'regulatory_profile');

  // Query all non-eligible, non-deleted records
  const records = db.prepare(`
    SELECT id, ${hasTenant ? 'tenant_id,' : ''} created_at${hasProfile ? ', regulatory_profile' : ''}
    FROM formkey_intake_records
    WHERE deletion_eligible = 0
    ORDER BY created_at ASC
  `).all() as {
    id: string;
    tenant_id?: string;
    created_at: string;
    regulatory_profile?: string;
  }[];

  const now = Date.now();

  for (const rec of records) {
    result.scanned++;

    const tenantId = rec.tenant_id ?? 'default';
    const profiles = rec.regulatory_profile ? [rec.regulatory_profile] : ['default'];
    const floorYears = getRetentionFloorYears(profiles);
    const eligibleAfterMs = floorYears * YEARS_MS;
    const ageMs = now - new Date(rec.created_at).getTime();

    if (ageMs < eligibleAfterMs) {
      result.skippedNotDue++;
      continue;
    }

    if (hasLegalHold(tenantId, rec.id)) {
      result.skippedLegalHold++;
      continue;
    }

    const eligibleAt = new Date().toISOString();
    db.prepare(`
      UPDATE formkey_intake_records
      SET deletion_eligible = 1, deletion_eligible_at = ?
      WHERE id = ?
    `).run(eligibleAt, rec.id);

    try {
      archieveLog({
        requestId: `retention-${rec.id}-${Date.now()}`,
        tenantId,
        module: 'retention-enforcer',
        eventType: 'RECORD_DELETION_ELIGIBLE',
        severity: 'info',
        actor: { userId: 'system', role: 'retention-enforcer', sessionId: 'system' },
        data: {
          regulatory_profile: profiles,
          floor_years: floorYears,
          age_days: Math.floor(ageMs / (24 * 60 * 60 * 1000)),
          eligible_at: eligibleAt,
        },
      });
    } catch {
      // archieve logging is best-effort
    }

    result.markedEligible++;
  }

  return result;
}
