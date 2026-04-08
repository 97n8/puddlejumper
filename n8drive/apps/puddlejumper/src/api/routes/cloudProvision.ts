// ── Cloud Provision ───────────────────────────────────────────────────────────
//
// Creates a standard folder tree for a LogicOS environment in the user's
// connected cloud storage providers (Google Drive, OneDrive) simultaneously.
// Also manages automations, staff turnover transitions, and compliance reports.
//
// POST   /api/cloud-provision                   — provision folder tree
// POST   /api/cloud-provision/share             — add person to folder
// POST   /api/cloud-provision/link              — get shareable link
// POST   /api/cloud-provision/automations       — seed standard automations
// POST   /api/cloud-provision/turnover          — transfer access on staff change
// GET    /api/cloud-provision/report            — compliance snapshot

import express from "express";
import { getAuthContext } from "@publiclogic/core";
import type { ConnectorStore } from "../connectorStore.js";
import type Database from "better-sqlite3";
import { z } from "zod";

// ── Environment folder definitions ───────────────────────────────────────────

const ENV_TREES: Record<string, { label: string; folders: string[] }> = {
  civic: {
    label: "Civic",
    folders: ["Records", "Permits", "Meetings", "Resolutions", "Budgets", "Zoning"],
  },
  health: {
    label: "Health",
    folders: ["Programs", "Reports", "Compliance", "Community Data"],
  },
  ops: {
    label: "Operations",
    folders: ["Projects", "Procurement", "Assets", "Maintenance", "Contracts"],
  },
  grants: {
    label: "Grants",
    folders: ["Applications", "Awards", "Progress Reports", "Closeout"],
  },
};

// ── Canned automation definitions per environment ─────────────────────────────

interface AutomationDef {
  id: string;
  name: string;
  description: string;
  triggerType: "schedule" | "deadline" | "event";
  triggerConfig: Record<string, unknown>;
  actionType: "notify" | "flag" | "report" | "checklist";
  actionConfig: Record<string, unknown>;
}

