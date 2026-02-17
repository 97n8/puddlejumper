// ── Approval Gate Store ─────────────────────────────────────────────────────
//
// SQLite-backed store for governance decisions that require human approval
// before connector plans can be dispatched.
//
// Lifecycle:  pending → approved → dispatching → dispatched
//                     → rejected
//                     → expired  (auto-expiry via TTL)
//
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import Database from "better-sqlite3";

// ── Types ───────────────────────────────────────────────────────────────────

export type ApprovalStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "dispatching"
  | "dispatched"
  | "dispatch_failed"
  | "expired";

export type ApprovalRow = {
  id: string;
  request_id: string;
  decision_status: string;          // engine decision: "approved" (the engine approved it, but it needs human sign-off)
  approval_status: ApprovalStatus;
  operator_id: string;
  workspace_id: string;
  municipality_id: string;
  action_intent: string;
  action_mode: string;
  plan_hash: string;
  plan_json: string;                // serialised PlanStep[]
  audit_record_json: string;        // serialised audit record
  decision_result_json: string;     // full DecisionResult
  approver_id: string | null;
  approval_note: string | null;
  created_at: string;
  updated_at: string;
  expires_at: string;
  dispatched_at: string | null;
  dispatch_result_json: string | null;
};

export type CreateApprovalInput = {
  requestId: string;
  operatorId: string;
  workspaceId: string;
  municipalityId: string;
  actionIntent: string;
  actionMode: string;
  planHash: string;
  planSteps: unknown[];             // PlanStep[]
  auditRecord: unknown;
  decisionResult: unknown;          // full DecisionResult
  ttlSeconds?: number;              // default 48h
};

export type ApprovalDecision = {
  approvalId: string;
  approverId: string;
  status: "approved" | "rejected";
  note?: string;
};

export type ApprovalQueryOptions = {
  approvalStatus?: ApprovalStatus;
  operatorId?: string;
  workspaceId?: string;
  limit?: number;
  offset?: number;
};

// ── Constants ───────────────────────────────────────────────────────────────

const DEFAULT_TTL_SECONDS = 48 * 60 * 60; // 48 hours
const PRUNE_INTERVAL_MS = 5 * 60 * 1000;  // 5 minutes

// ── Store ───────────────────────────────────────────────────────────────────

export class ApprovalStore {
  readonly db: Database.Database;
  private pruneTimer: ReturnType<typeof setInterval> | null = null;

