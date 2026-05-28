import { pjFetch, PJ } from './_base'
import type { ArchieveEvent, LogicDashDeadline, LogicDashStats, Synchron8Automation, Synchron8Run, VaultRecord } from './types'

export const dataDomain = {
// ── VAULT Records ─────────────────────────────────────────────────────────
// Per-module record CRUD. moduleId = canonical VAULT module ID (e.g. 'VAULTPRR').

vaultRecords: {
  list: (moduleId: string, envId: string, params: Record<string, string> = {}): Promise<{ records: VaultRecord[]; total: number }> => {
    const q = new URLSearchParams({ envId, ...params }).toString()
    return pjFetch(`${PJ}/api/vault/modules/${encodeURIComponent(moduleId)}/records?${q}`, { credentials: 'include' }).then(r => r.json())
  },
  get: (moduleId: string, recordId: string): Promise<{ record: VaultRecord }> =>
    pjFetch(`${PJ}/api/vault/modules/${encodeURIComponent(moduleId)}/records/${encodeURIComponent(recordId)}`, { credentials: 'include' }).then(r => r.json()),
  create: (moduleId: string, envId: string, data: Record<string, unknown>): Promise<{ record: VaultRecord }> =>
    pjFetch(`${PJ}/api/vault/modules/${encodeURIComponent(moduleId)}/records`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ envId, ...data }),
    }).then(r => r.json()),
  update: (moduleId: string, recordId: string, data: Record<string, unknown>): Promise<{ record: VaultRecord }> =>
    pjFetch(`${PJ}/api/vault/modules/${encodeURIComponent(moduleId)}/records/${encodeURIComponent(recordId)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(data),
    }).then(r => r.json()),
  seal: (moduleId: string, recordId: string): Promise<{ record: VaultRecord; sealToken: unknown }> =>
    pjFetch(`${PJ}/api/vault/modules/${encodeURIComponent(moduleId)}/records/${encodeURIComponent(recordId)}/seal`, {
      method: 'POST', credentials: 'include',
    }).then(r => r.json()),
  evidence: (moduleId: string, recordId: string): Promise<{ package: unknown }> =>
    pjFetch(`${PJ}/api/vault/modules/${encodeURIComponent(moduleId)}/records/${encodeURIComponent(recordId)}/evidence`, { credentials: 'include' }).then(r => r.json()),
},

// ── SYNCHRON8 Automations ─────────────────────────────────────────────────

synchron8: {
  list: (envId: string): Promise<{ automations: Synchron8Automation[] }> =>
    pjFetch(`${PJ}/api/synchron8/automations?envId=${encodeURIComponent(envId)}`, { credentials: 'include' }).then(r => r.json()),
  get: (id: string): Promise<{ automation: Synchron8Automation }> =>
    pjFetch(`${PJ}/api/synchron8/automations/${encodeURIComponent(id)}`, { credentials: 'include' }).then(r => r.json()),
  create: (data: Partial<Synchron8Automation>): Promise<{ automation: Synchron8Automation }> =>
    pjFetch(`${PJ}/api/synchron8/automations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(data),
    }).then(r => r.json()),
  update: (id: string, data: Partial<Synchron8Automation>): Promise<{ automation: Synchron8Automation }> =>
    pjFetch(`${PJ}/api/synchron8/automations/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(data),
    }).then(r => r.json()),
  delete: (id: string): Promise<{ ok: boolean }> =>
    pjFetch(`${PJ}/api/synchron8/automations/${encodeURIComponent(id)}`, { method: 'DELETE', credentials: 'include' }).then(r => r.json()),
  trigger: (id: string, context?: Record<string, unknown>): Promise<{ runId: string }> =>
    pjFetch(`${PJ}/api/synchron8/automations/${encodeURIComponent(id)}/trigger`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ context }),
    }).then(r => r.json()),
  listRuns: (automationId: string): Promise<{ runs: Synchron8Run[] }> =>
    pjFetch(`${PJ}/api/synchron8/automations/${encodeURIComponent(automationId)}/runs`, { credentials: 'include' }).then(r => r.json()),
  getRun: (runId: string): Promise<{ run: Synchron8Run }> =>
    pjFetch(`${PJ}/api/synchron8/runs/${encodeURIComponent(runId)}`, { credentials: 'include' }).then(r => r.json()),
  getRunEvidence: (runId: string): Promise<{ evidence: unknown }> =>
    pjFetch(`${PJ}/api/synchron8/runs/${encodeURIComponent(runId)}/evidence`, { credentials: 'include' }).then(r => r.json()),
},

// ── LogicDash Metrics ─────────────────────────────────────────────────────

logicdash: {
  deadlines: (envId: string): Promise<{ items: LogicDashDeadline[] }> =>
    pjFetch(`${PJ}/api/logicdash/deadlines?envId=${encodeURIComponent(envId)}`, { credentials: 'include' }).then(r => r.json()),
  stats: (envId: string): Promise<LogicDashStats> =>
    pjFetch(`${PJ}/api/logicdash/stats?envId=${encodeURIComponent(envId)}`, { credentials: 'include' }).then(r => r.json()),
  activity: (envId: string, limit = 20): Promise<{ events: ArchieveEvent[] }> =>
    pjFetch(`${PJ}/api/logicdash/activity?envId=${encodeURIComponent(envId)}&limit=${limit}`, { credentials: 'include' }).then(r => r.json()),
},

// ── Ingestion Pipeline ────────────────────────────────────────────────────
// Layer 1-2: Capture everything, auto-structure on intake
// High-confidence = auto-process; Low-confidence = review queue

ingestion: {
  /** All items in the review queue (pending + reviewing) */
  queue: (params?: { status?: string; source?: string; confidence?: string; limit?: number }): Promise<{ items: import('@/lib/anchors').IntakeItem[] }> => {
    const q = new URLSearchParams()
    if (params?.status)     q.set('status', params.status)
    if (params?.source)     q.set('source', params.source)
    if (params?.confidence) q.set('confidence', params.confidence)
    if (params?.limit)      q.set('limit', String(params.limit))
    return pjFetch(`${PJ}/api/ingestion/queue?${q}`, { credentials: 'include' }).then(r => r.json())
  },
  get: (id: string): Promise<{ item: import('@/lib/anchors').IntakeItem }> =>
    pjFetch(`${PJ}/api/ingestion/items/${encodeURIComponent(id)}`, { credentials: 'include' }).then(r => r.json()),
  stats: (): Promise<import('@/lib/anchors').IngestionStats> =>
    pjFetch(`${PJ}/api/ingestion/stats`, { credentials: 'include' }).then(r => r.json()),
  /** Approve routing (high-confidence auto-process) */
  approve: (id: string): Promise<{ ok: boolean }> =>
    pjFetch(`${PJ}/api/ingestion/items/${encodeURIComponent(id)}/approve`, { method: 'POST', credentials: 'include' }).then(r => r.json()),
  /** Reclassify a low-confidence item */
  reclassify: (id: string, data: { docClass: string; anchors?: import('@/lib/anchors').AnchorRef[]; retentionClass?: string }): Promise<{ ok: boolean }> =>
    pjFetch(`${PJ}/api/ingestion/items/${encodeURIComponent(id)}/reclassify`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
      body: JSON.stringify(data),
    }).then(r => r.json()),
  /** Route item to a case/environment/anchor */
  route: (id: string, data: { envId?: string; anchors?: import('@/lib/anchors').AnchorRef[]; assignedTo?: string; notes?: string }): Promise<{ ok: boolean }> =>
    pjFetch(`${PJ}/api/ingestion/items/${encodeURIComponent(id)}/route`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
      body: JSON.stringify(data),
    }).then(r => r.json()),
  reject: (id: string, reason?: string): Promise<{ ok: boolean }> =>
    pjFetch(`${PJ}/api/ingestion/items/${encodeURIComponent(id)}/reject`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
      body: JSON.stringify({ reason }),
    }).then(r => r.json()),
  /** Get all active ingestion rules */
  rules: (): Promise<{ rules: import('@/lib/anchors').IngestionRule[] }> =>
    pjFetch(`${PJ}/api/ingestion/rules`, { credentials: 'include' }).then(r => r.json()),
  createRule: (rule: Omit<import('@/lib/anchors').IngestionRule, 'id' | 'createdAt' | 'updatedAt'>): Promise<{ rule: import('@/lib/anchors').IngestionRule }> =>
    pjFetch(`${PJ}/api/ingestion/rules`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
      body: JSON.stringify(rule),
    }).then(r => r.json()),
  updateRule: (id: string, patch: Partial<import('@/lib/anchors').IngestionRule>): Promise<{ rule: import('@/lib/anchors').IngestionRule }> =>
    pjFetch(`${PJ}/api/ingestion/rules/${encodeURIComponent(id)}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
      body: JSON.stringify(patch),
    }).then(r => r.json()),
  deleteRule: (id: string): Promise<{ ok: boolean }> =>
    pjFetch(`${PJ}/api/ingestion/rules/${encodeURIComponent(id)}`, { method: 'DELETE', credentials: 'include' }).then(r => r.json()),
},

