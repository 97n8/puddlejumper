// ── Vault: Documents + Files ──────────────────────────────────────────────────
//
// Server-side storage for LogicOS Vault (Docs + Files).
// All content is stored in the PJ SQLite database, scoped to tenant+user.
// This keeps IP-sensitive document content off the browser.
//
// Routes:
//   GET    /api/documents            list user's documents (no content)
//   GET    /api/documents/:id        get full document with html/css
//   POST   /api/documents            create document
//   PUT    /api/documents/:id        update document (partial patch)
//   DELETE /api/documents/:id        delete document
//
//   GET    /api/vault-files          list user's uploaded files (no content)
//   GET    /api/vault-files/:id      get file with base64 content
//   POST   /api/vault-files          upload file (body: name, mimeType, contentBase64)
//   DELETE /api/vault-files/:id      delete file

import express from "express";
import Database from "better-sqlite3";
import { getAuthContext } from "@publiclogic/core";
import { z } from "zod";

const docBody = z.object({
  name: z.string().trim().min(1).max(255).optional(),
  html: z.string().optional(),
  css: z.string().optional(),
  pageSize: z.enum(["free", "letter", "a4", "legal", "slide", "square"]).optional(),
});

const fileBody = z.object({
  name: z.string().trim().min(1).max(255),
  mimeType: z.string().min(1).max(128),
  size: z.number().int().nonnegative(),
  contentBase64: z.string(),
});

export function createDocumentRoutes(opts: { dbPath: string }): express.Router {
  const db = new Database(opts.dbPath);

  db.exec(`
    CREATE TABLE IF NOT EXISTS vault_documents (
      id          TEXT PRIMARY KEY,
      tenant_id   TEXT NOT NULL,
      user_id     TEXT NOT NULL,
      name        TEXT NOT NULL,
      html        TEXT NOT NULL DEFAULT '',
      css         TEXT NOT NULL DEFAULT '',
      page_size   TEXT NOT NULL DEFAULT 'letter',
      created_at  INTEGER NOT NULL,
      updated_at  INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_vdoc_owner ON vault_documents(tenant_id, user_id);

    CREATE TABLE IF NOT EXISTS vault_files (
      id           TEXT PRIMARY KEY,
      tenant_id    TEXT NOT NULL,
      user_id      TEXT NOT NULL,
      name         TEXT NOT NULL,
      mime_type    TEXT NOT NULL,
      size         INTEGER NOT NULL,
      content_b64  TEXT NOT NULL,
      created_at   INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_vfile_owner ON vault_files(tenant_id, user_id);
  `);

  const router = express.Router();

  // ── Auth guard ────────────────────────────────────────────────────────────
  router.use((req, res, next) => {
    const auth = getAuthContext(req);
    if (!auth) { res.status(401).json({ error: "Unauthorized" }); return; }
    (req as any)._auth = auth;
    next();
  });

  function authOf(req: express.Request) {
    const a = (req as any)._auth;
    return { tenantId: a.tenantId ?? "", userId: a.userId ?? a.sub ?? "" };
  }

  // ── Documents ─────────────────────────────────────────────────────────────

  router.get("/documents", (req, res) => {
    const { tenantId, userId } = authOf(req);
    const rows = db.prepare(
      "SELECT id, name, page_size, created_at, updated_at FROM vault_documents WHERE tenant_id=? AND user_id=? ORDER BY updated_at DESC"
    ).all(tenantId, userId);
    res.json({ documents: rows });
  });

  router.get("/documents/:id", (req, res) => {
    const { tenantId, userId } = authOf(req);
    const row = db.prepare(
      "SELECT * FROM vault_documents WHERE id=? AND tenant_id=? AND user_id=?"
    ).get(req.params.id, tenantId, userId);
    if (!row) { res.status(404).json({ error: "Not found" }); return; }
    res.json(row);
  });

  router.post("/documents", (req, res) => {
    const { tenantId, userId } = authOf(req);
    const parsed = docBody.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: "Invalid body", detail: parsed.error.flatten() }); return; }
    const { name = "Untitled", html = "", css = "", pageSize = "letter" } = parsed.data;
    const id = crypto.randomUUID();
    const now = Date.now();
    db.prepare(
      "INSERT INTO vault_documents VALUES (?,?,?,?,?,?,?,?,?)"
    ).run(id, tenantId, userId, name, html, css, pageSize, now, now);
    res.status(201).json({ id, name, page_size: pageSize, created_at: now, updated_at: now });
  });

  router.put("/documents/:id", (req, res) => {
    const { tenantId, userId } = authOf(req);
    const parsed = docBody.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: "Invalid body", detail: parsed.error.flatten() }); return; }
    const { name, html, css, pageSize } = parsed.data;
    const now = Date.now();
    const info = db.prepare(
      "UPDATE vault_documents SET name=COALESCE(?,name), html=COALESCE(?,html), css=COALESCE(?,css), page_size=COALESCE(?,page_size), updated_at=? WHERE id=? AND tenant_id=? AND user_id=?"
    ).run(name ?? null, html ?? null, css ?? null, pageSize ?? null, now, req.params.id, tenantId, userId);
    if ((info as any).changes === 0) { res.status(404).json({ error: "Not found" }); return; }
    res.json({ ok: true, updated_at: now });
  });

  router.delete("/documents/:id", (req, res) => {
    const { tenantId, userId } = authOf(req);
    db.prepare("DELETE FROM vault_documents WHERE id=? AND tenant_id=? AND user_id=?")
      .run(req.params.id, tenantId, userId);
    res.json({ ok: true });
  });

  // ── Vault files ───────────────────────────────────────────────────────────

  router.get("/vault-files", (req, res) => {
    const { tenantId, userId } = authOf(req);
    const rows = db.prepare(
      "SELECT id, name, mime_type, size, created_at FROM vault_files WHERE tenant_id=? AND user_id=? ORDER BY created_at DESC"
    ).all(tenantId, userId);
    res.json({ files: rows });
  });

  router.get("/vault-files/:id", (req, res) => {
    const { tenantId, userId } = authOf(req);
    const row = db.prepare(
      "SELECT * FROM vault_files WHERE id=? AND tenant_id=? AND user_id=?"
    ).get(req.params.id, tenantId, userId);
    if (!row) { res.status(404).json({ error: "Not found" }); return; }
    res.json(row);
  });

  router.post("/vault-files", (req, res) => {
    const { tenantId, userId } = authOf(req);
    const parsed = fileBody.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: "Invalid body", detail: parsed.error.flatten() }); return; }
    const { name, mimeType, size, contentBase64 } = parsed.data;
    const id = crypto.randomUUID();
    const now = Date.now();
    db.prepare("INSERT INTO vault_files VALUES (?,?,?,?,?,?,?,?)")
      .run(id, tenantId, userId, name, mimeType, size, contentBase64, now);
    res.status(201).json({ id, name, mime_type: mimeType, size, created_at: now });
  });

  router.delete("/vault-files/:id", (req, res) => {
    const { tenantId, userId } = authOf(req);
    db.prepare("DELETE FROM vault_files WHERE id=? AND tenant_id=? AND user_id=?")
      .run(req.params.id, tenantId, userId);
    res.json({ ok: true });
  });

  return router;
}
