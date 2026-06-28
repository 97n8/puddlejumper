import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

vi.mock('@/services/auth/AuthContext', () => ({
  useAuth: () => ({
    user: { sub: 'u1', email: 'admin@example.com', name: 'Admin User', role: 'admin' },
    loading: false,
  }),
}))

vi.mock('@/hooks/useKV', () => ({
  useKV: (_key: string, defaultVal: unknown) => [defaultVal, vi.fn()],
}))

vi.mock('@/services/pjApi', () => ({
  pjApi: {
    admin: {
      listMembers: vi.fn().mockResolvedValue({ success: true, data: [] }),
      listMemberTemplates: vi.fn().mockResolvedValue({ success: true, data: [] }),
      stats: vi.fn().mockResolvedValue({ success: true, data: {} }),
      createMember: vi.fn().mockResolvedValue({ success: true }),
      provisionMemberTemplate: vi.fn().mockResolvedValue({ success: true }),
      resetMemberPassword: vi.fn().mockResolvedValue({ success: true }),
    },
    workspace: {
      listMembers: vi.fn().mockResolvedValue({ success: true, data: [] }),
      listInvitations: vi.fn().mockResolvedValue({ success: true, data: [] }),
      usage: vi.fn().mockResolvedValue({ success: true, usage: {} }),
      updateMemberRole: vi.fn().mockResolvedValue({ success: true }),
      removeMember: vi.fn().mockResolvedValue({ success: true }),
      updateMemberToolAccess: vi.fn().mockResolvedValue({ success: true }),
    },
  },
}))

// Mock sub-panels to keep tests fast and isolated
vi.mock('@/features/admin/components/AzureSetupPanel', () => ({
  AzureSetupPanel: () => <div data-testid="azure-setup-panel">Azure Setup</div>,
}))

vi.mock('@/features/admin/components/PJHealthPanel', () => ({
  PJHealthPanel: () => <div data-testid="pj-health-panel">PJ Health</div>,
}))

vi.mock('@/features/admin/components/SealPanel', () => ({
  SealPanel: () => <div data-testid="seal-panel">SEAL</div>,
}))

vi.mock('@/features/audit/components/AuditTrailPanel', () => ({
  AuditTrailPanel: () => <div data-testid="audit-trail-panel">Audit Trail</div>,
}))

const { AdminPanel } = await import('@/features/admin/components/AdminPanel')

describe('AdminPanel smoke suite', () => {
  it('renders without crashing', async () => {
    render(<AdminPanel />)
    await waitFor(() => expect(screen.queryByText(/loading/i)).not.toBeInTheDocument())
  })

  it('shows "Admin Panel" heading', () => {
    render(<AdminPanel />)
    expect(screen.getByRole('heading', { name: /admin panel/i })).toBeInTheDocument()
  })

  it('Team tab is present and active by default', () => {
    render(<AdminPanel />)
    expect(screen.getByRole('tab', { name: /team/i })).toBeInTheDocument()
  })

  it('System health tab navigates to PJHealthPanel', async () => {
    const user = userEvent.setup()
    render(<AdminPanel />)
    await user.click(screen.getByRole('tab', { name: /system health/i }))
    expect(screen.getByTestId('pj-health-panel')).toBeInTheDocument()
  })

  it('SEAL tab navigates to SealPanel', async () => {
    const user = userEvent.setup()
    render(<AdminPanel />)
    await user.click(screen.getByRole('tab', { name: /seal/i }))
    expect(screen.getByTestId('seal-panel')).toBeInTheDocument()
  })

  it('all major tabs are present in tab list', () => {
    render(<AdminPanel />)
    expect(screen.getByRole('tab', { name: /team/i })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /audit/i })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /system health/i })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /seal/i })).toBeInTheDocument()
  })
})
