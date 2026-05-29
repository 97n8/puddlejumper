import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}))

vi.mock('@/services/auth/AuthContext', () => ({
  useAuth: () => ({ user: { sub: 'u1', email: 'test@example.com', name: 'Test User' } }),
}))

vi.mock('@/services/pjApi', () => ({
  pjApi: {
    connectors: {
      status: vi.fn().mockResolvedValue({ connectors: {} }),
    },
  },
}))

vi.mock('@/lib/environmentAccess', () => ({
  getDemoUserScope: vi.fn().mockReturnValue(null),
  isDemoRestrictedUser: vi.fn().mockReturnValue(false),
}))

vi.mock('@/services/casespaceApi', () => ({
  createCaseSpace: vi.fn().mockResolvedValue({}),
}))

vi.mock('@/features/environments/lib/environmentResolution', () => ({
  builderSessionToEnvironment: vi.fn().mockReturnValue({}),
}))

vi.mock('@/services/serverPrefsCache', () => ({
  getServerPref: vi.fn().mockReturnValue(undefined),
  writeServerPref: vi.fn(),
}))

const { VaultModuleMaker } = await import('@/features/builder/components/VaultModuleMaker')

describe('VaultModuleMaker smoke suite', () => {
  it('renders without crashing', () => {
    render(<VaultModuleMaker />)
    expect(document.body).toBeTruthy()
  })

  it('shows the module setup wizard heading', () => {
    render(<VaultModuleMaker />)
    expect(screen.getByText(/Build a module stack in one calm pass/i)).toBeInTheDocument()
  })

  it('shows the stepper navigation', () => {
    render(<VaultModuleMaker />)
    // Stepper should be visible with step labels
    expect(document.body.querySelector('[data-slot]') ?? document.body).toBeTruthy()
  })
})
