/**
 * civicApi.ts — typed client for /api/v1/civic/* PuddleJumper routes
 */

const PJ_BASE = (import.meta.env.VITE_PJ_API_URL ?? 'https://api.publiclogic.org') + '/api/v1/civic';

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const isMutating = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)
  const res = await fetch(`${PJ_BASE}${path}`, {
    method,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(isMutating ? { 'x-puddlejumper-request': 'true' } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    if (res.status === 401) {
      window.dispatchEvent(new CustomEvent('civic:session-expired'));
    }
    throw Object.assign(new Error(err.error ?? 'Civic API error'), { status: res.status, body: err });
  }
  return res.json() as Promise<T>;
}

export const civicApi = {
  me: () => request<CivicMeResponse>('GET', '/me'),
  dashboard: () => request<DashboardSummary>('GET', '/dashboard'),
  objects: (params?: ObjectsQuery) => {
    const qs = params ? '?' + new URLSearchParams(params as Record<string, string>).toString() : '';
    return request<ObjectsResponse>('GET', `/objects${qs}`);
  },
  createObject: (data: CreateObjectBody) => request<CivicObject>('POST', '/objects', data),
  getObject: (id: string) => request<ObjectDetailResponse>('GET', `/objects/${id}`),
  setObjectStatus: (id: string, status: string) =>
    request<{ id: string; status: string }>('PATCH', `/objects/${id}/status`, { status }),
  exceptions: () => request<ExceptionsResponse>('GET', '/exceptions'),
  acknowledgeException: (id: string, reason: string) =>
    request<{ id: string; status: string; acknowledged_by: string }>('POST', `/exceptions/${id}/acknowledge`, { reason }),
  deadlines: () => request<DeadlinesResponse>('GET', '/deadlines'),
  templates: () => request<TemplatesResponse>('GET', '/templates'),
  audit: (objectId?: string, limit?: number) => {
    const qs = new URLSearchParams();
    if (objectId) qs.set('object_id', objectId);
    if (limit) qs.set('limit', String(limit));
    return request<AuditResponse>('GET', `/audit${qs.toString() ? '?' + qs : ''}`);
  },
  setup: {
    get: () => request<SetupProgress>('GET', '/setup'),
    patch: (data: Partial<SetupProgress>) => request<SetupProgress>('PATCH', '/setup', data),
  },
  watchFeed: () => request<WatchFeedResponse>('GET', '/watch/feed'),
  post: <T = unknown>(path: string, body: unknown) => request<T>('POST', path, body),
  get: <T = unknown>(path: string) => request<T>('GET', path),
  orgManagerStatus: () => request<{ complete: boolean }>('GET', '/org-manager/status'),
  flows: {
    frameworks: () => request<{ frameworks: CivicFlowFramework[] }>('GET', '/flows/frameworks'),
    list: (status?: FlowStatus) => {
      const qs = status ? `?status=${encodeURIComponent(status)}` : ''
      return request<{ flows: CivicFlow[] }>('GET', `/flows${qs}`)
    },
    create: (body: CreateCivicFlowBody) => request<CivicFlow>('POST', '/flows', body),
    update: (id: string, body: Partial<CreateCivicFlowBody & { status: FlowStatus }>) => request<CivicFlow>('PATCH', `/flows/${id}`, body),
    activate: (id: string) => request<CivicFlow>('POST', `/flows/${id}/activate`, {}),
    pause: (id: string) => request<CivicFlow>('POST', `/flows/${id}/pause`, {}),
    archive: (id: string) => request<CivicFlow>('POST', `/flows/${id}/archive`, {}),
    run: (id: string, context?: Record<string, unknown>) => request<{ run_id: string; status: FlowRunStatus }>('POST', `/flows/${id}/run`, { context: context ?? {} }),
    runs: (id: string, page = 1, perPage = 10) =>
      request<{ runs: CivicFlowRun[]; page: number; per_page: number; total: number }>('GET', `/flows/${id}/runs?page=${page}&per_page=${perPage}`),
  },
};

// ── Types ─────────────────────────────────────────────────────────────────────

export interface CivicActor {
  id: string;
  object_id: string;
  email: string;
  display_name: string;
  role: string;
  pj_user_id: string | null;
  town_id?: string | null;
}

export type FlowStatus = 'draft' | 'active' | 'paused' | 'archived'
export type FlowRunStatus = 'pending' | 'running' | 'succeeded' | 'failed' | 'halted_for_review'

export interface CivicFlowFramework {
  id: string
  name: string
  chapter: string
  primaryStatute: string
  domain: string
  linkedApps: string[]
  routing: Record<string, string>
  configured: boolean
}

export interface CivicFlowScenarioNode {
  id: string
  kind: 'condition' | 'action' | 'review_gate'
  title?: string
  detail?: string
  next?: string | null
  onTrue?: string | null
  onFalse?: string | null
  humanReview?: boolean
  key?: string
  equals?: unknown
}

export interface CivicFlowScenario {
  version: number
  rootId: string | null
  nodes: CivicFlowScenarioNode[]
}

export interface CivicFlow {
  id: string
  org_id: string
  name: string
  linked_app: string
  framework_id: string
  trigger_spec: Record<string, unknown>
  scenario: CivicFlowScenario
  status: FlowStatus
  created_at: string
  updated_at: string
  created_by: string
  last_run_at?: string | null
  last_run_status?: FlowRunStatus | null
  last_run_duration_ms?: number | null
}

export interface CivicFlowRun {
  id: string
  flow_id: string
  org_id: string
  started_at: string
  finished_at: string | null
  status: FlowRunStatus
  context: Record<string, unknown>
  error: string | null
}

export interface CreateCivicFlowBody {
  name: string
  linked_app: string
  framework_id: string
  trigger_spec: Record<string, unknown>
  scenario: CivicFlowScenario
  status?: FlowStatus
}

export interface CivicObject {
  id: string;
  type: string;
  subtype: string;
  stage: string;
  status: string;
  owner_id: string | null;
  authority_basis: string | null;
  vault_class: string;
  data: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface CivicException {
  id: string;
  object_id: string | null;
  exception_type: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  description: string | null;
  status: string;
  blocks_action: string | null;
  acknowledged_by: string | null;
  acknowledged_at: string | null;
  acknowledgment_reason: string | null;
  created_at: string;
  object_subtype?: string;
}

export interface CivicDeadline {
  id: string;
  object_id: string | null;
  label: string;
  type: string;
  statute_ref: string | null;
  due_at: string;
  owner_id: string | null;
  severity: string;
  status: string;
  object_subtype?: string;
}

export interface CivicTemplate {
  id: string;
  name: string;
  category: string;
  description: string | null;
  body: string;
  variables: string; // JSON array
}

export interface AuditEntry {
  id: string;
  object_id: string | null;
  actor_id: string;
  actor_display: string | null;
  action: string;
  before_state: string | null;
  after_state: string | null;
  system_triggered: number;
  notes: string | null;
  created_at: string;
}

export interface SetupProgress {
  id: string;
  town: number;
  identity: number;
  staff: number;
  bodies: number;
  completed_at: string | null;
  completed_by: string | null;
}

export interface DashboardSummary {
  due_this_week: (CivicDeadline & { object_subtype?: string })[];
  exceptions: CivicException[];
  open_records_requests: CivicObject[];
  active_procurements: CivicObject[];
  contracts_expiring: (CivicObject & { expiry_at: string })[];
  ownerless_count: number;
  unclassified_count: number;
  vault_score: { authority: number; accountability: number; boundary: number; continuity: number; records: number; overall: number; operational_mode: string };
  pj_feed: AuditEntry[];
}

export interface CivicMeResponse {
  actor: CivicActor;
  object: CivicObject | null;
  town: Record<string, unknown> | null;
}

export interface ObjectsResponse { objects: CivicObject[]; total: number; }
export interface ObjectDetailResponse { object: CivicObject; audit: AuditEntry[]; }
export interface ExceptionsResponse { exceptions: CivicException[]; }
export interface DeadlinesResponse { deadlines: CivicDeadline[]; }
export interface TemplatesResponse { templates: CivicTemplate[]; }
export interface AuditResponse { entries: AuditEntry[]; }
export interface WatchFeedResponse { feed: AuditEntry[]; }
export interface CreateObjectBody { type: string; subtype: string; status?: string; vault_class?: string; owner_id?: string; data?: Record<string, unknown>; }
export interface ObjectsQuery { type?: string; subtype?: string; status?: string; vault_class?: string; }
