import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

vi.mock('@/services/casespaceApi', () => ({
  listCaseSpaces: vi.fn().mockResolvedValue([]),
  createCaseSpace: vi.fn().mockResolvedValue(null),
  updateCaseSpace: vi.fn().mockResolvedValue(null),
  deleteCaseSpace: vi.fn().mockResolvedValue(true),
}))

vi.mock('@/features/environments/constants/logicville', () => ({
  LOGICVILLE_ENVIRONMENT_ID: 'vault-logicville',
  PHILLIPSTON_ENVIRONMENT_ID: 'vault-phillipston-prr',
  LOGICVILLE_OPERATING_AREAS: [],
  ensureLogicvilleCaseSpace: vi.fn().mockResolvedValue({
    id: 'vault-logicville', name: 'Town of Logicville', type: 'vault',
    visibility: 'organization', members: [], connectionIds: [],
    vaultModuleIds: [], createdAt: Date.now(), fileCount: 0, folderCount: 0, templateCount: 0,
  }),
  ensurePhillipstonCaseSpace: vi.fn().mockResolvedValue({
    id: 'vault-phillipston-prr', name: 'Town of Phillipston', type: 'vault',
    visibility: 'organization', members: [], connectionIds: [],
    vaultModuleIds: [], createdAt: Date.now(), fileCount: 0, folderCount: 0, templateCount: 0,
  }),
}))

vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(),
}))

const { EnvironmentHub } = await import('@/features/environments/components')

describe('EnvironmentHub smoke suite', () => {
  it('renders without crashing', async () => {
    render(<EnvironmentHub onSelectEnvironment={vi.fn()} />)
    await waitFor(() => expect(screen.queryByText(/loading/i)).not.toBeInTheDocument())
  })

  it('shows empty state after load when no environments exist', async () => {
    render(<EnvironmentHub onSelectEnvironment={vi.fn()} />)
    await waitFor(() =>
      expect(screen.getByText(/no environments yet/i)).toBeInTheDocument()
    )
  })

  it('"New workspace" button is present', async () => {
    render(<EnvironmentHub onSelectEnvironment={vi.fn()} />)
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /new environment/i })).toBeInTheDocument()
    )
  })

  it('environment cards appear when environments exist', async () => {
    const { listCaseSpaces } = await import('@/services/casespaceApi')
    vi.mocked(listCaseSpaces).mockResolvedValueOnce([
      {
        id: 'cs-1', name: 'Sutton', description: '', color: '#627DBD',
        visibility: 'organization', members: [], icon: '', createdAt: Date.now(),
        fileCount: 0, folderCount: 0, templateCount: 0, connectionIds: [], type: 'vault',
      },
    ])
    render(<EnvironmentHub onSelectEnvironment={vi.fn()} />)
    await waitFor(() => expect(screen.getAllByText('Sutton').length).toBeGreaterThan(0))
  })
})

