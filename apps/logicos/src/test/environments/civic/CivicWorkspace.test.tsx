import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { CivicWorkspace } from '@/environments/civic/components/CivicWorkspace'
import type { CaseSpace } from '@/lib/types'

const { mockMe, mockGet, mockState } = vi.hoisted(() => ({
  mockMe: vi.fn(),
  mockGet: vi.fn(),
  mockState: {
    authUser: {
      sub: 'u-1',
      email: 'clerk@testville.gov',
      name: 'Town Clerk',
    } as { sub: string; email: string; name: string } | null,
  },
}))

vi.mock('@/services/auth/AuthContext', () => ({
  useAuth: () => ({ user: mockState.authUser }),
}))

vi.mock('@/features/civic/api/civicApi', () => ({
  civicApi: {
    me: (...args: unknown[]) => mockMe(...args),
    get: (...args: unknown[]) => mockGet(...args),
  },
}))

vi.mock('@/environments/civic/context/CivicTownContext', () => ({
  CivicTownProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
  findMunicipalityByName: () => ({ name: 'Testville' }),
}))

vi.mock('@/features/civic/pages/WorkbenchPage', () => ({
  WorkbenchPage: ({ actor }: { actor: { display_name: string } }) => (
    <div>Workbench for {actor.display_name}</div>
  ),
}))

vi.mock('@/features/civic/pages/PRRPage', () => ({
  PRRPage: () => <div>PRR Page</div>,
}))

vi.mock('@/features/civic/pages/STRPage', () => ({
  STRPage: () => <div>STR Page</div>,
}))

vi.mock('@/environments/civic/components/OrgEditor', () => ({
  OrgEditor: () => <div>Org Editor</div>,
}))

vi.mock('@/environments/civic/components/DocumentsHub', () => ({
  DocumentsHub: () => <div>Documents Hub</div>,
}))

const environment: CaseSpace = {
  id: 'civic-testville',
  name: 'Town of Testville',
  town: 'Testville',
  type: 'vault',
  visibility: 'organization',
  members: [],
  connectionIds: [],
  createdAt: Date.now(),
  fileCount: 0,
  folderCount: 0,
  templateCount: 0,
  vaultModuleIds: ['VAULTPRR'],
}

describe('CivicWorkspace', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockState.authUser = {
      sub: 'u-1',
      email: 'clerk@testville.gov',
      name: 'Town Clerk',
    }
    mockMe.mockResolvedValue({
      actor: {
        id: 'actor-1',
        object_id: 'object-1',
        display_name: 'Civic Clerk',
        email: 'clerk@testville.gov',
        role: 'staff',
        pj_user_id: null,
      },
    })
    mockGet.mockResolvedValue({
      complete: true,
      prefill: { town: { governance_form: 'open_town_meeting' } },
    })
  })

  it('renders auth-required state on 401', async () => {
    mockMe.mockRejectedValueOnce(Object.assign(new Error('Unauthorized'), { status: 401 }))

    render(<CivicWorkspace environment={environment} onBack={vi.fn()} />)

    await waitFor(() => {
      expect(screen.getByText('Authentication required')).toBeInTheDocument()
    })
    expect(screen.queryByText(/Workbench for/i)).not.toBeInTheDocument()
  })

  it('renders unauthorized state on 403', async () => {
    mockMe.mockRejectedValueOnce(Object.assign(new Error('Forbidden'), { status: 403 }))

    render(<CivicWorkspace environment={environment} onBack={vi.fn()} />)

    await waitFor(() => {
      expect(screen.getByText('Access restricted')).toBeInTheDocument()
    })
    expect(screen.queryByText(/Workbench for/i)).not.toBeInTheDocument()
  })

  it('renders load error on network/server failure', async () => {
    mockMe.mockRejectedValueOnce(new Error('Network offline'))

    render(<CivicWorkspace environment={environment} onBack={vi.fn()} />)

    await waitFor(() => {
      expect(screen.getByText("Couldn't load civic workspace")).toBeInTheDocument()
    })
    expect(screen.getByText('Network offline')).toBeInTheDocument()
    expect(screen.queryByText(/Workbench for/i)).not.toBeInTheDocument()
  })

  it('renders load error when org status fails instead of silently rendering workspace', async () => {
    mockGet.mockRejectedValueOnce(Object.assign(new Error('Status service unavailable'), { status: 500 }))

    render(<CivicWorkspace environment={environment} onBack={vi.fn()} />)

    await waitFor(() => {
      expect(screen.getByText("Couldn't load civic workspace")).toBeInTheDocument()
    })
    expect(screen.getByText('Status service unavailable')).toBeInTheDocument()
    expect(screen.queryByText(/Workbench for/i)).not.toBeInTheDocument()
  })

  it('renders workspace when actor and status load successfully', async () => {
    render(<CivicWorkspace environment={environment} onBack={vi.fn()} />)

    await waitFor(() => {
      expect(screen.getByText('Workbench for Town Clerk')).toBeInTheDocument()
    })
    expect(screen.queryByText('Authentication required')).not.toBeInTheDocument()
  })
})