const ENV_AUTOMATIONS: Record<string, AutomationDef[]> = {
  civic: [
    {
      id: "prr-deadline-monitor",
      name: "Records Request Deadline Monitor",
      description: "Daily check — flags any public records request approaching or past the 10-business-day MGL Ch.66 deadline.",
      triggerType: "schedule",
      triggerConfig: { cron: "0 8 * * 1-5" },
      actionType: "flag",
      actionConfig: { module: "prr", thresholdDays: 2, statute: "MGL Ch.66 §10" },
    },
    {
      id: "oml-meeting-reminder",
      name: "OML Meeting 48h Reminder",
      description: "Sends a reminder 48 hours before any scheduled meeting to ensure agenda posting and quorum compliance.",
      triggerType: "schedule",
      triggerConfig: { cron: "0 9 * * *", lookAheadHours: 48 },
      actionType: "notify",
      actionConfig: { module: "meetings", recipients: ["meeting_officer"], template: "oml-reminder" },
    },
    {
      id: "permit-aging-alert",
      name: "Permit Review Aging Alert",
      description: "Weekly alert for permits open longer than 30 days without action.",
      triggerType: "schedule",
      triggerConfig: { cron: "0 8 * * 1", agingDays: 30 },
      actionType: "flag",
      actionConfig: { module: "permits", escalateTo: "department_head" },
    },
    {
      id: "fiscal-year-close",
      name: "Fiscal Year Close Checklist",
      description: "Triggers a fiscal year close checklist in late June and sends to finance authority.",
      triggerType: "schedule",
      triggerConfig: { cron: "0 9 1 6 *" },
      actionType: "checklist",
      actionConfig: { module: "budgets", recipients: ["finance_authority"], template: "fy-close" },
    },
    {
      id: "compliance-monthly-report",
      name: "Monthly Compliance Report",
      description: "Generates a full compliance snapshot on the first of each month and delivers to administrators.",
      triggerType: "schedule",
      triggerConfig: { cron: "0 7 1 * *" },
      actionType: "report",
      actionConfig: { environment: "civic", recipients: ["administrator"] },
    },
  ],
  health: [
    {
      id: "case-overdue-check",
      name: "Case Deadline Monitor",
      description: "Daily check for health cases approaching their statutory response deadline.",
      triggerType: "schedule",
      triggerConfig: { cron: "0 8 * * 1-5" },
      actionType: "flag",
      actionConfig: { module: "cases" },
    },
    {
      id: "inspection-reminder",
      name: "Upcoming Inspection Reminder",
      description: "Weekly digest of inspections scheduled in the next 7 days.",
      triggerType: "schedule",
      triggerConfig: { cron: "0 8 * * 1" },
      actionType: "notify",
      actionConfig: { module: "inspections", lookAheadDays: 7 },
    },
    {
      id: "compliance-monthly-report",
      name: "Monthly Compliance Report",
      description: "First-of-month compliance snapshot for Health department.",
      triggerType: "schedule",
      triggerConfig: { cron: "0 7 1 * *" },
      actionType: "report",
      actionConfig: { environment: "health", recipients: ["administrator"] },
    },
  ],
  ops: [
    {
      id: "workorder-aging-alert",
      name: "Work Order Aging Alert",
      description: "Daily check for work orders open longer than 14 days without status update.",
      triggerType: "schedule",
      triggerConfig: { cron: "0 8 * * 1-5", agingDays: 14 },
      actionType: "flag",
      actionConfig: { module: "workorders", escalateTo: "ops_supervisor" },
    },
    {
      id: "asset-maintenance-due",
      name: "Asset Maintenance Due",
      description: "Weekly check for assets with maintenance coming due in the next 14 days.",
      triggerType: "schedule",
      triggerConfig: { cron: "0 8 * * 1", lookAheadDays: 14 },
      actionType: "notify",
      actionConfig: { module: "assets" },
    },
  ],
  grants: [
    {
      id: "reporting-deadline-monitor",
      name: "Grant Reporting Deadline Monitor",
      description: "Weekly check for grant reporting deadlines within 30 days.",
      triggerType: "schedule",
      triggerConfig: { cron: "0 8 * * 1", lookAheadDays: 30 },
      actionType: "notify",
      actionConfig: { module: "grants", recipients: ["grant_manager"] },
    },
    {
      id: "closeout-reminder",
      name: "Grant Closeout Reminder",
      description: "Alert 60 and 30 days before grant closeout date.",
      triggerType: "deadline",
      triggerConfig: { thresholdDays: [60, 30] },
      actionType: "notify",
      actionConfig: { module: "grants", recipients: ["grant_manager", "finance_authority"] },
    },
    {
      id: "compliance-monthly-report",
      name: "Monthly Compliance Report",
      description: "First-of-month compliance snapshot for Grants environment.",
      triggerType: "schedule",
      triggerConfig: { cron: "0 7 1 * *" },
      actionType: "report",
      actionConfig: { environment: "grants", recipients: ["administrator"] },
    },
  ],
};

// ── Schemas ───────────────────────────────────────────────────────────────────

const provisionBodySchema = z.object({
  environment: z.string().trim().min(1),
  providers: z.array(z.enum(["google", "microsoft"])).min(1).max(2),
});

const shareBodySchema = z.object({
  provider: z.enum(["google", "microsoft"]),
  folderId: z.string().min(1),
  driveId: z.string().optional(),
  email: z.string().email(),
  role: z.enum(["reader", "writer"]),
});

const linkBodySchema = z.object({
  provider: z.enum(["google", "microsoft"]),
  folderId: z.string().min(1),
  driveId: z.string().optional(),
});

const automationsBodySchema = z.object({
  environment: z.string().trim().min(1),
  selected: z.array(z.string()).optional(), // if omitted, seed all
});

const turnoverBodySchema = z.object({
  departing: z.string().email(),
  successor: z.string().email(),
  providers: z.array(z.enum(["google", "microsoft"])).min(1).max(2),
  folderId: z.string().min(1).optional(),       // root folder to transfer
  driveId: z.string().optional(),               // MS only
  googleFolderId: z.string().optional(),
  microsoftFolderId: z.string().optional(),
  microsoftDriveId: z.string().optional(),
  environment: z.string().optional(),
});

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ProvisionedFolder {
  name: string;
  id: string;
  url: string;
}

export interface ProvisionResult {
  rootId: string;
  rootUrl: string;
  folders: ProvisionedFolder[];
}

// ── Token refresh helpers (shared pattern from cloudSave.ts) ─────────────────

