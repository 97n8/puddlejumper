/**
 * File Draft API — lightweight server-side draft persistence for the LogicOS file editor.
 *
 * Routes (all require auth):
 *   GET    /api/files/drafts/:draftId   — load a draft
 *   POST   /api/files/drafts            — upsert a draft
 *   DELETE /api/files/drafts/:draftId   — delete a draft
 *
 * Storage: SQLite table in the vault database (same DB as documents).
 * Drafts are per-user and expire after 30 days.
 */

import express from "express";
import Database from "better-sqlite3";
import { getAuthContext } from "@publiclogic/core";

const DRAFT_TTL_DAYS = 30;
const DRAFT_TTL_MS = DRAFT_TTL_DAYS * 24 * 60 * 60 * 1000;
const MAX_DRAFT_SIZE = 512 * 1024; // 512 KB

function ensureTable(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS file_drafts (
      draft_id    TEXT    NOT NULL,
      user_id     TEXT    NOT NULL,
      tenant_id   TEXT    NOT NULL,
      path        TEXT    NOT NULL,
      content     TEXT    NOT NULL,
      cursor_line INTEGER,
      cursor_col  INTEGER,
      base_hash   TEXT,
      saved_at    INTEGER NOT NULL,
      PRIMARY KEY (draft_id, user_id, tenant_id)
    );
    CREATE INDEX IF NOT EXISTS idx_file_drafts_user
      ON file_drafts (tenant_id, user_id, saved_at);
  `);
}

export function createFileDraftsRouter(db: Database.Database): express.Router {
  ensureTable(db);

  const router = express.Router();

  function auth(req: express.Request, res: express.Response) {
    const a = getAuthContext(req);
    if (!a) {
      res.status(401).json({ error: "Unauthorized" });
      return null;
    }
    return {
      userId: a.sub ?? a.userId ?? "",
      tenantId: a.tenantId ?? a.workspaceId ?? "",
    };
  }

  // GET /api/files/drafts/:draftId
  router.get("/files/drafts/:draftId", (req, res) => {
    const ctx = auth(req, res);
    if (!ctx) return;
    const cutoff = Date.now() - DRAFT_TTL_MS;
    const row = db
      .prepare(
        "SELECT * FROM file_drafts WHERE draft_id=? AND user_id=? AND tenant_id=? AND saved_at > ?",
      )
      .get(req.params.draftId, ctx.userId, ctx.tenantId, cutoff) as Record<string, unknown> | undefined;
    if (!row) { res.status(404).json({ error: "Draft not found" }); return; }
    res.json({
      draftId: row.draft_id,
      userId: row.user_id,
      path: row.path,
      content: row.content,
      cursorLine: row.cursor_line ?? undefined,
      cursorCol: row.cursor_col ?? undefined,
      baseContentHash: row.base_hash ?? undefined,
      timestamp: new Date(row.saved_at as number).toISOString(),
      source: "server",
    });
  });

  // POST /api/files/drafts
  router.post("/files/drafts", express.json({ limit: "512kb" }), (req, res) => {
    const ctx = auth(req, res);
    if (!ctx) return;
    const { draftId, path, content, cursorLine, cursorCol, baseContentHash } = req.body ?? {};
    if (!draftId || !path || typeof content !== "string") {
      res.status(400).json({ error: "draftId, path, and content are required" });
      return;
    }
    if (Buffer.byteLength(content, "utf8") > MAX_DRAFT_SIZE) {
      res.status(413).json({ error: "Draft too large (max 512 KB)" });
      return;
    }
    const now = Date.now();
    db.prepare(`
      INSERT INTO file_drafts (draft_id, user_id, tenant_id, path, content, cursor_line, cursor_col, base_hash, saved_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT (draft_id, user_id, tenant_id) DO UPDATE SET
        path        = excluded.path,
        content     = excluded.content,
        cursor_line = excluded.cursor_line,
        cursor_col  = excluded.cursor_col,
        base_hash   = excluded.base_hash,
        saved_at    = excluded.saved_at
    `).run(
      draftId, ctx.userId, ctx.tenantId, path, content,
      cursorLine ?? null, cursorCol ?? null, baseContentHash ?? null, now,
    );
    res.status(204).end();
  });

  // DELETE /api/files/drafts/:draftId
  router.delete("/files/drafts/:draftId", (req, res) => {
    const ctx = auth(req, res);
    if (!ctx) return;
    db.prepare(
      "DELETE FROM file_drafts WHERE draft_id=? AND user_id=? AND tenant_id=?",
    ).run(req.params.draftId, ctx.userId, ctx.tenantId);
    res.status(204).end();
  });

  return router;
}
