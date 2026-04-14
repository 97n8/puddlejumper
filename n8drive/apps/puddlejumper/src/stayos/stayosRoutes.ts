import express from 'express';
import type { Router, Request, Response, NextFunction } from 'express';
import type Database from 'better-sqlite3';
import crypto from 'crypto';
import { getAuthContext } from '@publiclogic/core';
import { seedDefaultTemplates } from './migrations.js';

function resolveWorkspaceId(auth: { tenantId?: string }): string {
  return (auth as Record<string, unknown>).tenantId as string ?? 'default';
}

function resolveUserId(auth: object): string {
  const a = auth as Record<string, unknown>;
  return (a.userId ?? a.sub ?? 'anonymous') as string;
}

function tryRoute(fn: (req: Request, res: Response) => unknown) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = fn(req, res);
      if (result instanceof Promise) result.catch(next);
    } catch (err) { next(err); }
  };
}

function scheduleAutomations(
  db: Database.Database,
  reservationId: string,
  propertyId: string,
  workspaceId: string,
  checkIn: string,
  checkOut: string,
): void {
  const automations = db.prepare(`
    SELECT * FROM stayos_automations
    WHERE workspace_id = ? AND enabled = 1
    AND (property_id IS NULL OR property_id = ?)
  `).all(workspaceId, propertyId) as Record<string, unknown>[];

  const insertQueue = db.prepare(`
    INSERT INTO stayos_automation_queue (id, workspace_id, automation_id, reservation_id, scheduled_at, status, created_at)
    VALUES (?, ?, ?, ?, ?, 'pending', datetime('now'))
  `);

  for (const auto of automations) {
    const offsetHours = (auto.trigger_offset_hours as number) ?? 0;
    let scheduledAt: string | null = null;

    if (auto.trigger === 'pre_checkin') {
      const d = new Date(checkIn);
      d.setHours(d.getHours() - offsetHours);
      scheduledAt = d.toISOString().replace('T', ' ').slice(0, 19);
    } else if (auto.trigger === 'post_checkout') {
      const d = new Date(checkOut);
      d.setHours(d.getHours() + offsetHours);
      scheduledAt = d.toISOString().replace('T', ' ').slice(0, 19);
    } else if (auto.trigger === 'mid_stay') {
      const ci = new Date(checkIn).getTime();
      const co = new Date(checkOut).getTime();
      const mid = new Date(ci + (co - ci) / 2);
      scheduledAt = mid.toISOString().replace('T', ' ').slice(0, 19);
    }

    if (scheduledAt) {
      insertQueue.run(crypto.randomUUID(), workspaceId, auto.id, reservationId, scheduledAt);
    }
  }
}

