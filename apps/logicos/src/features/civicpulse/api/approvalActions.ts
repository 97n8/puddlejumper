// CivicPulse — Approval action API calls (approve / reject / hold)

import type { CivicSummary } from '../types/civicpulse.types'
import { pjBase } from '@/services/pjBase'

const PJ = pjBase
const BASE = 'civicpulse'

async function pjPost<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${PJ}/api/${path}`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', 'x-puddlejumper-request': 'true' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`Request failed: ${res.status}`)
  const json = await res.json() as Record<string, unknown>
  return (json?.data ?? json) as T
}

export const approvalActions = {
  approve(summaryId: string, editedText?: string): Promise<CivicSummary> {
    return pjPost<CivicSummary>(`${BASE}/summaries/${summaryId}/approve`, { editedText })
  },

  reject(summaryId: string, reason: string): Promise<CivicSummary> {
    return pjPost<CivicSummary>(`${BASE}/summaries/${summaryId}/reject`, { reason })
  },

  placeLegalHold(summaryId: string, note?: string): Promise<CivicSummary> {
    return pjPost<CivicSummary>(`${BASE}/summaries/${summaryId}/legal-hold`, { note })
  },

  clearLegalHold(summaryId: string): Promise<CivicSummary> {
    return pjPost<CivicSummary>(`${BASE}/summaries/${summaryId}/clear-hold`, {})
  },

  acknowledgeBackstop(backstopId: string): Promise<void> {
    return pjPost<void>(`${BASE}/backstop/${backstopId}/acknowledge`, {})
  },
}
