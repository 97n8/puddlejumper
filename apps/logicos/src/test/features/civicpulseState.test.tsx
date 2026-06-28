import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'

const {
  mockGetPendingSummaries,
  mockGetBackstopItems,
  mockGetPublicationLog,
  mockGetMunicipalityConfig,
  mockUseFeed,
} = vi.hoisted(() => ({
  mockGetPendingSummaries: vi.fn(),
  mockGetBackstopItems: vi.fn(),
  mockGetPublicationLog: vi.fn(),
  mockGetMunicipalityConfig: vi.fn(),
  mockUseFeed: vi.fn(),
}))

vi.mock('@/features/civicpulse/api/civicpulseClient', () => ({
  civicpulseClient: {
    getPendingSummaries: (...args: unknown[]) => mockGetPendingSummaries(...args),
    getBackstopItems: (...args: unknown[]) => mockGetBackstopItems(...args),
    getPublicationLog: (...args: unknown[]) => mockGetPublicationLog(...args),
    getMunicipalityConfig: (...args: unknown[]) => mockGetMunicipalityConfig(...args),
  },
  getCivicPulseFailureMessage: (error: unknown, subject: string) => {
    const status = (error as { status?: number })?.status
    if (status === 401) return `Sign in required to load ${subject}.`
    if (status === 403) return `You are not authorized to load ${subject}.`
    return error instanceof Error && error.message ? error.message : `Could not load ${subject}.`
  },
}))

vi.mock('@/features/civicpulse/api/feedQueries', () => ({
  useFeed: (...args: unknown[]) => mockUseFeed(...args),
}))

vi.mock('@/features/civicpulse/components/operatorUI/auditLog/AuditExportButton', () => ({
  AuditExportButton: () => <button type="button">Export</button>,
}))

vi.mock('@/features/civicpulse/components/publicFeed/FeedEntry', () => ({
  FeedEntry: ({ entry }: { entry: { headline: string } }) => <div>{entry.headline}</div>,
}))

vi.mock('@/features/civicpulse/components/publicFeed/FeedFilter', () => ({
  FeedFilter: () => <div>Feed Filter</div>,
}))

vi.mock('@/features/civicpulse/components/publicFeed/FeedSearch', () => ({
  FeedSearch: () => <div>Feed Search</div>,
}))

vi.mock('@/features/civicpulse/components/operatorUI/approvalQueue/SummaryReviewCard', () => ({
  SummaryReviewCard: () => <div>Summary Card</div>,
}))

vi.mock('@/features/civicpulse/components/operatorUI/backstop/ComplianceAlertBanner', () => ({
  ComplianceAlertBanner: ({ count }: { count: number }) => <div>Backstop banner {count}</div>,
}))

import { ApprovalQueueView } from '@/features/civicpulse/components/operatorUI/approvalQueue/ApprovalQueueView'
import { BackstopStatusPanel } from '@/features/civicpulse/components/operatorUI/backstop/BackstopStatusPanel'
import { PublicationLogView } from '@/features/civicpulse/components/operatorUI/auditLog/PublicationLogView'
import { ChannelConfigPanel } from '@/features/civicpulse/components/operatorUI/channelConfig/ChannelConfigPanel'
import { ApprovalBehaviorSettings } from '@/features/civicpulse/components/operatorUI/channelConfig/ApprovalBehaviorSettings'
import { TownActivityFeed } from '@/features/civicpulse/components/publicFeed/TownActivityFeed'
import { CivicPulsePanel } from '@/features/civicpulse/components/CivicPulsePanel'

describe('CivicPulse stateful views', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetPendingSummaries.mockResolvedValue([])
    mockGetBackstopItems.mockResolvedValue([])
    mockGetPublicationLog.mockResolvedValue([])
    mockGetMunicipalityConfig.mockResolvedValue({
      municipalityId: 'm1',
      name: 'Testville',
      channels: [],
      backstopIntervals: {},
      escalationContacts: [],
      archieveVersion: '1',
      civicPulseActive: true,
    })
    mockUseFeed.mockReturnValue({
      entries: [],
      loading: false,
      error: null,
      hasMore: false,
      loadMore: vi.fn(),
      refresh: vi.fn(),
    })
  })

  it('does not render an empty approval queue on 401', async () => {
    mockGetPendingSummaries.mockRejectedValueOnce(Object.assign(new Error('Unauthorized'), { status: 401 }))
    render(<ApprovalQueueView />)
    await waitFor(() => expect(screen.getByText('Sign in required to load pending summaries.')).toBeInTheDocument())
    expect(screen.queryByText('No summaries pending review.')).not.toBeInTheDocument()
  })

  it('does not render a clear backstop state on 500 failure', async () => {
    mockGetBackstopItems.mockRejectedValueOnce(new Error('Backstop service unavailable'))
    render(<BackstopStatusPanel />)
    await waitFor(() => expect(screen.getByText('Backstop service unavailable')).toBeInTheDocument())
    expect(screen.queryByText('All actions within compliance windows.')).not.toBeInTheDocument()
  })

  it('does not render an empty publication log on 403', async () => {
    mockGetPublicationLog.mockRejectedValueOnce(Object.assign(new Error('Forbidden'), { status: 403 }))
    render(<PublicationLogView />)
    await waitFor(() => expect(screen.getByText('You are not authorized to load publication log.')).toBeInTheDocument())
    expect(screen.queryByText('No publication events recorded yet.')).not.toBeInTheDocument()
  })

  it('does not render blank config when configuration load fails', async () => {
    mockGetMunicipalityConfig.mockRejectedValueOnce(new Error('Config offline'))
    render(<ChannelConfigPanel />)
    await waitFor(() => expect(screen.getByText('Config offline')).toBeInTheDocument())
    expect(screen.queryByText('Website Post')).not.toBeInTheDocument()
  })

  it('does not render blank approval settings when config load fails', async () => {
    mockGetMunicipalityConfig.mockRejectedValueOnce(Object.assign(new Error('Forbidden'), { status: 403 }))
    render(<ApprovalBehaviorSettings />)
    await waitFor(() => expect(screen.getByText('You are not authorized to load approval settings.')).toBeInTheDocument())
    expect(screen.queryByText('Board Vote')).not.toBeInTheDocument()
  })

  it('does not show feed empty state when feed loading failed', () => {
    mockUseFeed.mockReturnValue({
      entries: [],
      loading: false,
      error: 'Sign in required to load activity feed.',
      hasMore: false,
      loadMore: vi.fn(),
      refresh: vi.fn(),
    })
    render(<TownActivityFeed />)
    expect(screen.getByText('Sign in required to load activity feed.')).toBeInTheDocument()
    expect(screen.queryByText('No governance actions published yet.')).not.toBeInTheDocument()
  })

  it('shows unavailable compliance status instead of silently treating it as zero', async () => {
    mockGetBackstopItems.mockRejectedValueOnce(new Error('Backstop offline'))
    render(<CivicPulsePanel />)
    await waitFor(() => expect(screen.getByText('Compliance status unavailable.')).toBeInTheDocument())
    expect(screen.queryByText(/Backstop banner/i)).not.toBeInTheDocument()
  })
})
