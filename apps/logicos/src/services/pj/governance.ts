import { pjFetch, PJ } from './_base'
import type { ArchieveChainSummary, ArchieveEvent, ArchieveNotarization, ArchieveRule, ArchieveVerifyResult, DemoMemberTemplate, DiscoveryResult, DiscoveryRule, HealthMetrics, PJHealthResponse, RuleRecommendation, TenantRecord } from './types'

export const governanceDomain = {
// ── ARCHIEVE — Immutable Audit Log ──────────────────────────────────────

archieve: {
  /** GET /api/archieve/events — paginated event stream with filters */
  events: (filters: {
    after?: string; before?: string; eventType?: string; module?: string;
    actor?: string; severity?: string; workspaceId?: string; automationId?: string;
    recordId?: string; page?: number; limit?: number; tenantId?: string;
  } = {}): Promise<{ events: ArchieveEvent[]; total: number; page: number; pages: number }> => {
    const params = new URLSearchParams()
    Object.entries(filters).forEach(([k, v]) => { if (v != null) params.set(k, String(v)) })
    return pjFetch(`${PJ}/api/archieve/events?${params}`, { credentials: 'include' }).then(r => r.json())
  },
  /** GET /api/archieve/events/:eventId — single event */
  getEvent: (eventId: string): Promise<{ event: ArchieveEvent }> =>
    pjFetch(`${PJ}/api/archieve/events/${encodeURIComponent(eventId)}`, { credentials: 'include' }).then(r => r.json()),
  /** GET /api/archieve/chain — chain summary */
  chain: (): Promise<ArchieveChainSummary> =>
    pjFetch(`${PJ}/api/archieve/chain`, { credentials: 'include' }).then(r => r.json()),
  /** POST /api/archieve/verify — run chain integrity verification */
  verify: (): Promise<ArchieveVerifyResult> =>
    pjFetch(`${PJ}/api/archieve/verify`, { method: 'POST', credentials: 'include' }).then(r => r.json()),
  /** GET /api/archieve/notarizations — list TSA notarization records */
  notarizations: (): Promise<{ notarizations: ArchieveNotarization[] }> =>
    pjFetch(`${PJ}/api/archieve/notarizations`, { credentials: 'include' }).then(r => r.json()),
  /** GET /api/archieve/export — download event archive for date range */
  exportUrl: (after: string, before: string): string =>
    `${PJ}/api/archieve/export?after=${encodeURIComponent(after)}&before=${encodeURIComponent(before)}`,
},

// ── SEAL ─────────────────────────────────────────────────────────────────

seal: {
  /** POST /api/seal/verify — verify a SealToken against an artifact */
  verify: (artifact: string, token: Record<string, unknown>): Promise<{
    valid: boolean; reason?: string; keyId: string; tenantId: string; signedAt: string; tsaVerified: boolean | null
  }> =>
    pjFetch(`${PJ}/api/seal/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ artifact, token }),
    }).then(r => r.json()),

  /** GET /api/seal/public-key?tenantId=&keyId= — public PEM (no auth) */
  publicKey: (tenantId: string, keyId: string): Promise<{
    keyId: string; tenantId: string; algorithm: string; publicKeyPem: string; validFrom: string; supersededAt: string | null
  }> =>
    fetch(`${PJ}/api/seal/public-key?tenantId=${encodeURIComponent(tenantId)}&keyId=${encodeURIComponent(keyId)}`).then(r => r.json()),

  /** GET /api/seal/keys — list ESK versions for caller's tenant */
  keys: (): Promise<Array<{ keyId: string; validFrom: string; supersededAt: string | null; algorithm: string }>> =>
    pjFetch(`${PJ}/api/seal/keys`, { credentials: 'include' }).then(r => r.json()),

  /** POST /api/seal/rotate — rotate active ESK (platform-admin only) */
  rotate: (tenantId: string): Promise<{ newKeyId: string; publicKeyPem: string; privateKeyPem: string; warning: string }> =>
    pjFetch(`${PJ}/api/seal/rotate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ tenantId }),
    }).then(r => r.json()),

  /** POST /api/seal/provision — provision new tenant ESK (platform-admin only) */
  provision: (tenantId: string): Promise<{ newKeyId: string; publicKeyPem: string; privateKeyPem: string; warning: string }> =>
    pjFetch(`${PJ}/api/seal/provision`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ tenantId }),
    }).then(r => r.json()),
},

// ── System ───────────────────────────────────────────────────────────────

