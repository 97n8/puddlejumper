import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ProcurementPanel } from '@/features/procurement/components/ProcurementPanel'

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

vi.mock('@/features/procurement/api', () => ({
  useProcurements: () => ({ data: [], isLoading: false, refetch: vi.fn() }),
  useCreateProcurement: () => ({ mutateAsync: vi.fn(), isPending: false }),
}))

describe('ProcurementPanel smoke suite', () => {
  it('renders with Procurement heading and MGL subtitle', () => {
    render(<ProcurementPanel onBack={vi.fn()} />)
    expect(screen.getByText('Procurement')).toBeInTheDocument()
    expect(screen.getByText(/MGL Chapter 30B/i)).toBeInTheDocument()
  })

  it('shows Active, Awarded, and Compliance tabs', () => {
    render(<ProcurementPanel onBack={vi.fn()} />)
    expect(screen.getByRole('tab', { name: /active/i })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /awarded/i })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /compliance/i })).toBeInTheDocument()
  })

  it('Active tab shows empty state when no items', () => {
    render(<ProcurementPanel onBack={vi.fn()} />)
    const panel = screen.getByRole('tabpanel')
    expect(panel).toHaveTextContent('No procurement items found.')
  })

  it('New button opens procurement dialog', async () => {
    const user = userEvent.setup()
    render(<ProcurementPanel onBack={vi.fn()} />)
    await user.click(screen.getByRole('button', { name: /new/i }))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText('New Procurement Item')).toBeInTheDocument()
  })

  it('Compliance tab shows MGL Chapter 30B threshold reference', async () => {
    const user = userEvent.setup()
    render(<ProcurementPanel onBack={vi.fn()} />)
    await user.click(screen.getByRole('tab', { name: /compliance/i }))
    expect(screen.getByText(/MGL Chapter 30B Threshold Reference/i)).toBeInTheDocument()
    expect(screen.getByText(/Under \$10,000/i)).toBeInTheDocument()
    expect(screen.getByText(/Above \$50,000/i)).toBeInTheDocument()
  })

  it('Awarded tab shows empty state when no awarded contracts', async () => {
    const user = userEvent.setup()
    render(<ProcurementPanel onBack={vi.fn()} />)
    await user.click(screen.getByRole('tab', { name: /awarded/i }))
    const panel = screen.getByRole('tabpanel')
    expect(panel).toHaveTextContent('No awarded contracts yet.')
  })
})
