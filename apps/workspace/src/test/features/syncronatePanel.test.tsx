import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

vi.mock('@/services/pjApi', () => ({
  pjApi: {
    syncronate: {
      dashboard: vi.fn().mockResolvedValue(null),
      listFeeds: vi.fn().mockResolvedValue({ feeds: [] }),
      createFeed: vi.fn().mockResolvedValue({}),
      listJobs: vi.fn().mockResolvedValue({ data: { jobs: [] } }),
      listRecords: vi.fn().mockResolvedValue({ data: { records: [] } }),
      dlpReport: vi.fn().mockResolvedValue({ data: null }),
      feedAudit: vi.fn().mockResolvedValue({ data: { entries: [] } }),
      triggerSync: vi.fn().mockResolvedValue({}),
      pauseFeed: vi.fn().mockResolvedValue({}),
      activateFeed: vi.fn().mockResolvedValue({}),
      retireFeed: vi.fn().mockResolvedValue({}),
      retrySinks: vi.fn().mockResolvedValue({}),
    },
  },
}))

// Asset mocks — webp is not processed in jsdom
vi.mock('@/assets/images/Synchron8.webp', () => ({ default: 'synchron8.webp' }))

describe('SyncronatePanel smoke suite', () => {
  it('renders with SYNCHRON8 logo alt text', async () => {
    const { SyncronatePanel } = await import('@/features/syncronate/components/SyncronatePanel')
    render(<SyncronatePanel />)
    expect(screen.getByAltText('SYNCHRON8')).toBeInTheDocument()
  })

  it('shows data pipeline subtitle', async () => {
    const { SyncronatePanel } = await import('@/features/syncronate/components/SyncronatePanel')
    render(<SyncronatePanel />)
    expect(screen.getByText(/Data-in pipeline/i)).toBeInTheDocument()
  })

  it('shows Dashboard, Feeds, and All Jobs tab buttons', async () => {
    const { SyncronatePanel } = await import('@/features/syncronate/components/SyncronatePanel')
    render(<SyncronatePanel />)
    expect(screen.getByRole('button', { name: /dashboard/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /feeds/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /all jobs/i })).toBeInTheDocument()
  })

  it('Feeds tab shows "No feeds yet" empty state', async () => {
    const { SyncronatePanel } = await import('@/features/syncronate/components/SyncronatePanel')
    render(<SyncronatePanel />)
    expect(await screen.findByText('No feeds yet')).toBeInTheDocument()
  })

  it('Feeds tab shows New Feed button', async () => {
    const { SyncronatePanel } = await import('@/features/syncronate/components/SyncronatePanel')
    render(<SyncronatePanel />)
    expect(await screen.findByRole('button', { name: /new feed/i })).toBeInTheDocument()
  })

  it('Dashboard tab shows "No data" when dashboard is null', async () => {
    const user = userEvent.setup()
    const { SyncronatePanel } = await import('@/features/syncronate/components/SyncronatePanel')
    render(<SyncronatePanel />)
    await user.click(screen.getByRole('button', { name: /dashboard/i }))
    expect(await screen.findByText('No data')).toBeInTheDocument()
  })
})
