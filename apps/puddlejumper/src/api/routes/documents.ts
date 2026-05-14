// ── Vault: Documents + Files + Governance ────────────────────────────────────
//
// The Vault is the governance proof layer for LogicOS.
// Every document has a full audit trail — who created it, every edit,
// every status change, every signature. Nothing is mutable without a record.
//
// Document lifecycle:  draft → review → approved → archived
// Classification:      public | internal | confidential | restricted
//
// Routes:
//   GET    /api/documents                 list (no content, includes status)
//   GET    /api/documents/:id             full document
//   POST   /api/documents                 create (auto-logs 'created')
//   PUT    /api/documents/:id             update content (auto-logs 'edited')
//   DELETE /api/documents/:id             delete
//   PUT    /api/documents/:id/status      change lifecycle status (logs event)
//   PUT    /api/documents/:id/classify    change classification (logs event)
//   POST   /api/documents/:id/sign        sign off (logs event)
//   GET    /api/documents/:id/audit       full audit trail
//   GET    /api/documents/:id/versions    version list
//
//   GET    /api/vault-files               list files
//   GET    /api/vault-files/:id           file + base64 content
//   POST   /api/vault-files               upload
//   DELETE /api/vault-files/:id           delete

import express from "express";
import Database from "better-sqlite3";
import { getAuthContext } from "@publiclogic/core";
import { z } from "zod";
import { createHash } from "crypto";

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

const STATUSES = ["draft", "review", "approved", "archived"] as const;
const CLASSIFICATIONS = ["public", "internal", "confidential", "restricted"] as const;

