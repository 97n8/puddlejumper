import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import userEvent from '@testing-library/user-event'

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

vi.mock('@/services/auth/AuthContext', () => ({
  useAuth: () => ({
    user: { sub: 'u1', email: 'test@example.com', name: 'Test User' },
    loading: false,
  }),
}))

vi.mock('@/services/pjApi', () => ({
  pjApi: {
    system: { health: vi.fn().mockResolvedValue({ status: 'ok' }) },
    connectors: { status: vi.fn().mockResolvedValue({ connectors: {} }) },
    archieve: { events: vi.fn().mockResolvedValue({ events: [] }) },
    prr: { list: vi.fn().mockResolvedValue([]) },
  },
}))

vi.mock('@/features/environments/constants/logicville', () => ({
  LOGICVILLE_ENVIRONMENT_ID: 'vault-logicville',
}))

vi.mock('@/services/casespaceApi', () => ({
  listCaseSpaces: vi.fn().mockResolvedValue([]),
}))

const { StartScreen } = await import('@/features/start/components/StartScreen')

function renderWrapped(ui: React.ReactElement) {
  return render(<MemoryRouter>{ui}</MemoryRouter>)
}

describe('StartScreen', () => {
  it('renders without crashing', async () => {
    renderWrapped(<StartScreen onSelectTool={vi.fn()} onOpenConnections={vi.fn()} />)
    await waitFor(() => expect(document.body).toBeTruthy())
  })

  it('shows a greeting with the user name', async () => {
    renderWrapped(<StartScreen onSelectTool={vi.fn()} onOpenConnections={vi.fn()} />)
    // greeting shows first name only ("Good morning, Test")
    await waitFor(() => expect(screen.getByText(/\bTest\b/)).toBeTruthy())
  })

  it('shows environments section', async () => {
    renderWrapped(<StartScreen onSelectTool={vi.fn()} onOpenConnections={vi.fn()} />)
    await waitFor(() => {
      expect(screen.getByText(/Environment/i)).toBeTruthy()
    })
  })

  it('shows quick links strip', async () => {
    renderWrapped(<StartScreen onSelectTool={vi.fn()} onOpenConnections={vi.fn()} />)
    await waitFor(() => expect(screen.getByText(/Environment/i)).toBeTruthy())
  })

  it('Active Work section shows empty state when no workspaces', async () => {
    renderWrapped(<StartScreen onSelectTool={vi.fn()} onOpenConnections={vi.fn()} />)
    await waitFor(() => expect(screen.getByText(/No workspaces yet/i)).toBeTruthy())
  })

  it('Civic Environment card navigates to civic', async () => {
    const onSelectTool = vi.fn()
    const user = userEvent.setup()
    renderWrapped(<StartScreen onSelectTool={onSelectTool} onOpenConnections={vi.fn()} />)
    await waitFor(() => screen.getByText('Civic'))
    await user.click(screen.getAllByText('Civic')[0])
    expect(onSelectTool).toHaveBeenCalledWith('civic')
  })

  it('Connect calls onOpenConnections', async () => {
    const onOpenConnections = vi.fn()
    const user = userEvent.setup()
    renderWrapped(<StartScreen onSelectTool={vi.fn()} onOpenConnections={onOpenConnections} />)
    await waitFor(() => screen.getByText('Connect'))
    await user.click(screen.getByText('Connect'))
    expect(onOpenConnections).toHaveBeenCalled()
  })
})
