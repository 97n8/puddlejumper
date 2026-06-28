import { describe, it, expect, vi } from 'vitest'
import type { VaultCase } from '@/features/vault/types'

vi.mock('@/lib/logger', () => ({ createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }) }))

function makeCase(overrides: Partial<VaultCase> = {}): VaultCase {
  return {
    id: 'case-ext-001',
    caseNumber: 'PRR-2026-001',
    moduleId: 'VAULTPRR',
    envId: 'env-test',
    caseType: 'Public Records Request',
    createdAt: Date.now(),
    createdBy: 'clerk@test.gov',
    subject: { name: 'Test Requestor', description: 'Test request' },
    scopeDefinition: '',
    scopeVersion: 1,
    scopeHistory: [],
    deadlines: {},
    tollingHistory: [],
    enforcementFlags: { feesAllowed: true },
    currentStage: 'INTAKE',
    transitionBlockers: [],
    processing: {},
    assets: [],
    auditLog: [],
    assignedRAO: '',
    approvals: [],
    notes: '',
    ...overrides,
  }
}

const { fmtTs, appendAudit, deadlineBadge, defaultSettings, MGL_EXEMPTIONS_LIST } =
  await import('@/features/vault/utils/vaultHelpers')

// ── fmtTs ─────────────────────────────────────────────────────────────────────

describe('fmtTs', () => {
  it('returns a non-empty string for any timestamp', () => {
    const ts = new Date('2026-04-05T12:00:00Z').getTime()
    expect(typeof fmtTs(ts)).toBe('string')
    expect(fmtTs(ts).length).toBeGreaterThan(0)
  })

  it('contains the correct year', () => {
    const ts = new Date('2026-04-05T12:00:00Z').getTime()
    expect(fmtTs(ts)).toContain('2026')
  })

  it('contains the correct month abbreviation', () => {
    // Apr 5 2026
    const ts = new Date('2026-04-05T12:00:00Z').getTime()
    expect(fmtTs(ts)).toMatch(/Apr/i)
  })

  it('contains the day of the month', () => {
    const ts = new Date('2026-01-15T12:00:00Z').getTime()
    expect(fmtTs(ts)).toContain('15')
  })

  it('produces different output for different timestamps', () => {
    const ts1 = new Date('2026-04-05T12:00:00Z').getTime()
    const ts2 = new Date('2027-08-20T12:00:00Z').getTime()
    expect(fmtTs(ts1)).not.toBe(fmtTs(ts2))
  })
})

// ── appendAudit — timestamp & immutability checks ─────────────────────────────

