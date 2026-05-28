import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import type { VaultCase, VaultModuleSettings } from '@/features/vault/types'

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock('@/lib/logger', () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }),
}))

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

vi.mock('@/services/pjApi', () => ({
  pjApi: {
    cloudSave: vi.fn().mockResolvedValue({}),
    connectors: { status: vi.fn().mockResolvedValue({ connected: [] }) },
  },
}))

vi.mock('@/features/vault/utils/sendVaultEmail', () => ({
  fireVaultEmailTrigger: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/features/vault/utils/generateBossHTML', () => ({
  generateBossHTML: vi.fn().mockResolvedValue('<html>boss</html>'),
}))

vi.mock('@/features/vault/utils/generateFormTemplates', () => ({
  generateFullDisclosureLetter: vi.fn().mockReturnValue('<html>full</html>'),
  generatePartialDisclosureLetter: vi.fn().mockReturnValue('<html>partial</html>'),
  generateDenialLetter: vi.fn().mockReturnValue('<html>denial</html>'),
  generateExtensionLetter: vi.fn().mockReturnValue('<html>ext</html>'),
}))

// DOM stubs
Object.defineProperty(navigator, 'clipboard', {
  value: { writeText: vi.fn().mockResolvedValue(undefined) },
  configurable: true,
})
Object.defineProperty(URL, 'createObjectURL', { value: vi.fn().mockReturnValue('blob:test'), configurable: true })
Object.defineProperty(URL, 'revokeObjectURL', { value: vi.fn(), configurable: true })

// ── Helpers ───────────────────────────────────────────────────────────────────

function makePRRCase(overrides: Partial<VaultCase> = {}): VaultCase {
  return {
    id: 'case-test-1',
    caseNumber: 'PRR-2026-001',
    moduleId: 'VAULTPRR',
    envId: 'env-test',
    caseType: 'Public Records Request',
    createdAt: Date.now() - 3 * 86400000,
    createdBy: 'clerk@test.gov',
    subject: {
      requesterName: 'Alice Smith',
      requesterEmail: 'alice@example.com',
      requestText: 'Vendor contracts FY2024',
    },
    scopeDefinition: 'All vendor contracts for fiscal year 2024',
    scopeVersion: 1,
    scopeHistory: [],
    deadlines: {
      T10: { key: 'T10', label: 'T10 Initial Response', dueDate: '2099-12-31', status: 'OPEN' },
      T25: { key: 'T25', label: 'T25 Production Limit', dueDate: '2099-12-31', status: 'OPEN' },
    },
    tollingHistory: [],
    enforcementFlags: { feesAllowed: true },
    currentStage: 'INTAKE',
    transitionBlockers: [],
    processing: {},
    assets: [],
    auditLog: [],
    assignedRAO: 'records@test.gov',
    approvals: [],
    notes: '',
    ...overrides,
  }
}

