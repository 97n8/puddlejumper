import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { OrgManagerPanel } from '@/features/orgmanager/components/OrgManagerPanel'

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

const { mockOrgState } = vi.hoisted(() => ({
  mockOrgState: {
    positions: [] as unknown[],
    loadingPositions: false,
    delegations: [] as unknown[],
    loadingDelegations: false,
  },
}))

vi.mock('@/features/orgmanager/api', () => ({
  useOrgChart: () => ({ data: mockOrgState.positions, isLoading: mockOrgState.loadingPositions, refetch: vi.fn() }),
  useOrgDelegations: () => ({ data: mockOrgState.delegations, isLoading: mockOrgState.loadingDelegations }),
  useCreateDelegation: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useRevokeDelegation: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useOrgImport: () => ({ mutateAsync: vi.fn(), isPending: false }),
  usePublishImport: () => ({ mutateAsync: vi.fn(), isPending: false }),
}))

vi.mock('@/lib/api', () => ({
  pjFetch: vi.fn().mockResolvedValue([]),
}))

describe('OrgManager smoke suite', () => {
  it('renders with loading skeleton when positions are loading', () => {
    mockOrgState.loadingPositions = true
    render(<OrgManagerPanel onBack={vi.fn()} />)
    expect(screen.getByText('Org Manager')).toBeInTheDocument()
    expect(screen.queryByText(/No positions on file/i)).not.toBeInTheDocument()
    mockOrgState.loadingPositions = false
  })

  it('shows empty state when chart is empty', () => {
    mockOrgState.positions = []
    render(<OrgManagerPanel onBack={vi.fn()} />)
    expect(screen.getByText(/No positions on file/i)).toBeInTheDocument()
  })

  it('renders positions table when data loads', () => {
    mockOrgState.positions = [{
      id: 'p-1', employeeId: 'E001', fullName: 'Alice Smith', title: 'Director', department: 'Finance',
      supervisorId: null, email: 'alice@test.gov', employmentStatus: 'active', authorityLevel: 4,
      actingForPositionId: null, separationDate: null, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    }]
    render(<OrgManagerPanel onBack={vi.fn()} />)
    expect(screen.getByText('Alice Smith')).toBeInTheDocument()
    expect(screen.getByText('Director')).toBeInTheDocument()
    mockOrgState.positions = []
  })

  it('opens new position dialog on button click', async () => {
    const user = userEvent.setup()
    render(<OrgManagerPanel onBack={vi.fn()} />)
    await user.click(screen.getByRole('button', { name: /new position/i }))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'New Position' })).toBeInTheDocument()
  })

  it('has CSV template download button in Import tab', async () => {
    const user = userEvent.setup()
    render(<OrgManagerPanel onBack={vi.fn()} />)
    await user.click(screen.getByRole('tab', { name: /import/i }))
    expect(screen.getByRole('button', { name: /download csv template/i })).toBeInTheDocument()
  })

  it('renders delegations tab', async () => {
    const user = userEvent.setup()
    render(<OrgManagerPanel onBack={vi.fn()} />)
    await user.click(screen.getByRole('tab', { name: /delegations/i }))
    expect(screen.getByText(/No delegations yet/i)).toBeInTheDocument()
  })
})
