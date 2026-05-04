import express from 'express';
import crypto from 'node:crypto';
import type { Request, Response, Router } from 'express';
import type { Database as DB } from 'better-sqlite3';
import { z } from 'zod';
import {
  createFlow,
  getFlow,
  insertAuditEvent,
  listFlowFrameworks,
  listFlowRuns,
  listFlows,
  updateFlow,
  type CivicFlowStatus,
} from '../flowStore.js';
import { getCivicFlowFramework } from '../frameworkRegistry.js';
import { executeFlow, registerFlow } from '../synchron8/flowExecutor.js';

type CivicActor = {
  object_id: string;
  town_id: string | null;
  role: string;
};

const scenarioNodeSchema = z.object({
  id: z.string().min(1),
  kind: z.enum(['condition', 'action', 'review_gate']),
  title: z.string().optional(),
  detail: z.string().optional(),
  next: z.string().nullable().optional(),
  onTrue: z.string().nullable().optional(),
  onFalse: z.string().nullable().optional(),
  humanReview: z.boolean().optional(),
  key: z.string().optional(),
  equals: z.unknown().optional(),
});

const scenarioSchema = z.object({
  version: z.number().int().positive().default(1),
  rootId: z.string().nullable(),
  nodes: z.array(scenarioNodeSchema),
});

const flowCreateSchema = z.object({
  name: z.string().min(1),
  linked_app: z.string().min(1),
  framework_id: z.string().min(1),
  trigger_spec: z.record(z.string(), z.unknown()),
  scenario: scenarioSchema,
  status: z.enum(['draft', 'active', 'paused', 'archived']).optional(),
});

const flowUpdateSchema = flowCreateSchema.partial();

function currentActor(req: Request): CivicActor {
  const actor = (req as Request & { civicActor?: CivicActor }).civicActor;
  if (!actor?.town_id) {
    throw new Error('Civic actor org is not resolvable');
  }
  return actor;
}

function validateScenarioReachability(scenario: z.infer<typeof scenarioSchema>): string[] {
  const nodeMap = new Map(scenario.nodes.map((node) => [node.id, node]));
  const rootId = scenario.rootId ?? scenario.nodes[0]?.id ?? null;
  if (!rootId || !nodeMap.has(rootId)) {
    return ['scenario.rootId must reference a valid node'];
  }

  const reachable = new Set<string>();
  const queue = [rootId];
  while (queue.length > 0) {
    const nodeId = queue.shift()!;
    if (reachable.has(nodeId)) {
      continue;
    }
    reachable.add(nodeId);
    const node = nodeMap.get(nodeId);
    if (!node) {
      continue;
    }
    const edges = [node.next, node.onTrue, node.onFalse].filter((value): value is string => typeof value === 'string' && value.length > 0);
    for (const edge of edges) {
      if (!nodeMap.has(edge)) {
        return [`scenario references unknown node "${edge}"`];
      }
      queue.push(edge);
    }
  }

  const unreachable = scenario.nodes.filter((node) => !reachable.has(node.id)).map((node) => node.id);
  return unreachable.length > 0
    ? [`scenario has unreachable branches: ${unreachable.join(', ')}`]
    : [];
}

function requireAdminActor(req: Request, res: Response): CivicActor | null {
  const actor = currentActor(req);
  if (actor.role !== 'town_administrator') {
    res.status(403).json({ error: 'Forbidden: town_administrator role required', code: 'INSUFFICIENT_ROLE' });
    return null;
  }
  return actor;
}

