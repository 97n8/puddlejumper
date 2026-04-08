// ── ARCHIEVE Rules Ingestion API ─────────────────────────────────────────────
//
// Stores compliance rules (AI-parsed or manual) and logs each mutation to the
// ARCHIEVE hash chain so that rule provenance is tamper-evident.
//
// Routes:
//   GET    /api/rules               list rules for caller's tenant
//   GET    /api/rules/:id           get single rule
//   POST   /api/rules               ingest / create a rule
//   PUT    /api/rules/:id/status    update status (active | archived)
//   DELETE /api/rules/:id           soft-delete (sets status = archived)

import crypto from 'node:crypto';
import express from 'express';
import type Database from 'better-sqlite3';
import { getAuthContext, requireAuthenticated } from '@publiclogic/core';
import { z } from 'zod';
import { archieveLog } from '../../archieve/index.js';
import { ArchieveEventType } from '../../archieve/event-catalog.js';

// ── Types ────────────────────────────────────────────────────────────────────

export interface ArchieveRule {
  id: string;
  tenant_id: string;
  rule_id: string;
  title: string;
  description: string;
  jurisdiction: string;
  category: string;
  conditions: string; // JSON
  actions: string;    // JSON
  version: number;
  status: string;
  source: string;
  ai_confidence: number | null;
  created_by: string;
  archieve_event_id: string | null;
  created_at: string;
  updated_at: string;
}

// ── Zod schema ───────────────────────────────────────────────────────────────

const ruleBody = z.object({
  ruleId: z.string().trim().min(1).max(100),
  title: z.string().trim().min(1).max(255),
  description: z.string().trim().min(1),
  jurisdiction: z.string().optional().default(''),
  category: z.enum(['permit', 'license', 'compliance', 'zoning', 'grant', 'general']).default('general'),
  conditions: z.array(z.object({
    field: z.string(),
    operator: z.enum(['equals', 'not_equals', 'gt', 'lt', 'gte', 'lte', 'contains', 'in']),
    value: z.unknown(),
  })).default([]),
  actions: z.array(z.object({
    type: z.enum(['require', 'notify', 'block', 'allow', 'escalate']),
    object: z.string(),
    dueDays: z.number().optional(),
  })).default([]),
  status: z.enum(['draft', 'active']).default('draft'),
  source: z.enum(['manual', 'ai', 'imported']).default('manual'),
  aiConfidence: z.number().min(0).max(1).optional(),
});

// ── Factory ──────────────────────────────────────────────────────────────────

