import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Database from "better-sqlite3";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, "../../");
const CONTROLLED_DATA_DIR = path.join(ROOT_DIR, "data");

function isPathInsideDirectory(candidatePath: string, baseDirectory: string): boolean {
  const rel = path.relative(baseDirectory, candidatePath);
  return !rel.startsWith("..") && !path.isAbsolute(rel);
}

export function addBusinessDays(startIso: string, days: number): string {
  const date = new Date(startIso);
  let added = 0;
  while (added < days) {
    date.setDate(date.getDate() + 1);
    const dow = date.getDay();
    if (dow !== 0 && dow !== 6) added++;
  }
  return date.toISOString();
}

function nowIso(): string {
  return new Date().toISOString();
}

// ── Types ────────────────────────────────────────────────────────────────────

export type AlertSeverity = "info" | "warning" | "high" | "critical";
export type AlertStatus = "open" | "acknowledged" | "resolved" | "dismissed";
export type AlertDomain =
  | "data_freshness" | "organizational" | "workflow" | "financial"
  | "compliance" | "access" | "ai_activity" | "environment_health";

export interface CommonsAlert {
  id: string;
  tenant_id: string;
  domain: AlertDomain;
  severity: AlertSeverity;
  title: string;
  detail: string;
  affected_object_type: string;
  affected_object_id: string;
  suggested_action: string;
  status: AlertStatus;
  created_at: string;
  updated_at: string;
  owner_id: string | null;
}

export type IntakeChannel = "state_api" | "town_api" | "civicplus" | "m365" | "google" | "csv" | "form" | "email" | "api" | "manual";

export interface CommonsRecord {
  id: string;
  tenant_id: string;
  record_type: string;
  module_key: string;
  source_system: string | null;
  intake_channel: IntakeChannel;
  requester_name: string | null;
  requester_email: string | null;
  request_description: string;
  department_id: string | null;
  owner_position_id: string | null;
  pipeline_stage: number;
  status: "open" | "in_progress" | "closed";
  sla_due_at: string | null;
  retention_class: string | null;
  created_at: string;
  updated_at: string;
  closed_at: string | null;
}

export interface ModuleInstance {
  id: string;
  record_id: string;
  tenant_id: string;
  module_key: string;
  current_step: number;
  workflow_stages: string; // JSON
  role_assignments: string; // JSON
  stop_rules: string; // JSON
  can_advance: number; // SQLite boolean
  blocking_fields: string; // JSON array
  instantiated_at: string;
  updated_at: string;
}

export interface Artifact {
  id: string;
  module_instance_id: string;
  tenant_id: string;
  artifact_type: string;
  output_format: string;
  artifact_hash: string;
  rendered_at: string;
}

export interface PlacementConfirmation {
  id: string;
  module_instance_id: string;
  artifact_id: string;
  tenant_id: string;
  destination_type: string;
  destination_object_id: string | null;
  destination_url: string | null;
  placed_at: string | null;
  confirmed_at: string | null;
  confirmation_status: "pending" | "confirmed" | "failed" | "misplaced";
  artifact_hash: string;
  error_code: string | null;
  retry_count: number;
}

