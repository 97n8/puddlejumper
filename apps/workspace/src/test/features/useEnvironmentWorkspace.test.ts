import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import type { CaseSpace } from '@/lib/types'

const mockListCaseSpaces = vi.fn()
const mockUpdateCaseSpace = vi.fn()
const mockLogCaseSpaceResolutionFailure = vi.fn()

vi.mock('@/services/casespaceApi', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/services/casespaceApi')>()
  return {
    ...actual,
    listCaseSpaces: (...args: unknown[]) => mockListCaseSpaces(...args),
    updateCaseSpace: (...args: unknown[]) => mockUpdateCaseSpace(...args),
    logCaseSpaceResolutionFailure: (...args: unknown[]) => mockLogCaseSpaceResolutionFailure(...args),
  }
})

vi.mock('@/features/environments/constants/logicville', () => ({
  ensureLogicvilleCaseSpace: vi.fn().mockImplementation((spaces: CaseSpace[]) =>
    Promise.resolve(spaces.find(space => space.id === 'vault-logicville') ?? {
      id: 'vault-logicville',
      name: 'Logicville',
      type: 'vault',
      visibility: 'organization',
      members: [],
      connectionIds: [],
      vaultModuleIds: [],
      createdAt: Date.now(),
      fileCount: 0,
      folderCount: 0,
      templateCount: 0,
    }),
  ),
}))

vi.mock('@/lib/vault-modules', () => ({
  listBuilderSessions: vi.fn().mockReturnValue([]),
}))

const { CaseSpaceApiError } = await import('@/services/casespaceApi')
const { useEnvironmentWorkspace } = await import('@/features/environments/hooks/useEnvironmentWorkspace')

function makeEnv(id: string): CaseSpace {
  return {
    id,
    name: `Env ${id}`,
    type: 'vault',
    visibility: 'organization',
    members: [],
    connectionIds: [],
    createdAt: Date.now(),
    fileCount: 0,
    folderCount: 0,
    templateCount: 0,
  }
}

const stableViewer = {
  sub: 'u-1',
  email: 'clerk@millbrook.gov',
  name: 'Town Clerk',
} as const

describe('useEnvironmentWorkspace', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockListCaseSpaces.mockResolvedValue([])
    mockUpdateCaseSpace.mockResolvedValue(null)
    mockLogCaseSpaceResolutionFailure.mockResolvedValue(undefined)
    window.history.replaceState({}, '', '/casespaces/vault-phillipston-prr')
  })

  it('returns unauthenticated for 401 responses and logs the failed resolution', async () => {
    mockListCaseSpaces.mockRejectedValueOnce(new CaseSpaceApiError(401, 'Authentication required'))

    const { result } = renderHook(() => useEnvironmentWorkspace('vault-phillipston-prr'))

    await waitFor(() => expect(result.current.status).toBe('unauthenticated'))
    if (result.current.status !== 'unauthenticated') throw new Error('Expected unauthenticated status')
    expect(result.current.message).toBe('Authentication required')
    expect(mockLogCaseSpaceResolutionFailure).toHaveBeenCalledWith({
      requestedId: 'vault-phillipston-prr',
      outcome: 'unauthenticated',
      requestScope: '/casespaces/vault-phillipston-prr',
      actor: null,
    })
  })

  it('returns empty when the server succeeds with no casespaces', async () => {
    mockListCaseSpaces.mockResolvedValueOnce([])

    const { result } = renderHook(() => useEnvironmentWorkspace('vault-phillipston-prr'))

    await waitFor(() => expect(result.current.status).toBe('empty'))
    expect(mockLogCaseSpaceResolutionFailure).not.toHaveBeenCalled()
  })

  it('returns not_found when the id is missing from a successful response and logs it', async () => {
    mockListCaseSpaces.mockResolvedValueOnce([makeEnv('vault-logicville')])
    window.history.replaceState({}, '', '/casespaces/bogus-id')

    const { result } = renderHook(() => useEnvironmentWorkspace('bogus-id', stableViewer))

    await waitFor(() => expect(result.current.status).toBe('not_found'))
    if (result.current.status !== 'not_found') throw new Error('Expected not_found status')
    expect(result.current.requestedId).toBe('bogus-id')
    expect(mockLogCaseSpaceResolutionFailure).toHaveBeenCalledWith({
      requestedId: 'bogus-id',
      outcome: 'not_found',
      requestScope: '/casespaces/bogus-id',
      actor: 'u-1',
    })
  })

  it('returns ok when the requested casespace exists', async () => {
    const env = makeEnv('vault-phillipston-prr')
    mockListCaseSpaces.mockResolvedValueOnce([env])
    mockUpdateCaseSpace.mockResolvedValueOnce({ ...env, lastAccessed: Date.now() })

    const { result } = renderHook(() => useEnvironmentWorkspace('vault-phillipston-prr'))

    await waitFor(() => expect(result.current.status).toBe('ok'))
    if (result.current.status !== 'ok') throw new Error('Expected ok status')
    expect(result.current.environment.id).toBe('vault-phillipston-prr')
  })
})
