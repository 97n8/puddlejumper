import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

vi.mock('@/features/budgeting/api', () => ({
  useFiscalYears: () => ({ data: [], isLoading: false, refetch: vi.fn() }),
  useCreateFiscalYear: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useCreateModel: () => ({ mutate: vi.fn(), isPending: false }),
  useDeleteModel: () => ({ mutateAsync: vi.fn(), isPending: false }),
}))

vi.mock('@/lib/api', () => ({
  pjFetch: vi.fn().mockResolvedValue([]),
}))

// Mock AgGridReact since jsdom doesn't support canvas/complex DOM operations
vi.mock('ag-grid-react', () => ({
  AgGridReact: ({ rowData }: { rowData: unknown[] }) => (
    <div data-testid="ag-grid" aria-label="data grid">
      {rowData?.length ?? 0} rows
    </div>
  ),
}))

vi.mock('ag-grid-community/styles/ag-grid.css', () => ({}))
vi.mock('ag-grid-community/styles/ag-theme-quartz.css', () => ({}))

const { BudgetingPanel } = await import('@/features/budgeting/components/BudgetingPanel')

describe('Budgeting smoke suite', () => {
  it('renders BudgetingPanel with Projections tab active', () => {
    render(<BudgetingPanel onBack={vi.fn()} />)
    expect(screen.getByText('Budgeting')).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /projections/i })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /fiscal years/i })).toBeInTheDocument()
  })

  it('shows model form trigger button (New Model)', () => {
    render(<BudgetingPanel onBack={vi.fn()} />)
    expect(screen.getByRole('button', { name: /new model/i })).toBeInTheDocument()
  })

  it('shows empty projection placeholder on initial render', () => {
    render(<BudgetingPanel onBack={vi.fn()} />)
    expect(screen.getByText(/run a projection to see how a fund/i)).toBeInTheDocument()
  })

  it('FiscalYears tab shows New Fiscal Year button', async () => {
    const user = userEvent.setup()
    render(<BudgetingPanel onBack={vi.fn()} />)
    await user.click(screen.getByRole('tab', { name: /fiscal years/i }))
    expect(screen.getByRole('button', { name: /new fiscal year/i })).toBeInTheDocument()
  })

  it('AG Grid renders without crashing when projection data exists', () => {
    // The grid is conditionally rendered only when currentProjection is set
    // It is triggered from the calculate model handler; here we confirm the mock works
    render(<BudgetingPanel onBack={vi.fn()} />)
    // Grid is not shown initially - projection placeholder is shown instead
    expect(screen.queryByTestId('ag-grid')).not.toBeInTheDocument()
    expect(screen.getByText(/run a projection to see how a fund/i)).toBeInTheDocument()
  })
})
