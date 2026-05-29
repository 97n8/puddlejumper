import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import { CaseSpaceApiError } from '@/services/casespaceApi'
import { getBuilderSessionStorageKey, listBuilderSessions } from '@/lib/vault-modules'

const testState = vi.hoisted(() => ({
  createCaseSpace: vi.fn(),
  notifyEnvironmentCreated: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
  reviewState: {
    town: 'Phillipston',
    workflowTeamSize: '1',
    selectedIds: ['VAULTPRR'],
    setups: {
      VAULTPRR: {
        moduleId: 'VAULTPRR',
        officerName: 'Town Clerk',
        officerTitle: 'Clerk',
        officerEmail: 'clerk@phillipston.ma.us',
        officerPhone: '',
        routing: {
          intake: 'none',
          documents: 'none',
          tracking: 'none',
        },
        folders: {},
        retentionYears: 6,
        workflowSteps: ['Intake', 'Review', 'Response'],
        workflowAssignments: {},
        notes: '',
      },
    },
  },
}))

vi.mock('sonner', () => ({
  toast: {
    success: testState.toastSuccess,
    error: testState.toastError,
    info: vi.fn(),
  },
}))

vi.mock('@/hooks/useKV', async () => {
  const React = await import('react')
  return {
    useKV<T>(key: string, defaultValue: T) {
      const initialValue = key.includes('vault-module-maker-state')
        ? testState.reviewState
        : key.includes('vault-module-maker-step')
          ? 'review'
          : defaultValue
      return React.useState(initialValue as T)
    },
  }
})

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

vi.mock('@/services/casespaceApi', async () => {
  const actual = await vi.importActual<typeof import('@/services/casespaceApi')>('@/services/casespaceApi')
  return {
    ...actual,
    createCaseSpace: testState.createCaseSpace,
  }
})

vi.mock('@/features/environments/lib/environmentResolution', () => ({
  builderSessionToEnvironment: vi.fn((session: { town: string; id: string; selectedModuleIds?: string[] }) => ({
    id: `env-${session.id}`,
    name: `${session.town} Governance`,
    vaultModuleIds: session.selectedModuleIds ?? ['VAULTPRR'],
    type: 'vault',
    visibility: 'organization',
    members: [],
    connectionIds: [],
    createdAt: Date.now(),
  })),
}))

vi.mock('@/features/environments/utils/notifyEnvironmentCreated', () => ({
  notifyEnvironmentCreated: testState.notifyEnvironmentCreated,
}))

vi.mock('@/services/serverPrefsCache', () => ({
  getServerPref: vi.fn().mockReturnValue(undefined),
  writeServerPref: vi.fn(),
}))

const { VaultModuleMaker } = await import('@/features/builder/components/VaultModuleMaker')

function mockSupportingFetches() {
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input)
    if (url.includes('/api/fiscal/sync')) {
      return new Response(JSON.stringify({
        fiscalYear: 2026,
        metrics: {},
        riskFlags: [],
      }), { status: 200, headers: { 'Content-Type': 'application/json' } })
    }

    if (url.includes('/api/civic/staff')) {
      return new Response(JSON.stringify({
        employees: [],
        notice: null,
      }), { status: 200, headers: { 'Content-Type': 'application/json' } })
    }

    return new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } })
  }))
}

async function clickActivate() {
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: /activate for phillipston/i }))
    await Promise.resolve()
  })
}

