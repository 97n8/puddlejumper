/**
 * civicRoutes.ts — CIVIC V1 API routes
 *
 * All routes require PJ session auth (JWT cookie / Bearer token).
 * Uses civic.db managed by civicStore.
 *
 * Mount at: /api/v1/civic
 *
 * Civic actors are auto-provisioned on first request:
 *   If a logged-in PJ user has no civic credential yet, one is created
 *   using their PJ profile (email → display_name derived from email prefix
 *   or full name if available on the PJ actor). This is the "create a
 *   username based on your credentials" feature.
 */

import express from 'express';
import type { Router, Request, Response, NextFunction } from 'express';
import type Database from 'better-sqlite3';
import crypto from 'crypto';
import { getAuthContext, createJwtAuthenticationMiddleware } from '@publiclogic/core';
import {
  getCivicDb, appendAuditLog, enforceVaultGates, VaultGateError,
} from './civicStore.js';

type CivicActor = {
  id: string;
  object_id: string;
  email: string;
  display_name: string;
  role: string;
  pj_user_id: string | null;
};

// ── Error-handling wrapper ─────────────────────────────────────────────────────
// Wraps a sync route handler so any thrown error (including JSON.parse failures,
// SQLite BUSY errors, etc.) returns a clean 500 instead of crashing.
function tryRoute(fn: (req: Request, res: Response) => unknown) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = fn(req, res);
      if (result instanceof Promise) result.catch(next);
    } catch (err) {
      next(err);
    }
  };
}

// ── Auto-provision civic actor ────────────────────────────────────────────────