function makeSettings(): VaultModuleSettings {
  return {
    moduleId: 'VAULTPRR',
    envId: 'env-test',
    raos: [{ id: 'rao-1', name: 'Jane RAO', email: 'rao@test.gov', title: 'RAO', isPrimary: true }],
    escalation: [],
    emailNotificationsEnabled: false,
    notificationEmail: '',
    trainingLinks: [],
    updatedAt: Date.now(),
  }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('CaseDetail', () => {
  // Lazy import after mocks are hoisted
  let CaseDetail: typeof import('@/features/vault/components/CaseDetail').CaseDetail

  beforeEach(async () => {
    vi.clearAllMocks()
    const mod = await import('@/features/vault/components/CaseDetail')
    CaseDetail = mod.CaseDetail
  })

  it('renders overview tab by default — shows case number and stage badge', () => {
    const vaultCase = makePRRCase()
    render(
      <CaseDetail
        vaultCase={vaultCase}
        settings={makeSettings()}
        actor="clerk@test.gov"
        connectorProvider="none"
        onUpdate={vi.fn()}
        onBack={vi.fn()}
      />
    )

    // Case number visible in header (may appear in header + overview — use getAllByText)
    expect(screen.getAllByText('PRR-2026-001').length).toBeGreaterThan(0)

    // Current stage badge visible in header
    expect(screen.getAllByText('INTAKE').length).toBeGreaterThan(0)

    // Overview tab content: "Case Information" section header
    expect(screen.getByText('Case Information')).toBeTruthy()
  })

  it('shows module and case type in overview tab', () => {
    const vaultCase = makePRRCase()
    render(
      <CaseDetail
        vaultCase={vaultCase}
        settings={makeSettings()}
        actor="clerk@test.gov"
        connectorProvider="none"
        onUpdate={vi.fn()}
        onBack={vi.fn()}
      />
    )

    // Module and case type rendered in overview
    expect(screen.getByText('VAULTPRR')).toBeTruthy()
    expect(screen.getByText('Public Records Request')).toBeTruthy()
  })

  it('shows deadline badge — T10 label visible on overview tab', () => {
    const vaultCase = makePRRCase()
    render(
      <CaseDetail
        vaultCase={vaultCase}
        settings={makeSettings()}
        actor="clerk@test.gov"
        connectorProvider="none"
        onUpdate={vi.fn()}
        onBack={vi.fn()}
      />
    )

    // Deadlines section shows T10 label from the deadline definition
    expect(screen.getByText('T10 Initial Response')).toBeTruthy()
  })

  it('switching to stage tab shows stage form fields for GATHERING stage', () => {
    const vaultCase = makePRRCase({ currentStage: 'GATHERING' })
    render(
      <CaseDetail
        vaultCase={vaultCase}
        settings={makeSettings()}
        actor="clerk@test.gov"
        connectorProvider="none"
        onUpdate={vi.fn()}
        onBack={vi.fn()}
      />
    )

    // Click the Stage tab
    const stageTab = screen.getByText(/Stage: GATHERING/i)
    fireEvent.click(stageTab)

    // GATHERING stage has "Locations Searched" and "Responsive Records Found" fields
    expect(screen.getByText('Locations Searched')).toBeTruthy()
    expect(screen.getByText('Responsive Records Found (count/est.)')).toBeTruthy()
  })

  it('saving stage data calls onUpdate with updated processing', () => {
    const onUpdate = vi.fn()
    const vaultCase = makePRRCase({ currentStage: 'GATHERING' })
    render(
      <CaseDetail
        vaultCase={vaultCase}
        settings={makeSettings()}
        actor="clerk@test.gov"
        connectorProvider="none"
        onUpdate={onUpdate}
        onBack={vi.fn()}
      />
    )

    // Switch to stage tab
    fireEvent.click(screen.getByText(/Stage: GATHERING/i))

    // Fill in the "Locations Searched" textarea
    const textareas = screen.getAllByRole('textbox')
    const searchLocationsInput = textareas.find(el =>
      el.getAttribute('placeholder')?.includes('systems, files')
    )
    expect(searchLocationsInput).toBeTruthy()
    fireEvent.change(searchLocationsInput!, { target: { value: 'Email archives, SharePoint, filing cabinets' } })

    // Click Save
    const saveBtn = screen.getByText('Save')
    fireEvent.click(saveBtn)

    // onUpdate should be called with updated processing data
    expect(onUpdate).toHaveBeenCalled()
    const updatedCase: VaultCase = onUpdate.mock.calls[0][0]
    expect(updatedCase.processing['GATHERING']?.searchLocations).toBe('Email archives, SharePoint, filing cabinets')
  })

  it('advancing stage calls onUpdate with the next stage', () => {
    const onUpdate = vi.fn()
    // GATHERING → REVIEW (no requiredToAdvance, no T25 gate)
    const vaultCase = makePRRCase({ currentStage: 'GATHERING' })
    render(
      <CaseDetail
        vaultCase={vaultCase}
        settings={makeSettings()}
        actor="clerk@test.gov"
        connectorProvider="none"
        onUpdate={onUpdate}
        onBack={vi.fn()}
      />
    )

    const advanceBtn = screen.getByText(/Advance → REVIEW/i)
    fireEvent.click(advanceBtn)

    expect(onUpdate).toHaveBeenCalled()
    const updatedCase: VaultCase = onUpdate.mock.calls[0][0]
    expect(updatedCase.currentStage).toBe('REVIEW')
  })

  it('closed case shows no advance button', () => {
    const vaultCase = makePRRCase({
      currentStage: 'CLOSED',
      closureReason: 'Delivered',
      closedAt: Date.now() - 86400000,
    })
    render(
      <CaseDetail
        vaultCase={vaultCase}
        settings={makeSettings()}
        actor="clerk@test.gov"
        connectorProvider="none"
        onUpdate={vi.fn()}
        onBack={vi.fn()}
      />
    )

    // No advance or close button visible when case is closed
    expect(screen.queryByText(/Advance →/i)).toBeNull()
    expect(screen.queryByText('Close Case')).toBeNull()
  })

  it('audit tab shows audit log entries', () => {
    const vaultCase = makePRRCase({
      auditLog: [
        {
          id: 'audit-1',
          timestamp: new Date('2026-04-01T10:00:00Z').getTime(),
          actor: 'clerk@test.gov',
          action: 'CREATE',
          notes: 'Case created. Stage: INTAKE. Deadlines computed from effective receipt date.',
        },
        {
          id: 'audit-2',
          timestamp: new Date('2026-04-02T09:00:00Z').getTime(),
          actor: 'clerk@test.gov',
          action: 'STAGE_TRANSITION',
          notes: 'Advanced from INTAKE to ASSESSMENT',
        },
      ],
    })
    render(
      <CaseDetail
        vaultCase={vaultCase}
        settings={makeSettings()}
        actor="clerk@test.gov"
        connectorProvider="none"
        onUpdate={vi.fn()}
        onBack={vi.fn()}
      />
    )

    // Click Audit tab
    fireEvent.click(screen.getByText('Audit'))

    // Both audit entries visible
    expect(screen.getByText('Case created. Stage: INTAKE. Deadlines computed from effective receipt date.')).toBeTruthy()
    expect(screen.getByText('Advanced from INTAKE to ASSESSMENT')).toBeTruthy()
    // Action labels are uppercased
    expect(screen.getByText('CREATE')).toBeTruthy()
    expect(screen.getByText('STAGE TRANSITION')).toBeTruthy()
  })

  it('builder tab renders a title input and content textarea', () => {
    const vaultCase = makePRRCase()
    render(
      <CaseDetail
        vaultCase={vaultCase}
        settings={makeSettings()}
        actor="clerk@test.gov"
        connectorProvider="none"
        onUpdate={vi.fn()}
        onBack={vi.fn()}
      />
    )

    // Click the Builder tab (labeled "✏️ Builder")
    fireEvent.click(screen.getByText(/Builder/i))

    // Title input with placeholder mentioning the case number
    expect(screen.getByText('Document Title / Filename')).toBeTruthy()
    // Content label
    expect(screen.getByText('Content')).toBeTruthy()
  })

  it('T10 enforcement triggers onUpdate when T10 is overdue', async () => {
    const onUpdate = vi.fn()
    const vaultCase = makePRRCase({
      deadlines: {
        T10: { key: 'T10', label: 'T10 Initial Response', dueDate: '2020-01-01', status: 'OPEN' },
      },
      enforcementFlags: { feesAllowed: true },
    })

    render(
      <CaseDetail
        vaultCase={vaultCase}
        settings={makeSettings()}
        actor="clerk@test.gov"
        connectorProvider="none"
        onUpdate={onUpdate}
        onBack={vi.fn()}
      />
    )

    // enforceT10IfMissed runs on mount and should call onUpdate since T10 is overdue
    // Wait for the useEffect to run
    await new Promise(r => setTimeout(r, 10))
    expect(onUpdate).toHaveBeenCalled()
    const enforced: VaultCase = onUpdate.mock.calls[0][0]
    expect(enforced.enforcementFlags.feesAllowed).toBe(false)
    expect(enforced.deadlines['T10'].status).toBe('MISSED')
  })

  it('go-back button calls onBack', () => {
    const onBack = vi.fn()
    render(
      <CaseDetail
        vaultCase={makePRRCase()}
        settings={makeSettings()}
        actor="clerk@test.gov"
        connectorProvider="none"
        onUpdate={vi.fn()}
        onBack={onBack}
      />
    )

    const backBtn = screen.getByLabelText('Go back')
    fireEvent.click(backBtn)
    expect(onBack).toHaveBeenCalledOnce()
  })
})
