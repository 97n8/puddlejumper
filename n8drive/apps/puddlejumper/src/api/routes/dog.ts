// routes/dog.ts — Animal Control & Dog Licensing routes (M.G.L. c.140 §§137–174)
//
// Licenses:
//   POST   /api/dog/license               — submit application (public)
//   GET    /api/dog/license               — list, tenant-scoped (auth)
//   GET    /api/dog/license/:id           — get one (auth)
//   POST   /api/dog/license/:id/issue     — issue tag + set status=licensed (auth)
//   PATCH  /api/dog/license/:id/status    — generic status update (auth)
//   GET    /api/dog/license/:id/audit     — audit trail (auth)
//   GET    /api/dog/expiring              — renewal candidates (auth)
//
// Public portal (no auth):
//   GET    /api/public/dog/:publicId      — owner self-service status check
//
// Bite reports (§155, §157):
//   POST   /api/dog/bite-report           — file report (auth)
//   GET    /api/dog/bite-report           — list reports (auth)
//   PATCH  /api/dog/bite-report/:id       — update report (auth)
//
// ACO duty log (§151):
//   POST   /api/dog/aco-log              — add entry (auth)
//   GET    /api/dog/aco-log              — list entries (auth)

import express from "express";
import { getAuthContext, requireAuthenticated } from "@publiclogic/core";
import type { DogStore, DogLicenseStatus } from "../dogStore.js";

type Opts = { dogStore: DogStore };

