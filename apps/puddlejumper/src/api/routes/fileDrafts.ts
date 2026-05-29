/**
 * Governed file draft routes.
 *
 * Drafts are stored as canon process objects in the PJ DB:
 * - process_type = CUSTOM
 * - current_state = pre_received while in draft
 * - current_state = received after submit
 * - current_state = closed after discard
 *
 * The draft schema itself lives in `processes.fields`, and every write appends
 * a canon audit event in the same database transaction.
 */

import crypto from "node:crypto";
import express from "express";
import { appendAuditEvent, type DatabaseHandle } from "@pj/db";
import { createTenant } from "@pj/org-manager";
import { getAuthContext } from "@publiclogic/core";

const PROCESS_TYPE = "CUSTOM" as const;
const FORM_TYPE = "file_editor" as const;
const CANON_VERSION = "1.0.0";
const PRE_RECEIVED_STATE = "pre_received";
const RECEIVED_STATE = "received";
const CLOSED_STATE = "closed";
const MAX_DRAFT_SIZE = 512 * 1024;

type DraftState = "working" | "ready" | "abandoned";

interface DraftPayload {
  path: string;
  content: string;
  cursorLine?: number;
  cursorCol?: number;
  baseContentHash?: string;
}

interface DraftFields {
  form_type: string;
  form_key: string;
  casespace_id: string;
  author_principal_id: string;
  draft_state: DraftState;
  payload: DraftPayload;
  path: string;
  content: string;
  cursor_line?: number;
  cursor_col?: number;
  base_content_hash?: string;
  created_at: string;
  updated_at: string;
  submitted_at?: string;
}

type ProcessRow = {
  process_id: string;
  process_type: string;
  canon_version: string;
  tenant_id: string;
  deployment_id: string;
  current_state: string;
  created_at: string;
  created_by_ref: string;
  assignee_ref: string | null;
  closed_at: string | null;
  fields: string;
  links: string;
};

function deploymentId(): string {
  return process.env.PJ_DEPLOYMENT_ID ?? "default";
}

function buildFormKey(casespaceId: string, draftId: string): string {
  return `formkey:${FORM_TYPE}:${casespaceId}:${draftId}`;
}

function parseDraftFields(row: ProcessRow): DraftFields {
  return JSON.parse(row.fields) as DraftFields;
}

function rowToDraft(row: ProcessRow) {
  const fields = parseDraftFields(row);
  return {
    draftId: row.process_id,
    formType: fields.form_type,
    formKey: fields.form_key,
    casespaceId: fields.casespace_id,
    authorPrincipalId: fields.author_principal_id,
    draftState: fields.draft_state,
    payload: fields.payload,
    path: fields.path,
    content: fields.content,
    cursorLine: fields.cursor_line,
    cursorCol: fields.cursor_col,
    baseContentHash: fields.base_content_hash,
    createdAt: fields.created_at,
    updatedAt: fields.updated_at,
    submittedAt: fields.submitted_at ?? null,
    currentState: row.current_state,
    timestamp: fields.updated_at,
    source: "server" as const,
  };
}

function auth(req: express.Request, res: express.Response) {
  const authContext = getAuthContext(req);
  const userId = authContext?.sub ?? authContext?.userId ?? "";
  const tenantId = authContext?.tenantId ?? authContext?.workspaceId ?? "";
  if (!userId || !tenantId) {
    res.status(401).json({ error: "Unauthorized" });
    return null;
  }
  return { userId, tenantId };
}

function getDraftProcess(
  db: DatabaseHandle,
  tenantId: string,
  draftId: string,
  userId: string,
): ProcessRow | undefined {
  return db
    .prepare(
      `SELECT *
         FROM processes
        WHERE process_id = ?
          AND tenant_id = ?
          AND created_by_ref = ?
          AND process_type = ?
          AND json_extract(fields, '$.form_type') = ?`,
    )
    .get(draftId, tenantId, userId, PROCESS_TYPE, FORM_TYPE) as ProcessRow | undefined;
}

