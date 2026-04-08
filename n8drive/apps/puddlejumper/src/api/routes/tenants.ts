// ── Tenant Registry & Provisioning Routes ───────────────────────────────────
//
//   GET  /api/admin/tenants              – list all tenants
//   GET  /api/admin/tenants/:id          – get single tenant
//   POST /api/admin/tenants/provision    – provision a new tenant
//   PUT  /api/admin/tenants/:id/status   – update tenant status

import { randomUUID } from "node:crypto";
import express from "express";
import type Database from "better-sqlite3";
import { z } from "zod";
import { getAuthContext, requireAuthenticated } from "@publiclogic/core";
import { getCorrelationId } from "../serverMiddleware.js";
import { requireRole } from "../middleware/checkWorkspaceRole.js";
import { provisionTenantESK } from "../../seal/provisioner.js";

export interface TenantRecord {
  id: string;
  slug: string;
  name: string;
  jurisdiction_type: string;
  jurisdiction_id: string | null;
  state: string | null;
  contact_email: string | null;
  status: string;
  plan: string;
  provisioned_by: string;
  seal_provisioned: number;
  created_at: string;
  updated_at: string;
}

const provisionBody = z.object({
  name: z.string().trim().min(2).max(255),
  slug: z.string().trim().min(2).max(100).regex(/^[a-z0-9-]+$/),
  jurisdictionType: z.enum(["municipality", "county", "state", "utility", "nonprofit"]).default("municipality"),
  jurisdictionId: z.string().optional(),
  state: z.string().length(2).optional(),
  contactEmail: z.string().email().optional(),
  plan: z.enum(["trial", "standard", "enterprise"]).default("trial"),
});

const statusBody = z.object({
  status: z.enum(["active", "suspended"]),
});

function initSchema(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS tenant_registry (
      id TEXT PRIMARY KEY,
      slug TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      jurisdiction_type TEXT NOT NULL DEFAULT 'municipality',
      jurisdiction_id TEXT,
      state TEXT,
      contact_email TEXT,
      status TEXT NOT NULL DEFAULT 'active',
      plan TEXT NOT NULL DEFAULT 'trial',
      provisioned_by TEXT NOT NULL,
      seal_provisioned INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_tenant_slug ON tenant_registry(slug);
    CREATE INDEX IF NOT EXISTS idx_tenant_status ON tenant_registry(status);
  `);
}

export function createTenantRoutes(opts: { db: Database.Database; dataDir: string }): express.Router {
  const { db } = opts;

  initSchema(db);

  const router = express.Router();

  // ── GET /api/admin/tenants ────────────────────────────────────────────────
  router.get(
    "/admin/tenants",
    requireAuthenticated(),
    requireRole("owner", "admin"),
    (_req, res) => {
      const correlationId = getCorrelationId(res);
      const tenants = db.prepare("SELECT * FROM tenant_registry ORDER BY created_at DESC").all() as TenantRecord[];
      res.json({ tenants, correlationId });
    },
  );

  // ── GET /api/admin/tenants/:id ────────────────────────────────────────────
  router.get(
    "/admin/tenants/:id",
    requireAuthenticated(),
    requireRole("owner", "admin"),
    (req, res) => {
      const correlationId = getCorrelationId(res);
      const tenant = db
        .prepare("SELECT * FROM tenant_registry WHERE id = ?")
        .get(req.params.id) as TenantRecord | undefined;

      if (!tenant) {
        res.status(404).json({ error: "Tenant not found", correlationId });
        return;
      }
      res.json({ tenant, correlationId });
    },
  );

  // ── POST /api/admin/tenants/provision ─────────────────────────────────────
  router.post(
    "/admin/tenants/provision",
    requireAuthenticated(),
    requireRole("owner", "admin"),
    (req, res) => {
      const correlationId = getCorrelationId(res);
      const auth = getAuthContext(req);

      const parsed = provisionBody.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: "Invalid request body", issues: parsed.error.issues, correlationId });
        return;
      }

      const { name, slug, jurisdictionType, jurisdictionId, state, contactEmail, plan } = parsed.data;
      const id = randomUUID();
      const provisionedBy = auth!.sub;

      // Check slug uniqueness
      const existing = db.prepare("SELECT id FROM tenant_registry WHERE slug = ?").get(slug);
      if (existing) {
        res.status(409).json({ error: `Tenant with slug '${slug}' already exists`, correlationId });
        return;
      }

      db.prepare(`
        INSERT INTO tenant_registry
          (id, slug, name, jurisdiction_type, jurisdiction_id, state, contact_email, plan, provisioned_by, seal_provisioned)
        VALUES
          (?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
      `).run(id, slug, name, jurisdictionType, jurisdictionId ?? null, state ?? null, contactEmail ?? null, plan, provisionedBy);

      let sealProvisioned = false;
      try {
        provisionTenantESK(id, db);
        db.prepare("UPDATE tenant_registry SET seal_provisioned = 1, updated_at = datetime('now') WHERE id = ?").run(id);
        sealProvisioned = true;
      } catch (err) {
        console.error(`[tenants] SEAL provisioning failed for tenant ${id}:`, (err as Error).message);
      }

      const tenant = db
        .prepare("SELECT * FROM tenant_registry WHERE id = ?")
        .get(id) as TenantRecord;

      const message = sealProvisioned
        ? `Tenant '${name}' provisioned successfully with SEAL ESK.`
        : `Tenant '${name}' provisioned, but SEAL ESK provisioning failed — see server logs.`;

      res.status(201).json({ tenant, sealProvisioned, message, correlationId });
    },
  );

  // ── PUT /api/admin/tenants/:id/status ─────────────────────────────────────
  router.put(
    "/admin/tenants/:id/status",
    requireAuthenticated(),
    requireRole("owner", "admin"),
    (req, res) => {
      const correlationId = getCorrelationId(res);

      const parsed = statusBody.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: "status must be 'active' or 'suspended'", correlationId });
        return;
      }

      const existing = db
        .prepare("SELECT id FROM tenant_registry WHERE id = ?")
        .get(req.params.id);

      if (!existing) {
        res.status(404).json({ error: "Tenant not found", correlationId });
        return;
      }

      db.prepare(
        "UPDATE tenant_registry SET status = ?, updated_at = datetime('now') WHERE id = ?",
      ).run(parsed.data.status, req.params.id);

      const tenant = db
        .prepare("SELECT * FROM tenant_registry WHERE id = ?")
        .get(req.params.id) as TenantRecord;

      res.json({ tenant, correlationId });
    },
  );

  return router;
}
