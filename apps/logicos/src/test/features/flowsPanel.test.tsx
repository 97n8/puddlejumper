import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

vi.mock('@/hooks/useKV', () => ({
  useKV: (_key: string, defaultVal: unknown) => [defaultVal, vi.fn()],
}))

vi.mock('@/services/pjApi', () => ({
  pjApi: {
    microsoft: { get: vi.fn().mockResolvedValue([]), post: vi.fn().mockResolvedValue({}), patch: vi.fn().mockResolvedValue({}) },
    cloudSave: vi.fn().mockResolvedValue({}),
  },
}))

vi.mock('@/features/flows/components/Synchron8AutomationsPanel', () => ({
  Synchron8AutomationsPanel: () => <div data-testid="synchron8-panel">Synchron8 Automations</div>,
}))

const { FlowsPanel } = await import('@/features/flows/components/FlowsPanel')

describe('FlowsPanel smoke suite', () => {
  it('renders without crashing', () => {
    render(<FlowsPanel />)
    expect(document.body).toBeTruthy()
  })

  it('shows SYNCHRON8 branding in sidebar', () => {
    render(<FlowsPanel />)
    expect(screen.getByText('SYNCHRON8')).toBeInTheDocument()
  })

  it('shows navigation groups', () => {
    render(<FlowsPanel />)
    expect(screen.getByText('Automations')).toBeInTheDocument()
    // Governance appears as both a nav group label and a nav item — use getAllByText
    expect(screen.getAllByText('Governance').length).toBeGreaterThan(0)
    expect(screen.getByText('Compliance')).toBeInTheDocument()
  })

  it('shows Flows heading in main panel by default', () => {
    render(<FlowsPanel />)
    expect(screen.getByText('Flows')).toBeInTheDocument()
  })

  it('shows Synchron8 panel when governance nav item is clicked', async () => {
    const user = userEvent.setup()
    render(<FlowsPanel />)
    await user.click(screen.getByRole('button', { name: /governance/i }))
    expect(screen.getByTestId('synchron8-panel')).toBeInTheDocument()
  })
})
