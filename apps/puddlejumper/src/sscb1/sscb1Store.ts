/**
 * sscb1Store.ts — SQLite persistence layer for the SSCB1 Swansea SC Biochar 1 casespace
 *
 * Schema:
 *   sscb1_actors          — project participants (provisioned from PJ session)
 *   sscb1_cases           — project case record
 *   sscb1_sources         — source documents
 *   sscb1_assumptions     — working assumption register
 *   sscb1_stack_items     — capital stack layers
 *   sscb1_risks           — risk register
 *   sscb1_itc_items       — ITC basis and recapture tracking
 *   sscb1_open_items      — open items / action register
 *   sscb1_decisions       — decision log
 *   sscb1_stop_rules      — procedural stop rules
 *   sscb1_cadence_events  — meeting cadence tracker
 *   sscb1_milestones      — project milestones
 *   sscb1_audit_log       — append-only audit trail
 */

import Database from 'better-sqlite3';
import path from 'node:path';
import crypto from 'node:crypto';

// ── Types ─────────────────────────────────────────────────────────────────────

export type SSCB1ActorRole = 'pl_admin' | 'aed_executive' | 'editor' | 'reviewer' | 'readonly';

export type SSCB1Actor = {
  id: string;
  object_id: string;
  display_name: string;
  email: string;
  role: SSCB1ActorRole;
  created_at: string;
};

export type SSCB1Case = {
  id: string;
  case_name: string;
  case_number: string;
  description: string;
  state: 'active' | 'at_close' | 'handoff' | 'closed';
  phase: string;
  primary_party_pl: string;
  primary_party_aed: string;
  control_version: string;
  last_updated: string | null;
  last_updated_by: string | null;
  created_at: string;
};

export type SSCB1Source = {
  id: string;
  source_id_label: string;
  source_type: string;
  title: string;
  originating_party: string | null;
  date_received: string | null;
  effective_date: string | null;
  uploaded_by: string | null;
  attributed_owner: string | null;
  linked_issue: string | null;
  confidence_level: 'high' | 'medium' | 'low' | 'unverified';
  normalization_status: 'raw' | 'normalized' | 'superseded';
  citation_note: string | null;
  document_url: string | null;
  supersedes_id: string | null;
  superseded_by_id: string | null;
  case_id: string;
  created_at: string;
  seal_hash: string;
};

export type SSCB1Assumption = {
  id: string;
  assumption_id_label: string;
  statement: string;
  category: string;
  source_ref: string | null;
  source_date: string | null;
  originating_document: string | null;
  confidence: 'firm' | 'working' | 'estimate';
  owner: string | null;
  impact_area: string | null;
  dependent_records: string | null;
  validation_due: string | null;
  validation_status: 'unvalidated' | 'in_review' | 'validated' | 'invalidated';
  status_notes: string | null;
  last_reviewed: string | null;
  case_id: string;
  created_at: string;
  updated_at: string;
  seal_hash: string;
};

export type SSCB1StackItem = {
  id: string;
  stack_item_id_label: string;
  layer_name: string;
  layer_type: string | null;
  amount: number;
  currency: string;
  expected_timing: string | null;
  status: string;
  owner: string | null;
  counterparties: string | null;
  dependency: string | null;
  next_action: string | null;
  next_action_due: string | null;
  risk_watch_point: string | null;
  current_blocker: string | null;
  evidence_link: string | null;
  confidence_status: 'high' | 'medium' | 'low' | 'working';
  gate_linked: number; // SQLite stores booleans as 0/1
  case_id: string;
  created_at: string;
  updated_at: string;
  seal_hash: string;
};

export type SSCB1Risk = {
  id: string;
  risk_id_label: string;
  title: string;
  description: string | null;
  category: string | null;
  severity: 'critical' | 'high' | 'watch' | 'low';
  sequence_impact: string | null;
  likelihood: string | null;
  owner: string | null;
  trigger_condition: string | null;
  mitigation_plan: string | null;
  status: 'open' | 'mitigated' | 'accepted' | 'closed';
  linked_assumptions: string | null;
  linked_stack_item: string | null;
  linked_milestone: string | null;
  escalation_level: string | null;
  date_opened: string | null;
  last_reviewed: string | null;
  closure_criteria: string | null;
  case_id: string;
  created_at: string;
  updated_at: string;
  seal_hash: string;
};

export type SSCB1ITCItem = {
  id: string;
  itc_item_id_label: string;
  eligible_equipment: string | null;
  estimated_basis: number;
  final_basis: number | null;
  placed_in_service_date: string | null;
  itc_amount: number | null;
  itc_rate: number;
  recapture_yr1: number | null;
  recapture_yr2: number | null;
  recapture_yr3: number | null;
  recapture_yr4: number | null;
  recapture_yr5: number | null;
  counsel_engaged: number;
  tax_opinion_status: 'not_started' | 'in_progress' | 'received' | 'final';
  ownership_entity: string | null;
  supporting_documents: string | null;
  exposure_notes: string | null;
  recapture_risk_flag: number;
  itc_basis_finalized: number;
  case_id: string;
  created_at: string;
  updated_at: string;
  seal_hash: string;
};

export type SSCB1OpenItem = {
  id: string;
  open_item_id_label: string;
  title: string;
  item_type: string;
  linked_record: string | null;
  owner: string | null;
  requested_from: string | null;
  requested_date: string | null;
  target_resolution_date: string | null;
  blocker_severity: 'critical' | 'high' | 'medium' | 'low';
  close_condition: string | null;
  current_note: string | null;
  escalation_state: string | null;
  status: 'open' | 'in_progress' | 'resolved' | 'accepted_risk';
  resolved_date: string | null;
  resolved_by: string | null;
  resolution_note: string | null;
  case_id: string;
  created_at: string;
  updated_at: string;
  seal_hash: string;
};

export type SSCB1Decision = {
  id: string;
  decision_id_label: string;
  decision_statement: string;
  option_set: string; // JSON array
  requesting_party: string | null;
  decision_owner: string | null;
  due_date: string | null;
  source_basis: string | null;
  impacted_records: string | null;
  chosen_option: string | null;
  decision_date: string | null;
  rationale: string | null;
  unresolved_dependencies: string | null;
  downstream_actions: string | null;
  status: 'pending' | 'decided' | 'deferred' | 'cancelled';
  case_id: string;
  created_at: string;
  updated_at: string;
  seal_hash: string;
};

export type SSCB1StopRule = {
  id: string;
  rule_id_label: string;
  rule_statement: string;
  trigger_condition: string | null;
  prohibited_actions: string | null;
  evidence_required: string | null;
  owner: string | null;
  active: number;
  cleared_date: string | null;
  cleared_by: string | null;
  clearance_evidence: string | null;
  linked_risks: string | null;
  linked_assumptions: string | null;
  linked_agreements: string | null;
  case_id: string;
  created_at: string;
  updated_at: string;
  seal_hash: string;
};

export type SSCB1CadenceEvent = {
  id: string;
  cadence_id_label: string;
  meeting_type: string;
  frequency: string | null;
  required_attendees: string | null;
  scheduled_date: string | null;
  completed_date: string | null;
  agenda_source: string | null;
  action_count: number | null;
  decisions_made: string | null;
  risk_changes: string | null;
  assumption_changes: string | null;
  stack_changes: string | null;
  unresolved_carryforwards: string | null;
  output_export_link: string | null;
  status: 'scheduled' | 'completed' | 'cancelled';
  notes: string | null;
  case_id: string;
  created_at: string;
  updated_at: string;
  seal_hash: string;
};

