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
import { queryAuditEvents, logToolEvent } from "@publiclogic/logic-commons";

export type AdminRouteOptions = {
  approvalStore: ApprovalStore;
  chainStore?: ChainStore;
};

type AuditScopedAuthContext = {
  role?: unknown;
  permissions?: unknown;
  toolIds?: unknown;
  auditToolIds?: unknown;
  allowedTools?: unknown;
};

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0);
}

function parseRequestedToolIds(raw: unknown): string[] {
  const values = Array.isArray(raw) ? raw : typeof raw === "string" ? [raw] : [];
  return Array.from(
    new Set(
      values
        .flatMap((value) => value.split(","))
        .map((value) => value.trim())
        .filter((value) => value.length > 0),
    ),
  );
}

function getScopedToolIds(auth: AuditScopedAuthContext | null): string[] {
  if (!auth) return [];
  return Array.from(
    new Set([
      ...asStringArray(auth.toolIds),
      ...asStringArray(auth.auditToolIds),
      ...asStringArray(auth.allowedTools),
    ]),
  );
}

function hasPermission(auth: AuditScopedAuthContext | null, permission: string): boolean {
  return asStringArray(auth?.permissions).includes(permission);
}

function canAccessRequestedTools(
  auth: AuditScopedAuthContext | null,
  requestedToolIds: string[],
  permission: "audit:tool:read" | "audit:tool:write",
): boolean {
  if (!auth || requestedToolIds.length === 0) return false;
  if (auth.role === "admin") return true;
  if (!hasPermission(auth, permission)) return false;
  const scopedToolIds = new Set(getScopedToolIds(auth));
  return requestedToolIds.every((toolId) => scopedToolIds.has(toolId));
}

function formatAuditReadEvent(event: {
  event_type: string;
  actor_id: string | null;
  target_id: string | null;
  timestamp: string;
  metadata: string | null;
}) {
  return {
    event_type: event.event_type,
    actor_id: event.actor_id,
    target_id: event.target_id,
    timestamp: event.timestamp,
    metadata: event.metadata ? JSON.parse(event.metadata) : null,
  };
}

function readScopedAuditEvents(toolIds: string[], after: string | undefined, limit: number) {
  const events = queryAuditEvents({ tool_id: toolIds, after, limit });
  return events.map(formatAuditReadEvent);
}

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
    const limit = Number.isFinite(limitParam) ? Math.max(1, Math.min(limitParam, 10000)) : 500;

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

  // GET /api/audit?tool=<id>[&tool=<id2>]&after=...&limit=...
  // Query audit events for one or more scoped tools.
  router.get("/audit", requireAuthenticated(), (req, res) => {
    const auth = getAuthContext(req);
    const correlationId = getCorrelationId(res);
    const toolIds = parseRequestedToolIds(req.query.tool);

    if (toolIds.length === 0) {
      res.status(400).json({ success: false, correlationId, error: "tool is required" });
      return;
    }

    const after = typeof req.query.after === "string" ? req.query.after : undefined;
    const limitParam = typeof req.query.limit === "string" ? parseInt(req.query.limit, 10) : 200;
    const limit = Number.isFinite(limitParam) ? Math.max(1, Math.min(limitParam, 1000)) : 200;

    if (!canAccessRequestedTools(auth as AuditScopedAuthContext | null, toolIds, "audit:tool:read")) {
      res.status(403).json({ success: false, correlationId, error: "Tool audit read denied", toolIds });
      return;
    }

    const events = readScopedAuditEvents(toolIds, after, limit);
    res.json({
      success: true,
      correlationId,
      data: { toolIds, events, count: events.length },
    });
  });

  // GET /api/audit/tool/:toolId?after=...&limit=...
  // Compatibility alias for single-tool reads.
  router.get("/audit/tool/:toolId", requireAuthenticated(), (req, res) => {
    const auth = getAuthContext(req);
    const correlationId = getCorrelationId(res);
    const toolIds = [req.params.toolId];

    const after = typeof req.query.after === "string" ? req.query.after : undefined;
    const limitParam = typeof req.query.limit === "string" ? parseInt(req.query.limit, 10) : 200;
    const limit = Number.isFinite(limitParam) ? Math.max(1, Math.min(limitParam, 1000)) : 200;

    if (!canAccessRequestedTools(auth as AuditScopedAuthContext | null, toolIds, "audit:tool:read")) {
      res.status(403).json({ success: false, correlationId, error: "Tool audit read denied", toolIds });
      return;
    }

    const events = readScopedAuditEvents(toolIds, after, limit);
    res.json({
      success: true,
      correlationId,
      data: { toolId: req.params.toolId, events, count: events.length },
    });
  });

  // POST /api/audit/tool — emit a tool event (called by tool backends, not client)
  // Body: { tool, action, actorId, resourceId?, meta? }
  router.post("/audit/tool", requireAuthenticated(), (req, res) => {
    const auth = getAuthContext(req);
    const correlationId = getCorrelationId(res);
    const { tool, action, actorId, resourceId, meta } = req.body ?? {};

    if (!tool || !action || !actorId) {
      res.status(400).json({ success: false, correlationId, error: "tool, action, and actorId are required" });
      return;
    }

    if (!canAccessRequestedTools(auth as AuditScopedAuthContext | null, [tool], "audit:tool:write")) {
      res.status(403).json({ success: false, correlationId, error: "Tool audit write denied", tool });
      return;
    }

    const event = logToolEvent({
      tool,
      action,
      actorId,
      resourceId,
      meta,
      ipAddress: req.ip ?? undefined,
      requestId: res.getHeader("x-correlation-id") as string | undefined,
    });

    res.json({ success: true, correlationId, data: { id: event.id } });
  });

  return router;
}
