// routes/dog.ts — Animal Control & Dog Licensing routes
// POST   /api/dog/license         — submit application
// GET    /api/dog/license         — list (authenticated, tenant-scoped)
// GET    /api/dog/license/:id     — get one
// PATCH  /api/dog/license/:id/status — update status
import express from "express";
import { getAuthContext, requireAuthenticated } from "@publiclogic/core";
import type { DogStore, DogLicenseStatus } from "../dogStore.js";

type Opts = { dogStore: DogStore };

export function createDogRoutes(opts: Opts): express.Router {
  const router = express.Router();

  // ── Apply ──────────────────────────────────────────────────────────────────
  // Public endpoint — no auth required (front-desk can submit on behalf of owner)
  router.post("/dog/license", (req, res) => {
    const auth   = getAuthContext(req);
    const body   = req.body ?? {};
    const tenantId = auth?.tenantId ?? (typeof body.tenantId === "string" ? body.tenantId.trim() : "");
    if (!tenantId)            { res.status(400).json({ error: "tenantId required" }); return; }
    if (!body.ownerName?.trim()) { res.status(400).json({ error: "ownerName required" }); return; }
    if (!body.dogName?.trim())   { res.status(400).json({ error: "dogName required" }); return; }
    if (!body.dogBreed?.trim())  { res.status(400).json({ error: "dogBreed required" }); return; }

    const year = typeof body.licenseYear === "number" ? body.licenseYear : new Date().getFullYear();
    const created = opts.dogStore.apply({
      tenantId,
      ownerName:   body.ownerName.trim(),
      ownerEmail:  body.ownerEmail  ?? null,
      ownerAddress:body.ownerAddress ?? null,
      ownerPhone:  body.ownerPhone  ?? null,
      dogName:     body.dogName.trim(),
      dogBreed:    body.dogBreed.trim(),
      dogColor:    body.dogColor    ?? null,
      dogSex:      body.dogSex      ?? null,
      dogAltered:  !!body.dogAltered,
      dogDob:      body.dogDob      ?? null,
      rabiesCert:  body.rabiesCert  ?? null,
      rabiesExp:   body.rabiesExp   ?? null,
      veterinarian:body.veterinarian ?? null,
      licenseYear: year,
      assignedTo:  body.assignedTo  ?? null,
      actor:       auth?.userId ?? "front-desk",
    });
    res.status(201).json(created);
  });

  // ── List ───────────────────────────────────────────────────────────────────
  router.get("/dog/license", requireAuthenticated(), (req, res) => {
    const auth = getAuthContext(req);
    if (!auth?.tenantId) { res.status(403).json({ error: "Forbidden" }); return; }
    const status = typeof req.query.status === "string" ? req.query.status as DogLicenseStatus : undefined;
    const page   = Math.max(1, parseInt(String(req.query.page  ?? "1"),  10));
    const limit  = Math.min(100, parseInt(String(req.query.limit ?? "50"), 10));
    res.json(opts.dogStore.list({ tenantId: auth.tenantId, status, page, limit }));
  });

  // ── Get one ────────────────────────────────────────────────────────────────
  router.get("/dog/license/:id", requireAuthenticated(), (req, res) => {
    const auth = getAuthContext(req);
    if (!auth?.tenantId) { res.status(403).json({ error: "Forbidden" }); return; }
    const rec = opts.dogStore.get(String(req.params.id), auth.tenantId);
    if (!rec) { res.status(404).json({ error: "Not found" }); return; }
    res.json(rec);
  });

  // ── Update status ──────────────────────────────────────────────────────────
  router.patch("/dog/license/:id/status", requireAuthenticated(), (req, res) => {
    const auth = getAuthContext(req);
    if (!auth?.tenantId) { res.status(403).json({ error: "Forbidden" }); return; }
    const { toStatus, notes } = req.body ?? {};
    if (!toStatus) { res.status(400).json({ error: "toStatus required" }); return; }
    const updated = opts.dogStore.updateStatus({
      id: String(req.params.id),
      tenantId: auth.tenantId,
      toStatus: toStatus as DogLicenseStatus,
      actor: auth.userId,
      notes: notes ?? undefined,
    });
    if (!updated) { res.status(404).json({ error: "Not found" }); return; }
    res.json(updated);
  });

  return router;
}