async function refreshGoogleToken(
  store: ConnectorStore,
  fetchImpl: typeof fetch,
  tenantId: string,
  userId: string,
  refreshToken: string
): Promise<string | null> {
  const clientId = (process.env.GOOGLE_CLIENT_ID ?? "").trim();
  const clientSecret = (process.env.GOOGLE_CLIENT_SECRET ?? "").trim();
  if (!clientId || !clientSecret) return null;
  try {
    const form = new URLSearchParams({ client_id: clientId, client_secret: clientSecret, refresh_token: refreshToken, grant_type: "refresh_token" });
    const res = await fetchImpl("https://oauth2.googleapis.com/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: form.toString() });
    if (!res.ok) return null;
    const payload = await res.json() as Record<string, unknown>;
    const accessToken = typeof payload.access_token === "string" ? payload.access_token : null;
    if (!accessToken) return null;
    const expiresIn = typeof payload.expires_in === "number" ? payload.expires_in : 3600;
    store.upsertToken({ provider: "google", tenantId, userId, accessToken, refreshToken, scopes: [], account: null, expiresAt: new Date(Date.now() + expiresIn * 1000).toISOString() });
    return accessToken;
  } catch { return null; }
}

async function refreshMicrosoftToken(
  store: ConnectorStore,
  fetchImpl: typeof fetch,
  tenantId: string,
  userId: string,
  refreshToken: string
): Promise<string | null> {
  const clientId = (process.env.MICROSOFT_CLIENT_ID ?? "").trim();
  const clientSecret = (process.env.MICROSOFT_CLIENT_SECRET ?? "").trim();
  if (!clientId || !clientSecret) return null;
  try {
    const tenantSegment = (process.env.MS_TENANT_ID ?? "common").trim() || "common";
    const form = new URLSearchParams({ client_id: clientId, client_secret: clientSecret, refresh_token: refreshToken, grant_type: "refresh_token" });
    const res = await fetchImpl(`https://login.microsoftonline.com/${encodeURIComponent(tenantSegment)}/oauth2/v2.0/token`, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: form.toString() });
    if (!res.ok) return null;
    const payload = await res.json() as Record<string, unknown>;
    const accessToken = typeof payload.access_token === "string" ? payload.access_token : null;
    if (!accessToken) return null;
    const expiresIn = typeof payload.expires_in === "number" ? payload.expires_in : 3600;
    const newRefreshToken = typeof payload.refresh_token === "string" ? payload.refresh_token : refreshToken;
    store.upsertToken({ provider: "microsoft", tenantId, userId, accessToken, refreshToken: newRefreshToken, scopes: [], account: null, expiresAt: new Date(Date.now() + expiresIn * 1000).toISOString() });
    return accessToken;
  } catch { return null; }
}

async function getGoogleToken(store: ConnectorStore, fetchImpl: typeof fetch, tenantId: string, userId: string): Promise<string | null> {
  const token = store.getToken("google", tenantId, userId);
  if (!token) return null;
  if (token.accessToken) return token.accessToken;
  if (token.refreshToken) return refreshGoogleToken(store, fetchImpl, tenantId, userId, token.refreshToken);
  return null;
}

async function getMicrosoftToken(store: ConnectorStore, fetchImpl: typeof fetch, tenantId: string, userId: string): Promise<string | null> {
  const token = store.getToken("microsoft", tenantId, userId);
  if (!token) return null;
  if (token.accessToken) return token.accessToken;
  if (token.refreshToken) return refreshMicrosoftToken(store, fetchImpl, tenantId, userId, token.refreshToken);
  return null;
}

// ── Google Drive helpers ──────────────────────────────────────────────────────