system: {
  /** GET /v1/health — PJ Build Spec §8.1 response format */
  health: (): Promise<PJHealthResponse> =>
    fetch(`${PJ}/v1/health`).then(r => r.json()),
  /** GET /v1/metrics — redirect to Prometheus metrics */
  metricsUrl: (): string => `${PJ}/v1/metrics`,
},

// ── Health Metrics ────────────────────────────────────────────────────────

health: {
  /** GET /api/health/metrics — live operational metrics */
  metrics: (): Promise<{ metrics: HealthMetrics }> =>
    pjFetch(`${PJ}/api/health/metrics`, { credentials: 'include' }).then(r => r.json()),
},

// ── Discovery ────────────────────────────────────────────────────────────

discover: {
  /** POST /api/discover/query — AI-powered case type + obligation discovery */
  query: (body: { question: string; jurisdictionId?: string }): Promise<DiscoveryResult> =>
    pjFetch(`${PJ}/api/discover/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }).then(r => r.json()),

  /** GET /api/discover/rules — list discovery rules for this tenant */
  listRules: (): Promise<{ rules: DiscoveryRule[] }> =>
    pjFetch(`${PJ}/api/discover/rules`, { credentials: 'include' }).then(r => r.json()),

  /** POST /api/discover/rules — create a discovery rule */
  createRule: (body: Omit<DiscoveryRule, 'id' | 'tenant_id' | 'created_at'>): Promise<{ rule: DiscoveryRule }> =>
    pjFetch(`${PJ}/api/discover/rules`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }).then(r => r.json()),

  /** GET /api/discover/history — past discovery queries */
  history: (): Promise<{ queries: Array<{ id: string; question: string; result: DiscoveryResult; created_at: string }> }> =>
    pjFetch(`${PJ}/api/discover/history`, { credentials: 'include' }).then(r => r.json()),
},

// ── ARCHIEVE Rules ────────────────────────────────────────────────────────

rules: {
  /** GET /api/rules — list governance rules */
  list: (): Promise<{ rules: ArchieveRule[] }> =>
    pjFetch(`${PJ}/api/rules`, { credentials: 'include' }).then(r => r.json()),

  /** GET /api/rules/pending — rules awaiting human approval */
  listPending: (): Promise<{ rules: ArchieveRule[] }> =>
    pjFetch(`${PJ}/api/rules/pending`, { credentials: 'include' }).then(r => r.json()),

  /** GET /api/rules/recommendations — AI-suggested rules from discovery history */
  recommendations: (): Promise<{ recommendations: RuleRecommendation[] }> =>
    pjFetch(`${PJ}/api/rules/recommendations`, { credentials: 'include' }).then(r => r.json()),

  /** GET /api/rules/:id */
  get: (id: string): Promise<{ rule: ArchieveRule }> =>
    pjFetch(`${PJ}/api/rules/${id}`, { credentials: 'include' }).then(r => r.json()),

  /** POST /api/rules — ingest a new rule (validates schema, logs to ARCHIEVE) */
  ingest: (body: {
    title: string; description: string; jurisdiction: string
    category: ArchieveRule['category']; conditions: ArchieveRule['conditions']
    actions: ArchieveRule['actions']; source?: ArchieveRule['source']
    ai_confidence?: number
  }): Promise<{ rule: ArchieveRule }> =>
    pjFetch(`${PJ}/api/rules`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }).then(r => r.json()),

  /** POST /api/rules/:id/approve — approve or reject a pending rule */
  approve: (id: string, approve: boolean, rejectionReason?: string): Promise<{ ok: boolean; status: string }> =>
    pjFetch(`${PJ}/api/rules/${id}/approve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ approve, rejectionReason }),
    }).then(r => r.json()),

  /** PUT /api/rules/:id/status */
  updateStatus: (id: string, status: ArchieveRule['status']): Promise<{ rule: ArchieveRule }> =>
    pjFetch(`${PJ}/api/rules/${id}/status`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    }).then(r => r.json()),
},

// ── Admin ────────────────────────────────────────────────────────────────

