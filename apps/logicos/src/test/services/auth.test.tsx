import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AuthProvider, useAuth } from '@/services/auth/AuthContext'

// Mock sonner so toast calls don't error in jsdom
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

function makeResponse(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: vi.fn().mockResolvedValue(body),
    text: vi.fn().mockResolvedValue(JSON.stringify(body)),
  } as unknown as Response
}

const testUser = {
  sub: 'user-123',
  email: 'test@example.com',
  name: 'Test User',
  role: 'member',
  provider: 'github',
  workspaceId: 'ws-1',
}

// Helper component that renders auth state to the DOM
function AuthDisplay() {
  const { user, loading } = useAuth()
  if (loading) return <div data-testid="loading">Loading…</div>
  if (!user) return <div data-testid="unauthenticated">Not signed in</div>
  return <div data-testid="user-name">{user.name}</div>
}

// Helper component to trigger login
function LoginButton() {
  const { login } = useAuth()
  return <button onClick={() => login('github')}>Sign in with GitHub</button>
}

// Helper component to trigger logout
function LogoutButton() {
  const { logout } = useAuth()
  return <button onClick={() => logout()}>Sign out</button>
}

describe('AuthProvider', () => {
  beforeEach(() => {
    mockFetch.mockReset()
    // Reset URL query string
    window.history.replaceState({}, '', '/')
    vi.unstubAllEnvs()
  })

  it('shows loading state initially', () => {
    // fetch never resolves during this test
    mockFetch.mockReturnValue(new Promise(() => {}))
    render(
      <AuthProvider>
        <AuthDisplay />
      </AuthProvider>
    )
    expect(screen.getByTestId('loading')).toBeInTheDocument()
  })

  it('sets user after /api/me returns successfully', async () => {
    mockFetch.mockResolvedValue(makeResponse(testUser))
    render(
      <AuthProvider>
        <AuthDisplay />
      </AuthProvider>
    )
    await waitFor(() => {
      expect(screen.getByTestId('user-name')).toHaveTextContent('Test User')
    })
  })

  it('sets user to null on 401', async () => {
    mockFetch.mockResolvedValue(makeResponse(null, 401))
    render(
      <AuthProvider>
        <AuthDisplay />
      </AuthProvider>
    )
    await waitFor(() => {
      expect(screen.getByTestId('unauthenticated')).toBeInTheDocument()
    })
  })

  it('sets user to null when /api/me returns non-ok', async () => {
    mockFetch.mockResolvedValue(makeResponse('Error', 500))
    render(
      <AuthProvider>
        <AuthDisplay />
      </AuthProvider>
    )
    await waitFor(() => {
      expect(screen.getByTestId('unauthenticated')).toBeInTheDocument()
    })
  })

  it('login() redirects to the right PJ URL', async () => {
    mockFetch.mockResolvedValue(makeResponse(null, 401))
    const assignMock = vi.fn()
    // jsdom doesn't allow changing window.location.href directly in all cases
    Object.defineProperty(window, 'location', {
      value: { ...window.location, href: '', assign: assignMock },
      writable: true,
    })

    render(
      <AuthProvider>
        <LoginButton />
      </AuthProvider>
    )
    await waitFor(() => screen.getByText('Sign in with GitHub'))
    await userEvent.click(screen.getByText('Sign in with GitHub'))
    // The auth URL should contain the provider path
    expect(window.location.href).toMatch(/\/api\/auth\/github\/login/)
  })

  it('logout() calls /api/auth/logout and clears user', async () => {
    // First call: /api/me returns the user
    mockFetch
      .mockResolvedValueOnce(makeResponse(testUser))
      // Second call: POST /api/auth/logout
      .mockResolvedValueOnce(makeResponse({}, 200))

    render(
      <AuthProvider>
        <AuthDisplay />
        <LogoutButton />
      </AuthProvider>
    )

    // Wait for user to load
    await waitFor(() => screen.getByTestId('user-name'))

    // Click logout
    await act(async () => {
      await userEvent.click(screen.getByText('Sign out'))
    })

    // User should be cleared
    await waitFor(() => {
      expect(screen.getByTestId('unauthenticated')).toBeInTheDocument()
    })

    // Verify the logout endpoint was called
    const logoutCall = mockFetch.mock.calls.find((args: unknown[]) =>
      typeof args[0] === 'string' && args[0].includes('/api/auth/logout')
    )
    expect(logoutCall).toBeDefined()
    expect((logoutCall?.[1] as RequestInit)?.method).toBe('POST')
  })

  it('handles fetch error gracefully — stays unauthenticated', async () => {
    mockFetch.mockRejectedValue(new Error('Network error'))
    render(
      <AuthProvider>
        <AuthDisplay />
      </AuthProvider>
    )
    await waitFor(() => {
      expect(screen.getByTestId('unauthenticated')).toBeInTheDocument()
    })
  })

  it('uses a localhost-only dev bypass when explicitly enabled', async () => {
    vi.stubEnv('DEV', true)
    vi.stubEnv('VITE_LOCAL_AUTH_BYPASS', '1')
    Object.defineProperty(window, 'location', {
      value: { ...window.location, hostname: 'localhost' },
      writable: true,
    })

    render(
      <AuthProvider>
        <AuthDisplay />
      </AuthProvider>
    )

    await waitFor(() => {
      expect(screen.getByTestId('user-name')).toHaveTextContent('Local Dev')
    })
    expect(mockFetch).not.toHaveBeenCalled()
  })
})
