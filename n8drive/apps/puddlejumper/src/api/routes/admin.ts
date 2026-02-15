// ── Admin API Routes ────────────────────────────────────────────────────────
//
// JSON endpoints consumed by the Control Plane UI at /pj/admin.
//
// Routes:
//   GET /api/admin/stats — aggregated operational metrics for the dashboard
//
import express from "express";
import { getAuthContext, requireAuthenticated } from "@publiclogic/core";
import { approvalMetrics, METRIC } from "../../engine/approvalMetrics.js";
import { getCorrelationId } from "../serverMiddleware.js";
import type { ApprovalStore } from "../../engine/approvalStore.js";
import type { ChainStore } from "../../engine/chainStore.js";

export type AdminRouteOptions = {
  approvalStore: ApprovalStore;
  chainStore?: ChainStore;
};

export function createAdminRoutes(opts: AdminRouteOptions): express.Router {
  const router = express.Router();
  const { approvalStore, chainStore } = opts;

  // ── Aggregated stats for the operational dashboard ────────────────────
  // GET /api/admin/stats
  router.get("/admin/stats", requireAuthenticated(), (req, res) => {
    const auth = getAuthContext(req);
    const correlationId = getCorrelationId(res);
    if (!auth || !auth.role || (auth.role !== "admin" && auth.role !== "viewer")) {
      res.status(403).json({ success: false, correlationId, error: "Access denied" });
      return;
    }

    const snapshot = approvalMetrics.snapshot();
    const find = (name: string) => snapshot.find((e) => e.name === name)?.value ?? 0;

    const approvalTimeCount = find(`${METRIC.APPROVAL_TIME}_count`);
    const approvalTimeSum = find(`${METRIC.APPROVAL_TIME}_sum`);
    const dispatchLatencyCount = find(`${METRIC.DISPATCH_LATENCY}_count`);
    const dispatchLatencySum = find(`${METRIC.DISPATCH_LATENCY}_sum`);

    res.json({
      success: true,
      correlationId,
      data: {
        pending: approvalStore.countPending(),
        approvalsCreated: find(METRIC.APPROVALS_CREATED),
        approvalsApproved: find(METRIC.APPROVALS_APPROVED),
        approvalsRejected: find(METRIC.APPROVALS_REJECTED),
        approvalsExpired: find(METRIC.APPROVALS_EXPIRED),
        dispatchSuccess: find(METRIC.DISPATCH_SUCCESS),
        dispatchFailure: find(METRIC.DISPATCH_FAILURE),
        dispatchRetry: find(METRIC.DISPATCH_RETRY),
        casConflict: find(METRIC.CONSUME_CAS_CONFLICT),
        avgApprovalTimeSec: approvalTimeCount > 0 ? approvalTimeSum / approvalTimeCount : 0,
        avgDispatchLatencySec: dispatchLatencyCount > 0 ? dispatchLatencySum / dispatchLatencyCount : 0,
        activeChainSteps: chainStore?.countActiveSteps() ?? 0,
      },
    });
  });

  return router;
}
