import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CapitalProjectsPanel } from '@/features/capitalprojects/components/CapitalProjectsPanel'

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

vi.mock('@/lib/api', () => ({
  pjFetch: vi.fn().mockResolvedValue([]),
}))

describe('CapitalProjectsPanel smoke suite', () => {
  it('renders without crashing', () => {
    render(<CapitalProjectsPanel onBack={vi.fn()} />)
    expect(document.body).toBeTruthy()
  })

  it('shows Projects heading', () => {
    render(<CapitalProjectsPanel onBack={vi.fn()} />)
    expect(screen.getByText('Projects')).toBeInTheDocument()
  })

  it('shows MGL c.44 subtitle', () => {
    render(<CapitalProjectsPanel onBack={vi.fn()} />)
    expect(screen.getByText(/MGL c\.44/i)).toBeInTheDocument()
  })

  it('shows Active, Pipeline, and Closed tabs', () => {
    render(<CapitalProjectsPanel onBack={vi.fn()} />)
    expect(screen.getByRole('tab', { name: /active/i })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /pipeline/i })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /closed/i })).toBeInTheDocument()
  })

  it('Active tab shows empty state when no projects', () => {
    render(<CapitalProjectsPanel onBack={vi.fn()} />)
    expect(screen.getByText(/No active capital projects/i)).toBeInTheDocument()
  })

  it('New button opens New Capital Project dialog', async () => {
    const user = userEvent.setup()
    render(<CapitalProjectsPanel onBack={vi.fn()} />)
    await user.click(screen.getByRole('button', { name: /new/i }))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText('New Capital Project')).toBeInTheDocument()
  })
})
