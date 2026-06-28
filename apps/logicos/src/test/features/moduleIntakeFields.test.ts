import { describe, it, expect } from 'vitest'
import {
  MODULE_DEFS,
  getModuleDef,
  computeDeadlines,
  addBusinessDays,
  addCalendarDays,
  calendarDaysRemaining,
} from '@/features/vault/utils/moduleIntakeFields'

// ── MODULE_DEFS.VAULTPRR structure ────────────────────────────────────────────

describe('MODULE_DEFS VAULTPRR', () => {
  const prr = MODULE_DEFS['VAULTPRR']

  it('exists as a defined module', () => {
    expect(prr).toBeDefined()
  })

  it('has the correct stages array in order', () => {
    expect(prr.stages).toEqual(['INTAKE', 'ASSESSMENT', 'GATHERING', 'REVIEW', 'RESPONSE', 'CLOSED'])
  })

  it('has casePrefix PRR', () => {
    expect(prr.casePrefix).toBe('PRR')
  })

  it('has 3 deadline defs: T10, T25, T90', () => {
    const keys = prr.deadlineDefs.map(d => d.key)
    expect(keys).toContain('T10')
    expect(keys).toContain('T25')
    expect(keys).toContain('T90')
  })

  it('T10 is a 10-business-day deadline from creation', () => {
    const t10 = prr.deadlineDefs.find(d => d.key === 'T10')!
    expect(t10.days).toBe(10)
    expect(t10.type).toBe('business')
    expect(t10.triggersOn).toBe('creation')
  })

  it('T10 has feeProhibitionIfMissed = true', () => {
    const t10 = prr.deadlineDefs.find(d => d.key === 'T10')!
    expect(t10.feeProhibitionIfMissed).toBe(true)
  })

  it('T90 is a 90-calendar-day deadline from closure', () => {
    const t90 = prr.deadlineDefs.find(d => d.key === 'T90')!
    expect(t90.days).toBe(90)
    expect(t90.type).toBe('calendar')
    expect(t90.triggersOn).toBe('closure')
  })

  it('intake fields include required requesterName and requesterEmail', () => {
    const nameField = prr.intakeFields.find(f => f.key === 'requesterName')
    const emailField = prr.intakeFields.find(f => f.key === 'requesterEmail')
    expect(nameField).toBeDefined()
    expect(nameField!.required).toBe(true)
    expect(emailField).toBeDefined()
    expect(emailField!.required).toBe(true)
  })

  it('intake fields include required requestText (description of records)', () => {
    const requestField = prr.intakeFields.find(f => f.key === 'requestText')
    expect(requestField).toBeDefined()
    expect(requestField!.required).toBe(true)
    expect(requestField!.type).toBe('textarea')
  })

  it('stageFields include ASSESSMENT, GATHERING, REVIEW, RESPONSE', () => {
    expect(prr.stageFields).toHaveProperty('ASSESSMENT')
    expect(prr.stageFields).toHaveProperty('GATHERING')
    expect(prr.stageFields).toHaveProperty('REVIEW')
    expect(prr.stageFields).toHaveProperty('RESPONSE')
  })

  it('ASSESSMENT stageFields has responsiveness determination field (required)', () => {
    const assessment = prr.stageFields['ASSESSMENT']!
    const resp = assessment.fields.find(f => f.key === 'responsiveness')
    expect(resp).toBeDefined()
    expect(resp!.required).toBe(true)
  })

  it('RESPONSE stageFields has deliveryMethod and deliveryDate as required', () => {
    const response = prr.stageFields['RESPONSE']!
    const delivery = response.fields.find(f => f.key === 'deliveryMethod')
    const date = response.fields.find(f => f.key === 'deliveryDate')
    expect(delivery?.required).toBe(true)
    expect(date?.required).toBe(true)
  })

  it('defaultRetentionYears is 6', () => {
    expect(prr.defaultRetentionYears).toBe(6)
  })
})

// ── getModuleDef ──────────────────────────────────────────────────────────────

describe('getModuleDef', () => {
  it('returns VAULTPRR definition for direct moduleId match', () => {
    const def = getModuleDef('VAULTPRR')
    expect(def.moduleId).toBe('VAULTPRR')
    expect(def.stages).toContain('INTAKE')
  })

  it('resolves town-branded PRR IDs (e.g. LOGICVILLEPRR → VAULTPRR)', () => {
    const def = getModuleDef('LOGICVILLEPRR')
    expect(def.stages).toEqual(MODULE_DEFS['VAULTPRR'].stages)
    expect(def.casePrefix).toBe('PRR')
  })

  it('resolves SUTTONCLERK → VAULTCLERK structure', () => {
    const def = getModuleDef('SUTTONCLERK')
    expect(def.stages).toEqual(MODULE_DEFS['VAULTCLERK'].stages)
  })

  it('returns a fallback definition for completely unknown moduleId', () => {
    const def = getModuleDef('UNKNOWN_XYZ')
    expect(def).toBeDefined()
    expect(def.stages).toBeDefined()
    expect(Array.isArray(def.stages)).toBe(true)
  })
})

// ── computeDeadlines ──────────────────────────────────────────────────────────

