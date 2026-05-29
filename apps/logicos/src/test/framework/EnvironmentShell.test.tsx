import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { EnvironmentShell } from '@/framework/EnvironmentShell'
import type { EnvironmentActor, EnvironmentConfig } from '@/framework/types'

const { mockAuthState, mockOpenCloudSave } = vi.hoisted(() => ({
  mockAuthState: {
    user: {
      sub: 'u-1',
      email: 'clerk@test.gov',
      name: 'Town Clerk',
    } as { sub: string; email: string; name: string } | null,
    loading: false,
  },
  mockOpenCloudSave: vi.fn(),
}))

vi.mock('@/services/auth/AuthContext', () => ({
  useAuth: () => mockAuthState,
}))

vi.mock('@/context/CloudSaveContext', () => ({
  useCloudSave: () => ({ openCloudSave: mockOpenCloudSave }),
}))

const config: EnvironmentConfig = {
  id: 'civic',
  name: 'CIVIC V1',
  tagline: 'Municipal governance',
  color: 'red',
  apiBase: '/api/v1/civic',
  badge: 'Live',
  defaultModule: 'records',
  modules: [
    { id: 'records', label: 'Records', icon: 'FileDoc', group: 'Core' },
  ],
}

const actor: EnvironmentActor = {
  id: 'actor-1',
  object_id: 'object-1',
  display_name: 'Alice Admin',
  email: 'alice@test.gov',
  civic_role: 'staff',
  town: { town_name: 'Testville' },
}

describe('EnvironmentShell', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuthState.user = {
      sub: 'u-1',
      email: 'clerk@test.gov',
      name: 'Town Clerk',
    }
    mockAuthState.loading = false
  })

  it('renders loading state while auth is loading', () => {
    mockAuthState.loading = true
    const fetchActor = vi.fn()

    render(
      <EnvironmentShell
        config={config}
        onBack={vi.fn()}
        fetchActor={fetchActor}
        renderModule={() => <div>Module content</div>}
      />,
    )

    expect(screen.getByText('Opening CIVIC V1…')).toBeInTheDocument()
    expect(fetchActor).not.toHaveBeenCalled()
  })

  it('renders auth_required when actor fetch returns 401', async () => {
    const fetchActor = vi.fn().mockRejectedValue(Object.assign(new Error('Unauthorized'), { status: 401 }))

    render(
      <EnvironmentShell
        config={config}
        onBack={vi.fn()}
        fetchActor={fetchActor}
        renderModule={() => <div>Module content</div>}
      />,
    )

    await waitFor(() => {
      expect(screen.getByText('Log in to LogicOS to access this environment.')).toBeInTheDocument()
    })
    expect(screen.queryByText('Module content')).not.toBeInTheDocument()
  })

  it('renders unauthorized when actor fetch returns 403', async () => {
    const fetchActor = vi.fn().mockRejectedValue(Object.assign(new Error('Forbidden'), { status: 403 }))

    render(
      <EnvironmentShell
        config={config}
        onBack={vi.fn()}
        fetchActor={fetchActor}
        renderModule={() => <div>Module content</div>}
      />,
    )

    await waitFor(() => {
      expect(screen.getByText('Your account is not authorized for this environment.')).toBeInTheDocument()
    })
    expect(screen.queryByText('Module content')).not.toBeInTheDocument()
  })

  it('renders load_error on network or server failure and retries', async () => {
    const fetchActor = vi.fn()
      .mockRejectedValueOnce(new Error('Network offline'))
      .mockResolvedValueOnce(actor)
    const renderModule = vi.fn((_moduleId: string, resolvedActor: EnvironmentActor, _onNavigate: (moduleId: string) => void, _openCloudSave: unknown): ReactNode => (
      <div>Module content for {resolvedActor.display_name}</div>
    ))

    render(
      <EnvironmentShell
        config={config}
        onBack={vi.fn()}
        fetchActor={fetchActor}
        renderModule={renderModule}
      />,
    )

    await waitFor(() => {
      expect(screen.getByText('Network offline')).toBeInTheDocument()
    })
    expect(renderModule).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))

    await waitFor(() => {
      expect(screen.getByText('Module content for Alice Admin')).toBeInTheDocument()
    })
    expect(renderModule).toHaveBeenCalledWith('records', actor, expect.any(Function), mockOpenCloudSave)
  })

  it('renders shell content only when actor resolution is ok', async () => {
    const fetchActor = vi.fn().mockResolvedValue(actor)
    const renderModule = vi.fn((_moduleId: string, resolvedActor: EnvironmentActor): ReactNode => (
      <div>Module content for {resolvedActor.display_name}</div>
    ))

    render(
      <EnvironmentShell
        config={config}
        onBack={vi.fn()}
        fetchActor={fetchActor}
        renderModule={renderModule}
      />,
    )

    await waitFor(() => {
      expect(screen.getByText('Module content for Alice Admin')).toBeInTheDocument()
    })
    expect(screen.getByText('Alice Admin')).toBeInTheDocument()
    expect(screen.queryByText(/pending/i)).not.toBeInTheDocument()
  })
})
