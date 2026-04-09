/**
 * aedStore.ts — SQLite persistence layer for the AED × PublicLogic engagement
 *
 * Schema:
 *   actors       — AED users (provisioned from PJ session)
 *   deals        — NMTC transactions with 7-year compliance clocks
 *   obligations  — 31-obligation register (CDE, IRS, QALICB, investor)
 *   qalicbs      — Qualified Active Low-Income Community Businesses
 *   material_events — Append-only material event log
 *   access_register — Federal portal access inventory (AMIS, Grants.gov, etc.)
 *   authority_register — Who can act, sign, and obligate by role
 *   audit_log    — Append-only action record
 */

import Database from 'better-sqlite3';
import path from 'node:path';
import crypto from 'node:crypto';

// ── Types ─────────────────────────────────────────────────────────────────────

export type AEDActor = {
  id: string;
  object_id: string;
  email: string;
  display_name: string;
  role: 'aed_administrator' | 'compliance_officer' | 'staff';
  created_at: string;
  updated_at: string;
};

export type NMTCDeal = {
  id: string;
  name: string;
  deal_number: string;
  qei_amount: number;
  close_date: string;
  year_7_date: string;
  cde_name: string;
  allocation_amount: number;
  status: 'active' | 'monitoring' | 'closed' | 'at_risk';
  vault_class: 'active' | 'archived';
  data: string; // JSON
  created_at: string;
  updated_at: string;
};

export type Obligation = {
  id: string;
  obligation_code: string;
  domain: 'cde' | 'irs' | 'qalicb' | 'investor' | 'organizational' | 'federal_grants' | 'legislative';
  description: string;
  owner_role: string;
  backup_role: string;
  frequency: string;
  statute_ref: string;
  risk_level: 'critical' | 'high' | 'medium' | 'low';
  deal_id: string | null; // null = org-level, deal_id = deal-specific
  status: 'pending' | 'complete' | 'overdue' | 'waived';
  due_date: string | null;
  completed_at: string | null;
  completed_by: string | null;
  created_at: string;
};

export type QALICB = {
  id: string;
  deal_id: string;
  business_name: string;
  census_tract: string;
  county: string;
  state: string;
  qlici_amount: number;
  qualification_date: string;
  last_certified_at: string | null;
  next_cert_due: string | null;
  status: 'qualified' | 'at_risk' | 'disqualified' | 'pending_review';
  contact_name: string;
  contact_email: string;
  data: string; // JSON
  created_at: string;
  updated_at: string;
};

export type MaterialEvent = {
  id: string;
  deal_id: string | null;
  event_type: string;
  description: string;
  discovered_at: string;
  notification_due: string; // +30 days from discovered_at
  notified_at: string | null;
  notified_by: string | null;
  severity: 'critical' | 'high' | 'medium';
  seal_hash: string;
  created_by: string;
  created_at: string;
};

export type AccessRegisterEntry = {
  id: string;
  system_name: string;
  access_level: string;
  holder_role: string;
  backup_role: string;
  last_verified: string;
  next_review: string;
  notes: string;
  created_at: string;
  updated_at: string;
};

// ── DB Init ───────────────────────────────────────────────────────────────────

const dbCache = new Map<string, Database.Database>();

