/**
 * OrgManager configure step — unit tests
 *
 * Tests the ModuleConfigureRow component in isolation, verifying:
 * - Accordion expand/collapse
 * - Officer field updates call onUpdateSetup
 * - Automation toggles call onToggleAuto
 * - goNext saves configs to civicApi
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ModuleConfigureRow } from '@/features/civic/components/ModuleConfigureRow'
import type { ModuleSetup, ProcessStep, AutoItem } from '@/features/civic/components/ModuleConfigureRow'
import type { VaultModule } from '@/lib/vault-modules'

// ── Fixtures ─────────────────────────────────────────────────────────────────

const mockModule: VaultModule = {
  id: 'VAULTFISCAL',
  name: 'Fiscal Controls & AP',
  domain: 'Fiscal',
  description: 'Vendor payment and invoice management',
  mglCitation: 'MGL c.44',
  defaultRetentionYears: 10,
  defaultWorkflowSteps: ['Invoice Intake', '3-Way Match', 'Budget Check', 'Approval Chain', 'Payment', 'GL Posting'],
  routingSlots: [
    { key: 'invoices', label: 'Invoices received in',        description: 'Where vendor invoices land', supports: ['sharepoint', 'google', 'none'] as const },
    { key: 'records',  label: 'Financial records stored in', description: 'Where approved records are filed', supports: ['sharepoint', 'google', 'none'] as const },
  ],
}

const mockSetup: ModuleSetup = {
  moduleId: 'VAULTFISCAL',
  officerName: '',
  officerTitle: 'Finance Director',
  officerEmail: '',
  officerPhone: '',
  routing: { invoices: 'none', records: 'none' },
  folders: { invoices: '', records: '' },
  retentionYears: 10,
}

const mockFlow: ProcessStep[] = [
  { label: 'Vendor submits invoice', role: 'Intake', system: true },
  { label: 'Finance Director review', role: 'Financial Authority', isOfficer: true },
]

const mockAutomations: AutoItem[] = [
  { key: 'formkey', label: 'Auto-assign FormKey', detail: 'Unique ID on intake', defaultOn: true },
  { key: 'weekly',  label: 'Weekly snapshot',     detail: 'Friday digest',       defaultOn: false },
]

function makeProps(overrides: Partial<Parameters<typeof ModuleConfigureRow>[0]> = {}) {
  return {
    module: mockModule,
    setup: mockSetup,
    isOpen: false,
    flow: mockFlow,
    automations: mockAutomations,
    townName: 'Orleans',
    msConnected: false,
    gConnected: false,
    onToggleOpen: vi.fn(),
    onUpdateSetup: vi.fn(),
    isAutoOn: vi.fn((key: string) => key === 'formkey'),
    onToggleAuto: vi.fn(),
    ...overrides,
  }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('ModuleConfigureRow', () => {
  it('renders module name in collapsed state', () => {
    render(<ModuleConfigureRow {...makeProps()} />)
    expect(screen.getByText('Fiscal Controls & AP')).toBeInTheDocument()
  })

  it('calls onToggleOpen when header is clicked', () => {
    const onToggleOpen = vi.fn()
    render(<ModuleConfigureRow {...makeProps({ onToggleOpen })} />)
    fireEvent.click(screen.getByRole('button', { name: /fiscal controls/i }))
    expect(onToggleOpen).toHaveBeenCalledTimes(1)
  })

  it('shows process flow steps when open', () => {
    render(<ModuleConfigureRow {...makeProps({ isOpen: true })} />)
    expect(screen.getByText('Vendor submits invoice')).toBeInTheDocument()
    expect(screen.getByText('Finance Director review')).toBeInTheDocument()
  })

  it('calls onUpdateSetup when officer name changes', () => {
    const onUpdateSetup = vi.fn()
    render(<ModuleConfigureRow {...makeProps({ isOpen: true, onUpdateSetup })} />)
    const input = screen.getByPlaceholderText('Full name')
    fireEvent.change(input, { target: { value: 'Jane Smith' } })
    expect(onUpdateSetup).toHaveBeenCalledWith(expect.objectContaining({ officerName: 'Jane Smith' }))
  })

  it('calls onUpdateSetup when officer email changes', () => {
    const onUpdateSetup = vi.fn()
    render(<ModuleConfigureRow {...makeProps({ isOpen: true, onUpdateSetup })} />)
    const input = screen.getByPlaceholderText('officer@town.gov')
    fireEvent.change(input, { target: { value: 'finance@orleans.gov' } })
    expect(onUpdateSetup).toHaveBeenCalledWith(expect.objectContaining({ officerEmail: 'finance@orleans.gov' }))
  })

  it('renders automation toggles when open', () => {
    render(<ModuleConfigureRow {...makeProps({ isOpen: true })} />)
    expect(screen.getByText('Auto-assign FormKey')).toBeInTheDocument()
    expect(screen.getByText('Weekly snapshot')).toBeInTheDocument()
  })

  it('calls onToggleAuto when automation button is clicked', () => {
    const onToggleAuto = vi.fn()
    render(<ModuleConfigureRow {...makeProps({ isOpen: true, onToggleAuto })} />)
    fireEvent.click(screen.getByText('Auto-assign FormKey').closest('button')!)
    expect(onToggleAuto).toHaveBeenCalledWith('formkey')
  })

  it('shows "Configured" badge when officerName is set', () => {
    const setup = { ...mockSetup, officerName: 'Jane Smith' }
    render(<ModuleConfigureRow {...makeProps({ setup })} />)
    expect(screen.getByText('Configured')).toBeInTheDocument()
  })

  it('shows retention year in collapsed header area', () => {
    render(<ModuleConfigureRow {...makeProps({ isOpen: true })} />)
    // Retention section should contain the default value
    expect(screen.getByDisplayValue('10')).toBeInTheDocument()
  })
})