export function createDocumentRoutes(opts: { dbPath: string }): express.Router {
  const db = new Database(opts.dbPath);

  db.exec(`
    CREATE TABLE IF NOT EXISTS vault_documents (
      id              TEXT PRIMARY KEY,
      tenant_id       TEXT NOT NULL,
      user_id         TEXT NOT NULL,
      name            TEXT NOT NULL,
      html            TEXT NOT NULL DEFAULT '',
      css             TEXT NOT NULL DEFAULT '',
      page_size       TEXT NOT NULL DEFAULT 'letter',
      status          TEXT NOT NULL DEFAULT 'draft',
      classification  TEXT NOT NULL DEFAULT 'internal',
      created_at      INTEGER NOT NULL,
      updated_at      INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_vdoc_owner ON vault_documents(tenant_id, user_id);

    CREATE TABLE IF NOT EXISTS vault_events (
      id           TEXT PRIMARY KEY,
      document_id  TEXT NOT NULL,
      tenant_id    TEXT NOT NULL,
      user_id      TEXT NOT NULL,
      user_name    TEXT NOT NULL DEFAULT '',
      event_type   TEXT NOT NULL,
      details      TEXT NOT NULL DEFAULT '{}',
      created_at   INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_vevent_doc ON vault_events(document_id, tenant_id, created_at);

    CREATE TABLE IF NOT EXISTS vault_signatures (
      id           TEXT PRIMARY KEY,
      document_id  TEXT NOT NULL,
      tenant_id    TEXT NOT NULL,
      user_id      TEXT NOT NULL,
      user_name    TEXT NOT NULL,
      comment      TEXT NOT NULL DEFAULT '',
      content_hash TEXT NOT NULL DEFAULT '',
      created_at   INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_vsig_doc ON vault_signatures(document_id, tenant_id);

    CREATE TABLE IF NOT EXISTS vault_versions (
      id           TEXT PRIMARY KEY,
      document_id  TEXT NOT NULL,
      tenant_id    TEXT NOT NULL,
      version_num  INTEGER NOT NULL,
      html         TEXT NOT NULL DEFAULT '',
      css          TEXT NOT NULL DEFAULT '',
      saved_by     TEXT NOT NULL DEFAULT '',
      content_hash TEXT NOT NULL DEFAULT '',
      created_at   INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_vver_doc ON vault_versions(document_id, tenant_id, version_num);

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

    CREATE TABLE IF NOT EXISTS case_tasks (
      id             TEXT PRIMARY KEY,
      document_id    TEXT NOT NULL REFERENCES vault_documents(id) ON DELETE CASCADE,
      tenant_id      TEXT NOT NULL,
      created_by     TEXT NOT NULL,
      assigned_side  TEXT NOT NULL CHECK(assigned_side IN ('A','B')),
      title          TEXT NOT NULL,
      description    TEXT NOT NULL DEFAULT '',
      status         TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open','done','cancelled')),
      source_event_id TEXT,
      due_at         TEXT,
      completed_by   TEXT,
      completed_at   TEXT,
      created_at     TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at     TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_ctask_doc ON case_tasks(document_id, tenant_id, status);
  `);

  // Idempotent schema migrations
  const migrations = [
    "ALTER TABLE vault_documents ADD COLUMN status TEXT NOT NULL DEFAULT 'draft'",
    "ALTER TABLE vault_documents ADD COLUMN classification TEXT NOT NULL DEFAULT 'internal'",
  ];
  for (const m of migrations) { try { db.exec(m) } catch {} }

  const router = express.Router();

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

  function logEvent(documentId: string, tenantId: string, userId: string, userName: string, eventType: string, details: object = {}): string {
    const eventId = crypto.randomUUID();
    db.prepare(
      "INSERT INTO vault_events VALUES (?,?,?,?,?,?,?,?)"
    ).run(eventId, documentId, tenantId, userId, userName, eventType, JSON.stringify(details), Date.now());
    return eventId;
  }

  function createTask(documentId: string, tenantId: string, createdBy: string, assignedSide: 'A' | 'B', title: string, description: string, sourceEventId?: string) {
    const taskId = crypto.randomUUID();
    db.prepare(
      `INSERT INTO case_tasks (id, document_id, tenant_id, created_by, assigned_side, title, description, source_event_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(taskId, documentId, tenantId, createdBy, assignedSide, title, description, sourceEventId ?? null);
    return taskId;
  }

  function contentHash(html: string, css: string) {
    return createHash("sha256").update(html + css).digest("hex").slice(0, 16);
  }

  function nextVersionNum(documentId: string, tenantId: string): number {
    const row = db.prepare("SELECT MAX(version_num) as n FROM vault_versions WHERE document_id=? AND tenant_id=?").get(documentId, tenantId) as { n: number | null };
    return (row?.n ?? 0) + 1;
  }

  // ── Documents ─────────────────────────────────────────────────────────────

  router.get("/documents", (req, res) => {
    const { tenantId, userId } = authOf(req);
    const rows = db.prepare(
      "SELECT id, name, page_size, status, classification, created_at, updated_at FROM vault_documents WHERE tenant_id=? AND user_id=? ORDER BY updated_at DESC"
    ).all(tenantId, userId);
    res.json({ documents: rows });
  });

  router.get("/documents/:id", (req, res) => {
    const { tenantId, userId } = authOf(req);
    const row = db.prepare("SELECT * FROM vault_documents WHERE id=? AND tenant_id=? AND user_id=?").get(req.params.id, tenantId, userId);
    if (!row) { res.status(404).json({ error: "Not found" }); return; }
    res.json(row);
  });

  router.post("/documents", (req, res) => {
    const { tenantId, userId } = authOf(req);
    const parsed = docBody.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: "Invalid body" }); return; }
    const { name = "Untitled", html = "", css = "", pageSize = "letter" } = parsed.data;
    const { userName = "" } = req.body;
    const id = crypto.randomUUID();
    const now = Date.now();
    db.prepare("INSERT INTO vault_documents VALUES (?,?,?,?,?,?,?,?,?,?,?)")
      .run(id, tenantId, userId, name, html, css, pageSize, "draft", "internal", now, now);
    logEvent(id, tenantId, userId, userName, "created", { name });
    // Save version 1
    const hash = contentHash(html, css);
    db.prepare("INSERT INTO vault_versions VALUES (?,?,?,?,?,?,?,?,?)")
      .run(crypto.randomUUID(), id, tenantId, 1, html, css, userName, hash, now);
    res.status(201).json({ id, name, page_size: pageSize, status: "draft", classification: "internal", created_at: now, updated_at: now });
  });

  router.put("/documents/:id", (req, res) => {
    const { tenantId, userId } = authOf(req);
    const parsed = docBody.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: "Invalid body" }); return; }
    const { name, html, css, pageSize } = parsed.data;
    const { userName = "" } = req.body;
    const now = Date.now();
    const info = db.prepare(
      "UPDATE vault_documents SET name=COALESCE(?,name), html=COALESCE(?,html), css=COALESCE(?,css), page_size=COALESCE(?,page_size), updated_at=? WHERE id=? AND tenant_id=? AND user_id=?"
    ).run(name ?? null, html ?? null, css ?? null, pageSize ?? null, now, req.params.id, tenantId, userId);
    if ((info as any).changes === 0) { res.status(404).json({ error: "Not found" }); return; }

    // Save a version snapshot if content changed
    if (html !== undefined || css !== undefined) {
      const doc = db.prepare("SELECT html, css FROM vault_documents WHERE id=?").get(req.params.id) as { html: string; css: string } | undefined;
      if (doc) {
        const hash = contentHash(doc.html, doc.css);
        const vn = nextVersionNum(req.params.id, tenantId);
        db.prepare("INSERT INTO vault_versions VALUES (?,?,?,?,?,?,?,?,?)")
          .run(crypto.randomUUID(), req.params.id, tenantId, vn, doc.html, doc.css, userName, hash, now);
      }
    }
    logEvent(req.params.id, tenantId, userId, userName, "edited", name ? { name } : {});
    res.json({ ok: true, updated_at: now });
  });

  router.delete("/documents/:id", (req, res) => {
    const { tenantId, userId } = authOf(req);
    db.prepare("DELETE FROM vault_documents WHERE id=? AND tenant_id=? AND user_id=?").run(req.params.id, tenantId, userId);
    db.prepare("DELETE FROM vault_events WHERE document_id=? AND tenant_id=?").run(req.params.id, tenantId);
    db.prepare("DELETE FROM vault_signatures WHERE document_id=? AND tenant_id=?").run(req.params.id, tenantId);
    db.prepare("DELETE FROM vault_versions WHERE document_id=? AND tenant_id=?").run(req.params.id, tenantId);
    res.json({ ok: true });
  });

  // ── Governance: Status ────────────────────────────────────────────────────

  router.put("/documents/:id/status", (req, res) => {
    const { tenantId, userId } = authOf(req);
    const { status, userName = "" } = req.body;
    if (!STATUSES.includes(status)) { res.status(400).json({ error: "Invalid status" }); return; }
    const doc = db.prepare("SELECT status FROM vault_documents WHERE id=? AND tenant_id=? AND user_id=?").get(req.params.id, tenantId, userId) as { status: string } | undefined;
    if (!doc) { res.status(404).json({ error: "Not found" }); return; }
    const now = Date.now();
    db.prepare("UPDATE vault_documents SET status=?, updated_at=? WHERE id=? AND tenant_id=? AND user_id=?").run(status, now, req.params.id, tenantId, userId);
    const eventId = logEvent(req.params.id, tenantId, userId, userName, "status_changed", { from: doc.status, to: status });
    // When transitioning to "review", issue a deficiency and auto-create a Side B task for the applicant
    if (status === "review") {
      const defEventId = logEvent(req.params.id, tenantId, userId, userName, "deficiency_issued", { from: doc.status });
      createTask(req.params.id, tenantId, userId, 'B',
        'Respond to reviewer deficiency',
        'A reviewer has requested additional information or changes. Please review and respond.',
        defEventId
      );
    }
    res.json({ ok: true, status, updated_at: now });
  });

  // ── Governance: Classification ────────────────────────────────────────────

  router.put("/documents/:id/classify", (req, res) => {
    const { tenantId, userId } = authOf(req);
    const { classification, userName = "" } = req.body;
    if (!CLASSIFICATIONS.includes(classification)) { res.status(400).json({ error: "Invalid classification" }); return; }
    const doc = db.prepare("SELECT classification FROM vault_documents WHERE id=? AND tenant_id=? AND user_id=?").get(req.params.id, tenantId, userId) as { classification: string } | undefined;
    if (!doc) { res.status(404).json({ error: "Not found" }); return; }
    db.prepare("UPDATE vault_documents SET classification=?, updated_at=? WHERE id=? AND tenant_id=? AND user_id=?").run(classification, Date.now(), req.params.id, tenantId, userId);
    logEvent(req.params.id, tenantId, userId, userName, "classified", { from: doc.classification, to: classification });
    res.json({ ok: true, classification });
  });

  // ── Governance: Signatures ────────────────────────────────────────────────

  router.post("/documents/:id/sign", (req, res) => {
    const { tenantId, userId } = authOf(req);
    const { userName = "", comment = "" } = req.body;
    // Check doc exists and belongs to tenant
    const doc = db.prepare("SELECT html, css FROM vault_documents WHERE id=? AND tenant_id=?").get(req.params.id, tenantId) as { html: string; css: string } | undefined;
    if (!doc) { res.status(404).json({ error: "Not found" }); return; }
    // Prevent duplicate signature from same user
    const existing = db.prepare("SELECT id FROM vault_signatures WHERE document_id=? AND tenant_id=? AND user_id=?").get(req.params.id, tenantId, userId);
    if (existing) { res.status(409).json({ error: "Already signed" }); return; }
    const hash = contentHash(doc.html, doc.css);
    const now = Date.now();
    const sigId = crypto.randomUUID();
    db.prepare("INSERT INTO vault_signatures VALUES (?,?,?,?,?,?,?,?)").run(sigId, req.params.id, tenantId, userId, userName, comment, hash, now);
    const signedEventId = logEvent(req.params.id, tenantId, userId, userName, "signed", { comment, hash });
    // Auto-create a Side A task for the reviewer to review the applicant's signature
    createTask(req.params.id, tenantId, userId, 'A',
      'Review applicant signature',
      'Applicant has signed the document. Please review and take action.',
      signedEventId
    );
    res.status(201).json({ id: sigId, user_name: userName, comment, content_hash: hash, created_at: now });
  });

  router.get("/documents/:id/signatures", (req, res) => {
    const { tenantId } = authOf(req);
    const rows = db.prepare("SELECT id, user_id, user_name, comment, content_hash, created_at FROM vault_signatures WHERE document_id=? AND tenant_id=? ORDER BY created_at ASC").all(req.params.id, tenantId);
    res.json({ signatures: rows });
  });

  // ── Governance: Audit trail ───────────────────────────────────────────────

  router.get("/documents/:id/audit", (req, res) => {
    const { tenantId } = authOf(req);
    const events = db.prepare(
      "SELECT id, user_id, user_name, event_type, details, created_at FROM vault_events WHERE document_id=? AND tenant_id=? ORDER BY created_at ASC"
    ).all(req.params.id, tenantId);
    const sigs = db.prepare(
      "SELECT id, user_id, user_name, comment, content_hash, created_at FROM vault_signatures WHERE document_id=? AND tenant_id=? ORDER BY created_at ASC"
    ).all(req.params.id, tenantId);
    res.json({ events, signatures: sigs });
  });

  // ── Governance: Version history ───────────────────────────────────────────

  router.get("/documents/:id/versions", (req, res) => {
    const { tenantId } = authOf(req);
    const rows = db.prepare(
      "SELECT id, version_num, saved_by, content_hash, created_at FROM vault_versions WHERE document_id=? AND tenant_id=? ORDER BY version_num DESC"
    ).all(req.params.id, tenantId);
    res.json({ versions: rows });
  });

  router.get("/documents/:id/versions/:versionId", (req, res) => {
    const { tenantId } = authOf(req);
    const row = db.prepare("SELECT * FROM vault_versions WHERE id=? AND document_id=? AND tenant_id=?").get(req.params.versionId, req.params.id, tenantId);
    if (!row) { res.status(404).json({ error: "Not found" }); return; }
    res.json(row);
  });

  // ── Vault files ───────────────────────────────────────────────────────────

  router.get("/vault-files", (req, res) => {
    const { tenantId, userId } = authOf(req);
    const rows = db.prepare("SELECT id, name, mime_type, size, created_at FROM vault_files WHERE tenant_id=? AND user_id=? ORDER BY created_at DESC").all(tenantId, userId);
    res.json({ files: rows });
  });

  router.get("/vault-files/:id", (req, res) => {
    const { tenantId, userId } = authOf(req);
    const row = db.prepare("SELECT * FROM vault_files WHERE id=? AND tenant_id=? AND user_id=?").get(req.params.id, tenantId, userId);
    if (!row) { res.status(404).json({ error: "Not found" }); return; }
    res.json(row);
  });

  router.post("/vault-files", (req, res) => {
    const { tenantId, userId } = authOf(req);
    const parsed = fileBody.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: "Invalid body" }); return; }
    const { name, mimeType, size, contentBase64 } = parsed.data;
    const id = crypto.randomUUID();
    const now = Date.now();
    db.prepare("INSERT INTO vault_files VALUES (?,?,?,?,?,?,?,?)").run(id, tenantId, userId, name, mimeType, size, contentBase64, now);
    res.status(201).json({ id, name, mime_type: mimeType, size, created_at: now });
  });

  router.delete("/vault-files/:id", (req, res) => {
    const { tenantId, userId } = authOf(req);
    db.prepare("DELETE FROM vault_files WHERE id=? AND tenant_id=? AND user_id=?").run(req.params.id, tenantId, userId);
    res.json({ ok: true });
  });

  // ── Case Tasks ────────────────────────────────────────────────────────────

  router.get("/documents/:id/tasks", (req, res) => {
    const { tenantId } = authOf(req);
    const doc = db.prepare("SELECT id FROM vault_documents WHERE id=? AND tenant_id=?").get(req.params.id, tenantId);
    if (!doc) { res.status(404).json({ error: "Not found" }); return; }
    let sql = "SELECT * FROM case_tasks WHERE document_id=? AND tenant_id=?";
    const params: string[] = [req.params.id, tenantId];
    if (req.query.side === 'A' || req.query.side === 'B') { sql += " AND assigned_side=?"; params.push(req.query.side); }
    if (req.query.status === 'open' || req.query.status === 'done' || req.query.status === 'cancelled') { sql += " AND status=?"; params.push(req.query.status as string); }
    sql += " ORDER BY created_at ASC";
    const tasks = db.prepare(sql).all(...params);
    res.json({ tasks });
  });

  router.post("/documents/:id/tasks", (req, res) => {
    const { tenantId, userId } = authOf(req);
    const doc = db.prepare("SELECT id FROM vault_documents WHERE id=? AND tenant_id=?").get(req.params.id, tenantId);
    if (!doc) { res.status(404).json({ error: "Not found" }); return; }
    const parsed = z.object({
      assignedSide: z.enum(['A', 'B']),
      title: z.string().trim().min(1).max(255),
      description: z.string().optional(),
      dueAt: z.string().optional(),
    }).safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: "Invalid body" }); return; }
    const { assignedSide, title, description = '', dueAt } = parsed.data;
    const taskId = crypto.randomUUID();
    db.prepare(
      `INSERT INTO case_tasks (id, document_id, tenant_id, created_by, assigned_side, title, description, due_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(taskId, req.params.id, tenantId, userId, assignedSide, title, description, dueAt ?? null);
    const task = db.prepare("SELECT * FROM case_tasks WHERE id=?").get(taskId);
    res.status(201).json({ task });
  });

  router.put("/documents/:id/tasks/:taskId", (req, res) => {
    const { tenantId, userId } = authOf(req);
    const doc = db.prepare("SELECT id FROM vault_documents WHERE id=? AND tenant_id=?").get(req.params.id, tenantId);
    if (!doc) { res.status(404).json({ error: "Not found" }); return; }
    const task = db.prepare("SELECT * FROM case_tasks WHERE id=? AND document_id=? AND tenant_id=?").get(req.params.taskId, req.params.id, tenantId);
    if (!task) { res.status(404).json({ error: "Task not found" }); return; }
    const parsed = z.object({
      status: z.enum(['done', 'cancelled']).optional(),
      title: z.string().trim().min(1).max(255).optional(),
      description: z.string().optional(),
    }).safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: "Invalid body" }); return; }
    const { status, title, description } = parsed.data;
    const now = new Date().toISOString();
    const completedBy = status === 'done' ? userId : null;
    const completedAt = status === 'done' ? now : null;
    db.prepare(
      `UPDATE case_tasks SET
         status=COALESCE(?,status),
         title=COALESCE(?,title),
         description=COALESCE(?,description),
         completed_by=COALESCE(?,completed_by),
         completed_at=COALESCE(?,completed_at),
         updated_at=?
       WHERE id=? AND document_id=? AND tenant_id=?`
    ).run(status ?? null, title ?? null, description ?? null, completedBy, completedAt, now, req.params.taskId, req.params.id, tenantId);
    const updated = db.prepare("SELECT * FROM case_tasks WHERE id=?").get(req.params.taskId);
    res.json({ task: updated });
  });

  return router;
}

