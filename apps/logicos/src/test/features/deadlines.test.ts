import { describe, it, expect } from 'vitest'
import {
  effectiveReceiptDate,
  addBusinessDays,
  addCalendarDays,
  calendarDaysUntil,
  isOverdue,
  computePRRDeadlines,
} from '@/features/vault/utils/deadlines'

// ── effectiveReceiptDate ──────────────────────────────────────────────────────

describe('effectiveReceiptDate', () => {
  it('returns same day when received on a business day', () => {
    // 2026-04-06 is a Monday
    const d = new Date('2026-04-06T10:00:00Z')
    const result = effectiveReceiptDate(d.getTime())
    expect(result.toISOString().split('T')[0]).toBe('2026-04-06')
  })

  it('advances to Monday when received on Saturday', () => {
    // 2026-04-04 is a Saturday
    const d = new Date('2026-04-04T10:00:00Z')
    const result = effectiveReceiptDate(d.getTime())
    expect(result.toISOString().split('T')[0]).toBe('2026-04-06')
  })

  it('advances to Monday when received on Sunday', () => {
    // 2026-04-05 is a Sunday
    const d = new Date('2026-04-05T10:00:00Z')
    const result = effectiveReceiptDate(d.getTime())
    expect(result.toISOString().split('T')[0]).toBe('2026-04-06')
  })
})

// ── addBusinessDays ───────────────────────────────────────────────────────────

describe('addBusinessDays', () => {
  it('adds 10 business days skipping weekends and Patriots Day', () => {
    // Use local noon to avoid UTC midnight timezone shift. Apr 6 = Monday.
    // Patriots Day 2026 = Apr 20 (holiday), so day 10 lands on Apr 21.
    const start = new Date('2026-04-06T12:00:00')
    const result = addBusinessDays(start, 10)
    expect(result.toISOString().split('T')[0]).toBe('2026-04-21')
  })

  it('skips MA state holidays', () => {
    // 2026-05-25 is Memorial Day (holiday). Starting 2026-05-20 (Wednesday, local noon).
    // Without holiday: 2026-06-03. With Memorial Day skip: 2026-06-04.
    const start = new Date('2026-05-20T12:00:00')
    const result = addBusinessDays(start, 10)
    expect(result.toISOString().split('T')[0]).toBe('2026-06-04')
  })

  it('skips custom closures', () => {
    const start = new Date('2026-04-06T12:00:00')
    // 2026-04-07 (Tuesday) is a custom closure → next business day = Wed Apr 8
    const result = addBusinessDays(start, 1, ['2026-04-07'])
    expect(result.toISOString().split('T')[0]).toBe('2026-04-08')
  })
})

// ── addCalendarDays ───────────────────────────────────────────────────────────

describe('addCalendarDays', () => {
  it('adds exact calendar days including weekends', () => {
    const start = new Date('2026-04-06')
    const result = addCalendarDays(start, 90)
    expect(result.toISOString().split('T')[0]).toBe('2026-07-05')
  })

  it('adds 0 days returns same date', () => {
    const start = new Date('2026-04-06')
    const result = addCalendarDays(start, 0)
    expect(result.toISOString().split('T')[0]).toBe('2026-04-06')
  })
})

// ── calendarDaysUntil ─────────────────────────────────────────────────────────

describe('calendarDaysUntil', () => {
  it('returns 999 for empty string', () => {
    expect(calendarDaysUntil('')).toBe(999)
  })

  it('returns negative number for past date', () => {
    expect(calendarDaysUntil('2020-01-01')).toBeLessThan(0)
  })

  it('returns positive number for future date', () => {
    expect(calendarDaysUntil('2099-12-31')).toBeGreaterThan(0)
  })
})

// ── isOverdue ─────────────────────────────────────────────────────────────────

describe('isOverdue', () => {
  it('returns true for past date', () => {
    expect(isOverdue('2020-01-01')).toBe(true)
  })

  it('returns false for future date', () => {
    expect(isOverdue('2099-12-31')).toBe(false)
  })
})

// ── computePRRDeadlines ───────────────────────────────────────────────────────

describe('computePRRDeadlines', () => {
  it('returns T10, T20, T25 for a new case', () => {
    const createdAt = new Date('2026-04-06T10:00:00Z').getTime()
    const deadlines = computePRRDeadlines(createdAt)
    expect(deadlines).toHaveProperty('T10')
    expect(deadlines).toHaveProperty('T20')
    expect(deadlines).toHaveProperty('T25')
    expect(deadlines).not.toHaveProperty('T90')
  })

  it('T10 is 10 business days from effective receipt', () => {
    // Apr 6 2026 10:00 UTC = Apr 6 6am EDT (Mon, business day).
    // Patriots Day Apr 20 is a holiday → T10 lands on Apr 21.
    const createdAt = new Date('2026-04-06T10:00:00Z').getTime()
    const deadlines = computePRRDeadlines(createdAt)
    expect(deadlines['T10'].dueDate).toBe('2026-04-21')
  })

  it('adds T90 when closedAt is provided', () => {
    const createdAt = new Date('2026-04-06T10:00:00Z').getTime()
    const closedAt = new Date('2026-05-01T10:00:00Z').getTime()
    const deadlines = computePRRDeadlines(createdAt, closedAt)
    expect(deadlines).toHaveProperty('T90')
    expect(deadlines['T90'].triggersOn).toBe('closure')
  })

  it('T10 is type business, T90 is type calendar', () => {
    const createdAt = new Date('2026-04-06T10:00:00Z').getTime()
    const closedAt = new Date('2026-05-01T10:00:00Z').getTime()
    const deadlines = computePRRDeadlines(createdAt, closedAt)
    expect(deadlines['T10'].type).toBe('business')
    expect(deadlines['T90'].type).toBe('calendar')
  })

  it('tolling days extend T10 deadline', () => {
    const createdAt = new Date('2026-04-06T10:00:00Z').getTime()
    const noTolling = computePRRDeadlines(createdAt)
    const withTolling = computePRRDeadlines(createdAt, undefined, 5)
    const noTollingT10 = new Date(noTolling['T10'].dueDate)
    const tolledT10 = new Date(withTolling['T10'].dueDate)
    expect(tolledT10.getTime()).toBeGreaterThan(noTollingT10.getTime())
  })
})
