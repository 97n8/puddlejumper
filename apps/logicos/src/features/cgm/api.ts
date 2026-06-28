// ── CGM API client ─────────────────────────────────────────────────────────────
// All calls proxy through PuddleJumper. Tokens never reach the browser.
import { pjFetch } from '@/lib/api'
import type { CgmCase, NewCgmCaseForm } from './types'

export const cgmApi = {
  listCases: () =>
    pjFetch<CgmCase[]>('/v1/cgm/cases'),

  getCase: (id: string) =>
    pjFetch<CgmCase>(`/v1/cgm/cases/${id}`),

  createCase: (form: NewCgmCaseForm) =>
    pjFetch<CgmCase>('/v1/cgm/cases', {
      method: 'POST',
      body: JSON.stringify(form),
    }),
}
