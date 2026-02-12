import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Database from "better-sqlite3";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, "../../");
const CONTROLLED_DATA_DIR = path.join(ROOT_DIR, "data");

export const PRR_STATUSES = ["received", "acknowledged", "in_progress", "extended", "closed"] as const;
export type PrrStatus = (typeof PRR_STATUSES)[number];

export const ACCESS_REQUEST_STATUSES = [
  "received",
  "under_review",
  "approved",
  "provisioned",
  "denied",
  "revoked",
  "closed"
] as const;
export type AccessRequestStatus = (typeof ACCESS_REQUEST_STATUSES)[number];

type PrrRow = {
  id: string;
  public_id: string | null;
  tenant_id: string;
  requester_name: string | null;
  requester_email: string | null;
  subject: string;
  description: string | null;
  status: PrrStatus;
  assigned_to: string | null;
  received_at: string;
  statutory_due_at: string;
  last_action_at: string | null;
  closed_at: string | null;
  disposition: string | null;
};

type PrrListItem = {
  id: string;
  received_at: string;
  statutory_due_at: string;
  status: PrrStatus;
  assigned_to: string | null;
  last_action_at: string | null;
};

type AccessRequestRow = {
  id: string;
  case_id: string;
  tenant_id: string;
  requester_name: string | null;
  requester_email: string;
  organization: string | null;
  requested_role: string;
  system: string;
  justification: string;
  status: AccessRequestStatus;
  received_at: string;
  last_action_at: string;
  closed_at: string | null;
  resolution: string | null;
  requested_by_user_id: string | null;
};

type AccessRequestNotificationRow = {
  id: number;
  access_request_id: string;
  tenant_id: string;
  target_email: string;
  status: string;
  payload_json: string;
  created_at: string;
  last_attempt_at: string | null;
  retry_count: number;
  next_attempt_at: string | null;
  last_error: string | null;
  delivery_response: string | null;
  sent_at: string | null;
};

type IntakeInput = {
  tenantId: string;
  requesterName: string | null;
  requesterEmail: string | null;
  subject: string;
  description: string | null;
  actorUserId: string;
  metadata?: Record<string, unknown>;
};

type IntakeResult = {
  id: string;
  public_id: string;
  tenantId: string;
  received_at: string;
  statutory_due_at: string;
  status: PrrStatus;
};

type AccessRequestIntakeInput = {
  tenantId: string;
  requesterName: string | null;
  requesterEmail: string;
  organization: string | null;
  requestedRole: string;
  system: string | null;
  justification: string;
  actorUserId: string;
  source: string | null;
};

type AccessRequestIntakeResult = {
  id: string;
  case_id: string;
  tenantId: string;
  received_at: string;
  status: AccessRequestStatus;
  notification: {
    target: string;
    status: string;
  };
};

type StatusTransitionResult =
  | { ok: true; row: PrrListItem }
  | { ok: false; code: "not_found" | "invalid_transition"; fromStatus?: PrrStatus };

type CloseResult =
  | {
      ok: true;
      row: { id: string; status: "closed"; closed_at: string; disposition: string | null; last_action_at: string };
    }
  | { ok: false; code: "not_found" | "invalid_transition"; fromStatus?: PrrStatus };

type AccessRequestStatusTransitionResult =
  | {
      ok: true;
      row: {
        id: string;
        case_id: string;
        status: AccessRequestStatus;
        last_action_at: string;
      };
    }
  | { ok: false; code: "not_found" | "invalid_transition"; fromStatus?: AccessRequestStatus };

type AccessRequestCloseResult =
  | {
      ok: true;
      row: {
        id: string;
        case_id: string;
        status: "closed";
        closed_at: string;
        resolution: string | null;
        last_action_at: string;
      };
    }
  | { ok: false; code: "not_found" | "invalid_transition"; fromStatus?: AccessRequestStatus };

const ALLOWED_TRANSITIONS: Record<PrrStatus, ReadonlyArray<PrrStatus>> = {
  received: ["acknowledged"],
  acknowledged: ["in_progress"],
  in_progress: ["extended", "closed"],
  extended: ["closed"],
  closed: []
};

const ACCESS_NOTIFICATION_TARGET = "info@publiclogic.org";

