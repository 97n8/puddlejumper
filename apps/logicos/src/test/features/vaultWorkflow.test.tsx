import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import type { VaultCase, VaultModuleSettings } from '@/features/vault/types'

// ── Shared mocks ──────────────────────────────────────────────────────────────

vi.mock('@/lib/logger', () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }),
}))

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

vi.mock('@/services/pjApi', () => ({
  pjApi: {
    vaultFiles: { upload: vi.fn().mockResolvedValue({}) },
    connectors: { status: vi.fn().mockResolvedValue({ connected: [] }) },
  },
}))

vi.mock('@/services/casespaceApi', () => ({
  listCaseSpaces: vi.fn().mockResolvedValue([]),
  updateCaseSpace: vi.fn().mockResolvedValue({}),
}))

vi.mock('@/hooks/useKV', () => ({
  useKV: vi.fn().mockImplementation((_key: string, defaultValue: unknown) => [defaultValue, vi.fn()]),
}))

vi.mock('@/services/serverPrefsCache', () => ({
  getServerPref: vi.fn().mockReturnValue(undefined),
  writeServerPref: vi.fn(),
}))

// ── Helper: create a minimal VaultCase ────────────────────────────────────────

function makeCase(overrides: Partial<VaultCase> = {}): VaultCase {
  return {
    id: `case-${Math.random().toString(36).slice(2)}`,
    caseNumber: 'PRR-2026-001',
    moduleId: 'VAULTPRR',
    envId: 'env-test',
    caseType: 'Public Records Request',
    createdAt: Date.now() - 5 * 86400000,
    createdBy: 'clerk@test.gov',
    subject: { name: 'Alice Smith', description: 'Vendor contracts FY2024' },
    scopeDefinition: '',
    scopeVersion: 1,
    scopeHistory: [],
    deadlines: {
      T10: { key: 'T10', label: 'T10 Initial Response', dueDate: '2099-12-31', status: 'OPEN' },
    },
    tollingHistory: [],
    enforcementFlags: { feesAllowed: true },
    currentStage: 'INTAKE',
    transitionBlockers: [],
    processing: {},
    assets: [],
    auditLog: [],
    assignedRAO: 'rao@test.gov',
    approvals: [],
    notes: '',
    ...overrides,
  }
}

// ── CaseList ──────────────────────────────────────────────────────────────────

