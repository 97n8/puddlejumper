import crypto from 'node:crypto';
import { EventEmitter } from 'node:events';
import type { Database as DB } from 'better-sqlite3';
import {
  getFlow,
  insertAuditEvent,
  insertFlowRunWithSteps,
  resolveFrameworkOrThrow,
  resolveOrgRouting,
  type CivicFlowRecord,
  type CivicFlowRunRecord,
  type CivicFlowStepKind,
  type CivicFlowStepRecord,
} from '../flowStore.js';

type ScenarioNode = {
  id: string;
  kind: CivicFlowStepKind;
  title?: string;
  detail?: string;
  next?: string | null;
  onTrue?: string | null;
  onFalse?: string | null;
  humanReview?: boolean;
  key?: string;
  equals?: unknown;
};

type ScenarioGraph = {
  rootId: string | null;
  nodes: ScenarioNode[];
};

const eventBus = new EventEmitter();
const subscriptions = new Map<string, Set<string>>();
const initializedDbs = new WeakSet<DB>();

function normalizeScenario(flow: CivicFlowRecord): ScenarioGraph {
  const raw = flow.scenario as {
    rootId?: string;
    nodes?: ScenarioNode[];
    logicSteps?: Array<{ id?: string; kind?: string; title?: string; detail?: string; humanReview?: boolean }>;
  };

  if (Array.isArray(raw.nodes) && raw.nodes.length > 0) {
    return {
      rootId: raw.rootId ?? raw.nodes[0]?.id ?? null,
      nodes: raw.nodes.map((node) => ({ ...node })),
    };
  }

  if (Array.isArray(raw.logicSteps) && raw.logicSteps.length > 0) {
    const logicSteps = raw.logicSteps;
    const nodes: ScenarioNode[] = [
      {
        id: 'base-action',
        kind: 'action',
        title: flow.name,
        detail: flow.linked_app,
        next: logicSteps[0]?.id ?? 'logic-0',
      },
    ];
    logicSteps.forEach((step, index) => {
      nodes.push({
        id: step.id ?? `logic-${index}`,
        kind: step.kind === 'if' ? 'condition' : step.kind === 'review_gate' ? 'review_gate' : 'action',
        title: step.title,
        detail: step.detail,
        next: logicSteps[index + 1]?.id ?? null,
        onTrue: step.kind === 'if' ? logicSteps[index + 1]?.id ?? null : undefined,
        onFalse: step.kind === 'if' ? null : undefined,
        humanReview: Boolean(step.humanReview),
      });
    });
    return { rootId: nodes[0]?.id ?? null, nodes };
  }

  return {
    rootId: null,
    nodes: [],
  };
}

function buildScenarioMap(graph: ScenarioGraph): Map<string, ScenarioNode> {
  return new Map(graph.nodes.map((node) => [node.id, node]));
}

function evaluateCondition(node: ScenarioNode, context: Record<string, unknown>): boolean {
  if (typeof node.key === 'string') {
    return context[node.key] === node.equals;
  }
  if (typeof node.title === 'string' && node.title.trim()) {
    const key = node.title.trim().toLowerCase().replace(/\s+/g, '_');
    if (key in context) {
      return Boolean(context[key]);
    }
  }
  return true;
}

function shouldTriggerHumanReview(node: ScenarioNode, context: Record<string, unknown>): boolean {
  if (node.humanReview) {
    return true;
  }
  const reviewNodes = context.reviewNodes;
  return Array.isArray(reviewNodes) && reviewNodes.includes(node.id);
}

function shouldFailAction(node: ScenarioNode, context: Record<string, unknown>): string | null {
  if (context.failAllActions === true) {
    return `Action "${node.title ?? node.id}" failed because failAllActions was set`;
  }
  const failActionId = typeof context.failActionId === 'string' ? context.failActionId : null;
  if (failActionId && failActionId === node.id) {
    return `Action "${node.title ?? node.id}" failed because failActionId matched`;
  }
  return null;
}

function resolveTriggerKey(flow: CivicFlowRecord): string {
  const triggerSpec = flow.trigger_spec as { eventType?: unknown; type?: unknown };
  return typeof triggerSpec.eventType === 'string'
    ? triggerSpec.eventType
    : typeof triggerSpec.type === 'string'
      ? triggerSpec.type
      : 'manual';
}

function ensureRuntimeInitialized(db: DB): void {
  if (initializedDbs.has(db)) {
    return;
  }
  initializedDbs.add(db);
  const activeFlows = db.prepare(`
    SELECT id, org_id
    FROM civic_flows
    WHERE status = 'active'
  `).all() as Array<{ id: string; org_id: string }>;
  for (const flow of activeFlows) {
    registerFlow(db, flow.id, flow.org_id);
  }
}

