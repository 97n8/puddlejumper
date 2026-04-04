// ── LogicCommons routes ──────────────────────────────────────────────────────
//
//   GET  /api/v1/commons/context
//   GET  /api/v1/commons/alerts
//   PATCH /api/v1/commons/alerts/:id/acknowledge
//   PATCH /api/v1/commons/alerts/:id/resolve
//   POST  /api/v1/commons/intake
//   GET   /api/v1/commons/intake/:id
//   GET   /api/v1/commons/modules/by-record/:recordId
//   GET   /api/v1/commons/workflows/:instanceId
//   PATCH /api/v1/commons/workflows/:instanceId/advance
//   GET   /api/v1/commons/closeout/:instanceId/readiness
//   GET   /api/v1/commons/outputs/bundle/:instanceId
//   GET   /api/v1/commons/placements/instance/:instanceId
//   GET   /api/v1/commons/module-registry
//
import express from "express";
import { z } from "zod";
import { getAuthContext, requireAuthenticated } from "@publiclogic/core";
import type { CommonsStore } from "../commonsStore.js";

type CommonsRoutesOptions = { commonsStore: CommonsStore };

const intakeSchema = z.object({
  record_type:         z.string().default("public_records_request"),
  module_key:          z.string().default("VAULTCLERK.PublicRecords"),
  intake_channel:      z.enum(["state_api","town_api","civicplus","m365","google","csv","form","email","api","manual","phone","in_person"]).default("form"),
  requester_name:      z.string().min(1).nullish(),
  requester_email:     z.string().email().nullish(),
  request_description: z.string().min(1),
  department_id:       z.string().nullish(),
});

const resolveSchema = z.object({
  notes: z.string().min(1, "Resolution notes are required"),
});

// Logicville demo context — served to all tenants until Org Manager is live
const LOGICVILLE_CONTEXT = {
  tenant_id: "tenant-logicville",
  environment_id: "logiccommons-tenant-logicville",
  municipality_name: "Town of Logicville",
  fiscal_year_start: 7,
  org_chart: {
    departments: [
      { id: "dept-clerk",   name: "Town Clerk",          head_position_id: "pos-clerk-head" },
      { id: "dept-finance", name: "Finance",             head_position_id: "pos-finance-head" },
      { id: "dept-dpw",     name: "DPW",                 head_position_id: "pos-dpw-head" },
      { id: "dept-admin",   name: "Town Administrator",  head_position_id: "pos-admin-head" },
    ],
    positions: [
      { id: "pos-clerk-head",   title: "Town Clerk",         authority_level: 7, is_vacant: false },
      { id: "pos-finance-head", title: "Finance Director",   authority_level: 7, is_vacant: false },
      { id: "pos-dpw-head",     title: "DPW Director",       authority_level: 7, is_vacant: true },
      { id: "pos-admin-head",   title: "Town Administrator", authority_level: 9, is_vacant: false },
    ],
  },
  active_connectors: ["civicplus", "m365"],
  output_destinations: {
    "VAULTCLERK.PublicRecords": ["m365", "logicdocs"],
    "VAULTCLERK.OpenMeeting":   ["civicplus", "logicdocs"],
  },
};