describe('CaseList', () => {
  let onNewCase: () => void
  let onOpenCase: (id: string) => void
  let onBack: () => void

  beforeEach(() => {
    onNewCase = vi.fn()
    onOpenCase = vi.fn()
    onBack = vi.fn()
    vi.clearAllMocks()
  })

  it('shows "No open cases" empty state when cases array is empty', async () => {
    const { CaseList } = await import('@/features/vault/components/CaseList')
    render(
      <CaseList
        moduleId="VAULTPRR"
        cases={[]}
        onNewCase={onNewCase}
        onOpenCase={onOpenCase}
        onBack={onBack}
      />,
    )
    expect(screen.getByText('No open cases')).toBeInTheDocument()
  })

  it('shows "Open the first case" CTA button when empty', async () => {
    const { CaseList } = await import('@/features/vault/components/CaseList')
    render(
      <CaseList
        moduleId="VAULTPRR"
        cases={[]}
        onNewCase={onNewCase}
        onOpenCase={onOpenCase}
        onBack={onBack}
      />,
    )
    const cta = screen.getByRole('button', { name: /open the first case/i })
    expect(cta).toBeInTheDocument()
    fireEvent.click(cta)
    expect(onNewCase).toHaveBeenCalledTimes(1)
  })

  it('"New Case" button in header calls onNewCase', async () => {
    const { CaseList } = await import('@/features/vault/components/CaseList')
    render(
      <CaseList
        moduleId="VAULTPRR"
        cases={[]}
        onNewCase={onNewCase}
        onOpenCase={onOpenCase}
        onBack={onBack}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /new case/i }))
    expect(onNewCase).toHaveBeenCalledTimes(1)
  })

  it('back button calls onBack', async () => {
    const { CaseList } = await import('@/features/vault/components/CaseList')
    render(
      <CaseList
        moduleId="VAULTPRR"
        cases={[]}
        onNewCase={onNewCase}
        onOpenCase={onOpenCase}
        onBack={onBack}
      />,
    )
    fireEvent.click(screen.getByLabelText('Go back'))
    expect(onBack).toHaveBeenCalledTimes(1)
  })

  it('renders a case row with the case number when cases provided', async () => {
    const { CaseList } = await import('@/features/vault/components/CaseList')
    const c = makeCase({ caseNumber: 'PRR-2026-007', currentStage: 'GATHERING' })
    render(
      <CaseList
        moduleId="VAULTPRR"
        cases={[c]}
        onNewCase={onNewCase}
        onOpenCase={onOpenCase}
        onBack={onBack}
      />,
    )
    expect(screen.getByText('PRR-2026-007')).toBeInTheDocument()
  })

  it('renders the stage badge for each case', async () => {
    const { CaseList } = await import('@/features/vault/components/CaseList')
    const c = makeCase({ currentStage: 'REVIEW' })
    render(
      <CaseList
        moduleId="VAULTPRR"
        cases={[c]}
        onNewCase={onNewCase}
        onOpenCase={onOpenCase}
        onBack={onBack}
      />,
    )
    expect(screen.getByText('REVIEW')).toBeInTheDocument()
  })

  it('renders the assigned RAO for each case', async () => {
    const { CaseList } = await import('@/features/vault/components/CaseList')
    const c = makeCase({ assignedRAO: 'clerk@sutton.gov' })
    render(
      <CaseList
        moduleId="VAULTPRR"
        cases={[c]}
        onNewCase={onNewCase}
        onOpenCase={onOpenCase}
        onBack={onBack}
      />,
    )
    expect(screen.getByText('clerk@sutton.gov')).toBeInTheDocument()
  })

  it('clicking a case row calls onOpenCase with the case id', async () => {
    const { CaseList } = await import('@/features/vault/components/CaseList')
    const c = makeCase({ id: 'case-abc123', caseNumber: 'PRR-2026-010' })
    render(
      <CaseList
        moduleId="VAULTPRR"
        cases={[c]}
        onNewCase={onNewCase}
        onOpenCase={onOpenCase}
        onBack={onBack}
      />,
    )
    // Click the case row by clicking the case number cell
    fireEvent.click(screen.getByText('PRR-2026-010'))
    expect(onOpenCase).toHaveBeenCalledWith('case-abc123')
  })

  it('renders multiple cases in the table', async () => {
    const { CaseList } = await import('@/features/vault/components/CaseList')
    const cases = [
      makeCase({ caseNumber: 'PRR-2026-001' }),
      makeCase({ caseNumber: 'PRR-2026-002' }),
      makeCase({ caseNumber: 'PRR-2026-003' }),
    ]
    render(
      <CaseList
        moduleId="VAULTPRR"
        cases={cases}
        onNewCase={onNewCase}
        onOpenCase={onOpenCase}
        onBack={onBack}
      />,
    )
    expect(screen.getByText('PRR-2026-001')).toBeInTheDocument()
    expect(screen.getByText('PRR-2026-002')).toBeInTheDocument()
    expect(screen.getByText('PRR-2026-003')).toBeInTheDocument()
  })

  it('filters to show only open cases by default (closed case not shown)', async () => {
    const { CaseList } = await import('@/features/vault/components/CaseList')
    const open = makeCase({ caseNumber: 'PRR-2026-001', currentStage: 'INTAKE' })
    const closed = makeCase({ caseNumber: 'PRR-2026-002', currentStage: 'CLOSED' })
    render(
      <CaseList
        moduleId="VAULTPRR"
        cases={[open, closed]}
        onNewCase={onNewCase}
        onOpenCase={onOpenCase}
        onBack={onBack}
      />,
    )
    expect(screen.getByText('PRR-2026-001')).toBeInTheDocument()
    expect(screen.queryByText('PRR-2026-002')).not.toBeInTheDocument()
  })
})

// ── ModuleDashboard ───────────────────────────────────────────────────────────

