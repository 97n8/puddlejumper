/**
 * Vault Module Builder Routes — PuddleJumper main app
 *
 * REST API for LogicOS VaultModuleMaker sessions.
 * Sessions represent a town's governance module configuration in progress or activated.
 *
 * Routes:
 *   GET    /api/v1/vault/modules/catalog
 *   POST   /api/v1/vault/modules/sessions
 *   GET    /api/v1/vault/modules/sessions
 *   GET    /api/v1/vault/modules/sessions/:id
 *   PUT    /api/v1/vault/modules/sessions/:id
 *   POST   /api/v1/vault/modules/sessions/:id/activate
 *   GET    /api/v1/vault/modules/environments/:envId/raos
 *   POST   /api/v1/vault/modules/environments/:envId/raos
 *   PUT    /api/v1/vault/modules/environments/:envId/raos/batch
 *   PUT    /api/v1/vault/modules/environments/:envId/raos/:raoId
 *   DELETE /api/v1/vault/modules/environments/:envId/raos/:raoId
 */
import { Router } from "express";
import Database from "better-sqlite3";
import { z } from "zod";
import path from "node:path";
import fs from "node:fs";

const MODULE_CATALOG = [
  { id: "VAULTPRR",     name: "Public Records", dataset: "public-records-requests" },
  { id: "VAULTCLERK",   name: "Clerk",          dataset: "agenda-minutes-filings" },
  { id: "VAULTONBOARD", name: "Onboarding",     dataset: "hr-onboarding-workflows" },
  { id: "VAULTPERMIT",  name: "Permits",        dataset: "permit-applications" },
  { id: "VAULTFISCAL",  name: "Fiscal",         dataset: "ap-ar-fiscal-ops" },
  { id: "VAULTPROCURE", name: "Procurement",    dataset: "procurement-events" },
  { id: "VAULTINSPECT", name: "Inspections",    dataset: "inspection-cases" },
  { id: "VAULTMEETING", name: "Meetings",       dataset: "meeting-lifecycle" },
  { id: "VAULTER",      name: "Emergency",      dataset: "incident-response" },
] as const;

// ── Schema ────────────────────────────────────────────────────────────────────

const CreateSessionSchema = z.object({
  town: z.string().min(1),
  selectedModuleIds: z.array(z.string()),
  configs: z.record(z.string(), z.unknown()).optional().default({}),
});

const UpdateSessionSchema = z.object({
  selectedModuleIds: z.array(z.string()).optional(),
  configs: z.record(z.string(), z.unknown()).optional(),
  status: z.enum(["draft", "review", "activated"]).optional(),
});

// ── SQLite store ──────────────────────────────────────────────────────────────

interface SessionRow {
  id: string;
  town: string;
  selected_module_ids: string;
  configs: string;
  status: string;
  created_at: number;
  updated_at: number;
  activated_at: number | null;
}

class ModuleBuilderStore {
  private db: Database.Database;

