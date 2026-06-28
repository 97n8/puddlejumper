import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { WatchLayerPanel } from '@/features/watchlayer/components/WatchLayerPanel'

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

vi.mock('@/features/watchlayer/api', () => ({
  useWatchAlerts: () => ({ data: [], isLoading: false, refetch: vi.fn() }),
  useWatchDigest: () => ({ data: null, isLoading: false, refetch: vi.fn() }),
  useResolveAlert: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useRunChecks: () => ({ mutateAsync: vi.fn(), isPending: false }),
}))

describe('WatchLayer smoke suite', () => {
  it('renders WatchLayerPanel with alert inbox tab active', () => {
    render(<WatchLayerPanel onBack={vi.fn()} />)
    expect(screen.getByText('Watch Layer')).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /alert inbox/i })).toBeInTheDocument()
  })

  it('shows "No alerts" empty state when alerts list is empty', () => {
    render(<WatchLayerPanel onBack={vi.fn()} />)
    expect(screen.getByText(/No alerts — system is healthy/i)).toBeInTheDocument()
  })

  it('renders severity and domain filter dropdowns', () => {
    render(<WatchLayerPanel onBack={vi.fn()} />)
    expect(screen.getByText(/All severities/i)).toBeInTheDocument()
    expect(screen.getByText(/All domains/i)).toBeInTheDocument()
  })

  it('status filter is present and shows Open state by default', () => {
    render(<WatchLayerPanel onBack={vi.fn()} />)
    // The status select trigger shows "Open" (initial state)
    const selects = screen.getAllByRole('combobox')
    // At least 3 selects: severity, domain, status
    expect(selects.length).toBeGreaterThanOrEqual(3)
    // One combobox shows "Open" (the status filter)
    const openCombobox = selects.find(s => s.textContent?.includes('Open'))
    expect(openCombobox).toBeTruthy()
  })

  it('digest tab shows Run Checks Now button', async () => {
    const user = userEvent.setup()
    render(<WatchLayerPanel onBack={vi.fn()} />)
    await user.click(screen.getByRole('tab', { name: /system digest/i }))
    const buttons = screen.getAllByRole('button', { name: /run checks now/i })
    expect(buttons.length).toBeGreaterThan(0)
  })
})
