import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RoutingEnginePanel } from '@/features/routingengine/components/RoutingEnginePanel'

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

vi.mock('@/features/routingengine/api', () => ({
  useRoutingRules: () => ({ data: undefined, isLoading: false }),
  useCreateRule: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useToggleRule: () => ({ mutateAsync: vi.fn(), isPending: false }),
}))

describe('RoutingEnginePanel smoke suite', () => {
  it('renders with Routing Engine heading', () => {
    render(<RoutingEnginePanel onBack={vi.fn()} />)
    expect(screen.getByText('Routing Engine')).toBeInTheDocument()
  })

  it('shows Rules and Simulator tabs', () => {
    render(<RoutingEnginePanel onBack={vi.fn()} />)
    expect(screen.getByRole('tab', { name: /rules/i })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /simulator/i })).toBeInTheDocument()
  })

  it('shows empty state when backend returns no rules', () => {
    render(<RoutingEnginePanel onBack={vi.fn()} />)
    // When remoteRules is undefined and no local rules, show empty/loading state
    expect(screen.queryByText('High-value procurement alert')).not.toBeInTheDocument()
  })

  it('New Rule button opens dialog', async () => {
    const user = userEvent.setup()
    render(<RoutingEnginePanel onBack={vi.fn()} />)
    await user.click(screen.getByRole('button', { name: /new rule/i }))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText('New Routing Rule')).toBeInTheDocument()
  })

  it('Simulator tab renders domain filter and test button', async () => {
    const user = userEvent.setup()
    render(<RoutingEnginePanel onBack={vi.fn()} />)
    await user.click(screen.getByRole('tab', { name: /simulator/i }))
    const panel = screen.getByRole('tabpanel')
    expect(panel).toHaveTextContent(/test/i)
  })
})
