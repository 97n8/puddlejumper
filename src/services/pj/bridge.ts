import { pjFetch, PJ } from './_base'
import type { FKConsentRecord, FKFormDefinition, FKIntakeRecord, FKIntakeStatus, FKReview, FKLegalBasis, LBConnector, LBSimResult, NormalizeResult, TaskItem } from './types'

export const bridgeDomain = {
// ── SYNCRONATE ────────────────────────────────────────────────────────────

syncronate: {
  // Dashboard
  dashboard: (): Promise<unknown> =>
    pjFetch(`${PJ}/api/syncronate/dashboard`, { credentials: 'include' }).then(r => r.json()),
  connectors: (): Promise<unknown> =>
    pjFetch(`${PJ}/api/syncronate/connectors`, { credentials: 'include' }).then(r => r.json()),

  // Feed management
  createFeed: (feed: Record<string, unknown>): Promise<unknown> =>
    pjFetch(`${PJ}/api/syncronate/feeds`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(feed),
    }).then(r => r.json()),
  updateFeed: (feedId: string, patch: Record<string, unknown>): Promise<unknown> =>
    pjFetch(`${PJ}/api/syncronate/feeds/${encodeURIComponent(feedId)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(patch),
    }).then(r => r.json()),
  listFeeds: (): Promise<unknown> =>
    pjFetch(`${PJ}/api/syncronate/feeds`, { credentials: 'include' }).then(r => r.json()),
  getFeed: (feedId: string): Promise<unknown> =>
    pjFetch(`${PJ}/api/syncronate/feeds/${encodeURIComponent(feedId)}`, { credentials: 'include' }).then(r => r.json()),
  schedulePreview: (feedId: string, count = 5): Promise<{ feedId: string; scheduleExpression: string | null; nextOccurrences: string[] }> =>
    pjFetch(`${PJ}/api/syncronate/feeds/${encodeURIComponent(feedId)}/schedule-preview?count=${count}`, { credentials: 'include' }).then(r => r.json()),
  activateFeed: (feedId: string): Promise<unknown> =>
    pjFetch(`${PJ}/api/syncronate/feeds/${encodeURIComponent(feedId)}/activate`, {
      method: 'POST', credentials: 'include',
    }).then(r => r.json()),
  pauseFeed: (feedId: string): Promise<unknown> =>
    pjFetch(`${PJ}/api/syncronate/feeds/${encodeURIComponent(feedId)}/pause`, {
      method: 'POST', credentials: 'include',
    }).then(r => r.json()),
  retireFeed: (feedId: string): Promise<unknown> =>
    pjFetch(`${PJ}/api/syncronate/feeds/${encodeURIComponent(feedId)}/retire`, {
      method: 'POST', credentials: 'include',
    }).then(r => r.json()),

  // Jobs
  triggerSync: (feedId: string): Promise<unknown> =>
    pjFetch(`${PJ}/api/syncronate/feeds/${encodeURIComponent(feedId)}/sync`, {
      method: 'POST', credentials: 'include',
    }).then(r => r.json()),
  listJobs: (feedId: string): Promise<unknown> =>
    pjFetch(`${PJ}/api/syncronate/feeds/${encodeURIComponent(feedId)}/jobs`, { credentials: 'include' }).then(r => r.json()),
  getJob: (feedId: string, jobId: string): Promise<unknown> =>
    pjFetch(`${PJ}/api/syncronate/feeds/${encodeURIComponent(feedId)}/jobs/${encodeURIComponent(jobId)}`, { credentials: 'include' }).then(r => r.json()),
  retrySinks: (feedId: string, jobId: string): Promise<unknown> =>
    pjFetch(`${PJ}/api/syncronate/feeds/${encodeURIComponent(feedId)}/jobs/${encodeURIComponent(jobId)}/retry-sinks`, {
      method: 'POST', credentials: 'include',
    }).then(r => r.json()),

  // Records
  listRecords: (feedId: string, filters?: Record<string, unknown>): Promise<unknown> => {
    const params = filters ? '?' + new URLSearchParams(filters as Record<string, string>).toString() : '';
    return pjFetch(`${PJ}/api/syncronate/feeds/${encodeURIComponent(feedId)}/records${params}`, { credentials: 'include' }).then(r => r.json());
  },
  getRecord: (feedId: string, recordId: string): Promise<unknown> =>
    pjFetch(`${PJ}/api/syncronate/feeds/${encodeURIComponent(feedId)}/records/${encodeURIComponent(recordId)}`, { credentials: 'include' }).then(r => r.json()),

  // Audit
  feedAudit: (feedId: string): Promise<unknown> =>
    pjFetch(`${PJ}/api/syncronate/feeds/${encodeURIComponent(feedId)}/audit`, { credentials: 'include' }).then(r => r.json()),
  dlpReport: (feedId: string): Promise<unknown> =>
    pjFetch(`${PJ}/api/syncronate/feeds/${encodeURIComponent(feedId)}/dlp-report`, { credentials: 'include' }).then(r => r.json()),
},

// ── LOGICBRIDGE ───────────────────────────────────────────────────────────

logicbridge: {
  /** GET /api/logicbridge/connectors */
  list: (): Promise<{ connectors: LBConnector[] }> =>
    pjFetch(`${PJ}/api/logicbridge/connectors`, { credentials: 'include' }).then(r => r.json()),

  /** POST /api/logicbridge/connectors */
  create: (body: { name: string; connectorId: string; description?: string; baseUrl?: string; capabilities?: string[]; dataTypes?: string[]; allowedProfiles?: string[]; samplePayload?: string; handlerCode?: string }): Promise<{ connector: LBConnector }> =>
    pjFetch(`${PJ}/api/logicbridge/connectors`, {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }).then(r => r.json()),

  /** GET /api/logicbridge/connectors/:id */
  get: (id: string): Promise<{ connector: LBConnector }> =>
    pjFetch(`${PJ}/api/logicbridge/connectors/${encodeURIComponent(id)}`, { credentials: 'include' }).then(r => r.json()),

  /** PATCH /api/logicbridge/connectors/:id */
  update: (id: string, body: Partial<{ name: string; description: string; baseUrl: string; capabilities: string[]; dataTypes: string[]; allowedProfiles: string[]; samplePayload: string; handlerCode: string }>): Promise<{ connector: LBConnector }> =>
    pjFetch(`${PJ}/api/logicbridge/connectors/${encodeURIComponent(id)}`, {
      method: 'PATCH', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }).then(r => r.json()),

  /** DELETE /api/logicbridge/connectors/:id */
  delete: (id: string): Promise<{ ok: boolean }> =>
    pjFetch(`${PJ}/api/logicbridge/connectors/${encodeURIComponent(id)}`, {
      method: 'DELETE', credentials: 'include',
    }).then(r => r.json()),

  /** POST /api/logicbridge/connectors/:id/simulate */
  simulate: (id: string): Promise<{ result: LBSimResult }> =>
    pjFetch(`${PJ}/api/logicbridge/connectors/${encodeURIComponent(id)}/simulate`, {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    }).then(r => r.json()),

  /** POST /api/logicbridge/connectors/:id/publish */
  publish: (id: string): Promise<{ connector: LBConnector }> =>
    pjFetch(`${PJ}/api/logicbridge/connectors/${encodeURIComponent(id)}/publish`, {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    }).then(r => r.json()),

  /** POST /api/logicbridge/connectors/:id/deprecate */
  deprecate: (id: string, reason: string): Promise<{ connector: LBConnector }> =>
    pjFetch(`${PJ}/api/logicbridge/connectors/${encodeURIComponent(id)}/deprecate`, {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason }),
    }).then(r => r.json()),

  /** POST /api/logicbridge/connectors/:id/test */
  test: (id: string, payload: unknown): Promise<{ success: boolean; error?: string; result?: unknown }> =>
    pjFetch(`${PJ}/api/logicbridge/connectors/${encodeURIComponent(id)}/test`, {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ payload }),
    }).then(r => r.json()),

  /** POST /api/logicbridge/registry/reload */
  reloadRegistry: (): Promise<{ registered: number }> =>
    pjFetch(`${PJ}/api/logicbridge/registry/reload`, {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    }).then(r => r.json()),

  /** POST /api/logicbridge/explorer/request */
  explorerRequest: (body: { provider: string; endpoint: string; method: string; params?: Record<string, unknown> }): Promise<{ data: unknown; rendered?: unknown }> =>
    pjFetch(`${PJ}/api/logicbridge/explorer/request`, {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }).then(r => r.json()),

  /** GET /api/logicbridge/connectors/:id/kv — list credential key names */
  kvList: (id: string): Promise<{ keys: string[] }> =>
    pjFetch(`${PJ}/api/logicbridge/connectors/${encodeURIComponent(id)}/kv`, { credentials: 'include' }).then(r => r.json()),

  /** PUT /api/logicbridge/connectors/:id/kv/:key — store a credential value */
  kvSet: (id: string, key: string, value: string): Promise<{ ok: boolean }> =>
    pjFetch(`${PJ}/api/logicbridge/connectors/${encodeURIComponent(id)}/kv/${encodeURIComponent(key)}`, {
      method: 'PUT', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ value }),
    }).then(r => r.json()),

  /** DELETE /api/logicbridge/connectors/:id/kv/:key — remove a credential */
  kvDelete: (id: string, key: string): Promise<{ ok: boolean }> =>
    pjFetch(`${PJ}/api/logicbridge/connectors/${encodeURIComponent(id)}/kv/${encodeURIComponent(key)}`, {
      method: 'DELETE', credentials: 'include',
    }).then(r => r.json()),
},

  formkey: {
  // Form Definition CRUD
    list: (status?: string): Promise<{ forms: FKFormDefinition[] }> =>
      pjFetch(`${PJ}/api/vault/forms${status ? `?status=${status}` : ''}`, { credentials: 'include' }).then(r => r.json()),

  get: (id: string): Promise<{ form: FKFormDefinition }> =>
      pjFetch(`${PJ}/api/vault/forms/${encodeURIComponent(id)}`, { credentials: 'include' })
      .then(async r => { const d = await r.json(); if (d?.error) throw new Error(d.error); return { form: d as FKFormDefinition }; }),

  create: (body: { formId: string; name: string; description?: string; legalBasis?: FKLegalBasis; purpose?: string; retentionTier?: string; sensitivity?: string; dataTypes?: string[] }): Promise<{ form: FKFormDefinition }> =>
      pjFetch(`${PJ}/api/vault/forms`, {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }).then(async r => { const d = await r.json(); if (d?.error) throw new Error(d.error); return { form: d as FKFormDefinition }; }),

  update: (id: string, body: Partial<FKFormDefinition>): Promise<{ form: FKFormDefinition }> =>
      pjFetch(`${PJ}/api/vault/forms/${encodeURIComponent(id)}`, {
      method: 'PUT', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }).then(async r => { const d = await r.json(); if (d?.error) throw new Error(d.error); return { form: d as FKFormDefinition }; }),

  publish: (id: string): Promise<{ form: FKFormDefinition }> =>
      pjFetch(`${PJ}/api/vault/forms/${encodeURIComponent(id)}/publish`, {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    }).then(async r => { const d = await r.json(); if (d?.error) throw new Error(d.error); return { form: d as FKFormDefinition }; }),

  deprecate: (id: string, reason: string): Promise<{ form: FKFormDefinition }> =>
      pjFetch(`${PJ}/api/vault/forms/${encodeURIComponent(id)}/deprecate`, {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason }),
    }).then(async r => { const d = await r.json(); if (d?.error) throw new Error(d.error); return { form: d as FKFormDefinition }; }),

  // Submissions
  listSubmissions: (formId: string): Promise<{ submissions: FKIntakeRecord[] }> =>
      pjFetch(`${PJ}/api/vault/forms/${encodeURIComponent(formId)}/submissions`, { credentials: 'include' }).then(r => r.json()),

  getSubmission: (formId: string, recordId: string): Promise<{ record: FKIntakeRecord }> =>
      pjFetch(`${PJ}/api/vault/forms/${encodeURIComponent(formId)}/submissions/${encodeURIComponent(recordId)}`, { credentials: 'include' }).then(r => r.json()),

  // Consent
  getConsent: (formId: string, submitterId: string): Promise<{ consent: FKConsentRecord }> =>
      pjFetch(`${PJ}/api/vault/forms/${encodeURIComponent(formId)}/consent/${encodeURIComponent(submitterId)}`, { credentials: 'include' }).then(r => r.json()),

  // Submit (no auth required — public intake endpoint)
  submit: (formId: string, body: { submitterId: string; fields: Record<string, unknown> }): Promise<{ record: FKIntakeRecord }> =>
      fetch(`${PJ}/api/vault/forms/${encodeURIComponent(formId)}/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }).then(async r => { const d = await r.json(); if (!r.ok) throw new Error(d.error ?? 'Submission failed'); return d }),

  // Render
  render: (formId: string, recordId: string, format?: string): Promise<{ format: string; content: string; mimeType: string }> =>
      pjFetch(`${PJ}/api/vault/forms/${encodeURIComponent(formId)}/render/${encodeURIComponent(recordId)}${format ? `?format=${format}` : ''}`, { credentials: 'include' }).then(r => r.json()),

  // Plain-text → best matching form + prefilled fields (Layer 3/4)
  normalize: (text: string): Promise<NormalizeResult> =>
      pjFetch(`${PJ}/api/vault/forms/normalize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ text }),
    }).then(r => r.json()),

  // Update intake record status (received → under_review → responded → closed)
  updateStatus: (formId: string, recordId: string, status: FKIntakeStatus, updatedBy?: string, note?: string): Promise<{ id: string; status: FKIntakeStatus; slaDueAt: string | null }> =>
      pjFetch(`${PJ}/api/vault/forms/${encodeURIComponent(formId)}/submissions/${encodeURIComponent(recordId)}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ status, updatedBy, note }),
    }).then(r => r.json()),

  // List all pending review gates for this tenant
  listReviews: (status?: 'pending' | 'approved' | 'rejected'): Promise<{ reviews: FKReview[]; total: number }> =>
      pjFetch(`${PJ}/api/vault/forms/reviews${status ? `?status=${status}` : ''}`, { credentials: 'include' }).then(r => r.json()),

  // Approve or reject a review gate
  decideReview: (reviewId: string, decision: 'approved' | 'rejected', reviewedBy?: string, note?: string): Promise<{ reviewId: string; decision: string; intakeStatus: FKIntakeStatus }> =>
      pjFetch(`${PJ}/api/vault/forms/reviews/${encodeURIComponent(reviewId)}/decide`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ decision, reviewedBy, note }),
    }).then(r => r.json()),
},

// ── Task Queue (Layer 8) ──────────────────────────────────────────────────
tasks: {
  list: (): Promise<{ tasks: TaskItem[]; total: number }> =>
    pjFetch(`${PJ}/api/tasks`, { credentials: 'include' }).then(r => r.json()),
  count: (): Promise<{ count: number }> =>
    pjFetch(`${PJ}/api/tasks/count`, { credentials: 'include' }).then(r => r.json()),
},

}
