import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import userEvent from '@testing-library/user-event'
import { EnvironmentWorkspace } from '@/features/environments/components/EnvironmentWorkspace'
import { ConstituentView } from '@/features/environments/components/ConstituentView'
import { CASESPACE_RETURN_TO_KEY } from '@/features/environments/constants/workspaceNavigation'

const { toastSuccess, mockLogin, mockRefresh, mockSetEnvironment, mockState } = vi.hoisted(() => ({
  toastSuccess: vi.fn(),
  mockLogin: vi.fn(),
  mockRefresh: vi.fn(),
  mockSetEnvironment: vi.fn(),
  mockState: {
    authUser: {
      sub: 'u-1',
      email: 'clerk@millbrook.gov',
      name: 'Town Clerk',
    } as { sub: string; email: string; name: string } | null,
    workspaceState: {
      status: 'not_found',
      requestedId: 'missing-env',
      refresh: vi.fn(),
      setEnvironment: vi.fn(),
    } as Record<string, unknown>,
  },
}))

vi.mock('sonner', () => ({
  toast: {
    success: toastSuccess,
    error: vi.fn(),
    loading: vi.fn(),
  },
}))

vi.mock('@/services/auth/AuthContext', () => ({
  useAuth: () => ({ user: mockState.authUser, login: mockLogin }),
}))

vi.mock('@/hooks/useMobileMode', () => ({
  useMobileMode: () => ({ isMobile: false, viewOverride: 'desktop', setViewOverride: vi.fn() }),
}))

vi.mock('@/lib/environmentAccess', () => ({
  isSuttonEnvironment: (environment: { id?: string }) => environment.id === 'sutton-vault',
  isSuttonRestrictedUser: (user: { email?: string } | null) => user?.email === 'restricted@sutton.ma.us',
}))

vi.mock('@/features/environments/hooks/useEnvironmentWorkspace', () => ({
  useEnvironmentWorkspace: () => mockState.workspaceState,
}))

vi.mock('@/features/environments/hooks/useEnvironmentActivity', () => ({
  useEnvironmentActivity: () => ({ activities: [{ id: 'a1', title: 'Permit received' }] }),
}))

vi.mock('@/features/environments/hooks/useEnvironmentMembers', () => ({
  useEnvironmentMembers: () => ({ members: [{ id: 'm1', name: 'Clerk' }] }),
}))

vi.mock('@/features/environments/components/ModuleGrid', () => ({
  ModuleGrid: () => <div>Module grid</div>,
}))

vi.mock('@/features/environments/components/ActivityFeed', () => ({
  ActivityFeed: () => <div>Activity feed</div>,
}))

vi.mock('@/features/environments/components/MemberPanel', () => ({
  MemberPanel: () => <div>Member panel</div>,
}))

vi.mock('@/features/environments/components/TownCaseSpaceDemoPanel', () => ({
  TownCaseSpaceDemoPanel: ({ section }: { section: string }) => <div>Town demo section: {section}</div>,
}))

vi.mock('@/features/vault/components/VaultEnvironmentWorkspace', () => ({
  VaultEnvironmentWorkspace: ({ envId }: { envId: string }) => <div>Vault workspace for {envId}</div>,
}))

vi.mock('@/features/environments/components/MunicipalAutomationsPanel', () => ({
  MunicipalAutomationsPanel: ({ town }: { town: string }) => <div>Automations for {town}</div>,
}))

vi.mock('@/features/environments/components/MunicipalTemplatesPanel', () => ({
  MunicipalTemplatesPanel: ({ town }: { town: string }) => <div>Templates for {town}</div>,
}))

vi.mock('@/features/logicbuilder/components/AppsPanel', () => ({
  AppsPanel: () => <div>Apps panel</div>,
}))

vi.mock('@/features/logicbuilder/components/BotsPanel', () => ({
  BotsPanel: () => <div>Bots panel</div>,
}))

