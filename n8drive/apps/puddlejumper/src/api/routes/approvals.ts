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
import type { ChainStore } from "../../engine/chainStore.js";
import type { DispatcherRegistry, PlanStepInput, RetryPolicy } from "../../engine/dispatch.js";
import { dispatchPlan } from "../../engine/dispatch.js";
import { getCorrelationId } from "../serverMiddleware.js";
import { approvalMetrics, emitApprovalEvent, METRIC } from "../../engine/approvalMetrics.js";

export type ApprovalRouteOptions = {
  approvalStore: ApprovalStore;
  dispatcherRegistry: DispatcherRegistry;
  nodeEnv: string;
  /** When provided, approval decisions flow through the chain progression layer. */
  chainStore?: ChainStore;
};

export function createApprovalRoutes(opts: ApprovalRouteOptions): express.Router {
  const router = express.Router();
  const { approvalStore, dispatcherRegistry, chainStore } = opts;

  // ── List approvals (workspace-scoped) ───────────────────────────────
  // GET /api/approvals?status=pending&limit=50&offset=0
  router.get("/approvals", requireAuthenticated(), (req, res) => {
    const auth = getAuthContext(req);
    const correlationId = getCorrelationId(res);
    if (!auth) { res.status(401).json({ success: false, correlationId, error: "Unauthorized" }); return; }

    const approvalStatus = typeof req.query.status === "string" ? req.query.status : undefined;
    const limit = typeof req.query.limit === "string" ? parseInt(req.query.limit, 10) : 50;
    const offset = typeof req.query.offset === "string" ? parseInt(req.query.offset, 10) : 0;

    // Always scope to workspaceId from JWT
    const workspaceId = auth.workspaceId;
    // Admins and viewers see all approvals in workspace; other roles see only their own
    const operatorId = (auth.role === "admin" || auth.role === "viewer") ? undefined : auth.userId ?? auth.sub;

    const rows = approvalStore.query({
      approvalStatus: approvalStatus as any,
      operatorId,
      workspaceId,
      limit: isNaN(limit) ? 50 : limit,
      offset: isNaN(offset) ? 0 : offset,
    });

    const pendingCount = approvalStore.countPending({ workspaceId });

    res.json({
      success: true,
      correlationId,
      data: {
        approvals: rows.map((row) => ({
          ...sanitizeRow(row),
          chainSummary: chainStore?.getChainSummary(row.id) ?? null,
        })),
        pendingCount,
        total: rows.length,
      },
    });
  });

  // ── Get single approval (workspace-scoped) ──────────────────────────
  // GET /api/approvals/:id
  router.get("/approvals/:id", requireAuthenticated(), (req, res) => {
    const auth = getAuthContext(req);
    const correlationId = getCorrelationId(res);
    if (!auth) { res.status(401).json({ success: false, correlationId, error: "Unauthorized" }); return; }

    const row = approvalStore.findById(req.params.id);
    if (!row || row.workspace_id !== auth.workspaceId) {
      res.status(404).json({ success: false, correlationId, error: "Approval not found" });
      return;
    }

    // Admins and viewers see all; other roles see only their own
    if (auth.role !== "admin" && auth.role !== "viewer" && row.operator_id !== (auth.userId ?? auth.sub)) {
      res.status(403).json({ success: false, correlationId, error: "Forbidden" });
      return;
    }

    res.json({
      success: true,
      correlationId,
      data: {
        ...sanitizeRow(row),
        chainSummary: chainStore?.getChainSummary(req.params.id) ?? null,
      },
    });
  });

  // ── Decide (approve or reject) ────────────────────────────────────────
  // POST /api/approvals/:id/decide  { status: "approved"|"rejected", note?: string, stepId?: string }
  router.post("/approvals/:id/decide", requireAuthenticated(), (req, res) => {
    const auth = getAuthContext(req);
    const correlationId = getCorrelationId(res);
    if (!auth) { res.status(401).json({ success: false, correlationId, error: "Unauthorized" }); return; }

    const { status, note, stepId } = req.body ?? {};
    if (status !== "approved" && status !== "rejected") {
      res.status(400).json({ success: false, correlationId, error: "status must be 'approved' or 'rejected'" });
      return;
    }

    const approverId = auth.userId ?? auth.sub ?? "unknown";

    // ── Chain-aware decision logic ─────────────────────────────────────
    // If a chain exists for this approval, route through chain progression.
    // If no chain exists (legacy), fall back to direct approvalStore.decide().

    // When stepId is provided, target that specific step (parallel support).
    // Otherwise fall back to the first active step (backward-compatible).
    const targetStep = stepId && chainStore
      ? chainStore.getStep(stepId)
      : chainStore?.getActiveStep(req.params.id) ?? null;

    // If a stepId was explicitly provided but not found, return an error
    // rather than silently falling through to legacy behavior.
    if (stepId && chainStore && !targetStep) {
      res.status(404).json({ success: false, correlationId, error: "Chain step not found" });
      return;
    }

    if (targetStep && chainStore) {
      // ── Role gate for chain steps ──
      // Admin is a superrole — can decide any step regardless of requiredRole.
      // Non-admin roles may decide a step only when their role matches requiredRole.
      if (auth.role !== "admin" && auth.role !== targetStep.requiredRole) {
        res.status(403).json({
          success: false,
          correlationId,
          error: `Role "${auth.role}" cannot decide this step (requires "${targetStep.requiredRole}")`,
        });
        return;
      }

      // Validate the targeted step belongs to this approval
      if (targetStep.approvalId !== req.params.id) {
        res.status(400).json({ success: false, correlationId, error: "Step does not belong to this approval" });
        return;
      }

      // Decide the chain step
      const chainResult = chainStore.decideStep({
        stepId: targetStep.id,
        deciderId: approverId,
        status,
        note: typeof note === "string" ? note : undefined,
      });

      if (!chainResult) {
        res.status(409).json({
          success: false,
          correlationId,
          error: "Chain step is not in an active state",
        });
        return;
      }

      if (chainResult.allApproved) {
        // All chain steps approved → transition parent approval to "approved"
        const updated = approvalStore.decide({
          approvalId: req.params.id,
          approverId,
          status: "approved",
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

        // ── Metrics ──
        approvalMetrics.increment(METRIC.APPROVALS_APPROVED);
        const createdAt = new Date(updated.created_at).getTime();
        const approvedAt = new Date(updated.updated_at).getTime();
        if (createdAt > 0 && approvedAt > createdAt) {
          approvalMetrics.observe(METRIC.APPROVAL_TIME, (approvedAt - createdAt) / 1000);
        }
        approvalMetrics.setGauge(METRIC.PENDING_GAUGE, approvalStore.countPending());
        emitApprovalEvent("decided", {
          approvalId: req.params.id, status: "approved", approverId, correlationId,
        });

        res.json({ success: true, correlationId, data: sanitizeRow(updated) });
        return;
      }

      if (chainResult.rejected) {
        // Chain rejected → transition parent approval to "rejected"
        const updated = approvalStore.decide({
          approvalId: req.params.id,
          approverId,
          status: "rejected",
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

        approvalMetrics.increment(METRIC.APPROVALS_REJECTED);
        approvalMetrics.setGauge(METRIC.PENDING_GAUGE, approvalStore.countPending());
        emitApprovalEvent("decided", {
          approvalId: req.params.id, status: "rejected", approverId, correlationId,
        });

        res.json({ success: true, correlationId, data: sanitizeRow(updated) });
        return;
      }

      // Chain step decided but chain not complete — parent stays "pending".
      // This covers both sequential advancement and parallel-group partial approval.
      const row = approvalStore.findById(req.params.id);
      if (!row) {
        res.status(404).json({ success: false, correlationId, error: "Approval not found" });
        return;
      }

      emitApprovalEvent("chain_step_decided", {
        approvalId: req.params.id,
        stepId: targetStep.id,
        stepOrder: targetStep.stepOrder,
        status,
        advanced: chainResult.advanced,
        approverId,
        correlationId,
      });

      res.json({
        success: true,
        correlationId,
        data: { ...sanitizeRow(row), chainAdvanced: chainResult.advanced },
      });
      return;
    }

    // ── Legacy fallback: no chain exists ─────────────────────────────
    // Legacy approvals require admin role (no chain roles to match against).
    if (auth.role !== "admin") {
      res.status(403).json({ success: false, correlationId, error: "Only admins can approve or reject" });
      return;
    }

    const updated = approvalStore.decide({
      approvalId: req.params.id,
      approverId,
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

    // ── Metrics ──
    if (status === "approved") {
      approvalMetrics.increment(METRIC.APPROVALS_APPROVED);
      const createdAt = new Date(updated.created_at).getTime();
      const approvedAt = new Date(updated.updated_at).getTime();
      if (createdAt > 0 && approvedAt > createdAt) {
        approvalMetrics.observe(METRIC.APPROVAL_TIME, (approvedAt - createdAt) / 1000);
      }
    } else {
      approvalMetrics.increment(METRIC.APPROVALS_REJECTED);
    }
    approvalMetrics.setGauge(METRIC.PENDING_GAUGE, approvalStore.countPending());
    emitApprovalEvent("decided", {
      approvalId: req.params.id, status, approverId: auth.userId ?? auth.sub, correlationId,
    });

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

    // Mark as dispatching (atomic CAS)
    const dispatching = approvalStore.consumeForDispatch(row.id);
    if (!dispatching) {
      approvalMetrics.increment(METRIC.CONSUME_CAS_CONFLICT);
      emitApprovalEvent("consume_conflict", { approvalId: row.id, correlationId });
      res.status(409).json({ success: false, correlationId, error: "Failed to acquire dispatch lock" });
      return;
    }
    approvalMetrics.increment(METRIC.CONSUME_CAS_SUCCESS);

    const dryRun = req.body?.dryRun === true;
    emitApprovalEvent("dispatch_started", { approvalId: row.id, correlationId, dryRun });

    try {
      const planSteps: PlanStepInput[] = JSON.parse(row.plan_json);

      // Retry policy is now registered per-connector in the DispatcherRegistry.
      // Pass a fallback for any connectors that don't have one explicitly set.
      const fallbackRetryPolicy: RetryPolicy = {
        maxAttempts: 3,
        baseDelayMs: 1000,
        onRetry: (attempt, error, stepId) => {
          approvalMetrics.increment(METRIC.DISPATCH_RETRY);
          emitApprovalEvent("dispatch_retry", { approvalId: row.id, stepId, attempt, error, correlationId });
        },
      };

      const result = await dispatchPlan(planSteps, {
        approvalId: row.id,
        requestId: row.request_id,
        operatorId: row.operator_id,
        dryRun,
      }, dispatcherRegistry, fallbackRetryPolicy);

      if (result.success) {
        approvalStore.markDispatched(row.id, result);
        approvalMetrics.increment(METRIC.DISPATCH_SUCCESS);
        emitApprovalEvent("dispatched", { approvalId: row.id, correlationId, summary: result.summary });
      } else {
        approvalStore.markDispatchFailed(row.id, result);
        approvalMetrics.increment(METRIC.DISPATCH_FAILURE);
        emitApprovalEvent("dispatch_failed", { approvalId: row.id, correlationId, summary: result.summary });
      }
      const dispatchMs = new Date(result.completedAt).getTime() - new Date(result.startedAt).getTime();
      if (dispatchMs > 0) approvalMetrics.observe(METRIC.DISPATCH_LATENCY, dispatchMs / 1000);

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

  // ── Chain progress ──────────────────────────────────────────────────
  // GET /api/approvals/:id/chain
  router.get("/approvals/:id/chain", requireAuthenticated(), (req, res) => {
    const auth = getAuthContext(req);
    const correlationId = getCorrelationId(res);
    if (!auth) { res.status(401).json({ success: false, correlationId, error: "Unauthorized" }); return; }

    const row = approvalStore.findById(req.params.id);
    if (!row) {
      res.status(404).json({ success: false, correlationId, error: "Approval not found" });
      return;
    }

    // Admins and viewers see all; other roles see only their own
    if (auth.role !== "admin" && auth.role !== "viewer" && row.operator_id !== (auth.userId ?? auth.sub)) {
      res.status(403).json({ success: false, correlationId, error: "Forbidden" });
      return;
    }

    if (!chainStore) {
      res.status(404).json({ success: false, correlationId, error: "Chain support not available" });
      return;
    }

    const progress = chainStore.getChainProgress(req.params.id);
    if (!progress) {
      res.status(404).json({ success: false, correlationId, error: "No chain found for this approval" });
      return;
    }

    res.json({ success: true, correlationId, data: progress });
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
