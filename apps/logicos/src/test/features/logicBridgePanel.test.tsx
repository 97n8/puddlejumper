import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

vi.mock('@/services/pjApi', () => ({
  pjApi: {
    logicbridge: {
      list: vi.fn().mockResolvedValue({ connectors: [] }),
      create: vi.fn().mockResolvedValue({ connector: { id: 'c-1' } }),
      test: vi.fn().mockResolvedValue({ ok: true, message: 'Connected' }),
      publish: vi.fn().mockResolvedValue({}),
      kvSet: vi.fn().mockResolvedValue({}),
    },
  },
}))

describe('LogicBridgePanel smoke suite', () => {
  it('renders with LOGICBRIDGE heading', async () => {
    const { LogicBridgePanel } = await import('@/features/logicbridge/components/LogicBridgePanel')
    render(<LogicBridgePanel />)
    expect(screen.getByText('LOGICBRIDGE')).toBeInTheDocument()
  })

  it('shows Hub Overview and Connectors view toggle buttons', async () => {
    const { LogicBridgePanel } = await import('@/features/logicbridge/components/LogicBridgePanel')
    render(<LogicBridgePanel />)
    expect(screen.getByRole('button', { name: /hub overview/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /connectors/i })).toBeInTheDocument()
  })

  it('Hub Overview shows Municipal Connector Hub', async () => {
    const { LogicBridgePanel } = await import('@/features/logicbridge/components/LogicBridgePanel')
    render(<LogicBridgePanel />)
    expect(screen.getByText('Municipal Connector Hub')).toBeInTheDocument()
  })

  it('Connectors view shows landing state when no connectors exist', async () => {
    const user = userEvent.setup()
    const { LogicBridgePanel } = await import('@/features/logicbridge/components/LogicBridgePanel')
    render(<LogicBridgePanel />)
    await user.click(screen.getByRole('button', { name: /connectors/i }))
    // With no connectors, LandingState is shown — which also says "Connect your systems"
    expect(await screen.findByText('Connect your systems')).toBeInTheDocument()
  })

  it('System Connections subtitle is present in header', async () => {
    const { LogicBridgePanel } = await import('@/features/logicbridge/components/LogicBridgePanel')
    render(<LogicBridgePanel />)
    expect(screen.getByText('System Connections')).toBeInTheDocument()
  })
})