// ── Anchor Search ─────────────────────────────────────────────────────────
// Layer 5: Retrieval — find anything by person, parcel, vendor, topic, etc.

anchors: {
  search: (params: { q: string; type?: import('@/lib/anchors').AnchorType; envId?: string; limit?: number }): Promise<{ results: import('@/lib/anchors').AnchorRef[] }> => {
    const q = new URLSearchParams({ q: params.q })
    if (params.type)   q.set('type', params.type)
    if (params.envId)  q.set('envId', params.envId)
    if (params.limit)  q.set('limit', String(params.limit))
    return pjFetch(`${PJ}/api/anchors/search?${q}`, { credentials: 'include' }).then(r => r.json())
  },
  get: (type: import('@/lib/anchors').AnchorType, id: string): Promise<{ anchor: import('@/lib/anchors').AnchorRef & Record<string, unknown> }> =>
    pjFetch(`${PJ}/api/anchors/${type}/${encodeURIComponent(id)}`, { credentials: 'include' }).then(r => r.json()),
  /** Get all records linked to an anchor */
  history: (type: import('@/lib/anchors').AnchorType, id: string): Promise<{ items: import('@/lib/anchors').IntakeItem[] }> =>
    pjFetch(`${PJ}/api/anchors/${type}/${encodeURIComponent(id)}/history`, { credentials: 'include' }).then(r => r.json()),
},