export function createDogRoutes(opts: Opts): express.Router {
  const router = express.Router();

  // ── Public status portal (no auth required) ────────────────────────────────
  router.get("/public/dog/:publicId", (req, res) => {
    const record = opts.dogStore.getPublicStatus(String(req.params.publicId).toUpperCase());
    if (!record) { res.status(404).json({ error: "Not found" }); return; }
    res.json(record);
  });

  // ── Apply ──────────────────────────────────────────────────────────────────
  router.post("/dog/license", (req, res) => {
    const auth   = getAuthContext(req);
    const body   = req.body ?? {};
    const tenantId = auth?.tenantId ?? (typeof body.tenantId === "string" ? body.tenantId.trim() : "");
    if (!tenantId)               { res.status(400).json({ error: "tenantId required" }); return; }
    if (!body.ownerName?.trim()) { res.status(400).json({ error: "ownerName required" }); return; }
    if (!body.dogName?.trim())   { res.status(400).json({ error: "dogName required" }); return; }
    if (!body.dogBreed?.trim())  { res.status(400).json({ error: "dogBreed required" }); return; }

    const created = opts.dogStore.apply({
      tenantId,
      ownerName:    body.ownerName.trim(),
      ownerEmail:   body.ownerEmail   ?? null,
      ownerAddress: body.ownerAddress ?? null,
      ownerPhone:   body.ownerPhone   ?? null,
      dogName:      body.dogName.trim(),
      dogBreed:     body.dogBreed.trim(),
      dogColor:     body.dogColor     ?? null,
      dogSex:       body.dogSex       ?? null,
      dogAltered:   !!body.dogAltered,
      dogDob:       body.dogDob       ?? null,
      rabiesCert:   body.rabiesCert   ?? null,
      rabiesExp:    body.rabiesExp    ?? null,
      veterinarian: body.veterinarian ?? null,
      licenseYear:  typeof body.licenseYear === "number" ? body.licenseYear : undefined,
      renewalOf:    body.renewalOf    ?? null,
      feeWaived:    !!body.feeWaived,
      assignedTo:   body.assignedTo   ?? null,
      actor:        auth?.userId ?? "front-desk",
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

  // ── Issue tag (status → licensed, assigns tag #) ───────────────────────────
  router.post("/dog/license/:id/issue", requireAuthenticated(), (req, res) => {
    const auth = getAuthContext(req);
    if (!auth?.tenantId) { res.status(403).json({ error: "Forbidden" }); return; }
    const updated = opts.dogStore.issue({
      id: String(req.params.id),
      tenantId: auth.tenantId,
      actor: auth.userId,
      notes: req.body?.notes ?? undefined,
    });
    if (!updated) { res.status(404).json({ error: "Not found" }); return; }
    res.json(updated);
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

  // ── Audit trail ───────────────────────────────────────────────────────────
  router.get("/dog/license/:id/audit", requireAuthenticated(), (req, res) => {
    const auth = getAuthContext(req);
    if (!auth?.tenantId) { res.status(403).json({ error: "Forbidden" }); return; }
    res.json(opts.dogStore.auditLog(String(req.params.id), auth.tenantId));
  });

  // ── Expiring licenses (renewal candidates) ─────────────────────────────────
  // Returns licenses with status=licensed expiring before `before` (ISO date) that
  // haven't had a renewal notice sent yet. Defaults to 30 days from now.
  router.get("/dog/expiring", requireAuthenticated(), (req, res) => {
    const auth = getAuthContext(req);
    if (!auth?.tenantId) { res.status(403).json({ error: "Forbidden" }); return; }
    const daysAhead = Math.min(365, Math.max(1, parseInt(String(req.query.days ?? "30"), 10)));
    const before = new Date(Date.now() + daysAhead * 86_400_000).toISOString().slice(0, 10);
    res.json(opts.dogStore.listExpiring({ tenantId: auth.tenantId, before }));
  });

  // ── Bite reports (§155 strict liability, §157 dangerous dog) ──────────────
  router.post("/dog/bite-report", requireAuthenticated(), (req, res) => {
    const auth = getAuthContext(req);
    if (!auth?.tenantId) { res.status(403).json({ error: "Forbidden" }); return; }
    const body = req.body ?? {};
    if (!body.victimName?.trim())    { res.status(400).json({ error: "victimName required" }); return; }
    if (!body.dogName?.trim())       { res.status(400).json({ error: "dogName required" }); return; }
    if (!body.incidentDate?.trim())  { res.status(400).json({ error: "incidentDate required (YYYY-MM-DD)" }); return; }

    const report = opts.dogStore.fileBiteReport({
      tenantId:              auth.tenantId,
      licenseId:             body.licenseId             ?? null,
      dogName:               body.dogName.trim(),
      ownerName:             body.ownerName             ?? null,
      victimName:            body.victimName.trim(),
      victimDob:             body.victimDob             ?? null,
      incidentDate:          body.incidentDate.trim(),
      incidentLocation:      body.incidentLocation      ?? null,
      provoked:              !!body.provoked,
      victimTrespassing:     !!body.victimTrespassing,
      victimUnder7:          !!body.victimUnder7,
      quarantineRequired:    !!body.quarantineRequired,
      quarantineStart:       body.quarantineStart       ?? null,
      quarantineEnd:         body.quarantineEnd         ?? null,
      boardOfHealthNotified: !!body.boardOfHealthNotified,
      dangerousDogHearing:   !!body.dangerousDogHearing,
      hearingDate:           body.hearingDate           ?? null,
      notes:                 body.notes                 ?? null,
      actor:                 auth.userId,
    });
    res.status(201).json(report);
  });

  router.get("/dog/bite-report", requireAuthenticated(), (req, res) => {
    const auth = getAuthContext(req);
    if (!auth?.tenantId) { res.status(403).json({ error: "Forbidden" }); return; }
    const page  = Math.max(1, parseInt(String(req.query.page  ?? "1"),  10));
    const limit = Math.min(100, parseInt(String(req.query.limit ?? "50"), 10));
    res.json(opts.dogStore.listBiteReports(auth.tenantId, page, limit));
  });

  router.patch("/dog/bite-report/:id", requireAuthenticated(), (req, res) => {
    const auth = getAuthContext(req);
    if (!auth?.tenantId) { res.status(403).json({ error: "Forbidden" }); return; }
    const updated = opts.dogStore.updateBiteReport(String(req.params.id), auth.tenantId, req.body ?? {});
    if (!updated) { res.status(404).json({ error: "Not found" }); return; }
    res.json(updated);
  });

  // ── ACO duty log (§151) ───────────────────────────────────────────────────
  router.post("/dog/aco-log", requireAuthenticated(), (req, res) => {
    const auth = getAuthContext(req);
    if (!auth?.tenantId) { res.status(403).json({ error: "Forbidden" }); return; }
    const body = req.body ?? {};
    if (!body.logDate?.trim())       { res.status(400).json({ error: "logDate required (YYYY-MM-DD)" }); return; }
    if (!body.description?.trim())   { res.status(400).json({ error: "description required" }); return; }

    const entry = opts.dogStore.logAco({
      tenantId:      auth.tenantId,
      officer:       auth.userId,
      logDate:       body.logDate.trim(),
      activityType:  body.activityType ?? "other",
      description:   body.description.trim(),
      licenseId:     body.licenseId     ?? null,
      biteReportId:  body.biteReportId  ?? null,
    });
    res.status(201).json(entry);
  });

  router.get("/dog/aco-log", requireAuthenticated(), (req, res) => {
    const auth = getAuthContext(req);
    if (!auth?.tenantId) { res.status(403).json({ error: "Forbidden" }); return; }
    const page  = Math.max(1, parseInt(String(req.query.page  ?? "1"),  10));
    const limit = Math.min(100, parseInt(String(req.query.limit ?? "50"), 10));
    res.json(opts.dogStore.listAcoLog(auth.tenantId, page, limit));
  });

  return router;
}
