// ── Admin API Routes ────────────────────────────────────────────────────────
//
// JSON endpoints consumed by the Control Plane UI at /pj/admin.
//
// Routes:
//   GET  /api/admin/stats       — aggregated operational metrics for the dashboard
//   GET  /api/admin/audit/export — export audit events as CSV or JSON
//
import express from "express";
import { getAuthContext, requireAuthenticated } from "@publiclogic/core";
import { approvalMetrics, METRIC } from "../../engine/approvalMetrics.js";
import { getCorrelationId } from "../serverMiddleware.js";
import type { ApprovalStore } from "../../engine/approvalStore.js";
import type { ChainStore } from "../../engine/chainStore.js";
import { updateWorkspacePlan } from "../../engine/workspaceStore.js";
import { queryAuditEvents } from "@publiclogic/logic-commons";

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

  // ── Plan upgrade endpoint ─────────────────────────────────────────────
  // PATCH /api/admin/workspace/:id/plan
  router.patch("/admin/workspace/:id/plan", requireAuthenticated(), (req, res) => {
    const auth = getAuthContext(req);
    const correlationId = getCorrelationId(res);
    if (!auth || auth.role !== "admin") {
      res.status(403).json({ success: false, correlationId, error: "Admin only" });
      return;
    }
    
    const { plan } = req.body;
    if (plan !== "free" && plan !== "pro") {
      res.status(400).json({ success: false, correlationId, error: "Invalid plan" });
      return;
    }
    
    const dataDir = process.env.DATA_DIR || "./data";
    updateWorkspacePlan(dataDir, req.params.id, plan);
    
    res.json({ success: true, correlationId, data: { workspaceId: req.params.id, plan } });
  });

  // ── Audit export endpoint ───────────────────────────────────────────────
  // GET /api/admin/audit/export?format=csv|json&event_type=...&actor_id=...&after=...&limit=...
  router.get("/admin/audit/export", requireAuthenticated(), (req, res) => {
    const auth = getAuthContext(req);
    const correlationId = getCorrelationId(res);
    if (!auth || auth.role !== "admin") {
      res.status(403).json({ success: false, correlationId, error: "Admin only" });
      return;
    }

    const format = typeof req.query.format === "string" ? req.query.format : "json";
    const event_type = typeof req.query.event_type === "string" ? req.query.event_type : undefined;
    const actor_id = typeof req.query.actor_id === "string" ? req.query.actor_id : undefined;
    const after = typeof req.query.after === "string" ? req.query.after : undefined;
    const limitParam = typeof req.query.limit === "string" ? parseInt(req.query.limit, 10) : 500;
    const limit = isNaN(limitParam) ? 500 : Math.min(limitParam, 10000);

    const events = queryAuditEvents({ event_type, actor_id, after, limit });

    if (format === "csv") {
      const csvHeader = "id,timestamp,event_type,actor_id,target_id,ip_address,user_agent,request_id,metadata";
      const escapeCsvField = (val: string | null): string => {
        if (val === null || val === undefined) return "";
        const str = String(val);
        if (str.includes(",") || str.includes('"') || str.includes("\n")) {
          return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
      };
      const csvRows = events.map((e) =>
        [e.id, e.timestamp, e.event_type, e.actor_id, e.target_id, e.ip_address, e.user_agent, e.request_id, e.metadata]
          .map((v) => escapeCsvField(v as string | null))
          .join(",")
      );
      const csv = [csvHeader, ...csvRows].join("\n");
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="audit-export-${new Date().toISOString().slice(0, 10)}.csv"`);
      res.send(csv);
      return;
    }

    // Default: JSON
    res.json({ success: true, correlationId, data: { events, count: events.length } });
  });

  return router;
}