function deriveDisplayName(email: string, fullName?: string): string {
  if (fullName && fullName.trim().length > 1) return fullName.trim();
  const prefix = email.split('@')[0] ?? email;
  // Capitalize each word segment (e.g. "nate.rondeau" → "Nate Rondeau")
  return prefix
    .replace(/[._-]+/g, ' ')
    .split(' ')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

function provisionCivicActor(db: Database.Database, pjUserId: string, email: string, displayName: string, role: string): CivicActor {
  const now = new Date().toISOString();

  // Find town (first active town_profile)
  const town = db.prepare(`SELECT id FROM objects WHERE subtype='town_profile' AND status='active' LIMIT 1`).get() as { id: string } | undefined;
  const ownerId = town?.id ?? null;

  const objectId = crypto.randomUUID();
  const credId = crypto.randomUUID();

  try {
    db.transaction(() => {
      db.prepare(`INSERT INTO objects (id,type,subtype,stage,status,vault_class,owner_id,data,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)`).run(
        objectId, 'actor', 'staff', 'WORKS', 'active', 'internal', ownerId,
        JSON.stringify({ display_name: displayName, email, pj_user_id: pjUserId }),
        now, now
      );
      db.prepare(`INSERT INTO credentials (id,object_id,email,display_name,role,pj_user_id,created_at) VALUES (?,?,?,?,?,?,?)`).run(
        credId, objectId, email, displayName, role, pjUserId, now
      );
      appendAuditLog(db, {
        objectId,
        actorId: objectId,
        actorDisplay: displayName,
        action: 'civic.actor.provisioned',
        afterState: { email, display_name: displayName, role },
        systemTriggered: true,
        notes: `Auto-provisioned from PJ session. pj_user_id=${pjUserId}`,
      });
    })();
  } catch (err) {
    throw new Error(`Failed to provision civic actor for ${email}: ${err instanceof Error ? err.message : String(err)}`);
  }

  return { id: credId, object_id: objectId, email, display_name: displayName, role, pj_user_id: pjUserId };
}

function getCivicActor(db: Database.Database, pjUserId: string, email: string, displayName: string, role: string): CivicActor {
  // First: try by PJ user ID
  let cred = db.prepare(`SELECT c.*, c.id as id FROM credentials c WHERE c.pj_user_id = ?`).get(pjUserId) as CivicActor | undefined;
  if (cred) return cred;

  // Second: try by email — only backfill pj_user_id if it was never set (null/empty)
  cred = db.prepare(`SELECT * FROM credentials WHERE email = ?`).get(email) as CivicActor | undefined;
  if (cred) {
    if (!cred.pj_user_id) {
      db.prepare(`UPDATE credentials SET pj_user_id = ? WHERE email = ? AND (pj_user_id IS NULL OR pj_user_id = '')`).run(pjUserId, email);
      return { ...cred, pj_user_id: pjUserId };
    }
    // Email belongs to a different PJ user — provision a fresh actor instead
    return provisionCivicActor(db, pjUserId, email, displayName, role);
  }

  // Auto-provision
  return provisionCivicActor(db, pjUserId, email, displayName, role);
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function addBusinessDays(from: Date, days: number): Date {
  const d = new Date(from);
  let added = 0;
  while (added < days) {
    d.setDate(d.getDate() + 1);
    const dow = d.getDay();
    if (dow !== 0 && dow !== 6) added++;
  }
  return d;
}

// Statutory deadlines auto-created when specific object subtypes are created
const STATUTORY_DEADLINES: Record<string, { label: string; type: string; statute_ref: string; business_days: number; severity: string }> = {
  records_request: {
    label: 'MGL c.66 §10 — 10 business-day response deadline',
    type: 'statutory',
    statute_ref: 'MGL c.66 §10',
    business_days: 10,
    severity: 'critical',
  },
  procurement: {
    label: 'MGL c.30B — 30-day public notice minimum',
    type: 'statutory',
    statute_ref: 'MGL c.30B §5',
    business_days: 30,
    severity: 'warning',
  },
};

// ── Router factory ────────────────────────────────────────────────────────────

export function createCivicRouter(dataDir: string): Router {
  const router = express.Router();
  const authMiddleware = createJwtAuthenticationMiddleware();
  const db = getCivicDb(dataDir);

  router.use(authMiddleware);

  // Resolve civic actor from PJ session on every request
  router.use((req: Request & { civicActor?: CivicActor }, res: Response, next) => {
    try {
      const auth = getAuthContext(req);
      if (!auth?.userId || !auth?.email) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }
      const displayName = deriveDisplayName(auth.email, (auth as any).name);
      const role = auth.role === 'admin' || auth.role === 'platform-admin' ? 'town_administrator' : 'staff';
      (req as any).civicActor = getCivicActor(db, auth.userId, auth.email, displayName, role);
      next();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      res.status(500).json({ error: `Civic actor resolution failed: ${msg}` });
    }
  });

  // ── GET /api/v1/civic/me ────────────────────────────────────────────────────
  router.get('/me', tryRoute((req: Request, res: Response) => {
    const actor = (req as any).civicActor as CivicActor;
    const obj = db.prepare('SELECT * FROM objects WHERE id = ?').get(actor.object_id) as Record<string, string> | undefined;
    const town = obj?.owner_id
      ? db.prepare('SELECT * FROM objects WHERE id = ?').get(obj.owner_id) as Record<string, string> | undefined
      : null;
    res.json({
      actor,
      object: obj ?? null,
      town: town ? JSON.parse(town.data ?? '{}') : null,
    });
  }));

  // ── GET /api/v1/civic/dashboard ─────────────────────────────────────────────
  router.get('/dashboard', tryRoute((req: Request, res: Response) => {
    const actor = (req as any).civicActor as CivicActor;
    const now = new Date().toISOString();
    const sevenDaysOut = new Date(Date.now() + 7 * 86400000).toISOString();
    const ninetyDaysOut = new Date(Date.now() + 90 * 86400000).toISOString();

    const dueThisWeek = db.prepare(`
      SELECT d.*, o.subtype as object_subtype
      FROM deadlines d
      LEFT JOIN objects o ON o.id = d.object_id
      WHERE d.status = 'active' AND d.due_at <= ?
      ORDER BY d.due_at ASC
      LIMIT 20
    `).all(sevenDaysOut);

    const exceptions = db.prepare(`
      SELECT e.*, o.subtype as object_subtype
      FROM exceptions e
      LEFT JOIN objects o ON o.id = e.object_id
      WHERE e.status = 'active'
      ORDER BY CASE e.severity WHEN 'critical' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 ELSE 4 END
    `).all();

    const openRecordsRequests = db.prepare(`
      SELECT * FROM objects
      WHERE subtype = 'records_request' AND status NOT IN ('responded','closed') AND deleted_at IS NULL
    `).all();

    const activeProcurements = db.prepare(`
      SELECT * FROM objects
      WHERE subtype = 'procurement' AND status NOT IN ('closed','cancelled') AND deleted_at IS NULL
    `).all();

    const contractsExpiring = db.prepare(`
      SELECT o.*, d.due_at as expiry_at FROM objects o
      JOIN deadlines d ON d.object_id = o.id
      WHERE o.subtype = 'contract' AND d.type = 'contractual'
        AND d.status = 'active' AND d.due_at <= ?
        AND o.deleted_at IS NULL
    `).all(ninetyDaysOut);

    const ownerlessCount = (db.prepare(`
      SELECT COUNT(*) as n FROM objects WHERE owner_id IS NULL AND deleted_at IS NULL AND subtype NOT IN ('town_profile','select_board')
    `).get() as { n: number }).n;

    const unclassifiedCount = (db.prepare(`
      SELECT COUNT(*) as n FROM objects WHERE vault_class = 'unset' AND deleted_at IS NULL
    `).get() as { n: number }).n;

    const pjFeed = db.prepare(`
      SELECT * FROM audit_log WHERE system_triggered = 1
      ORDER BY created_at DESC LIMIT 10
    `).all();

    // Computed vault score from live DB data
    const totalObjs = (db.prepare(`SELECT COUNT(*) as n FROM objects WHERE deleted_at IS NULL AND subtype NOT IN ('town_profile')`).get() as { n: number }).n;
    const withOwner = (db.prepare(`SELECT COUNT(*) as n FROM objects WHERE deleted_at IS NULL AND subtype NOT IN ('town_profile') AND owner_id IS NOT NULL`).get() as { n: number }).n;
    const classified = (db.prepare(`SELECT COUNT(*) as n FROM objects WHERE deleted_at IS NULL AND subtype NOT IN ('town_profile') AND vault_class != 'unset'`).get() as { n: number }).n;
    const withAuthority = (db.prepare(`SELECT COUNT(*) as n FROM objects WHERE deleted_at IS NULL AND type IN ('case','record') AND authority_basis IS NOT NULL`).get() as { n: number }).n;
    const totalCases = (db.prepare(`SELECT COUNT(*) as n FROM objects WHERE deleted_at IS NULL AND type IN ('case','record')`).get() as { n: number }).n;
    const totalDeadlines = (db.prepare(`SELECT COUNT(*) as n FROM deadlines WHERE status = 'active'`).get() as { n: number }).n;
    const overdueDeadlines = (db.prepare(`SELECT COUNT(*) as n FROM deadlines WHERE status = 'active' AND due_at < ?`).get(now) as { n: number }).n;
    const totalPrr = (db.prepare(`SELECT COUNT(*) as n FROM objects WHERE subtype = 'records_request' AND deleted_at IS NULL`).get() as { n: number }).n;
    const resolvedPrr = (db.prepare(`SELECT COUNT(*) as n FROM objects WHERE subtype = 'records_request' AND status IN ('responded','closed') AND deleted_at IS NULL`).get() as { n: number }).n;

    const pct = (n: number, d: number) => d === 0 ? 100 : Math.round((n / d) * 100);
    const accountability = pct(withOwner, totalObjs);
    const boundary = pct(classified, totalObjs);
    const authority = pct(withAuthority, totalCases);
    const continuity = totalDeadlines === 0 ? 100 : pct(totalDeadlines - overdueDeadlines, totalDeadlines);
    const records = pct(resolvedPrr, totalPrr);
    const overall = Math.round(accountability * 0.25 + boundary * 0.20 + authority * 0.15 + continuity * 0.20 + records * 0.20);
    const operational_mode = overall >= 75 ? 'compliant' : overall >= 50 ? 'standard' : 'elevated_risk';
    const vaultScore = { authority, accountability, boundary, continuity, records, overall, operational_mode };

    res.json({
      due_this_week: dueThisWeek,
      exceptions,
      open_records_requests: openRecordsRequests,
      active_procurements: activeProcurements,
      contracts_expiring: contractsExpiring,
      ownerless_count: ownerlessCount,
      unclassified_count: unclassifiedCount,
      vault_score: vaultScore,
      pj_feed: pjFeed,
    });
  }));

  // ── GET /api/v1/civic/objects ───────────────────────────────────────────────
  router.get('/objects', tryRoute((req: Request, res: Response) => {
    const { type, subtype, status, vault_class } = req.query as Record<string, string>;
    let sql = 'SELECT * FROM objects WHERE deleted_at IS NULL';
    const params: string[] = [];
    if (type) { sql += ' AND type = ?'; params.push(type); }
    if (subtype) { sql += ' AND subtype = ?'; params.push(subtype); }
    if (status) { sql += ' AND status = ?'; params.push(status); }
    if (vault_class) { sql += ' AND vault_class = ?'; params.push(vault_class); }
    sql += ' ORDER BY updated_at DESC LIMIT 100';
    const rows = db.prepare(sql).all(...params);
    res.json({ objects: rows, total: rows.length });
  }));

  // ── POST /api/v1/civic/objects ──────────────────────────────────────────────
  router.post('/objects', tryRoute((req: Request, res: Response) => {
    const actor = (req as any).civicActor as CivicActor;
    const { type, subtype, status = 'active', vault_class = 'unset', owner_id, data = {} } = req.body;
    if (!type || !subtype) {
      res.status(422).json({ error: 'type and subtype are required' });
      return;
    }
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    db.prepare(`INSERT INTO objects (id,type,subtype,status,vault_class,owner_id,data,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?)`).run(
      id, type, subtype, status, vault_class, owner_id ?? null, JSON.stringify(data), now, now
    );
    appendAuditLog(db, {
      objectId: id, actorId: actor.object_id, actorDisplay: actor.display_name,
      action: 'object.created', afterState: { type, subtype, status, vault_class },
    });
    const created = db.prepare('SELECT * FROM objects WHERE id = ?').get(id);

    // Auto-create statutory deadline for known subtypes
    const statutoryDef = STATUTORY_DEADLINES[subtype as string];
    if (statutoryDef) {
      const deadlineId = crypto.randomUUID();
      const dueAt = addBusinessDays(new Date(now), statutoryDef.business_days).toISOString();
      db.prepare(`INSERT INTO deadlines (id,object_id,label,type,statute_ref,due_at,owner_id,severity,status,created_at) VALUES (?,?,?,?,?,?,?,?,?,?)`).run(
        deadlineId, id, statutoryDef.label, statutoryDef.type, statutoryDef.statute_ref,
        dueAt, owner_id ?? null, statutoryDef.severity, 'active', now
      );
      appendAuditLog(db, {
        objectId: id, actorId: actor.object_id, actorDisplay: actor.display_name,
        action: 'deadline.auto_created',
        afterState: { deadline_id: deadlineId, statute_ref: statutoryDef.statute_ref, due_at: dueAt },
        systemTriggered: true,
        notes: `Auto-created statutory deadline: ${statutoryDef.label}`,
      });
    }

    res.status(201).json(created);
  }));

  // ── GET /api/v1/civic/objects/:id ──────────────────────────────────────────
  router.get('/objects/:id', tryRoute((req: Request, res: Response) => {
    const obj = db.prepare('SELECT * FROM objects WHERE id = ?').get(req.params.id);
    if (!obj) { res.status(404).json({ error: 'Object not found' }); return; }
    const audit = db.prepare('SELECT * FROM audit_log WHERE object_id = ? ORDER BY created_at DESC LIMIT 10').all(req.params.id);
    res.json({ object: obj, audit });
  }));

  // ── PATCH /api/v1/civic/objects/:id/status ──────────────────────────────────
  router.patch('/objects/:id/status', (req: Request, res: Response) => {
    const actor = (req as any).civicActor as CivicActor;
    const { status } = req.body;
    if (!status) { res.status(422).json({ error: 'status is required' }); return; }

    const obj = db.prepare('SELECT * FROM objects WHERE id = ?').get(req.params.id) as Record<string, string> | undefined;
    if (!obj) { res.status(404).json({ error: 'Object not found' }); return; }

    try {
      enforceVaultGates(db, req.params.id);
    } catch (e) {
      if (e instanceof VaultGateError) {
        res.status(422).json({ error: { code: 'VAULT_GATE_FAILED', gates: e.gates } });
        return;
      }
      throw e;
    }

    const prior = { status: obj.status };
    db.prepare('UPDATE objects SET status = ?, updated_at = ? WHERE id = ?').run(status, new Date().toISOString(), req.params.id);
    appendAuditLog(db, {
      objectId: req.params.id, actorId: actor.object_id, actorDisplay: actor.display_name,
      action: 'object.status.changed', beforeState: prior, afterState: { status },
    });
    res.json({ id: req.params.id, status });
  });

  // ── GET /api/v1/civic/exceptions ────────────────────────────────────────────
  router.get('/exceptions', tryRoute((_req: Request, res: Response) => {
    const rows = db.prepare(`
      SELECT e.*, o.subtype as object_subtype, o.data as object_data
      FROM exceptions e LEFT JOIN objects o ON o.id = e.object_id
      WHERE e.status IN ('active','acknowledged')
      ORDER BY CASE e.severity WHEN 'critical' THEN 1 WHEN 'high' THEN 2 ELSE 3 END, e.created_at ASC
    `).all();
    res.json({ exceptions: rows });
  }));

  // ── POST /api/v1/civic/exceptions/:id/acknowledge ───────────────────────────
  router.post('/exceptions/:id/acknowledge', tryRoute((req: Request, res: Response) => {
    const actor = (req as any).civicActor as CivicActor;
    const { reason } = req.body;
    if (!reason || reason.trim().length < 20) {
      res.status(422).json({ error: 'acknowledgment_reason must be at least 20 characters', min_length: 20 });
      return;
    }
    const exc = db.prepare('SELECT * FROM exceptions WHERE id = ?').get(req.params.id) as Record<string, string> | undefined;
    if (!exc) { res.status(404).json({ error: 'Exception not found' }); return; }
    const now = new Date().toISOString();
    db.prepare(`
      UPDATE exceptions SET status='acknowledged', acknowledged_by=?, acknowledged_at=?, acknowledgment_reason=? WHERE id=?
    `).run(actor.display_name, now, reason.trim(), req.params.id);
    appendAuditLog(db, {
      objectId: exc.object_id, actorId: actor.object_id, actorDisplay: actor.display_name,
      action: 'exception.acknowledged',
      afterState: { exception_id: req.params.id, reason: reason.trim() },
    });
    res.json({ id: req.params.id, status: 'acknowledged', acknowledged_by: actor.display_name });
  }));

  // ── GET /api/v1/civic/deadlines ─────────────────────────────────────────────
  router.get('/deadlines', tryRoute((_req: Request, res: Response) => {
    const rows = db.prepare(`
      SELECT d.*, o.subtype as object_subtype
      FROM deadlines d LEFT JOIN objects o ON o.id = d.object_id
      WHERE d.status = 'active'
      ORDER BY d.due_at ASC
    `).all();
    res.json({ deadlines: rows });
  }));

  // ── GET /api/v1/civic/templates ─────────────────────────────────────────────
  router.get('/templates', tryRoute((_req: Request, res: Response) => {
    const rows = db.prepare('SELECT * FROM templates WHERE active = 1 ORDER BY category, name').all();
    res.json({ templates: rows });
  }));

  // ── GET /api/v1/civic/audit ─────────────────────────────────────────────────
  router.get('/audit', tryRoute((req: Request, res: Response) => {
    const { object_id, limit = '25' } = req.query as Record<string, string>;
    let sql = 'SELECT * FROM audit_log';
    const params: (string | number)[] = [];
    if (object_id) { sql += ' WHERE object_id = ?'; params.push(object_id); }
    sql += ` ORDER BY created_at DESC LIMIT ${Math.min(100, parseInt(limit, 10))}`;
    const rows = db.prepare(sql).all(...params);
    res.json({ entries: rows });
  }));

  // ── GET /api/v1/civic/setup ─────────────────────────────────────────────────
  router.get('/setup', tryRoute((_req: Request, res: Response) => {
    const progress = db.prepare('SELECT * FROM setup_progress WHERE id = ?').get('singleton');
    res.json(progress);
  }));

  // ── PATCH /api/v1/civic/setup ───────────────────────────────────────────────
  router.patch('/setup', tryRoute((req: Request, res: Response) => {
    const actor = (req as any).civicActor as CivicActor;
    const allowed = ['town', 'identity', 'staff', 'bodies'];
    const updates: string[] = [];
    const vals: (string | number)[] = [];
    for (const key of allowed) {
      if (req.body[key] !== undefined) {
        updates.push(`${key} = ?`);
        vals.push(req.body[key] ? 1 : 0);
      }
    }
    if (updates.length === 0) { res.status(422).json({ error: 'No valid fields to update' }); return; }
    vals.push('singleton');
    db.prepare(`UPDATE setup_progress SET ${updates.join(', ')} WHERE id = ?`).run(...vals);
    appendAuditLog(db, {
      actorId: actor.object_id, actorDisplay: actor.display_name,
      action: 'setup.progress.updated', afterState: req.body,
    });
    const progress = db.prepare('SELECT * FROM setup_progress WHERE id = ?').get('singleton');
    res.json(progress);
  }));

  // ── GET /api/v1/civic/watch/feed ────────────────────────────────────────────
  router.get('/watch/feed', tryRoute((req: Request, res: Response) => {
    const actor = (req as any).civicActor as CivicActor;
    const rows = db.prepare(`
      SELECT a.*, o.subtype as object_subtype
      FROM audit_log a
      LEFT JOIN objects o ON o.id = a.object_id
      WHERE (a.actor_id = ? OR o.owner_id = ?)
      ORDER BY a.created_at DESC LIMIT 20
    `).all(actor.object_id, actor.object_id);
    res.json({ feed: rows });
  }));

  // ── Org Manager routes ────────────────────────────────────────────────────────

  router.get('/org-manager/status', tryRoute((req: Request, res: Response) => {
    const actor = (req as any).civicActor as CivicActor;
    const progress = db.prepare('SELECT * FROM setup_progress WHERE id = ?').get('singleton') as Record<string, unknown>;

    // Pull existing town profile to pre-fill the wizard
    const townObj = db.prepare(`SELECT data FROM objects WHERE subtype='town_profile' ORDER BY created_at DESC LIMIT 1`).get() as { data: string } | undefined;
    const townData = townObj ? JSON.parse(townObj.data) : {};

    // Pull existing staff from credentials
    const staffRows = db.prepare(`
      SELECT c.email, c.display_name, c.role, json_extract(o.data,'$.title') as title
      FROM credentials c JOIN objects o ON o.id = c.object_id
      WHERE o.subtype = 'staff' ORDER BY c.created_at ASC
    `).all() as { email: string; display_name: string; role: string; title: string }[];

    // Pull existing bodies
    const bodyRows = db.prepare(`
      SELECT subtype, data FROM objects WHERE type='body' AND subtype != 'town_profile' ORDER BY created_at ASC
    `).all() as { subtype: string; data: string }[];

    // Auto-complete setup_progress flags based on what actually exists in the DB
    // This handles the case where data was seeded but progress flags weren't set
    const hasTown  = !!townObj;
    const hasStaff = staffRows.length > 0;
    const hasBodies = bodyRows.length > 0;

    if (hasTown && !progress.town)   db.prepare('UPDATE setup_progress SET town=1 WHERE id=?').run('singleton');
    if (hasStaff && !progress.staff) db.prepare('UPDATE setup_progress SET staff=1 WHERE id=?').run('singleton');
    if (hasBodies && !progress.bodies) db.prepare('UPDATE setup_progress SET bodies=1 WHERE id=?').run('singleton');
    // Always mark identity as 1 since PJ session IS the identity provider
    if (!progress.identity) db.prepare('UPDATE setup_progress SET identity=1 WHERE id=?').run('singleton');

    // If all required steps are satisfied, auto-complete
    if (hasTown && !progress.completed_at) {
      const now = new Date().toISOString();
      db.prepare('UPDATE setup_progress SET completed_at=?, completed_by=? WHERE id=?').run(now, actor.object_id, 'singleton');
    }

    // Re-read after updates
    const updated = db.prepare('SELECT * FROM setup_progress WHERE id = ?').get('singleton') as Record<string, unknown>;
    const complete = !!updated.completed_at;

    res.json({
      complete,
      missing: [],
      current_step: complete ? 6 : 1,
      completed_at: updated.completed_at,
      prefill: { town: townData, staff: staffRows, bodies: bodyRows, actor },
    });
  }));

  router.post('/org-manager/town', (req: Request, res: Response) => {
    try {
      const actor = (req as any).civicActor as CivicActor;
      const { town_name, population, county, governance_form, dls_muni_code, fiscal_year_end } = req.body;
      if (!town_name) return res.status(400).json({ error: 'town_name required' });

      const now = new Date().toISOString();
      // Reuse existing town_profile id if it exists — avoid duplicates
      const existing = db.prepare(`SELECT id FROM objects WHERE subtype='town_profile' ORDER BY created_at ASC LIMIT 1`).get() as { id: string } | undefined;
      const id = existing?.id ?? crypto.randomUUID();

      db.prepare(`
        INSERT INTO objects (id, type, subtype, stage, status, vault_class, data, created_at, updated_at)
        VALUES (?, 'body', 'town_profile', 'WORKS', 'active', 'internal', ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET data=excluded.data, updated_at=excluded.updated_at
      `).run(id, JSON.stringify({ town_name, population, county, governance_form, dls_muni_code, fiscal_year_end }), now, now);

      db.prepare('UPDATE setup_progress SET town=1 WHERE id=?').run('singleton');

      if (actor?.object_id) {
        appendAuditLog(db, {
          objectId: id, actorId: actor.object_id,
          action: 'org_manager:town_saved',
          afterState: { town_name },
          systemTriggered: false,
        });
      }

      return res.json({ success: true, object_id: id });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return res.status(500).json({ error: `Failed to save town profile: ${msg}` });
    }
  });

  router.post('/org-manager/identity', tryRoute((_req: Request, res: Response) => {
    db.prepare('UPDATE setup_progress SET identity = 1 WHERE id = ?').run('singleton');
    res.json({ success: true });
  }));

  router.post('/org-manager/staff', (req: Request, res: Response) => {
    try {
      const actor = (req as any).civicActor as CivicActor;
      const { staff = [] } = req.body as { staff: { name: string; email: string; title: string; role: string }[] };
      const now = new Date().toISOString();

      for (const s of staff.filter(x => x.name && x.email)) {
        const id = crypto.randomUUID();
        db.prepare(`
          INSERT OR IGNORE INTO objects (id, type, subtype, status, vault_class, data, created_at, updated_at)
          VALUES (?, 'actor', 'staff', 'active', 'internal', ?, ?, ?)
        `).run(id, JSON.stringify({ full_name: s.name, email: s.email, title: s.title }), now, now);

        db.prepare(`
          INSERT OR IGNORE INTO credentials (id, object_id, email, display_name, role, created_at)
          VALUES (?, ?, ?, ?, ?, ?)
        `).run(crypto.randomUUID(), id, s.email, s.name, s.role, now);

        if (actor?.object_id) {
          appendAuditLog(db, {
            objectId: id, actorId: actor.object_id,
            action: 'org_manager:staff_added',
            afterState: { email: s.email, role: s.role },
            systemTriggered: false,
          });
        }
      }

      db.prepare('UPDATE setup_progress SET staff = 1 WHERE id = ?').run('singleton');
      return res.json({ success: true, count: staff.length });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return res.status(500).json({ error: `Failed to save staff: ${msg}` });
    }
  });

  router.post('/org-manager/bodies', (req: Request, res: Response) => {
    try {
      const actor = (req as any).civicActor as CivicActor;
      const { bodies = [] } = req.body as { bodies: { name: string; type: string; members: string }[] };
      const now = new Date().toISOString();

      for (const b of bodies.filter(x => x.name)) {
        const id = crypto.randomUUID();
        db.prepare(`
          INSERT OR IGNORE INTO objects (id, type, subtype, status, vault_class, data, created_at, updated_at)
          VALUES (?, 'body', ?, 'active', 'internal', ?, ?, ?)
        `).run(id, b.type, JSON.stringify({ name: b.name, member_count: parseInt(b.members) || 0 }), now, now);

        if (actor?.object_id) {
          appendAuditLog(db, {
            objectId: id, actorId: actor.object_id,
            action: 'org_manager:body_created',
            afterState: { name: b.name, type: b.type },
            systemTriggered: false,
          });
        }
      }

      db.prepare('UPDATE setup_progress SET bodies = 1 WHERE id = ?').run('singleton');
      return res.json({ success: true, count: bodies.length });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return res.status(500).json({ error: `Failed to save bodies: ${msg}` });
    }
  });

  // ── GET /org-manager/configure — load saved module configs ───────────────────
  router.get('/org-manager/configure', tryRoute((_req: Request, res: Response) => {
    const rows = db.prepare('SELECT * FROM module_configs').all() as {
      module_id: string; officer_name: string; officer_title: string;
      officer_email: string; officer_phone: string; routing: string;
      automations: string; retention_years: number; updated_at: string;
    }[];
    const configs = rows.map(r => ({
      moduleId:       r.module_id,
      officerName:    r.officer_name,
      officerTitle:   r.officer_title,
      officerEmail:   r.officer_email,
      officerPhone:   r.officer_phone,
      routing:        JSON.parse(r.routing),
      automations:    JSON.parse(r.automations),
      retentionYears: r.retention_years,
      updatedAt:      r.updated_at,
    }));
    return res.json({ configs });
  }));

  // ── POST /org-manager/configure — save module configs ────────────────────────
  router.post('/org-manager/configure', (req: Request, res: Response) => {
    const actor = (req as any).civicActor as CivicActor;
    const { modules } = req.body as {
      modules: Array<{
        moduleId: string; officerName?: string; officerTitle?: string;
        officerEmail?: string; officerPhone?: string;
        routing?: Record<string, string>; automations?: Record<string, boolean>;
        retentionYears?: number;
      }>
    };
    if (!Array.isArray(modules) || modules.length === 0) {
      return res.status(400).json({ error: 'modules array is required' });
    }
    const upsert = db.prepare(`
      INSERT INTO module_configs (module_id, officer_name, officer_title, officer_email, officer_phone, routing, automations, retention_years, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
      ON CONFLICT(module_id) DO UPDATE SET
        officer_name    = excluded.officer_name,
        officer_title   = excluded.officer_title,
        officer_email   = excluded.officer_email,
        officer_phone   = excluded.officer_phone,
        routing         = excluded.routing,
        automations     = excluded.automations,
        retention_years = excluded.retention_years,
        updated_at      = excluded.updated_at
    `);
    const saveAll = db.transaction((items: typeof modules) => {
      for (const m of items) {
        upsert.run(
          m.moduleId,
          m.officerName   ?? '',
          m.officerTitle  ?? '',
          m.officerEmail  ?? '',
          m.officerPhone  ?? '',
          JSON.stringify(m.routing     ?? {}),
          JSON.stringify(m.automations ?? {}),
          m.retentionYears ?? 7,
        );
      }
    });
    try {
      saveAll(modules);
      appendAuditLog(db, {
        objectId: 'singleton', actorId: actor?.object_id ?? 'system',
        action: 'org_manager:modules_configured',
        afterState: { moduleCount: modules.length },
        systemTriggered: false,
      });
      return res.json({ saved: modules.length });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return res.status(500).json({ error: `Failed to save module configs: ${msg}` });
    }
  });

  // ── POST /org-manager/complete — mark setup as done ─────────────────────────
  router.post('/org-manager/complete', (req: Request, res: Response) => {
    try {
      const actor = (req as any).civicActor as CivicActor;
      const progress = db.prepare('SELECT * FROM setup_progress WHERE id = ?').get('singleton') as Record<string, unknown> | undefined;
      if (!progress?.town) {
        return res.status(422).json({ error: 'Town profile is required to complete setup' });
      }
      const now = new Date().toISOString();
      db.prepare('UPDATE setup_progress SET completed_at = ?, completed_by = ? WHERE id = ?').run(now, actor?.object_id ?? 'system', 'singleton');
      if (actor?.object_id) {
        appendAuditLog(db, {
          objectId: 'singleton', actorId: actor.object_id,
          action: 'org_manager:setup_completed',
          afterState: { completed_at: now },
          systemTriggered: false,
        });
      }
      return res.json({ success: true, completed_at: now });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return res.status(500).json({ error: `Failed to complete setup: ${msg}` });
    }
  });

  // ── Assistant stub ────────────────────────────────────────────────────────────

  router.post('/assistant/ask', tryRoute((req: Request, res: Response) => {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return res.status(503).json({ code: 'AI_UNAVAILABLE', reason: 'not_configured' });
    }
    // Full AI implementation requires ANTHROPIC_API_KEY
    res.json({ response: 'AI assistant is configured. Full governance Q&A coming in V2.' });
  }));

  // ── Error handler for all civic routes ──────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  router.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    console.error('[civic] unhandled error:', err);
    res.status(500).json({ error: 'Internal server error', detail: err.message });
  });

  return router;
}