// ── Default workflow stages per module key ───────────────────────────────────
const DEFAULT_WORKFLOW_STAGES: Record<string, Array<{ id: string; order: number; label: string }>> = {
  "VAULTCLERK.PublicRecords": [
    { id: "ws-1", order: 1, label: "Received" },
    { id: "ws-2", order: 2, label: "Acknowledged" },
    { id: "ws-3", order: 3, label: "Records search" },
    { id: "ws-4", order: 4, label: "Draft response" },
    { id: "ws-5", order: 5, label: "Delivery" },
    { id: "ws-6", order: 6, label: "Closed" },
  ],
  "VAULTCLERK.OpenMeeting": [
    { id: "ws-1", order: 1, label: "Meeting setup" },
    { id: "ws-2", order: 2, label: "Notice review" },
    { id: "ws-3", order: 3, label: "Posting" },
    { id: "ws-4", order: 4, label: "Packet gen" },
    { id: "ws-5", order: 5, label: "Meeting held" },
    { id: "ws-6", order: 6, label: "Minutes draft" },
    { id: "ws-7", order: 7, label: "Minutes approval" },
    { id: "ws-8", order: 8, label: "Publication" },
  ],
  "VAULTCLERK.BoardCompliance": [
    { id: "ws-1", order: 1, label: "Disclosure received" },
    { id: "ws-2", order: 2, label: "Review" },
    { id: "ws-3", order: 3, label: "Acknowledgement" },
    { id: "ws-4", order: 4, label: "Filing" },
    { id: "ws-5", order: 5, label: "Annual reconciliation" },
  ],
  "VAULTFISCAL.Procurement": [
    { id: "ws-1", order: 1, label: "Request" },
    { id: "ws-2", order: 2, label: "Classification" },
    { id: "ws-3", order: 3, label: "Quote / bid" },
    { id: "ws-4", order: 4, label: "Award" },
    { id: "ws-5", order: 5, label: "Contract" },
    { id: "ws-6", order: 6, label: "Evidence" },
    { id: "ws-7", order: 7, label: "Archive" },
  ],
  "VAULTFISCAL.Budget": [
    { id: "ws-1", order: 1, label: "Scenario" },
    { id: "ws-2", order: 2, label: "Review" },
    { id: "ws-3", order: 3, label: "Adoption" },
    { id: "ws-4", order: 4, label: "Cherry Sheet" },
    { id: "ws-5", order: 5, label: "Actual tracking" },
    { id: "ws-6", order: 6, label: "Closeout" },
  ],
  "VAULTFISCAL.Grants": [
    { id: "ws-1", order: 1, label: "Award" },
    { id: "ws-2", order: 2, label: "Drawdown" },
    { id: "ws-3", order: 3, label: "Reporting" },
    { id: "ws-4", order: 4, label: "Closeout" },
  ],
  "VAULTTIME.PersonnelAdmin": [
    { id: "ws-1", order: 1, label: "Position open" },
    { id: "ws-2", order: 2, label: "Recruitment" },
    { id: "ws-3", order: 3, label: "Appointment" },
    { id: "ws-4", order: 4, label: "Onboarding" },
    { id: "ws-5", order: 5, label: "Separation" },
  ],
  "VAULTPERMIT.Building": [
    { id: "ws-1", order: 1, label: "Application" },
    { id: "ws-2", order: 2, label: "Review" },
    { id: "ws-3", order: 3, label: "Conditions" },
    { id: "ws-4", order: 4, label: "Approval / denial" },
    { id: "ws-5", order: 5, label: "Appeal window" },
    { id: "ws-6", order: 6, label: "Closeout" },
  ],
  "VAULTFIX.WorkOrder": [
    { id: "ws-1", order: 1, label: "Request" },
    { id: "ws-2", order: 2, label: "Assignment" },
    { id: "ws-3", order: 3, label: "In progress" },
    { id: "ws-4", order: 4, label: "Resolution" },
    { id: "ws-5", order: 5, label: "Closeout" },
    { id: "ws-6", order: 6, label: "Asset update" },
  ],
};

// ── CommonsStore ─────────────────────────────────────────────────────────────

export class CommonsStore {
  private readonly db: Database.Database;

  constructor(dbPath: string) {
    const resolvedPath = path.resolve(dbPath);
    if (!isPathInsideDirectory(resolvedPath, CONTROLLED_DATA_DIR)) {
      throw new Error(`COMMONS_DB_PATH must be inside ${CONTROLLED_DATA_DIR}`);
    }
    fs.mkdirSync(path.dirname(resolvedPath), { recursive: true });
    this.db = new Database(resolvedPath);
    this.db.pragma("journal_mode = WAL");
    this.db.pragma("foreign_keys = ON");
    this.initSchema();
    this.seedModuleRegistry();
  }

