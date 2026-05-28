import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { CaseSpace } from '@/lib/types'

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>()
  return {
    ...actual,
    useNavigate: () => vi.fn(),
  }
})

const LOGICVILLE: CaseSpace = {
  id: 'vault-logicville',
  name: 'Town of Logicville',
  description: 'Demo environment',
  color: '#627DBD',
  visibility: 'organization',
  members: [],
  type: 'vault',
  createdAt: Date.now(),
  fileCount: 0,
  folderCount: 0,
  templateCount: 0,
  connectionIds: [],
}

const OTHER_ENV: CaseSpace = {
  id: 'other-env',
  name: 'Other Workspace',
  color: '#627DBD',
  visibility: 'organization',
  members: [],
  type: 'internal',
  createdAt: Date.now(),
  fileCount: 0,
  folderCount: 0,
  templateCount: 0,
  connectionIds: [],
}

vi.mock('@/features/environments/hooks/useEnvironments', () => ({
  useEnvironments: () => ({
    environments: [LOGICVILLE, OTHER_ENV],
    loading: false,
    refresh: vi.fn(),
    createEnvironment: vi.fn(),
    updateEnvironment: vi.fn(),
    deleteEnvironment: vi.fn(),
  }),
}))

vi.mock('@/features/environments/components/EnvironmentHubSidebar', () => ({
  EnvironmentHubSidebar: ({ onNewEnvironment }: { onNewEnvironment: () => void }) => (
    <div data-testid="environment-hub-sidebar">
      <button onClick={onNewEnvironment}>New Environment Sidebar</button>
    </div>
  ),
}))

vi.mock('@/features/environments/components/EnvironmentCard', () => ({
  EnvironmentCard: ({ environment, onClick }: { environment: CaseSpace; onClick: () => void }) => (
    <div data-testid="environment-card" onClick={onClick}>
      {environment.name}
    </div>
  ),
}))

vi.mock('@/features/environments/components/DemoEnvironmentCard', () => ({
  DemoEnvironmentCard: () => (
    <div data-testid="demo-environment-card">Town of Logicville (demo)</div>
  ),
}))

vi.mock('@/features/logicbuilder', () => ({
  LogicBuilderPanel: () => <div data-testid="logic-builder-panel">Logic Builder</div>,
}))

const { EnvironmentHub } = await import('@/features/environments/components/EnvironmentHub')

describe('EnvironmentHub smoke suite', () => {
  it('renders without crashing', () => {
    render(<EnvironmentHub onSelectEnvironment={vi.fn()} />)
    expect(document.body).toBeTruthy()
  })

  it('shows environment list when loaded', async () => {
    render(<EnvironmentHub onSelectEnvironment={vi.fn()} />)
    await waitFor(() =>
      expect(screen.getByText('Other Workspace')).toBeInTheDocument()
    )
  })

  it('"+ New Environment" button is present', () => {
    render(<EnvironmentHub onSelectEnvironment={vi.fn()} />)
    expect(screen.getAllByRole('button', { name: /new environment/i }).length).toBeGreaterThan(0)
  })

  it('Logicville demo environment card appears', async () => {
    render(<EnvironmentHub onSelectEnvironment={vi.fn()} />)
    await waitFor(() =>
      expect(screen.getByTestId('demo-environment-card')).toBeInTheDocument()
    )
  })

  it('environment card click calls onSelectEnvironment for non-demo envs', async () => {
    const onSelectEnvironment = vi.fn()
    const user = userEvent.setup()
    render(<EnvironmentHub onSelectEnvironment={onSelectEnvironment} />)
    await waitFor(() => screen.getByTestId('environment-card'))
    await user.click(screen.getByTestId('environment-card'))
    expect(onSelectEnvironment).toHaveBeenCalledWith('other-env')
  })
})
