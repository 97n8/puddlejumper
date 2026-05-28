import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RecordsPanel } from '@/features/records/components/RecordsPanel'

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

vi.mock('@/features/records/api', () => ({
  usePRRRequests: () => ({ data: [], isLoading: false, isError: false, error: null, refetch: vi.fn() }),
  useCreatePRR: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useAcknowledgePRR: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useClosePRR: () => ({ mutateAsync: vi.fn(), isPending: false }),
}))

vi.mock('@/lib/api', () => ({
  pjFetch: vi.fn().mockResolvedValue([]),
}))

describe('Records smoke suite', () => {
  it('renders RecordsPanel with PRR tab', () => {
    render(<RecordsPanel onBack={vi.fn()} />)
    expect(screen.getByText('Records')).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /public records requests/i })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /retention schedule/i })).toBeInTheDocument()
  })

  it('shows "No public records requests on file" empty state', () => {
    render(<RecordsPanel onBack={vi.fn()} />)
    expect(screen.getByText(/No requests on file/i)).toBeInTheDocument()
  })

  it('New PRR button opens dialog', async () => {
    const user = userEvent.setup()
    render(<RecordsPanel onBack={vi.fn()} />)
    await user.click(screen.getByRole('button', { name: /log request/i }))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText('New Public Records Request')).toBeInTheDocument()
  })

  it('Retention Schedule tab renders all 5 retention classes', async () => {
    const user = userEvent.setup()
    render(<RecordsPanel onBack={vi.fn()} />)
    await user.click(screen.getByRole('tab', { name: /retention schedule/i }))
    expect(screen.getByText('Permanent')).toBeInTheDocument()
    expect(screen.getByText(/Long-term \(7/i)).toBeInTheDocument()
    expect(screen.getByText(/Standard \(3/i)).toBeInTheDocument()
    expect(screen.getByText(/Short-term \(1/i)).toBeInTheDocument()
    expect(screen.getByText('Transitory')).toBeInTheDocument()
  })

  it('retention classes include expected labels', async () => {
    const user = userEvent.setup()
    render(<RecordsPanel onBack={vi.fn()} />)
    await user.click(screen.getByRole('tab', { name: /retention schedule/i }))
    const labels = ['Permanent', 'Transitory']
    for (const label of labels) {
      expect(screen.getByText(label)).toBeInTheDocument()
    }
  })
})
