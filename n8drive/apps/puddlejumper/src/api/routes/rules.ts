// ── ARCHIEVE Rules Ingestion API ─────────────────────────────────────────────
//
// Stores compliance rules (AI-parsed or manual) and logs each mutation to the
// ARCHIEVE hash chain so that rule provenance is tamper-evident.
//
// Routes:
//   GET    /api/rules                    list rules for caller's tenant
//   GET    /api/rules/pending            list rules awaiting approval
//   GET    /api/rules/recommendations    surface AI rule suggestions from discovery history
//   GET    /api/rules/:id               get single rule
//   POST   /api/rules                   ingest / create a rule
//   POST   /api/rules/:id/approve       approve or reject a pending rule
//   PUT    /api/rules/:id/status        update status (active | archived)
//   DELETE /api/rules/:id               soft-delete (sets status = archived)

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
  approved_by: string | null;
  approved_at: string | null;
  rejection_reason: string | null;
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
  status: z.enum(['draft', 'pending', 'active', 'archived']).default('draft'),
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
      approved_by TEXT,
      approved_at TEXT,
      rejection_reason TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(tenant_id, rule_id, version)
    );
    CREATE INDEX IF NOT EXISTS idx_arules_tenant ON archieve_rules(tenant_id, status, category);
    -- Migrate: add approval columns if they don't yet exist (safe on re-start)
    ALTER TABLE archieve_rules ADD COLUMN IF NOT EXISTS approved_by TEXT;
    ALTER TABLE archieve_rules ADD COLUMN IF NOT EXISTS approved_at TEXT;
    ALTER TABLE archieve_rules ADD COLUMN IF NOT EXISTS rejection_reason TEXT;
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

  // ── GET /api/rules/pending ────────────────────────────────────────────────

  router.get('/rules/pending', (req, res) => {
    const { tenantId } = auth(req);
    const rules = db.prepare(
      `SELECT * FROM archieve_rules WHERE tenant_id=? AND status='pending' ORDER BY created_at ASC`
    ).all(tenantId) as ArchieveRule[];
    res.json({ rules });
  });

  // ── POST /api/rules/:id/approve ───────────────────────────────────────────

  router.post('/rules/:id/approve', (req, res) => {
    const { tenantId, userId, role } = auth(req);
    const approveSchema = z.object({
      approve: z.boolean(),
      rejectionReason: z.string().optional(),
    });
    const parsed = approveSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Body must have { approve: boolean }' });
      return;
    }

    const rule = db.prepare(
      'SELECT * FROM archieve_rules WHERE id=? AND tenant_id=?'
    ).get(req.params.id, tenantId) as ArchieveRule | undefined;
    if (!rule) { res.status(404).json({ error: 'Not found' }); return; }
    if (rule.status !== 'pending') {
      res.status(409).json({ error: `Rule is "${rule.status}", not "pending"` });
      return;
    }

    const { approve, rejectionReason } = parsed.data;
    const newStatus = approve ? 'active' : 'archived';
    const now = new Date().toISOString();

    db.prepare(`
      UPDATE archieve_rules
      SET status=?, approved_by=?, approved_at=?, rejection_reason=?, updated_at=?
      WHERE id=? AND tenant_id=?
    `).run(newStatus, userId, now, rejectionReason ?? null, now, req.params.id, tenantId);

    const requestId = crypto.randomUUID();
    try {
      archieveLog({
        requestId,
        tenantId,
        module: 'rules',
        eventType: approve
          ? ArchieveEventType.ARCHIEVE_RULE_STATUS_CHANGED
          : ArchieveEventType.ARCHIEVE_RULE_ARCHIVED,
        actor: { userId, role, sessionId: requestId },
        severity: 'info',
        data: { ruleId: rule.rule_id, decision: approve ? 'approved' : 'rejected', rejectionReason },
      });
    } catch (err) {
      console.warn('[rules] archieveLog approve failed:', (err as Error).message);
    }

    res.json({ ok: true, status: newStatus, approved_by: userId, approved_at: now });
  });

  // ── GET /api/rules/recommendations ────────────────────────────────────────
  // Surface high-frequency discovery query patterns as candidate rule suggestions.

  router.get('/rules/recommendations', (req, res) => {
    const { tenantId } = auth(req);

    const tableCheck = db.prepare(
      `SELECT name FROM sqlite_master WHERE type='table' AND name='discovery_queries'`
    ).get();
    if (!tableCheck) {
      res.json({ recommendations: [] });
      return;
    }

    // Find query patterns that appear ≥3 times and have no matching rule yet
    const patterns = db.prepare(`
      SELECT
        query_text,
        case_type,
        COUNT(*) as frequency,
        AVG(COALESCE(confidence, 0)) as avg_confidence,
        MAX(created_at) as last_seen
      FROM discovery_queries
      WHERE tenant_id = ?
        AND created_at > datetime('now', '-30 days')
      GROUP BY case_type
      HAVING COUNT(*) >= 3
      ORDER BY frequency DESC
      LIMIT 10
    `).all(tenantId) as {
      query_text: string;
      case_type: string;
      frequency: number;
      avg_confidence: number;
      last_seen: string;
    }[];

    const existingRuleIds = new Set(
      (db.prepare(
        `SELECT rule_id FROM archieve_rules WHERE tenant_id=? AND status NOT IN ('archived')`
      ).all(tenantId) as { rule_id: string }[]).map(r => r.rule_id)
    );

    const recommendations = patterns
      .filter(p => !existingRuleIds.has(`ai-suggest-${p.case_type}`))
      .map(p => ({
        suggestedRuleId: `ai-suggest-${p.case_type}`,
        title: `Automate: ${p.case_type.replace(/_/g, ' ')}`,
        description: `This inquiry type appeared ${p.frequency} times in the last 30 days. Consider adding a governance rule to standardize handling.`,
        caseType: p.case_type,
        frequency: p.frequency,
        avgConfidence: Math.round(p.avg_confidence * 100) / 100,
        lastSeen: p.last_seen,
        category: 'general' as const,
      }));

    res.json({ recommendations });
  });

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
      conditions, actions, source, aiConfidence,
    } = parsed.data;

    // AI-sourced rules always start pending — must be approved before going active
    const status = source === 'ai' ? 'pending' : parsed.data.status;

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
         created_by, archieve_event_id, approved_by, approved_at, rejection_reason, created_at, updated_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,NULL,NULL,NULL,?,?)
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
    const statusSchema = z.object({ status: z.enum(['draft', 'pending', 'active', 'archived']) });
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