export function getAEDDb(dataDir: string): Database.Database {
  const key = path.resolve(dataDir);
  if (dbCache.has(key)) return dbCache.get(key)!;

  const db = new Database(path.join(dataDir, 'aed.db'));
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  db.exec(`
    CREATE TABLE IF NOT EXISTS actors (
      id TEXT PRIMARY KEY,
      object_id TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      display_name TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'staff',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS deals (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      deal_number TEXT NOT NULL,
      qei_amount REAL NOT NULL DEFAULT 0,
      close_date TEXT NOT NULL,
      year_7_date TEXT NOT NULL,
      cde_name TEXT NOT NULL DEFAULT '',
      allocation_amount REAL NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'active',
      vault_class TEXT NOT NULL DEFAULT 'active',
      data TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS obligations (
      id TEXT PRIMARY KEY,
      obligation_code TEXT NOT NULL,
      domain TEXT NOT NULL,
      description TEXT NOT NULL,
      owner_role TEXT NOT NULL,
      backup_role TEXT NOT NULL DEFAULT '',
      frequency TEXT NOT NULL,
      statute_ref TEXT NOT NULL DEFAULT '',
      risk_level TEXT NOT NULL DEFAULT 'high',
      deal_id TEXT REFERENCES deals(id) ON DELETE CASCADE,
      status TEXT NOT NULL DEFAULT 'pending',
      due_date TEXT,
      completed_at TEXT,
      completed_by TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS qalicbs (
      id TEXT PRIMARY KEY,
      deal_id TEXT NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
      business_name TEXT NOT NULL,
      census_tract TEXT NOT NULL DEFAULT '',
      county TEXT NOT NULL DEFAULT '',
      state TEXT NOT NULL DEFAULT 'MA',
      qlici_amount REAL NOT NULL DEFAULT 0,
      qualification_date TEXT NOT NULL,
      last_certified_at TEXT,
      next_cert_due TEXT,
      status TEXT NOT NULL DEFAULT 'qualified',
      contact_name TEXT NOT NULL DEFAULT '',
      contact_email TEXT NOT NULL DEFAULT '',
      data TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS material_events (
      id TEXT PRIMARY KEY,
      deal_id TEXT REFERENCES deals(id) ON DELETE SET NULL,
      event_type TEXT NOT NULL,
      description TEXT NOT NULL,
      discovered_at TEXT NOT NULL,
      notification_due TEXT NOT NULL,
      notified_at TEXT,
      notified_by TEXT,
      severity TEXT NOT NULL DEFAULT 'high',
      seal_hash TEXT NOT NULL,
      created_by TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS access_register (
      id TEXT PRIMARY KEY,
      system_name TEXT NOT NULL,
      access_level TEXT NOT NULL,
      holder_role TEXT NOT NULL,
      backup_role TEXT NOT NULL DEFAULT '',
      last_verified TEXT NOT NULL,
      next_review TEXT NOT NULL,
      notes TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS authority_register (
      id TEXT PRIMARY KEY,
      authority_category TEXT NOT NULL,
      holder_role TEXT NOT NULL,
      scope TEXT NOT NULL,
      authority_basis TEXT NOT NULL,
      succession TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS audit_log (
      id TEXT PRIMARY KEY,
      actor_id TEXT NOT NULL,
      action TEXT NOT NULL,
      object_id TEXT,
      object_type TEXT,
      before_state TEXT NOT NULL DEFAULT '{}',
      after_state TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL
    );
  `);

  seedAEDDb(db);
  dbCache.set(key, db);
  return db;
}

// ── Seeding ───────────────────────────────────────────────────────────────────