function buildFields(args: {
  existing?: DraftFields;
  draftId: string;
  casespaceId: string;
  authorPrincipalId: string;
  path: string;
  content: string;
  cursorLine?: number;
  cursorCol?: number;
  baseContentHash?: string;
  draftState: DraftState;
  now: string;
  submittedAt?: string;
}): DraftFields {
  const createdAt = args.existing?.created_at ?? args.now;
  const formKey = args.existing?.form_key ?? buildFormKey(args.casespaceId, args.draftId);
  return {
    form_type: FORM_TYPE,
    form_key: formKey,
    casespace_id: args.casespaceId,
    author_principal_id: args.authorPrincipalId,
    draft_state: args.draftState,
    payload: {
      path: args.path,
      content: args.content,
      cursorLine: args.cursorLine,
      cursorCol: args.cursorCol,
      baseContentHash: args.baseContentHash,
    },
    path: args.path,
    content: args.content,
    cursor_line: args.cursorLine,
    cursor_col: args.cursorCol,
    base_content_hash: args.baseContentHash,
    created_at: createdAt,
    updated_at: args.now,
    submitted_at: args.submittedAt ?? args.existing?.submitted_at,
  };
}

function auditSummary(fields: DraftFields) {
  return {
    form_key: fields.form_key,
    form_type: fields.form_type,
    casespace_id: fields.casespace_id,
    author_principal_id: fields.author_principal_id,
    draft_state: fields.draft_state,
    path: fields.path,
    content_length: Buffer.byteLength(fields.content, "utf8"),
    updated_at: fields.updated_at,
    submitted_at: fields.submitted_at ?? null,
  };
}

function requireBodyContentSize(content: unknown, res: express.Response): content is string {
  if (typeof content !== "string") {
    res.status(400).json({ error: "content must be a string" });
    return false;
  }
  if (Buffer.byteLength(content, "utf8") > MAX_DRAFT_SIZE) {
    res.status(413).json({ error: "Draft too large (max 512 KB)" });
    return false;
  }
  return true;
}