export function createCommonsRoutes(opts: CommonsRoutesOptions): express.Router {
  const { commonsStore } = opts;
  const router = express.Router();

  // ── Municipality context ─────────────────────────────────────────────────
  router.get("/v1/commons/context", requireAuthenticated(), (_req, res) => {
    // TODO: when Org Manager ships, resolve from tenant config
    res.json(LOGICVILLE_CONTEXT);
  });

  // ── Module registry ──────────────────────────────────────────────────────
  router.get("/v1/commons/module-registry", requireAuthenticated(), (_req, res) => {
    res.json(commonsStore.listModules());
  });

  // ── Alerts ───────────────────────────────────────────────────────────────
  router.get("/v1/commons/alerts", requireAuthenticated(), (req, res) => {
    const auth = getAuthContext(req);
    if (!auth?.tenantId) { res.status(403).json({ error: "Forbidden" }); return; }
    const severity = typeof req.query.severity === "string" ? req.query.severity : undefined;
    const domain   = typeof req.query.domain   === "string" ? req.query.domain   : undefined;
    res.json(commonsStore.listAlerts(auth.tenantId, { severity, domain }));
  });

  router.patch("/v1/commons/alerts/:id/acknowledge", requireAuthenticated(), (req, res) => {
    const auth = getAuthContext(req);
    if (!auth?.tenantId) { res.status(403).json({ error: "Forbidden" }); return; }
    const alert = commonsStore.acknowledgeAlert(req.params.id, auth.tenantId, auth.userId);
    if (!alert) { res.status(404).json({ error: "Alert not found" }); return; }
    res.json(alert);
  });

  router.patch("/v1/commons/alerts/:id/resolve", requireAuthenticated(), (req, res) => {
    const auth = getAuthContext(req);
    if (!auth?.tenantId) { res.status(403).json({ error: "Forbidden" }); return; }
    const parsed = resolveSchema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: "notes is required" }); return; }
    const alert = commonsStore.resolveAlert(req.params.id, auth.tenantId, auth.userId, parsed.data.notes);
    if (!alert) { res.status(404).json({ error: "Alert not found" }); return; }
    res.json(alert);
  });

  // ── Intake ───────────────────────────────────────────────────────────────
  router.post("/v1/commons/intake", requireAuthenticated(), (req, res) => {
    const auth = getAuthContext(req);
    if (!auth?.tenantId) { res.status(403).json({ error: "Forbidden" }); return; }
    const parsed = intakeSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid request", issues: parsed.error.issues.map(i => ({ path: i.path.join("."), message: i.message })) });
      return;
    }
    const d = parsed.data;
    // Map non-standard intake channels to valid DB values
    const channelMap: Record<string, string> = { phone: "manual", in_person: "manual" };
    const intake_channel = (channelMap[d.intake_channel] ?? d.intake_channel) as Parameters<CommonsStore["createRecord"]>[1]["intake_channel"];

    const record = commonsStore.createRecord(auth.tenantId, {
      record_type: d.record_type,
      module_key: d.module_key,
      intake_channel,
      requester_name: d.requester_name ?? null,
      requester_email: d.requester_email ?? null,
      request_description: d.request_description,
      department_id: d.department_id ?? null,
      sla_days: d.module_key === "VAULTCLERK.PublicRecords" ? 10 : null,
      actorUserId: auth.userId,
    });
    res.status(201).json(record);
  });

  router.get("/v1/commons/intake/:id", requireAuthenticated(), (req, res) => {
    const auth = getAuthContext(req);
    if (!auth?.tenantId) { res.status(403).json({ error: "Forbidden" }); return; }
    const record = commonsStore.getRecord(req.params.id, auth.tenantId);
    if (!record) { res.status(404).json({ error: "Record not found" }); return; }
    res.json(record);
  });

  router.get("/v1/commons/records", requireAuthenticated(), (req, res) => {
    const auth = getAuthContext(req);
    if (!auth?.tenantId) { res.status(403).json({ error: "Forbidden" }); return; }
    const module_key = typeof req.query.module_key === "string" ? req.query.module_key : undefined;
    const status     = typeof req.query.status     === "string" ? req.query.status     : undefined;
    res.json(commonsStore.listRecords(auth.tenantId, { module_key, status }));
  });

  // ── Module instances ──────────────────────────────────────────────────────
  router.get("/v1/commons/modules/by-record/:recordId", requireAuthenticated(), (req, res) => {
    const auth = getAuthContext(req);
    if (!auth?.tenantId) { res.status(403).json({ error: "Forbidden" }); return; }
    const instance = commonsStore.getModuleInstanceByRecord(req.params.recordId, auth.tenantId);
    if (!instance) { res.status(404).json({ error: "Module instance not found" }); return; }
    res.json({
      ...instance,
      workflow_stages: JSON.parse(instance.workflow_stages),
      role_assignments: JSON.parse(instance.role_assignments),
      stop_rules: JSON.parse(instance.stop_rules),
      blocking_fields: JSON.parse(instance.blocking_fields),
      can_advance: Boolean(instance.can_advance),
    });
  });

  // ── Workflows ─────────────────────────────────────────────────────────────
  router.get("/v1/commons/workflows/:instanceId", requireAuthenticated(), (req, res) => {
    const auth = getAuthContext(req);
    if (!auth?.tenantId) { res.status(403).json({ error: "Forbidden" }); return; }
    const instance = commonsStore.getModuleInstance(req.params.instanceId, auth.tenantId);
    if (!instance) { res.status(404).json({ error: "Instance not found" }); return; }
    res.json({
      ...instance,
      workflow_stages: JSON.parse(instance.workflow_stages),
      role_assignments: JSON.parse(instance.role_assignments),
      stop_rules: JSON.parse(instance.stop_rules),
      blocking_fields: JSON.parse(instance.blocking_fields),
      can_advance: Boolean(instance.can_advance),
    });
  });

  router.patch("/v1/commons/workflows/:instanceId/advance", requireAuthenticated(), (req, res) => {
    const auth = getAuthContext(req);
    if (!auth?.tenantId) { res.status(403).json({ error: "Forbidden" }); return; }
    const result = commonsStore.advanceWorkflow(req.params.instanceId, auth.tenantId, auth.userId);
    if (!result.ok) { res.status(422).json({ error: result.error }); return; }
    const inst = result.instance!;
    res.json({
      ...inst,
      workflow_stages: JSON.parse(inst.workflow_stages),
      role_assignments: JSON.parse(inst.role_assignments),
      stop_rules: JSON.parse(inst.stop_rules),
      blocking_fields: JSON.parse(inst.blocking_fields),
      can_advance: Boolean(inst.can_advance),
    });
  });

  // ── Closeout ───────────────────────────────────────────────────────────────
  router.get("/v1/commons/closeout/:instanceId/readiness", requireAuthenticated(), (req, res) => {
    const auth = getAuthContext(req);
    if (!auth?.tenantId) { res.status(403).json({ error: "Forbidden" }); return; }
    const result = commonsStore.getCloseoutReadiness(req.params.instanceId, auth.tenantId);
    res.json({ ready: result.ready, blocking: result.blocking, canAdvance: result.ready, blockingFields: result.blocking });
  });

  // ── Outputs ────────────────────────────────────────────────────────────────
  router.get("/v1/commons/outputs/bundle/:instanceId", requireAuthenticated(), (req, res) => {
    const auth = getAuthContext(req);
    if (!auth?.tenantId) { res.status(403).json({ error: "Forbidden" }); return; }
    const artifacts = commonsStore.listArtifacts(req.params.instanceId, auth.tenantId);
    res.json(artifacts);
  });

  // ── Placements ─────────────────────────────────────────────────────────────
  router.get("/v1/commons/placements/instance/:instanceId", requireAuthenticated(), (req, res) => {
    const auth = getAuthContext(req);
    if (!auth?.tenantId) { res.status(403).json({ error: "Forbidden" }); return; }
    const placements = commonsStore.listPlacements(req.params.instanceId, auth.tenantId);
    res.json(placements);
  });

  return router;
}