async function googleCreateFolder(
  fetchImpl: typeof fetch,
  accessToken: string,
  name: string,
  parentId?: string
): Promise<{ id: string; url: string }> {
  const metadata: Record<string, unknown> = {
    name,
    mimeType: "application/vnd.google-apps.folder",
  };
  if (parentId) metadata.parents = [parentId];
  const res = await fetchImpl("https://www.googleapis.com/drive/v3/files?fields=id,webViewLink", {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify(metadata),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as Record<string, unknown>;
    throw new Error(`Google folder create failed: ${JSON.stringify(err)}`);
  }
  const data = await res.json() as { id: string; webViewLink: string };
  return { id: data.id, url: data.webViewLink };
}

async function googleMakeShareable(
  fetchImpl: typeof fetch,
  accessToken: string,
  fileId: string
): Promise<string> {
  // Grant anyone-with-link reader access
  await fetchImpl(`https://www.googleapis.com/drive/v3/files/${fileId}/permissions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ role: "reader", type: "anyone" }),
  });
  // Get the shareable link
  const res = await fetchImpl(`https://www.googleapis.com/drive/v3/files/${fileId}?fields=webViewLink`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const data = await res.json() as { webViewLink?: string };
  return data.webViewLink ?? `https://drive.google.com/drive/folders/${fileId}`;
}

async function googleShareWithUser(
  fetchImpl: typeof fetch,
  accessToken: string,
  fileId: string,
  email: string,
  role: "reader" | "writer" | "commenter"
): Promise<string> {
  const res = await fetchImpl(`https://www.googleapis.com/drive/v3/files/${fileId}/permissions?sendNotificationEmail=true`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ role, type: "user", emailAddress: email }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as Record<string, unknown>;
    throw new Error(`Google share failed: ${JSON.stringify(err)}`);
  }
  const data = await res.json() as { id: string };
  return data.id;
}

// ── OneDrive helpers ──────────────────────────────────────────────────────────

async function msCreateFolder(
  fetchImpl: typeof fetch,
  accessToken: string,
  name: string,
  parentId?: string,
  driveId?: string
): Promise<{ id: string; url: string }> {
  let url: string;
  if (driveId && parentId) {
    url = `https://graph.microsoft.com/v1.0/drives/${driveId}/items/${parentId}/children`;
  } else if (driveId) {
    url = `https://graph.microsoft.com/v1.0/drives/${driveId}/root/children`;
  } else if (parentId) {
    url = `https://graph.microsoft.com/v1.0/me/drive/items/${parentId}/children`;
  } else {
    url = `https://graph.microsoft.com/v1.0/me/drive/root/children`;
  }
  const res = await fetchImpl(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ name, folder: {}, "@microsoft.graph.conflictBehavior": "rename" }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as Record<string, unknown>;
    throw new Error(`OneDrive folder create failed: ${JSON.stringify(err)}`);
  }
  const data = await res.json() as { id: string; webUrl: string };
  return { id: data.id, url: data.webUrl };
}

async function msMakeShareable(
  fetchImpl: typeof fetch,
  accessToken: string,
  itemId: string,
  driveId?: string
): Promise<string> {
  const base = driveId
    ? `https://graph.microsoft.com/v1.0/drives/${driveId}/items/${itemId}`
    : `https://graph.microsoft.com/v1.0/me/drive/items/${itemId}`;
  const res = await fetchImpl(`${base}/createLink`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ type: "view", scope: "organization" }),
  });
  if (!res.ok) {
    // Fallback to anonymous link
    const res2 = await fetchImpl(`${base}/createLink`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ type: "view", scope: "anonymous" }),
    });
    const data2 = await res2.json() as { link?: { webUrl?: string } };
    return data2.link?.webUrl ?? "";
  }
  const data = await res.json() as { link?: { webUrl?: string } };
  return data.link?.webUrl ?? "";
}

async function msShareWithUser(
  fetchImpl: typeof fetch,
  accessToken: string,
  itemId: string,
  driveId: string | undefined,
  email: string,
  role: "reader" | "writer" | "commenter"
): Promise<string> {
  const base = driveId
    ? `https://graph.microsoft.com/v1.0/drives/${driveId}/items/${itemId}`
    : `https://graph.microsoft.com/v1.0/me/drive/items/${itemId}`;
  const msRole = role === "writer" ? "write" : "read";
  const res = await fetchImpl(`${base}/invite`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      requireSignIn: true,
      sendInvitation: true,
      roles: [msRole],
      recipients: [{ email }],
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as Record<string, unknown>;
    throw new Error(`OneDrive share failed: ${JSON.stringify(err)}`);
  }
  const data = await res.json() as { value?: { id: string }[] };
  return data.value?.[0]?.id ?? "";
}

// ── Provision helpers ─────────────────────────────────────────────────────────

async function provisionGoogle(
  fetchImpl: typeof fetch,
  accessToken: string,
  rootName: string,
  subfolders: string[]
): Promise<ProvisionResult> {
  const root = await googleCreateFolder(fetchImpl, accessToken, rootName);
  // Make root shareable immediately so the user can copy the link
  const rootUrl = await googleMakeShareable(fetchImpl, accessToken, root.id).catch(() => root.url);
  const folders: ProvisionedFolder[] = [];
  for (const name of subfolders) {
    try {
      const f = await googleCreateFolder(fetchImpl, accessToken, name, root.id);
      const url = await googleMakeShareable(fetchImpl, accessToken, f.id).catch(() => f.url);
      folders.push({ name, id: f.id, url });
    } catch (err) {
      folders.push({ name, id: "", url: "", });
    }
  }
  return { rootId: root.id, rootUrl, folders };
}