export function createFileDraftsRouter(db: DatabaseHandle): express.Router {
  const router = express.Router();

  router.get("/files/drafts", (req, res) => {
    const ctx = auth(req, res);
    if (!ctx) return;

    const casespaceId = String(req.query.casespaceId ?? "").trim();
    const pathFilter = String(req.query.path ?? "").trim();
    if (!casespaceId) {
      res.status(400).json({ error: "casespaceId is required" });
      return;
    }

    const params: unknown[] = [ctx.tenantId, ctx.userId, PROCESS_TYPE, FORM_TYPE, casespaceId];
    const conds = [
      "tenant_id = ?",
      "created_by_ref = ?",
      "process_type = ?",
      "json_extract(fields, '$.form_type') = ?",
      "json_extract(fields, '$.casespace_id') = ?",
      "current_state = ?",
    ];
    params.push(PRE_RECEIVED_STATE);

    if (pathFilter) {
      conds.push("json_extract(fields, '$.path') = ?");
      params.push(pathFilter);
    }

    const rows = db
      .prepare(
        `SELECT *
           FROM processes
          WHERE ${conds.join(" AND ")}
          ORDER BY json_extract(fields, '$.updated_at') DESC, created_at DESC`,
      )
      .all(...params) as ProcessRow[];

    res.json({ drafts: rows.map(rowToDraft) });
  });

  router.get("/files/drafts/:draftId", (req, res) => {
    const ctx = auth(req, res);
    if (!ctx) return;

    const row = getDraftProcess(db, ctx.tenantId, req.params.draftId, ctx.userId);
    if (!row) {
      res.status(404).json({ error: "Draft not found" });
      return;
    }

    res.json(rowToDraft(row));
  });

  router.post("/files/drafts", express.json({ limit: "512kb" }), (req, res) => {
    const ctx = auth(req, res);
    if (!ctx) return;

    const casespaceId = String(req.body?.casespaceId ?? "").trim();
    const path = String(req.body?.path ?? "").trim();
    const content = req.body?.content;
    const cursorLine = typeof req.body?.cursorLine === "number" ? req.body.cursorLine : undefined;
    const cursorCol = typeof req.body?.cursorCol === "number" ? req.body.cursorCol : undefined;
    const baseContentHash = typeof req.body?.baseContentHash === "string" ? req.body.baseContentHash : undefined;
    const requestedDraftState = req.body?.draftState === "ready" ? "ready" : "working";

    if (!casespaceId || !path) {
      res.status(400).json({ error: "casespaceId and path are required" });
      return;
    }
    if (!requireBodyContentSize(content, res)) return;

    const draftId = crypto.randomUUID();
    const now = new Date().toISOString();
    const fields = buildFields({
      draftId,
      casespaceId,
      authorPrincipalId: ctx.userId,
      path,
      content,
      cursorLine,
      cursorCol,
      baseContentHash,
      draftState: requestedDraftState,
      now,
    });
    const links = JSON.stringify([{ type: "casespace", ref: casespaceId, label: "CaseSpace" }]);

    const tx = db.transaction(() => {
      createTenant(db, {
        id: ctx.tenantId,
        name: ctx.tenantId,
        canonVersion: CANON_VERSION,
      });

      db.prepare(
        `INSERT INTO processes (
           process_id, process_type, canon_version, tenant_id, deployment_id,
           current_state, created_at, created_by_ref, fields, links
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        draftId,
        PROCESS_TYPE,
        CANON_VERSION,
        ctx.tenantId,
        deploymentId(),
        PRE_RECEIVED_STATE,
        now,
        ctx.userId,
        JSON.stringify(fields),
        links,
      );

      appendAuditEvent(db, {
        event_family: "process",
        event_subtype: "draft.create",
        canon_version: CANON_VERSION,
        deployment_id: deploymentId(),
        tenant_id: ctx.tenantId,
        process_id: draftId,
        actor_ref: ctx.userId,
        occurred_at: now,
        payload: auditSummary(fields),
      });
    });
    tx();

    const created = getDraftProcess(db, ctx.tenantId, draftId, ctx.userId);
    res.status(201).json({ draft: rowToDraft(created!) });
  });

  router.put("/files/drafts/:draftId", express.json({ limit: "512kb" }), (req, res) => {
    const ctx = auth(req, res);
    if (!ctx) return;

    const existing = getDraftProcess(db, ctx.tenantId, req.params.draftId, ctx.userId);
    if (!existing) {
      res.status(404).json({ error: "Draft not found" });
      return;
    }
    if (existing.current_state !== PRE_RECEIVED_STATE) {
      res.status(409).json({ error: "Draft is no longer editable" });
      return;
    }

    const existingFields = parseDraftFields(existing);
    const path = typeof req.body?.path === "string" ? req.body.path.trim() : existingFields.path;
    const content = req.body?.content ?? existingFields.content;
    const cursorLine = typeof req.body?.cursorLine === "number" ? req.body.cursorLine : existingFields.cursor_line;
    const cursorCol = typeof req.body?.cursorCol === "number" ? req.body.cursorCol : existingFields.cursor_col;
    const baseContentHash = typeof req.body?.baseContentHash === "string"
      ? req.body.baseContentHash
      : existingFields.base_content_hash;
    const draftState = req.body?.draftState === "ready" ? "ready" : "working";

    if (!path) {
      res.status(400).json({ error: "path is required" });
      return;
    }
    if (!requireBodyContentSize(content, res)) return;

    const now = new Date().toISOString();
    const nextFields = buildFields({
      existing: existingFields,
      draftId: existing.process_id,
      casespaceId: existingFields.casespace_id,
      authorPrincipalId: existingFields.author_principal_id,
      path,
      content,
      cursorLine,
      cursorCol,
      baseContentHash,
      draftState,
      now,
    });

    const tx = db.transaction(() => {
      db.prepare(
        `UPDATE processes
            SET fields = ?
          WHERE process_id = ?
            AND tenant_id = ?
            AND created_by_ref = ?`,
      ).run(JSON.stringify(nextFields), existing.process_id, ctx.tenantId, ctx.userId);

      appendAuditEvent(db, {
        event_family: "process",
        event_subtype: "draft.update",
        canon_version: CANON_VERSION,
        deployment_id: deploymentId(),
        tenant_id: ctx.tenantId,
        process_id: existing.process_id,
        actor_ref: ctx.userId,
        occurred_at: now,
        payload: {
          form_key: nextFields.form_key,
          casespace_id: nextFields.casespace_id,
          draft_state: nextFields.draft_state,
          before: auditSummary(existingFields),
          after: auditSummary(nextFields),
        },
      });
    });
    tx();

    const updated = getDraftProcess(db, ctx.tenantId, existing.process_id, ctx.userId);
    res.json({ draft: rowToDraft(updated!) });
  });

  router.delete("/files/drafts/:draftId", (req, res) => {
    const ctx = auth(req, res);
    if (!ctx) return;

    const existing = getDraftProcess(db, ctx.tenantId, req.params.draftId, ctx.userId);
    if (!existing) {
      res.status(404).json({ error: "Draft not found" });
      return;
    }

    const existingFields = parseDraftFields(existing);
    const now = new Date().toISOString();
    const nextFields = buildFields({
      existing: existingFields,
      draftId: existing.process_id,
      casespaceId: existingFields.casespace_id,
      authorPrincipalId: existingFields.author_principal_id,
      path: existingFields.path,
      content: existingFields.content,
      cursorLine: existingFields.cursor_line,
      cursorCol: existingFields.cursor_col,
      baseContentHash: existingFields.base_content_hash,
      draftState: "abandoned",
      now,
    });

    const tx = db.transaction(() => {
      db.prepare(
        `UPDATE processes
            SET current_state = ?, closed_at = ?, fields = ?
          WHERE process_id = ?
            AND tenant_id = ?
            AND created_by_ref = ?`,
      ).run(CLOSED_STATE, now, JSON.stringify(nextFields), existing.process_id, ctx.tenantId, ctx.userId);

      appendAuditEvent(db, {
        event_family: "process",
        event_subtype: "draft.discard",
        canon_version: CANON_VERSION,
        deployment_id: deploymentId(),
        tenant_id: ctx.tenantId,
        process_id: existing.process_id,
        actor_ref: ctx.userId,
        occurred_at: now,
        payload: auditSummary(nextFields),
      });
    });
    tx();

    res.status(204).end();
  });

  router.post("/files/drafts/:draftId/submit", (req, res) => {
    const ctx = auth(req, res);
    if (!ctx) return;

    const existing = getDraftProcess(db, ctx.tenantId, req.params.draftId, ctx.userId);
    if (!existing) {
      res.status(404).json({ error: "Draft not found" });
      return;
    }
    if (existing.current_state !== PRE_RECEIVED_STATE) {
      res.status(409).json({ error: "Draft is no longer submittable" });
      return;
    }

    const existingFields = parseDraftFields(existing);
    const now = new Date().toISOString();
    const nextFields = buildFields({
      existing: existingFields,
      draftId: existing.process_id,
      casespaceId: existingFields.casespace_id,
      authorPrincipalId: existingFields.author_principal_id,
      path: existingFields.path,
      content: existingFields.content,
      cursorLine: existingFields.cursor_line,
      cursorCol: existingFields.cursor_col,
      baseContentHash: existingFields.base_content_hash,
      draftState: "ready",
      now,
      submittedAt: now,
    });

    const tx = db.transaction(() => {
      db.prepare(
        `UPDATE processes
            SET current_state = ?, fields = ?
          WHERE process_id = ?
            AND tenant_id = ?
            AND created_by_ref = ?`,
      ).run(RECEIVED_STATE, JSON.stringify(nextFields), existing.process_id, ctx.tenantId, ctx.userId);

      appendAuditEvent(db, {
        event_family: "process",
        event_subtype: "draft.submit",
        canon_version: CANON_VERSION,
        deployment_id: deploymentId(),
        tenant_id: ctx.tenantId,
        process_id: existing.process_id,
        actor_ref: ctx.userId,
        occurred_at: now,
        payload: {
          ...auditSummary(nextFields),
          from: PRE_RECEIVED_STATE,
          to: RECEIVED_STATE,
        },
      });
    });
    tx();

    const submitted = getDraftProcess(db, ctx.tenantId, existing.process_id, ctx.userId);
    res.json({ draft: rowToDraft(submitted!) });
  });

  return router;
}
