import crypto from 'node:crypto';
import { Router, type Request, type Response } from 'express';
import {
  createDefinition,
  getDefinitionById,
  listDefinitions,
  updateDefinition,
} from './registry/definition-store.js';
import { publishConnector, deprecateConnector, getRegistry } from './registry/registry-publisher.js';
import { runSimulation } from './simulation/gate.js';
import { runInterceptor } from './handler/interceptor.js';
import { createExplorerRouter } from './explorer/router.js';
import { log as archieveLog } from '../archieve/logger.js';
import { encryptHandler } from './handler/encryptor.js';

export function createLogicBridgeRouter(): Router {
  const router = Router();
  const explorer = createExplorerRouter();

  // ── Connector CRUD ────────────────────────────────────────────────────

  // GET /api/logicbridge/connectors — list all connectors for tenant
  router.get('/connectors', (req: Request, res: Response) => {
    const tenantId = getTenantId(req);
    const { status } = req.query as Record<string, string>;
    try {
      const defs = listDefinitions(tenantId, status as any);
      res.json({ connectors: defs.map(safeDefinition) });
    } catch (err: unknown) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  // POST /api/logicbridge/connectors — create a new connector
  router.post('/connectors', async (req: Request, res: Response) => {
    const tenantId = getTenantId(req);
    const userId = getUserId(req);
    const { name, version, capabilities, dataTypes, allowedProfiles, metadata, handlerSource, samplePayload, residencyAttestation } = req.body;

    if (!name) { res.status(400).json({ error: 'name is required' }); return; }
    if (!handlerSource) { res.status(400).json({ error: 'handlerSource is required' }); return; }

    try {
      const def = createDefinition(tenantId, {
        name,
        version,
        capabilities,
        dataTypes,
        allowedProfiles,
        metadata,
        handlerSource,
        samplePayload,
        residencyAttestation,
      });

      try {
        archieveLog({
          requestId: crypto.randomUUID(),
          tenantId,
          module: 'LOGICBRIDGE',
          eventType: 'LOGICBRIDGE_CONNECTOR_CREATED',
          actor: { userId, sessionId: 'system', role: 'user' },
          severity: 'info',
          data: { connectorId: def.id },
        });
      } catch { /* never throw from archieve */ }

      res.status(201).json({ connector: safeDefinition(def) });
    } catch (err: unknown) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  // GET /api/logicbridge/connectors/:id — get a connector
  router.get('/connectors/:id', (req: Request, res: Response) => {
    const { id } = req.params;
    const def = getDefinitionById(id);
    if (!def) { res.status(404).json({ error: 'Connector not found' }); return; }
    res.json({ connector: safeDefinition(def) });
  });

  // PATCH /api/logicbridge/connectors/:id — update a connector (draft only)
  router.patch('/connectors/:id', async (req: Request, res: Response) => {
    const { id } = req.params;
    const existing = getDefinitionById(id);
    if (!existing) { res.status(404).json({ error: 'Connector not found' }); return; }
    if (!['draft', 'validated'].includes(existing.status)) {
      res.status(409).json({ error: 'Only draft/validated connectors can be updated' });
      return;
    }

    try {
      const { handlerSource, capabilities, allowedProfiles } = req.body;
      const updated = updateDefinition(id, { handlerSource, capabilities, allowedProfiles });
      res.json({ connector: updated ? safeDefinition(updated) : null });
    } catch (err: unknown) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  // GET /api/logicbridge/connectors/:id/handler — view handler source (audit logged)
  router.get('/connectors/:id/handler', async (req: Request, res: Response) => {
    const { id } = req.params;
    const userId = getUserId(req);
    const tenantId = getTenantId(req);
    const def = getDefinitionById(id);
    if (!def) { res.status(404).json({ error: 'Connector not found' }); return; }
    if (!def.handlerEncrypted) { res.status(404).json({ error: 'No handler code found' }); return; }

    try {
      const { decryptHandler } = await import('./handler/encryptor.js');
      const source = decryptHandler(def.handlerEncrypted);

      try {
        archieveLog({
          requestId: crypto.randomUUID(),
          tenantId,
          module: 'LOGICBRIDGE',
          eventType: 'LOGICBRIDGE_HANDLER_VIEWED',
          actor: { userId, sessionId: 'system', role: 'user' },
          severity: 'info',
          data: { connectorId: id },
        });
      } catch { /* never throw */ }

      res.json({ handlerSource: source });
    } catch (err: unknown) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  // POST /api/logicbridge/connectors/:id/simulate — run simulation gate
  router.post('/connectors/:id/simulate', async (req: Request, res: Response) => {
    const { id } = req.params;
    const userId = getUserId(req);
    const tenantId = getTenantId(req);
    const def = getDefinitionById(id);
    if (!def) { res.status(404).json({ error: 'Connector not found' }); return; }

    try {
      const result = await runSimulation(def);
      const newStatus = result.passed ? 'simulated' : def.status;
      updateDefinition(id, { status: newStatus as any, simResult: result });

      const eventType = result.passed ? 'LOGICBRIDGE_SIMULATION_PASSED' : 'LOGICBRIDGE_SIMULATION_FAILED';
      try {
        archieveLog({
          requestId: crypto.randomUUID(),
          tenantId,
          module: 'LOGICBRIDGE',
          eventType,
          actor: { userId, sessionId: 'system', role: 'user' },
          severity: result.passed ? 'info' : 'warn',
          data: { connectorId: id },
        });
      } catch { /* never throw */ }

      res.json({ result });
    } catch (err: unknown) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  // POST /api/logicbridge/connectors/:id/publish — publish connector
  router.post('/connectors/:id/publish', async (req: Request, res: Response) => {
    const { id } = req.params;
    const userId = getUserId(req);
    const result = await publishConnector(id, userId);
    if (!result.success) {
      res.status(409).json({ error: result.error });
      return;
    }
    res.json({ connector: result.definition ? safeDefinition(result.definition) : null });
  });

  // POST /api/logicbridge/connectors/:id/deprecate — deprecate connector
  router.post('/connectors/:id/deprecate', async (req: Request, res: Response) => {
    const { id } = req.params;
    const userId = getUserId(req);
    const { supersededBy } = req.body;
    const result = await deprecateConnector(id, userId, supersededBy);
    if (!result.success) {
      res.status(409).json({ error: result.error });
      return;
    }
    res.json({ success: true });
  });

  // POST /api/logicbridge/connectors/:id/test — test-run handler
  router.post('/connectors/:id/test', async (req: Request, res: Response) => {
    const { id } = req.params;
    const userId = getUserId(req);
    const tenantId = getTenantId(req);
    const def = getDefinitionById(id);
    if (!def) { res.status(404).json({ error: 'Connector not found' }); return; }

    try {
      const { runInSandbox } = await import('./handler/sandbox.js');
      const { decryptHandler } = await import('./handler/encryptor.js');
      const { buildSparkContext } = await import('./spark/index.js');

      if (!def.handlerEncrypted) { res.status(400).json({ error: 'No handler code' }); return; }

      const handlerSource = decryptHandler(def.handlerEncrypted);
      const payload = req.body.payload ?? def.samplePayload ?? {};
      const spark = buildSparkContext(tenantId, id);

      const result = await runInSandbox({
        handlerSource,
        payload: payload as Record<string, unknown>,
        sparkContext: spark as unknown as Record<string, unknown>,
        timeoutMs: 10_000,
      });

      try {
        archieveLog({
          requestId: crypto.randomUUID(),
          tenantId,
          module: 'LOGICBRIDGE',
          eventType: 'LOGICBRIDGE_HANDLER_TEST',
          actor: { userId, sessionId: 'system', role: 'user' },
          severity: 'info',
          data: { connectorId: id },
        });
      } catch { /* never throw */ }

      res.json({ result });
    } catch (err: unknown) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  // POST /api/logicbridge/execute/:connectorId — runtime execute (6-gate interceptor)
  router.post('/execute/:connectorId', async (req: Request, res: Response) => {
    const { connectorId } = req.params;
    const tenantId = getTenantId(req);
    const userId = getUserId(req);
    const { payload = {}, profileId } = req.body;

    const result = await runInterceptor(tenantId, connectorId, { payload, profileId, userId });
    const statusCode = result.success ? 200 : 400;
    res.status(statusCode).json(result);
  });

  // GET /api/logicbridge/registry — list in-memory registry
  router.get('/registry', (_req: Request, res: Response) => {
    const reg = getRegistry();
    const entries: unknown[] = [];
    for (const tenantMap of reg.values()) {
      for (const entry of tenantMap.values()) {
        entries.push(entry);
      }
    }
    res.json({ entries, total: entries.length });
  });

  // API Explorer
  router.use('/explore', explorer);

  return router;
}

function getTenantId(req: Request): string {
  return (req as any).auth?.tenantId ?? (req.headers['x-tenant-id'] as string) ?? 'default';
}

function getUserId(req: Request): string {
  return (req as any).auth?.userId ?? (req as any).auth?.sub ?? 'anonymous';
}

function safeDefinition(def: ReturnType<typeof getDefinitionById>) {
  if (!def) return null;
  // Never expose encrypted handler in list responses
  const { handlerEncrypted: _, ...safe } = def;
  return safe;
}
