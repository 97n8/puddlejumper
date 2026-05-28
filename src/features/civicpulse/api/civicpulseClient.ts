// CivicPulse — PuddleJumper API interface
// All requests proxy through PuddleJumper; tokens never reach the browser.

import { pjBase } from '@/services/pjBase'
import type {
  CivicSummary,
  ComplianceBackstop,
  PublicationLogEntry,
  MunicipalityConfig,
  FeedEntry,
  FeedFilters,
} from '../types/civicpulse.types'

const PJ = pjBase
const BASE = `${PJ}/api/civicpulse`

export class CivicPulseApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message)
    this.name = 'CivicPulseApiError'
  }
}

export type CivicPulseFailureState = 'unauthenticated' | 'unauthorized' | 'load_error'

async function readErrorMessage(res: Response, fallback: string): Promise<string> {
  const raw = await res.text().catch(() => '')
  if (!raw) return fallback

  try {
    const parsed = JSON.parse(raw) as { error?: string; message?: string }
    return parsed.message ?? parsed.error ?? raw
  } catch {
    return raw
  }
}

async function cpFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE}${path}`, { credentials: 'include', ...init })
  if (!res.ok) {
    throw new CivicPulseApiError(
      res.status,
      await readErrorMessage(res, `CivicPulse API error ${res.status}: ${path}`),
    )
  }
  if (res.status === 204) return undefined as unknown as T
  return res.json()
}

function unwrapArrayData<T>(response: { data?: T[] } | undefined): T[] {
  return response?.data ?? []
}

function unwrapConfig(response: { data?: MunicipalityConfig } | undefined): MunicipalityConfig {
  if (!response?.data) {
    throw new Error('CivicPulse municipality config missing from response.')
  }
  return response.data
}

export function getCivicPulseFailureState(error: unknown): CivicPulseFailureState {
  if (error instanceof CivicPulseApiError && error.status === 401) return 'unauthenticated'
  if (error instanceof CivicPulseApiError && error.status === 403) return 'unauthorized'
  return 'load_error'
}

export function getCivicPulseFailureMessage(error: unknown, subject: string): string {
  const state = getCivicPulseFailureState(error)
  if (state === 'unauthenticated') return `Sign in required to load ${subject}.`
  if (state === 'unauthorized') return `You are not authorized to load ${subject}.`
  return error instanceof Error && error.message
    ? error.message
    : `Could not load ${subject}.`
}

export const civicpulseClient = {
  // ── Approval queue ────────────────────────────────────────────────────────

  getPendingSummaries(): Promise<CivicSummary[]> {
    return cpFetch<{ data: CivicSummary[] }>('/summaries?status=pending')
      .then(unwrapArrayData)
  },

  getSummary(id: string): Promise<CivicSummary> {
    return cpFetch<{ data: CivicSummary }>(`/summaries/${id}`)
      .then(r => r?.data)
  },

  // ── Compliance backstop ───────────────────────────────────────────────────

  getBackstopItems(): Promise<ComplianceBackstop[]> {
    return cpFetch<{ data: ComplianceBackstop[] }>('/backstop')
      .then(unwrapArrayData)
  },

  // ── Publication log ───────────────────────────────────────────────────────

  getPublicationLog(page = 1, pageSize = 50): Promise<PublicationLogEntry[]> {
    return cpFetch<{ data: PublicationLogEntry[] }>(`/publication-log?page=${page}&pageSize=${pageSize}`)
      .then(unwrapArrayData)
  },

  exportAuditChain(format: 'pdf' | 'csv'): Promise<Blob> {
    return fetch(`${BASE}/audit-export?format=${format}`, { credentials: 'include' }).then(r => r.blob())
  },

  // ── Configuration ─────────────────────────────────────────────────────────

  getMunicipalityConfig(): Promise<MunicipalityConfig> {
    return cpFetch<{ data: MunicipalityConfig }>('/config')
      .then(unwrapConfig)
  },

  updateChannelConfig(config: MunicipalityConfig['channels']): Promise<void> {
    return cpFetch('/config/channels', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ channels: config }),
    })
  },

  // ── Public activity feed ──────────────────────────────────────────────────

  getFeed(filters?: Partial<FeedFilters>, page = 1): Promise<FeedEntry[]> {
    const params = new URLSearchParams({ page: String(page) })
    if (filters?.searchQuery) params.set('q', filters.searchQuery)
    if (filters?.actionTypes?.length) params.set('types', filters.actionTypes.join(','))
    if (filters?.dateFrom) params.set('from', filters.dateFrom)
    if (filters?.dateTo) params.set('to', filters.dateTo)
    return cpFetch<{ data: FeedEntry[] }>(`/feed?${params}`)
      .then(unwrapArrayData)
  },
}
