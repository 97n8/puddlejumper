/**
 * deadlineEdgeCases.test.ts — Edge cases for the VAULT deadline computation engine.
 *
 * Tests scenarios not covered by the existing deadline tests:
 * Massachusetts holiday edge cases, year boundaries, tolling, and calendar day types.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import {
  addBusinessDays,
  addCalendarDays,
  calendarDaysUntil,
  computePRRDeadlines,
  effectiveReceiptDate,
} from '@/features/vault/utils/deadlines'

// ── Helper ────────────────────────────────────────────────────────────────────

function dateMs(iso: string): number {
  return new Date(iso).getTime()
}

function isoOf(d: Date): string {
  return d.toISOString().split('T')[0]
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('addBusinessDays — holiday edge cases', () => {
  it('skips Patriots Day 2027 (Apr 19)', () => {
    // Start on Mon Apr 12 2027 — 5 business days forward should skip Apr 19
    const start = new Date('2027-04-12T12:00:00Z')
    const result = addBusinessDays(start, 5)
    const iso = isoOf(result)
    // Patriots Day Apr 19 is a holiday; 5 business days from Apr 12
    // Apr 13 (Tue), Apr 14 (Wed), Apr 15 (Thu), Apr 16 (Fri), Apr 20 (Mon — skip 19)
    expect(iso).toBe('2027-04-20')
  })

  it('does NOT land on Patriots Day 2027 — adding 4 days from Apr 14 lands on Apr 21', () => {
    // Apr 14 2027 = Wednesday. 4 business days:
    // Apr 15 (Thu)=1, Apr 16 (Fri)=2,
    // [Apr 17 Sat, Apr 18 Sun skipped]
    // Apr 19 (Mon) = Patriots Day (holiday) → skipped
    // Apr 20 (Tue)=3, Apr 21 (Wed)=4
    const start = new Date('2027-04-14T12:00:00Z')
    const result = addBusinessDays(start, 4)
    const iso = isoOf(result)
    expect(iso).not.toBe('2027-04-19')
    expect(iso).toBe('2027-04-21')
  })

  it('skips both Thanksgiving and the day after (Nov 26-27, 2026)', () => {
    // Thanksgiving 2026 = Nov 26 (Thu). Nov 27 = Fri (Black Friday — not a MA state holiday)
    // But Nov 26 is in BASE_HOLIDAYS for 2026
    // Start Mon Nov 23 2026; adding 2 business days
    // Nov 24 (Tue)=1, Nov 25 (Wed)=2 → lands on Nov 25
    const start = new Date('2026-11-23T12:00:00Z')
    const result = addBusinessDays(start, 3)
    const iso = isoOf(result)
    // Nov 24 (Tue)=1, Nov 25 (Wed)=2, Nov 26 (Thu) = Thanksgiving (holiday) → Nov 27 (Fri)=3
    expect(iso).toBe('2026-11-27')
  })

  it('handles year boundary — Dec 31 2026 spanning into Jan 2027', () => {
    // Jan 1 2026 is Thursday; Dec 30 2026 = Wednesday
    // Jan 1 2027 = Friday (holiday: New Year's Day)
    // Adding 2 business days from Dec 30 2026:
    //   Dec 31 (Thu)=1,
    //   Jan 1 (Fri)=holiday→skip, Jan 2 (Sat)→skip, Jan 3 (Sun)→skip,
    //   Jan 4 (Mon)=2
    const start = new Date('2026-12-30T12:00:00Z')
    const result = addBusinessDays(start, 2)
    const iso = isoOf(result)
    expect(iso).toBe('2027-01-04')
  })

  it('handles year boundary crossing multiple holidays in sequence', () => {
    // Dec 24 2026 = Thursday
    // Adding 5 business days:
    //   Dec 25 (Fri)=Christmas holiday→skip,
    //   Dec 26 (Sat)→skip, Dec 27 (Sun)→skip,
    //   Dec 28 (Mon)=1, Dec 29 (Tue)=2, Dec 30 (Wed)=3, Dec 31 (Thu)=4,
    //   Jan 1 (Fri)=New Year's holiday→skip, Jan 2 (Sat)→skip, Jan 3 (Sun)→skip,
    //   Jan 4 (Mon)=5
    const start = new Date('2026-12-24T12:00:00Z')
    const result = addBusinessDays(start, 5)
    const iso = isoOf(result)
    expect(iso).toBe('2027-01-04')
  })
})

describe('addCalendarDays', () => {
  it('spans Dec 31 → Jan 1 correctly (calendar days ignore holidays)', () => {
    const start = new Date('2026-12-28T12:00:00Z')
    const result = addCalendarDays(start, 5)
    expect(isoOf(result)).toBe('2027-01-02')
  })

  it('adds 0 days returns the same date', () => {
    const start = new Date('2026-06-15T12:00:00Z')
    expect(isoOf(addCalendarDays(start, 0))).toBe('2026-06-15')
  })
})

describe('computePRRDeadlines', () => {
  it('T10 is extended by tolling days', () => {
    const createdAt = dateMs('2026-05-01T12:00:00Z') // Friday
    const withoutTolling = computePRRDeadlines(createdAt, undefined, 0)
    const withTolling = computePRRDeadlines(createdAt, undefined, 30)

    const t10Without = new Date(withoutTolling['T10'].dueDate)
    const t10With = new Date(withTolling['T10'].dueDate)

    // With 30 tolling days, T10 should be 30 business days later
    expect(t10With.getTime()).toBeGreaterThan(t10Without.getTime())
  })

  it('T25 type is business (not calendar)', () => {
    const createdAt = dateMs('2026-06-01T12:00:00Z')
    const result = computePRRDeadlines(createdAt)
    expect(result['T25'].type).toBe('business')
  })

  it('T10 type is business', () => {
    const createdAt = dateMs('2026-06-01T12:00:00Z')
    const result = computePRRDeadlines(createdAt)
    expect(result['T10'].type).toBe('business')
  })

  it('T90 type is calendar and only appears when closedAt is provided', () => {
    const createdAt = dateMs('2026-06-01T12:00:00Z')
    const withoutClosure = computePRRDeadlines(createdAt)
    const withClosure = computePRRDeadlines(createdAt, dateMs('2026-06-30T12:00:00Z'))

    expect(withoutClosure['T90']).toBeUndefined()
    expect(withClosure['T90']).toBeTruthy()
    expect(withClosure['T90'].type).toBe('calendar')
  })

  it('T90 is 90 calendar days from closedAt date', () => {
    // Use midnight UTC to avoid timezone arithmetic issues
    const closedAt = dateMs('2026-06-30T00:00:00Z')
    const result = computePRRDeadlines(dateMs('2026-06-01T00:00:00Z'), closedAt)

    // t90 should be 90 calendar days after '2026-06-30'
    const expectedT90 = addCalendarDays(new Date('2026-06-30T00:00:00Z'), 90)
    expect(result['T90'].dueDate).toBe(isoOf(expectedT90))
  })

  it('with 30 tolling days T10 is at least 30 days later than without tolling', () => {
    const createdAt = dateMs('2026-04-01T12:00:00Z')
    const noTolling = computePRRDeadlines(createdAt, undefined, 0)
    const thirtyTolling = computePRRDeadlines(createdAt, undefined, 30)

    const t10No = new Date(noTolling['T10'].dueDate).getTime()
    const t10With = new Date(thirtyTolling['T10'].dueDate).getTime()

    // 30 extra business days ≥ 30 calendar days
    const diffDays = (t10With - t10No) / 86400000
    expect(diffDays).toBeGreaterThanOrEqual(30)
  })
})

describe('calendarDaysUntil', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns 0 or close to 0 for today\'s ISO date (timezone-aware)', () => {
    // The function normalises both dates to local midnight before comparing.
    // When the ISO string is parsed as UTC midnight and then setHours(0,0,0,0)
    // is applied in local time, the result can be 0 or -1 in UTC- timezones.
    const todayIso = new Date().toISOString().split('T')[0]
    const result = calendarDaysUntil(todayIso)
    expect(Math.abs(result)).toBeLessThanOrEqual(1)
  })

  it('returns positive number for a future date', () => {
    const future = new Date()
    future.setDate(future.getDate() + 30)
    const iso = future.toISOString().split('T')[0]
    expect(calendarDaysUntil(iso)).toBeGreaterThan(0)
  })

  it('returns negative number for a past date', () => {
    const past = new Date()
    past.setDate(past.getDate() - 10)
    const iso = past.toISOString().split('T')[0]
    expect(calendarDaysUntil(iso)).toBeLessThan(0)
  })

  it('returns 999 for empty string', () => {
    expect(calendarDaysUntil('')).toBe(999)
  })

  it('returns approximately correct days for a known future date using fake timers', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'))

    expect(calendarDaysUntil('2026-01-31')).toBe(30)
    expect(calendarDaysUntil('2026-01-11')).toBe(10)
  })
})

describe('effectiveReceiptDate', () => {
  it('advances to Monday when received on Saturday', () => {
    // Find a Saturday: 2026-04-04 is a Saturday
    const saturday = dateMs('2026-04-04T10:00:00Z')
    const result = effectiveReceiptDate(saturday)
    // Monday Apr 6 2026 (if Apr 5 is Sunday and Apr 6 is Monday, not a holiday)
    expect(result.getDay()).toBe(1) // Monday
    expect(isoOf(result)).toBe('2026-04-06')
  })

  it('advances to Monday when received on Sunday', () => {
    const sunday = dateMs('2026-04-05T10:00:00Z')
    const result = effectiveReceiptDate(sunday)
    expect(result.getDay()).toBe(1)
    expect(isoOf(result)).toBe('2026-04-06')
  })

  it('does not advance a regular weekday', () => {
    // Wednesday Apr 8 2026 — regular business day
    const wednesday = dateMs('2026-04-08T10:00:00Z')
    const result = effectiveReceiptDate(wednesday)
    expect(isoOf(result)).toBe('2026-04-08')
  })

  it('advances past a holiday — received on MLK Day 2027 (Jan 18)', () => {
    // Jan 18 2027 is MLK Day (2027-01-18 in BASE_HOLIDAYS)
    const mlkDay = dateMs('2027-01-18T10:00:00Z')
    const result = effectiveReceiptDate(mlkDay)
    // Next business day = Jan 19 2027 (Tuesday — but Patriots Day is Apr 19, not Jan)
    expect(isoOf(result)).toBe('2027-01-19')
  })
})
