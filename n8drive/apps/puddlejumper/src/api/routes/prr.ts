// ── PRR routes (intake, list, status transition, close) ─────────────────────
import express from "express";
import { getAuthContext, requireAuthenticated } from "@publiclogic/core";
import type { PrrStore, PrrStatus } from "../prrStore.js";
import {
  prrIntakeRequestSchema,
  prrStatusSchema,
  prrStatusTransitionRequestSchema,
  prrCloseRequestSchema,
} from "../schemas.js";

type PrrRoutesOptions = {
  prrStore: PrrStore;
};

export function createPrrRoutes(opts: PrrRoutesOptions): express.Router {
  const router = express.Router();

  router.post("/prr/intake", (req, res) => {
    const parsed = prrIntakeRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid request payload",
        issues: parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })) });
      return;
    }
    const auth = getAuthContext(req);
    const tenantId = auth?.tenantId ?? (typeof parsed.data.tenantId === "string" ? parsed.data.tenantId.trim() : "");
    if (!tenantId) { res.status(400).json({ error: "tenantId is required" }); return; }

    const actorUserId = auth?.userId ?? "public";
    const created = opts.prrStore.intake({
      tenantId, requesterName: parsed.data.requester_name ?? null,
      requesterEmail: parsed.data.requester_email ?? null,
      subject: parsed.data.subject, description: parsed.data.description ?? null,
      actorUserId, metadata: { source: "api.prr.intake" },
    });
    const publicBase = (process.env.PJ_PUBLIC_URL ?? "").trim().replace(/\/+$/, "");
    const trackingPath = `/api/public/prrs/${created.public_id}`;
    const trackingUrl = publicBase ? `${publicBase}${trackingPath}` : trackingPath;
    res.status(201).json({
      id: created.id, tenantId: created.tenantId, received_at: created.received_at,
      statutory_due_at: created.statutory_due_at, status: created.status,
      public_id: created.public_id, tracking_url: trackingUrl,
    });
  });

  router.get("/prr", requireAuthenticated(), (req, res) => {
    const auth = getAuthContext(req);
    if (!auth) { res.status(401).json({ error: "Unauthorized" }); return; }
    if (!auth.tenantId) { res.status(403).json({ error: "Forbidden" }); return; }

    const statusRaw = typeof req.query.status === "string" ? req.query.status : undefined;
    const statusParsed = statusRaw ? prrStatusSchema.safeParse(statusRaw) : undefined;
    if (statusRaw && !statusParsed?.success) { res.status(400).json({ error: "Invalid status filter" }); return; }
    const assignedTo = typeof req.query.assigned_to === "string" ? req.query.assigned_to.trim() : undefined;
    const pageRaw = typeof req.query.page === "string" ? Number.parseInt(req.query.page, 10) : 1;
    const limitRaw = typeof req.query.limit === "string" ? Number.parseInt(req.query.limit, 10) : 50;
    const page = Number.isFinite(pageRaw) && pageRaw > 0 ? pageRaw : 1;
    const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(limitRaw, 100) : 50;

    res.json(opts.prrStore.listForTenant({
      tenantId: auth.tenantId,
      status: statusParsed?.success ? (statusParsed.data as PrrStatus) : undefined,
      assignedTo: assignedTo || undefined, page, limit,
    }));
  });

  router.post("/prr/:id/status", requireAuthenticated(), (req, res) => {
    const auth = getAuthContext(req);
    if (!auth) { res.status(401).json({ error: "Unauthorized" }); return; }
    if (!auth.tenantId) { res.status(403).json({ error: "Forbidden" }); return; }

    const prrId = String(req.params.id ?? "").trim();
    if (!prrId) { res.status(400).json({ error: "Invalid PRR id" }); return; }

    const parsed = prrStatusTransitionRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid request payload",
        issues: parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })) });
      return;
    }
    const transition = opts.prrStore.transitionStatus({
      id: prrId, tenantId: auth.tenantId, toStatus: parsed.data.to_status,
      actorUserId: auth.userId, metadata: { to_status: parsed.data.to_status },
    });
    if (!transition.ok) {
      if (transition.code === "not_found") { res.status(404).json({ error: "Not Found" }); return; }
      res.status(409).json({ error: "Invalid status transition",
        from_status: transition.fromStatus, to_status: parsed.data.to_status });
      return;
    }
    res.status(200).json(transition.row);
  });

  router.post("/prr/:id/close", requireAuthenticated(), (req, res) => {
    const auth = getAuthContext(req);
    if (!auth) { res.status(401).json({ error: "Unauthorized" }); return; }
    if (!auth.tenantId) { res.status(403).json({ error: "Forbidden" }); return; }
    const prrId = String(req.params.id ?? "").trim();
    if (!prrId) { res.status(400).json({ error: "Invalid PRR id" }); return; }
    const parsed = prrCloseRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid request payload",
        issues: parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })) });
      return;
    }
    const closed = opts.prrStore.closeCase({
      id: prrId, tenantId: auth.tenantId, actorUserId: auth.userId,
      disposition: parsed.data.disposition, metadata: { disposition: parsed.data.disposition },
    });
    if (!closed.ok) {
      if (closed.code === "not_found") { res.status(404).json({ error: "Not Found" }); return; }
      res.status(409).json({ error: "Invalid status transition", from_status: closed.fromStatus, to_status: "closed" });
      return;
    }
    res.status(200).json(closed.row);
  });

  return router;
}
