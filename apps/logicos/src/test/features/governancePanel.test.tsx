import { describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

vi.mock('@/features/logicdash/components/TaskQueuePanel', () => ({
  TaskQueuePanel: () => <div data-testid="task-queue-panel">Tasks</div>,
}))

vi.mock('@/services/pjApi', () => ({
  pjApi: {
    formkey: {
      list: vi.fn().mockResolvedValue({
        forms: [
          { id: 'f1', formId: 'permits', name: 'Permits' },
          { id: 'f2', formId: 'complaints', name: 'Complaints' },
        ],
      }),
      listSubmissions: vi.fn()
        .mockResolvedValueOnce({ submissions: [{ id: 's1', status: 'received' }, { id: 's2', status: 'closed' }] })
        .mockResolvedValueOnce({ submissions: [{ id: 's3', status: 'under_review' }] }),
      listReviews: vi.fn().mockResolvedValue({ reviews: [{ id: 'r1' }, { id: 'r2' }], total: 2 }),
    },
  },
}))

const { GovernancePanel } = await import('@/features/logicdash/components/GovernancePanel')

describe('GovernancePanel FormKey handoff', () => {
  it('shows the read-only FormKey summary widget with links into intake and review', async () => {
    render(
      <MemoryRouter>
        <GovernancePanel municipality={{ name: 'Gardner' } as never} snap={null} />
      </MemoryRouter>,
    )

    expect(screen.getByText('FormKey lifecycle')).toBeInTheDocument()
    await waitFor(() => expect(screen.getAllByText('2').length).toBeGreaterThanOrEqual(2))
    expect(screen.getByRole('link', { name: /intake/i })).toHaveAttribute('href', '/formkey?tab=intake')
    expect(screen.getByRole('link', { name: /review/i })).toHaveAttribute('href', '/formkey?tab=review')
  })
})
