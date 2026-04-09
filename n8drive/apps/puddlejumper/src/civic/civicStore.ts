/**
 * civicStore.ts — CIVIC V1 SQLite store
 *
 * Manages civic.db: a governed object store for Massachusetts municipalities.
 * Separate from the main approvals.db so civic data is cleanly isolated.
 *
 * Tables: objects, credentials, audit_log, deadlines, exceptions,
 *         templates, setup_progress, object_links
 *
 * All writes to audit_log go through appendAuditLog(). DB triggers block
 * direct UPDATE/DELETE on audit_log (append-only invariant).
 */

import Database from 'better-sqlite3';
import type { Database as DB } from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';

// ── Schema ────────────────────────────────────────────────────────────────────

const SCHEMA = `
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS setup_progress (
  id           TEXT PRIMARY KEY DEFAULT 'singleton',
  town         INTEGER NOT NULL DEFAULT 0,
  identity     INTEGER NOT NULL DEFAULT 0,
  staff        INTEGER NOT NULL DEFAULT 0,
  bodies       INTEGER NOT NULL DEFAULT 0,
  completed_at TEXT,
  completed_by TEXT
);
INSERT OR IGNORE INTO setup_progress (id) VALUES ('singleton');

CREATE TABLE IF NOT EXISTS objects (
  id              TEXT PRIMARY KEY,
  type            TEXT NOT NULL,
  subtype         TEXT NOT NULL,
  stage           TEXT NOT NULL DEFAULT 'RECEIVES',
  status          TEXT NOT NULL DEFAULT 'active',
  owner_id        TEXT,
  authority_basis TEXT,
  vault_class     TEXT NOT NULL DEFAULT 'unset',
  data            TEXT NOT NULL DEFAULT '{}',
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now')),
  deleted_at      TEXT
);
CREATE INDEX IF NOT EXISTS idx_objects_type    ON objects(type, subtype);
CREATE INDEX IF NOT EXISTS idx_objects_owner   ON objects(owner_id);
CREATE INDEX IF NOT EXISTS idx_objects_stage   ON objects(stage);

CREATE TABLE IF NOT EXISTS credentials (
  id            TEXT PRIMARY KEY,
  object_id     TEXT NOT NULL REFERENCES objects(id),
  email         TEXT NOT NULL UNIQUE,
  display_name  TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT 'staff',
  pj_user_id    TEXT,
  active        INTEGER NOT NULL DEFAULT 1,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_cred_email    ON credentials(email);
CREATE INDEX IF NOT EXISTS idx_cred_pj_user  ON credentials(pj_user_id);

CREATE TABLE IF NOT EXISTS audit_log (
  id               TEXT PRIMARY KEY,
  object_id        TEXT,
  actor_id         TEXT NOT NULL,
  actor_display    TEXT,
  action           TEXT NOT NULL,
  before_state     TEXT,
  after_state      TEXT,
  system_triggered INTEGER NOT NULL DEFAULT 0,
  notes            TEXT,
  created_at       TEXT NOT NULL DEFAULT (datetime('now','utc'))
);
CREATE INDEX IF NOT EXISTS idx_audit_object ON audit_log(object_id, created_at);
CREATE INDEX IF NOT EXISTS idx_audit_actor  ON audit_log(actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_sys    ON audit_log(system_triggered);

CREATE TRIGGER IF NOT EXISTS audit_no_update
  BEFORE UPDATE ON audit_log
  BEGIN SELECT RAISE(ABORT, 'audit_log is append-only'); END;
CREATE TRIGGER IF NOT EXISTS audit_no_delete
  BEFORE DELETE ON audit_log
  BEGIN SELECT RAISE(ABORT, 'audit_log is append-only'); END;

CREATE TABLE IF NOT EXISTS deadlines (
  id          TEXT PRIMARY KEY,
  object_id   TEXT REFERENCES objects(id),
  label       TEXT NOT NULL,
  type        TEXT NOT NULL,
  statute_ref TEXT,
  due_at      TEXT NOT NULL,
  owner_id    TEXT REFERENCES objects(id),
  severity    TEXT NOT NULL DEFAULT 'warning',
  status      TEXT NOT NULL DEFAULT 'active',
  resolved_at TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_deadlines_due    ON deadlines(due_at, status);
CREATE INDEX IF NOT EXISTS idx_deadlines_owner  ON deadlines(owner_id);

CREATE TABLE IF NOT EXISTS exceptions (
  id                     TEXT PRIMARY KEY,
  object_id              TEXT REFERENCES objects(id),
  exception_type         TEXT NOT NULL,
  severity               TEXT NOT NULL DEFAULT 'medium',
  title                  TEXT NOT NULL,
  description            TEXT,
  status                 TEXT NOT NULL DEFAULT 'active',
  blocks_action          TEXT,
  acknowledged_by        TEXT,
  acknowledged_at        TEXT,
  acknowledgment_reason  TEXT,
  created_at             TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_exc_status   ON exceptions(status, severity);
CREATE INDEX IF NOT EXISTS idx_exc_object   ON exceptions(object_id);

CREATE TABLE IF NOT EXISTS templates (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  category    TEXT NOT NULL,
  description TEXT,
  body        TEXT NOT NULL,
  variables   TEXT NOT NULL DEFAULT '[]',
  active      INTEGER NOT NULL DEFAULT 1,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS object_links (
  id         TEXT PRIMARY KEY,
  from_id    TEXT NOT NULL REFERENCES objects(id),
  to_id      TEXT NOT NULL REFERENCES objects(id),
  link_type  TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS module_configs (
  module_id       TEXT PRIMARY KEY,
  officer_name    TEXT NOT NULL DEFAULT '',
  officer_title   TEXT NOT NULL DEFAULT '',
  officer_email   TEXT NOT NULL DEFAULT '',
  officer_phone   TEXT NOT NULL DEFAULT '',
  routing         TEXT NOT NULL DEFAULT '{}',
  automations     TEXT NOT NULL DEFAULT '{}',
  retention_years INTEGER NOT NULL DEFAULT 7,
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);
`;

