import { describe, it, expect, vi } from 'vitest'
import type { VaultCase } from '@/features/vault/types'

// Silence logger
vi.mock('@/lib/logger', () => ({ createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }) }))

function makeCase(overrides: Partial<VaultCase> = {}): VaultCase {
  return {
    id: 'case-001',
    caseNumber: 'PRR-2026-001',
    moduleId: 'VAULTPRR',
    envId: 'env-test',
    caseType: 'Public Records Request',
    createdAt: Date.now(),
    createdBy: 'clerk@sutton.gov',
    subject: { name: 'Jane Doe', description: 'All vendor contracts FY2024' },
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
    assignedRAO: 'rao@sutton.gov',
    approvals: [],
    notes: '',
    ...overrides,
  }
}

const { generateCaseNumber, fmtDate, slugifyName, appendAudit, enforceT10IfMissed, deadlineBadge } =
  await import('@/features/vault/utils/vaultHelpers')

// ── generateCaseNumber ────────────────────────────────────────────────────────

describe('generateCaseNumber', () => {
  it('generates first case with 001 suffix', () => {
    const year = new Date().getFullYear()
    expect(generateCaseNumber('PRR', [])).toBe(`PRR-${year}-001`)
  })

  it('increments based on existing cases with matching prefix+year', () => {
    const year = new Date().getFullYear()
    const existing = [
      makeCase({ caseNumber: `PRR-${year}-001` }),
      makeCase({ caseNumber: `PRR-${year}-002` }),
    ]
    expect(generateCaseNumber('PRR', existing)).toBe(`PRR-${year}-003`)
  })

  it('ignores cases from a different year', () => {
    const year = new Date().getFullYear()
    const existing = [makeCase({ caseNumber: `PRR-${year - 1}-001` })]
    expect(generateCaseNumber('PRR', existing)).toBe(`PRR-${year}-001`)
  })

  it('ignores cases with different prefix', () => {
    const year = new Date().getFullYear()
    const existing = [makeCase({ caseNumber: `BLDG-${year}-001` })]
    expect(generateCaseNumber('PRR', existing)).toBe(`PRR-${year}-001`)
  })

  it('zero-pads to 3 digits', () => {
    const year = new Date().getFullYear()
    const existing = Array.from({ length: 9 }, (_, i) =>
      makeCase({ caseNumber: `PRR-${year}-${String(i + 1).padStart(3, '0')}` })
    )
    expect(generateCaseNumber('PRR', existing)).toBe(`PRR-${year}-010`)
  })
})

// ── fmtDate ───────────────────────────────────────────────────────────────────

describe('fmtDate', () => {
  it('formats ISO date string as human-readable', () => {
    expect(fmtDate('2026-04-05')).toBe('Apr 5, 2026')
  })

  it('returns em-dash for empty input', () => {
    expect(fmtDate('')).toBe('—')
  })

  it('handles single-digit day', () => {
    expect(fmtDate('2026-01-07')).toBe('Jan 7, 2026')
  })
})

// ── slugifyName ───────────────────────────────────────────────────────────────

describe('slugifyName', () => {
  it('lowercases and replaces spaces with hyphens', () => {
    expect(slugifyName('Town of Sutton')).toBe('town-of-sutton')
  })

  it('strips leading/trailing hyphens', () => {
    expect(slugifyName('  Sutton  ')).toBe('sutton')
  })

  it('collapses multiple spaces', () => {
    expect(slugifyName('Public  Records')).toBe('public-records')
  })

  it('strips special characters', () => {
    expect(slugifyName('PRR #2026/01')).toBe('prr-2026-01')
  })
})

// ── appendAudit ───────────────────────────────────────────────────────────────

describe('appendAudit', () => {
  it('appends an entry to the audit log', () => {
    const c = makeCase()
    const result = appendAudit(c, 'clerk@test.gov', 'STAGE_TRANSITION', 'Moved to active')
    expect(result.auditLog).toHaveLength(1)
    expect(result.auditLog[0].actor).toBe('clerk@test.gov')
    expect(result.auditLog[0].action).toBe('STAGE_TRANSITION')
    expect(result.auditLog[0].notes).toBe('Moved to active')
  })

  it('does not mutate original case', () => {
    const c = makeCase()
    appendAudit(c, 'actor', 'UPDATE', 'Some edit')
    expect(c.auditLog).toHaveLength(0)
  })

  it('preserves existing audit entries', () => {
    const c = makeCase({ auditLog: [{ id: 'a1', timestamp: 1, actor: 'old', action: 'UPDATE', notes: 'old entry' }] })
    const result = appendAudit(c, 'new-actor', 'STAGE_TRANSITION', 'new entry')
    expect(result.auditLog).toHaveLength(2)
    expect(result.auditLog[0].actor).toBe('old')
    expect(result.auditLog[1].actor).toBe('new-actor')
  })

  it('includes extra fields in the audit entry', () => {
    const c = makeCase()
    const result = appendAudit(c, 'system', 'ENFORCEMENT', 'T10 missed', { ruleApplied: 'M.G.L. c. 66, §10' })
    expect(result.auditLog[0].ruleApplied).toBe('M.G.L. c. 66, §10')
  })
})

