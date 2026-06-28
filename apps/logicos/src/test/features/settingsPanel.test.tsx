import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

vi.mock('@/services/auth/AuthContext', () => ({
  useAuth: () => ({ user: { sub: 'u1', email: 'test@example.com', name: 'Test User' } }),
}))

vi.mock('@/hooks/useKV', () => ({
  useKV: (_key: string, defaultVal: unknown) => [defaultVal, vi.fn()],
}))

vi.mock('@/services/pjApi', () => ({
  pjApi: {
    auth: {
      changePassword: vi.fn().mockResolvedValue({}),
      me: vi.fn().mockResolvedValue({}),
    },
    connectors: {
      list: vi.fn().mockResolvedValue([]),
      connect: vi.fn().mockResolvedValue({}),
      disconnect: vi.fn().mockResolvedValue({}),
      status: vi.fn().mockResolvedValue({}),
    },
  },
}))

vi.mock('@/lib/colorContext', () => ({
  useShellColor: () => ({ shellColor: 'zinc', setShellColor: vi.fn() }),
}))

const { SettingsPanel } = await import('@/features/settings/components/SettingsPanel')

describe('SettingsPanel smoke suite', () => {
  it('renders without crashing', () => {
    render(<SettingsPanel />)
    expect(document.body).toBeTruthy()
  })

  it('shows Settings heading', () => {
    render(<SettingsPanel />)
    expect(screen.getByText('Settings')).toBeInTheDocument()
  })

  it('shows Account and Appearance tabs', () => {
    render(<SettingsPanel />)
    expect(screen.getAllByText('Account').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Appearance').length).toBeGreaterThan(0)
  })
})