// ── Singleton store ───────────────────────────────────────────────────────────

let _db: DB | null = null;

export function getCivicDb(dataDir: string): DB {
  if (_db) return _db;
  fs.mkdirSync(dataDir, { recursive: true });
  const dbPath = path.join(dataDir, 'civic.db');
  _db = new Database(dbPath);
  _db.pragma('journal_mode = WAL');
  _db.pragma('foreign_keys = ON');
  _db.exec(SCHEMA);
  // Idempotent namespace migrations — scope all per-tenant data by town_id
  const nsCol = (_db.pragma('table_info(objects)') as Array<{ name: string }>).some(c => c.name === 'namespace');
  if (!nsCol) {
    const migrations = [
      'ALTER TABLE objects ADD COLUMN namespace TEXT',
      'ALTER TABLE deadlines ADD COLUMN namespace TEXT',
      'ALTER TABLE exceptions ADD COLUMN namespace TEXT',
      'ALTER TABLE module_configs ADD COLUMN namespace TEXT NOT NULL DEFAULT \'\'',
    ];
    for (const m of migrations) { try { _db.exec(m); } catch {} }
  }
  return _db;
}

// ── Seed ──────────────────────────────────────────────────────────────────────

function uuid() {
  return crypto.randomUUID();
}

function seedIfEmpty(db: DB) {
  const count = (db.prepare('SELECT COUNT(*) as n FROM objects').get() as { n: number }).n;
  if (count > 0) return;

  const now = new Date().toISOString();
  const sevenDays = new Date(Date.now() + 7 * 86400000).toISOString();
  const thirtyDays = new Date(Date.now() + 30 * 86400000).toISOString();
  const tomorrow = new Date(Date.now() + 86400000).toISOString();

  const townId = uuid();
  const actorId = uuid();
  const selectBoardId = uuid();
  const recordsReqId = uuid();
  const procId = uuid();
  const contractId = uuid();
  const permitId = uuid();
  const residentReqId = uuid();

  db.transaction(() => {
    // Town
    db.prepare(`INSERT INTO objects (id,type,subtype,stage,status,vault_class,data,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?)`).run(
      townId, 'body', 'town_profile', 'WORKS', 'active', 'internal',
      JSON.stringify({
        town_name: 'Phillipston', population: 1827, county: 'Worcester',
        governance_form: 'open_town_meeting', dls_muni_code: '50780',
        fiscal_year_end: 'June 30', state: 'MA',
      }),
      now, now
    );

    // Actor: Nate Rondeau
    db.prepare(`INSERT INTO objects (id,type,subtype,stage,status,vault_class,owner_id,data,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)`).run(
      actorId, 'actor', 'staff', 'WORKS', 'active', 'internal', townId,
      JSON.stringify({
        first_name: 'Nate', last_name: 'Rondeau', title: 'Town Administrator',
        town_id: townId, email: 'nate@publiclogic.org',
      }),
      now, now
    );

    // Credential for Nate (no password — PJ session auth)
    db.prepare(`INSERT INTO credentials (id,object_id,email,display_name,role,created_at) VALUES (?,?,?,?,?,?)`).run(
      uuid(), actorId, 'nate@publiclogic.org', 'Nate Rondeau', 'town_administrator', now
    );

    // Select Board
    db.prepare(`INSERT INTO objects (id,type,subtype,stage,status,vault_class,owner_id,data,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)`).run(
      selectBoardId, 'body', 'select_board', 'WORKS', 'active', 'internal', townId,
      JSON.stringify({ name: 'Phillipston Select Board', member_count: 3 }),
      now, now
    );

    // Records Request (day 9 — 1 day remaining)
    db.prepare(`INSERT INTO objects (id,type,subtype,stage,status,vault_class,owner_id,data,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)`).run(
      recordsReqId, 'record', 'records_request', 'WORKS', 'searching', 'internal', actorId,
      JSON.stringify({
        request_number: 'RR-0041', requester: 'Jane Smith',
        subject: 'Town Meeting warrant articles 2023–2024',
        business_days_elapsed: 9, statutory_days: 10,
        statute_ref: 'M.G.L. c.66 §10',
      }),
      now, now
    );

    // Procurement (no owner — triggers ownerless exception)
    db.prepare(`INSERT INTO objects (id,type,subtype,stage,status,vault_class,data,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?)`).run(
      procId, 'workflow', 'procurement', 'RECEIVES', 'open', 'internal',
      JSON.stringify({
        title: 'Custodial Services IFB', estimated_value: 45000,
        proc_path: 'IFB', statute_ref: 'M.G.L. c.30B',
      }),
      now, now
    );

    // Contract
    db.prepare(`INSERT INTO objects (id,type,subtype,stage,status,vault_class,owner_id,data,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)`).run(
      contractId, 'record', 'contract', 'RECORDS', 'executed', 'internal', actorId,
      JSON.stringify({ title: 'Custodial Services Contract FY2024', vendor: 'CleanPro LLC', value: 38500 }),
      now, now
    );

    // Permit application
    db.prepare(`INSERT INTO objects (id,type,subtype,stage,status,vault_class,owner_id,data,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)`).run(
      permitId, 'workflow', 'permit_application', 'WORKS', 'under_review', 'unset', actorId,
      JSON.stringify({ permit_type: 'Building', applicant: 'Tom Jones', address: '12 Main St' }),
      now, now
    );

    // Resident request
    db.prepare(`INSERT INTO objects (id,type,subtype,stage,status,vault_class,owner_id,data,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)`).run(
      residentReqId, 'workflow', 'resident_request', 'WORKS', 'in_progress', 'internal', actorId,
      JSON.stringify({ subject: 'Road repair request — Elm St', requester: 'Bob Williams' }),
      now, now
    );

    // Deadlines
    const todayEnd = new Date(); todayEnd.setHours(23, 59, 59, 0);
    db.prepare(`INSERT INTO deadlines (id,object_id,label,type,statute_ref,due_at,owner_id,severity,status,created_at) VALUES (?,?,?,?,?,?,?,?,?,?)`).run(
      uuid(), null, 'Planning Bd. Notice — Apr 8 Meeting', 'oml', 'M.G.L. c.30A §20',
      todayEnd.toISOString(), actorId, 'critical', 'active', now
    );
    db.prepare(`INSERT INTO deadlines (id,object_id,label,type,statute_ref,due_at,owner_id,severity,status,created_at) VALUES (?,?,?,?,?,?,?,?,?,?)`).run(
      uuid(), recordsReqId, 'Records Req. #0041 — Response Due TOMORROW', 'records',
      'M.G.L. c.66 §10', tomorrow, actorId, 'critical', 'active', now
    );
    db.prepare(`INSERT INTO deadlines (id,object_id,label,type,due_at,owner_id,severity,status,created_at) VALUES (?,?,?,?,?,?,?,?,?)`).run(
      uuid(), contractId, 'Custodial Contract Renewal', 'contractual',
      thirtyDays, actorId, 'warning', 'active', now
    );

    // Exceptions
    db.prepare(`INSERT INTO exceptions (id,object_id,exception_type,severity,title,description,status,blocks_action,created_at) VALUES (?,?,?,?,?,?,?,?,?)`).run(
      'exc-records-critical', recordsReqId, 'records_day9', 'critical',
      'Records Request #0041 — 1 day remaining',
      'This records request has reached business day 9. Response is due tomorrow per M.G.L. c.66 §10. Failure to respond triggers right of appeal.',
      'active', JSON.stringify(['archive', 'publish']), now
    );
    db.prepare(`INSERT INTO exceptions (id,object_id,exception_type,severity,title,description,status,created_at) VALUES (?,?,?,?,?,?,?,?)`).run(
      'exc-ownerless', procId, 'ownerless_object', 'high',
      'Procurement has no owner',
      'The procurement IFB-2024 has no assigned owner. All governed objects must have an authority-basis owner before advancing.',
      'active', now
    );

    // 14 Templates
    const templates = [
      { id: 'tmpl-oml-notice', name: 'OML Meeting Notice (Standard)', cat: 'oml', vars: ['meeting_body', 'meeting_date', 'meeting_time', 'meeting_location', 'agenda_items'] },
      { id: 'tmpl-oml-agenda', name: 'OML Meeting Agenda (Standard)', cat: 'oml', vars: ['meeting_body', 'meeting_date', 'agenda_items', 'chair_name'] },
      { id: 'tmpl-oml-packet', name: 'OML Meeting Packet Cover', cat: 'oml', vars: ['meeting_body', 'meeting_date', 'packet_preparer'] },
      { id: 'tmpl-oml-minutes', name: 'OML Meeting Minutes (Standard)', cat: 'oml', vars: ['meeting_body', 'meeting_date', 'attendees', 'votes', 'motions'] },
      { id: 'tmpl-rr-receipt', name: 'Records Request Receipt', cat: 'records', vars: ['request_number', 'requester_name', 'received_date', 'description'] },
      { id: 'tmpl-rr-response', name: 'Records Request Response', cat: 'records', vars: ['request_number', 'requester_name', 'response_date', 'documents_provided'] },
      { id: 'tmpl-rr-exemption', name: 'Records Request Exemption Notice', cat: 'records', vars: ['request_number', 'requester_name', 'exemption_basis', 'appeal_rights'] },
      { id: 'tmpl-proc-ifb', name: 'c.30B IFB (Standard)', cat: 'procurement', vars: ['project_name', 'estimated_value', 'bid_deadline', 'scope_summary'] },
      { id: 'tmpl-proc-award', name: 'c.30B Award Notice', cat: 'procurement', vars: ['project_name', 'awardee', 'award_amount', 'award_date'] },
      { id: 'tmpl-proc-contract', name: 'c.30B Contract Cover', cat: 'procurement', vars: ['project_name', 'vendor', 'contract_value', 'term_start', 'term_end'] },
      { id: 'tmpl-appt-notice', name: 'Appointment Notice (Standard)', cat: 'governance', vars: ['appointee_name', 'position', 'appointing_body', 'effective_date'] },
      { id: 'tmpl-permit-approval', name: 'Permit Approval Notice', cat: 'permitting', vars: ['applicant', 'permit_type', 'address', 'approval_date', 'conditions'] },
      { id: 'tmpl-permit-denial', name: 'Permit Denial Notice', cat: 'permitting', vars: ['applicant', 'permit_type', 'address', 'denial_reason', 'appeal_deadline'] },
      { id: 'tmpl-grant-closeout', name: 'Grant Closeout Certificate', cat: 'finance', vars: ['grant_name', 'grant_number', 'final_amount', 'period_end', 'certifier_name'] },
    ];

    for (const t of templates) {
      db.prepare(`INSERT INTO templates (id,name,category,body,variables,created_at) VALUES (?,?,?,?,?,?)`).run(
        t.id, t.name, t.cat,
        `[TEMPLATE: ${t.name}]\n\nDear {{recipient_name}},\n\nThis document pertains to the matter referenced above.\n\n[Body content for ${t.name} — customize before use]\n\nSincerely,\n{{sender_name}}\n{{sender_title}}\n{{town_name}}`,
        JSON.stringify(t.vars), now
      );
    }

    // Mark setup as complete — seeded envs are immediately ready
    db.prepare(`
      UPDATE setup_progress SET town=1, identity=1, staff=1, bodies=1,
        completed_at=?, completed_by='system'
      WHERE id='singleton'
    `).run(now);

    // Audit: system seed entry
    db.prepare(`INSERT INTO audit_log (id,object_id,actor_id,actor_display,action,notes,system_triggered,created_at) VALUES (?,?,?,?,?,?,?,?)`).run(
      uuid(), null, 'system', 'PJ System', 'civic.seeded',
      'CIVIC V1 database seeded. Phillipston town profile, Nate Rondeau actor, 5 objects, 3 deadlines, 2 exceptions, 14 templates.',
      1, now
    );
  })();

  console.log('[civic] Database seeded: Phillipston / Nate Rondeau / 14 templates / 2 exceptions / 3 deadlines');
}