export type SSCB1Milestone = {
  id: string;
  milestone_id_label: string;
  title: string;
  description: string | null;
  milestone_type: string | null;
  target_date: string | null;
  completed_date: string | null;
  owner: string | null;
  dependencies: string | null;
  status: 'pending' | 'in_progress' | 'complete' | 'blocked' | 'at_risk';
  case_id: string;
  created_at: string;
  updated_at: string;
  seal_hash: string;
};

export type SSCB1AuditEntry = {
  id: string;
  table_name: string;
  record_id: string | null;
  action: string;
  actor_id: string | null;
  actor_name: string | null;
  changes_json: string;
  case_id: string;
  created_at: string;
  seal_hash: string;
};

// ── DB Cache ──────────────────────────────────────────────────────────────────

const dbCache = new Map<string, Database.Database>();

export function getSSCB1Db(dataDir: string): Database.Database {
  const key = path.resolve(dataDir);
  if (dbCache.has(key)) return dbCache.get(key)!;

  const db = new Database(path.join(dataDir, 'sscb1.db'));
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  db.exec(`
    CREATE TABLE IF NOT EXISTS sscb1_actors (
      id TEXT PRIMARY KEY,
      object_id TEXT NOT NULL,
      display_name TEXT NOT NULL DEFAULT '',
      email TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'readonly',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sscb1_cases (
      id TEXT PRIMARY KEY,
      case_name TEXT NOT NULL,
      case_number TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      state TEXT NOT NULL DEFAULT 'active',
      phase TEXT NOT NULL DEFAULT 'pre_ntp',
      primary_party_pl TEXT NOT NULL DEFAULT '',
      primary_party_aed TEXT NOT NULL DEFAULT '',
      control_version TEXT NOT NULL DEFAULT 'V1-DRAFT',
      last_updated TEXT,
      last_updated_by TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sscb1_sources (
      id TEXT PRIMARY KEY,
      source_id_label TEXT NOT NULL,
      source_type TEXT NOT NULL DEFAULT 'other',
      title TEXT NOT NULL,
      originating_party TEXT,
      date_received TEXT,
      effective_date TEXT,
      uploaded_by TEXT,
      attributed_owner TEXT,
      linked_issue TEXT,
      confidence_level TEXT NOT NULL DEFAULT 'unverified',
      normalization_status TEXT NOT NULL DEFAULT 'raw',
      citation_note TEXT,
      document_url TEXT,
      supersedes_id TEXT,
      superseded_by_id TEXT,
      case_id TEXT NOT NULL REFERENCES sscb1_cases(id),
      created_at TEXT NOT NULL,
      seal_hash TEXT NOT NULL DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS sscb1_assumptions (
      id TEXT PRIMARY KEY,
      assumption_id_label TEXT NOT NULL,
      statement TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT 'commercial',
      source_ref TEXT,
      source_date TEXT,
      originating_document TEXT,
      confidence TEXT NOT NULL DEFAULT 'working',
      owner TEXT,
      impact_area TEXT,
      dependent_records TEXT,
      validation_due TEXT,
      validation_status TEXT NOT NULL DEFAULT 'unvalidated',
      status_notes TEXT,
      last_reviewed TEXT,
      case_id TEXT NOT NULL REFERENCES sscb1_cases(id),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      seal_hash TEXT NOT NULL DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS sscb1_stack_items (
      id TEXT PRIMARY KEY,
      stack_item_id_label TEXT NOT NULL,
      layer_name TEXT NOT NULL,
      layer_type TEXT,
      amount REAL NOT NULL DEFAULT 0,
      currency TEXT NOT NULL DEFAULT 'USD',
      expected_timing TEXT,
      status TEXT NOT NULL DEFAULT 'conceptual',
      owner TEXT,
      counterparties TEXT,
      dependency TEXT,
      next_action TEXT,
      next_action_due TEXT,
      risk_watch_point TEXT,
      current_blocker TEXT,
      evidence_link TEXT,
      confidence_status TEXT NOT NULL DEFAULT 'working',
      gate_linked INTEGER NOT NULL DEFAULT 0,
      case_id TEXT NOT NULL REFERENCES sscb1_cases(id),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      seal_hash TEXT NOT NULL DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS sscb1_risks (
      id TEXT PRIMARY KEY,
      risk_id_label TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      category TEXT,
      severity TEXT NOT NULL DEFAULT 'high',
      sequence_impact TEXT,
      likelihood TEXT,
      owner TEXT,
      trigger_condition TEXT,
      mitigation_plan TEXT,
      status TEXT NOT NULL DEFAULT 'open',
      linked_assumptions TEXT,
      linked_stack_item TEXT,
      linked_milestone TEXT,
      escalation_level TEXT,
      date_opened TEXT,
      last_reviewed TEXT,
      closure_criteria TEXT,
      case_id TEXT NOT NULL REFERENCES sscb1_cases(id),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      seal_hash TEXT NOT NULL DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS sscb1_itc_items (
      id TEXT PRIMARY KEY,
      itc_item_id_label TEXT NOT NULL,
      eligible_equipment TEXT,
      estimated_basis REAL NOT NULL DEFAULT 0,
      final_basis REAL,
      placed_in_service_date TEXT,
      itc_amount REAL,
      itc_rate REAL NOT NULL DEFAULT 0.3,
      recapture_yr1 REAL,
      recapture_yr2 REAL,
      recapture_yr3 REAL,
      recapture_yr4 REAL,
      recapture_yr5 REAL,
      counsel_engaged INTEGER NOT NULL DEFAULT 0,
      tax_opinion_status TEXT NOT NULL DEFAULT 'not_started',
      ownership_entity TEXT,
      supporting_documents TEXT,
      exposure_notes TEXT,
      recapture_risk_flag INTEGER NOT NULL DEFAULT 0,
      itc_basis_finalized INTEGER NOT NULL DEFAULT 0,
      case_id TEXT NOT NULL REFERENCES sscb1_cases(id),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      seal_hash TEXT NOT NULL DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS sscb1_open_items (
      id TEXT PRIMARY KEY,
      open_item_id_label TEXT NOT NULL,
      title TEXT NOT NULL,
      item_type TEXT NOT NULL DEFAULT 'pending_decision',
      linked_record TEXT,
      owner TEXT,
      requested_from TEXT,
      requested_date TEXT,
      target_resolution_date TEXT,
      blocker_severity TEXT NOT NULL DEFAULT 'medium',
      close_condition TEXT,
      current_note TEXT,
      escalation_state TEXT,
      status TEXT NOT NULL DEFAULT 'open',
      resolved_date TEXT,
      resolved_by TEXT,
      resolution_note TEXT,
      case_id TEXT NOT NULL REFERENCES sscb1_cases(id),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      seal_hash TEXT NOT NULL DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS sscb1_decisions (
      id TEXT PRIMARY KEY,
      decision_id_label TEXT NOT NULL,
      decision_statement TEXT NOT NULL,
      option_set TEXT NOT NULL DEFAULT '[]',
      requesting_party TEXT,
      decision_owner TEXT,
      due_date TEXT,
      source_basis TEXT,
      impacted_records TEXT,
      chosen_option TEXT,
      decision_date TEXT,
      rationale TEXT,
      unresolved_dependencies TEXT,
      downstream_actions TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      case_id TEXT NOT NULL REFERENCES sscb1_cases(id),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      seal_hash TEXT NOT NULL DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS sscb1_stop_rules (
      id TEXT PRIMARY KEY,
      rule_id_label TEXT NOT NULL,
      rule_statement TEXT NOT NULL,
      trigger_condition TEXT,
      prohibited_actions TEXT,
      evidence_required TEXT,
      owner TEXT,
      active INTEGER NOT NULL DEFAULT 1,
      cleared_date TEXT,
      cleared_by TEXT,
      clearance_evidence TEXT,
      linked_risks TEXT,
      linked_assumptions TEXT,
      linked_agreements TEXT,
      case_id TEXT NOT NULL REFERENCES sscb1_cases(id),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      seal_hash TEXT NOT NULL DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS sscb1_cadence_events (
      id TEXT PRIMARY KEY,
      cadence_id_label TEXT NOT NULL,
      meeting_type TEXT NOT NULL,
      frequency TEXT,
      required_attendees TEXT,
      scheduled_date TEXT,
      completed_date TEXT,
      agenda_source TEXT,
      action_count INTEGER,
      decisions_made TEXT,
      risk_changes TEXT,
      assumption_changes TEXT,
      stack_changes TEXT,
      unresolved_carryforwards TEXT,
      output_export_link TEXT,
      status TEXT NOT NULL DEFAULT 'scheduled',
      notes TEXT,
      case_id TEXT NOT NULL REFERENCES sscb1_cases(id),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      seal_hash TEXT NOT NULL DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS sscb1_milestones (
      id TEXT PRIMARY KEY,
      milestone_id_label TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      milestone_type TEXT,
      target_date TEXT,
      completed_date TEXT,
      owner TEXT,
      dependencies TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      case_id TEXT NOT NULL REFERENCES sscb1_cases(id),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      seal_hash TEXT NOT NULL DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS sscb1_audit_log (
      id TEXT PRIMARY KEY,
      table_name TEXT NOT NULL,
      record_id TEXT,
      action TEXT NOT NULL,
      actor_id TEXT,
      actor_name TEXT,
      changes_json TEXT NOT NULL DEFAULT '{}',
      case_id TEXT NOT NULL,
      created_at TEXT NOT NULL,
      seal_hash TEXT NOT NULL DEFAULT ''
    );
  `);

  seedSSCB1Db(db);
  dbCache.set(key, db);
  return db;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function addDays(isoDate: string, days: number): string {
  const d = new Date(isoDate);
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

function nextWeekday(weekday: number): string {
  // weekday: 0=Sun, 1=Mon ... 4=Thu, 5=Fri
  const d = new Date();
  const diff = (weekday - d.getDay() + 7) % 7 || 7;
  d.setDate(d.getDate() + diff);
  return d.toISOString().split('T')[0]!;
}

export function generateSealHash(data: Record<string, unknown> | string): string {
  const content = typeof data === 'string' ? data : JSON.stringify(data);
  return crypto.createHash('sha256').update(content).digest('hex');
}

export function appendAuditLog(
  db: Database.Database,
  caseId: string,
  tableName: string,
  recordId: string | null,
  action: string,
  actorId: string | null,
  actorName: string | null,
  changesJson: Record<string, unknown>
): void {
  const now = new Date().toISOString();
  const changes = JSON.stringify(changesJson);
  const seal = generateSealHash({ caseId, tableName, recordId, action, actorId, changes, ts: now });
  db.prepare(`
    INSERT INTO sscb1_audit_log (id, table_name, record_id, action, actor_id, actor_name, changes_json, case_id, created_at, seal_hash)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(crypto.randomUUID(), tableName, recordId, action, actorId, actorName, changes, caseId, now, seal);
}

// ── Seeding ───────────────────────────────────────────────────────────────────

function seedSSCB1Db(db: Database.Database): void {
  const caseCount = (db.prepare(`SELECT COUNT(*) as n FROM sscb1_cases`).get() as { n: number }).n;
  if (caseCount > 0) return; // Already seeded

  const now = new Date().toISOString();
  const caseId = 'sscb1';

  // ── Case ────────────────────────────────────────────────────────────────────
  db.prepare(`
    INSERT INTO sscb1_cases (id, case_name, case_number, description, state, phase, primary_party_pl, primary_party_aed, control_version, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    caseId,
    'Swansea, SC Biochar 1',
    'SSCB1',
    'Pre-NTP project control environment for SSCB1 biochar facility, Swansea SC',
    'active',
    'pre_ntp',
    'PublicLogic LLC',
    'Associated Energy Developers, LLC',
    'V1-DRAFT',
    now
  );

  // ── Stop Rules ───────────────────────────────────────────────────────────────
  const stopRuleData = {
    id: crypto.randomUUID(),
    rule_id_label: 'STOP-SSCB-001',
    rule_statement: 'No presale execution until carbon registry + methodology confirmed',
    trigger_condition: 'Carbon presale agreement signature or commitment',
    prohibited_actions: 'Executing any carbon credit presale agreement or binding commitment',
    evidence_required: 'Written confirmation of registry selection + approved methodology',
    owner: 'AED',
    active: 1,
  };
  db.prepare(`
    INSERT INTO sscb1_stop_rules (id, rule_id_label, rule_statement, trigger_condition, prohibited_actions, evidence_required, owner, active, case_id, created_at, updated_at, seal_hash)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    stopRuleData.id, stopRuleData.rule_id_label, stopRuleData.rule_statement,
    stopRuleData.trigger_condition, stopRuleData.prohibited_actions, stopRuleData.evidence_required,
    stopRuleData.owner, stopRuleData.active, caseId, now, now,
    generateSealHash(stopRuleData)
  );

  // ── Risks ────────────────────────────────────────────────────────────────────
  const risks: Array<{ label: string; title: string; desc: string; severity: string; owner: string }> = [
    { label: 'SSCB1-RISK-001', title: 'Carbon Presale Timing', desc: 'Presale must close before project financing confirms; registry/methodology not yet selected', severity: 'critical', owner: 'AED' },
    { label: 'SSCB1-RISK-002', title: 'ITC Recapture Clock', desc: 'Placed-in-service date drives 5-year recapture schedule; delay compresses ITC window', severity: 'critical', owner: 'PL' },
    { label: 'SSCB1-RISK-003', title: 'Registry & Methodology Selection', desc: 'No verified registry or approved methodology for biochar; required before any presale', severity: 'critical', owner: 'AED' },
    { label: 'SSCB1-RISK-004', title: 'ChipMax Sequencing', desc: 'ChipMax-first vs full-stack decision affects capital deployment timing and site readiness', severity: 'high', owner: 'AED' },
    { label: 'SSCB1-RISK-005', title: 'BES Site Dependency', desc: 'Site lease and BES cooperation required for construction; terms not finalized', severity: 'high', owner: 'AED' },
  ];
  for (const r of risks) {
    const id = crypto.randomUUID();
    db.prepare(`
      INSERT INTO sscb1_risks (id, risk_id_label, title, description, severity, owner, status, date_opened, case_id, created_at, updated_at, seal_hash)
      VALUES (?, ?, ?, ?, ?, ?, 'open', ?, ?, ?, ?, ?)
    `).run(id, r.label, r.title, r.desc, r.severity, r.owner, now, caseId, now, now, generateSealHash({ id, label: r.label, title: r.title }));
  }

  // ── Assumptions ──────────────────────────────────────────────────────────────
  const assumptions: Array<{ label: string; stmt: string; confidence: string; category: string }> = [
    { label: 'SSCB1-ASSM-001', stmt: 'Carbon credit price at $[X] per tonne for presale', confidence: 'working', category: 'commercial' },
    { label: 'SSCB1-ASSM-002', stmt: 'ARTi pyrolysis system output meets projected biochar yield', confidence: 'working', category: 'technical' },
    { label: 'SSCB1-ASSM-003', stmt: 'ORC equipment qualifies for full IRC §48 ITC basis', confidence: 'estimate', category: 'tax' },
    { label: 'SSCB1-ASSM-004', stmt: 'BES site lease terms acceptable at projected cost', confidence: 'working', category: 'commercial' },
    { label: 'SSCB1-ASSM-005', stmt: 'Feedstock supply (biomass) available at sufficient volume and cost', confidence: 'working', category: 'feedstock' },
    { label: 'SSCB1-ASSM-006', stmt: 'Equipment delivery timeline supports pre-NTP schedule', confidence: 'estimate', category: 'schedule' },
    { label: 'SSCB1-ASSM-007', stmt: 'Off-take counterparty credit quality sufficient for project financing', confidence: 'working', category: 'commercial' },
    { label: 'SSCB1-ASSM-008', stmt: 'Registry + methodology approval achievable within 90-day window', confidence: 'estimate', category: 'carbon_registry' },
  ];
  for (const a of assumptions) {
    const id = crypto.randomUUID();
    db.prepare(`
      INSERT INTO sscb1_assumptions (id, assumption_id_label, statement, category, confidence, validation_status, case_id, created_at, updated_at, seal_hash)
      VALUES (?, ?, ?, ?, ?, 'unvalidated', ?, ?, ?, ?)
    `).run(id, a.label, a.stmt, a.category, a.confidence, caseId, now, now, generateSealHash({ id, label: a.label, stmt: a.stmt }));
  }

  // ── Capital Stack ─────────────────────────────────────────────────────────────
  const stackItems: Array<{ label: string; name: string; status: string; owner: string; gateLinked: number; risk?: string; dep?: string }> = [
    { label: 'SSCB1-STACK-001', name: 'Carbon Credit Presale', status: 'conceptual', owner: 'AED', gateLinked: 1, risk: 'SSCB1-RISK-001' },
    { label: 'SSCB1-STACK-002', name: 'Trex ChipMax Equipment', status: 'assembling', owner: 'AED', gateLinked: 0, risk: 'SSCB1-RISK-004' },
    { label: 'SSCB1-STACK-003', name: 'ARTi Pyrolysis System', status: 'assembling', owner: 'AED', gateLinked: 0 },
    { label: 'SSCB1-STACK-004', name: 'ORC System / ITC Equipment', status: 'pending_counsel', owner: 'AED', gateLinked: 1 },
    { label: 'SSCB1-STACK-005', name: 'Off-Take Agreement', status: 'conceptual', owner: 'AED', gateLinked: 0 },
    { label: 'SSCB1-STACK-006', name: 'Site Lease / BES', status: 'pending_agreement', owner: 'AED', gateLinked: 0, risk: 'SSCB1-RISK-005' },
    { label: 'SSCB1-STACK-007', name: 'Senior Financing', status: 'conceptual', owner: 'AED', gateLinked: 0, dep: 'Carbon presale + ITC basis confirmed' },
  ];
  for (const s of stackItems) {
    const id = crypto.randomUUID();
    db.prepare(`
      INSERT INTO sscb1_stack_items (id, stack_item_id_label, layer_name, amount, currency, status, owner, risk_watch_point, dependency, gate_linked, confidence_status, case_id, created_at, updated_at, seal_hash)
      VALUES (?, ?, ?, 0, 'USD', ?, ?, ?, ?, ?, 'working', ?, ?, ?, ?)
    `).run(id, s.label, s.name, s.status, s.owner, s.risk ?? null, s.dep ?? null, s.gateLinked, caseId, now, now, generateSealHash({ id, label: s.label }));
  }

  // ── ITC Item ──────────────────────────────────────────────────────────────────
  const itcId = crypto.randomUUID();
  db.prepare(`
    INSERT INTO sscb1_itc_items (id, itc_item_id_label, eligible_equipment, estimated_basis, itc_rate, counsel_engaged, tax_opinion_status, ownership_entity, recapture_risk_flag, itc_basis_finalized, case_id, created_at, updated_at, seal_hash)
    VALUES (?, 'SSCB1-ITC-001', ?, 0, 0.3, 0, 'not_started', 'SSCB1, LLC', 1, 0, ?, ?, ?, ?)
  `).run(itcId, 'Organic Rankine Cycle system for waste heat recovery', caseId, now, now, generateSealHash({ id: itcId, label: 'SSCB1-ITC-001' }));

  // ── Decisions ─────────────────────────────────────────────────────────────────
  const decId = crypto.randomUUID();
  const decDue = addDays(now, 21).split('T')[0];
  const optionSet = JSON.stringify([
    'ChipMax-first: deploy ChipMax ahead of pyrolysis system to establish feedstock processing and early revenue',
    'Full-stack: deploy all equipment simultaneously for faster integrated startup',
  ]);
  db.prepare(`
    INSERT INTO sscb1_decisions (id, decision_id_label, decision_statement, option_set, requesting_party, decision_owner, due_date, status, case_id, created_at, updated_at, seal_hash)
    VALUES (?, 'SSCB1-DEC-001', ?, ?, 'AED', 'AED', ?, 'pending', ?, ?, ?, ?)
  `).run(decId, 'ChipMax-First vs. Full-Stack Sequencing', optionSet, decDue, caseId, now, now, generateSealHash({ id: decId, label: 'SSCB1-DEC-001' }));

  // ── Milestones ────────────────────────────────────────────────────────────────
  const milestones = [
    { label: 'SSCB1-MILE-001', title: 'Week 1 Discovery Session', target: addDays(now, 7).split('T')[0], owner: 'PL/AED' },
    { label: 'SSCB1-MILE-002', title: 'ChipMax Sequencing Decision', target: addDays(now, 21).split('T')[0], owner: 'AED' },
    { label: 'SSCB1-MILE-003', title: 'Registry + Methodology Confirmed', target: null, owner: 'AED' },
    { label: 'SSCB1-MILE-004', title: 'At Close Gate Review', target: addDays(now, 90).split('T')[0], owner: 'PL/AED' },
  ];
  for (const m of milestones) {
    const id = crypto.randomUUID();
    db.prepare(`
      INSERT INTO sscb1_milestones (id, milestone_id_label, title, target_date, owner, status, case_id, created_at, updated_at, seal_hash)
      VALUES (?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?)
    `).run(id, m.label, m.title, m.target, m.owner, caseId, now, now, generateSealHash({ id, label: m.label }));
  }

  // ── Cadence Events ────────────────────────────────────────────────────────────
  const cadenceEvents = [
    { label: 'SSCB1-CAD-001', type: 'weekly_stack', freq: 'weekly', date: nextWeekday(4) }, // Thursday
    { label: 'SSCB1-CAD-002', type: 'biweekly_aed', freq: 'biweekly', date: addDays(now, 14).split('T')[0] },
    { label: 'SSCB1-CAD-003', type: 'monthly_alignment', freq: 'monthly', date: addDays(now, 30).split('T')[0] },
    { label: 'SSCB1-CAD-004', type: 'gate_review', freq: 'once', date: addDays(now, 90).split('T')[0] },
  ];
  for (const c of cadenceEvents) {
    const id = crypto.randomUUID();
    db.prepare(`
      INSERT INTO sscb1_cadence_events (id, cadence_id_label, meeting_type, frequency, scheduled_date, status, case_id, created_at, updated_at, seal_hash)
      VALUES (?, ?, ?, ?, ?, 'scheduled', ?, ?, ?, ?)
    `).run(id, c.label, c.type, c.freq, c.date, caseId, now, now, generateSealHash({ id, label: c.label }));
  }

  // ── Open Items ────────────────────────────────────────────────────────────────
  const openItems = [
    {
      label: 'SSCB1-OI-001',
      title: 'Registry & Methodology Selection',
      type: 'pending_decision',
      severity: 'critical',
      owner: 'AED',
      linked: 'STOP-SSCB-001',
      note: 'Required to clear STOP-SSCB-001 before any presale execution',
      close: 'Written confirmation of registry selection + approved methodology',
    },
    {
      label: 'SSCB1-OI-002',
      title: 'Carbon Credit Price Assumption',
      type: 'unresolved_assumption',
      severity: 'high',
      owner: 'AED',
      linked: 'SSCB1-ASSM-001',
      note: 'Carbon credit price per tonne must be validated before presale structuring',
      close: 'Market data or term sheet confirming price range',
    },
    {
      label: 'SSCB1-OI-003',
      title: 'ITC Counsel Engagement',
      type: 'pending_counsel',
      severity: 'high',
      owner: 'PL',
      linked: 'SSCB1-ITC-001',
      note: 'Tax counsel with IRC §48 experience not yet engaged',
      close: 'Engage qualified tax counsel with IRC §48 experience',
    },
  ];
  for (const o of openItems) {
    const id = crypto.randomUUID();
    db.prepare(`
      INSERT INTO sscb1_open_items (id, open_item_id_label, title, item_type, linked_record, owner, blocker_severity, close_condition, current_note, status, case_id, created_at, updated_at, seal_hash)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'open', ?, ?, ?, ?)
    `).run(id, o.label, o.title, o.type, o.linked, o.owner, o.severity, o.close, o.note, caseId, now, now, generateSealHash({ id, label: o.label }));
  }

  console.log('[sscb1] Database initialized and seeded: SSCB1 Swansea SC Biochar 1');
}

// ── Actor Helpers ─────────────────────────────────────────────────────────────

export function getOrCreateActor(
  db: Database.Database,
  objectId: string,
  displayName: string,
  email: string,
  role: SSCB1ActorRole = 'readonly'
): SSCB1Actor {
  const existing = db.prepare('SELECT * FROM sscb1_actors WHERE id = ?').get(objectId) as SSCB1Actor | undefined;
  if (existing) return existing;

  const emailConflict = db.prepare('SELECT * FROM sscb1_actors WHERE email = ? AND id != ?').get(email, objectId) as SSCB1Actor | undefined;
  if (emailConflict) {
    db.prepare('UPDATE sscb1_actors SET id = ? WHERE email = ?').run(objectId, email);
    return db.prepare('SELECT * FROM sscb1_actors WHERE id = ?').get(objectId) as SSCB1Actor;
  }

  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO sscb1_actors (id, object_id, display_name, email, role, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(objectId, objectId, displayName, email, role, now);
  return db.prepare('SELECT * FROM sscb1_actors WHERE id = ?').get(objectId) as SSCB1Actor;
}

// ── Dashboard ─────────────────────────────────────────────────────────────────

export function sscb1Dashboard(db: Database.Database, caseId: string) {
  const caseRecord = db.prepare('SELECT * FROM sscb1_cases WHERE id = ?').get(caseId) as SSCB1Case | undefined;

  const stopRulesActive = db.prepare(`SELECT * FROM sscb1_stop_rules WHERE case_id = ? AND active = 1`).all(caseId) as SSCB1StopRule[];

  const criticalRisks = (db.prepare(`SELECT COUNT(*) as n FROM sscb1_risks WHERE case_id = ? AND severity = 'critical' AND status = 'open'`).get(caseId) as { n: number }).n;
  const highRisks = (db.prepare(`SELECT COUNT(*) as n FROM sscb1_risks WHERE case_id = ? AND severity = 'high' AND status = 'open'`).get(caseId) as { n: number }).n;
  const unverifiedAssumptions = (db.prepare(`SELECT COUNT(*) as n FROM sscb1_assumptions WHERE case_id = ? AND validation_status = 'unvalidated'`).get(caseId) as { n: number }).n;
  const totalAssumptions = (db.prepare(`SELECT COUNT(*) as n FROM sscb1_assumptions WHERE case_id = ?`).get(caseId) as { n: number }).n;
  const firmAssumptions = (db.prepare(`SELECT COUNT(*) as n FROM sscb1_assumptions WHERE case_id = ? AND confidence = 'firm'`).get(caseId) as { n: number }).n;
  const openItemsCritical = (db.prepare(`SELECT COUNT(*) as n FROM sscb1_open_items WHERE case_id = ? AND blocker_severity = 'critical' AND status IN ('open','in_progress')`).get(caseId) as { n: number }).n;
  const totalOpenItems = (db.prepare(`SELECT COUNT(*) as n FROM sscb1_open_items WHERE case_id = ? AND status IN ('open','in_progress')`).get(caseId) as { n: number }).n;
  const stackLayersTotal = (db.prepare(`SELECT COUNT(*) as n FROM sscb1_stack_items WHERE case_id = ?`).get(caseId) as { n: number }).n;
  const stackLayersBlocked = (db.prepare(`SELECT COUNT(*) as n FROM sscb1_stack_items WHERE case_id = ? AND status = 'blocked'`).get(caseId) as { n: number }).n;

  const itcExposure = db.prepare(`SELECT COALESCE(SUM(estimated_basis * itc_rate), 0) as total FROM sscb1_itc_items WHERE case_id = ?`).get(caseId) as { total: number };

  const nextDecision = db.prepare(`SELECT * FROM sscb1_decisions WHERE case_id = ? AND status = 'pending' ORDER BY due_date ASC NULLS LAST LIMIT 1`).get(caseId) as SSCB1Decision | null;
  const nextMilestone = db.prepare(`SELECT * FROM sscb1_milestones WHERE case_id = ? AND status = 'pending' ORDER BY target_date ASC NULLS LAST LIMIT 1`).get(caseId) as SSCB1Milestone | null;
  const cadenceNext = db.prepare(`SELECT * FROM sscb1_cadence_events WHERE case_id = ? AND status = 'scheduled' ORDER BY scheduled_date ASC NULLS LAST LIMIT 1`).get(caseId) as SSCB1CadenceEvent | null;

  const topRisks = db.prepare(`
    SELECT * FROM sscb1_risks WHERE case_id = ? AND status = 'open'
    ORDER BY CASE severity WHEN 'critical' THEN 1 WHEN 'high' THEN 2 WHEN 'watch' THEN 3 ELSE 4 END
    LIMIT 5
  `).all(caseId) as SSCB1Risk[];

  const openAssumptionsNeedingValidation = db.prepare(`
    SELECT * FROM sscb1_assumptions WHERE case_id = ? AND validation_status = 'unvalidated'
    ORDER BY created_at ASC LIMIT 5
  `).all(caseId) as SSCB1Assumption[];

  const in14 = addDays(new Date().toISOString(), 14);
  const openItemsDueSoon = db.prepare(`
    SELECT * FROM sscb1_open_items
    WHERE case_id = ? AND status IN ('open','in_progress')
    AND target_resolution_date IS NOT NULL AND target_resolution_date <= ?
    ORDER BY target_resolution_date ASC
  `).all(caseId, in14) as SSCB1OpenItem[];

  const recentDecisions = db.prepare(`
    SELECT * FROM sscb1_decisions WHERE case_id = ? AND status = 'decided'
    ORDER BY decision_date DESC LIMIT 3
  `).all(caseId) as SSCB1Decision[];

  const stackPreview = db.prepare(`SELECT * FROM sscb1_stack_items WHERE case_id = ? ORDER BY stack_item_id_label`).all(caseId) as SSCB1StackItem[];

  return {
    case: caseRecord,
    stop_rules_active: stopRulesActive,
    summary: {
      critical_risks: criticalRisks,
      high_risks: highRisks,
      unverified_assumptions: unverifiedAssumptions,
      total_assumptions: totalAssumptions,
      firm_assumptions: firmAssumptions,
      open_items_critical: openItemsCritical,
      total_open_items: totalOpenItems,
      stack_layers_total: stackLayersTotal,
      stack_layers_blocked: stackLayersBlocked,
      itc_exposure_estimate: itcExposure.total,
    },
    next_decision: nextDecision,
    next_milestone: nextMilestone,
    cadence_next: cadenceNext,
    top_risks: topRisks,
    open_assumptions_needing_validation: openAssumptionsNeedingValidation,
    open_items_due_soon: openItemsDueSoon,
    recent_decisions: recentDecisions,
    stack_preview: stackPreview,
  };
}

// ── List / CRUD Helpers ───────────────────────────────────────────────────────

export function listSources(db: Database.Database, caseId: string): SSCB1Source[] {
  return db.prepare(`SELECT * FROM sscb1_sources WHERE case_id = ? ORDER BY created_at DESC`).all(caseId) as SSCB1Source[];
}

export function createSource(db: Database.Database, caseId: string, data: Partial<SSCB1Source>): SSCB1Source {
  const now = new Date().toISOString();
  const id = crypto.randomUUID();
  const row = { id, case_id: caseId, created_at: now, ...data };
  const seal = generateSealHash(row as Record<string, unknown>);
  db.prepare(`
    INSERT INTO sscb1_sources (id, source_id_label, source_type, title, originating_party, date_received, effective_date, uploaded_by, attributed_owner, linked_issue, confidence_level, normalization_status, citation_note, document_url, supersedes_id, superseded_by_id, case_id, created_at, seal_hash)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    data.source_id_label ?? `SSCB1_SOURCE_${Date.now()}`,
    data.source_type ?? 'other',
    data.title ?? '',
    data.originating_party ?? null,
    data.date_received ?? null,
    data.effective_date ?? null,
    data.uploaded_by ?? null,
    data.attributed_owner ?? null,
    data.linked_issue ?? null,
    data.confidence_level ?? 'unverified',
    data.normalization_status ?? 'raw',
    data.citation_note ?? null,
    data.document_url ?? null,
    data.supersedes_id ?? null,
    data.superseded_by_id ?? null,
    caseId,
    now,
    seal
  );
  return db.prepare('SELECT * FROM sscb1_sources WHERE id = ?').get(id) as SSCB1Source;
}

export function listAssumptions(db: Database.Database, caseId: string): SSCB1Assumption[] {
  return db.prepare(`SELECT * FROM sscb1_assumptions WHERE case_id = ? ORDER BY assumption_id_label`).all(caseId) as SSCB1Assumption[];
}

export function createAssumption(db: Database.Database, caseId: string, data: Partial<SSCB1Assumption>): SSCB1Assumption {
  const now = new Date().toISOString();
  const id = crypto.randomUUID();
  const count = (db.prepare('SELECT COUNT(*) as n FROM sscb1_assumptions WHERE case_id = ?').get(caseId) as { n: number }).n;
  const label = data.assumption_id_label ?? `SSCB1-ASSM-${String(count + 1).padStart(3, '0')}`;
  const seal = generateSealHash({ id, label, stmt: data.statement });
  db.prepare(`
    INSERT INTO sscb1_assumptions (id, assumption_id_label, statement, category, source_ref, source_date, originating_document, confidence, owner, impact_area, dependent_records, validation_due, validation_status, status_notes, last_reviewed, case_id, created_at, updated_at, seal_hash)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id, label,
    data.statement ?? '',
    data.category ?? 'commercial',
    data.source_ref ?? null, data.source_date ?? null, data.originating_document ?? null,
    data.confidence ?? 'working',
    data.owner ?? null, data.impact_area ?? null, data.dependent_records ?? null,
    data.validation_due ?? null,
    data.validation_status ?? 'unvalidated',
    data.status_notes ?? null, data.last_reviewed ?? null,
    caseId, now, now, seal
  );
  return db.prepare('SELECT * FROM sscb1_assumptions WHERE id = ?').get(id) as SSCB1Assumption;
}

export function updateAssumption(db: Database.Database, id: string, data: Partial<SSCB1Assumption>): SSCB1Assumption | undefined {
  const now = new Date().toISOString();
  db.prepare(`
    UPDATE sscb1_assumptions SET
      confidence = COALESCE(?, confidence),
      validation_status = COALESCE(?, validation_status),
      status_notes = COALESCE(?, status_notes),
      last_reviewed = COALESCE(?, last_reviewed),
      owner = COALESCE(?, owner),
      impact_area = COALESCE(?, impact_area),
      updated_at = ?
    WHERE id = ?
  `).run(
    data.confidence ?? null, data.validation_status ?? null,
    data.status_notes ?? null, data.last_reviewed ?? null,
    data.owner ?? null, data.impact_area ?? null,
    now, id
  );
  return db.prepare('SELECT * FROM sscb1_assumptions WHERE id = ?').get(id) as SSCB1Assumption | undefined;
}

export function listStackItems(db: Database.Database, caseId: string): SSCB1StackItem[] {
  return db.prepare(`SELECT * FROM sscb1_stack_items WHERE case_id = ? ORDER BY stack_item_id_label`).all(caseId) as SSCB1StackItem[];
}

export function createStackItem(db: Database.Database, caseId: string, data: Partial<SSCB1StackItem>): SSCB1StackItem {
  const now = new Date().toISOString();
  const id = crypto.randomUUID();
  const count = (db.prepare('SELECT COUNT(*) as n FROM sscb1_stack_items WHERE case_id = ?').get(caseId) as { n: number }).n;
  const label = data.stack_item_id_label ?? `SSCB1-STACK-${String(count + 1).padStart(3, '0')}`;
  const seal = generateSealHash({ id, label });
  db.prepare(`
    INSERT INTO sscb1_stack_items (id, stack_item_id_label, layer_name, layer_type, amount, currency, expected_timing, status, owner, counterparties, dependency, next_action, next_action_due, risk_watch_point, current_blocker, evidence_link, confidence_status, gate_linked, case_id, created_at, updated_at, seal_hash)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id, label, data.layer_name ?? '', data.layer_type ?? null,
    data.amount ?? 0, data.currency ?? 'USD',
    data.expected_timing ?? null, data.status ?? 'conceptual',
    data.owner ?? null, data.counterparties ?? null, data.dependency ?? null,
    data.next_action ?? null, data.next_action_due ?? null,
    data.risk_watch_point ?? null, data.current_blocker ?? null, data.evidence_link ?? null,
    data.confidence_status ?? 'working', data.gate_linked ?? 0,
    caseId, now, now, seal
  );
  return db.prepare('SELECT * FROM sscb1_stack_items WHERE id = ?').get(id) as SSCB1StackItem;
}

export function updateStackItem(db: Database.Database, id: string, data: Partial<SSCB1StackItem>): SSCB1StackItem | undefined {
  const now = new Date().toISOString();
  db.prepare(`
    UPDATE sscb1_stack_items SET
      status = COALESCE(?, status),
      amount = COALESCE(?, amount),
      current_blocker = COALESCE(?, current_blocker),
      next_action = COALESCE(?, next_action),
      next_action_due = COALESCE(?, next_action_due),
      confidence_status = COALESCE(?, confidence_status),
      evidence_link = COALESCE(?, evidence_link),
      updated_at = ?
    WHERE id = ?
  `).run(
    data.status ?? null, data.amount ?? null, data.current_blocker ?? null,
    data.next_action ?? null, data.next_action_due ?? null,
    data.confidence_status ?? null, data.evidence_link ?? null,
    now, id
  );
  return db.prepare('SELECT * FROM sscb1_stack_items WHERE id = ?').get(id) as SSCB1StackItem | undefined;
}

export function listRisks(db: Database.Database, caseId: string): SSCB1Risk[] {
  return db.prepare(`SELECT * FROM sscb1_risks WHERE case_id = ? ORDER BY CASE severity WHEN 'critical' THEN 1 WHEN 'high' THEN 2 WHEN 'watch' THEN 3 ELSE 4 END`).all(caseId) as SSCB1Risk[];
}

export function createRisk(db: Database.Database, caseId: string, data: Partial<SSCB1Risk>): SSCB1Risk {
  const now = new Date().toISOString();
  const id = crypto.randomUUID();
  const count = (db.prepare('SELECT COUNT(*) as n FROM sscb1_risks WHERE case_id = ?').get(caseId) as { n: number }).n;
  const label = data.risk_id_label ?? `SSCB1-RISK-${String(count + 1).padStart(3, '0')}`;
  const seal = generateSealHash({ id, label });
  db.prepare(`
    INSERT INTO sscb1_risks (id, risk_id_label, title, description, category, severity, sequence_impact, likelihood, owner, trigger_condition, mitigation_plan, status, linked_assumptions, linked_stack_item, linked_milestone, escalation_level, date_opened, last_reviewed, closure_criteria, case_id, created_at, updated_at, seal_hash)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id, label, data.title ?? '', data.description ?? null, data.category ?? null,
    data.severity ?? 'high', data.sequence_impact ?? null, data.likelihood ?? null,
    data.owner ?? null, data.trigger_condition ?? null, data.mitigation_plan ?? null,
    data.status ?? 'open',
    data.linked_assumptions ?? null, data.linked_stack_item ?? null, data.linked_milestone ?? null,
    data.escalation_level ?? null, now, null, data.closure_criteria ?? null,
    caseId, now, now, seal
  );
  return db.prepare('SELECT * FROM sscb1_risks WHERE id = ?').get(id) as SSCB1Risk;
}

export function updateRisk(db: Database.Database, id: string, data: Partial<SSCB1Risk>): SSCB1Risk | undefined {
  const now = new Date().toISOString();
  db.prepare(`
    UPDATE sscb1_risks SET
      status = COALESCE(?, status),
      severity = COALESCE(?, severity),
      mitigation_plan = COALESCE(?, mitigation_plan),
      escalation_level = COALESCE(?, escalation_level),
      last_reviewed = COALESCE(?, last_reviewed),
      closure_criteria = COALESCE(?, closure_criteria),
      updated_at = ?
    WHERE id = ?
  `).run(
    data.status ?? null, data.severity ?? null, data.mitigation_plan ?? null,
    data.escalation_level ?? null, data.last_reviewed ?? null, data.closure_criteria ?? null,
    now, id
  );
  return db.prepare('SELECT * FROM sscb1_risks WHERE id = ?').get(id) as SSCB1Risk | undefined;
}

export function listITCItems(db: Database.Database, caseId: string): SSCB1ITCItem[] {
  return db.prepare(`SELECT * FROM sscb1_itc_items WHERE case_id = ? ORDER BY itc_item_id_label`).all(caseId) as SSCB1ITCItem[];
}

export function updateITCItem(db: Database.Database, id: string, data: Partial<SSCB1ITCItem>): SSCB1ITCItem | undefined {
  const now = new Date().toISOString();
  db.prepare(`
    UPDATE sscb1_itc_items SET
      estimated_basis = COALESCE(?, estimated_basis),
      final_basis = COALESCE(?, final_basis),
      placed_in_service_date = COALESCE(?, placed_in_service_date),
      itc_amount = COALESCE(?, itc_amount),
      counsel_engaged = COALESCE(?, counsel_engaged),
      tax_opinion_status = COALESCE(?, tax_opinion_status),
      ownership_entity = COALESCE(?, ownership_entity),
      exposure_notes = COALESCE(?, exposure_notes),
      recapture_risk_flag = COALESCE(?, recapture_risk_flag),
      itc_basis_finalized = COALESCE(?, itc_basis_finalized),
      updated_at = ?
    WHERE id = ?
  `).run(
    data.estimated_basis ?? null, data.final_basis ?? null,
    data.placed_in_service_date ?? null, data.itc_amount ?? null,
    data.counsel_engaged ?? null, data.tax_opinion_status ?? null,
    data.ownership_entity ?? null, data.exposure_notes ?? null,
    data.recapture_risk_flag ?? null, data.itc_basis_finalized ?? null,
    now, id
  );
  return db.prepare('SELECT * FROM sscb1_itc_items WHERE id = ?').get(id) as SSCB1ITCItem | undefined;
}

export function listOpenItems(db: Database.Database, caseId: string): SSCB1OpenItem[] {
  return db.prepare(`SELECT * FROM sscb1_open_items WHERE case_id = ? ORDER BY CASE blocker_severity WHEN 'critical' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 ELSE 4 END, created_at`).all(caseId) as SSCB1OpenItem[];
}

export function createOpenItem(db: Database.Database, caseId: string, data: Partial<SSCB1OpenItem>): SSCB1OpenItem {
  const now = new Date().toISOString();
  const id = crypto.randomUUID();
  const count = (db.prepare('SELECT COUNT(*) as n FROM sscb1_open_items WHERE case_id = ?').get(caseId) as { n: number }).n;
  const label = data.open_item_id_label ?? `SSCB1-OI-${String(count + 1).padStart(3, '0')}`;
  const seal = generateSealHash({ id, label });
  db.prepare(`
    INSERT INTO sscb1_open_items (id, open_item_id_label, title, item_type, linked_record, owner, requested_from, requested_date, target_resolution_date, blocker_severity, close_condition, current_note, escalation_state, status, case_id, created_at, updated_at, seal_hash)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id, label, data.title ?? '', data.item_type ?? 'pending_decision',
    data.linked_record ?? null, data.owner ?? null,
    data.requested_from ?? null, data.requested_date ?? null,
    data.target_resolution_date ?? null, data.blocker_severity ?? 'medium',
    data.close_condition ?? null, data.current_note ?? null, data.escalation_state ?? null,
    data.status ?? 'open', caseId, now, now, seal
  );
  return db.prepare('SELECT * FROM sscb1_open_items WHERE id = ?').get(id) as SSCB1OpenItem;
}

export function resolveOpenItem(db: Database.Database, id: string, resolvedBy: string, resolutionNote: string): SSCB1OpenItem | undefined {
  const now = new Date().toISOString();
  db.prepare(`
    UPDATE sscb1_open_items SET status = 'resolved', resolved_date = ?, resolved_by = ?, resolution_note = ?, updated_at = ? WHERE id = ?
  `).run(now, resolvedBy, resolutionNote, now, id);
  return db.prepare('SELECT * FROM sscb1_open_items WHERE id = ?').get(id) as SSCB1OpenItem | undefined;
}

export function listDecisions(db: Database.Database, caseId: string): SSCB1Decision[] {
  return db.prepare(`SELECT * FROM sscb1_decisions WHERE case_id = ? ORDER BY due_date ASC NULLS LAST, created_at DESC`).all(caseId) as SSCB1Decision[];
}

export function createDecision(db: Database.Database, caseId: string, data: Partial<SSCB1Decision>): SSCB1Decision {
  const now = new Date().toISOString();
  const id = crypto.randomUUID();
  const count = (db.prepare('SELECT COUNT(*) as n FROM sscb1_decisions WHERE case_id = ?').get(caseId) as { n: number }).n;
  const label = data.decision_id_label ?? `SSCB1-DEC-${String(count + 1).padStart(3, '0')}`;
  const seal = generateSealHash({ id, label });
  db.prepare(`
    INSERT INTO sscb1_decisions (id, decision_id_label, decision_statement, option_set, requesting_party, decision_owner, due_date, source_basis, impacted_records, status, case_id, created_at, updated_at, seal_hash)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id, label, data.decision_statement ?? '', JSON.stringify(data.option_set ? JSON.parse(data.option_set) : []),
    data.requesting_party ?? null, data.decision_owner ?? null,
    data.due_date ?? null, data.source_basis ?? null, data.impacted_records ?? null,
    data.status ?? 'pending', caseId, now, now, seal
  );
  return db.prepare('SELECT * FROM sscb1_decisions WHERE id = ?').get(id) as SSCB1Decision;
}

export function recordDecision(db: Database.Database, id: string, chosenOption: string, rationale: string, decisionDate?: string): SSCB1Decision | undefined {
  const now = new Date().toISOString();
  db.prepare(`
    UPDATE sscb1_decisions SET
      chosen_option = ?, rationale = ?, decision_date = ?, status = 'decided', updated_at = ?
    WHERE id = ?
  `).run(chosenOption, rationale, decisionDate ?? now, now, id);
  return db.prepare('SELECT * FROM sscb1_decisions WHERE id = ?').get(id) as SSCB1Decision | undefined;
}

export function listStopRules(db: Database.Database, caseId: string): SSCB1StopRule[] {
  return db.prepare(`SELECT * FROM sscb1_stop_rules WHERE case_id = ? ORDER BY active DESC, rule_id_label`).all(caseId) as SSCB1StopRule[];
}

export function clearStopRule(db: Database.Database, id: string, clearedBy: string, clearanceEvidence: string): SSCB1StopRule | undefined {
  const now = new Date().toISOString();
  db.prepare(`
    UPDATE sscb1_stop_rules SET active = 0, cleared_date = ?, cleared_by = ?, clearance_evidence = ?, updated_at = ? WHERE id = ?
  `).run(now, clearedBy, clearanceEvidence, now, id);
  return db.prepare('SELECT * FROM sscb1_stop_rules WHERE id = ?').get(id) as SSCB1StopRule | undefined;
}

export function listCadenceEvents(db: Database.Database, caseId: string): SSCB1CadenceEvent[] {
  return db.prepare(`SELECT * FROM sscb1_cadence_events WHERE case_id = ? ORDER BY scheduled_date ASC NULLS LAST`).all(caseId) as SSCB1CadenceEvent[];
}

export function createCadenceEvent(db: Database.Database, caseId: string, data: Partial<SSCB1CadenceEvent>): SSCB1CadenceEvent {
  const now = new Date().toISOString();
  const id = crypto.randomUUID();
  const count = (db.prepare('SELECT COUNT(*) as n FROM sscb1_cadence_events WHERE case_id = ?').get(caseId) as { n: number }).n;
  const label = data.cadence_id_label ?? `SSCB1-CAD-${String(count + 1).padStart(3, '0')}`;
  const seal = generateSealHash({ id, label });
  db.prepare(`
    INSERT INTO sscb1_cadence_events (id, cadence_id_label, meeting_type, frequency, required_attendees, scheduled_date, status, notes, case_id, created_at, updated_at, seal_hash)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id, label, data.meeting_type ?? 'exception',
    data.frequency ?? null, data.required_attendees ?? null, data.scheduled_date ?? null,
    data.status ?? 'scheduled', data.notes ?? null, caseId, now, now, seal
  );
  return db.prepare('SELECT * FROM sscb1_cadence_events WHERE id = ?').get(id) as SSCB1CadenceEvent;
}

export function completeCadenceEvent(db: Database.Database, id: string, notes?: string): SSCB1CadenceEvent | undefined {
  const now = new Date().toISOString();
  db.prepare(`
    UPDATE sscb1_cadence_events SET status = 'completed', completed_date = ?, notes = COALESCE(?, notes), updated_at = ? WHERE id = ?
  `).run(now, notes ?? null, now, id);
  return db.prepare('SELECT * FROM sscb1_cadence_events WHERE id = ?').get(id) as SSCB1CadenceEvent | undefined;
}

export function listMilestones(db: Database.Database, caseId: string): SSCB1Milestone[] {
  return db.prepare(`SELECT * FROM sscb1_milestones WHERE case_id = ? ORDER BY target_date ASC NULLS LAST`).all(caseId) as SSCB1Milestone[];
}

export function updateMilestone(db: Database.Database, id: string, data: Partial<SSCB1Milestone>): SSCB1Milestone | undefined {
  const now = new Date().toISOString();
  db.prepare(`
    UPDATE sscb1_milestones SET
      status = COALESCE(?, status),
      target_date = COALESCE(?, target_date),
      completed_date = COALESCE(?, completed_date),
      description = COALESCE(?, description),
      updated_at = ?
    WHERE id = ?
  `).run(
    data.status ?? null, data.target_date ?? null,
    data.completed_date ?? null, data.description ?? null,
    now, id
  );
  return db.prepare('SELECT * FROM sscb1_milestones WHERE id = ?').get(id) as SSCB1Milestone | undefined;
}

export function listAuditLog(db: Database.Database, caseId: string, limit = 100): SSCB1AuditEntry[] {
  return db.prepare(`SELECT * FROM sscb1_audit_log WHERE case_id = ? ORDER BY created_at DESC LIMIT ?`).all(caseId, limit) as SSCB1AuditEntry[];
}
