/**
 * Deadline computation engine — enforces statute without discretion
 * Based on VAULT Timer and Deadline Model (97N8-Drafts)
 */

// MA state holidays (2025-2027). Municipalities add their closures via settings.
const BASE_HOLIDAYS = new Set([
  // 2025
  '2025-01-01','2025-01-20','2025-02-17','2025-04-21','2025-05-26',
  '2025-07-04','2025-09-01','2025-10-13','2025-11-11','2025-11-27','2025-12-25',
  // 2026
  '2026-01-01','2026-01-19','2026-02-16','2026-04-20','2026-05-25',
  '2026-07-04','2026-09-07','2026-10-12','2026-11-11','2026-11-26','2026-12-25',
  // 2027
  '2027-01-01','2027-01-18','2027-02-15','2027-04-19','2027-05-31',
  '2027-07-05','2027-09-06','2027-10-11','2027-11-11','2027-11-25','2027-12-25',
])

function isoDate(d: Date): string {
  return d.toISOString().split('T')[0]
}

function isBusinessDay(d: Date, closures: string[] = []): boolean {
  const dow = d.getDay()
  if (dow === 0 || dow === 6) return false
  const ds = isoDate(d)
  if (BASE_HOLIDAYS.has(ds)) return false
  if (closures.includes(ds)) return false
  return true
}

/** Shift to next business day if received on non-business day */
export function effectiveReceiptDate(receivedAt: number, closures: string[] = []): Date {
  const d = new Date(receivedAt)
  while (!isBusinessDay(d, closures)) d.setDate(d.getDate() + 1)
  return d
}

/** Add N business days to a start date */
export function addBusinessDays(startDate: Date, days: number, closures: string[] = []): Date {
  const d = new Date(startDate)
  let added = 0
  while (added < days) {
    d.setDate(d.getDate() + 1)
    if (isBusinessDay(d, closures)) added++
  }
  return d
}

/** Add N calendar days */
export function addCalendarDays(startDate: Date, days: number): Date {
  const d = new Date(startDate)
  d.setDate(d.getDate() + days)
  return d
}

/** Calendar days remaining until due date (negative = overdue) */
export function calendarDaysUntil(isoDateStr: string): number {
  if (!isoDateStr) return 999
  const due = new Date(isoDateStr)
  const now = new Date()
  now.setHours(0,0,0,0); due.setHours(0,0,0,0)
  return Math.ceil((due.getTime() - now.getTime()) / 86400000)
}

export function isOverdue(isoDateStr: string): boolean {
  return calendarDaysUntil(isoDateStr) < 0
}

/** Compute all deadlines for a PRR case */
export function computePRRDeadlines(
  createdAt: number,
  closedAt?: number,
  tolledDays = 0,
  closures: string[] = []
): Record<string, { dueDate: string; label: string; type: 'business' | 'calendar'; triggersOn: 'creation' | 'closure' }> {
  const effectiveStart = effectiveReceiptDate(createdAt, closures)

  const t10 = addBusinessDays(effectiveStart, 10 + tolledDays, closures)
  const t20 = addBusinessDays(effectiveStart, 20 + tolledDays, closures)
  const t25 = addBusinessDays(effectiveStart, 25 + tolledDays, closures)

  const result: Record<string, { dueDate: string; label: string; type: 'business' | 'calendar'; triggersOn: 'creation' | 'closure' }> = {
    T10: { dueDate: isoDate(t10), label: 'T10 Initial Response', type: 'business', triggersOn: 'creation' },
    T20: { dueDate: isoDate(t20), label: 'T20 Petition Window', type: 'business', triggersOn: 'creation' },
    T25: { dueDate: isoDate(t25), label: 'T25 Production Limit', type: 'business', triggersOn: 'creation' },
  }

  if (closedAt) {
    const t90 = addCalendarDays(new Date(closedAt), 90)
    result['T90'] = { dueDate: isoDate(t90), label: 'T90 Appeal Window', type: 'calendar', triggersOn: 'closure' }
  }

  return result
}
