import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

vi.mock('@/services/pjApi', () => ({
  pjApi: {
    ingestion: {
      queue: vi.fn().mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 50 }),
      stats: vi.fn().mockResolvedValue({ total: 0, needsReview: 0, autoRouted: 0, bySource: {} }),
      approve: vi.fn().mockResolvedValue({}),
      reject: vi.fn().mockResolvedValue({}),
      reclassify: vi.fn().mockResolvedValue({}),
      route: vi.fn().mockResolvedValue({}),
      rules: vi.fn().mockResolvedValue([]),
    },
  },
}))

const { InboxPanel } = await import('@/features/intake/components/InboxPanel')

describe('InboxPanel smoke suite', () => {
  it('renders without crashing', () => {
    render(<InboxPanel onBack={vi.fn()} />)
    expect(document.body).toBeTruthy()
  })

  it('shows Intake heading', () => {
    render(<InboxPanel onBack={vi.fn()} />)
    expect(screen.getByText('Incoming Items')).toBeInTheDocument()
  })

  it('shows search field', () => {
    render(<InboxPanel onBack={vi.fn()} />)
    expect(screen.getByPlaceholderText(/Search items/i)).toBeInTheDocument()
  })

  it('shows empty state when no items', async () => {
    render(<InboxPanel onBack={vi.fn()} />)
    expect(await screen.findByText(/You're all caught up/i)).toBeInTheDocument()
  })
})