async function provisionMicrosoft(
  fetchImpl: typeof fetch,
  accessToken: string,
  rootName: string,
  subfolders: string[],
  driveId?: string
): Promise<ProvisionResult> {
  const root = await msCreateFolder(fetchImpl, accessToken, rootName, undefined, driveId);
  const rootUrl = await msMakeShareable(fetchImpl, accessToken, root.id, driveId).catch(() => root.url);
  const folders: ProvisionedFolder[] = [];
  for (const name of subfolders) {
    try {
      const f = await msCreateFolder(fetchImpl, accessToken, name, root.id, driveId);
      const url = await msMakeShareable(fetchImpl, accessToken, f.id, driveId).catch(() => f.url);
      folders.push({ name, id: f.id, url });
    } catch {
      folders.push({ name, id: "", url: "" });
    }
  }
  return { rootId: root.id, rootUrl, folders };
}

// ── Router ────────────────────────────────────────────────────────────────────

export function createCloudProvisionRoutes(opts: { store: ConnectorStore; db?: Database.Database; fetchImpl?: typeof fetch }): express.Router {
  const router = express.Router();
  const fetchImpl = opts.fetchImpl ?? fetch;
  const db = opts.db;

  // ── SQLite: provision_automations table ──────────────────────────────────
  if (db) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS provision_automations (
        id TEXT NOT NULL,
        tenant_id TEXT NOT NULL,
        environment TEXT NOT NULL,
        name TEXT NOT NULL,
        description TEXT NOT NULL,
        trigger_type TEXT NOT NULL,
        trigger_config TEXT NOT NULL,
        action_type TEXT NOT NULL,
        action_config TEXT NOT NULL,
        enabled INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL,
        last_run_at TEXT,
        last_result TEXT,
        PRIMARY KEY (id, tenant_id, environment)
      );
      CREATE INDEX IF NOT EXISTS idx_prov_auto_tenant ON provision_automations(tenant_id);
      CREATE INDEX IF NOT EXISTS idx_prov_auto_env ON provision_automations(environment);
    `);
  }

  // ── POST / — provision environment folder tree ────────────────────────────

  router.post("/", async (req, res) => {
    const auth = getAuthContext(req);
    if (!auth) { res.status(401).json({ error: "Unauthorized" }); return; }
    const tenantId = auth.tenantId ?? "";
    if (!tenantId) { res.status(400).json({ error: "Tenant scope unavailable" }); return; }

    const parsed = provisionBodySchema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: "Invalid request", detail: parsed.error.flatten() }); return; }

    const { environment, providers } = parsed.data;
    const userId = auth.userId ?? auth.sub;
    const envDef = ENV_TREES[environment.toLowerCase()];
    if (!envDef) { res.status(400).json({ error: `Unknown environment: ${environment}` }); return; }

    const rootName = `LogicOS — ${envDef.label}`;
    const result: Record<string, ProvisionResult | { error: string }> = {};

    await Promise.all(providers.map(async (provider) => {
      try {
        if (provider === "google") {
          const token = await getGoogleToken(opts.store, fetchImpl, tenantId, userId);
          if (!token) { result.google = { error: "Google not connected" }; return; }
          result.google = await provisionGoogle(fetchImpl, token, rootName, envDef.folders);
        } else {
          const token = await getMicrosoftToken(opts.store, fetchImpl, tenantId, userId);
          if (!token) { result.microsoft = { error: "Microsoft not connected" }; return; }
          result.microsoft = await provisionMicrosoft(fetchImpl, token, rootName, envDef.folders);
        }
      } catch (err) {
        result[provider] = { error: err instanceof Error ? err.message : "Provision failed" };
      }
    }));

    res.json(result);
  });

  // ── POST /share — add a person to a provisioned folder ───────────────────

  router.post("/share", async (req, res) => {
    const auth = getAuthContext(req);
    if (!auth) { res.status(401).json({ error: "Unauthorized" }); return; }
    const tenantId = auth.tenantId ?? "";
    if (!tenantId) { res.status(400).json({ error: "Tenant scope unavailable" }); return; }

    const parsed = shareBodySchema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: "Invalid request", detail: parsed.error.flatten() }); return; }

    const { provider, folderId, driveId, email, role } = parsed.data;
    const userId = auth.userId ?? auth.sub;

    try {
      if (provider === "google") {
        const token = await getGoogleToken(opts.store, fetchImpl, tenantId, userId);
        if (!token) { res.status(401).json({ error: "Google not connected" }); return; }
        const permissionId = await googleShareWithUser(fetchImpl, token, folderId, email, role);
        res.json({ ok: true, permissionId });
      } else {
        const token = await getMicrosoftToken(opts.store, fetchImpl, tenantId, userId);
        if (!token) { res.status(401).json({ error: "Microsoft not connected" }); return; }
        const permissionId = await msShareWithUser(fetchImpl, token, folderId, driveId, email, role);
        res.json({ ok: true, permissionId });
      }
    } catch (err) {
      res.status(502).json({ error: err instanceof Error ? err.message : "Share failed" });
    }
  });

  // ── POST /link — get/refresh a shareable link for a folder ───────────────

  router.post("/link", async (req, res) => {
    const auth = getAuthContext(req);
    if (!auth) { res.status(401).json({ error: "Unauthorized" }); return; }
    const tenantId = auth.tenantId ?? "";
    if (!tenantId) { res.status(400).json({ error: "Tenant scope unavailable" }); return; }

    const parsed = linkBodySchema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: "Invalid request", detail: parsed.error.flatten() }); return; }

    const { provider, folderId, driveId } = parsed.data;
    const userId = auth.userId ?? auth.sub;

    try {
      if (provider === "google") {
        const token = await getGoogleToken(opts.store, fetchImpl, tenantId, userId);
        if (!token) { res.status(401).json({ error: "Google not connected" }); return; }
        const link = await googleMakeShareable(fetchImpl, token, folderId);
        res.json({ link });
      } else {
        const token = await getMicrosoftToken(opts.store, fetchImpl, tenantId, userId);
        if (!token) { res.status(401).json({ error: "Microsoft not connected" }); return; }
        const link = await msMakeShareable(fetchImpl, token, folderId, driveId);
        res.json({ link });
      }
    } catch (err) {
      res.status(502).json({ error: err instanceof Error ? err.message : "Link generation failed" });
    }
  });

  // ── POST /automations — seed standard automations for an environment ──────

  router.post("/automations", async (req, res) => {
    const auth = getAuthContext(req);
    if (!auth) { res.status(401).json({ error: "Unauthorized" }); return; }
    const tenantId = auth.tenantId ?? "";
    if (!tenantId) { res.status(400).json({ error: "Tenant scope unavailable" }); return; }

    const parsed = automationsBodySchema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: "Invalid request", detail: parsed.error.flatten() }); return; }

    const { environment, selected } = parsed.data;
    const defs = ENV_AUTOMATIONS[environment.toLowerCase()];
    if (!defs) { res.status(400).json({ error: `No automations defined for environment: ${environment}` }); return; }

    const toSeed = selected?.length ? defs.filter(d => selected.includes(d.id)) : defs;

    if (!db) {
      // Return definitions without persisting (db not wired)
      res.json({ automations: toSeed.map(d => ({ ...d, enabled: true, createdAt: new Date().toISOString() })) });
      return;
    }

    const now = new Date().toISOString();
    const upsert = db.prepare(`
      INSERT OR REPLACE INTO provision_automations
        (id, tenant_id, environment, name, description, trigger_type, trigger_config, action_type, action_config, enabled, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)
    `);

    const seeded = db.transaction(() => {
      return toSeed.map(d => {
        upsert.run(d.id, tenantId, environment.toLowerCase(), d.name, d.description,
          d.triggerType, JSON.stringify(d.triggerConfig), d.actionType, JSON.stringify(d.actionConfig), now);
        return { ...d, enabled: true, createdAt: now };
      });
    })();

    res.json({ automations: seeded, total: seeded.length });
  });

  // ── POST /turnover — transfer folder access on staff transition ───────────

  router.post("/turnover", async (req, res) => {
    const auth = getAuthContext(req);
    if (!auth) { res.status(401).json({ error: "Unauthorized" }); return; }
    const tenantId = auth.tenantId ?? "";
    if (!tenantId) { res.status(400).json({ error: "Tenant scope unavailable" }); return; }

    const parsed = turnoverBodySchema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: "Invalid request", detail: parsed.error.flatten() }); return; }

    const { departing, successor, providers, googleFolderId, microsoftFolderId, microsoftDriveId, environment } = parsed.data;
    const userId = auth.userId ?? auth.sub;
    const results: Record<string, unknown> = {};

    await Promise.all(providers.map(async (provider) => {
      try {
        if (provider === "google" && googleFolderId) {
          const token = await getGoogleToken(opts.store, fetchImpl, tenantId, userId);
          if (!token) { results.google = { error: "Google not connected" }; return; }

          // List permissions to find departing user
          const permRes = await fetchImpl(`https://www.googleapis.com/drive/v3/files/${googleFolderId}/permissions?fields=permissions(id,emailAddress,role)`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          const permData = await permRes.json() as { permissions?: { id: string; emailAddress?: string; role: string }[] };
          const departingPerm = permData.permissions?.find(p => p.emailAddress?.toLowerCase() === departing.toLowerCase());

          // Revoke departing user
          if (departingPerm) {
            await fetchImpl(`https://www.googleapis.com/drive/v3/files/${googleFolderId}/permissions/${departingPerm.id}`, {
              method: "DELETE",
              headers: { Authorization: `Bearer ${token}` },
            });
          }

          // Grant successor as writer
          const addRes = await fetchImpl(`https://www.googleapis.com/drive/v3/files/${googleFolderId}/permissions?sendNotificationEmail=true`, {
            method: "POST",
            headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
            body: JSON.stringify({ role: "writer", type: "user", emailAddress: successor }),
          });
          const addData = await addRes.json() as { id?: string };
          results.google = { ok: true, revokedPermId: departingPerm?.id ?? null, successorPermId: addData.id ?? null };

        } else if (provider === "microsoft" && microsoftFolderId) {
          const token = await getMicrosoftToken(opts.store, fetchImpl, tenantId, userId);
          if (!token) { results.microsoft = { error: "Microsoft not connected" }; return; }

          const base = microsoftDriveId
            ? `https://graph.microsoft.com/v1.0/drives/${microsoftDriveId}/items/${microsoftFolderId}`
            : `https://graph.microsoft.com/v1.0/me/drive/items/${microsoftFolderId}`;

          // List permissions
          const permRes = await fetchImpl(`${base}/permissions`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          const permData = await permRes.json() as { value?: { id: string; grantedToV2?: { user?: { email?: string } }; roles: string[] }[] };
          const departingPerm = permData.value?.find(p =>
            p.grantedToV2?.user?.email?.toLowerCase() === departing.toLowerCase()
          );

          // Revoke departing
          if (departingPerm) {
            await fetchImpl(`${base}/permissions/${departingPerm.id}`, {
              method: "DELETE",
              headers: { Authorization: `Bearer ${token}` },
            });
          }

          // Grant successor
          const inviteRes = await fetchImpl(`${base}/invite`, {
            method: "POST",
            headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
            body: JSON.stringify({ requireSignIn: true, sendInvitation: true, roles: ["write"], recipients: [{ email: successor }] }),
          });
          const inviteData = await inviteRes.json() as { value?: { id: string }[] };
          results.microsoft = { ok: true, revokedPermId: departingPerm?.id ?? null, successorPermId: inviteData.value?.[0]?.id ?? null };
        }
      } catch (err) {
        results[provider] = { error: err instanceof Error ? err.message : "Transfer failed" };
      }
    }));

    // Log the transition if db is available
    if (db) {
      try {
        db.prepare(`
          INSERT OR IGNORE INTO provision_automations (id, tenant_id, environment, name, description, trigger_type, trigger_config, action_type, action_config, enabled, created_at, last_result)
          VALUES (?, ?, ?, ?, ?, 'event', '{}', 'notify', '{}', 0, ?, ?)
        `).run(
          `turnover-${Date.now()}`, tenantId, environment ?? "unknown",
          `Staff Transition: ${departing} → ${successor}`,
          `Access transferred from ${departing} to ${successor} on ${new Date().toISOString().slice(0, 10)}`,
          new Date().toISOString(),
          JSON.stringify({ departing, successor, results })
        );
      } catch { /* non-fatal */ }
    }

    // Build a transition checklist document (returned for frontend to save)
    const checklistItems = [
      `☐ Confirm successor ${successor} has received access invitations`,
      `☐ Brief successor on open items and pending deadlines`,
      `☐ Archive or reassign any in-progress work from ${departing}`,
      `☐ Update org chart and role assignments in LogicOS Org Manager`,
      `☐ Revoke system credentials and badge access`,
      `☐ Notify department head and administrator of transition`,
      `☐ Run compliance report to capture state at time of transition`,
      environment === "civic" ? `☐ Reassign any open public records requests (PRR) to successor` : null,
      environment === "grants" ? `☐ Transfer grant reporting responsibilities to successor` : null,
    ].filter(Boolean);

    res.json({
      results,
      checklist: {
        title: `Staff Transition Checklist`,
        departing,
        successor,
        date: new Date().toISOString().slice(0, 10),
        items: checklistItems,
      },
    });
  });

  // ── GET /report — compliance snapshot ────────────────────────────────────

  router.get("/report", async (req, res) => {
    const auth = getAuthContext(req);
    if (!auth) { res.status(401).json({ error: "Unauthorized" }); return; }
    const tenantId = auth.tenantId ?? "";
    if (!tenantId) { res.status(400).json({ error: "Tenant scope unavailable" }); return; }

    const environment = (req.query.environment as string | undefined)?.toLowerCase() ?? "civic";
    const now = new Date();
    const report: Record<string, unknown> = {
      generatedAt: now.toISOString(),
      environment,
      period: {
        start: new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10),
        end: now.toISOString().slice(0, 10),
      },
    };

    if (db && environment === "civic") {
      try {
        // PRR (public records requests) — MGL Ch.66 10 business days
        const prrTotal = (db.prepare("SELECT COUNT(*) as n FROM gov_prr_requests").get() as { n: number } | undefined)?.n ?? 0;
        const prrOpen = (db.prepare("SELECT COUNT(*) as n FROM gov_prr_requests WHERE status NOT IN ('closed', 'denied')").get() as { n: number } | undefined)?.n ?? 0;
        const prrOverdue = (db.prepare(`
          SELECT COUNT(*) as n FROM gov_prr_requests
          WHERE status NOT IN ('closed', 'denied')
          AND julianday('now') - julianday(received_at) > 14
        `).get() as { n: number } | undefined)?.n ?? 0;

        report.prr = { total: prrTotal, open: prrOpen, overdue: prrOverdue, statute: "MGL Ch.66 §10" };
      } catch { report.prr = { error: "Table unavailable" }; }

      try {
        // Deadlines from civic store (objects table)
        const overdueDeadlines = (db.prepare(`
          SELECT COUNT(*) as n FROM deadlines
          WHERE resolved_at IS NULL AND due_date < date('now')
        `).get() as { n: number } | undefined)?.n ?? 0;
        const upcomingDeadlines = (db.prepare(`
          SELECT COUNT(*) as n FROM deadlines
          WHERE resolved_at IS NULL AND due_date BETWEEN date('now') AND date('now', '+14 days')
        `).get() as { n: number } | undefined)?.n ?? 0;

        report.deadlines = { overdue: overdueDeadlines, upcoming: upcomingDeadlines };
      } catch { report.deadlines = { error: "Table unavailable" }; }
    }

    // Active automations for this environment
    if (db) {
      try {
        const automations = db.prepare(`
          SELECT id, name, enabled, last_run_at FROM provision_automations
          WHERE tenant_id = ? AND environment = ?
        `).all(tenantId, environment) as { id: string; name: string; enabled: number; last_run_at: string | null }[];
        report.automations = { total: automations.length, enabled: automations.filter(a => a.enabled).length, items: automations };
      } catch { report.automations = { total: 0, enabled: 0, items: [] }; }
    }

    // Build plain-text summary
    const prr = report.prr as { open?: number; overdue?: number } | undefined;
    const dl = report.deadlines as { overdue?: number; upcoming?: number } | undefined;
    const parts: string[] = [];
    if (prr?.open !== undefined) parts.push(`${prr.open} open records request${prr.open !== 1 ? "s" : ""}${(prr.overdue ?? 0) > 0 ? `, ${prr.overdue} overdue` : ""}`);
    if (dl?.overdue !== undefined) parts.push(`${dl.overdue} overdue deadline${dl.overdue !== 1 ? "s" : ""}${(dl.upcoming ?? 0) > 0 ? `, ${dl.upcoming} upcoming` : ""}`);
    report.summary = parts.length > 0 ? parts.join(" · ") : `${envLabel(environment)} environment compliance snapshot generated.`;

    res.json(report);
  });

  return router;
}

function envLabel(env: string): string {
  return ENV_TREES[env]?.label ?? (env.charAt(0).toUpperCase() + env.slice(1));
}
