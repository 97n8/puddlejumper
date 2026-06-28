import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PermittingPanel } from '@/features/permitting/components/PermittingPanel'

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

vi.mock('@/lib/api', () => ({
  pjFetch: vi.fn().mockResolvedValue({ permits: [], inspections: [] }),
}))

describe('PermittingPanel smoke suite', () => {
  it('renders without crashing', () => {
    render(<PermittingPanel onBack={vi.fn()} />)
    expect(document.body).toBeTruthy()
  })

  it('shows Permitting heading', () => {
    render(<PermittingPanel onBack={vi.fn()} />)
    expect(screen.getByText('Permitting')).toBeInTheDocument()
  })

  it('shows MGL c.40A subtitle', () => {
    render(<PermittingPanel onBack={vi.fn()} />)
    expect(screen.getByText(/MGL c\.40A/i)).toBeInTheDocument()
  })

  it('shows Open Permits, Inspections, and Violations tabs', () => {
    render(<PermittingPanel onBack={vi.fn()} />)
    expect(screen.getByRole('tab', { name: /open permits/i })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /inspections/i })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /violations/i })).toBeInTheDocument()
  })

  it('Open Permits tab shows empty state when no permits', async () => {
    render(<PermittingPanel onBack={vi.fn()} />)
    expect(await screen.findByText(/No open permit applications/i)).toBeInTheDocument()
  })

  it('New button opens New Permit Application dialog', async () => {
    const user = userEvent.setup()
    render(<PermittingPanel onBack={vi.fn()} />)
    await user.click(screen.getByRole('button', { name: /new/i }))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText('New Permit Application')).toBeInTheDocument()
  })
})