  constructor(dbPath: string) {
    const resolved = path.resolve(dbPath);
    fs.mkdirSync(path.dirname(resolved), { recursive: true });
    this.db = new Database(resolved);
    this.db.pragma("journal_mode = WAL");
    this.db.pragma("synchronous = NORMAL");
    this.db.pragma("wal_autocheckpoint = 1000");
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS approvals (
        id TEXT PRIMARY KEY,
        request_id TEXT NOT NULL UNIQUE,
        decision_status TEXT NOT NULL,
        approval_status TEXT NOT NULL DEFAULT 'pending',
        operator_id TEXT NOT NULL,
        workspace_id TEXT NOT NULL DEFAULT 'system',
        municipality_id TEXT NOT NULL,
        action_intent TEXT NOT NULL,
        action_mode TEXT NOT NULL,
        plan_hash TEXT NOT NULL,
        plan_json TEXT NOT NULL,
        audit_record_json TEXT NOT NULL,
        decision_result_json TEXT NOT NULL,
        approver_id TEXT,
        approval_note TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        dispatched_at TEXT,
        dispatch_result_json TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_approvals_status ON approvals(approval_status);
      CREATE INDEX IF NOT EXISTS idx_approvals_operator ON approvals(operator_id);
      CREATE INDEX IF NOT EXISTS idx_approvals_workspace ON approvals(workspace_id);
      CREATE INDEX IF NOT EXISTS idx_approvals_expires ON approvals(expires_at);
    `);

    // Migration: add workspace_id column if missing
    const pragma = this.db.prepare("PRAGMA table_info(approvals)").all();
    if (!pragma.some((col: any) => col.name === "workspace_id")) {
      this.db.exec("ALTER TABLE approvals ADD COLUMN workspace_id TEXT NOT NULL DEFAULT 'system'");
      this.db.exec("CREATE INDEX IF NOT EXISTS idx_approvals_workspace ON approvals(workspace_id)");
    }

    // Auto-expire pending approvals
    this.pruneTimer = setInterval(() => this.expirePending(), PRUNE_INTERVAL_MS);
    this.pruneTimer.unref?.();
  }

  // ── Create ──────────────────────────────────────────────────────────────

  create(input: CreateApprovalInput): ApprovalRow {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const ttl = input.ttlSeconds ?? DEFAULT_TTL_SECONDS;
    const expiresAt = new Date(Date.now() + ttl * 1000).toISOString();

    this.db.prepare(`
      INSERT INTO approvals (
        id, request_id, decision_status, approval_status,
        operator_id, workspace_id, municipality_id,
        action_intent, action_mode, plan_hash,
        plan_json, audit_record_json, decision_result_json,
        created_at, updated_at, expires_at
      ) VALUES (?, ?, ?, 'pending', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      input.requestId,
      "approved",               // engine approved it
      input.operatorId,
      input.workspaceId,
      input.municipalityId,
      input.actionIntent,
      input.actionMode,
      input.planHash,
      JSON.stringify(input.planSteps),
      JSON.stringify(input.auditRecord),
      JSON.stringify(input.decisionResult),
      now, now, expiresAt,
    );

    return this.findById(id)!;
  }

  // ── Read ────────────────────────────────────────────────────────────────

  findById(id: string): ApprovalRow | null {
    return (this.db.prepare("SELECT * FROM approvals WHERE id = ?").get(id) as ApprovalRow | undefined) ?? null;
  }

  findByRequestId(requestId: string): ApprovalRow | null {
    return (this.db.prepare("SELECT * FROM approvals WHERE request_id = ?").get(requestId) as ApprovalRow | undefined) ?? null;
  }

  query(opts: ApprovalQueryOptions = {}): ApprovalRow[] {
    const conditions: string[] = [];
    const params: unknown[] = [];

    if (opts.approvalStatus) {
      conditions.push("approval_status = ?");
      params.push(opts.approvalStatus);
    }
    if (opts.operatorId) {
      conditions.push("operator_id = ?");
      params.push(opts.operatorId);
    }
    if (opts.workspaceId) {
      conditions.push("workspace_id = ?");
      params.push(opts.workspaceId);
    }

    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    const limit = Math.min(opts.limit ?? 50, 200);
    const offset = opts.offset ?? 0;

    return this.db
      .prepare(`SELECT * FROM approvals ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`)
      .all(...params, limit, offset) as ApprovalRow[];
  }

  countPending(opts: { workspaceId?: string } = {}): number {
    const now = new Date().toISOString();
    let sql = "SELECT COUNT(*) as cnt FROM approvals WHERE approval_status = 'pending' AND expires_at > ?";
    const params: any[] = [now];
    if (opts.workspaceId) {
      sql += " AND workspace_id = ?";
      params.push(opts.workspaceId);
    }
    const row = this.db.prepare(sql).get(...params) as { cnt: number };
    return row.cnt;
  }

  // ── Decide ──────────────────────────────────────────────────────────────

  /**
   * Record an approval or rejection decision.
   * Returns the updated row, or null if the approval was not found or not in pending state.
   */
  decide(decision: ApprovalDecision): ApprovalRow | null {
    const row = this.findById(decision.approvalId);
    if (!row) return null;
    if (row.approval_status !== "pending") return null;

    // Check expiry
    if (new Date(row.expires_at) <= new Date()) {
      this.db.prepare("UPDATE approvals SET approval_status = 'expired', updated_at = ? WHERE id = ?")
        .run(new Date().toISOString(), decision.approvalId);
      return null;
    }

    const now = new Date().toISOString();
    this.db.prepare(`
      UPDATE approvals
      SET approval_status = ?, approver_id = ?, approval_note = ?, updated_at = ?
      WHERE id = ?
    `).run(decision.status, decision.approverId, decision.note ?? null, now, decision.approvalId);

    return this.findById(decision.approvalId);
  }

  // ── Dispatch lifecycle ────────────────────────────────────────────────

  /**
   * Mark an approved item as "dispatching" (in-progress).
   * Returns null if not in "approved" state.
   */
  markDispatching(id: string): ApprovalRow | null {
    const row = this.findById(id);
    if (!row || row.approval_status !== "approved") return null;

    const now = new Date().toISOString();
    this.db.prepare("UPDATE approvals SET approval_status = 'dispatching', updated_at = ? WHERE id = ?")
      .run(now, id);
    return this.findById(id);
  }

  /**
   * Atomic compare-and-swap: approved → dispatching.
   *
   * Uses a single UPDATE with WHERE to prevent double-dispatch race conditions.
   * Returns the row if the CAS succeeded, or null if the row was not in "approved" state.
   */
  consumeForDispatch(id: string): ApprovalRow | null {
    const now = new Date().toISOString();
    const result = this.db.prepare(
      "UPDATE approvals SET approval_status = 'dispatching', updated_at = ? WHERE id = ? AND approval_status = 'approved'"
    ).run(now, id);
    if (result.changes === 0) return null;
    return this.findById(id);
  }

  /**
   * Mark dispatch as completed successfully.
   */
  markDispatched(id: string, result: unknown): ApprovalRow | null {
    const row = this.findById(id);
    if (!row || row.approval_status !== "dispatching") return null;

    const now = new Date().toISOString();
    this.db.prepare(`
      UPDATE approvals
      SET approval_status = 'dispatched', dispatched_at = ?, dispatch_result_json = ?, updated_at = ?
      WHERE id = ?
    `).run(now, JSON.stringify(result), now, id);
    return this.findById(id);
  }

  /**
   * Mark dispatch as failed.
   */
  markDispatchFailed(id: string, error: unknown): ApprovalRow | null {
    const row = this.findById(id);
    if (!row || row.approval_status !== "dispatching") return null;

    const now = new Date().toISOString();
    this.db.prepare(`
      UPDATE approvals
      SET approval_status = 'dispatch_failed', dispatch_result_json = ?, updated_at = ?
      WHERE id = ?
    `).run(JSON.stringify({ error: String(error) }), now, id);
    return this.findById(id);
  }

  // ── Maintenance ───────────────────────────────────────────────────────

  expirePending(): number {
    const now = new Date().toISOString();
    const result = this.db.prepare(
      "UPDATE approvals SET approval_status = 'expired', updated_at = ? WHERE approval_status = 'pending' AND expires_at <= ?"
    ).run(now, now);
    return result.changes;
  }

  close(): void {
    if (this.pruneTimer) {
      clearInterval(this.pruneTimer);
      this.pruneTimer = null;
    }
    this.db.close();
  }
}
