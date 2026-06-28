import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { StaffHRPanel } from '@/features/staffhr/components/StaffHRPanel'

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

vi.mock('@/lib/api', () => ({
  pjFetch: vi.fn().mockResolvedValue({ positions: [], staff: [], certifications: [] }),
}))

describe('StaffHRPanel smoke suite', () => {
  it('renders without crashing', () => {
    render(<StaffHRPanel onBack={vi.fn()} />)
    expect(document.body).toBeTruthy()
  })

  it('shows Staff & HR heading', () => {
    render(<StaffHRPanel onBack={vi.fn()} />)
    expect(screen.getByText('Staff & HR')).toBeInTheDocument()
  })

  it('shows FLSA subtitle', () => {
    render(<StaffHRPanel onBack={vi.fn()} />)
    expect(screen.getByText(/FLSA/i)).toBeInTheDocument()
  })

  it('shows Position Register, Active Staff, and Training tabs', () => {
    render(<StaffHRPanel onBack={vi.fn()} />)
    expect(screen.getByRole('tab', { name: /position register/i })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /active staff/i })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /training/i })).toBeInTheDocument()
  })

  it('New button opens New Position dialog', async () => {
    const user = userEvent.setup()
    render(<StaffHRPanel onBack={vi.fn()} />)
    await user.click(screen.getByRole('button', { name: /new/i }))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText(/New Position/i)).toBeInTheDocument()
  })
})