  constructor(dbPath: string) {
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
    this.db = new Database(dbPath);
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS builder_sessions (
        id TEXT PRIMARY KEY,
        town TEXT NOT NULL,
        selected_module_ids TEXT NOT NULL DEFAULT '[]',
        configs TEXT NOT NULL DEFAULT '{}',
        status TEXT NOT NULL DEFAULT 'draft',
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        activated_at INTEGER
      );
      CREATE INDEX IF NOT EXISTS idx_builder_sessions_town ON builder_sessions (town);
    `);
  }

  create(session: Omit<SessionRow, "activated_at">): SessionRow {
    this.db.prepare(
      `INSERT INTO builder_sessions
        (id, town, selected_module_ids, configs, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(
      session.id, session.town, session.selected_module_ids,
      session.configs, session.status, session.created_at, session.updated_at
    );
    return { ...session, activated_at: null };
  }

  get(id: string): SessionRow | undefined {
    return this.db.prepare("SELECT * FROM builder_sessions WHERE id = ?").get(id) as SessionRow | undefined;
  }

  list(town?: string): SessionRow[] {
    if (town) {
      return this.db.prepare("SELECT * FROM builder_sessions WHERE town = ? ORDER BY created_at DESC").all(town) as SessionRow[];
    }
    return this.db.prepare("SELECT * FROM builder_sessions ORDER BY created_at DESC").all() as SessionRow[];
  }

  update(id: string, patch: Partial<Pick<SessionRow, "selected_module_ids" | "configs" | "status" | "updated_at">>): boolean {
    const sets = Object.keys(patch).map((k) => `${k} = ?`).join(", ");
    const values = [...Object.values(patch), id];
    return this.db.prepare(`UPDATE builder_sessions SET ${sets} WHERE id = ?`).run(...values).changes > 0;
  }

  activate(id: string, now: number): boolean {
    return this.db.prepare(
      "UPDATE builder_sessions SET status = 'activated', activated_at = ?, updated_at = ? WHERE id = ?"
    ).run(now, now, id).changes > 0;
  }
}

function rowToJson(row: SessionRow) {
  return {
    id: row.id,
    town: row.town,
    selectedModuleIds: JSON.parse(row.selected_module_ids),
    configs: JSON.parse(row.configs),
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    activatedAt: row.activated_at ?? undefined,
  };
}

// ── RAO helpers ───────────────────────────────────────────────────────────────

function raoDir(dataDir: string): string {
  return path.join(dataDir, "environments");
}

function raoFile(dataDir: string, envId: string): string {
  const dir = path.join(raoDir(dataDir), envId);
  fs.mkdirSync(dir, { recursive: true });
  return path.join(dir, "raos.json");
}

function readRaos(dataDir: string, envId: string): unknown[] {
  const file = raoFile(dataDir, envId);
  if (!fs.existsSync(file)) return [];
  try { return JSON.parse(fs.readFileSync(file, "utf8")); } catch { return []; }
}

function writeRaos(dataDir: string, envId: string, raos: unknown[]): void {
  fs.writeFileSync(raoFile(dataDir, envId), JSON.stringify(raos, null, 2));
}

// ── Router factory ────────────────────────────────────────────────────────────

export function createModuleBuilderRouter(dataDir: string): Router {
  const store = new ModuleBuilderStore(path.join(dataDir, "module-builder.db"));
  const router = Router();

  /** GET /catalog */
  router.get("/catalog", (_req, res) => {
    res.json({ modules: MODULE_CATALOG, count: MODULE_CATALOG.length });
  });

  /** POST /sessions */
  router.post("/sessions", (req, res) => {
    try {
      const parsed = CreateSessionSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: "Invalid request", details: parsed.error.flatten() });
        return;
      }
      const { town, selectedModuleIds, configs } = parsed.data;
      const now = Date.now();
      const id = crypto.randomUUID();
      const row = store.create({
        id, town,
        selected_module_ids: JSON.stringify(selectedModuleIds),
        configs: JSON.stringify(configs),
        status: "draft",
        created_at: now,
        updated_at: now,
      });
      console.log(`[Vault:ModuleBuilder] Created session ${id} for ${town}`);
      res.status(201).json(rowToJson(row));
    } catch (err) {
      console.error("[Vault:ModuleBuilder] Error creating session:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  /** GET /sessions */
  router.get("/sessions", (req, res) => {
    try {
      const town = req.query.town as string | undefined;
      const rows = store.list(town);
      res.json({ sessions: rows.map(rowToJson), count: rows.length });
    } catch (err) {
      console.error("[Vault:ModuleBuilder] Error listing sessions:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  /** GET /sessions/:id */
  router.get("/sessions/:id", (req, res) => {
    try {
      const row = store.get(req.params.id);
      if (!row) { res.status(404).json({ error: "Session not found" }); return; }
      res.json(rowToJson(row));
    } catch (err) {
      res.status(500).json({ error: "Internal server error" });
    }
  });

  /** PUT /sessions/:id */
  router.put("/sessions/:id", (req, res) => {
    try {
      const row = store.get(req.params.id);
      if (!row) { res.status(404).json({ error: "Session not found" }); return; }
      if (row.status === "activated") { res.status(409).json({ error: "Activated sessions cannot be modified" }); return; }
      const parsed = UpdateSessionSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: "Invalid request", details: parsed.error.flatten() });
        return;
      }
      const now = Date.now();
      const patch: Parameters<typeof store.update>[1] = { updated_at: now };
      if (parsed.data.selectedModuleIds !== undefined) patch.selected_module_ids = JSON.stringify(parsed.data.selectedModuleIds);
      if (parsed.data.configs !== undefined) patch.configs = JSON.stringify(parsed.data.configs);
      if (parsed.data.status !== undefined) patch.status = parsed.data.status;
      store.update(req.params.id, patch);
      res.json({ ok: true, updatedAt: now });
    } catch (err) {
      res.status(500).json({ error: "Internal server error" });
    }
  });

  /** POST /sessions/:id/activate */
  router.post("/sessions/:id/activate", (req, res) => {
    try {
      const row = store.get(req.params.id);
      if (!row) { res.status(404).json({ error: "Session not found" }); return; }
      if (row.status === "activated") { res.status(409).json({ error: "Session already activated" }); return; }
      const now = Date.now();
      store.activate(req.params.id, now);
      console.log(`[Vault:ModuleBuilder] Activated session ${row.id} for ${row.town}`);
      res.json({ ok: true, activatedAt: now });
    } catch (err) {
      res.status(500).json({ error: "Internal server error" });
    }
  });

  /** GET /environments/:envId/raos */
  router.get("/environments/:envId/raos", (req, res) => {
    res.json({ envId: req.params.envId, raos: readRaos(dataDir, req.params.envId) });
  });

  /** POST /environments/:envId/raos */
  router.post("/environments/:envId/raos", (req, res) => {
    const { envId } = req.params;
    const rao = { id: crypto.randomUUID(), ...req.body, createdAt: new Date().toISOString() };
    const raos = readRaos(dataDir, envId);
    raos.push(rao);
    writeRaos(dataDir, envId, raos);
    res.status(201).json(rao);
  });

  /** PUT /environments/:envId/raos/batch */
  router.put("/environments/:envId/raos/batch", (req, res) => {
    const { envId } = req.params;
    const { raos } = req.body as { raos: unknown[] };
    if (!Array.isArray(raos)) { res.status(400).json({ error: "raos must be array" }); return; }
    writeRaos(dataDir, envId, raos);
    res.json({ envId, count: raos.length });
  });

  /** PUT /environments/:envId/raos/:raoId */
  router.put("/environments/:envId/raos/:raoId", (req, res) => {
    const { envId, raoId } = req.params;
    const raos = readRaos(dataDir, envId) as Array<{ id: string }>;
    const idx = raos.findIndex((r) => r.id === raoId);
    if (idx === -1) { res.status(404).json({ error: "RAO not found" }); return; }
    raos[idx] = { ...raos[idx], ...req.body, id: raoId, updatedAt: new Date().toISOString() };
    writeRaos(dataDir, envId, raos);
    res.json(raos[idx]);
  });

  /** DELETE /environments/:envId/raos/:raoId */
  router.delete("/environments/:envId/raos/:raoId", (req, res) => {
    const { envId, raoId } = req.params;
    const raos = readRaos(dataDir, envId) as Array<{ id: string }>;
    const filtered = raos.filter((r) => r.id !== raoId);
    if (filtered.length === raos.length) { res.status(404).json({ error: "RAO not found" }); return; }
    writeRaos(dataDir, envId, filtered);
    res.json({ deleted: raoId });
  });

  return router;
}