describe('appendAudit — extended', () => {
  it('stores timestamp as a numeric milliseconds value', () => {
    const before = Date.now()
    const c = makeCase()
    const result = appendAudit(c, 'actor', 'UPDATE', 'note')
    const after = Date.now()
    const entry = result.auditLog[0]
    expect(typeof entry.timestamp).toBe('number')
    expect(entry.timestamp).toBeGreaterThanOrEqual(before)
    expect(entry.timestamp).toBeLessThanOrEqual(after)
  })

  it('each entry gets a unique id', () => {
    let c = makeCase()
    c = appendAudit(c, 'actor', 'UPDATE', 'first')
    const result = appendAudit(c, 'actor', 'UPDATE', 'second')
    const ids = result.auditLog.map(e => e.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('chaining multiple appends accumulates entries in order', () => {
    let c = makeCase()
    c = appendAudit(c, 'clerk1', 'CREATE', 'Case opened')
    c = appendAudit(c, 'clerk2', 'STAGE_TRANSITION', 'Moved to ASSESSMENT')
    c = appendAudit(c, 'system', 'ENFORCEMENT', 'T10 missed')
    expect(c.auditLog).toHaveLength(3)
    expect(c.auditLog[0].action).toBe('CREATE')
    expect(c.auditLog[1].action).toBe('STAGE_TRANSITION')
    expect(c.auditLog[2].action).toBe('ENFORCEMENT')
  })
})

// ── deadlineBadge — extended colour checks ─────────────────────────────────────

describe('deadlineBadge — extended', () => {
  it('returns amber-tone color when due in 4–7 days', () => {
    const soon = new Date()
    soon.setDate(soon.getDate() + 5)
    const badge = deadlineBadge(soon.toISOString().split('T')[0], 'OPEN')
    // 5 days remaining → amber (#b45309)
    expect(badge.color).toBe('#b45309')
    expect(badge.label).toMatch(/d left/)
  })

  it('returns blue color when more than 7 days remain', () => {
    const distant = new Date()
    distant.setDate(distant.getDate() + 14)
    const badge = deadlineBadge(distant.toISOString().split('T')[0], 'OPEN')
    expect(badge.color).toBe('#1e3a8a')
    expect(badge.label).toMatch(/d left/)
  })

  it('overdue badge shows absolute number of days', () => {
    // A date 10 days in the past
    const past = new Date()
    past.setDate(past.getDate() - 10)
    const badge = deadlineBadge(past.toISOString().split('T')[0], 'OPEN')
    expect(badge.label).toMatch(/\d+d overdue/)
    expect(badge.color).toBe('#7f1d1d')
  })

  it('returns N/A when status is N/A regardless of dueDate', () => {
    const badge = deadlineBadge('2026-01-01', 'N/A')
    expect(badge.label).toBe('N/A')
  })

  it('bg is different for overdue vs ok', () => {
    const pastDate = '2020-01-01'
    const futureDate = '2099-12-31'
    const overdueBadge = deadlineBadge(pastDate, 'OPEN')
    const okBadge = deadlineBadge(futureDate, 'OPEN')
    expect(overdueBadge.bg).not.toBe(okBadge.bg)
  })
})

// ── defaultSettings ───────────────────────────────────────────────────────────

describe('defaultSettings', () => {
  it('returns an object with the given moduleId and envId', () => {
    const s = defaultSettings('VAULTPRR', 'env-sutton')
    expect(s.moduleId).toBe('VAULTPRR')
    expect(s.envId).toBe('env-sutton')
  })

  it('initializes empty arrays for raos, escalation, and trainingLinks', () => {
    const s = defaultSettings('VAULTCLERK', 'env-1')
    expect(s.raos).toEqual([])
    expect(s.escalation).toEqual([])
    expect(s.trainingLinks).toEqual([])
  })

  it('starts with email notifications disabled', () => {
    const s = defaultSettings('VAULTPRR', 'env-1')
    expect(s.emailNotificationsEnabled).toBe(false)
    expect(s.notificationEmail).toBe('')
  })

  it('sets updatedAt to a recent timestamp', () => {
    const before = Date.now()
    const s = defaultSettings('VAULTPRR', 'env-1')
    const after = Date.now()
    expect(s.updatedAt).toBeGreaterThanOrEqual(before)
    expect(s.updatedAt).toBeLessThanOrEqual(after)
  })

  it('different calls produce independent objects', () => {
    const s1 = defaultSettings('VAULTPRR', 'env-1')
    const s2 = defaultSettings('VAULTCLERK', 'env-2')
    expect(s1).not.toBe(s2)
    expect(s1.moduleId).not.toBe(s2.moduleId)
  })
})

// ── MGL_EXEMPTIONS_LIST ───────────────────────────────────────────────────────

describe('MGL_EXEMPTIONS_LIST', () => {
  it('is an array', () => {
    expect(Array.isArray(MGL_EXEMPTIONS_LIST)).toBe(true)
  })

  it('has 13 exemption entries (a–n, minus m)', () => {
    expect(MGL_EXEMPTIONS_LIST).toHaveLength(13)
  })

  it('each entry has a code and label string', () => {
    for (const item of MGL_EXEMPTIONS_LIST) {
      expect(typeof item.code).toBe('string')
      expect(typeof item.label).toBe('string')
      expect(item.code.length).toBeGreaterThan(0)
      expect(item.label.length).toBeGreaterThan(0)
    }
  })

  it('includes exemption "a" for personnel/medical privacy', () => {
    const exemptionA = MGL_EXEMPTIONS_LIST.find(e => e.code === 'a')
    expect(exemptionA).toBeDefined()
    expect(exemptionA!.label.toLowerCase()).toMatch(/person|privacy|medical/)
  })

  it('includes exemption "d" for attorney-client privilege', () => {
    const exemptionD = MGL_EXEMPTIONS_LIST.find(e => e.code === 'd')
    expect(exemptionD).toBeDefined()
    expect(exemptionD!.label.toLowerCase()).toMatch(/attorney|privilege|work product/)
  })

  it('all codes are unique', () => {
    const codes = MGL_EXEMPTIONS_LIST.map(e => e.code)
    expect(new Set(codes).size).toBe(codes.length)
  })
})
