/**
 * sscb1Routes.ts — SSCB1 Swansea SC Biochar 1 API routes
 *
 * Mount at: /api/v1/sscb1
 *
 * Endpoints:
 *   /me                      — actor info + case
 *   /dashboard               — full dashboard summary
 *   /sources                 — source document registry
 *   /assumptions             — working assumption register
 *   /stack                   — capital stack layers
 *   /risks                   — risk register
 *   /itc                     — ITC basis tracking
 *   /open-items              — open items / action register
 *   /decisions               — decision log
 *   /stop-rules              — procedural stop rules
 *   /cadence                 — meeting cadence
 *   /milestones              — project milestones
 *   /audit                   — audit log
 *   /export/dashboard        — dashboard export (JSON for CloudSync)
 */

import express from 'express';
import type { Router, Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { getAuthContext, createJwtAuthenticationMiddleware } from '@publiclogic/core';
import {
  getSSCB1Db,
  getOrCreateActor,
  appendAuditLog,
  generateSealHash,
  sscb1Dashboard,
  listSources, createSource,
  listAssumptions, createAssumption, updateAssumption,
  listStackItems, createStackItem, updateStackItem,
  listRisks, createRisk, updateRisk,
  listITCItems, updateITCItem,
  listOpenItems, createOpenItem, resolveOpenItem,
  listDecisions, createDecision, recordDecision,
  listStopRules, clearStopRule,
  listCadenceEvents, createCadenceEvent, completeCadenceEvent,
  listMilestones, updateMilestone,
  listAuditLog,
  type SSCB1Actor,
} from './sscb1Store.js';

const CASE_ID = 'sscb1';

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

function requireSSCB1Access(req: Request, res: Response, next: NextFunction) {
  const actor = (req as any).sscb1Actor as SSCB1Actor | undefined;
  if (!actor) {
    res.status(401).json({ error: 'Authentication required', code: 'UNAUTHENTICATED' });
    return;
  }
  next();
}

function requireEditAccess(req: Request, res: Response, next: NextFunction) {
  const actor = (req as any).sscb1Actor as SSCB1Actor | undefined;
  if (!actor || !['pl_admin', 'aed_executive', 'editor'].includes(actor.role)) {
    res.status(403).json({ error: 'Forbidden: editor or higher role required', code: 'INSUFFICIENT_ROLE' });
    return;
  }
  next();
}

function requireAdminAccess(req: Request, res: Response, next: NextFunction) {
  const actor = (req as any).sscb1Actor as SSCB1Actor | undefined;
  if (!actor || !['pl_admin', 'aed_executive'].includes(actor.role)) {
    res.status(403).json({ error: 'Forbidden: pl_admin or aed_executive role required', code: 'INSUFFICIENT_ROLE' });
    return;
  }
  next();
}

// ── Router Factory ────────────────────────────────────────────────────────────

export function createSSCB1Router(dataDir: string): Router {
  const router = express.Router();
  const authMiddleware = createJwtAuthenticationMiddleware();
  const db = getSSCB1Db(dataDir);

  router.use(authMiddleware);

  // Auto-provision SSCB1 actor on every request
  router.use((req: Request, res: Response, next: NextFunction) => {
    try {
      const auth = getAuthContext(req);
      if (!auth?.userId || !auth?.email) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }
      const displayName = deriveDisplayName(auth.email, (auth as any).name);
      const role = (auth.role === 'admin' || auth.role === 'platform-admin') ? 'pl_admin' : 'readonly';
      (req as any).sscb1Actor = getOrCreateActor(db, auth.userId, displayName, auth.email, role as SSCB1Actor['role']);
      next();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      res.status(500).json({ error: `SSCB1 actor resolution failed: ${msg}` });
    }
  });

  // ── GET /me ────────────────────────────────────────────────────────────────

  router.get('/me', requireSSCB1Access, tryRoute((req, res) => {
    const actor = (req as any).sscb1Actor as SSCB1Actor;
    const caseRecord = db.prepare('SELECT * FROM sscb1_cases WHERE id = ?').get(CASE_ID);
    res.json({ actor, case: caseRecord });
  }));

  // ── GET /dashboard ─────────────────────────────────────────────────────────

  router.get('/dashboard', requireSSCB1Access, tryRoute((req, res) => {
    const actor = (req as any).sscb1Actor as SSCB1Actor;
    const dashboard = sscb1Dashboard(db, CASE_ID);
    res.json({ ...dashboard, actor });
  }));

  // ── SOURCES ────────────────────────────────────────────────────────────────

  router.get('/sources', requireSSCB1Access, tryRoute((_req, res) => {
    res.json({ sources: listSources(db, CASE_ID) });
  }));

  router.post('/sources', requireEditAccess, tryRoute((req, res) => {
    const actor = (req as any).sscb1Actor as SSCB1Actor;
    const { title, source_type, originating_party, date_received, effective_date, confidence_level, document_url, citation_note } = req.body;
    if (!title) return res.status(400).json({ error: 'title is required' });
    const source = createSource(db, CASE_ID, { ...req.body });
    appendAuditLog(db, CASE_ID, 'sscb1_sources', source.id, 'create', actor.id, actor.display_name, { title, source_type });
    return res.status(201).json(source);
  }));

  // ── ASSUMPTIONS ────────────────────────────────────────────────────────────

  router.get('/assumptions', requireSSCB1Access, tryRoute((_req, res) => {
    res.json({ assumptions: listAssumptions(db, CASE_ID) });
  }));

  router.post('/assumptions', requireEditAccess, tryRoute((req, res) => {
    const actor = (req as any).sscb1Actor as SSCB1Actor;
    const { statement } = req.body;
    if (!statement) return res.status(400).json({ error: 'statement is required' });
    const assumption = createAssumption(db, CASE_ID, req.body);
    appendAuditLog(db, CASE_ID, 'sscb1_assumptions', assumption.id, 'create', actor.id, actor.display_name, { statement });
    return res.status(201).json(assumption);
  }));

  router.put('/assumptions/:id', requireEditAccess, tryRoute((req, res) => {
    const actor = (req as any).sscb1Actor as SSCB1Actor;
    const existing = db.prepare('SELECT id FROM sscb1_assumptions WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Assumption not found' });
    const updated = updateAssumption(db, req.params.id, req.body);
    appendAuditLog(db, CASE_ID, 'sscb1_assumptions', req.params.id, 'update', actor.id, actor.display_name, req.body);
    return res.json(updated);
  }));

  // ── STACK ──────────────────────────────────────────────────────────────────

  router.get('/stack', requireSSCB1Access, tryRoute((_req, res) => {
    res.json({ stack: listStackItems(db, CASE_ID) });
  }));

  router.post('/stack', requireEditAccess, tryRoute((req, res) => {
    const actor = (req as any).sscb1Actor as SSCB1Actor;
    const { layer_name } = req.body;
    if (!layer_name) return res.status(400).json({ error: 'layer_name is required' });
    const item = createStackItem(db, CASE_ID, req.body);
    appendAuditLog(db, CASE_ID, 'sscb1_stack_items', item.id, 'create', actor.id, actor.display_name, { layer_name });
    return res.status(201).json(item);
  }));

  router.put('/stack/:id', requireEditAccess, tryRoute((req, res) => {
    const actor = (req as any).sscb1Actor as SSCB1Actor;
    const existing = db.prepare('SELECT id FROM sscb1_stack_items WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Stack item not found' });
    const updated = updateStackItem(db, req.params.id, req.body);
    appendAuditLog(db, CASE_ID, 'sscb1_stack_items', req.params.id, 'update', actor.id, actor.display_name, req.body);
    return res.json(updated);
  }));

  // ── RISKS ──────────────────────────────────────────────────────────────────

  router.get('/risks', requireSSCB1Access, tryRoute((_req, res) => {
    res.json({ risks: listRisks(db, CASE_ID) });
  }));

  router.post('/risks', requireEditAccess, tryRoute((req, res) => {
    const actor = (req as any).sscb1Actor as SSCB1Actor;
    const { title } = req.body;
    if (!title) return res.status(400).json({ error: 'title is required' });
    const risk = createRisk(db, CASE_ID, req.body);
    appendAuditLog(db, CASE_ID, 'sscb1_risks', risk.id, 'create', actor.id, actor.display_name, { title });
    return res.status(201).json(risk);
  }));

  router.put('/risks/:id', requireEditAccess, tryRoute((req, res) => {
    const actor = (req as any).sscb1Actor as SSCB1Actor;
    const existing = db.prepare('SELECT id FROM sscb1_risks WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Risk not found' });
    const updated = updateRisk(db, req.params.id, req.body);
    appendAuditLog(db, CASE_ID, 'sscb1_risks', req.params.id, 'update', actor.id, actor.display_name, req.body);
    return res.json(updated);
  }));

  // ── ITC ────────────────────────────────────────────────────────────────────

  router.get('/itc', requireSSCB1Access, tryRoute((_req, res) => {
    res.json({ itc_items: listITCItems(db, CASE_ID) });
  }));

  router.put('/itc/:id', requireEditAccess, tryRoute((req, res) => {
    const actor = (req as any).sscb1Actor as SSCB1Actor;
    const existing = db.prepare('SELECT id FROM sscb1_itc_items WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'ITC item not found' });
    const updated = updateITCItem(db, req.params.id, req.body);
    appendAuditLog(db, CASE_ID, 'sscb1_itc_items', req.params.id, 'update', actor.id, actor.display_name, req.body);
    return res.json(updated);
  }));

  // ── OPEN ITEMS ─────────────────────────────────────────────────────────────

  router.get('/open-items', requireSSCB1Access, tryRoute((_req, res) => {
    res.json({ open_items: listOpenItems(db, CASE_ID) });
  }));

  router.post('/open-items', requireEditAccess, tryRoute((req, res) => {
    const actor = (req as any).sscb1Actor as SSCB1Actor;
    const { title } = req.body;
    if (!title) return res.status(400).json({ error: 'title is required' });
    const item = createOpenItem(db, CASE_ID, req.body);
    appendAuditLog(db, CASE_ID, 'sscb1_open_items', item.id, 'create', actor.id, actor.display_name, { title });
    return res.status(201).json(item);
  }));

  router.put('/open-items/:id/resolve', requireEditAccess, tryRoute((req, res) => {
    const actor = (req as any).sscb1Actor as SSCB1Actor;
    const existing = db.prepare('SELECT id FROM sscb1_open_items WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Open item not found' });
    const { resolution_note } = req.body;
    if (!resolution_note) return res.status(400).json({ error: 'resolution_note is required' });
    const updated = resolveOpenItem(db, req.params.id, actor.display_name, resolution_note);
    appendAuditLog(db, CASE_ID, 'sscb1_open_items', req.params.id, 'update', actor.id, actor.display_name, { status: 'resolved', resolution_note });
    return res.json(updated);
  }));

  // ── DECISIONS ──────────────────────────────────────────────────────────────

  router.get('/decisions', requireSSCB1Access, tryRoute((_req, res) => {
    res.json({ decisions: listDecisions(db, CASE_ID) });
  }));

  router.post('/decisions', requireEditAccess, tryRoute((req, res) => {
    const actor = (req as any).sscb1Actor as SSCB1Actor;
    const { decision_statement } = req.body;
    if (!decision_statement) return res.status(400).json({ error: 'decision_statement is required' });
    const decision = createDecision(db, CASE_ID, req.body);
    appendAuditLog(db, CASE_ID, 'sscb1_decisions', decision.id, 'create', actor.id, actor.display_name, { decision_statement });
    return res.status(201).json(decision);
  }));

  router.put('/decisions/:id/decide', requireAdminAccess, tryRoute((req, res) => {
    const actor = (req as any).sscb1Actor as SSCB1Actor;
    const existing = db.prepare('SELECT id FROM sscb1_decisions WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Decision not found' });
    const { chosen_option, rationale, decision_date } = req.body;
    if (!chosen_option || !rationale) return res.status(400).json({ error: 'chosen_option and rationale are required' });
    const updated = recordDecision(db, req.params.id, chosen_option, rationale, decision_date);
    appendAuditLog(db, CASE_ID, 'sscb1_decisions', req.params.id, 'update', actor.id, actor.display_name, { status: 'decided', chosen_option, rationale });
    return res.json(updated);
  }));

  // ── STOP RULES ─────────────────────────────────────────────────────────────

  router.get('/stop-rules', requireSSCB1Access, tryRoute((_req, res) => {
    res.json({ stop_rules: listStopRules(db, CASE_ID) });
  }));

  router.put('/stop-rules/:id/clear', requireAdminAccess, tryRoute((req, res) => {
    const actor = (req as any).sscb1Actor as SSCB1Actor;
    const existing = db.prepare('SELECT id FROM sscb1_stop_rules WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Stop rule not found' });
    const { clearance_evidence } = req.body;
    if (!clearance_evidence) return res.status(400).json({ error: 'clearance_evidence is required' });
    const updated = clearStopRule(db, req.params.id, actor.display_name, clearance_evidence);
    appendAuditLog(db, CASE_ID, 'sscb1_stop_rules', req.params.id, 'update', actor.id, actor.display_name, { active: false, clearance_evidence });
    return res.json(updated);
  }));

  // ── CADENCE ────────────────────────────────────────────────────────────────

  router.get('/cadence', requireSSCB1Access, tryRoute((_req, res) => {
    res.json({ cadence_events: listCadenceEvents(db, CASE_ID) });
  }));

  router.post('/cadence', requireEditAccess, tryRoute((req, res) => {
    const actor = (req as any).sscb1Actor as SSCB1Actor;
    const { meeting_type } = req.body;
    if (!meeting_type) return res.status(400).json({ error: 'meeting_type is required' });
    const event = createCadenceEvent(db, CASE_ID, req.body);
    appendAuditLog(db, CASE_ID, 'sscb1_cadence_events', event.id, 'create', actor.id, actor.display_name, { meeting_type });
    return res.status(201).json(event);
  }));

  router.put('/cadence/:id/complete', requireEditAccess, tryRoute((req, res) => {
    const actor = (req as any).sscb1Actor as SSCB1Actor;
    const existing = db.prepare('SELECT id FROM sscb1_cadence_events WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Cadence event not found' });
    const updated = completeCadenceEvent(db, req.params.id, req.body.notes);
    appendAuditLog(db, CASE_ID, 'sscb1_cadence_events', req.params.id, 'update', actor.id, actor.display_name, { status: 'completed' });
    return res.json(updated);
  }));

  // ── MILESTONES ─────────────────────────────────────────────────────────────

  router.get('/milestones', requireSSCB1Access, tryRoute((_req, res) => {
    res.json({ milestones: listMilestones(db, CASE_ID) });
  }));

  router.put('/milestones/:id', requireEditAccess, tryRoute((req, res) => {
    const actor = (req as any).sscb1Actor as SSCB1Actor;
    const existing = db.prepare('SELECT id FROM sscb1_milestones WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Milestone not found' });
    const updated = updateMilestone(db, req.params.id, req.body);
    appendAuditLog(db, CASE_ID, 'sscb1_milestones', req.params.id, 'update', actor.id, actor.display_name, req.body);
    return res.json(updated);
  }));

  // ── AUDIT ──────────────────────────────────────────────────────────────────

  router.get('/audit', requireSSCB1Access, tryRoute((_req, res) => {
    const limit = Math.min(parseInt(String(_req.query.limit ?? '100'), 10), 500);
    res.json({ audit_log: listAuditLog(db, CASE_ID, limit) });
  }));

  // ── EXPORT ─────────────────────────────────────────────────────────────────

  router.post('/export/dashboard', requireSSCB1Access, tryRoute((req, res) => {
    const actor = (req as any).sscb1Actor as SSCB1Actor;
    const dashboard = sscb1Dashboard(db, CASE_ID);
    const exportId = crypto.randomUUID();
    const exportedAt = new Date().toISOString();
    const exportData = {
      export_id: exportId,
      exported_at: exportedAt,
      exported_by: actor.display_name,
      case_id: CASE_ID,
      ...dashboard,
    };
    const seal = generateSealHash(exportData as Record<string, unknown>);
    appendAuditLog(db, CASE_ID, 'sscb1_cases', CASE_ID, 'export', actor.id, actor.display_name, { export_id: exportId, exported_at: exportedAt });
    return res.json({ ...exportData, seal_hash: seal });
  }));

  return router;
}
