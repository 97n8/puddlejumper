import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { LoginPage } from './LoginPage'

const login = vi.fn()

vi.mock('@/services/auth/AuthContext', () => ({
  useAuth: () => ({ login }),
}))

vi.mock('./LegalModal', () => ({
  LegalModal: () => null,
}))

describe('LoginPage', () => {
  beforeEach(() => {
    login.mockReset()
  })

  it('renders the simplified public landing page content', () => {
    render(<LoginPage />)

    expect(screen.getAllByText('PublicLogic LLC').length).toBeGreaterThan(0)
    expect(screen.getByRole('heading', { level: 1, name: /workspace/i })).toBeInTheDocument()
    expect(screen.getByText('Govern what holds.')).toBeInTheDocument()
    expect(screen.getByText('Your town, in your corner.')).toBeInTheDocument()
    expect(screen.getByText('Governance Workspace')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /start the conversation/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /sign in with github/i })).toBeInTheDocument()
  })

  it('starts oauth sign-in from the provider button', async () => {
    const user = userEvent.setup()
    render(<LoginPage />)

    await user.click(screen.getByRole('button', { name: /sign in with google/i }))

    expect(login).toHaveBeenCalledWith('google')
  })
})