  private initSchema(): void {
    this.db.exec(`
      -- Commons records (canonical records)
      CREATE TABLE IF NOT EXISTS commons_records (
        id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL,
        record_type TEXT NOT NULL,
        module_key TEXT NOT NULL,
        source_system TEXT,
        intake_channel TEXT NOT NULL DEFAULT 'manual',
        requester_name TEXT,
        requester_email TEXT,
        request_description TEXT NOT NULL,
        department_id TEXT,
        owner_position_id TEXT,
        pipeline_stage INTEGER NOT NULL DEFAULT 1,
        status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open','in_progress','closed')),
        sla_due_at TEXT,
        retention_class TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        closed_at TEXT
      );
      CREATE INDEX IF NOT EXISTS ix_cr_tenant ON commons_records(tenant_id, status);

      -- Module instances (Stage 7)
      CREATE TABLE IF NOT EXISTS module_instances (
        id TEXT PRIMARY KEY,
        record_id TEXT NOT NULL REFERENCES commons_records(id),
        tenant_id TEXT NOT NULL,
        module_key TEXT NOT NULL,
        current_step INTEGER NOT NULL DEFAULT 1,
        workflow_stages TEXT NOT NULL DEFAULT '[]',
        role_assignments TEXT NOT NULL DEFAULT '{}',
        stop_rules TEXT NOT NULL DEFAULT '[]',
        can_advance INTEGER NOT NULL DEFAULT 1,
        blocking_fields TEXT NOT NULL DEFAULT '[]',
        instantiated_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS ix_mi_record ON module_instances(record_id);
      CREATE INDEX IF NOT EXISTS ix_mi_tenant ON module_instances(tenant_id);

      -- Generated artifacts (Stage 10) — immutable after creation
      CREATE TABLE IF NOT EXISTS generated_artifacts (
        id TEXT PRIMARY KEY,
        module_instance_id TEXT NOT NULL REFERENCES module_instances(id),
        tenant_id TEXT NOT NULL,
        artifact_type TEXT NOT NULL,
        output_format TEXT NOT NULL,
        artifact_hash TEXT NOT NULL,
        rendered_at TEXT NOT NULL
      );
      CREATE TRIGGER IF NOT EXISTS artifact_no_update BEFORE UPDATE ON generated_artifacts
        BEGIN SELECT RAISE(ABORT, 'generated_artifacts is immutable'); END;

      -- Placement confirmations (Stage 13)
      CREATE TABLE IF NOT EXISTS placement_confirmations (
        id TEXT PRIMARY KEY,
        module_instance_id TEXT NOT NULL REFERENCES module_instances(id),
        artifact_id TEXT NOT NULL REFERENCES generated_artifacts(id),
        tenant_id TEXT NOT NULL,
        destination_type TEXT NOT NULL CHECK(destination_type IN ('civicplus','m365','google','logicdocs','email','download')),
        destination_object_id TEXT,
        destination_url TEXT,
        placed_at TEXT,
        confirmed_at TEXT,
        confirmation_status TEXT NOT NULL DEFAULT 'pending' CHECK(confirmation_status IN ('pending','confirmed','failed','misplaced')),
        artifact_hash TEXT NOT NULL,
        error_code TEXT,
        retry_count INTEGER NOT NULL DEFAULT 0
      );
      CREATE INDEX IF NOT EXISTS ix_pc_instance ON placement_confirmations(module_instance_id);

      -- Alerts (Watch Layer surface)
      CREATE TABLE IF NOT EXISTS commons_alerts (
        id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL,
        domain TEXT NOT NULL,
        severity TEXT NOT NULL CHECK(severity IN ('info','warning','high','critical')),
        title TEXT NOT NULL,
        detail TEXT NOT NULL,
        affected_object_type TEXT NOT NULL,
        affected_object_id TEXT NOT NULL,
        suggested_action TEXT NOT NULL DEFAULT '',
        status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open','acknowledged','resolved','dismissed')),
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        owner_id TEXT,
        resolution_notes TEXT
      );
      CREATE INDEX IF NOT EXISTS ix_ca_tenant_status ON commons_alerts(tenant_id, status, severity);

      -- Audit log for commons actions (append-only)
      CREATE TABLE IF NOT EXISTS commons_audit (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tenant_id TEXT NOT NULL,
        actor_user_id TEXT NOT NULL,
        action TEXT NOT NULL,
        object_type TEXT NOT NULL,
        object_id TEXT NOT NULL,
        before_state TEXT,
        after_state TEXT,
        created_at TEXT NOT NULL
      );
      CREATE TRIGGER IF NOT EXISTS commons_audit_no_update BEFORE UPDATE ON commons_audit
        BEGIN SELECT RAISE(ABORT, 'commons_audit is append-only'); END;
      CREATE TRIGGER IF NOT EXISTS commons_audit_no_delete BEFORE DELETE ON commons_audit
        BEGIN SELECT RAISE(ABORT, 'commons_audit is append-only'); END;

      -- Module registry
      CREATE TABLE IF NOT EXISTS module_registry (
        module_key TEXT PRIMARY KEY,
        display_name TEXT NOT NULL,
        domain TEXT NOT NULL,
        primary_statute TEXT,
        workflow_stage_count INTEGER NOT NULL DEFAULT 6,
        sla_days INTEGER,
        sla_unit TEXT DEFAULT 'business_days',
        is_active INTEGER NOT NULL DEFAULT 1
      );
    `);
  }