// ── enforceT10IfMissed ────────────────────────────────────────────────────────

describe('enforceT10IfMissed', () => {
  const pastDate = '2025-01-01' // always in the past

  it('returns null for non-PRR modules', () => {
    const c = makeCase({ moduleId: 'VAULTBLDG' })
    expect(enforceT10IfMissed(c)).toBeNull()
  })

  it('returns null for CLOSED cases', () => {
    const c = makeCase({ currentStage: 'CLOSED', deadlines: { T10: { key: 'T10', dueDate: pastDate, label: 'T10', status: 'OPEN' } } })
    expect(enforceT10IfMissed(c)).toBeNull()
  })

  it('returns null when fees already prohibited', () => {
    const c = makeCase({
      enforcementFlags: { feesAllowed: false },
      deadlines: { T10: { key: 'T10', dueDate: pastDate, label: 'T10', status: 'OPEN' } },
    })
    expect(enforceT10IfMissed(c)).toBeNull()
  })

  it('returns null when T10 deadline not yet set', () => {
    const c = makeCase({ deadlines: {} })
    expect(enforceT10IfMissed(c)).toBeNull()
  })

  it('returns null when T10 is not overdue', () => {
    const futureDate = '2099-12-31'
    const c = makeCase({ deadlines: { T10: { key: 'T10', dueDate: futureDate, label: 'T10', status: 'OPEN' } } })
    expect(enforceT10IfMissed(c)).toBeNull()
  })

  it('enforces T10: prohibits fees and marks MISSED when deadline is overdue', () => {
    const c = makeCase({ deadlines: { T10: { key: 'T10', dueDate: pastDate, label: 'T10', status: 'OPEN' } } })
    const result = enforceT10IfMissed(c)
    expect(result).not.toBeNull()
    expect(result!.enforcementFlags.feesAllowed).toBe(false)
    expect(result!.deadlines['T10'].status).toBe('MISSED')
  })

  it('enforcement is logged in audit trail', () => {
    const c = makeCase({ deadlines: { T10: { key: 'T10', dueDate: pastDate, label: 'T10', status: 'OPEN' } } })
    const result = enforceT10IfMissed(c)!
    expect(result.auditLog).toHaveLength(1)
    expect(result.auditLog[0].actor).toBe('VAULT SYSTEM')
    expect(result.auditLog[0].action).toBe('ENFORCEMENT')
    expect(result.auditLog[0].notes).toContain('T10 deadline missed')
  })

  it('does not mutate original case', () => {
    const c = makeCase({ deadlines: { T10: { key: 'T10', dueDate: pastDate, label: 'T10', status: 'OPEN' } } })
    enforceT10IfMissed(c)
    expect(c.enforcementFlags.feesAllowed).toBe(true)
    expect(c.auditLog).toHaveLength(0)
  })
})

// ── deadlineBadge ─────────────────────────────────────────────────────────────

describe('deadlineBadge', () => {
  it('returns N/A for missing dueDate', () => {
    const badge = deadlineBadge('', 'PENDING')
    expect(badge.label).toBe('N/A')
  })

  it('returns MET badge for MET status', () => {
    const badge = deadlineBadge('2026-01-01', 'MET')
    expect(badge.label).toBe('✓ MET')
  })

  it('returns MISSED badge for MISSED status', () => {
    const badge = deadlineBadge('2026-01-01', 'MISSED')
    expect(badge.label).toBe('✗ MISSED')
  })

  it('returns overdue badge when due date is in the past', () => {
    const badge = deadlineBadge('2025-01-01', 'PENDING')
    expect(badge.label).toMatch(/overdue/)
  })

  it('returns warning badge when due within 3 days', () => {
    const soon = new Date()
    soon.setDate(soon.getDate() + 2)
    const badge = deadlineBadge(soon.toISOString().split('T')[0], 'PENDING')
    expect(badge.label).toMatch(/d left/)
    expect(badge.color).toBe('#78350f')
  })
})