// ── User Preferences ──────────────────────────────────────────────────────
// Per-user persistent key-value store backed by server SQLite.
// Survives browser clears and device switches.

prefs: {
  /** Fetch all prefs for the current user. Returns {} if not authenticated. */
  getAll: (): Promise<Record<string, unknown>> =>
    pjFetch(`${PJ}/api/prefs`, { credentials: 'include' })
      .then(r => r.json())
      .then(d => (d?.data as Record<string, unknown>) ?? {})
      .catch(() => ({})),
  /** Set a single pref value. Fire-and-forget safe. */
  set: (key: string, value: unknown): Promise<void> =>
    pjFetch(`${PJ}/api/prefs/${encodeURIComponent(key)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ value }),
    }).then(() => undefined).catch(() => undefined),
  /** Delete a single pref. */
  delete: (key: string): Promise<void> =>
    pjFetch(`${PJ}/api/prefs/${encodeURIComponent(key)}`, {
      method: 'DELETE',
      credentials: 'include',
    }).then(() => undefined).catch(() => undefined),
},

// ── Town Registry ─────────────────────────────────────────────────────────
// Daily-synced registry of MA municipality fiscal + staff data.

registry: {
  /** GET /api/registry/towns — all 351 towns with latest snapshot summaries */
  towns: (): Promise<{
    towns: Array<{
      name: string; dorCode: number; county: string; population?: number;
      fiscal: { metrics: Record<string, unknown>; computedAt: string } | null;
      staffCount: number | null; staffScrapedAt: string | null;
    }>;
    total: number;
  }> =>
    pjFetch(`${PJ}/api/registry/towns`, { credentials: 'include' }).then(r => r.json()),

  /** GET /api/registry/town/:name — full fiscal + staff for one town */
  town: (name: string): Promise<{
    name: string; dorCode: number; county: string; population?: number;
    fiscal: {
      metrics: {
        operatingBudget?: number | null; freeCash?: number | null;
        stateAidPctBudget?: number | null; debtService?: number | null;
        totalEmployees?: number | null; [k: string]: unknown;
      };
      riskFlags: unknown[]; fiscalYear: number; computedAt: string;
    } | null;
    staff: {
      employees: Array<{ id: string; name: string; title: string; email: string; phone?: string; department?: string; sourceUrl: string }>;
      sourcePages: string[]; scrapedAt: string; notice?: string;
    } | null;
  }> =>
    pjFetch(`${PJ}/api/registry/town/${encodeURIComponent(name)}`, { credentials: 'include' }).then(r => r.json()),

  /** GET /api/registry/town/:name/mma — MMA Data Hub profile (demographics, finances, governance, representation) */
  mmaProfile: (name: string, refresh?: boolean): Promise<{
    source: 'cache' | 'live' | 'stale-cache'
    profile: {
      slug: string; fetchedAt: string
      // Demographics
      population?: number; populationDensity?: number; registeredVoters?: number
      incomePerCapita?: number; eqvPerCapita?: number; ownerOccupiedHousingRate?: string
      medianHomeValue?: number; medianGrossRent?: number; totalHouseholds?: number; avgHouseholdSize?: number
      // Finances
      residentialTaxRate?: number; commercialTaxRate?: number; avgTaxBill?: number
      totalExpenditures?: number; taxLevy?: number; stateAid?: number; localReceipts?: number
      cpaYearEnacted?: number; cpaSurcharge?: string; cpaExemptions?: string
      // Governance
      formOfGovernment?: string; incorporationDate?: number; chiefMunicipalOfficial?: string
      policyBoard?: string; policyBoardSize?: number; legislativeBody?: string
      // Geography
      county?: string; areaSqMi?: number; publicRoadsMi?: number; regionalPlanningAgency?: string
      // Officials
      selectBoard?: string[]; selectBoardChair?: string
      // Dates
      annualTownMeetingDate?: string; annualTownMeetingDesc?: string
      municipalElectionDate?: string; municipalElectionDesc?: string
      // Representation
      usSenators?: string[]; usRepresentative?: string[]
      maSenatorsors?: string[]; maRepresentatives?: string[]
      // Contact
      website?: string; phone?: string
    }
    warning?: string
  }> =>
    pjFetch(
      `${PJ}/api/registry/town/${encodeURIComponent(name)}/mma${refresh ? '?refresh=1' : ''}`,
      { credentials: 'include' }
    ).then(r => r.json()),

  /** POST /api/registry/sync — trigger a full registry sync (admin) */
  sync: (): Promise<{ message: string }> =>
    pjFetch(`${PJ}/api/registry/sync`, { method: 'POST', credentials: 'include' }).then(r => r.json()),

  /** GET /api/registry/synclog — last 10 sync runs */
  synclog: (): Promise<{ syncs: Array<{ id: string; status: string; started_at: string; finished_at?: string; towns_total?: number; towns_ok?: number; towns_err?: number; message?: string }> }> =>
    pjFetch(`${PJ}/api/registry/synclog`, { credentials: 'include' }).then(r => r.json()),

  /** POST /api/registry/sync-mma — fast MMA-only sync (all 351 towns in one request) */
  syncMma: (): Promise<{ ok: boolean; total?: number; err?: string }> =>
    pjFetch(`${PJ}/api/registry/sync-mma`, { method: 'POST', credentials: 'include' }).then(r => r.json()),

  /** GET /api/registry/town/:name/massgis — MassGIS population history + area (30-day cache) */
  massgis: (name: string, refresh?: boolean): Promise<{
    source: 'cache' | 'live' | 'stale-cache'
    data: {
      town: string; townId: number; type: string; county: string; fipsStateCo: number
      areaSqMi: number; areaAcres: number
      pop1960?: number; pop1970?: number; pop1980?: number; pop1990?: number
      pop2000?: number; pop2010?: number; pop2020?: number; popChange1020?: number
      fetchedAt: string
    }
    warning?: string
  }> =>
    pjFetch(
      `${PJ}/api/registry/town/${encodeURIComponent(name)}/massgis${refresh ? '?refresh=1' : ''}`,
      { credentials: 'include' }
    ).then(r => r.json()),

  /** GET /api/registry/town/:name/legislation — local bills from MA Legislature (24h cache) */
  legislation: (name: string, refresh?: boolean): Promise<{
    source: 'cache' | 'live' | 'stale-cache'
    bills: Array<{
      billNumber: string | null; docketNumber: string; title: string
      primarySponsor: string | null; cosponsors: string[]; branch: string | null
    }>
    fetchedAt: string
    warning?: string
  }> =>
    pjFetch(
      `${PJ}/api/registry/town/${encodeURIComponent(name)}/legislation${refresh ? '?refresh=1' : ''}`,
      { credentials: 'include' }
    ).then(r => r.json()),

  /** GET /api/registry/members — all 203 current MA legislative members (7-day cache) */
  members: (refresh?: boolean): Promise<{
    source: 'cache' | 'live' | 'stale-cache'
    members: Array<{
      memberCode: string; name: string; branch: string; district: string; party: string
      emailAddress: string | null; phoneNumber: string | null; roomNumber: string | null; detailsUrl: string
    }>
    fetchedAt: string
    warning?: string
  }> =>
    pjFetch(
      `${PJ}/api/registry/members${refresh ? '?refresh=1' : ''}`,
      { credentials: 'include' }
    ).then(r => r.json()),
},

// ── Fiscal (DLS sync + MA fiscal data) ─────────────────────────────────────
// Syncs DLS fiscal data for a given municipality into the registry.

fiscal: {
  /** POST /api/fiscal/sync — sync DLS fiscal data for a town (cached 24h) */
  sync: (name: string): Promise<{ metrics: Record<string, unknown>; fiscalYear: number; computedAt: string }> =>
    pjFetch(`${PJ}/api/fiscal/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    }).then(r => r.json()),
},

// ── Civic staff scrape ────────────────────────────────────────────────────
// Scrapes staff contact information from a municipality's public website.

civic: {
  /** POST /api/civic/staff — scrape staff contacts for a town */
  staff: (name: string): Promise<{
    employees: Array<{ name: string; title: string; department?: string; email: string; phone?: string }>
    sourcePages: string[]
  }> =>
    pjFetch(`${PJ}/api/civic/staff`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    }).then(r => r.json()),
},
}
