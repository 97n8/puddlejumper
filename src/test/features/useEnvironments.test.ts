import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import type { CaseSpace } from '@/lib/types'

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
vi.mock('@/lib/logger', () => ({ createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }) }))

const mockListCaseSpaces = vi.fn()
const mockCreateCaseSpace = vi.fn()
const mockUpdateCaseSpace = vi.fn()
const mockDeleteCaseSpace = vi.fn()

vi.mock('@/services/casespaceApi', () => ({
  listCaseSpaces: (...args: unknown[]) => mockListCaseSpaces(...args),
  createCaseSpace: (...args: unknown[]) => mockCreateCaseSpace(...args),
  updateCaseSpace: (...args: unknown[]) => mockUpdateCaseSpace(...args),
  deleteCaseSpace: (...args: unknown[]) => mockDeleteCaseSpace(...args),
}))

vi.mock('@/features/environments/constants/logicville', () => ({
  LOGICVILLE_ENVIRONMENT_ID: 'vault-logicville',
  PHILLIPSTON_ENVIRONMENT_ID: 'vault-phillipston-prr',
  LOGICVILLE_OPERATING_AREAS: [],
  ensureLogicvilleCaseSpace: vi.fn().mockImplementation((envs: CaseSpace[]) =>
    Promise.resolve(envs.find(e => e.id === 'vault-logicville') ?? {
      id: 'vault-logicville', name: 'Logicville', type: 'vault',
      visibility: 'organization', members: [], connectionIds: [],
      vaultModuleIds: [], createdAt: Date.now(), fileCount: 0, folderCount: 0, templateCount: 0,
    })
  ),
  ensurePhillipstonCaseSpace: vi.fn().mockImplementation((envs: CaseSpace[]) =>
    Promise.resolve(envs?.find((e: CaseSpace) => e.id === 'vault-phillipston-prr') ?? {
      id: 'vault-phillipston-prr', name: 'Phillipston', type: 'vault',
      visibility: 'organization', members: [], connectionIds: [],
      vaultModuleIds: [], createdAt: Date.now(), fileCount: 0, folderCount: 0, templateCount: 0,
    })
  ),
}))

vi.mock('@/lib/vault-modules', () => ({
  listBuilderSessions: vi.fn().mockReturnValue([]),
  deleteBuilderSession: vi.fn(),
  BUILDER_SESSION_STORAGE_KEY_PREFIX: 'logicvault-builder-sessions',
}))

vi.mock('@/features/environments/utils/environmentHelpers', () => ({
  filterEnvironmentsForUser: vi.fn().mockImplementation((envs: CaseSpace[]) => envs),
  mergePrimaryEnvironment: vi.fn().mockImplementation((_primary: CaseSpace, rest: CaseSpace[]) => rest),
  builderSessionToEnvironment: vi.fn(),
}))

vi.mock('@/features/environments/constants/legacyDemoIds', () => ({
  LEGACY_DEMO_ENVIRONMENT_IDS: new Set<string>(),
}))

const { toast } = await import('sonner')
const { deleteBuilderSession } = await import('@/lib/vault-modules')
const { useEnvironments } = await import('@/features/environments/hooks/useEnvironments')

function makeEnv(id: string): CaseSpace {
  return {
    id, name: `Env ${id}`, type: 'vault', visibility: 'organization',
    members: [], connectionIds: [], createdAt: Date.now(),
    fileCount: 0, folderCount: 0, templateCount: 0,
  }
}

describe('useEnvironments.deleteEnvironment', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Default: listCaseSpaces returns a single test env so state is non-empty after load
    mockListCaseSpaces.mockResolvedValue([])
    mockCreateCaseSpace.mockResolvedValue(null)
    mockUpdateCaseSpace.mockResolvedValue(null)
  })

  async function renderWithEnv(id: string) {
    const env = makeEnv(id)
    // Seed the env via the API so it's in state after initial load
    mockListCaseSpaces.mockResolvedValue([env])
    const { result } = renderHook(() => useEnvironments())
    // Wait for initial refresh to complete
    await waitFor(() => expect(result.current.loading).toBe(false))
    return result
  }

  it('removes environment on successful delete (200)', async () => {
    mockDeleteCaseSpace.mockResolvedValueOnce({ ok: true, status: 200 })
    const result = await renderWithEnv('cs-123')
    expect(result.current.environments.find(e => e.id === 'cs-123')).toBeDefined()
    await act(async () => { await result.current.deleteEnvironment('cs-123') })
    expect(result.current.environments.find(e => e.id === 'cs-123')).toBeUndefined()
    expect(toast.success).toHaveBeenCalledWith('Environment deleted')
  })

  it('removes environment and cleans builder session on 404 (local-only)', async () => {
    mockDeleteCaseSpace.mockResolvedValueOnce({ ok: false, status: 404 })
    const result = await renderWithEnv('local-abc')
    await act(async () => { await result.current.deleteEnvironment('local-abc') })
    expect(deleteBuilderSession).toHaveBeenCalledWith('local-abc')
    expect(result.current.environments.find(e => e.id === 'local-abc')).toBeUndefined()
    expect(toast.success).toHaveBeenCalledWith('Environment deleted')
  })

  it('shows permission error on 403 and keeps env in state', async () => {
    mockDeleteCaseSpace.mockResolvedValueOnce({ ok: false, status: 403 })
    const result = await renderWithEnv('protected-env')
    await act(async () => { await result.current.deleteEnvironment('protected-env') })
    expect(toast.error).toHaveBeenCalledWith("This environment can't be deleted")
    expect(result.current.environments.find(e => e.id === 'protected-env')).toBeDefined()
  })

  it('shows retry error on other failures (500) and keeps env in state', async () => {
    mockDeleteCaseSpace.mockResolvedValueOnce({ ok: false, status: 500 })
    const result = await renderWithEnv('fail-env')
    await act(async () => { await result.current.deleteEnvironment('fail-env') })
    expect(toast.error).toHaveBeenCalledWith('Failed to delete — please try again')
    expect(result.current.environments.find(e => e.id === 'fail-env')).toBeDefined()
  })

  it('does not call deleteBuilderSession on successful server delete', async () => {
    mockDeleteCaseSpace.mockResolvedValueOnce({ ok: true, status: 200 })
    const result = await renderWithEnv('server-env')
    await act(async () => { await result.current.deleteEnvironment('server-env') })
    expect(deleteBuilderSession).not.toHaveBeenCalled()
  })
})

describe('useEnvironments.createEnvironment', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockListCaseSpaces.mockResolvedValue([])
    mockUpdateCaseSpace.mockResolvedValue(null)
  })

  it('optimistically adds environment to state', async () => {
    mockCreateCaseSpace.mockResolvedValueOnce(null)
    const { result } = renderHook(() => useEnvironments())
    await waitFor(() => expect(result.current.loading).toBe(false))
    await act(async () => { await result.current.createEnvironment(makeEnv('new-env')) })
    expect(result.current.environments.find(e => e.id === 'new-env')).toBeDefined()
  })

  it('swaps id when server returns different id', async () => {
    const serverEnv = makeEnv('server-generated-id')
    mockCreateCaseSpace.mockResolvedValueOnce(serverEnv)
    const { result } = renderHook(() => useEnvironments())
    await waitFor(() => expect(result.current.loading).toBe(false))
    await act(async () => { await result.current.createEnvironment(makeEnv('optimistic-id')) })
    expect(result.current.environments.find(e => e.id === 'server-generated-id')).toBeDefined()
    expect(result.current.environments.find(e => e.id === 'optimistic-id')).toBeUndefined()
  })
})