export function createRulesRoutes(opts: { db: Database.Database }): express.Router {
  const { db } = opts;

  db.exec(`
    CREATE TABLE IF NOT EXISTS archieve_rules (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL,
      rule_id TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      jurisdiction TEXT NOT NULL DEFAULT '',
      category TEXT NOT NULL DEFAULT 'general',
      conditions TEXT NOT NULL DEFAULT '[]',
      actions TEXT NOT NULL DEFAULT '[]',
      version INTEGER NOT NULL DEFAULT 1,
      status TEXT NOT NULL DEFAULT 'draft',
      source TEXT NOT NULL DEFAULT 'manual',
      ai_confidence REAL,
      created_by TEXT NOT NULL,
      archieve_event_id TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(tenant_id, rule_id, version)
    );
    CREATE INDEX IF NOT EXISTS idx_arules_tenant ON archieve_rules(tenant_id, status, category);
  `);

  const router = express.Router();

  router.use(requireAuthenticated());

  function auth(req: express.Request) {
    const ctx = getAuthContext(req)!;
    return {
      tenantId: ctx.tenantId ?? '',
      userId: ctx.userId ?? (ctx as any).sub ?? '',
      role: (ctx.role as string) ?? 'user',
    };
  }

  // ── GET /api/rules ────────────────────────────────────────────────────────

  router.get('/rules', (req, res) => {
    const { tenantId } = auth(req);
    const { status, category, jurisdiction } = req.query as Record<string, string | undefined>;

    let sql = 'SELECT * FROM archieve_rules WHERE tenant_id=?';
    const params: unknown[] = [tenantId];

    if (status) { sql += ' AND status=?'; params.push(status); }
    if (category) { sql += ' AND category=?'; params.push(category); }
    if (jurisdiction) { sql += ' AND jurisdiction=?'; params.push(jurisdiction); }

    sql += ' ORDER BY created_at DESC';

    const rules = db.prepare(sql).all(...params) as ArchieveRule[];
    res.json({ rules });
  });

  // ── GET /api/rules/:id ────────────────────────────────────────────────────

  router.get('/rules/:id', (req, res) => {
    const { tenantId } = auth(req);
    const rule = db.prepare(
      'SELECT * FROM archieve_rules WHERE id=? AND tenant_id=?'
    ).get(req.params.id, tenantId) as ArchieveRule | undefined;

    if (!rule) { res.status(404).json({ error: 'Not found' }); return; }
    res.json({ rule });
  });

  // ── POST /api/rules ───────────────────────────────────────────────────────

  router.post('/rules', (req, res) => {
    const { tenantId, userId, role } = auth(req);
    const parsed = ruleBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid body', details: parsed.error.issues });
      return;
    }

    const {
      ruleId, title, description, jurisdiction, category,
      conditions, actions, status, source, aiConfidence,
    } = parsed.data;

    // Determine next version (increment if rule_id already exists for this tenant)
    const existing = db.prepare(
      'SELECT MAX(version) as max_v FROM archieve_rules WHERE tenant_id=? AND rule_id=?'
    ).get(tenantId, ruleId) as { max_v: number | null };
    const version = (existing?.max_v ?? 0) + 1;

    const id = crypto.randomUUID();
    const requestId = crypto.randomUUID();

    // Log to ARCHIEVE first so we can attach the eventId
    let archieveEventId: string | null = null;
    try {
      const event = archieveLog({
        requestId,
        tenantId,
        module: 'rules',
        eventType: ArchieveEventType.ARCHIEVE_RULE_INGESTED,
        actor: { userId, role, sessionId: requestId },
        severity: 'info',
        data: { ruleId, title, version, jurisdiction, category, source },
      });
      archieveEventId = event.eventId ?? null;
    } catch (err) {
      console.warn('[rules] archieveLog ARCHIEVE_RULE_INGESTED failed:', (err as Error).message);
    }

    const now = new Date().toISOString();
    db.prepare(`
      INSERT INTO archieve_rules
        (id, tenant_id, rule_id, title, description, jurisdiction, category,
         conditions, actions, version, status, source, ai_confidence,
         created_by, archieve_event_id, created_at, updated_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    `).run(
      id, tenantId, ruleId, title, description, jurisdiction, category,
      JSON.stringify(conditions), JSON.stringify(actions),
      version, status, source, aiConfidence ?? null,
      userId, archieveEventId, now, now,
    );

    const rule = db.prepare('SELECT * FROM archieve_rules WHERE id=?').get(id) as ArchieveRule;
    res.status(201).json({ rule, archieveEventId });
  });

  // ── PUT /api/rules/:id/status ─────────────────────────────────────────────

  router.put('/rules/:id/status', (req, res) => {
    const { tenantId, userId, role } = auth(req);
    const statusSchema = z.object({ status: z.enum(['active', 'archived']) });
    const parsed = statusSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'status must be "active" or "archived"' });
      return;
    }

    const rule = db.prepare(
      'SELECT * FROM archieve_rules WHERE id=? AND tenant_id=?'
    ).get(req.params.id, tenantId) as ArchieveRule | undefined;
    if (!rule) { res.status(404).json({ error: 'Not found' }); return; }

    const { status } = parsed.data;
    const now = new Date().toISOString();
    db.prepare(
      'UPDATE archieve_rules SET status=?, updated_at=? WHERE id=? AND tenant_id=?'
    ).run(status, now, req.params.id, tenantId);

    const requestId = crypto.randomUUID();
    try {
      archieveLog({
        requestId,
        tenantId,
        module: 'rules',
        eventType: ArchieveEventType.ARCHIEVE_RULE_STATUS_CHANGED,
        actor: { userId, role, sessionId: requestId },
        severity: 'info',
        data: { ruleId: rule.rule_id, status },
      });
    } catch (err) {
      console.warn('[rules] archieveLog ARCHIEVE_RULE_STATUS_CHANGED failed:', (err as Error).message);
    }

    res.json({ ok: true, status, updated_at: now });
  });

  // ── DELETE /api/rules/:id (soft delete) ───────────────────────────────────

  router.delete('/rules/:id', (req, res) => {
    const { tenantId, userId, role } = auth(req);
    const rule = db.prepare(
      'SELECT * FROM archieve_rules WHERE id=? AND tenant_id=?'
    ).get(req.params.id, tenantId) as ArchieveRule | undefined;
    if (!rule) { res.status(404).json({ error: 'Not found' }); return; }

    const now = new Date().toISOString();
    db.prepare(
      'UPDATE archieve_rules SET status=?, updated_at=? WHERE id=? AND tenant_id=?'
    ).run('archived', now, req.params.id, tenantId);

    const requestId = crypto.randomUUID();
    try {
      archieveLog({
        requestId,
        tenantId,
        module: 'rules',
        eventType: ArchieveEventType.ARCHIEVE_RULE_ARCHIVED,
        actor: { userId, role, sessionId: requestId },
        severity: 'info',
        data: { ruleId: rule.rule_id },
      });
    } catch (err) {
      console.warn('[rules] archieveLog ARCHIEVE_RULE_ARCHIVED failed:', (err as Error).message);
    }

    res.json({ ok: true });
  });

  return router;
}