admin: {
  /** GET /api/admin/stats */
  stats: (): Promise<unknown> =>
    pjFetch(`${PJ}/api/admin/stats`, { credentials: 'include' }).then(r => r.json()),
  /** PATCH /api/admin/workspace/:id/plan — update workspace plan */
  updatePlan: (workspaceId: string, plan: string): Promise<unknown> =>
    pjFetch(`${PJ}/api/admin/workspace/${encodeURIComponent(workspaceId)}/plan`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plan }),
    }).then(r => r.json()),
  /** GET /api/admin/audit/export */
  auditExport: (): Promise<unknown> =>
    pjFetch(`${PJ}/api/admin/audit/export`, { credentials: 'include' }).then(r => r.json()),

  /** GET /api/admin/member-templates — backend-owned demo member templates */
  listMemberTemplates: (): Promise<{ success: boolean; data: DemoMemberTemplate[] }> =>
    pjFetch(`${PJ}/api/admin/member-templates`, { credentials: 'include' }).then(r => r.json()),

  // ── Member management ──────────────────────────────────────────────────

  /** GET /api/admin/members — list all workspace members (OAuth + local) */
  listMembers: (): Promise<{ success: boolean; data: Array<{ id: string; userId: string; role: string; toolAccess: string[] | null; accountType: 'local' | 'oauth'; name: string; email?: string; username?: string; mustChangePassword?: boolean; joinedAt: string }> }> =>
    pjFetch(`${PJ}/api/admin/members`, { credentials: 'include' }).then(r => r.json()),

  /** POST /api/admin/members — create a local user + add to workspace */
  createMember: (data: { username: string; temporaryPassword: string; name: string; email?: string; role?: string; toolAccess?: string[]; mustChangePassword?: boolean }): Promise<{ success: boolean; data?: { userId: string; username: string; name: string; mustChangePassword?: boolean }; error?: string }> =>
    pjFetch(`${PJ}/api/admin/members`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }).then(r => r.json()),

  /** POST /api/admin/member-templates/:templateId/provision — create/update a backend demo user */
  provisionMemberTemplate: (templateId: string, password: string, requirePasswordChange?: boolean): Promise<{ success: boolean; data?: { created: boolean; userId: string; username: string; name: string; email: string; mustChangePassword: boolean }; error?: string }> =>
    pjFetch(`${PJ}/api/admin/member-templates/${encodeURIComponent(templateId)}/provision`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password, requirePasswordChange }),
    }).then(r => r.json()),

  /** PATCH /api/admin/members/:userId/role */
  updateMemberRole: (userId: string, role: 'admin' | 'member' | 'viewer'): Promise<{ success: boolean }> =>
    pjFetch(`${PJ}/api/admin/members/${encodeURIComponent(userId)}/role`, {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role }),
    }).then(r => r.json()),

  /** PATCH /api/admin/members/:userId/tools */
  updateMemberTools: (userId: string, toolAccess: string[] | null): Promise<{ success: boolean }> =>
    pjFetch(`${PJ}/api/admin/members/${encodeURIComponent(userId)}/tools`, {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ toolAccess }),
    }).then(r => r.json()),

  /** PATCH /api/admin/members/:userId/password — admin resets password, sets must_change_password */
  resetMemberPassword: (userId: string, temporaryPassword: string, requirePasswordChange = true): Promise<{ success: boolean; data?: { mustChangePassword: boolean } }> =>
    pjFetch(`${PJ}/api/admin/members/${encodeURIComponent(userId)}/password`, {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ temporaryPassword, requirePasswordChange }),
    }).then(r => r.json()),

  /** DELETE /api/admin/members/:userId */
  removeMember: (userId: string, deleteAccount?: boolean): Promise<{ success: boolean }> =>
    pjFetch(`${PJ}/api/admin/members/${encodeURIComponent(userId)}${deleteAccount ? '?deleteAccount=true' : ''}`, {
      method: 'DELETE',
      credentials: 'include',
    }).then(r => r.json()),

  // ── Tenant provisioning ────────────────────────────────────────────────

  /** GET /api/admin/tenants — list all tenants (platform-admin only) */
  listTenants: (): Promise<{ tenants: TenantRecord[] }> =>
    pjFetch(`${PJ}/api/admin/tenants`, { credentials: 'include' }).then(r => r.json()),

  /** POST /api/admin/tenants/provision — provision a new tenant */
  provisionTenant: (body: {
    slug: string; name: string
    jurisdictionType: TenantRecord['jurisdiction_type']
    jurisdictionId?: string; state?: string; contactEmail?: string
    plan?: TenantRecord['plan']
  }): Promise<{ tenant: TenantRecord }> =>
    pjFetch(`${PJ}/api/admin/tenants/provision`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }).then(r => r.json()),

  /** PUT /api/admin/tenants/:id/status */
  updateTenantStatus: (id: string, status: TenantRecord['status']): Promise<{ tenant: TenantRecord }> =>
    pjFetch(`${PJ}/api/admin/tenants/${id}/status`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    }).then(r => r.json()),
},

}