describe('municipal workflow smoke', () => {
  beforeEach(() => {
    toastSuccess.mockReset()
    mockLogin.mockReset()
    mockRefresh.mockReset()
    mockSetEnvironment.mockReset()
    mockState.authUser = {
      sub: 'u-1',
      email: 'clerk@millbrook.gov',
      name: 'Town Clerk',
    }
    sessionStorage.clear()
    mockState.workspaceState = {
      status: 'not_found',
      requestedId: 'missing-env',
      refresh: mockRefresh,
      setEnvironment: mockSetEnvironment,
    }
    vi.restoreAllMocks()
  })

  describe('environment workspace resilience', () => {
    it('sends the user back cleanly when the environment is missing', async () => {
      const user = userEvent.setup()
      const onBack = vi.fn()

      render(
        <MemoryRouter>
          <EnvironmentWorkspace
            environmentId="missing-env"
            onBack={onBack}
            onSelectTool={vi.fn()}
          />
        </MemoryRouter>
      )

      expect(screen.getByText('Environment not found.')).toBeInTheDocument()
      await user.click(screen.getByRole('button', { name: /back to environments/i }))
      expect(onBack).toHaveBeenCalledOnce()
    })

    it('renders a sign-in prompt instead of a missing-environment message when auth is required', async () => {
      const user = userEvent.setup()
      mockState.workspaceState = {
        status: 'unauthenticated',
        message: 'Authentication required',
        refresh: mockRefresh,
        setEnvironment: mockSetEnvironment,
      }

      Object.defineProperty(window, 'location', {
        value: {
          ...window.location,
          pathname: '/casespaces/vault-phillipston-prr',
          search: '',
          hash: '',
        },
        writable: true,
      })

      render(
        <MemoryRouter>
          <EnvironmentWorkspace
            environmentId="vault-phillipston-prr"
            onBack={vi.fn()}
            onSelectTool={vi.fn()}
          />
        </MemoryRouter>
      )

      expect(screen.getByText('Sign in to open this casespace.')).toBeInTheDocument()
      expect(screen.queryByText('Environment not found.')).not.toBeInTheDocument()
      await user.click(screen.getByRole('button', { name: /sign in with github/i }))
      expect(sessionStorage.getItem(CASESPACE_RETURN_TO_KEY)).toBe('/casespaces/vault-phillipston-prr')
      expect(mockLogin).toHaveBeenCalledWith('github')
    })

    it('surfaces empty-state guidance when no casespaces exist', async () => {
      const user = userEvent.setup()
      const onBack = vi.fn()
      mockState.workspaceState = {
        status: 'empty',
        refresh: mockRefresh,
        setEnvironment: mockSetEnvironment,
      }

      render(
        <MemoryRouter>
          <EnvironmentWorkspace
            environmentId="empty-scope"
            onBack={onBack}
            onSelectTool={vi.fn()}
          />
        </MemoryRouter>
      )

      expect(screen.getByText("You don't have any casespaces yet.")).toBeInTheDocument()
      await user.click(screen.getByRole('button', { name: /create or seed a casespace/i }))
      expect(onBack).toHaveBeenCalledOnce()
    })

    it('shows the explicit error state and retries without collapsing into not found', async () => {
      const user = userEvent.setup()
      mockState.workspaceState = {
        status: 'error',
        message: 'Service unavailable',
        refresh: mockRefresh,
        setEnvironment: mockSetEnvironment,
      }

      render(
        <MemoryRouter>
          <EnvironmentWorkspace
            environmentId="error-env"
            onBack={vi.fn()}
            onSelectTool={vi.fn()}
          />
        </MemoryRouter>
      )

      expect(screen.getByText("Couldn't load this casespace.")).toBeInTheDocument()
      expect(screen.getByText('Service unavailable')).toBeInTheDocument()
      await user.click(screen.getByRole('button', { name: /retry/i }))
      expect(mockRefresh).toHaveBeenCalledOnce()
    })

    it('blocks a restricted Sutton login from entering the wrong municipal environment', async () => {
      const user = userEvent.setup()
      mockState.authUser = {
        sub: 'u-2',
        email: 'restricted@sutton.ma.us',
        name: 'Restricted User',
      }
      mockState.workspaceState = {
        status: 'ok',
        environment: { id: 'millbrook-vault', name: 'Millbrook', type: 'vault', vaultModuleIds: [] },
        refresh: mockRefresh,
        setEnvironment: mockSetEnvironment,
      }
      const onBack = vi.fn()

      render(
        <MemoryRouter>
          <EnvironmentWorkspace
            environmentId="millbrook-vault"
            onBack={onBack}
            onSelectTool={vi.fn()}
          />
        </MemoryRouter>
      )
      expect(screen.getByText('This login is restricted to the Sutton environment.')).toBeInTheDocument()
      await user.click(screen.getByRole('button', { name: /back to sutton/i }))
      expect(onBack).toHaveBeenCalledOnce()
    })

    it('moves through a vault workflow and survives operator-to-constituent switching', async () => {
      const user = userEvent.setup()
      mockState.workspaceState = {
        status: 'ok',
        environment: {
          id: 'millbrook-vault',
          name: 'Millbrook',
          type: 'vault',
          color: '#627DBD',
          vaultModuleIds: ['permits', 'finance'],
        },
        refresh: mockRefresh,
        setEnvironment: mockSetEnvironment,
      }

      render(
        <MemoryRouter>
          <EnvironmentWorkspace
            environmentId="millbrook-vault"
            onBack={vi.fn()}
            onSelectTool={vi.fn()}
          />
        </MemoryRouter>
      )

      expect(screen.getByText('Vault workspace for millbrook-vault')).toBeInTheDocument()

      await user.click(screen.getByRole('button', { name: /automations/i }))
      expect(screen.getByText('Automations for Millbrook')).toBeInTheDocument()

      await user.click(screen.getByRole('button', { name: /templates/i }))
      expect(screen.getByText('Templates for Millbrook')).toBeInTheDocument()

      await user.click(screen.getByRole('button', { name: /constituents/i }))
      expect(screen.getByText('Constituent Directory')).toBeInTheDocument()
      expect(screen.getByText('Constituent Management')).toBeInTheDocument()

      await user.click(screen.getByRole('button', { name: /back to millbrook/i }))
      await waitFor(() => {
        expect(screen.queryByText('Constituent Management')).not.toBeInTheDocument()
      })
    })
  })

  describe('constituent last-mile actions', () => {
    it('handles search misses and still leaves the operator in a controlled empty state', async () => {
      const user = userEvent.setup()

      render(<ConstituentView demoEmail="clerk@millbrook.gov" municipalityName="Millbrook" />)

      await user.type(screen.getByLabelText('Search constituents'), 'zzzz-unmatched')
      expect(screen.getByText('No residents found.')).toBeInTheDocument()
    })

    it('supports drafting notices and downloading summaries with the town email flow', async () => {
      const user = userEvent.setup()
      const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
      const createObjectUrlSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:summary')
      const revokeObjectUrlSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})

      Object.defineProperty(window, 'location', {
        value: { ...window.location, href: '' },
        writable: true,
      })

      render(<ConstituentView demoEmail="clerk@millbrook.gov" municipalityName="Millbrook" />)

      await user.click(screen.getByRole('button', { name: /margaret donovan/i }))
      expect(screen.getByText('Constituent status visibility')).toBeInTheDocument()

      await user.click(screen.getByRole('button', { name: /send notice/i }))
      expect(String(window.location.href)).toContain('mailto:clerk%40millbrook.gov')
      expect(toastSuccess).toHaveBeenCalledWith('Drafted a status notice to clerk@millbrook.gov.')

      await user.click(screen.getByRole('button', { name: /print summary/i }))
      expect(clickSpy).toHaveBeenCalled()
      expect(createObjectUrlSpy).toHaveBeenCalled()
      expect(revokeObjectUrlSpy).toHaveBeenCalled()
      expect(toastSuccess).toHaveBeenCalledWith('Constituent summary downloaded. In live use, this can also auto-route and trigger reminders.')
    })
  })
})