  private seedModuleRegistry(): void {
    const insert = this.db.prepare(`
      INSERT OR IGNORE INTO module_registry (module_key, display_name, domain, primary_statute, workflow_stage_count, sla_days)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    const modules = [
      ["VAULTCLERK.PublicRecords",  "Public Records",   "clerk",   "MGL c.66",           6, 10],
      ["VAULTCLERK.OpenMeeting",    "Open Meeting",      "clerk",   "MGL c.30A §§18-25",  8, null],
      ["VAULTCLERK.BoardCompliance","Board Compliance",  "clerk",   "MGL c.268A",         5, null],
      ["VAULTFISCAL.Procurement",   "Procurement",       "fiscal",  "MGL c.30B",          7, null],
      ["VAULTFISCAL.Budget",        "Budget",            "fiscal",  "MGL c.44",           6, null],
      ["VAULTFISCAL.Grants",        "Grants",            "fiscal",  "2 CFR Part 200",     4, null],
      ["VAULTTIME.PersonnelAdmin",  "Personnel",         "time",    "MGL c.41, c.31",     5, null],
      ["VAULTPERMIT.Building",      "Permitting",        "permit",  "MGL c.40A",          6, null],
      ["VAULTFIX.WorkOrder",        "Work Orders",       "fix",     "MGL c.41 + SOP",     6, null],
    ];
    const seedAll = this.db.transaction(() => {
      for (const m of modules) insert.run(...m);
    });
    seedAll();
  }

  // ── Alerts ────────────────────────────────────────────────────────────────

  listAlerts(tenantId: string, params?: { severity?: string; domain?: string }): CommonsAlert[] {
    let sql = "SELECT * FROM commons_alerts WHERE tenant_id = ?";
    const args: unknown[] = [tenantId];
    if (params?.severity && params.severity !== "all") {
      sql += " AND severity = ?"; args.push(params.severity);
    }
    if (params?.domain && params.domain !== "all") {
      sql += " AND domain = ?"; args.push(params.domain);
    }
    sql += " ORDER BY CASE severity WHEN 'critical' THEN 1 WHEN 'high' THEN 2 WHEN 'warning' THEN 3 ELSE 4 END, created_at DESC";
    return this.db.prepare(sql).all(...args) as CommonsAlert[];
  }

  acknowledgeAlert(id: string, tenantId: string, actorUserId: string): CommonsAlert | null {
    const row = this.db.prepare("SELECT * FROM commons_alerts WHERE id = ? AND tenant_id = ?").get(id, tenantId) as CommonsAlert | undefined;
    if (!row) return null;
    const now = nowIso();
    this.db.prepare("UPDATE commons_alerts SET status = 'acknowledged', updated_at = ? WHERE id = ?").run(now, id);
    this.appendAudit(tenantId, actorUserId, "alert.acknowledged", "commons_alert", id, JSON.stringify({ status: row.status }), JSON.stringify({ status: "acknowledged" }));
    return this.db.prepare("SELECT * FROM commons_alerts WHERE id = ?").get(id) as CommonsAlert;
  }

  resolveAlert(id: string, tenantId: string, actorUserId: string, notes: string): CommonsAlert | null {
    const row = this.db.prepare("SELECT * FROM commons_alerts WHERE id = ? AND tenant_id = ?").get(id, tenantId) as CommonsAlert | undefined;
    if (!row) return null;
    const now = nowIso();
    this.db.prepare("UPDATE commons_alerts SET status = 'resolved', resolution_notes = ?, updated_at = ? WHERE id = ?").run(notes, now, id);
    this.appendAudit(tenantId, actorUserId, "alert.resolved", "commons_alert", id, JSON.stringify({ status: row.status }), JSON.stringify({ status: "resolved", notes }));
    return this.db.prepare("SELECT * FROM commons_alerts WHERE id = ?").get(id) as CommonsAlert;
  }

  createAlert(tenantId: string, alert: Omit<CommonsAlert, "id" | "tenant_id" | "created_at" | "updated_at">): CommonsAlert {
    const id = `alert-${crypto.randomUUID()}`;
    const now = nowIso();
    this.db.prepare(`
      INSERT INTO commons_alerts (id, tenant_id, domain, severity, title, detail, affected_object_type, affected_object_id, suggested_action, status, created_at, updated_at, owner_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, tenantId, alert.domain, alert.severity, alert.title, alert.detail, alert.affected_object_type, alert.affected_object_id, alert.suggested_action, alert.status ?? "open", now, now, alert.owner_id ?? null);
    return this.db.prepare("SELECT * FROM commons_alerts WHERE id = ?").get(id) as CommonsAlert;
  }

  // ── Records ───────────────────────────────────────────────────────────────

  createRecord(tenantId: string, input: {
    record_type: string;
    module_key: string;
    intake_channel: IntakeChannel;
    requester_name?: string | null;
    requester_email?: string | null;
    request_description: string;
    department_id?: string | null;
    sla_days?: number | null;
    actorUserId: string;
  }): CommonsRecord {
    const id = `cr-${crypto.randomUUID()}`;
    const now = nowIso();
    const sla_due_at = input.sla_days ? addBusinessDays(now, input.sla_days) : null;
    const retention_class = input.module_key === "VAULTCLERK.PublicRecords" ? "Standard-2yr" : null;

    this.db.prepare(`
      INSERT INTO commons_records (id, tenant_id, record_type, module_key, intake_channel, requester_name, requester_email, request_description, department_id, pipeline_stage, status, sla_due_at, retention_class, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 'open', ?, ?, ?, ?)
    `).run(id, tenantId, input.record_type, input.module_key, input.intake_channel, input.requester_name ?? null, input.requester_email ?? null, input.request_description, input.department_id ?? null, sla_due_at, retention_class, now, now);

    // Instantiate module instance
    const stages = DEFAULT_WORKFLOW_STAGES[input.module_key] ?? [];
    const stagesWithStatus = stages.map((s, i) => ({
      ...s,
      status: i === 0 ? "active" : "pending",
    }));
    this.createModuleInstance(id, tenantId, input.module_key, stagesWithStatus, input.actorUserId);
    this.appendAudit(tenantId, input.actorUserId, "record.created", "commons_record", id, null, JSON.stringify({ record_type: input.record_type, module_key: input.module_key }));

    return this.db.prepare("SELECT * FROM commons_records WHERE id = ?").get(id) as CommonsRecord;
  }

  getRecord(id: string, tenantId: string): CommonsRecord | null {
    return this.db.prepare("SELECT * FROM commons_records WHERE id = ? AND tenant_id = ?").get(id, tenantId) as CommonsRecord | null;
  }

  listRecords(tenantId: string, params?: { module_key?: string; status?: string }): CommonsRecord[] {
    let sql = "SELECT * FROM commons_records WHERE tenant_id = ?";
    const args: unknown[] = [tenantId];
    if (params?.module_key) { sql += " AND module_key = ?"; args.push(params.module_key); }
    if (params?.status) { sql += " AND status = ?"; args.push(params.status); }
    sql += " ORDER BY created_at DESC";
    return this.db.prepare(sql).all(...args) as CommonsRecord[];
  }

  // ── Module instances ──────────────────────────────────────────────────────

  private createModuleInstance(recordId: string, tenantId: string, moduleKey: string, stages: unknown[], actorUserId: string): ModuleInstance {
    const id = `mi-${crypto.randomUUID()}`;
    const now = nowIso();
    this.db.prepare(`
      INSERT INTO module_instances (id, record_id, tenant_id, module_key, current_step, workflow_stages, role_assignments, stop_rules, can_advance, blocking_fields, instantiated_at, updated_at)
      VALUES (?, ?, ?, ?, 1, ?, '{}', '[]', 1, '[]', ?, ?)
    `).run(id, recordId, tenantId, moduleKey, JSON.stringify(stages), now, now);
    this.appendAudit(tenantId, actorUserId, "module.instantiated", "module_instance", id, null, JSON.stringify({ module_key: moduleKey }));
    return this.db.prepare("SELECT * FROM module_instances WHERE id = ?").get(id) as ModuleInstance;
  }

  getModuleInstanceByRecord(recordId: string, tenantId: string): ModuleInstance | null {
    return this.db.prepare("SELECT * FROM module_instances WHERE record_id = ? AND tenant_id = ?").get(recordId, tenantId) as ModuleInstance | null;
  }

  getModuleInstance(id: string, tenantId: string): ModuleInstance | null {
    return this.db.prepare("SELECT * FROM module_instances WHERE id = ? AND tenant_id = ?").get(id, tenantId) as ModuleInstance | null;
  }

  advanceWorkflow(instanceId: string, tenantId: string, actorUserId: string): { ok: boolean; error?: string; instance?: ModuleInstance } {
    const inst = this.getModuleInstance(instanceId, tenantId);
    if (!inst) return { ok: false, error: "Not found" };
    if (!inst.can_advance) return { ok: false, error: "Cannot advance: stop-rules not met" };

    const stages = JSON.parse(inst.workflow_stages) as Array<{ id: string; order: number; label: string; status: string; completed_at?: string }>;
    const nextStep = inst.current_step + 1;
    if (nextStep > stages.length) return { ok: false, error: "Already at final stage" };

    const now = nowIso();
    const updatedStages = stages.map((s, i) => {
      if (i === inst.current_step - 1) return { ...s, status: "complete", completed_at: now };
      if (i === inst.current_step) return { ...s, status: "active" };
      return s;
    });

    const beforeState = JSON.stringify({ current_step: inst.current_step });
    this.db.prepare("UPDATE module_instances SET current_step = ?, workflow_stages = ?, updated_at = ? WHERE id = ?")
      .run(nextStep, JSON.stringify(updatedStages), now, instanceId);

    // Update parent record pipeline_stage and status
    const record = this.db.prepare("SELECT * FROM commons_records WHERE id = ?").get(inst.record_id) as CommonsRecord | null;
    if (record) {
      const newPipelineStage = Math.min(record.pipeline_stage + 1, 14);
      this.db.prepare("UPDATE commons_records SET pipeline_stage = ?, status = ?, updated_at = ? WHERE id = ?")
        .run(newPipelineStage, "in_progress", now, inst.record_id);
    }

    this.appendAudit(tenantId, actorUserId, "stage.advanced", "module_instance", instanceId, beforeState, JSON.stringify({ current_step: nextStep }));
    return { ok: true, instance: this.getModuleInstance(instanceId, tenantId)! };
  }

  getCloseoutReadiness(instanceId: string, tenantId: string): { ready: boolean; blocking: string[] } {
    const inst = this.getModuleInstance(instanceId, tenantId);
    if (!inst) return { ready: false, blocking: ["Instance not found"] };
    const blocking: string[] = [];
    if (inst.can_advance) {
      const stages = JSON.parse(inst.workflow_stages) as Array<{ status: string }>;
      const allComplete = stages.every(s => s.status === "complete");
      if (!allComplete) blocking.push("Not all workflow stages are complete");
    }
    const pendingPlacements = this.db.prepare(
      "SELECT COUNT(*) as n FROM placement_confirmations WHERE module_instance_id = ? AND confirmation_status = 'pending'"
    ).get(instanceId) as { n: number };
    if (pendingPlacements.n > 0) blocking.push(`${pendingPlacements.n} placement(s) still pending confirmation`);
    return { ready: blocking.length === 0, blocking };
  }

  // ── Artifacts ─────────────────────────────────────────────────────────────

  listArtifacts(instanceId: string, tenantId: string): Artifact[] {
    return this.db.prepare("SELECT * FROM generated_artifacts WHERE module_instance_id = ? AND tenant_id = ? ORDER BY rendered_at ASC")
      .all(instanceId, tenantId) as Artifact[];
  }

  // ── Placements ────────────────────────────────────────────────────────────

  listPlacements(instanceId: string, tenantId: string): PlacementConfirmation[] {
    return this.db.prepare("SELECT * FROM placement_confirmations WHERE module_instance_id = ? AND tenant_id = ? ORDER BY rowid ASC")
      .all(instanceId, tenantId) as PlacementConfirmation[];
  }

  // ── Module registry ───────────────────────────────────────────────────────

  listModules(): unknown[] {
    return this.db.prepare("SELECT * FROM module_registry WHERE is_active = 1 ORDER BY module_key").all();
  }

  // ── Audit ─────────────────────────────────────────────────────────────────

  private appendAudit(tenantId: string, actorUserId: string, action: string, objectType: string, objectId: string, before: string | null, after: string | null): void {
    this.db.prepare(`
      INSERT INTO commons_audit (tenant_id, actor_user_id, action, object_type, object_id, before_state, after_state, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(tenantId, actorUserId, action, objectType, objectId, before, after, nowIso());
  }
}