describe('ModuleDashboard', () => {
  const emptySettings: Record<string, VaultModuleSettings> = {}

  it('shows "No modules set up yet" when modules array is empty', async () => {
    const { ModuleDashboard } = await import('@/features/vault/components/ModuleDashboard')
    render(
      <ModuleDashboard
        modules={[]}
        cases={[]}
        allSettings={emptySettings}
        onSelect={vi.fn()}
        onSettings={vi.fn()}
        onPublicForm={vi.fn()}
      />,
    )
    expect(screen.getByText('No modules set up yet')).toBeInTheDocument()
  })

  it('shows "Active Modules" heading when at least one module is configured', async () => {
    const { ModuleDashboard } = await import('@/features/vault/components/ModuleDashboard')
    render(
      <ModuleDashboard
        modules={['VAULTPRR']}
        cases={[]}
        allSettings={emptySettings}
        onSelect={vi.fn()}
        onSettings={vi.fn()}
        onPublicForm={vi.fn()}
      />,
    )
    expect(screen.getByText('Active Modules')).toBeInTheDocument()
  })

  it('renders a card for each configured module', async () => {
    const { ModuleDashboard } = await import('@/features/vault/components/ModuleDashboard')
    render(
      <ModuleDashboard
        modules={['VAULTPRR', 'VAULTCLERK']}
        cases={[]}
        allSettings={emptySettings}
        onSelect={vi.fn()}
        onSettings={vi.fn()}
        onPublicForm={vi.fn()}
      />,
    )
    // Module IDs are displayed without the VAULT prefix
    expect(screen.getByText('PRR')).toBeInTheDocument()
    expect(screen.getByText('CLERK')).toBeInTheDocument()
  })

  it('clicking a module card calls onSelect with the moduleId', async () => {
    const { ModuleDashboard } = await import('@/features/vault/components/ModuleDashboard')
    const onSelect = vi.fn()
    render(
      <ModuleDashboard
        modules={['VAULTPRR']}
        cases={[]}
        allSettings={emptySettings}
        onSelect={onSelect}
        onSettings={vi.fn()}
        onPublicForm={vi.fn()}
      />,
    )
    // Click the module button (the card's inner button)
    fireEvent.click(screen.getByText('PRR'))
    expect(onSelect).toHaveBeenCalledWith('VAULTPRR')
  })

  it('shows case counts for a module that has cases', async () => {
    const { ModuleDashboard } = await import('@/features/vault/components/ModuleDashboard')
    const cases = [
      makeCase({ moduleId: 'VAULTPRR', currentStage: 'INTAKE' }),
      makeCase({ moduleId: 'VAULTPRR', currentStage: 'REVIEW' }),
      makeCase({ moduleId: 'VAULTPRR', currentStage: 'CLOSED' }),
    ]
    render(
      <ModuleDashboard
        modules={['VAULTPRR']}
        cases={cases}
        allSettings={emptySettings}
        onSelect={vi.fn()}
        onSettings={vi.fn()}
        onPublicForm={vi.fn()}
      />,
    )
    // 2 open + 1 closed — the dashboard shows counts
    expect(screen.getByText('2')).toBeInTheDocument() // open
    expect(screen.getByText('1')).toBeInTheDocument() // closed
  })

  it('"Set up your first module" button calls onSettings on empty state', async () => {
    const { ModuleDashboard } = await import('@/features/vault/components/ModuleDashboard')
    const onSettings = vi.fn()
    render(
      <ModuleDashboard
        modules={[]}
        cases={[]}
        allSettings={emptySettings}
        onSelect={vi.fn()}
        onSettings={onSettings}
        onPublicForm={vi.fn()}
      />,
    )
    fireEvent.click(screen.getByText('Set up your first module'))
    expect(onSettings).toHaveBeenCalledTimes(1)
  })

  it('renders hero content when provided', async () => {
    const { ModuleDashboard } = await import('@/features/vault/components/ModuleDashboard')
    render(
      <ModuleDashboard
        modules={['VAULTPRR']}
        cases={[]}
        allSettings={emptySettings}
        onSelect={vi.fn()}
        onSettings={vi.fn()}
        onPublicForm={vi.fn()}
        hero={<div data-testid="custom-hero">Dashboard Hero</div>}
      />,
    )
    expect(screen.getByTestId('custom-hero')).toBeInTheDocument()
    expect(screen.getByText('Dashboard Hero')).toBeInTheDocument()
  })
})