describe('VaultModuleMaker activation state', () => {
  beforeEach(() => {
    localStorage.clear()
    testState.createCaseSpace.mockReset()
    testState.notifyEnvironmentCreated.mockReset()
    testState.toastSuccess.mockReset()
    testState.toastError.mockReset()
    testState.createCaseSpace.mockResolvedValue({
      id: 'env-phillipston',
      name: 'Phillipston Governance',
      vaultModuleIds: ['VAULTPRR'],
      type: 'vault',
      visibility: 'organization',
      members: [],
      connectionIds: [],
      createdAt: Date.now(),
    })
    mockSupportingFetches()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('shows full success only after createCaseSpace persists to the server', async () => {
    render(<VaultModuleMaker />)

    await clickActivate()

    expect(await screen.findByText(/Phillipston is live on VAULT/i, {}, { timeout: 2500 })).toBeInTheDocument()
    expect(testState.toastSuccess).toHaveBeenCalledWith('Phillipston activated on VAULT!')
    expect(testState.toastError).not.toHaveBeenCalled()
    expect(listBuilderSessions().at(-1)?.status).toBe('activated')
  })

  it('renders auth_required on 401 and keeps the draft local-only', async () => {
    testState.createCaseSpace.mockRejectedValueOnce(new CaseSpaceApiError(401, 'Need sign in'))
    render(<VaultModuleMaker />)

    await clickActivate()

    await waitFor(() => expect(screen.getByText('Authentication required')).toBeInTheDocument())
    expect(screen.getByText(/Saved locally, but not synced/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /retry sync/i })).toBeInTheDocument()
    expect(screen.queryByText(/Phillipston is live on VAULT/i)).not.toBeInTheDocument()
    expect(testState.toastSuccess).not.toHaveBeenCalled()
    expect(listBuilderSessions().at(-1)?.status).toBe('review')
  })

  it('renders unauthorized on 403 and does not show activation success', async () => {
    testState.createCaseSpace.mockRejectedValueOnce(new CaseSpaceApiError(403, 'Forbidden'))
    render(<VaultModuleMaker />)

    await clickActivate()

    await waitFor(() => expect(screen.getByText('Not authorized to activate')).toBeInTheDocument())
    expect(screen.getByText(/Saved locally, but not synced\./i)).toBeInTheDocument()
    expect(screen.queryByText(/Phillipston is live on VAULT/i)).not.toBeInTheDocument()
    expect(testState.toastSuccess).not.toHaveBeenCalled()
    expect(listBuilderSessions().at(-1)?.status).toBe('review')
  })

  it('renders persist_failed on server errors and can retry to finish syncing', async () => {
    testState.createCaseSpace
      .mockRejectedValueOnce(new CaseSpaceApiError(500, 'Server exploded'))
      .mockResolvedValueOnce({
        id: 'env-phillipston',
        name: 'Phillipston Governance',
        vaultModuleIds: ['VAULTPRR'],
        type: 'vault',
        visibility: 'organization',
        members: [],
        connectionIds: [],
        createdAt: Date.now(),
      })

    render(<VaultModuleMaker />)

    await clickActivate()

    await waitFor(() => expect(screen.getByText('Sync failed')).toBeInTheDocument())
    expect(screen.getByText(/Saved locally, but not synced\. Server exploded/i)).toBeInTheDocument()
    expect(screen.queryByText(/Phillipston is live on VAULT/i)).not.toBeInTheDocument()
    expect(listBuilderSessions().at(-1)?.status).toBe('review')

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /retry sync/i }))
      await Promise.resolve()
    })

    expect(await screen.findByText(/Phillipston is live on VAULT/i, {}, { timeout: 2500 })).toBeInTheDocument()
    expect(listBuilderSessions().at(-1)?.status).toBe('activated')
  })

  it('renders persist_failed on network failures without showing full success', async () => {
    testState.createCaseSpace.mockRejectedValueOnce(new TypeError('Network unavailable'))
    render(<VaultModuleMaker />)

    await clickActivate()

    await waitFor(() => expect(screen.getByText('Sync failed')).toBeInTheDocument())
    expect(screen.getByText(/Saved locally, but not synced\. Network unavailable/i)).toBeInTheDocument()
    expect(screen.queryByText(/Phillipston is live on VAULT/i)).not.toBeInTheDocument()
    expect(testState.toastSuccess).not.toHaveBeenCalled()
    expect(localStorage.getItem(getBuilderSessionStorageKey())).toContain('"status":"review"')
  })
})