const ALLOWED_ACCESS_REQUEST_TRANSITIONS: Record<AccessRequestStatus, ReadonlyArray<AccessRequestStatus>> = {
  received: ["under_review", "denied"],
  under_review: ["approved", "denied", "closed"],
  approved: ["provisioned", "revoked", "closed"],
  provisioned: ["revoked", "closed"],
  denied: ["closed"],
  revoked: ["closed"],
  closed: []
};

function isPathInsideDirectory(candidatePath: string, baseDirectory: string): boolean {
  const resolvedCandidate = path.resolve(candidatePath);
  const resolvedBase = path.resolve(baseDirectory);
  const relative = path.relative(resolvedBase, resolvedCandidate);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function normalizeOptionalText(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

export function addBusinessDays(startIso: string, days: number): string {
  const date = new Date(startIso);
  if (!Number.isFinite(date.getTime())) {
    throw new Error("Invalid start timestamp");
  }
  let remaining = Math.max(0, Math.floor(days));
  while (remaining > 0) {
    date.setUTCDate(date.getUTCDate() + 1);
    const dayOfWeek = date.getUTCDay();
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      remaining -= 1;
    }
  }
  return date.toISOString();
}

export class PrrStore {
  private readonly db: Database.Database;

  constructor(dbPath: string) {
    const resolvedPath = path.resolve(dbPath);
    if (!isPathInsideDirectory(resolvedPath, CONTROLLED_DATA_DIR)) {
      throw new Error(`PRR_DB_PATH must be inside ${CONTROLLED_DATA_DIR}`);
    }

    fs.mkdirSync(path.dirname(resolvedPath), { recursive: true });
    this.db = new Database(resolvedPath);
    this.db.pragma("journal_mode = WAL");
    this.db.pragma("foreign_keys = ON");
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS prr (
        id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL,
        requester_name TEXT,
        requester_email TEXT,
        subject TEXT NOT NULL,
        description TEXT,
        status TEXT NOT NULL,
        assigned_to TEXT,
        received_at TEXT NOT NULL,
        statutory_due_at TEXT NOT NULL,
        last_action_at TEXT,
        closed_at TEXT,
        disposition TEXT,
        tenant_case_seq INTEGER DEFAULT 0
      );
      CREATE INDEX IF NOT EXISTS ix_prr_tenant_received_at ON prr(tenant_id, received_at);

      CREATE TABLE IF NOT EXISTS prr_audit (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        prr_id TEXT NOT NULL,
        tenant_id TEXT NOT NULL,
        action TEXT NOT NULL,
        actor_user_id TEXT NOT NULL,
        from_status TEXT,
        to_status TEXT,
        metadata TEXT,
        created_at TEXT NOT NULL,
        FOREIGN KEY(prr_id) REFERENCES prr(id)
      );
      CREATE INDEX IF NOT EXISTS ix_prr_audit_prr ON prr_audit(prr_id);

      CREATE TABLE IF NOT EXISTS access_request (
        id TEXT PRIMARY KEY,
        case_id TEXT NOT NULL UNIQUE,
        tenant_id TEXT NOT NULL,
        requester_name TEXT,
        requester_email TEXT NOT NULL,
        organization TEXT,
        requested_role TEXT NOT NULL,
        system TEXT NOT NULL,
        justification TEXT NOT NULL,
        status TEXT NOT NULL,
        received_at TEXT NOT NULL,
        last_action_at TEXT NOT NULL,
        closed_at TEXT,
        resolution TEXT,
        requested_by_user_id TEXT
      );
      CREATE INDEX IF NOT EXISTS ix_access_request_tenant_received ON access_request(tenant_id, received_at);

      CREATE TABLE IF NOT EXISTS access_request_audit (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        access_request_id TEXT NOT NULL,
        tenant_id TEXT NOT NULL,
        action TEXT NOT NULL,
        actor_user_id TEXT NOT NULL,
        from_status TEXT,
        to_status TEXT,
        metadata TEXT,
        created_at TEXT NOT NULL,
        FOREIGN KEY(access_request_id) REFERENCES access_request(id)
      );
      CREATE INDEX IF NOT EXISTS ix_access_request_audit_request ON access_request_audit(access_request_id);

      CREATE TABLE IF NOT EXISTS access_request_notification (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        access_request_id TEXT NOT NULL,
        tenant_id TEXT NOT NULL,
        target_email TEXT NOT NULL,
        status TEXT NOT NULL,
        payload_json TEXT NOT NULL,
        created_at TEXT NOT NULL,
        last_attempt_at TEXT,
        retry_count INTEGER NOT NULL DEFAULT 0,
        next_attempt_at TEXT,
        last_error TEXT,
        delivery_response TEXT,
        sent_at TEXT,
        FOREIGN KEY(access_request_id) REFERENCES access_request(id)
      );
      CREATE INDEX IF NOT EXISTS ix_access_request_notification_request ON access_request_notification(access_request_id);
    `);
    this.ensureColumn("prr", "public_id", "public_id TEXT");
    this.db.exec("CREATE UNIQUE INDEX IF NOT EXISTS ix_prr_public_id ON prr(public_id)");
    this.ensureColumn("access_request_notification", "last_attempt_at", "last_attempt_at TEXT");
    this.ensureColumn("access_request_notification", "retry_count", "retry_count INTEGER NOT NULL DEFAULT 0");
    this.ensureColumn("access_request_notification", "next_attempt_at", "next_attempt_at TEXT");
    this.ensureColumn("access_request_notification", "last_error", "last_error TEXT");
    this.ensureColumn("access_request_notification", "delivery_response", "delivery_response TEXT");
  }

  private ensureColumn(tableName: string, columnName: string, definition: string): void {
    const existingColumns = this.db
      .prepare(`PRAGMA table_info(${tableName})`)
      .all() as Array<{ name: string }>;
    if (!existingColumns.some((column) => column.name === columnName)) {
      this.db.exec(`ALTER TABLE ${tableName} ADD COLUMN ${definition}`);
    }
  }

  intake(input: IntakeInput): IntakeResult {
    const nowIso = new Date().toISOString();
    const dueAtIso = addBusinessDays(nowIso, 10);
    const prrId = crypto.randomUUID();
    const insertPrr = this.db.prepare(
      `
      INSERT INTO prr
        (id, public_id, tenant_id, requester_name, requester_email, subject, description, status, assigned_to, received_at, statutory_due_at, last_action_at, closed_at, disposition)
      VALUES
        (?, ?, ?, ?, ?, ?, ?, 'received', NULL, ?, ?, ?, NULL, NULL)
    `
    );
    const insertAudit = this.db.prepare(
      `
      INSERT INTO prr_audit
        (prr_id, tenant_id, action, actor_user_id, from_status, to_status, metadata, created_at)
      VALUES
        (?, ?, 'intake', ?, NULL, 'received', ?, ?)
    `
    );
    const persist = this.db.transaction((publicId: string) => {
      const metadata = JSON.stringify(input.metadata ?? {});
      insertPrr.run(
        prrId,
        publicId,
        input.tenantId,
        normalizeOptionalText(input.requesterName),
        normalizeOptionalText(input.requesterEmail),
        input.subject.trim(),
        normalizeOptionalText(input.description),
        nowIso,
        dueAtIso,
        nowIso
      );
      insertAudit.run(prrId, input.tenantId, input.actorUserId, metadata, nowIso);
    });

    let publicId = "";
    let persisted = false;
    for (let attempt = 0; attempt < 5; attempt += 1) {
      publicId = crypto.randomUUID();
      try {
        persist(publicId);
        persisted = true;
        break;
      } catch (error) {
        if (
          error instanceof Error &&
          /UNIQUE constraint failed: prr\.public_id/i.test(error.message)
        ) {
          continue;
        }
        throw error;
      }
    }

    if (!persisted || !publicId) {
      throw new Error("Failed to allocate public tracking id");
    }

    return {
      id: prrId,
      public_id: publicId,
      tenantId: input.tenantId,
      received_at: nowIso,
      statutory_due_at: dueAtIso,
      status: "received"
    };
  }

  intakeAccessRequest(input: AccessRequestIntakeInput): AccessRequestIntakeResult {
    const nowIso = new Date().toISOString();
    const requestId = crypto.randomUUID();
    const systemName = normalizeOptionalText(input.system) ?? "PuddleJumper";
    const source = normalizeOptionalText(input.source) ?? "api.access.request";
    const createCaseId = (): string => {
      const datePart = nowIso.slice(0, 10).replace(/-/g, "");
      const randomPart = crypto.randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase();
      return `AR-${datePart}-${randomPart}`;
    };

    const insertRequest = this.db.prepare(
      `
      INSERT INTO access_request
        (id, case_id, tenant_id, requester_name, requester_email, organization, requested_role, system, justification, status, received_at, last_action_at, closed_at, resolution, requested_by_user_id)
      VALUES
        (?, ?, ?, ?, ?, ?, ?, ?, ?, 'received', ?, ?, NULL, NULL, ?)
      `
    );
    const insertAudit = this.db.prepare(
      `
      INSERT INTO access_request_audit
        (access_request_id, tenant_id, action, actor_user_id, from_status, to_status, metadata, created_at)
      VALUES
        (?, ?, 'intake', ?, NULL, 'received', ?, ?)
      `
    );
    const insertNotification = this.db.prepare(
      `
      INSERT INTO access_request_notification
        (access_request_id, tenant_id, target_email, status, payload_json, created_at, sent_at)
      VALUES
        (?, ?, ?, 'queued', ?, ?, NULL)
      `
    );

    const persist = this.db.transaction((caseId: string) => {
      const normalizedRequesterName = normalizeOptionalText(input.requesterName);
      const normalizedRequesterEmail = input.requesterEmail.trim().toLowerCase();
      const normalizedOrganization = normalizeOptionalText(input.organization);
      const normalizedRequestedRole = input.requestedRole.trim();
      const normalizedJustification = input.justification.trim();
      const normalizedRequestedByUserId = normalizeOptionalText(input.actorUserId);
      const metadata = JSON.stringify({
        source,
        requester_email: normalizedRequesterEmail,
        requested_role: normalizedRequestedRole,
        notification_target: ACCESS_NOTIFICATION_TARGET
      });
      const notificationPayload = JSON.stringify({
        case_id: caseId,
        tenant_id: input.tenantId,
        requester_email: normalizedRequesterEmail,
        requested_role: normalizedRequestedRole,
        system: systemName,
        received_at: nowIso
      });
      insertRequest.run(
        requestId,
        caseId,
        input.tenantId,
        normalizedRequesterName,
        normalizedRequesterEmail,
        normalizedOrganization,
        normalizedRequestedRole,
        systemName,
        normalizedJustification,
        nowIso,
        nowIso,
        normalizedRequestedByUserId
      );
      insertAudit.run(requestId, input.tenantId, input.actorUserId, metadata, nowIso);
      insertNotification.run(requestId, input.tenantId, ACCESS_NOTIFICATION_TARGET, notificationPayload, nowIso);
    });

    let caseId = "";
    let persisted = false;
    for (let attempt = 0; attempt < 5; attempt += 1) {
      caseId = createCaseId();
      try {
        persist(caseId);
        persisted = true;
        break;
      } catch (error) {
        if (error instanceof Error && /UNIQUE constraint failed: access_request\.case_id/i.test(error.message)) {
          continue;
        }
        throw error;
      }
    }

    if (!persisted || !caseId) {
      throw new Error("Failed to allocate access request case id");
    }

    return {
      id: requestId,
      case_id: caseId,
      tenantId: input.tenantId,
      received_at: nowIso,
      status: "received",
      notification: {
        target: ACCESS_NOTIFICATION_TARGET,
        status: "queued"
      }
    };
  }

  listForTenant(args: {
    tenantId: string;
    status?: PrrStatus;
    assignedTo?: string;
    page: number;
    limit: number;
  }): { items: PrrListItem[]; page: number; limit: number } {
    const where: string[] = ["tenant_id = ?"];
    const params: Array<string | number> = [args.tenantId];

    if (args.status) {
      where.push("status = ?");
      params.push(args.status);
    }
    if (args.assignedTo) {
      where.push("assigned_to = ?");
      params.push(args.assignedTo);
    }

    const offset = (args.page - 1) * args.limit;
    params.push(args.limit, offset);
    const rows = this.db
      .prepare(
        `
        SELECT id, received_at, statutory_due_at, status, assigned_to, last_action_at
        FROM prr
        WHERE ${where.join(" AND ")}
        ORDER BY received_at DESC
        LIMIT ? OFFSET ?
      `
      )
      .all(...params) as Array<{
      id: string;
      received_at: string;
      statutory_due_at: string;
      status: PrrStatus;
      assigned_to: string | null;
      last_action_at: string | null;
    }>;

    return {
      items: rows.map((row) => ({
        id: row.id,
        received_at: row.received_at,
        statutory_due_at: row.statutory_due_at,
        status: row.status,
        assigned_to: row.assigned_to,
        last_action_at: row.last_action_at
      })),
      page: args.page,
      limit: args.limit
    };
  }

  transitionStatus(args: {
    id: string;
    tenantId: string;
    toStatus: PrrStatus;
    actorUserId: string;
    metadata?: Record<string, unknown>;
  }): StatusTransitionResult {
    const transition = this.db.transaction(() => {
      const row = this.db.prepare("SELECT * FROM prr WHERE id = ? AND tenant_id = ?").get(args.id, args.tenantId) as
        | PrrRow
        | undefined;
      if (!row) {
        return { ok: false, code: "not_found" } as const;
      }

      const allowed = ALLOWED_TRANSITIONS[row.status] ?? [];
      if (!allowed.includes(args.toStatus)) {
        return { ok: false, code: "invalid_transition", fromStatus: row.status } as const;
      }

      const nowIso = new Date().toISOString();
      this.db
        .prepare("UPDATE prr SET status = ?, last_action_at = ? WHERE id = ? AND tenant_id = ?")
        .run(args.toStatus, nowIso, args.id, args.tenantId);

      this.db
        .prepare(
          `
          INSERT INTO prr_audit
            (prr_id, tenant_id, action, actor_user_id, from_status, to_status, metadata, created_at)
          VALUES
            (?, ?, 'status_change', ?, ?, ?, ?, ?)
          `
        )
        .run(
          args.id,
          args.tenantId,
          args.actorUserId,
          row.status,
          args.toStatus,
          JSON.stringify(args.metadata ?? {}),
          nowIso
        );

      return {
        ok: true,
        row: {
          id: args.id,
          received_at: row.received_at,
          statutory_due_at: row.statutory_due_at,
          status: args.toStatus,
          assigned_to: row.assigned_to,
          last_action_at: nowIso
        }
      } as const;
    });

    return transition();
  }

  closeCase(args: {
    id: string;
    tenantId: string;
    actorUserId: string;
    disposition: string | null;
    metadata?: Record<string, unknown>;
  }): CloseResult {
    const transition = this.db.transaction(() => {
      const row = this.db.prepare("SELECT * FROM prr WHERE id = ? AND tenant_id = ?").get(args.id, args.tenantId) as
        | PrrRow
        | undefined;
      if (!row) {
        return { ok: false, code: "not_found" } as const;
      }

      const allowed = ALLOWED_TRANSITIONS[row.status] ?? [];
      if (!allowed.includes("closed")) {
        return { ok: false, code: "invalid_transition", fromStatus: row.status } as const;
      }

      const nowIso = new Date().toISOString();
      const normalizedDisposition = normalizeOptionalText(args.disposition);
      this.db
        .prepare(
          "UPDATE prr SET status = 'closed', closed_at = ?, disposition = ?, last_action_at = ? WHERE id = ? AND tenant_id = ?"
        )
        .run(nowIso, normalizedDisposition, nowIso, args.id, args.tenantId);

      this.db
        .prepare(
          `
          INSERT INTO prr_audit
            (prr_id, tenant_id, action, actor_user_id, from_status, to_status, metadata, created_at)
          VALUES
            (?, ?, 'close', ?, ?, 'closed', ?, ?)
          `
        )
        .run(
          args.id,
          args.tenantId,
          args.actorUserId,
          row.status,
          JSON.stringify(args.metadata ?? {}),
          nowIso
        );

      return {
        ok: true,
        row: {
          id: args.id,
          status: "closed",
          closed_at: nowIso,
          disposition: normalizedDisposition,
          last_action_at: nowIso
        }
      } as const;
    });

    return transition();
  }

  transitionAccessRequestStatus(args: {
    id: string;
    tenantId: string;
    toStatus: AccessRequestStatus;
    actorUserId: string;
    metadata?: Record<string, unknown>;
  }): AccessRequestStatusTransitionResult {
    const transition = this.db.transaction(() => {
      const row = this.db
        .prepare("SELECT * FROM access_request WHERE id = ? AND tenant_id = ?")
        .get(args.id, args.tenantId) as AccessRequestRow | undefined;
      if (!row) {
        return { ok: false, code: "not_found" } as const;
      }

      const allowed = ALLOWED_ACCESS_REQUEST_TRANSITIONS[row.status] ?? [];
      if (!allowed.includes(args.toStatus)) {
        return { ok: false, code: "invalid_transition", fromStatus: row.status } as const;
      }

      const nowIso = new Date().toISOString();
      this.db
        .prepare("UPDATE access_request SET status = ?, last_action_at = ? WHERE id = ? AND tenant_id = ?")
        .run(args.toStatus, nowIso, args.id, args.tenantId);

      this.db
        .prepare(
          `
          INSERT INTO access_request_audit
            (access_request_id, tenant_id, action, actor_user_id, from_status, to_status, metadata, created_at)
          VALUES
            (?, ?, 'status_change', ?, ?, ?, ?, ?)
          `
        )
        .run(
          args.id,
          args.tenantId,
          args.actorUserId,
          row.status,
          args.toStatus,
          JSON.stringify(args.metadata ?? {}),
          nowIso
        );

      return {
        ok: true,
        row: {
          id: row.id,
          case_id: row.case_id,
          status: args.toStatus,
          last_action_at: nowIso
        }
      } as const;
    });

    return transition();
  }

  closeAccessRequest(args: {
    id: string;
    tenantId: string;
    actorUserId: string;
    resolution: string | null;
    metadata?: Record<string, unknown>;
  }): AccessRequestCloseResult {
    const transition = this.db.transaction(() => {
      const row = this.db
        .prepare("SELECT * FROM access_request WHERE id = ? AND tenant_id = ?")
        .get(args.id, args.tenantId) as AccessRequestRow | undefined;
      if (!row) {
        return { ok: false, code: "not_found" } as const;
      }

      const allowed = ALLOWED_ACCESS_REQUEST_TRANSITIONS[row.status] ?? [];
      if (!allowed.includes("closed")) {
        return { ok: false, code: "invalid_transition", fromStatus: row.status } as const;
      }

      const nowIso = new Date().toISOString();
      const normalizedResolution = normalizeOptionalText(args.resolution);
      this.db
        .prepare(
          "UPDATE access_request SET status = 'closed', closed_at = ?, resolution = ?, last_action_at = ? WHERE id = ? AND tenant_id = ?"
        )
        .run(nowIso, normalizedResolution, nowIso, args.id, args.tenantId);

      this.db
        .prepare(
          `
          INSERT INTO access_request_audit
            (access_request_id, tenant_id, action, actor_user_id, from_status, to_status, metadata, created_at)
          VALUES
            (?, ?, 'close', ?, ?, 'closed', ?, ?)
          `
        )
        .run(
          args.id,
          args.tenantId,
          args.actorUserId,
          row.status,
          JSON.stringify(args.metadata ?? {}),
          nowIso
        );

      const notificationPayload = JSON.stringify({
        case_id: row.case_id,
        tenant_id: args.tenantId,
        status: "closed",
        closed_at: nowIso,
        resolution: normalizedResolution
      });
      this.db
        .prepare(
          `
          INSERT INTO access_request_notification
            (access_request_id, tenant_id, target_email, status, payload_json, created_at, sent_at)
          VALUES
            (?, ?, ?, 'queued', ?, ?, NULL)
          `
        )
        .run(args.id, args.tenantId, ACCESS_NOTIFICATION_TARGET, notificationPayload, nowIso);

      return {
        ok: true,
        row: {
          id: row.id,
          case_id: row.case_id,
          status: "closed",
          closed_at: nowIso,
          resolution: normalizedResolution,
          last_action_at: nowIso
        }
      } as const;
    });

    return transition();
  }

  getAuditCount(prrId: string): number {
    const count = this.db
      .prepare("SELECT COUNT(*) as count FROM prr_audit WHERE prr_id = ?")
      .get(prrId) as { count: number };
    return Number.isFinite(count.count) ? count.count : 0;
  }

  getRecordForTenant(prrId: string, tenantId: string): PrrRow | null {
    const row = this.db
      .prepare("SELECT * FROM prr WHERE id = ? AND tenant_id = ?")
      .get(prrId, tenantId) as PrrRow | undefined;
    return row ?? null;
  }

  getByPublicId(publicId: string): {
    public_id: string;
    received_at: string;
    status: PrrStatus;
    due_date: string;
    description: string | null;
    tenant_id: string;
  } | null {
    const row = this.db
      .prepare(
        `
        SELECT public_id, received_at, status, statutory_due_at AS due_date, description, tenant_id
        FROM prr
        WHERE public_id = ?
        LIMIT 1
      `
      )
      .get(publicId) as
      | {
          public_id: string;
          received_at: string;
          status: PrrStatus;
          due_date: string;
          description: string | null;
          tenant_id: string;
        }
      | undefined;
    return row ?? null;
  }

  getTenantAgencyName(tenantId: string): string | null {
    try {
      const row = this.db
        .prepare("SELECT display_name FROM tenants WHERE id = ? LIMIT 1")
        .get(tenantId) as { display_name?: string } | undefined;
      if (!row?.display_name || !row.display_name.trim()) {
        return null;
      }
      return row.display_name.trim();
    } catch {
      return null;
    }
  }

  getAccessRequestForTenant(accessRequestId: string, tenantId: string): AccessRequestRow | null {
    const row = this.db
      .prepare("SELECT * FROM access_request WHERE id = ? AND tenant_id = ?")
      .get(accessRequestId, tenantId) as AccessRequestRow | undefined;
    return row ?? null;
  }

  getAccessRequestAuditCount(accessRequestId: string): number {
    const count = this.db
      .prepare("SELECT COUNT(*) as count FROM access_request_audit WHERE access_request_id = ?")
      .get(accessRequestId) as { count: number };
    return Number.isFinite(count.count) ? count.count : 0;
  }

  getLatestAccessRequestNotification(accessRequestId: string): AccessRequestNotificationRow | null {
    const row = this.db
      .prepare(
        `
        SELECT id, access_request_id, tenant_id, target_email, status, payload_json, created_at, last_attempt_at, retry_count, next_attempt_at, last_error, delivery_response, sent_at
        FROM access_request_notification
        WHERE access_request_id = ?
        ORDER BY id DESC
        LIMIT 1
      `
      )
      .get(accessRequestId) as AccessRequestNotificationRow | undefined;
    return row ?? null;
  }

  claimPendingAccessRequestNotifications(limit: number): AccessRequestNotificationRow[] {
    const boundedLimit = Math.max(1, Math.min(limit, 100));
    const nowIso = new Date().toISOString();
    const selectPending = this.db.prepare(
      `
      SELECT id, access_request_id, tenant_id, target_email, status, payload_json, created_at, last_attempt_at, retry_count, next_attempt_at, last_error, delivery_response, sent_at
      FROM access_request_notification
      WHERE sent_at IS NULL
        AND status IN ('queued', 'retry')
        AND (next_attempt_at IS NULL OR next_attempt_at <= ?)
      ORDER BY id ASC
      LIMIT ?
    `
    );
    const markProcessing = this.db.prepare(
      `
      UPDATE access_request_notification
      SET status = 'processing',
          last_attempt_at = ?,
          retry_count = retry_count + 1
      WHERE id = ?
        AND sent_at IS NULL
        AND status IN ('queued', 'retry')
        AND (next_attempt_at IS NULL OR next_attempt_at <= ?)
    `
    );

    const claim = this.db.transaction(() => {
      const rows = selectPending.all(nowIso, boundedLimit) as AccessRequestNotificationRow[];
      const claimed: AccessRequestNotificationRow[] = [];
      for (const row of rows) {
        const updated = markProcessing.run(nowIso, row.id, nowIso);
        if (updated.changes !== 1) {
          continue;
        }
        claimed.push({
          ...row,
          status: "processing",
          last_attempt_at: nowIso,
          retry_count: (Number.isFinite(row.retry_count) ? row.retry_count : 0) + 1
        });
      }
      return claimed;
    });

    return claim();
  }

  markAccessRequestNotificationDelivered(args: {
    notificationId: number;
    deliveredAt: string;
    responseSummary: string;
  }): void {
    this.db
      .prepare(
        `
        UPDATE access_request_notification
        SET status = 'delivered',
            sent_at = ?,
            next_attempt_at = NULL,
            last_error = NULL,
            delivery_response = ?
        WHERE id = ?
      `
      )
      .run(args.deliveredAt, args.responseSummary, args.notificationId);
  }

  markAccessRequestNotificationRetry(args: {
    notificationId: number;
    status: "retry" | "failed";
    nextAttemptAt: string | null;
    errorMessage: string;
  }): void {
    this.db
      .prepare(
        `
        UPDATE access_request_notification
        SET status = ?,
            next_attempt_at = ?,
            last_error = ?,
            delivery_response = NULL
        WHERE id = ?
      `
      )
      .run(args.status, args.nextAttemptAt, args.errorMessage, args.notificationId);
  }
}
