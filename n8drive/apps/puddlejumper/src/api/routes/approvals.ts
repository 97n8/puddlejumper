// ── Approval + Dispatch API Routes ──────────────────────────────────────────
//
// Routes for the human-in-the-loop approval gate and connector dispatch layer.
//
// Approval lifecycle:
//   Engine decision (approved) → POST /api/approvals (create pending)
//   Admin reviews              → POST /api/approvals/:id/decide (approve/reject)
//   Approved                   → POST /api/approvals/:id/dispatch (execute plan)
//
import express from "express";
import {
  getAuthContext,
  requireAuthenticated,
} from "@publiclogic/core";
import type { ApprovalStore } from "../../engine/approvalStore.js";
import type { DispatcherRegistry, PlanStepInput } from "../../engine/dispatch.js";
import { dispatchPlan } from "../../engine/dispatch.js";
import { getCorrelationId } from "../serverMiddleware.js";

export type ApprovalRouteOptions = {
  approvalStore: ApprovalStore;
  dispatcherRegistry: DispatcherRegistry;
  nodeEnv: string;
};

export function createApprovalRoutes(opts: ApprovalRouteOptions): express.Router {
  const router = express.Router();
  const { approvalStore, dispatcherRegistry } = opts;

  // ── List approvals ────────────────────────────────────────────────────
  // GET /api/approvals?status=pending&limit=50&offset=0
  router.get("/approvals", requireAuthenticated(), (req, res) => {
    const auth = getAuthContext(req);
    const correlationId = getCorrelationId(res);
    if (!auth) { res.status(401).json({ success: false, correlationId, error: "Unauthorized" }); return; }

    const approvalStatus = typeof req.query.status === "string" ? req.query.status : undefined;
    const limit = typeof req.query.limit === "string" ? parseInt(req.query.limit, 10) : 50;
    const offset = typeof req.query.offset === "string" ? parseInt(req.query.offset, 10) : 0;

    // Non-admins can only see their own approvals
    const operatorId = auth.role === "admin" ? undefined : auth.userId ?? auth.sub;

    const rows = approvalStore.query({
      approvalStatus: approvalStatus as any,
      operatorId,
      limit: isNaN(limit) ? 50 : limit,
      offset: isNaN(offset) ? 0 : offset,
    });

    const pendingCount = approvalStore.countPending();

    res.json({
      success: true,
      correlationId,
      data: {
        approvals: rows.map(sanitizeRow),
        pendingCount,
        total: rows.length,
      },
    });
  });

  // ── Get single approval ───────────────────────────────────────────────
  // GET /api/approvals/:id
  router.get("/approvals/:id", requireAuthenticated(), (req, res) => {
    const auth = getAuthContext(req);
    const correlationId = getCorrelationId(res);
    if (!auth) { res.status(401).json({ success: false, correlationId, error: "Unauthorized" }); return; }

    const row = approvalStore.findById(req.params.id);
    if (!row) {
      res.status(404).json({ success: false, correlationId, error: "Approval not found" });
      return;
    }

    // Non-admins can only see their own
    if (auth.role !== "admin" && row.operator_id !== (auth.userId ?? auth.sub)) {
      res.status(403).json({ success: false, correlationId, error: "Forbidden" });
      return;
    }

    res.json({ success: true, correlationId, data: sanitizeRow(row) });
  });

  // ── Decide (approve or reject) ────────────────────────────────────────
  // POST /api/approvals/:id/decide  { status: "approved"|"rejected", note?: string }
  router.post("/approvals/:id/decide", requireAuthenticated(), (req, res) => {
    const auth = getAuthContext(req);
    const correlationId = getCorrelationId(res);
    if (!auth) { res.status(401).json({ success: false, correlationId, error: "Unauthorized" }); return; }

    // Only admins can approve/reject
    if (auth.role !== "admin") {
      res.status(403).json({ success: false, correlationId, error: "Only admins can approve or reject" });
      return;
    }

    const { status, note } = req.body ?? {};
    if (status !== "approved" && status !== "rejected") {
      res.status(400).json({ success: false, correlationId, error: "status must be 'approved' or 'rejected'" });
      return;
    }

    const updated = approvalStore.decide({
      approvalId: req.params.id,
      approverId: auth.userId ?? auth.sub ?? "unknown",
      status,
      note: typeof note === "string" ? note : undefined,
    });

    if (!updated) {
      res.status(409).json({
        success: false,
        correlationId,
        error: "Approval not in pending state or has expired",
      });
      return;
    }

    res.json({ success: true, correlationId, data: sanitizeRow(updated) });
  });

  // ── Dispatch approved plan ────────────────────────────────────────────
  // POST /api/approvals/:id/dispatch  { dryRun?: boolean }
  router.post("/approvals/:id/dispatch", requireAuthenticated(), async (req, res) => {
    const auth = getAuthContext(req);
    const correlationId = getCorrelationId(res);
    if (!auth) { res.status(401).json({ success: false, correlationId, error: "Unauthorized" }); return; }

    // Only admins can dispatch
    if (auth.role !== "admin") {
      res.status(403).json({ success: false, correlationId, error: "Only admins can dispatch" });
      return;
    }

    const row = approvalStore.findById(req.params.id);
    if (!row) {
      res.status(404).json({ success: false, correlationId, error: "Approval not found" });
      return;
    }

    if (row.approval_status !== "approved") {
      res.status(409).json({
        success: false,
        correlationId,
        error: `Cannot dispatch: approval status is "${row.approval_status}", expected "approved"`,
      });
      return;
    }

    // Mark as dispatching
    const dispatching = approvalStore.markDispatching(row.id);
    if (!dispatching) {
      res.status(409).json({ success: false, correlationId, error: "Failed to acquire dispatch lock" });
      return;
    }

    const dryRun = req.body?.dryRun === true;

    try {
      const planSteps: PlanStepInput[] = JSON.parse(row.plan_json);

      const result = await dispatchPlan(planSteps, {
        approvalId: row.id,
        requestId: row.request_id,
        operatorId: row.operator_id,
        dryRun,
      }, dispatcherRegistry);

      if (result.success) {
        approvalStore.markDispatched(row.id, result);
      } else {
        approvalStore.markDispatchFailed(row.id, result);
      }

      res.json({
        success: result.success,
        correlationId,
        data: {
          dispatchResult: result,
          approvalStatus: result.success ? "dispatched" : "dispatch_failed",
        },
      });
    } catch (err) {
      approvalStore.markDispatchFailed(row.id, { error: err instanceof Error ? err.message : String(err) });
      res.status(500).json({
        success: false,
        correlationId,
        error: "Dispatch failed with an unexpected error",
      });
    }
  });

  // ── Pending count ─────────────────────────────────────────────────────
  // GET /api/approvals/count/pending
  router.get("/approvals/count/pending", requireAuthenticated(), (_req, res) => {
    const correlationId = getCorrelationId(res);
    const count = approvalStore.countPending();
    res.json({ success: true, correlationId, data: { pendingCount: count } });
  });

  return router;
}

// ── Helpers ─────────────────────────────────────────────────────────────────

/** Parse JSON fields for the API response so clients get objects, not strings. */
function sanitizeRow(row: any) {
  return {
    ...row,
    plan: safeParse(row.plan_json),
    auditRecord: safeParse(row.audit_record_json),
    decisionResult: safeParse(row.decision_result_json),
    dispatchResult: safeParse(row.dispatch_result_json),
    // Remove raw JSON fields — clients get parsed objects
    plan_json: undefined,
    audit_record_json: undefined,
    decision_result_json: undefined,
    dispatch_result_json: undefined,
  };
}

function safeParse(json: string | null): unknown {
  if (!json) return null;
  try { return JSON.parse(json); } catch { return null; }
}