export function registerFlow(db: DB, flowId: string, orgId: string): { flowId: string; eventKey: string } {
  const flow = getFlow(db, orgId, flowId);
  if (!flow) {
    throw new Error(`Flow not found: ${flowId}`);
  }

  const eventKey = `${orgId}:${resolveTriggerKey(flow)}`;
  if (!subscriptions.has(eventKey)) {
    subscriptions.set(eventKey, new Set());
    eventBus.on(eventKey, async (payload: Record<string, unknown>) => {
      const subscribed = Array.from(subscriptions.get(eventKey) ?? []);
      for (const subscribedFlowId of subscribed) {
        await executeFlow(db, subscribedFlowId, orgId, payload, 'system:eventbus');
      }
    });
  }
  subscriptions.get(eventKey)!.add(flowId);
  return { flowId, eventKey };
}

export async function emitFlowEvent(
  db: DB,
  orgId: string,
  eventType: string,
  context: Record<string, unknown>,
): Promise<void> {
  ensureRuntimeInitialized(db);
  await eventBus.emit(`${orgId}:${eventType}`, context);
}

export async function executeFlow(
  db: DB,
  flowId: string,
  orgId: string,
  context: Record<string, unknown>,
  actorId: string,
): Promise<{ run: CivicFlowRunRecord; steps: CivicFlowStepRecord[] }> {
  ensureRuntimeInitialized(db);
  const flow = getFlow(db, orgId, flowId);
  if (!flow) {
    throw new Error('Flow not found');
  }
  if (flow.status !== 'active') {
    throw new Error('Only active flows can run');
  }

  const framework = resolveFrameworkOrThrow(flow.framework_id);
  const routing = resolveOrgRouting(db, orgId, flow.framework_id);
  const graph = normalizeScenario(flow);
  const nodeMap = buildScenarioMap(graph);
  const startedAt = new Date().toISOString();
  const runId = crypto.randomUUID();
  const steps: CivicFlowStepRecord[] = [];

  let status: CivicFlowRunRecord['status'] = 'succeeded';
  let error: string | null = null;
  let nextNodeId = graph.rootId;
  const visited = new Set<string>();
  let stepIndex = 0;

  try {
    while (nextNodeId) {
      if (visited.has(nextNodeId)) {
        throw new Error(`Scenario loop detected at node ${nextNodeId}`);
      }
      visited.add(nextNodeId);

      const node = nodeMap.get(nextNodeId);
      if (!node) {
        throw new Error(`Scenario node not found: ${nextNodeId}`);
      }

      const ts = new Date().toISOString();
      if (node.kind === 'condition') {
        const result = evaluateCondition(node, context);
        steps.push({
          id: crypto.randomUUID(),
          run_id: runId,
          step_index: stepIndex++,
          kind: 'condition',
          input: { context, node },
          output: { matched: result },
          decided_by: 'system',
          actor_id: actorId,
          status: result ? 'matched' : 'not_matched',
          ts,
        });
        nextNodeId = result ? (node.onTrue ?? node.next ?? null) : (node.onFalse ?? null);
        continue;
      }

      if (node.kind === 'review_gate' || shouldTriggerHumanReview(node, context)) {
        steps.push({
          id: crypto.randomUUID(),
          run_id: runId,
          step_index: stepIndex++,
          kind: 'review_gate',
          input: { context, node },
          output: { halted: true, reason: 'human_review' },
          decided_by: 'human',
          actor_id: actorId,
          status: 'halted_for_review',
          ts,
        });
        status = 'halted_for_review';
        insertAuditEvent(db, {
          orgId,
          eventType: 'civic_flow.halted_for_review',
          resourceType: 'civic_flow_run',
          resourceId: runId,
          actorId,
          payload: { flowId: flow.id, nodeId: node.id, framework: framework.chapter },
        });
        nextNodeId = null;
        break;
      }

      const failure = shouldFailAction(node, context);
      if (failure) {
        throw new Error(failure);
      }

      steps.push({
        id: crypto.randomUUID(),
        run_id: runId,
        step_index: stepIndex++,
        kind: 'action',
        input: { context, node, framework: flow.framework_id },
        output: {
          executed: true,
          resolved_by: 'org-manager',
          routes: routing,
          framework_chapter: framework.chapter,
          linked_app: flow.linked_app,
        },
        decided_by: 'system',
        actor_id: actorId,
        status: 'succeeded',
        ts,
      });
      nextNodeId = node.next ?? null;
    }
  } catch (err) {
    status = 'failed';
    error = err instanceof Error ? err.message : String(err);
    insertAuditEvent(db, {
      orgId,
      eventType: 'civic_flow.failed',
      resourceType: 'civic_flow_run',
      resourceId: runId,
      actorId,
      payload: { flowId: flow.id, error, stepIndex },
    });
  }

  const finishedAt = new Date().toISOString();
  const run: CivicFlowRunRecord = {
    id: runId,
    flow_id: flow.id,
    org_id: orgId,
    started_at: startedAt,
    finished_at: finishedAt,
    status,
    context,
    error,
  };

  insertFlowRunWithSteps(db, run, steps);
  insertAuditEvent(db, {
    orgId,
    eventType: 'civic_flow.run_recorded',
    resourceType: 'civic_flow_run',
    resourceId: run.id,
    actorId,
    payload: {
      flowId: flow.id,
      status: run.status,
      stepCount: steps.length,
      finishedAt,
    },
  });

  return { run, steps };
}