// ── Audit helper ──────────────────────────────────────────────────────────────

export function appendAuditLog(db: DB, opts: {
  objectId?: string | null;
  actorId: string;
  actorDisplay?: string;
  action: string;
  beforeState?: unknown;
  afterState?: unknown;
  systemTriggered?: boolean;
  notes?: string;
}) {
  db.prepare(`INSERT INTO audit_log (id,object_id,actor_id,actor_display,action,before_state,after_state,system_triggered,notes,created_at) VALUES (?,?,?,?,?,?,?,?,?,?)`).run(
    crypto.randomUUID(),
    opts.objectId ?? null,
    opts.actorId,
    opts.actorDisplay ?? null,
    opts.action,
    opts.beforeState ? JSON.stringify(opts.beforeState) : null,
    opts.afterState ? JSON.stringify(opts.afterState) : null,
    opts.systemTriggered ? 1 : 0,
    opts.notes ?? null,
    new Date().toISOString()
  );
}

// ── Vault gate ────────────────────────────────────────────────────────────────

export class VaultGateError extends Error {
  constructor(public gates: { gate: string; reason: string }[]) {
    super('VAULT_GATE_FAILED');
    this.name = 'VaultGateError';
  }
}

export function enforceVaultGates(db: DB, objectId: string): void {
  const obj = db.prepare('SELECT * FROM objects WHERE id = ?').get(objectId) as Record<string, string> | undefined;
  if (!obj) throw new VaultGateError([{ gate: 'existence', reason: 'Object not found' }]);

  const gates: { gate: string; reason: string }[] = [];

  if (!obj.vault_class || obj.vault_class === 'unset' || obj.vault_class === '') {
    gates.push({ gate: 'vault_class', reason: 'Object has not been classified (vault_class is unset)' });
  }
  if (!obj.owner_id) {
    gates.push({ gate: 'owner', reason: 'Object has no owner assigned' });
  }
  if (obj.type === 'record' && !obj.authority_basis) {
    gates.push({ gate: 'authority_basis', reason: 'Record objects require an authority basis before status change' });
  }

  const criticalExc = db.prepare(`
    SELECT id, title FROM exceptions
    WHERE object_id = ? AND severity = 'critical' AND status = 'active'
  `).all(objectId) as { id: string; title: string }[];

  if (criticalExc.length > 0) {
    gates.push({
      gate: 'exceptions',
      reason: `Active critical exception(s): ${criticalExc.map(e => e.title).join('; ')}`,
    });
  }

  if (gates.length > 0) throw new VaultGateError(gates);
}
