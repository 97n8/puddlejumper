import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CGMPanel } from '@/features/cgm/components/CGMPanel'

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

vi.mock('@/features/cgm/api', () => ({
  cgmApi: {
    listCases: vi.fn().mockResolvedValue([]),
    getCase: vi.fn().mockResolvedValue(null),
    createCase: vi.fn().mockResolvedValue({}),
  },
}))

describe('CGMPanel smoke suite', () => {
  it('renders without crashing', () => {
    render(<CGMPanel onBack={vi.fn()} />)
    expect(document.body).toBeTruthy()
  })

  it('shows Capital & Grants heading', () => {
    render(<CGMPanel onBack={vi.fn()} />)
    expect(screen.getByText('Capital & Grants')).toBeInTheDocument()
  })

  it('shows Active, Setup, and Closed tabs', () => {
    render(<CGMPanel onBack={vi.fn()} />)
    expect(screen.getByRole('tab', { name: /active/i })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /setup/i })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /closed/i })).toBeInTheDocument()
  })

  it('Active tab shows empty state when no cases', () => {
    render(<CGMPanel onBack={vi.fn()} />)
    expect(screen.getByText(/No active cases/i)).toBeInTheDocument()
  })

  it('New button opens New Capital & Grant Case dialog', async () => {
    const user = userEvent.setup()
    render(<CGMPanel onBack={vi.fn()} />)
    await user.click(screen.getByRole('button', { name: /new/i }))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText('New Capital & Grant Case')).toBeInTheDocument()
  })
})
