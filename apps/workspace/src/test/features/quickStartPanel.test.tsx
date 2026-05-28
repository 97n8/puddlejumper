import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

vi.mock('@/services/pjApi', () => ({
  pjApi: {
    get: vi.fn().mockResolvedValue({}),
    post: vi.fn().mockResolvedValue({}),
  },
}))

const { QuickStartPanel } = await import('@/features/quickstart/components/QuickStartPanel')

describe('QuickStartPanel smoke suite', () => {
  it('renders without crashing', () => {
    render(<QuickStartPanel onOpenTool={vi.fn()} onOpenConnections={vi.fn()} />)
    expect(document.body).toBeTruthy()
  })

  it('shows tool cards for live tools', () => {
    render(<QuickStartPanel onOpenTool={vi.fn()} onOpenConnections={vi.fn()} />)
    expect(screen.getAllByText('Vault').length).toBeGreaterThan(0)
    expect(screen.getAllByText('FormKey').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Flows').length).toBeGreaterThan(0)
  })

  it('shows "Your tools" section heading', () => {
    render(<QuickStartPanel onOpenTool={vi.fn()} onOpenConnections={vi.fn()} />)
    expect(screen.getByText(/your tools/i)).toBeInTheDocument()
  })

  it('lifecycle banner stages are present', () => {
    render(<QuickStartPanel onOpenTool={vi.fn()} onOpenConnections={vi.fn()} />)
    expect(screen.getByText('Receives')).toBeInTheDocument()
    expect(screen.getByText('Decides')).toBeInTheDocument()
    expect(screen.getByText('Archives')).toBeInTheDocument()
  })

  it('does NOT show killed tools (workspace, logicdocs, logiccode)', () => {
    render(<QuickStartPanel onOpenTool={vi.fn()} onOpenConnections={vi.fn()} />)
    expect(screen.queryByText(/logicdocs/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/logiccode/i)).not.toBeInTheDocument()
  })

  it('tool taglines contain canon descriptions', () => {
    render(<QuickStartPanel onOpenTool={vi.fn()} onOpenConnections={vi.fn()} />)
    expect(screen.getByText(/permanent record storage/i)).toBeInTheDocument()
    expect(screen.getByText(/every submission becomes a governed record/i)).toBeInTheDocument()
  })
})
