/**
 * aedRoutes.ts — AED × PublicLogic API routes
 *
 * Mount at: /api/v1/aed
 *
 * Workstreams:
 *   /me              — actor info
 *   /dashboard       — summary: active vaults, critical obligations, QALICB certs, material events
 *   /deals           — NMTC deal CRUD
 *   /deals/:id/obligations — per-deal obligation register
 *   /deals/:id/qalicbs    — QALICB management per deal
 *   /material-events — append-only material event log
 *   /governance/*    — authority register, access register, org obligations
 *   /audit           — append-only audit trail
 */

import express from 'express';
import type { Router, Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { getAuthContext, createJwtAuthenticationMiddleware } from '@publiclogic/core';
import {
  getAEDDb, getAEDActor, appendAEDAuditLog, computeSealHash,
  seedDealObligations, getDealVaultScore, computeYear7Date,
  type AEDActor,
} from './aedStore.js';

// ── Helpers ───────────────────────────────────────────────────────────────────

function tryRoute(fn: (req: Request, res: Response) => unknown) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const r = fn(req, res);
      if (r instanceof Promise) r.catch(next);
    } catch (err) {
      next(err);
    }
  };
}

function deriveDisplayName(email: string, name?: string): string {
  if (name && name.trim()) return name.trim();
  const prefix = email.split('@')[0] ?? email;
  return prefix.replace(/[._-]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

// ── RBAC ──────────────────────────────────────────────────────────────────────

function requireAdminActor(req: Request, res: Response, next: NextFunction) {
  const actor = (req as any).aedActor as AEDActor | undefined;
  if (!actor || actor.role !== 'aed_administrator') {
    res.status(403).json({ error: 'Forbidden: aed_administrator role required', code: 'INSUFFICIENT_ROLE' });
    return;
  }
  next();
}

// ── Router ────────────────────────────────────────────────────────────────────

export function createAEDRouter(dataDir: string): Router {
  const router = express.Router();
  const authMiddleware = createJwtAuthenticationMiddleware();
  const db = getAEDDb(dataDir);

  router.use(authMiddleware);

  // Resolve AED actor from PJ session on every request
  router.use((req: Request, res: Response, next: NextFunction) => {
    try {
      const auth = getAuthContext(req);
      if (!auth?.userId || !auth?.email) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }
      const displayName = deriveDisplayName(auth.email, (auth as any).name);
      const role = auth.role === 'admin' || auth.role === 'platform-admin' ? 'aed_administrator' : 'staff';
      (req as any).aedActor = getAEDActor(db, auth.userId, auth.email, displayName, role as AEDActor['role']);
      next();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      res.status(500).json({ error: `AED actor resolution failed: ${msg}` });
    }
  });

  // ── GET /me ────────────────────────────────────────────────────────────────

  router.get('/me', tryRoute((req, res) => {
    const actor = (req as any).aedActor as AEDActor;
    const dealsCount = (db.prepare('SELECT COUNT(*) as n FROM deals WHERE vault_class = ?').get('active') as { n: number }).n;
    res.json({ actor, active_deals: dealsCount });
  }));

  // ── GET /dashboard ─────────────────────────────────────────────────────────

  router.get('/dashboard', tryRoute((_req, res) => {
    const now = new Date().toISOString();
    const in30 = new Date(Date.now() + 30 * 86400000).toISOString();
    const in7  = new Date(Date.now() +  7 * 86400000).toISOString();

    const activeDeals = db.prepare(`SELECT * FROM deals WHERE vault_class = 'active' ORDER BY close_date DESC`).all() as any[];
    const criticalObligations = db.prepare(`
      SELECT o.*, d.name as deal_name FROM obligations o
      LEFT JOIN deals d ON o.deal_id = d.id
      WHERE o.status IN ('pending','overdue') AND o.risk_level = 'critical'
      ORDER BY o.due_date ASC NULLS LAST LIMIT 20
    `).all();
    const overdueCount = (db.prepare(`SELECT COUNT(*) as n FROM obligations WHERE status = 'overdue'`).get() as { n: number }).n;
    const dueIn7 = db.prepare(`SELECT COUNT(*) as n FROM obligations WHERE status = 'pending' AND due_date <= ? AND due_date >= ?`).get(in7, now) as { n: number };
    const pendingQalicbs = db.prepare(`
      SELECT q.*, d.name as deal_name FROM qalicbs q
      JOIN deals d ON q.deal_id = d.id
      WHERE q.next_cert_due <= ? AND q.status = 'qualified'
      ORDER BY q.next_cert_due ASC
    `).all(in30);
    const openMaterialEvents = db.prepare(`
      SELECT me.*, d.name as deal_name FROM material_events me
      LEFT JOIN deals d ON me.deal_id = d.id
      WHERE me.notified_at IS NULL
      ORDER BY me.notification_due ASC
    `).all();

    const vaultScores = activeDeals.map(d => ({
      deal_id: d.id,
      deal_name: d.name,
      score: getDealVaultScore(db, d.id),
    }));
    const overallScore = vaultScores.length
      ? Math.round(vaultScores.reduce((s, v) => s + v.score, 0) / vaultScores.length)
      : 100;

    res.json({
      vault_score: { overall: overallScore, deal_scores: vaultScores },
      active_deals: activeDeals,
      critical_obligations: criticalObligations,
      overdue_count: overdueCount,
      due_in_7_days: dueIn7.n,
      pending_qalicb_certs: pendingQalicbs,
      open_material_events: openMaterialEvents,
      summary: {
        active_vault_count: activeDeals.length,
        total_qei: activeDeals.reduce((s: number, d: any) => s + (d.qei_amount || 0), 0),
        total_qalicbs: (db.prepare('SELECT COUNT(*) as n FROM qalicbs WHERE status = ?').get('qualified') as { n: number }).n,
      },
    });
  }));

  // ── DEALS ──────────────────────────────────────────────────────────────────

  router.get('/deals', tryRoute((_req, res) => {
    const deals = db.prepare(`SELECT * FROM deals ORDER BY close_date DESC`).all();
    res.json({ deals });
  }));

  router.post('/deals', requireAdminActor, tryRoute((req, res) => {
    const actor = (req as any).aedActor as AEDActor;
    const { name, deal_number, qei_amount, close_date, cde_name, allocation_amount } = req.body;
    if (!name || !deal_number || !close_date) {
      return res.status(400).json({ error: 'name, deal_number, and close_date are required' });
    }
    if (!qei_amount || qei_amount <= 0) {
      return res.status(400).json({ error: 'qei_amount must be a positive number' });
    }

    const now = new Date().toISOString();
    const id = crypto.randomUUID();
    const year7 = computeYear7Date(close_date);

    db.prepare(`INSERT INTO deals (id, name, deal_number, qei_amount, close_date, year_7_date, cde_name, allocation_amount, status, vault_class, data, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active', 'active', '{}', ?, ?)`)
      .run(id, name, deal_number, qei_amount, close_date, year7, cde_name ?? '', allocation_amount ?? 0, now, now);

    // Auto-seed all 9 deal obligations
    seedDealObligations(db, id, close_date);

    appendAEDAuditLog(db, { actorId: actor.object_id, action: 'deal:created', objectId: id, objectType: 'deal', afterState: { name, deal_number } });

    const deal = db.prepare('SELECT * FROM deals WHERE id = ?').get(id);
    return res.status(201).json(deal);
  }));

  router.get('/deals/:id', tryRoute((req, res) => {
    const deal = db.prepare('SELECT * FROM deals WHERE id = ?').get(req.params.id);
    if (!deal) return res.status(404).json({ error: 'Deal not found' });
    const obligations = db.prepare('SELECT * FROM obligations WHERE deal_id = ? ORDER BY risk_level, due_date').all(req.params.id);
    const qalicbs = db.prepare('SELECT * FROM qalicbs WHERE deal_id = ? ORDER BY business_name').all(req.params.id);
    const vaultScore = getDealVaultScore(db, req.params.id);
    return res.json({ deal, obligations, qalicbs, vault_score: vaultScore });
  }));

  router.patch('/deals/:id', requireAdminActor, tryRoute((req, res) => {
    const actor = (req as any).aedActor as AEDActor;
    const deal = db.prepare('SELECT * FROM deals WHERE id = ?').get(req.params.id) as any;
    if (!deal) return res.status(404).json({ error: 'Deal not found' });
    const { name, status, vault_class } = req.body;
    const now = new Date().toISOString();
    db.prepare('UPDATE deals SET name = COALESCE(?, name), status = COALESCE(?, status), vault_class = COALESCE(?, vault_class), updated_at = ? WHERE id = ?')
      .run(name ?? null, status ?? null, vault_class ?? null, now, req.params.id);
    appendAEDAuditLog(db, { actorId: actor.object_id, action: 'deal:updated', objectId: req.params.id, objectType: 'deal', afterState: req.body });
    return res.json(db.prepare('SELECT * FROM deals WHERE id = ?').get(req.params.id));
  }));

  // ── OBLIGATIONS ────────────────────────────────────────────────────────────

  router.get('/obligations', tryRoute((req, res) => {
    const { deal_id, domain, status, risk_level } = req.query as Record<string, string>;
    let q = `SELECT o.*, d.name as deal_name FROM obligations o LEFT JOIN deals d ON o.deal_id = d.id WHERE 1=1`;
    const params: unknown[] = [];
    if (deal_id) { q += ' AND o.deal_id = ?'; params.push(deal_id); }
    if (domain) { q += ' AND o.domain = ?'; params.push(domain); }
    if (status) { q += ' AND o.status = ?'; params.push(status); }
    if (risk_level) { q += ' AND o.risk_level = ?'; params.push(risk_level); }
    q += ' ORDER BY o.risk_level, o.due_date';
    const obligations = db.prepare(q).all(...params);
    res.json({ obligations });
  }));

  router.patch('/obligations/:id/complete', tryRoute((req, res) => {
    const actor = (req as any).aedActor as AEDActor;
    const oblig = db.prepare('SELECT * FROM obligations WHERE id = ?').get(req.params.id) as any;
    if (!oblig) return res.status(404).json({ error: 'Obligation not found' });
    const { notes } = req.body;
    const now = new Date().toISOString();
    db.prepare('UPDATE obligations SET status = ?, completed_at = ?, completed_by = ? WHERE id = ?')
      .run('complete', now, actor.object_id, req.params.id);
    appendAEDAuditLog(db, { actorId: actor.object_id, action: 'obligation:completed', objectId: req.params.id, objectType: 'obligation', afterState: { notes } });
    return res.json(db.prepare('SELECT * FROM obligations WHERE id = ?').get(req.params.id));
  }));

  router.patch('/obligations/:id/status', tryRoute((req, res) => {
    const actor = (req as any).aedActor as AEDActor;
    const { status } = req.body;
    if (!['pending', 'complete', 'overdue', 'waived'].includes(status)) {
      return res.status(422).json({ error: 'Invalid status', valid: ['pending', 'complete', 'overdue', 'waived'] });
    }
    const oblig = db.prepare('SELECT * FROM obligations WHERE id = ?').get(req.params.id);
    if (!oblig) return res.status(404).json({ error: 'Obligation not found' });
    db.prepare('UPDATE obligations SET status = ? WHERE id = ?').run(status, req.params.id);
    appendAEDAuditLog(db, { actorId: actor.object_id, action: 'obligation:status_changed', objectId: req.params.id, afterState: { status } });
    return res.json(db.prepare('SELECT * FROM obligations WHERE id = ?').get(req.params.id));
  }));

  // ── QALICBs ────────────────────────────────────────────────────────────────

  router.get('/qalicbs', tryRoute((req, res) => {
    const { deal_id } = req.query as Record<string, string>;
    let q = 'SELECT q.*, d.name as deal_name FROM qalicbs q JOIN deals d ON q.deal_id = d.id WHERE 1=1';
    const params: unknown[] = [];
    if (deal_id) { q += ' AND q.deal_id = ?'; params.push(deal_id); }
    q += ' ORDER BY q.business_name';
    res.json({ qalicbs: db.prepare(q).all(...params) });
  }));

  router.post('/qalicbs', requireAdminActor, tryRoute((req, res) => {
    const actor = (req as any).aedActor as AEDActor;
    const { deal_id, business_name, census_tract, county, state, qlici_amount, qualification_date, contact_name, contact_email } = req.body;
    if (!deal_id || !business_name || !qualification_date) {
      return res.status(400).json({ error: 'deal_id, business_name, and qualification_date are required' });
    }
    const deal = db.prepare('SELECT id FROM deals WHERE id = ?').get(deal_id);
    if (!deal) return res.status(404).json({ error: 'Deal not found' });

    const now = new Date().toISOString();
    const id = crypto.randomUUID();
    const nextCertDue = new Date(qualification_date);
    nextCertDue.setFullYear(nextCertDue.getFullYear() + 1);

    db.prepare(`INSERT INTO qalicbs (id, deal_id, business_name, census_tract, county, state, qlici_amount, qualification_date, next_cert_due, status, contact_name, contact_email, data, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'qualified', ?, ?, '{}', ?, ?)`)
      .run(id, deal_id, business_name, census_tract ?? '', county ?? '', state ?? 'MA', qlici_amount ?? 0, qualification_date, nextCertDue.toISOString().split('T')[0], contact_name ?? '', contact_email ?? '', now, now);

    appendAEDAuditLog(db, { actorId: actor.object_id, action: 'qalicb:added', objectId: id, objectType: 'qalicb', afterState: { business_name, deal_id } });
    return res.status(201).json(db.prepare('SELECT * FROM qalicbs WHERE id = ?').get(id));
  }));

  router.patch('/qalicbs/:id/certify', tryRoute((req, res) => {
    const actor = (req as any).aedActor as AEDActor;
    const qalicb = db.prepare('SELECT * FROM qalicbs WHERE id = ?').get(req.params.id) as any;
    if (!qalicb) return res.status(404).json({ error: 'QALICB not found' });
    const now = new Date().toISOString();
    const nextCert = new Date();
    nextCert.setFullYear(nextCert.getFullYear() + 1);
    db.prepare('UPDATE qalicbs SET last_certified_at = ?, next_cert_due = ?, status = ?, updated_at = ? WHERE id = ?')
      .run(now, nextCert.toISOString().split('T')[0], 'qualified', now, req.params.id);
    appendAEDAuditLog(db, { actorId: actor.object_id, action: 'qalicb:certified', objectId: req.params.id, objectType: 'qalicb', afterState: { certified_at: now } });
    return res.json(db.prepare('SELECT * FROM qalicbs WHERE id = ?').get(req.params.id));
  }));

  router.patch('/qalicbs/:id/status', requireAdminActor, tryRoute((req, res) => {
    const actor = (req as any).aedActor as AEDActor;
    const { status } = req.body;
    if (!['qualified', 'at_risk', 'disqualified', 'pending_review'].includes(status)) {
      return res.status(422).json({ error: 'Invalid status', valid: ['qualified', 'at_risk', 'disqualified', 'pending_review'] });
    }
    const qalicb = db.prepare('SELECT * FROM qalicbs WHERE id = ?').get(req.params.id);
    if (!qalicb) return res.status(404).json({ error: 'QALICB not found' });
    const now = new Date().toISOString();
    db.prepare('UPDATE qalicbs SET status = ?, updated_at = ? WHERE id = ?').run(status, now, req.params.id);
    appendAEDAuditLog(db, { actorId: actor.object_id, action: 'qalicb:status_changed', objectId: req.params.id, afterState: { status } });
    return res.json(db.prepare('SELECT * FROM qalicbs WHERE id = ?').get(req.params.id));
  }));

  // ── MATERIAL EVENTS ────────────────────────────────────────────────────────

  router.get('/material-events', tryRoute((_req, res) => {
    const events = db.prepare(`
      SELECT me.*, d.name as deal_name FROM material_events me
      LEFT JOIN deals d ON me.deal_id = d.id
      ORDER BY me.created_at DESC
    `).all();
    res.json({ events });
  }));

  router.post('/material-events', tryRoute((req, res) => {
    const actor = (req as any).aedActor as AEDActor;
    const { deal_id, event_type, description, discovered_at, severity } = req.body;
    if (!event_type || !description) {
      return res.status(400).json({ error: 'event_type and description are required' });
    }
    const now = new Date().toISOString();
    const discoveredDate = discovered_at ?? now;
    const notificationDue = new Date(discoveredDate);
    notificationDue.setDate(notificationDue.getDate() + 30);

    const id = crypto.randomUUID();
    const sealHash = computeSealHash({ id, deal_id, event_type, description, discovered_at: discoveredDate, created_by: actor.object_id });

    db.prepare(`INSERT INTO material_events (id, deal_id, event_type, description, discovered_at, notification_due, severity, seal_hash, created_by, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(id, deal_id ?? null, event_type, description, discoveredDate, notificationDue.toISOString(), severity ?? 'high', sealHash, actor.object_id, now);

    appendAEDAuditLog(db, { actorId: actor.object_id, action: 'material_event:logged', objectId: id, objectType: 'material_event', afterState: { event_type, severity } });
    return res.status(201).json(db.prepare('SELECT * FROM material_events WHERE id = ?').get(id));
  }));

  router.patch('/material-events/:id/notify', tryRoute((req, res) => {
    const actor = (req as any).aedActor as AEDActor;
    const event = db.prepare('SELECT * FROM material_events WHERE id = ?').get(req.params.id) as any;
    if (!event) return res.status(404).json({ error: 'Material event not found' });
    if (event.notified_at) return res.status(409).json({ error: 'Already notified', notified_at: event.notified_at });
    const now = new Date().toISOString();
    db.prepare('UPDATE material_events SET notified_at = ?, notified_by = ? WHERE id = ?').run(now, actor.object_id, req.params.id);
    appendAEDAuditLog(db, { actorId: actor.object_id, action: 'material_event:notified', objectId: req.params.id, afterState: { notified_at: now } });
    return res.json(db.prepare('SELECT * FROM material_events WHERE id = ?').get(req.params.id));
  }));

  // ── GOVERNANCE — Authority & Access Registers ──────────────────────────────

  router.get('/governance/authority', tryRoute((_req, res) => {
    const entries = db.prepare('SELECT * FROM authority_register ORDER BY authority_category').all();
    res.json({ authority_register: entries });
  }));

  router.post('/governance/authority', requireAdminActor, tryRoute((req, res) => {
    const actor = (req as any).aedActor as AEDActor;
    const { authority_category, holder_role, scope, authority_basis, succession } = req.body;
    if (!authority_category || !holder_role || !scope) {
      return res.status(400).json({ error: 'authority_category, holder_role, and scope are required' });
    }
    const now = new Date().toISOString();
    const id = crypto.randomUUID();
    db.prepare(`INSERT INTO authority_register (id, authority_category, holder_role, scope, authority_basis, succession, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(id, authority_category, holder_role, scope, authority_basis ?? '', succession ?? '', now, now);
    appendAEDAuditLog(db, { actorId: actor.object_id, action: 'authority:added', objectId: id, afterState: { authority_category, holder_role } });
    return res.status(201).json(db.prepare('SELECT * FROM authority_register WHERE id = ?').get(id));
  }));

  router.get('/governance/access', tryRoute((_req, res) => {
    const entries = db.prepare('SELECT * FROM access_register ORDER BY system_name').all();
    res.json({ access_register: entries });
  }));

  router.patch('/governance/access/:id/verify', requireAdminActor, tryRoute((req, res) => {
    const actor = (req as any).aedActor as AEDActor;
    const entry = db.prepare('SELECT * FROM access_register WHERE id = ?').get(req.params.id);
    if (!entry) return res.status(404).json({ error: 'Access register entry not found' });
    const now = new Date().toISOString();
    const nextReview = new Date();
    nextReview.setFullYear(nextReview.getFullYear() + 1);
    db.prepare('UPDATE access_register SET last_verified = ?, next_review = ?, updated_at = ? WHERE id = ?')
      .run(now, nextReview.toISOString(), now, req.params.id);
    appendAEDAuditLog(db, { actorId: actor.object_id, action: 'access:verified', objectId: req.params.id, afterState: { last_verified: now } });
    return res.json(db.prepare('SELECT * FROM access_register WHERE id = ?').get(req.params.id));
  }));

  // ── AUDIT ──────────────────────────────────────────────────────────────────

  router.get('/audit', tryRoute((req, res) => {
    const { limit = '50' } = req.query as Record<string, string>;
    const entries = db.prepare('SELECT * FROM audit_log ORDER BY created_at DESC LIMIT ?').all(parseInt(limit, 10));
    res.json({ entries });
  }));

  // ── Error Handler ──────────────────────────────────────────────────────────

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  router.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    console.error('[aed] route error:', err);
    res.status(500).json({ error: 'Internal server error', detail: err.message });
  });

  return router;
}
