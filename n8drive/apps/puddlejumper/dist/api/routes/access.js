// ── Access-request routes (intake, status, close) ───────────────────────────
import express from "express";
import { getAuthContext, requireAuthenticated } from "@publiclogic/core";
import { accessRequestIntakeRequestSchema, accessRequestStatusSchema, accessRequestStatusTransitionRequestSchema, accessRequestCloseRequestSchema, } from "../schemas.js";
export function createAccessRoutes(opts) {
    const router = express.Router();
    router.post("/access/request", (req, res) => {
        const parsed = accessRequestIntakeRequestSchema.safeParse(req.body);
        if (!parsed.success) {
            res.status(400).json({ error: "Invalid request payload",
                issues: parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })) });
            return;
        }
        const auth = getAuthContext(req);
        const tenantId = auth?.tenantId ?? (typeof parsed.data.tenantId === "string" ? parsed.data.tenantId.trim() : "");
        if (!tenantId) {
            res.status(400).json({ error: "tenantId is required" });
            return;
        }
        const actorUserId = auth?.userId ?? "public";
        const created = opts.prrStore.intakeAccessRequest({
            tenantId, requesterName: parsed.data.requester_name ?? null,
            requesterEmail: parsed.data.requester_email,
            organization: parsed.data.organization ?? null,
            requestedRole: parsed.data.requested_role,
            system: parsed.data.system ?? "PuddleJumper",
            justification: parsed.data.justification,
            actorUserId, source: parsed.data.source ?? "api.access.request",
        });
        res.status(201).json({
            id: created.id, case_id: created.case_id, tenantId: created.tenantId,
            received_at: created.received_at, status: created.status, notification: created.notification,
        });
    });
    router.post("/access/request/:id/status", requireAuthenticated(), (req, res) => {
        const auth = getAuthContext(req);
        if (!auth) {
            res.status(401).json({ error: "Unauthorized" });
            return;
        }
        if (!auth.tenantId) {
            res.status(403).json({ error: "Forbidden" });
            return;
        }
        const accessRequestId = String(req.params.id ?? "").trim();
        if (!accessRequestId) {
            res.status(400).json({ error: "Invalid access request id" });
            return;
        }
        const parsed = accessRequestStatusTransitionRequestSchema.safeParse(req.body);
        if (!parsed.success) {
            res.status(400).json({ error: "Invalid request payload",
                issues: parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })) });
            return;
        }
        const toStatusParsed = accessRequestStatusSchema.safeParse(parsed.data.to_status);
        if (!toStatusParsed.success) {
            res.status(400).json({ error: "Invalid status transition target" });
            return;
        }
        const transition = opts.prrStore.transitionAccessRequestStatus({
            id: accessRequestId, tenantId: auth.tenantId,
            toStatus: toStatusParsed.data,
            actorUserId: auth.userId, metadata: { to_status: toStatusParsed.data },
        });
        if (!transition.ok) {
            if (transition.code === "not_found") {
                res.status(404).json({ error: "Not Found" });
                return;
            }
            res.status(409).json({ error: "Invalid status transition",
                from_status: transition.fromStatus, to_status: toStatusParsed.data });
            return;
        }
        res.status(200).json(transition.row);
    });
    router.post("/access/request/:id/close", requireAuthenticated(), (req, res) => {
        const auth = getAuthContext(req);
        if (!auth) {
            res.status(401).json({ error: "Unauthorized" });
            return;
        }
        if (!auth.tenantId) {
            res.status(403).json({ error: "Forbidden" });
            return;
        }
        const accessRequestId = String(req.params.id ?? "").trim();
        if (!accessRequestId) {
            res.status(400).json({ error: "Invalid access request id" });
            return;
        }
        const parsed = accessRequestCloseRequestSchema.safeParse(req.body);
        if (!parsed.success) {
            res.status(400).json({ error: "Invalid request payload",
                issues: parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })) });
            return;
        }
        const closed = opts.prrStore.closeAccessRequest({
            id: accessRequestId, tenantId: auth.tenantId, actorUserId: auth.userId,
            resolution: parsed.data.resolution ?? null, metadata: { resolution: parsed.data.resolution ?? null },
        });
        if (!closed.ok) {
            if (closed.code === "not_found") {
                res.status(404).json({ error: "Not Found" });
                return;
            }
            res.status(409).json({ error: "Invalid status transition", from_status: closed.fromStatus, to_status: "closed" });
            return;
        }
        res.status(200).json(closed.row);
    });
    return router;
}