export function createCivicFlowsRouter(db: DB): Router {
  const router = express.Router();

  router.get('/frameworks', (req, res) => {
    const actor = currentActor(req);
    res.json({ frameworks: listFlowFrameworks(db, actor.town_id as string) });
  });

  router.get('/', (req, res) => {
    const actor = currentActor(req);
    const status = typeof req.query.status === 'string' ? req.query.status as CivicFlowStatus : undefined;
    res.json({ flows: listFlows(db, actor.town_id as string, { status }) });
  });

  router.post('/', (req, res) => {
    const actor = requireAdminActor(req, res);
    if (!actor) {
      return;
    }

    const parsed = flowCreateSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid flow payload', issues: parsed.error.issues });
      return;
    }

    const framework = getCivicFlowFramework(parsed.data.framework_id);
    if (!framework) {
      res.status(400).json({ error: `Unknown framework_id: ${parsed.data.framework_id}` });
      return;
    }

    const reachabilityErrors = validateScenarioReachability(parsed.data.scenario);
    if (reachabilityErrors.length > 0) {
      res.status(400).json({ error: reachabilityErrors[0] });
      return;
    }

    const flow = createFlow(db, {
      orgId: actor.town_id as string,
      name: parsed.data.name,
      linkedApp: parsed.data.linked_app,
      frameworkId: parsed.data.framework_id,
      triggerSpec: parsed.data.trigger_spec,
      scenario: parsed.data.scenario,
      status: parsed.data.status,
      createdBy: actor.object_id,
    });

    if (flow.status === 'active') {
      registerFlow(db, flow.id, flow.org_id);
    }

    res.status(201).json(flow);
  });

  router.patch('/:id', (req, res) => {
    const actor = requireAdminActor(req, res);
    if (!actor) {
      return;
    }

    const parsed = flowUpdateSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid flow payload', issues: parsed.error.issues });
      return;
    }

    if (parsed.data.framework_id && !getCivicFlowFramework(parsed.data.framework_id)) {
      res.status(400).json({ error: `Unknown framework_id: ${parsed.data.framework_id}` });
      return;
    }

    if (parsed.data.scenario) {
      const reachabilityErrors = validateScenarioReachability(parsed.data.scenario);
      if (reachabilityErrors.length > 0) {
        res.status(400).json({ error: reachabilityErrors[0] });
        return;
      }
    }

    const existing = getFlow(db, actor.town_id as string, req.params.id);
    if (!existing) {
      res.status(404).json({ error: 'Flow not found' });
      return;
    }

    const updated = updateFlow(db, actor.town_id as string, req.params.id, {
      name: parsed.data.name,
      linkedApp: parsed.data.linked_app,
      frameworkId: parsed.data.framework_id,
      triggerSpec: parsed.data.trigger_spec,
      scenario: parsed.data.scenario,
      status: parsed.data.status,
    });

    insertAuditEvent(db, {
      orgId: actor.town_id as string,
      eventType: 'civic_flow.patch',
      resourceType: 'civic_flow',
      resourceId: req.params.id,
      actorId: actor.object_id,
      payload: { beforeStatus: existing.status, afterStatus: updated?.status ?? existing.status },
    });

    res.json(updated);
  });

  const transition = (status: CivicFlowStatus) => (req: Request, res: Response) => {
    const actor = requireAdminActor(req, res);
    if (!actor) {
      return;
    }

    const updated = updateFlow(db, actor.town_id as string, req.params.id, { status });
    if (!updated) {
      res.status(404).json({ error: 'Flow not found' });
      return;
    }

    if (status === 'active') {
      registerFlow(db, updated.id, updated.org_id);
    }

    insertAuditEvent(db, {
      orgId: actor.town_id as string,
      eventType: `civic_flow.${status}`,
      resourceType: 'civic_flow',
      resourceId: updated.id,
      actorId: actor.object_id,
      payload: { status },
    });

    res.json(updated);
  };

  router.post('/:id/activate', transition('active'));
  router.post('/:id/pause', transition('paused'));
  router.post('/:id/archive', transition('archived'));

  router.post('/:id/run', async (req, res) => {
    const actor = currentActor(req);
    const flow = getFlow(db, actor.town_id as string, req.params.id);
    if (!flow) {
      res.status(404).json({ error: 'Flow not found' });
      return;
    }
    if (flow.status !== 'active') {
      res.status(409).json({ error: 'Only active flows can run manually' });
      return;
    }

    const context = typeof req.body?.context === 'object' && req.body.context !== null
      ? req.body.context as Record<string, unknown>
      : {};

    const { run } = await executeFlow(db, flow.id, actor.town_id as string, {
      ...context,
      requestId: crypto.randomUUID(),
      manual: true,
    }, actor.object_id);

    res.status(202).json({ run_id: run.id, status: run.status });
  });

  router.get('/:id/runs', (req, res) => {
    const actor = currentActor(req);
    const flow = getFlow(db, actor.town_id as string, req.params.id);
    if (!flow) {
      res.status(404).json({ error: 'Flow not found' });
      return;
    }

    const page = Math.max(1, Number(req.query.page ?? 1) || 1);
    const perPage = Math.min(50, Math.max(1, Number(req.query.per_page ?? 10) || 10));
    const { runs, total } = listFlowRuns(db, actor.town_id as string, flow.id, page, perPage);
    res.json({
      runs,
      page,
      per_page: perPage,
      total,
    });
  });

  return router;
}
