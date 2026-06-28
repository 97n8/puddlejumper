import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TimePanel } from '@/features/time/components/TimePanel'

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

vi.mock('@/lib/api', () => ({
  pjFetch: vi.fn().mockResolvedValue([]),
}))

describe('TimePanel smoke suite', () => {
  it('renders without crashing', () => {
    render(<TimePanel onBack={vi.fn()} />)
    expect(document.body).toBeTruthy()
  })

  it('shows Deadline Tracking heading', () => {
    render(<TimePanel onBack={vi.fn()} />)
    expect(screen.getByText('Deadline Tracking')).toBeInTheDocument()
  })

  it('shows empty state when no deadlines', async () => {
    render(<TimePanel onBack={vi.fn()} />)
    expect(await screen.findByText(/No active deadlines/i)).toBeInTheDocument()
  })

  it('New button opens New Deadline dialog', async () => {
    const user = userEvent.setup()
    render(<TimePanel onBack={vi.fn()} />)
    await user.click(screen.getByRole('button', { name: /new/i }))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText('New Deadline')).toBeInTheDocument()
  })
})