function seedAEDDb(db: Database.Database) {
  const now = new Date().toISOString();

  // Seed access register (AMIS, Grants.gov, etc.)
  const accessCount = (db.prepare('SELECT COUNT(*) as n FROM access_register').get() as { n: number }).n;
  if (accessCount === 0) {
    const entries = [
      { system: 'CDFI Fund AMIS', level: 'AOR — full submission', holder: 'Compliance Officer', backup: 'Executive Director', next: addDays(now, 365) },
      { system: 'Grants.gov', level: 'Authorized Organization Rep', holder: 'Grants Manager', backup: 'CFO', next: addDays(now, 365) },
      { system: 'SAM.gov', level: 'Entity administrator', holder: 'CFO / Finance Director', backup: 'Executive Director', next: addDays(now, 60) },
      { system: 'IRS e-Services', level: 'Tax reporting', holder: 'CFO / Tax Counsel', backup: 'Executive Director', next: addDays(now, 365) },
    ];
    for (const e of entries) {
      db.prepare(`INSERT INTO access_register (id, system_name, access_level, holder_role, backup_role, last_verified, next_review, created_at, updated_at)
                  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .run(crypto.randomUUID(), e.system, e.level, e.holder, e.backup, now, e.next, now, now);
    }
  }

  // Seed authority register
  const authCount = (db.prepare('SELECT COUNT(*) as n FROM authority_register').get() as { n: number }).n;
  if (authCount === 0) {
    const authorities = [
      { cat: 'NMTC Deal Authorization', holder: 'Executive Director', scope: 'Enter NMTC deals, sign CDE agreements, authorize QEI investments', basis: 'AED Operating Agreement / Board Resolution', succession: 'Deputy Director or Board officer' },
      { cat: 'CDFI Fund AMIS Signatory', holder: 'Compliance Officer', scope: 'Submit TLRs, QEI reports, material event notifications', basis: 'AOR designation on file with CDFI Fund', succession: 'Executive Director as backup AOR' },
      { cat: 'Financial Drawdown', holder: 'CFO / Finance Director', scope: 'Authorize draw requests on active grants and NMTC transactions', basis: 'Operating Agreement / Board Resolution', succession: 'Executive Director' },
      { cat: 'Contract Execution', holder: 'Executive Director / COO', scope: 'Execute service contracts up to $250K', basis: 'Operating Agreement / Procurement Policy', succession: 'COO or Deputy Director' },
      { cat: 'Material Event Notification', holder: 'Executive Director / Compliance Officer', scope: 'Notify CDFI Fund within 30 days of material event', basis: 'CDFI Fund Allocation Agreement §8', succession: 'CFO' },
    ];
    for (const a of authorities) {
      db.prepare(`INSERT INTO authority_register (id, authority_category, holder_role, scope, authority_basis, succession, created_at, updated_at)
                  VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
        .run(crypto.randomUUID(), a.cat, a.holder, a.scope, a.basis, a.succession, now, now);
    }
  }

  // Seed org-level obligations
  const obligCount = (db.prepare('SELECT COUNT(*) as n FROM obligations WHERE deal_id IS NULL').get() as { n: number }).n;
  if (obligCount === 0) {
    const orgObligations = [
      { code: 'AED-001', domain: 'organizational', desc: 'Annual financial audit — GAAS/GASB', owner: 'CFO', backup: 'Executive Director', freq: 'Annual', statute: 'GAAS/GASB', risk: 'high' },
      { code: 'AED-002', domain: 'organizational', desc: 'Board meeting minutes — OML protocol, vote recording, retention', owner: 'Board Secretary', backup: 'ED', freq: 'Per meeting', statute: 'MGL c.30A §23', risk: 'high' },
      { code: 'AED-003', domain: 'organizational', desc: 'Conflict of interest disclosures — all board and key staff', owner: 'Board Chair', backup: 'ED', freq: 'Annual', statute: 'MGL c.268A', risk: 'high' },
      { code: 'AED-004', domain: 'organizational', desc: 'SAM.gov registration — active and current', owner: 'CFO', backup: 'Grants Manager', freq: 'Annual renewal', statute: '2 CFR 200', risk: 'critical' },
      { code: 'AED-005', domain: 'organizational', desc: 'Records retention — all series per schedule', owner: 'Records Manager', backup: 'COO', freq: 'Ongoing', statute: 'MGL c.66', risk: 'high' },
      { code: 'AED-007', domain: 'federal_grants', desc: 'Single Audit assessment — track vs. $750K threshold', owner: 'CFO', backup: 'Compliance Officer', freq: 'Monthly', statute: '2 CFR 200.501', risk: 'critical' },
      { code: 'AED-008', domain: 'federal_grants', desc: '2 CFR 200 financial management — records, drawdowns, cost principles', owner: 'CFO', backup: 'Grants Manager', freq: 'Ongoing', statute: '2 CFR 200.302', risk: 'critical' },
      { code: 'AED-013', domain: 'legislative', desc: 'Federal and state program monitoring report', owner: 'PublicLogic', backup: 'Executive Director', freq: 'Monthly', statute: '', risk: 'high' },
    ];
    for (const o of orgObligations) {
      db.prepare(`INSERT INTO obligations (id, obligation_code, domain, description, owner_role, backup_role, frequency, statute_ref, risk_level, deal_id, status, created_at)
                  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, 'pending', ?)`)
        .run(crypto.randomUUID(), o.code, o.domain, o.desc, o.owner, o.backup, o.freq, o.statute, o.risk, now);
    }
  }

  console.log('[aed] Database initialized: access register, authority register, org obligations seeded');
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function addDays(isoDate: string, days: number): string {
  const d = new Date(isoDate);
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

export function computeSealHash(data: Record<string, unknown>): string {
  return crypto.createHash('sha256').update(JSON.stringify(data)).digest('hex');
}

export function appendAEDAuditLog(
  db: Database.Database,
  entry: { actorId: string; action: string; objectId?: string; objectType?: string; afterState?: Record<string, unknown> }
) {
  db.prepare(`INSERT INTO audit_log (id, actor_id, action, object_id, object_type, after_state, created_at)
              VALUES (?, ?, ?, ?, ?, ?, ?)`)
    .run(
      crypto.randomUUID(),
      entry.actorId,
      entry.action,
      entry.objectId ?? null,
      entry.objectType ?? null,
      JSON.stringify(entry.afterState ?? {}),
      new Date().toISOString()
    );
}

// ── Actor Resolution ──────────────────────────────────────────────────────────

export function getAEDActor(
  db: Database.Database,
  userId: string,
  email: string,
  displayName: string,
  role: AEDActor['role']
): AEDActor {
  const existing = db.prepare('SELECT * FROM actors WHERE id = ?').get(userId) as AEDActor | undefined;
  if (existing) return existing;

  const emailConflict = db.prepare('SELECT * FROM actors WHERE email = ? AND id != ?').get(email, userId) as AEDActor | undefined;
  if (emailConflict) {
    // Update the existing record to map to this userId
    const now = new Date().toISOString();
    db.prepare('UPDATE actors SET id = ?, updated_at = ? WHERE email = ?').run(userId, now, email);
    return db.prepare('SELECT * FROM actors WHERE id = ?').get(userId) as AEDActor;
  }

  const now = new Date().toISOString();
  const objectId = crypto.randomUUID();
  db.prepare(`INSERT INTO actors (id, object_id, email, display_name, role, created_at, updated_at)
              VALUES (?, ?, ?, ?, ?, ?, ?)`)
    .run(userId, objectId, email, displayName, role, now, now);
  return db.prepare('SELECT * FROM actors WHERE id = ?').get(userId) as AEDActor;
}

// ── Deal Helpers ──────────────────────────────────────────────────────────────

export function computeYear7Date(closeDate: string): string {
  const d = new Date(closeDate);
  d.setFullYear(d.getFullYear() + 7);
  return d.toISOString().split('T')[0];
}

export function getDealVaultScore(db: Database.Database, dealId: string): number {
  const total = (db.prepare(`SELECT COUNT(*) as n FROM obligations WHERE deal_id = ?`).get(dealId) as { n: number }).n;
  if (total === 0) return 100;
  const complete = (db.prepare(`SELECT COUNT(*) as n FROM obligations WHERE deal_id = ? AND status = 'complete'`).get(dealId) as { n: number }).n;
  const overdue = (db.prepare(`SELECT COUNT(*) as n FROM obligations WHERE deal_id = ? AND status = 'overdue'`).get(dealId) as { n: number }).n;
  return Math.round(Math.max(0, ((complete / total) * 100) - (overdue * 10)));
}

export function seedDealObligations(db: Database.Database, dealId: string, closeDate: string) {
  const now = new Date().toISOString();
  const year7 = computeYear7Date(closeDate);

  // Compute annual TLR deadline (90 days after anniversary of close)
  const closeDay = new Date(closeDate);
  const nextTlr = new Date(closeDay);
  nextTlr.setFullYear(new Date().getFullYear());
  nextTlr.setDate(nextTlr.getDate() + 90);
  if (nextTlr < new Date()) nextTlr.setFullYear(nextTlr.getFullYear() + 1);

  const obligations = [
    { code: 'CDE-001', domain: 'cde', desc: 'Transaction Level Report — AMIS annual submission', owner: 'Compliance Officer / CFO', backup: 'Executive Director', freq: 'Annual', statute: 'CDFI Fund Allocation Agreement', risk: 'critical', due: nextTlr.toISOString().split('T')[0] },
    { code: 'CDE-003', domain: 'cde', desc: 'Material Event Notification — notify CDFI Fund within 30 days', owner: 'ED / Compliance Officer', backup: 'CFO', freq: 'Within 30 days of event', statute: 'Allocation Agreement §8', risk: 'critical', due: null },
    { code: 'CDE-005', domain: 'cde', desc: 'Substantially All Test — 85% of QEI in QLICIs within 12 months', owner: 'CFO / Compliance Officer', backup: 'Executive Director', freq: 'Quarterly', statute: 'IRC §45D(b)(1)(B)', risk: 'critical', due: addDays(now, 90) },
    { code: 'QAL-001', domain: 'qalicb', desc: 'QALICB Annual Certification — location, income, and activity tests', owner: 'Portfolio Manager', backup: 'Compliance Officer', freq: 'Annual per QALICB', statute: 'IRC §45D(d)', risk: 'critical', due: addDays(closeDate, 365) },
    { code: 'IRS-001', domain: 'irs', desc: 'Investor Tax Package — Form 8874 annual data package', owner: 'CFO / Tax Counsel', backup: 'Executive Director', freq: 'Annual — by April 15', statute: 'IRC §45D; Form 8874', risk: 'critical', due: addDays(now, 90) },
    { code: 'INV-001', domain: 'investor', desc: 'QEI Hold Monitoring — confirm investors hold QEI continuously', owner: 'Compliance Officer', backup: 'CFO', freq: 'Annual confirmation', statute: 'IRC §45D(b)(1)(A)', risk: 'critical', due: addDays(closeDate, 365) },
    { code: 'INV-002', domain: 'investor', desc: 'Annual CDE Certification renewal', owner: 'Executive Director', backup: 'Compliance Officer', freq: 'Annual CDFI cycle', statute: 'CDFI Fund CDE Certification', risk: 'critical', due: addDays(now, 180) },
    { code: 'CDE-007', domain: 'cde', desc: 'QLICI principal redeployment — redeploy within 12 months of repayment', owner: 'CFO / Portfolio Manager', backup: 'Executive Director', freq: 'Within 12 months of repayment', statute: 'IRC §45D(b)(1)(B)', risk: 'high', due: null },
    { code: 'CDE-009', domain: 'cde', desc: 'Year 7 exit compliance review — no early exit before anniversary', owner: 'Executive Director / Legal', backup: 'CFO', freq: 'Year 7 only', statute: 'IRC §45D(g)', risk: 'critical', due: year7 },
  ];

  for (const o of obligations) {
    db.prepare(`INSERT INTO obligations (id, obligation_code, domain, description, owner_role, backup_role, frequency, statute_ref, risk_level, deal_id, status, due_date, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)`)
      .run(crypto.randomUUID(), o.code, o.domain, o.desc, o.owner, o.backup, o.freq, o.statute, o.risk, dealId, o.due ?? null, now);
  }
}
