import { describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'

const listSubmissions = vi.fn()

vi.mock('@/services/pjApi', () => ({
  pjApi: {
    formkey: {
      list: vi.fn().mockResolvedValue({
        forms: [
          { id: 'f1', formId: 'permits', name: 'Permits' },
          { id: 'f2', formId: 'complaints', name: 'Complaints' },
        ],
      }),
      listSubmissions,
      listReviews: vi.fn().mockResolvedValue({ reviews: [{ id: 'r1' }, { id: 'r2' }], total: 2 }),
    },
  },
}))

const { FormKeyGovernanceSummaryWidget } = await import('@/features/formkey/components')

describe('FormKeyGovernanceSummaryWidget', () => {
  it('shows partial state when one form submission fetch fails', async () => {
    listSubmissions.mockReset()
    listSubmissions
      .mockResolvedValueOnce({ submissions: [{ id: 's1', status: 'received' }] })
      .mockRejectedValueOnce(new Error('boom'))

    render(<FormKeyGovernanceSummaryWidget />)

    expect(screen.getByText('FormKey lifecycle')).toBeInTheDocument()
    await waitFor(() => expect(screen.getByText('Partial')).toBeInTheDocument())
    await waitFor(() => expect(screen.getByRole('link', { name: /review/i })).toHaveTextContent('2'))
    expect(screen.getByRole('link', { name: /intake/i })).toHaveTextContent('—')
  })
})
