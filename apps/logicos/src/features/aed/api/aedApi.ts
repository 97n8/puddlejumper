/**
 * aedApi.ts — typed client for /api/v1/aed/* PuddleJumper routes
 */

const PJ_BASE = (import.meta.env.VITE_PJ_API_URL ?? 'https://api.publiclogic.org') + '/api/v1/aed';

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
      window.dispatchEvent(new CustomEvent('aed:session-expired'));
    }
    throw Object.assign(new Error(err.error ?? 'AED API error'), { status: res.status, body: err });
  }
  return res.json() as Promise<T>;
}

export const aedApi = {
  me:        () => request<AEDMeResponse>('GET', '/me'),
  dashboard: () => request<AEDDashboard>('GET', '/dashboard'),

  deals: {
    list:   ()                     => request<{ deals: NMTCDeal[] }>('GET', '/deals'),
    get:    (id: string)           => request<NMTCDeal>('GET', `/deals/${id}`),
    create: (data: CreateDealBody) => request<NMTCDeal>('POST', '/deals', data),
    update: (id: string, data: Partial<NMTCDeal>) => request<NMTCDeal>('PATCH', `/deals/${id}`, data),
  },

  obligations: {
    list:     (dealId?: string) => {
      const qs = dealId ? `?deal_id=${dealId}` : '';
      return request<{ obligations: Obligation[] }>('GET', `/obligations${qs}`);
    },
    complete: (id: string, note?: string) =>
      request<Obligation>('POST', `/obligations/${id}/complete`, { note }),
    setStatus: (id: string, status: string) =>
      request<Obligation>('PATCH', `/obligations/${id}/status`, { status }),
  },

  qalicbs: {
    list:    (dealId?: string) => {
      const qs = dealId ? `?deal_id=${dealId}` : '';
      return request<{ qalicbs: QALICB[] }>('GET', `/qalicbs${qs}`);
    },
    create:  (data: CreateQALICBBody) => request<QALICB>('POST', '/qalicbs', data),
    certify: (id: string, certDate: string) =>
      request<QALICB>('PATCH', `/qalicbs/${id}/certify`, { cert_date: certDate }),
    setStatus: (id: string, status: string) =>
      request<QALICB>('PATCH', `/qalicbs/${id}/status`, { status }),
  },

  materialEvents: {
    list:   () => request<{ events: MaterialEvent[] }>('GET', '/material-events'),
    create: (data: CreateMaterialEventBody) => request<MaterialEvent>('POST', '/material-events', data),
    notify: (id: string) => request<MaterialEvent>('PATCH', `/material-events/${id}/notify`, {}),
  },

  governance: {
    authority: {
      list:   () => request<{ entries: AuthorityEntry[] }>('GET', '/governance/authority'),
      create: (data: CreateAuthorityBody) => request<AuthorityEntry>('POST', '/governance/authority', data),
    },
    access: {
      list:   () => request<{ entries: AccessEntry[] }>('GET', '/governance/access'),
      verify: (id: string) => request<AccessEntry>('PATCH', `/governance/access/${id}/verify`, {}),
    },
  },

  audit: () => request<{ entries: AuditEntry[] }>('GET', '/audit'),
};

// ── Types ─────────────────────────────────────────────────────────────────────

export interface AEDActor {
  id: string;
  object_id: string;
  email: string;
  display_name: string;
  role: 'aed_administrator' | 'compliance_officer' | 'staff';
}

export interface AEDMeResponse {
  actor: AEDActor;
}

export interface VaultScore {
  deal_id: string;
  deal_name: string;
  total: number;
  complete: number;
  overdue: number;
  score: number;
}

export interface AEDDashboard {
  actor: AEDActor;
  summary: {
    active_deals: number;
    total_obligations: number;
    complete_obligations: number;
    overdue_obligations: number;
    open_material_events: number;
    qalicbs_needing_cert: number;
  };
  vault_scores: VaultScore[];
  critical_obligations: Obligation[];
  open_material_events: MaterialEvent[];
  qalicbs_needing_cert: QALICB[];
}

export interface NMTCDeal {
  id: string;
  name: string;
  deal_number: string;
  qei_amount: number;
  close_date: string;
  year_7_date: string;
  cde_name: string;
  allocation_amount: number;
  status: 'active' | 'monitoring' | 'closed' | 'at_risk';
  vault_class: 'active' | 'archived';
  data: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface Obligation {
  id: string;
  obligation_code: string;
  domain: string;
  description: string;
  owner_role: string;
  backup_role: string;
  frequency: string;
  statute_ref: string;
  risk_level: 'critical' | 'high' | 'medium' | 'low';
  deal_id: string | null;
  status: 'pending' | 'complete' | 'overdue' | 'waived';
  due_date: string | null;
  completed_at: string | null;
  completed_by: string | null;
  created_at: string;
}

export interface QALICB {
  id: string;
  deal_id: string;
  business_name: string;
  census_tract: string;
  county: string;
  state: string;
  qlici_amount: number;
  qualification_date: string;
  last_certified_at: string | null;
  next_cert_due: string | null;
  status: 'qualified' | 'at_risk' | 'disqualified' | 'pending_review';
  contact_name: string;
  contact_email: string;
  created_at: string;
}

export interface MaterialEvent {
  id: string;
  deal_id: string | null;
  event_type: string;
  description: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  discovered_at: string;
  notification_due: string;
  notified_at: string | null;
  notified_by: string | null;
  seal_hash: string;
  created_by: string;
  created_at: string;
}

export interface AuthorityEntry {
  id: string;
  role: string;
  authority_type: string;
  scope: string;
  statute_ref: string;
  current_holder: string | null;
  backup_holder: string | null;
  threshold_amount: number | null;
  notes: string;
  created_at: string;
}

export interface AccessEntry {
  id: string;
  portal_name: string;
  portal_url: string;
  access_type: string;
  primary_holder: string | null;
  backup_holder: string | null;
  last_verified_at: string | null;
  verified_by: string | null;
  status: 'active' | 'needs_update' | 'expired' | 'pending_setup';
  notes: string;
  created_at: string;
}

export interface AuditEntry {
  id: string;
  actor_id: string;
  actor_email: string;
  action: string;
  object_type: string;
  object_id: string;
  metadata: string;
  created_at: string;
}

// ── Input types ───────────────────────────────────────────────────────────────

export interface CreateDealBody {
  name: string;
  deal_number: string;
  qei_amount: number;
  close_date: string;
  cde_name: string;
  allocation_amount: number;
}

export interface CreateQALICBBody {
  deal_id: string;
  business_name: string;
  census_tract: string;
  county: string;
  state: string;
  qlici_amount: number;
  qualification_date: string;
  contact_name: string;
  contact_email: string;
}

export interface CreateMaterialEventBody {
  deal_id?: string;
  event_type: string;
  description: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  discovered_at: string;
}

export interface CreateAuthorityBody {
  role: string;
  authority_type: string;
  scope: string;
  statute_ref: string;
  current_holder?: string;
  backup_holder?: string;
  threshold_amount?: number;
  notes?: string;
}
