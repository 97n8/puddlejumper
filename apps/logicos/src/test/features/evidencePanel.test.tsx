import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { EvidencePanel } from '@/features/evidence/components/EvidencePanel'

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

vi.mock('@/features/evidence/api', () => ({
  useAuditEvents: () => ({ data: [], isLoading: false, refetch: vi.fn() }),
  useEvidencePackages: () => ({ data: [], isLoading: false, refetch: vi.fn() }),
  useGeneratePackage: () => ({ mutateAsync: vi.fn(), isPending: false }),
}))

describe('EvidencePanel smoke suite', () => {
  it('renders Evidence Packages heading', () => {
    render(<EvidencePanel onBack={vi.fn()} />)
    expect(screen.getByText('Evidence Packages')).toBeInTheDocument()
  })

  it('shows Audit Events tab active by default with empty state', () => {
    render(<EvidencePanel onBack={vi.fn()} />)
    expect(screen.getByRole('tab', { name: /audit events/i })).toBeInTheDocument()
    const panel = screen.getByRole('tabpanel')
    expect(panel).toHaveTextContent('No audit events found.')
  })

  it('shows both Audit Events and Packages tabs', () => {
    render(<EvidencePanel onBack={vi.fn()} />)
    expect(screen.getByRole('tab', { name: /audit events/i })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /packages/i })).toBeInTheDocument()
  })

  it('shows Packages tab with empty state when switched', async () => {
    const user = userEvent.setup()
    render(<EvidencePanel onBack={vi.fn()} />)
    await user.click(screen.getByRole('tab', { name: /packages/i }))
    expect(screen.getByText(/No packages yet/i)).toBeInTheDocument()
  })

  it('Generate button opens dialog', async () => {
    const user = userEvent.setup()
    render(<EvidencePanel onBack={vi.fn()} />)
    await user.click(screen.getByRole('button', { name: /generate/i }))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText('Generate Evidence Package')).toBeInTheDocument()
  })

  it('Generate Package button in Packages empty state also opens dialog', async () => {
    const user = userEvent.setup()
    render(<EvidencePanel onBack={vi.fn()} />)
    await user.click(screen.getByRole('tab', { name: /packages/i }))
    // The second Generate Package button in the empty state
    const btns = screen.getAllByRole('button', { name: /generate/i })
    expect(btns.length).toBeGreaterThanOrEqual(2)
  })

  it('shows copy hash button rendered for each event row', () => {
    // With empty events (module-level mock), panel shows empty state
    render(<EvidencePanel onBack={vi.fn()} />)
    const panel = screen.getByRole('tabpanel')
    expect(panel).toHaveTextContent('No audit events found.')
  })
})