describe('computeDeadlines', () => {
  const prr = MODULE_DEFS['VAULTPRR']

  it('returns T10 and T25 entries for a PRR case', () => {
    const createdAt = Date.now()
    const result = computeDeadlines(prr.deadlineDefs, createdAt)
    expect(result).toHaveProperty('T10')
    expect(result).toHaveProperty('T25')
  })

  it('T90 has status N/A when closedAt is not provided', () => {
    const createdAt = Date.now()
    const result = computeDeadlines(prr.deadlineDefs, createdAt)
    expect(result['T90'].status).toBe('N/A')
    expect(result['T90'].dueDate).toBe('')
  })

  it('T90 gets a dueDate when closedAt is provided', () => {
    const createdAt = Date.now() - 30 * 24 * 60 * 60 * 1000
    const closedAt = Date.now() - 5 * 24 * 60 * 60 * 1000
    const result = computeDeadlines(prr.deadlineDefs, createdAt, closedAt)
    expect(result['T90'].dueDate).not.toBe('')
    expect(result['T90'].status).not.toBe('N/A')
  })

  it('T10 dueDate is a valid YYYY-MM-DD string', () => {
    const createdAt = Date.now()
    const result = computeDeadlines(prr.deadlineDefs, createdAt)
    expect(result['T10'].dueDate).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('T10 has OPEN status when created now (future deadline)', () => {
    const createdAt = Date.now()
    const result = computeDeadlines(prr.deadlineDefs, createdAt)
    expect(result['T10'].status).toBe('OPEN')
  })

  it('T10 is MISSED when createdAt was 60 days ago', () => {
    const old = Date.now() - 60 * 24 * 60 * 60 * 1000
    const result = computeDeadlines(prr.deadlineDefs, old)
    expect(result['T10'].status).toBe('MISSED')
  })

  it('T90 dueDate is 90 calendar days after closedAt', () => {
    const closedAt = new Date('2026-04-06').getTime()
    const result = computeDeadlines(prr.deadlineDefs, closedAt - 10 * 86400000, closedAt)
    // 90 calendar days after 2026-04-06 is 2026-07-05
    expect(result['T90'].dueDate).toBe('2026-07-05')
  })
})

// ── addBusinessDays (moduleIntakeFields simple version) ───────────────────────
// Note: this version does NOT skip MA state holidays — different from deadlines.ts

describe('addBusinessDays (simple, no holiday logic)', () => {
  // Use local-noon dates to avoid UTC-midnight → previous-local-day timezone shift.

  it('adds 1 business day on a weekday (Mon → Tue)', () => {
    const start = new Date(2026, 3, 6, 12, 0, 0) // Monday Apr 6 local noon
    const result = addBusinessDays(start, 1)
    // expect Tuesday Apr 7 local → Apr 7 in ISO
    const iso = result.toLocaleDateString('en-CA') // YYYY-MM-DD in local time
    expect(iso).toBe('2026-04-07')
  })

  it('skips Saturday: Friday + 1 business day = Monday', () => {
    const start = new Date(2026, 3, 10, 12, 0, 0) // Friday Apr 10 local noon
    const result = addBusinessDays(start, 1)
    const iso = result.toLocaleDateString('en-CA')
    expect(iso).toBe('2026-04-13') // Monday
  })

  it('skips weekend: Friday + 2 business days = Tuesday', () => {
    const start = new Date(2026, 3, 10, 12, 0, 0) // Friday Apr 10 local noon
    const result = addBusinessDays(start, 2)
    // Sat (skip) → Sun (skip) → Mon Apr 13 → Tue Apr 14
    const iso = result.toLocaleDateString('en-CA')
    expect(iso).toBe('2026-04-14')
  })

  it('adding 0 days returns the same date', () => {
    const start = new Date(2026, 3, 6, 12, 0, 0) // Monday Apr 6 local noon
    const result = addBusinessDays(start, 0)
    const iso = result.toLocaleDateString('en-CA')
    expect(iso).toBe('2026-04-06')
  })
})

// ── addCalendarDays ───────────────────────────────────────────────────────────

describe('addCalendarDays (moduleIntakeFields version)', () => {
  it('adds exact calendar days including weekend', () => {
    const start = new Date('2026-04-06') // Monday
    const result = addCalendarDays(start, 7)
    expect(result.toISOString().split('T')[0]).toBe('2026-04-13')
  })

  it('adds 0 days returns same date', () => {
    const start = new Date('2026-04-06')
    const result = addCalendarDays(start, 0)
    expect(result.toISOString().split('T')[0]).toBe('2026-04-06')
  })

  it('adds 30 calendar days correctly', () => {
    const start = new Date('2026-04-06')
    const result = addCalendarDays(start, 30)
    expect(result.toISOString().split('T')[0]).toBe('2026-05-06')
  })
})

// ── calendarDaysRemaining ─────────────────────────────────────────────────────

describe('calendarDaysRemaining', () => {
  it('returns 0 for a past date', () => {
    expect(calendarDaysRemaining('2020-01-01')).toBe(0)
  })

  it('returns a positive number for a far-future date', () => {
    expect(calendarDaysRemaining('2099-12-31')).toBeGreaterThan(0)
  })

  it('returns 0 for empty string', () => {
    expect(calendarDaysRemaining('')).toBe(0)
  })

  it('returns approximately 365 for a date one year from now', () => {
    const future = new Date()
    future.setFullYear(future.getFullYear() + 1)
    const iso = future.toISOString().split('T')[0]
    const days = calendarDaysRemaining(iso)
    expect(days).toBeGreaterThanOrEqual(364)
    expect(days).toBeLessThanOrEqual(366)
  })
})
