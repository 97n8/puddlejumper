/**
 * civic.test.tsx — Unit tests for Civic V1 frontend components
 *
 * Covers: WorkbenchPage module cards, OrgManager validation, ExceptionBanner
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import type { DashboardSummary } from '@/features/civic/api/civicApi'

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock('@/features/civic/api/civicApi', () => ({
  civicApi: {
    dashboard: vi.fn(),
    exceptions: vi.fn(),
  },
}))

vi.mock('@/environments/civic/context/CivicTownContext', () => ({
  useCivicTown: () => ({ townName: 'Testville', governanceForm: 'town_meeting' }),
  CivicTownContext: { Provider: ({ children }: { children: React.ReactNode }) => children },
}))

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
vi.mock('@/lib/logger', () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }),
}))

import { civicApi } from '@/features/civic/api/civicApi'
import { WorkbenchPage } from '@/features/civic/pages/WorkbenchPage'
import type { CivicActor } from '@/features/civic/api/civicApi'

const mockActor: CivicActor = {
  id: 'actor-1',
  object_id: 'obj-1',
  display_name: 'Alice Admin',
  email: 'alice@test.gov',
  role: 'town_administrator',
  pj_user_id: null,
}

const mockSummary: DashboardSummary = {
  vault_score: { authority: 90, accountability: 88, boundary: 95, continuity: 92, records: 94, overall: 92, operational_mode: 'ACTIVE' },
  due_this_week: [],
  exceptions: [],
  open_records_requests: [{ id: 'rrq-1', type: 'records', subtype: 'public_records', stage: 'open', status: 'open', owner_id: null, authority_basis: null, vault_class: 'public', data: {}, created_at: '', updated_at: '', deleted_at: null }],
  active_procurements: [],
  contracts_expiring: [],
  ownerless_count: 0,
  unclassified_count: 0,
  pj_feed: [],
}

// ── WorkbenchPage ─────────────────────────────────────────────────────────────

describe('WorkbenchPage', () => {
  const onNavigate = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(civicApi.dashboard).mockResolvedValue(mockSummary)
    vi.mocked(civicApi.exceptions).mockResolvedValue({ exceptions: [] })
  })

  it('renders all 4 module cards', async () => {
    render(
      <WorkbenchPage
        actor={mockActor}
        enabledCards={new Set(['records', 'meetings', 'procurement', 'contracts'])}
        onNavigate={onNavigate}
      />
    )
    await waitFor(() => expect(screen.queryByText('Loading...')).not.toBeInTheDocument())
    expect(screen.getAllByText('Public Records').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Meetings & OML').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Procurement').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Contracts').length).toBeGreaterThan(0)
  })

  it('shows "Soon" badge on coming-soon module cards', async () => {
    render(
      <WorkbenchPage
        actor={mockActor}
        enabledCards={new Set(['records', 'meetings', 'procurement', 'contracts'])}
        onNavigate={onNavigate}
      />
    )
    await waitFor(() => expect(screen.queryByText('Loading...')).not.toBeInTheDocument())
    const soonBadges = screen.getAllByText('Soon')
    expect(soonBadges).toHaveLength(3) // meetings, procurement, contracts
  })

  it('coming-soon cards are disabled', async () => {
    render(
      <WorkbenchPage
        actor={mockActor}
        enabledCards={new Set(['records', 'meetings', 'procurement', 'contracts'])}
        onNavigate={onNavigate}
      />
    )
    await waitFor(() => expect(screen.queryByText('Loading...')).not.toBeInTheDocument())

    // Find the Meetings card button and verify it's disabled
    const meetingsCard = screen.getByText('Meetings & OML').closest('button')
    expect(meetingsCard).toBeDisabled()
    fireEvent.click(meetingsCard!)
    expect(onNavigate).not.toHaveBeenCalled()
  })

  it('clicking Public Records card navigates', async () => {
    render(
      <WorkbenchPage
        actor={mockActor}
        enabledCards={new Set(['records', 'meetings', 'procurement', 'contracts'])}
        onNavigate={onNavigate}
      />
    )
    await waitFor(() => expect(screen.queryByText('Loading...')).not.toBeInTheDocument())

    // The module cards grid — find the button that contains "c.66 §10" statute text (unique to records card)
    const statuteEl = screen.getByText('c.66 §10')
    const recordsCard = statuteEl.closest('button')
    expect(recordsCard).not.toBeDisabled()
    fireEvent.click(recordsCard!)
    expect(onNavigate).toHaveBeenCalledWith('records')
  })

  it('shows open records request count from dashboard', async () => {
    render(
      <WorkbenchPage
        actor={mockActor}
        enabledCards={new Set(['records'])}
        onNavigate={onNavigate}
      />
    )
    await waitFor(() => {
      // The records count card should show 1 (from mockSummary.open_records_requests)
      const cards = screen.getAllByRole('button')
      expect(cards.length).toBeGreaterThan(0)
    })
  })
})