export function createStayosRoutes(db: Database.Database): Router {
  const router = express.Router();
  router.use(express.json());

  const now = () => new Date().toISOString().replace('T', ' ').slice(0, 19);

  function requireAuth(req: Request, res: Response): { workspaceId: string; userId: string } | null {
    const auth = getAuthContext(req);
    if (!auth) { res.status(401).json({ error: 'Unauthorized' }); return null; }
    return { workspaceId: resolveWorkspaceId(auth), userId: resolveUserId(auth) };
  }

  // ── Dashboard ────────────────────────────────────────────────────────────────
  router.get('/dashboard', tryRoute((req, res) => {
    const ctx = requireAuth(req, res); if (!ctx) return;
    const today = new Date().toISOString().slice(0, 10);

    const todayArrivals = db.prepare(`SELECT * FROM stayos_reservations WHERE workspace_id = ? AND check_in = ? AND status NOT IN ('cancelled') ORDER BY guest_name`).all(ctx.workspaceId, today);
    const todayDepartures = db.prepare(`SELECT * FROM stayos_reservations WHERE workspace_id = ? AND check_out = ? AND status NOT IN ('cancelled') ORDER BY guest_name`).all(ctx.workspaceId, today);
    const openTasksRow = db.prepare(`SELECT COUNT(*) as cnt FROM stayos_tasks WHERE workspace_id = ? AND status IN ('open', 'in_progress')`).get(ctx.workspaceId) as { cnt: number };
    const urgentTasksRow = db.prepare(`SELECT COUNT(*) as cnt FROM stayos_tasks WHERE workspace_id = ? AND status IN ('open', 'in_progress') AND priority = 'urgent'`).get(ctx.workspaceId) as { cnt: number };
    const pendingAutoRow = db.prepare(`SELECT COUNT(*) as cnt FROM stayos_automation_queue WHERE workspace_id = ? AND status = 'pending'`).get(ctx.workspaceId) as { cnt: number };
    const failedAutoRow = db.prepare(`SELECT COUNT(*) as cnt FROM stayos_automation_queue WHERE workspace_id = ? AND status = 'failed'`).get(ctx.workspaceId) as { cnt: number };
    const activeResRow = db.prepare(`SELECT COUNT(*) as cnt FROM stayos_reservations WHERE workspace_id = ? AND status IN ('confirmed', 'checked_in')`).get(ctx.workspaceId) as { cnt: number };

    res.json({
      today_arrivals: todayArrivals,
      today_departures: todayDepartures,
      open_tasks: openTasksRow.cnt,
      urgent_tasks: urgentTasksRow.cnt,
      pending_automations: pendingAutoRow.cnt,
      failed_automations: failedAutoRow.cnt,
      active_reservations: activeResRow.cnt,
    });
  }));

  // ── Properties ──────────────────────────────────────────────────────────────
  router.get('/properties', tryRoute((req, res) => {
    const ctx = requireAuth(req, res); if (!ctx) return;
    res.json(db.prepare(`SELECT * FROM stayos_properties WHERE workspace_id = ? ORDER BY name`).all(ctx.workspaceId));
  }));

  router.post('/properties', tryRoute((req, res) => {
    const ctx = requireAuth(req, res); if (!ctx) return;
    const { name, address, city, state = 'MA', zip, unit_count = 1, check_in_time = '15:00', check_out_time = '11:00', wifi_name, wifi_password, door_code, notes } = req.body as Record<string, unknown>;
    if (!name || !address || !city || !zip) { res.status(400).json({ error: 'name, address, city, zip are required' }); return; }
    const id = crypto.randomUUID();
    db.prepare(`INSERT INTO stayos_properties (id, workspace_id, name, address, city, state, zip, unit_count, check_in_time, check_out_time, wifi_name, wifi_password, door_code, notes, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(id, ctx.workspaceId, name, address, city, state, zip, unit_count, check_in_time, check_out_time, wifi_name ?? null, wifi_password ?? null, door_code ?? null, notes ?? null, now(), now());
    seedDefaultTemplates(db, ctx.workspaceId);
    res.status(201).json(db.prepare(`SELECT * FROM stayos_properties WHERE id = ?`).get(id));
  }));

  router.get('/properties/:id', tryRoute((req, res) => {
    const ctx = requireAuth(req, res); if (!ctx) return;
    const row = db.prepare(`SELECT * FROM stayos_properties WHERE id = ? AND workspace_id = ?`).get(req.params.id, ctx.workspaceId);
    if (!row) { res.status(404).json({ error: 'Not found' }); return; }
    res.json(row);
  }));

  router.put('/properties/:id', tryRoute((req, res) => {
    const ctx = requireAuth(req, res); if (!ctx) return;
    const existing = db.prepare(`SELECT id FROM stayos_properties WHERE id = ? AND workspace_id = ?`).get(req.params.id, ctx.workspaceId);
    if (!existing) { res.status(404).json({ error: 'Not found' }); return; }
    const allowed = ['name', 'address', 'city', 'state', 'zip', 'unit_count', 'check_in_time', 'check_out_time', 'wifi_name', 'wifi_password', 'door_code', 'notes'];
    const body = req.body as Record<string, unknown>;
    const updates = allowed.filter(f => f in body);
    if (!updates.length) { res.status(400).json({ error: 'No fields to update' }); return; }
    const sets = updates.map(f => `${f} = ?`).join(', ');
    const vals = updates.map(f => body[f]);
    db.prepare(`UPDATE stayos_properties SET ${sets}, updated_at = ? WHERE id = ?`).run(...vals, now(), req.params.id);
    res.json(db.prepare(`SELECT * FROM stayos_properties WHERE id = ?`).get(req.params.id));
  }));

  router.delete('/properties/:id', tryRoute((req, res) => {
    const ctx = requireAuth(req, res); if (!ctx) return;
    const existing = db.prepare(`SELECT id FROM stayos_properties WHERE id = ? AND workspace_id = ?`).get(req.params.id, ctx.workspaceId);
    if (!existing) { res.status(404).json({ error: 'Not found' }); return; }
    db.prepare(`DELETE FROM stayos_properties WHERE id = ?`).run(req.params.id);
    res.status(204).send();
  }));

  // ── Reservations ─────────────────────────────────────────────────────────────
  router.get('/reservations', tryRoute((req, res) => {
    const ctx = requireAuth(req, res); if (!ctx) return;
    let query = `SELECT * FROM stayos_reservations WHERE workspace_id = ?`;
    const params: unknown[] = [ctx.workspaceId];
    if (req.query.property_id) { query += ` AND property_id = ?`; params.push(req.query.property_id); }
    if (req.query.status) { query += ` AND status = ?`; params.push(req.query.status); }
    if (req.query.date_from) { query += ` AND check_out >= ?`; params.push(req.query.date_from); }
    if (req.query.date_to) { query += ` AND check_in <= ?`; params.push(req.query.date_to); }
    query += ` ORDER BY check_in DESC`;
    res.json(db.prepare(query).all(...params));
  }));

  router.post('/reservations', tryRoute((req, res) => {
    const ctx = requireAuth(req, res); if (!ctx) return;
    const body = req.body as Record<string, unknown>;
    const { property_id, guest_name, guest_email, guest_phone, check_in, check_out, guests_count = 1, source = 'direct', status = 'confirmed', total_amount, notes } = body;
    if (!property_id || !guest_name || !guest_email || !check_in || !check_out) {
      res.status(400).json({ error: 'property_id, guest_name, guest_email, check_in, check_out are required' }); return;
    }
    const overlap = db.prepare(`SELECT id FROM stayos_reservations WHERE property_id = ? AND status NOT IN ('cancelled') AND check_in < ? AND check_out > ?`).get(property_id, check_out as string, check_in as string);
    if (overlap) { res.status(409).json({ error: 'Date overlap with existing reservation' }); return; }
    const id = crypto.randomUUID();
    db.prepare(`INSERT INTO stayos_reservations (id, workspace_id, property_id, guest_name, guest_email, guest_phone, check_in, check_out, guests_count, source, status, total_amount, notes, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(id, ctx.workspaceId, property_id, guest_name, guest_email, guest_phone ?? null, check_in, check_out, guests_count, source, status, total_amount ?? null, notes ?? null, now(), now());
    scheduleAutomations(db, id, property_id as string, ctx.workspaceId, check_in as string, check_out as string);
    res.status(201).json(db.prepare(`SELECT * FROM stayos_reservations WHERE id = ?`).get(id));
  }));

  router.get('/reservations/:id', tryRoute((req, res) => {
    const ctx = requireAuth(req, res); if (!ctx) return;
    const row = db.prepare(`SELECT r.*, p.name as property_name, p.address as property_address FROM stayos_reservations r LEFT JOIN stayos_properties p ON r.property_id = p.id WHERE r.id = ? AND r.workspace_id = ?`).get(req.params.id, ctx.workspaceId);
    if (!row) { res.status(404).json({ error: 'Not found' }); return; }
    const messages = db.prepare(`SELECT * FROM stayos_messages WHERE reservation_id = ? ORDER BY created_at DESC`).all(req.params.id);
    const tasks = db.prepare(`SELECT * FROM stayos_tasks WHERE reservation_id = ? ORDER BY created_at DESC`).all(req.params.id);
    res.json({ ...(row as object), messages, tasks });
  }));

  router.put('/reservations/:id', tryRoute((req, res) => {
    const ctx = requireAuth(req, res); if (!ctx) return;
    const existing = db.prepare(`SELECT id FROM stayos_reservations WHERE id = ? AND workspace_id = ?`).get(req.params.id, ctx.workspaceId);
    if (!existing) { res.status(404).json({ error: 'Not found' }); return; }
    const allowed = ['guest_name', 'guest_email', 'guest_phone', 'check_in', 'check_out', 'guests_count', 'source', 'status', 'total_amount', 'notes'];
    const body = req.body as Record<string, unknown>;
    const updates = allowed.filter(f => f in body);
    if (!updates.length) { res.status(400).json({ error: 'No fields to update' }); return; }
    const sets = updates.map(f => `${f} = ?`).join(', ');
    const vals = updates.map(f => body[f]);
    db.prepare(`UPDATE stayos_reservations SET ${sets}, updated_at = ? WHERE id = ?`).run(...vals, now(), req.params.id);
    res.json(db.prepare(`SELECT * FROM stayos_reservations WHERE id = ?`).get(req.params.id));
  }));

  router.delete('/reservations/:id', tryRoute((req, res) => {
    const ctx = requireAuth(req, res); if (!ctx) return;
    const existing = db.prepare(`SELECT id FROM stayos_reservations WHERE id = ? AND workspace_id = ?`).get(req.params.id, ctx.workspaceId);
    if (!existing) { res.status(404).json({ error: 'Not found' }); return; }
    db.prepare(`UPDATE stayos_reservations SET status = 'cancelled', updated_at = ? WHERE id = ?`).run(now(), req.params.id);
    res.status(204).send();
  }));

  // ── Tasks ────────────────────────────────────────────────────────────────────
  router.get('/tasks', tryRoute((req, res) => {
    const ctx = requireAuth(req, res); if (!ctx) return;
    let query = `SELECT * FROM stayos_tasks WHERE workspace_id = ?`;
    const params: unknown[] = [ctx.workspaceId];
    if (req.query.property_id) { query += ` AND property_id = ?`; params.push(req.query.property_id); }
    if (req.query.status) { query += ` AND status = ?`; params.push(req.query.status); }
    if (req.query.priority) { query += ` AND priority = ?`; params.push(req.query.priority); }
    query += ` ORDER BY created_at DESC`;
    res.json(db.prepare(query).all(...params));
  }));

  router.post('/tasks', tryRoute((req, res) => {
    const ctx = requireAuth(req, res); if (!ctx) return;
    const body = req.body as Record<string, unknown>;
    const { property_id, reservation_id, title, notes, assigned_to, status = 'open', priority = 'normal', due_date } = body;
    if (!title) { res.status(400).json({ error: 'title is required' }); return; }
    const id = crypto.randomUUID();
    db.prepare(`INSERT INTO stayos_tasks (id, workspace_id, property_id, reservation_id, title, notes, assigned_to, status, priority, due_date, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(id, ctx.workspaceId, property_id ?? null, reservation_id ?? null, title, notes ?? null, assigned_to ?? null, status, priority, due_date ?? null, now(), now());
    res.status(201).json(db.prepare(`SELECT * FROM stayos_tasks WHERE id = ?`).get(id));
  }));

  router.put('/tasks/:id', tryRoute((req, res) => {
    const ctx = requireAuth(req, res); if (!ctx) return;
    const existing = db.prepare(`SELECT id FROM stayos_tasks WHERE id = ? AND workspace_id = ?`).get(req.params.id, ctx.workspaceId);
    if (!existing) { res.status(404).json({ error: 'Not found' }); return; }
    const allowed = ['title', 'notes', 'assigned_to', 'status', 'priority', 'due_date', 'completed_at', 'property_id', 'reservation_id'];
    const body = req.body as Record<string, unknown>;
    const updates = allowed.filter(f => f in body);
    if (!updates.length) { res.status(400).json({ error: 'No fields to update' }); return; }
    // Auto-set completed_at when marking done
    if (body.status === 'done' && !('completed_at' in body)) {
      updates.push('completed_at');
      body.completed_at = new Date().toISOString();
    }
    const sets = updates.map(f => `${f} = ?`).join(', ');
    const vals = updates.map(f => body[f]);
    db.prepare(`UPDATE stayos_tasks SET ${sets}, updated_at = ? WHERE id = ?`).run(...vals, now(), req.params.id);
    res.json(db.prepare(`SELECT * FROM stayos_tasks WHERE id = ?`).get(req.params.id));
  }));

  router.delete('/tasks/:id', tryRoute((req, res) => {
    const ctx = requireAuth(req, res); if (!ctx) return;
    const existing = db.prepare(`SELECT id FROM stayos_tasks WHERE id = ? AND workspace_id = ?`).get(req.params.id, ctx.workspaceId);
    if (!existing) { res.status(404).json({ error: 'Not found' }); return; }
    db.prepare(`DELETE FROM stayos_tasks WHERE id = ?`).run(req.params.id);
    res.status(204).send();
  }));

  // ── Automations ──────────────────────────────────────────────────────────────
  router.get('/automations', tryRoute((req, res) => {
    const ctx = requireAuth(req, res); if (!ctx) return;
    res.json(db.prepare(`SELECT * FROM stayos_automations WHERE workspace_id = ? ORDER BY name`).all(ctx.workspaceId));
  }));

  router.post('/automations', tryRoute((req, res) => {
    const ctx = requireAuth(req, res); if (!ctx) return;
    const body = req.body as Record<string, unknown>;
    const { property_id, name, trigger, trigger_offset_hours, action, action_config, enabled = 1 } = body;
    if (!name || !trigger || !action || !action_config) { res.status(400).json({ error: 'name, trigger, action, action_config are required' }); return; }
    const id = crypto.randomUUID();
    db.prepare(`INSERT INTO stayos_automations (id, workspace_id, property_id, name, trigger, trigger_offset_hours, action, action_config, enabled, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(id, ctx.workspaceId, property_id ?? null, name, trigger, trigger_offset_hours ?? null, action, typeof action_config === 'string' ? action_config : JSON.stringify(action_config), enabled ? 1 : 0, now(), now());
    res.status(201).json(db.prepare(`SELECT * FROM stayos_automations WHERE id = ?`).get(id));
  }));

  router.put('/automations/:id', tryRoute((req, res) => {
    const ctx = requireAuth(req, res); if (!ctx) return;
    const existing = db.prepare(`SELECT id FROM stayos_automations WHERE id = ? AND workspace_id = ?`).get(req.params.id, ctx.workspaceId);
    if (!existing) { res.status(404).json({ error: 'Not found' }); return; }
    const allowed = ['name', 'property_id', 'trigger', 'trigger_offset_hours', 'action', 'action_config', 'enabled'];
    const body = req.body as Record<string, unknown>;
    const updates = allowed.filter(f => f in body);
    if (!updates.length) { res.status(400).json({ error: 'No fields to update' }); return; }
    const sets = updates.map(f => `${f} = ?`).join(', ');
    const vals = updates.map(f => f === 'action_config' && typeof body[f] !== 'string' ? JSON.stringify(body[f]) : body[f]);
    db.prepare(`UPDATE stayos_automations SET ${sets}, updated_at = ? WHERE id = ?`).run(...vals, now(), req.params.id);
    res.json(db.prepare(`SELECT * FROM stayos_automations WHERE id = ?`).get(req.params.id));
  }));

  router.delete('/automations/:id', tryRoute((req, res) => {
    const ctx = requireAuth(req, res); if (!ctx) return;
    db.prepare(`DELETE FROM stayos_automations WHERE id = ? AND workspace_id = ?`).run(req.params.id, ctx.workspaceId);
    res.status(204).send();
  }));

  router.post('/automations/:id/trigger', tryRoute((req, res) => {
    const ctx = requireAuth(req, res); if (!ctx) return;
    const auto = db.prepare(`SELECT id FROM stayos_automations WHERE id = ? AND workspace_id = ?`).get(req.params.id, ctx.workspaceId);
    if (!auto) { res.status(404).json({ error: 'Not found' }); return; }
    const queueId = crypto.randomUUID();
    db.prepare(`INSERT INTO stayos_automation_queue (id, workspace_id, automation_id, reservation_id, scheduled_at, status, created_at) VALUES (?, ?, ?, NULL, datetime('now'), 'pending', datetime('now'))`)
      .run(queueId, ctx.workspaceId, req.params.id);
    res.json({ queued: queueId });
  }));

  // ── Messages ─────────────────────────────────────────────────────────────────
  router.get('/messages', tryRoute((req, res) => {
    const ctx = requireAuth(req, res); if (!ctx) return;
    let query = `SELECT * FROM stayos_messages WHERE workspace_id = ?`;
    const params: unknown[] = [ctx.workspaceId];
    if (req.query.reservation_id) { query += ` AND reservation_id = ?`; params.push(req.query.reservation_id); }
    query += ` ORDER BY created_at DESC`;
    res.json(db.prepare(query).all(...params));
  }));

  router.post('/messages/send', tryRoute((req, res) => {
    const ctx = requireAuth(req, res); if (!ctx) return;
    const body = req.body as Record<string, unknown>;
    const { reservation_id, channel, body: msgBody, to_address } = body;
    if (!msgBody || !to_address || !channel) { res.status(400).json({ error: 'channel, body, to_address are required' }); return; }
    const id = crypto.randomUUID();
    db.prepare(`INSERT INTO stayos_messages (id, workspace_id, reservation_id, direction, channel, to_address, from_address, body, status, sent_at, created_at) VALUES (?, ?, ?, 'outbound', ?, ?, 'system', ?, 'sent', datetime('now'), datetime('now'))`)
      .run(id, ctx.workspaceId, reservation_id ?? null, channel, to_address, msgBody);
    res.status(201).json(db.prepare(`SELECT * FROM stayos_messages WHERE id = ?`).get(id));
  }));

  router.post('/messages/webhook', (req, res) => {
    // Twilio inbound webhook stub — log and acknowledge
    console.log('[stayos] Twilio webhook received:', req.body);
    res.status(200).send('<?xml version="1.0" encoding="UTF-8"?><Response></Response>');
  });

  // ── Templates ────────────────────────────────────────────────────────────────
  router.get('/templates', tryRoute((req, res) => {
    const ctx = requireAuth(req, res); if (!ctx) return;
    res.json(db.prepare(`SELECT * FROM stayos_message_templates WHERE workspace_id = ? ORDER BY name`).all(ctx.workspaceId));
  }));

  router.post('/templates', tryRoute((req, res) => {
    const ctx = requireAuth(req, res); if (!ctx) return;
    const body = req.body as Record<string, unknown>;
    const { name, trigger, channel = 'sms', subject, body: tmplBody } = body;
    if (!name || !tmplBody) { res.status(400).json({ error: 'name, body are required' }); return; }
    const id = crypto.randomUUID();
    db.prepare(`INSERT INTO stayos_message_templates (id, workspace_id, name, trigger, channel, subject, body, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(id, ctx.workspaceId, name, trigger ?? null, channel, subject ?? null, tmplBody, now(), now());
    res.status(201).json(db.prepare(`SELECT * FROM stayos_message_templates WHERE id = ?`).get(id));
  }));

  router.put('/templates/:id', tryRoute((req, res) => {
    const ctx = requireAuth(req, res); if (!ctx) return;
    const existing = db.prepare(`SELECT id FROM stayos_message_templates WHERE id = ? AND workspace_id = ?`).get(req.params.id, ctx.workspaceId);
    if (!existing) { res.status(404).json({ error: 'Not found' }); return; }
    const allowed = ['name', 'trigger', 'channel', 'subject', 'body'];
    const body = req.body as Record<string, unknown>;
    const updates = allowed.filter(f => f in body);
    if (!updates.length) { res.status(400).json({ error: 'No fields to update' }); return; }
    const sets = updates.map(f => `${f} = ?`).join(', ');
    const vals = updates.map(f => body[f]);
    db.prepare(`UPDATE stayos_message_templates SET ${sets}, updated_at = ? WHERE id = ?`).run(...vals, now(), req.params.id);
    res.json(db.prepare(`SELECT * FROM stayos_message_templates WHERE id = ?`).get(req.params.id));
  }));

  router.delete('/templates/:id', tryRoute((req, res) => {
    const ctx = requireAuth(req, res); if (!ctx) return;
    db.prepare(`DELETE FROM stayos_message_templates WHERE id = ? AND workspace_id = ?`).run(req.params.id, ctx.workspaceId);
    res.status(204).send();
  }));

  // ── Devices ──────────────────────────────────────────────────────────────────
  router.get('/devices', tryRoute((req, res) => {
    const ctx = requireAuth(req, res); if (!ctx) return;
    res.json(db.prepare(`SELECT * FROM stayos_devices WHERE workspace_id = ? ORDER BY display_name`).all(ctx.workspaceId));
  }));

  router.post('/devices', tryRoute((req, res) => {
    const ctx = requireAuth(req, res); if (!ctx) return;
    const body = req.body as Record<string, unknown>;
    const { property_id, provider, device_id, display_name, device_type, status = 'active' } = body;
    if (!property_id || !provider || !device_id || !display_name || !device_type) { res.status(400).json({ error: 'property_id, provider, device_id, display_name, device_type are required' }); return; }
    const id = crypto.randomUUID();
    db.prepare(`INSERT INTO stayos_devices (id, workspace_id, property_id, provider, device_id, display_name, device_type, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`)
      .run(id, ctx.workspaceId, property_id, provider, device_id, display_name, device_type, status);
    res.status(201).json(db.prepare(`SELECT * FROM stayos_devices WHERE id = ?`).get(id));
  }));

  router.delete('/devices/:id', tryRoute((req, res) => {
    const ctx = requireAuth(req, res); if (!ctx) return;
    db.prepare(`DELETE FROM stayos_devices WHERE id = ? AND workspace_id = ?`).run(req.params.id, ctx.workspaceId);
    res.status(204).send();
  }));

  // ── Intake (public) ──────────────────────────────────────────────────────────
  router.get('/intake/:slug', tryRoute((req, res) => {
    const prop = db.prepare(`SELECT name, city, state, check_in_time, check_out_time FROM stayos_properties WHERE id = ?`).get(req.params.slug);
    if (!prop) { res.status(404).json({ error: 'Property not found' }); return; }
    res.json(prop);
  }));

  router.post('/intake/:slug', tryRoute((req, res) => {
    const body = req.body as Record<string, unknown>;
    const { guest_name, guest_email, guest_phone, check_in, check_out, guests_count = 1, message } = body;
    if (!guest_name || !guest_email) { res.status(400).json({ error: 'guest_name, guest_email are required' }); return; }
    const prop = db.prepare(`SELECT workspace_id FROM stayos_properties WHERE id = ?`).get(req.params.slug) as { workspace_id: string } | undefined;
    if (!prop) { res.status(404).json({ error: 'Property not found' }); return; }
    const id = crypto.randomUUID();
    db.prepare(`INSERT INTO stayos_intake_submissions (id, workspace_id, property_slug, guest_name, guest_email, guest_phone, check_in, check_out, guests_count, message, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'new', datetime('now'))`)
      .run(id, prop.workspace_id, req.params.slug, guest_name, guest_email, guest_phone ?? null, check_in ?? null, check_out ?? null, guests_count, message ?? null);
    res.status(201).json({ id, status: 'new' });
  }));

  router.get('/intake-submissions', tryRoute((req, res) => {
    const ctx = requireAuth(req, res); if (!ctx) return;
    res.json(db.prepare(`SELECT * FROM stayos_intake_submissions WHERE workspace_id = ? ORDER BY created_at DESC`).all(ctx.workspaceId));
  }));

  router.put('/intake-submissions/:id', tryRoute((req, res) => {
    const ctx = requireAuth(req, res); if (!ctx) return;
    const { status } = req.body as Record<string, unknown>;
    if (!status) { res.status(400).json({ error: 'status is required' }); return; }
    db.prepare(`UPDATE stayos_intake_submissions SET status = ? WHERE id = ? AND workspace_id = ?`).run(status, req.params.id, ctx.workspaceId);
    res.json(db.prepare(`SELECT * FROM stayos_intake_submissions WHERE id = ?`).get(req.params.id));
  }));

  return router;
}
