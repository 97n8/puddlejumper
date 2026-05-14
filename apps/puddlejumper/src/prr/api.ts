import express from 'express';
import type { Router } from 'express';
import type Database from 'better-sqlite3';
import { getAuthContext, createJwtAuthenticationMiddleware } from '@publiclogic/core';
import {
  listPRRRequests,
  createPRRRequest,
  acknowledgePRRRequest,
  closePRRRequest,
} from './store.js';

export function createPrrRouter(db: Database.Database): Router {
  const router = express.Router();
  const authMiddleware = createJwtAuthenticationMiddleware();

  router.use(authMiddleware);

  // GET /list → list all PRR requests
  router.get('/list', (req, res) => {
    const auth = getAuthContext(req);
    if (!auth?.tenantId) {
      res.status(403).json({ error: 'Tenant not resolvable' });
      return;
    }
    try {
      const requests = listPRRRequests(db);
      res.json(requests);
    } catch (err) {
      console.error('[prr] listPRRRequests error:', (err as Error).message);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // POST /intake → create a new PRR
  router.post('/intake', (req, res) => {
    const auth = getAuthContext(req);
    if (!auth?.tenantId) {
      res.status(403).json({ error: 'Tenant not resolvable' });
      return;
    }
    const body = req.body as Record<string, unknown>;
    const requesterName = (body.requesterName ?? body.requester_name) as string | undefined;
    const requesterEmail = (body.requesterEmail ?? body.requester_email) as string | undefined;
    const requestDescription = (
      body.requestDescription ?? body.request_description ?? body.description
    ) as string | undefined;

    if (!requesterName || typeof requesterName !== 'string') {
      res.status(400).json({ error: 'requesterName is required' });
      return;
    }
    if (!requesterEmail || typeof requesterEmail !== 'string') {
      res.status(400).json({ error: 'requesterEmail is required' });
      return;
    }
    if (!requestDescription || typeof requestDescription !== 'string') {
      res.status(400).json({ error: 'requestDescription is required' });
      return;
    }

    try {
      const prr = createPRRRequest(db, { requesterName, requesterEmail, requestDescription });
      res.status(201).json(prr);
    } catch (err) {
      console.error('[prr] createPRRRequest error:', (err as Error).message);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // PATCH /:id/acknowledge → acknowledge a PRR
  router.patch('/:id/acknowledge', (req, res) => {
    const auth = getAuthContext(req);
    if (!auth?.tenantId) {
      res.status(403).json({ error: 'Tenant not resolvable' });
      return;
    }
    const { id } = req.params;
    try {
      const updated = acknowledgePRRRequest(db, id);
      if (!updated) {
        res.status(404).json({ error: 'PRR not found' });
        return;
      }
      res.json(updated);
    } catch (err) {
      console.error('[prr] acknowledgePRRRequest error:', (err as Error).message);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // PATCH /:id/close → close a PRR with optional notes
  router.patch('/:id/close', (req, res) => {
    const auth = getAuthContext(req);
    if (!auth?.tenantId) {
      res.status(403).json({ error: 'Tenant not resolvable' });
      return;
    }
    const { id } = req.params;
    const body = req.body as Record<string, unknown>;
    const notes = typeof body.notes === 'string' ? body.notes : undefined;

    try {
      const updated = closePRRRequest(db, id, notes);
      if (!updated) {
        res.status(404).json({ error: 'PRR not found' });
        return;
      }
      res.json(updated);
    } catch (err) {
      console.error('[prr] closePRRRequest error:', (err as Error).message);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  return router;
}
