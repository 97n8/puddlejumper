import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
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
    prr: {
      intake: vi.fn().mockResolvedValue({
        id: 'pj-prr-1',
        public_id: 'PUB-001',
        tracking_url: 'https://track.example.com/PUB-001',
      }),
    },
    dog: { apply: vi.fn().mockResolvedValue({ id: 'pj-dog-1', public_id: 'DOG-001' }) },
  },
}))

vi.mock('@/features/vault/utils/sendVaultEmail', () => ({
  fireVaultEmailTrigger: vi.fn().mockResolvedValue(undefined),
}))

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeSettings(overrides: Partial<VaultModuleSettings> = {}): VaultModuleSettings {
  return {
    moduleId: 'VAULTPRR',
    envId: 'env-test',
    raos: [
      { id: 'rao-1', name: 'Jane RAO', email: 'rao@test.gov', title: 'RAO', isPrimary: true },
    ],
    escalation: [],
    emailNotificationsEnabled: false,
    notificationEmail: '',
    trainingLinks: [],
    updatedAt: Date.now(),
    ...overrides,
  }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('CaseIntake', () => {
  let CaseIntake: typeof import('@/features/vault/components/CaseIntake').CaseIntake

  beforeEach(async () => {
    vi.clearAllMocks()
    const mod = await import('@/features/vault/components/CaseIntake')
    CaseIntake = mod.CaseIntake
  })

  it('renders intake form for PRR module with required fields', () => {
    render(
      <CaseIntake
        moduleId="VAULTPRR"
        settings={makeSettings()}
        existingCases={[]}
        actor="clerk@test.gov"
        onSubmit={vi.fn()}
        onBack={vi.fn()}
      />
    )

    // Module label shown in header
    expect(screen.getByText(/PRR — New Case/i)).toBeTruthy()
    // Required requester fields from module definition
    expect(screen.getByText('Your Name')).toBeTruthy()
    expect(screen.getByText('Email Address')).toBeTruthy()
    expect(screen.getByText(/Description of Records Requested/i)).toBeTruthy()
    expect(screen.getByText(/Preferred Response Method/i)).toBeTruthy()
    // Scope field (always required)
    expect(screen.getByText(/Scope Description/i)).toBeTruthy()
  })

  it('shows error when submitting with required fields empty', async () => {
    render(
      <CaseIntake
        moduleId="VAULTPRR"
        settings={makeSettings()}
        existingCases={[]}
        actor="clerk@test.gov"
        onSubmit={vi.fn()}
        onBack={vi.fn()}
      />
    )

    // Click "Open Case" without filling anything
    fireEvent.click(screen.getByText('Open Case'))

    // Error message should appear referencing missing required fields
    await waitFor(() => {
      expect(screen.getByText(/Required:/i)).toBeTruthy()
    })
  })

  it('shows scope error when only intake fields are filled but scope is empty', async () => {
    render(
      <CaseIntake
        moduleId="VAULTPRR"
        settings={makeSettings()}
        existingCases={[]}
        actor="clerk@test.gov"
        onSubmit={vi.fn()}
        onBack={vi.fn()}
      />
    )

    // Fill all required intake fields
    const inputs = screen.getAllByRole('textbox')
    // requesterName input
    const nameInput = inputs.find(el => el.getAttribute('placeholder') === 'Full legal name')
    fireEvent.change(nameInput!, { target: { value: 'Bob Tester' } })

    // requesterEmail
    const emailInput = inputs.find(el => el.getAttribute('placeholder') === 'you@example.com')
    fireEvent.change(emailInput!, { target: { value: 'bob@example.com' } })

    // preferredContact (select)
    const selects = screen.getAllByRole('combobox')
    const preferredContactSelect = selects[0]
    fireEvent.change(preferredContactSelect, { target: { value: 'Email' } })

    // requestText (textarea)
    const textareas = screen.getAllByRole('textbox')
    const requestTextInput = textareas.find(el =>
      el.getAttribute('placeholder')?.includes('specific records')
    )
    fireEvent.change(requestTextInput!, { target: { value: 'All contracts from 2024' } })

    // Submit without scope
    fireEvent.click(screen.getByText('Open Case'))

    await waitFor(() => {
      expect(screen.getByText(/Scope definition is required/i)).toBeTruthy()
    })
  })

  it('submitting with all required fields calls onSubmit with a valid VaultCase', async () => {
    const onSubmit = vi.fn()
    render(
      <CaseIntake
        moduleId="VAULTPRR"
        settings={makeSettings()}
        existingCases={[]}
        actor="clerk@test.gov"
        onSubmit={onSubmit}
        onBack={vi.fn()}
      />
    )

    // Fill requesterName
    const nameInput = screen.getAllByRole('textbox').find(el => el.getAttribute('placeholder') === 'Full legal name')
    fireEvent.change(nameInput!, { target: { value: 'Alice Tester' } })

    // Fill requesterEmail
    const emailInput = screen.getAllByRole('textbox').find(el => el.getAttribute('placeholder') === 'you@example.com')
    fireEvent.change(emailInput!, { target: { value: 'alice@example.com' } })

    // Fill preferredContact (first combobox)
    const selects = screen.getAllByRole('combobox')
    fireEvent.change(selects[0], { target: { value: 'Email' } })

    // Fill requestText
    const requestTextInput = screen.getAllByRole('textbox').find(el =>
      el.getAttribute('placeholder')?.includes('specific records')
    )
    fireEvent.change(requestTextInput!, { target: { value: 'All vendor contracts FY2024' } })

    // Fill scope (the last distinct textarea)
    const scopeTextarea = screen.getAllByRole('textbox').find(el =>
      el.getAttribute('placeholder')?.includes('exactly what records')
    )
    fireEvent.change(scopeTextarea!, { target: { value: 'All contracts signed by the town in FY2024' } })

    fireEvent.click(screen.getByText('Open Case'))

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalled()
    })

    const createdCase: VaultCase = onSubmit.mock.calls[0][0]
    expect(createdCase.moduleId).toBe('VAULTPRR')
    expect(createdCase.currentStage).toBe('INTAKE')
    expect(createdCase.subject.requesterName).toBe('Alice Tester')
    expect(createdCase.subject.requesterEmail).toBe('alice@example.com')
    expect(createdCase.scopeDefinition).toBe('All contracts signed by the town in FY2024')
    expect(createdCase.createdBy).toBe('clerk@test.gov')
  })

  it('auto-generates a case number matching PRR-{year}-NNN format', async () => {
    const onSubmit = vi.fn()
    render(
      <CaseIntake
        moduleId="VAULTPRR"
        settings={makeSettings()}
        existingCases={[]}
        actor="clerk@test.gov"
        onSubmit={onSubmit}
        onBack={vi.fn()}
      />
    )

    // Fill required fields
    const nameInput = screen.getAllByRole('textbox').find(el => el.getAttribute('placeholder') === 'Full legal name')
    fireEvent.change(nameInput!, { target: { value: 'Carol Test' } })

    const emailInput = screen.getAllByRole('textbox').find(el => el.getAttribute('placeholder') === 'you@example.com')
    fireEvent.change(emailInput!, { target: { value: 'carol@example.com' } })

    const selects = screen.getAllByRole('combobox')
    fireEvent.change(selects[0], { target: { value: 'Email' } })

    const requestTextInput = screen.getAllByRole('textbox').find(el =>
      el.getAttribute('placeholder')?.includes('specific records')
    )
    fireEvent.change(requestTextInput!, { target: { value: 'Budget documents' } })

    const scopeTextarea = screen.getAllByRole('textbox').find(el =>
      el.getAttribute('placeholder')?.includes('exactly what records')
    )
    fireEvent.change(scopeTextarea!, { target: { value: 'FY2024 budget documents' } })

    fireEvent.click(screen.getByText('Open Case'))

    await waitFor(() => expect(onSubmit).toHaveBeenCalled())

    const createdCase: VaultCase = onSubmit.mock.calls[0][0]
    const year = new Date().getFullYear()
    // Pattern: PRR-YYYY-NNN (3+ digits)
    expect(createdCase.caseNumber).toMatch(new RegExp(`^PRR-${year}-\\d+$`))
  })

  it('new case starts at INTAKE stage with deadlines computed', async () => {
    const onSubmit = vi.fn()
    render(
      <CaseIntake
        moduleId="VAULTPRR"
        settings={makeSettings()}
        existingCases={[]}
        actor="clerk@test.gov"
        onSubmit={onSubmit}
        onBack={vi.fn()}
      />
    )

    const nameInput = screen.getAllByRole('textbox').find(el => el.getAttribute('placeholder') === 'Full legal name')
    fireEvent.change(nameInput!, { target: { value: 'Dave Test' } })

    const emailInput = screen.getAllByRole('textbox').find(el => el.getAttribute('placeholder') === 'you@example.com')
    fireEvent.change(emailInput!, { target: { value: 'dave@example.com' } })

    const selects = screen.getAllByRole('combobox')
    fireEvent.change(selects[0], { target: { value: 'Mail' } })

    const requestTextInput = screen.getAllByRole('textbox').find(el =>
      el.getAttribute('placeholder')?.includes('specific records')
    )
    fireEvent.change(requestTextInput!, { target: { value: 'Meeting minutes' } })

    const scopeTextarea = screen.getAllByRole('textbox').find(el =>
      el.getAttribute('placeholder')?.includes('exactly what records')
    )
    fireEvent.change(scopeTextarea!, { target: { value: 'Town council meeting minutes 2023' } })

    fireEvent.click(screen.getByText('Open Case'))

    await waitFor(() => expect(onSubmit).toHaveBeenCalled())

    const createdCase: VaultCase = onSubmit.mock.calls[0][0]
    expect(createdCase.currentStage).toBe('INTAKE')
    // T10 and T25 deadlines should be computed
    expect(createdCase.deadlines['T10']).toBeTruthy()
    expect(createdCase.deadlines['T10'].dueDate).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(createdCase.deadlines['T25']).toBeTruthy()
  })

  it('cancel button calls onBack', () => {
    const onBack = vi.fn()
    render(
      <CaseIntake
        moduleId="VAULTPRR"
        settings={makeSettings()}
        existingCases={[]}
        actor="clerk@test.gov"
        onSubmit={vi.fn()}
        onBack={onBack}
      />
    )

    const backBtn = screen.getByLabelText('Go back')
    fireEvent.click(backBtn)
    expect(onBack).toHaveBeenCalledOnce()
  })
})
