import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

// LogicDASHPanel uses fetch directly (fiscalFetch) — stub global fetch
global.fetch = vi.fn().mockResolvedValue({
  ok: false,
  json: vi.fn().mockResolvedValue({}),
})

describe('LogicDASHPanel smoke suite', () => {
  it('uses the town query parameter for dashboard deep links', async () => {
    window.history.replaceState({}, '', '/dashboard?town=276&tab=risk')
    const { LogicDASHPanel } = await import('@/features/logicdash/components/LogicDASHPanel')
    render(<LogicDASHPanel />)
    await waitFor(() => expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/gardner fiscal overview/i))
  })

  it('renders without crashing and shows pick-a-town prompt by default', async () => {
    window.history.replaceState({}, '', '/dashboard')
    const { LogicDASHPanel } = await import('@/features/logicdash/components/LogicDASHPanel')
    render(<LogicDASHPanel />)
    expect(screen.getByText('Pick a municipality')).toBeInTheDocument()
  })

  it('shows a municipality fiscal overview heading when initialSelectedCode provided', async () => {
    window.history.replaceState({}, '', '/dashboard')
    const { LogicDASHPanel } = await import('@/features/logicdash/components/LogicDASHPanel')
    render(<LogicDASHPanel initialSelectedCode={309} />)
    const headings = screen.getAllByRole('heading', { level: 1 })
    expect(headings.length).toBeGreaterThan(0)
    expect(headings[0].textContent).toMatch(/overview/i)
  })

  it('shows Snapshot, Risk, Peers tabs when a town is selected', async () => {
    window.history.replaceState({}, '', '/dashboard')
    const { LogicDASHPanel } = await import('@/features/logicdash/components/LogicDASHPanel')
    render(<LogicDASHPanel initialSelectedCode={309} />)
    expect(screen.getByRole('button', { name: /snapshot/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /risk/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /peers/i })).toBeInTheDocument()
  })

  it('shows domain selector with Fiscal domain when a town is selected', async () => {
    window.history.replaceState({}, '', '/dashboard')
    const { LogicDASHPanel } = await import('@/features/logicdash/components/LogicDASHPanel')
    render(<LogicDASHPanel initialSelectedCode={309} />)
    expect(screen.getByText('Fiscal')).toBeInTheDocument()
  })

  it('can restrict the dashboard to governance-only mode for FormKey lifecycle access', async () => {
    window.history.replaceState({}, '', '/dashboard?domain=governance')
    const { LogicDASHPanel } = await import('@/features/logicdash/components/LogicDASHPanel')
    render(<LogicDASHPanel initialSelectedCode={309} allowedDomains={['governance']} />)
    expect(screen.getByText('Governance')).toBeInTheDocument()
    expect(screen.queryByText('Fiscal')).not.toBeInTheDocument()
  })

  it('shows search prompt when no town selected', async () => {
    window.history.replaceState({}, '', '/dashboard')
    const { LogicDASHPanel } = await import('@/features/logicdash/components/LogicDASHPanel')
    render(<LogicDASHPanel />)
    expect(screen.getByRole('button', { name: /search massachusetts towns/i })).toBeInTheDocument()
  })

  it('shows demo data banner when a town is pre-selected', async () => {
    window.history.replaceState({}, '', '/dashboard')
    const { LogicDASHPanel } = await import('@/features/logicdash/components/LogicDASHPanel')
    render(<LogicDASHPanel initialSelectedCode={309} />)
    await waitFor(() => expect(screen.getByText('Demo data')).toBeInTheDocument())
  })
})
