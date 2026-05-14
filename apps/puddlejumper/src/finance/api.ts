import express from 'express';
import type { Router } from 'express';
import type Database from 'better-sqlite3';
import { getAuthContext, createJwtAuthenticationMiddleware } from '@publiclogic/core';
import {
  listFiscalYears,
  createFiscalYear,
  listFinancialModels,
  createFinancialModel,
  deleteFinancialModel,
} from './store.js';

export function createFinanceRouter(db: Database.Database): Router {
  const router = express.Router();
  const authMiddleware = createJwtAuthenticationMiddleware();

  router.use(authMiddleware);

  // GET /fiscal-years → list all fiscal years
  router.get('/fiscal-years', (req, res) => {
    const auth = getAuthContext(req);
    if (!auth?.tenantId) {
      res.status(403).json({ error: 'Tenant not resolvable' });
      return;
    }
    try {
      const years = listFiscalYears(db);
      res.json(years);
    } catch (err) {
      console.error('[finance] listFiscalYears error:', (err as Error).message);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // POST /fiscal-years → create a fiscal year
  router.post('/fiscal-years', (req, res) => {
    const auth = getAuthContext(req);
    if (!auth?.tenantId) {
      res.status(403).json({ error: 'Tenant not resolvable' });
      return;
    }
    const { label, startDate, endDate, status } = req.body as Record<string, unknown>;
    if (!label || typeof label !== 'string') {
      res.status(400).json({ error: 'label is required' });
      return;
    }
    if (!startDate || typeof startDate !== 'string') {
      res.status(400).json({ error: 'startDate is required' });
      return;
    }
    if (!endDate || typeof endDate !== 'string') {
      res.status(400).json({ error: 'endDate is required' });
      return;
    }
    const validStatuses = ['draft', 'proposed', 'adopted', 'closed'] as const;
    const resolvedStatus = validStatuses.includes(status as typeof validStatuses[number])
      ? (status as typeof validStatuses[number])
      : 'draft';

    try {
      const year = createFiscalYear(db, { label, startDate, endDate, status: resolvedStatus });
      res.status(201).json(year);
    } catch (err) {
      console.error('[finance] createFiscalYear error:', (err as Error).message);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // GET /models → list all financial models
  router.get('/models', (req, res) => {
    const auth = getAuthContext(req);
    if (!auth?.tenantId) {
      res.status(403).json({ error: 'Tenant not resolvable' });
      return;
    }
    try {
      const models = listFinancialModels(db);
      res.json(models);
    } catch (err) {
      console.error('[finance] listFinancialModels error:', (err as Error).message);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // POST /models → create a financial model
  router.post('/models', (req, res) => {
    const auth = getAuthContext(req);
    if (!auth?.tenantId) {
      res.status(403).json({ error: 'Tenant not resolvable' });
      return;
    }
    const body = req.body as Record<string, unknown>;
    if (!body.scenarioLabel || typeof body.scenarioLabel !== 'string') {
      res.status(400).json({ error: 'scenarioLabel is required' });
      return;
    }
    const validFreqs = ['monthly', 'quarterly', 'annual'] as const;
    const freq = validFreqs.includes(body.contributionFrequency as typeof validFreqs[number])
      ? (body.contributionFrequency as typeof validFreqs[number])
      : 'monthly';

    try {
      const model = createFinancialModel(db, {
        scenarioLabel: body.scenarioLabel as string,
        principal: Number(body.principal ?? 0),
        annualRate: Number(body.annualRate ?? 0),
        compoundingPeriods: Number(body.compoundingPeriods ?? 12),
        durationYears: Number(body.durationYears ?? 10),
        periodicContribution: Number(body.periodicContribution ?? 0),
        contributionFrequency: freq,
        projectionSeries: Array.isArray(body.projectionSeries) ? body.projectionSeries : [],
      });
      res.status(201).json(model);
    } catch (err) {
      console.error('[finance] createFinancialModel error:', (err as Error).message);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // DELETE /models/:id → delete a financial model
  router.delete('/models/:id', (req, res) => {
    const auth = getAuthContext(req);
    if (!auth?.tenantId) {
      res.status(403).json({ error: 'Tenant not resolvable' });
      return;
    }
    const { id } = req.params;
    try {
      const deleted = deleteFinancialModel(db, id);
      if (!deleted) {
        res.status(404).json({ error: 'Model not found' });
        return;
      }
      res.status(204).send();
    } catch (err) {
      console.error('[finance] deleteFinancialModel error:', (err as Error).message);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  return router;
}
