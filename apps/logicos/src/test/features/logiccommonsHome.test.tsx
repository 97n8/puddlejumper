import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { LogicCommonsHome } from '@/features/logiccommons/LogicCommonsHome'

const mockUseCommonsContext = vi.fn()
const mockUseCommonsAlerts = vi.fn()
const mockUseDashboard = vi.fn()
const mockMutate = vi.fn()

vi.mock('@/features/logiccommons/hooks/useCommonsContext', () => ({
  useCommonsContext: () => mockUseCommonsContext(),
}))

vi.mock('@/features/logiccommons/hooks/useCommonsAlerts', () => ({
  useCommonsAlerts: () => mockUseCommonsAlerts(),
}))

vi.mock('@/features/logiccommons/hooks/useDashboard', () => ({
  useDashboard: () => mockUseDashboard(),
}))

vi.mock('@/features/logiccommons/hooks/useIntakeRecord', () => ({
  useSeedDemoData: () => ({ mutate: mockMutate, isPending: false }),
}))

describe('LogicCommonsHome', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUseCommonsContext.mockReturnValue({
      data: {
        municipality_name: 'Logicville',
        active_connectors: ['google', 'm365'],
      },
      isLoading: false,
    })
    mockUseCommonsAlerts.mockReturnValue({
      data: [
        { id: 'a1', title: 'PRR response overdue', severity: 'high', status: 'open', domain: 'compliance' },
      ],
    })
    mockUseDashboard.mockReturnValue({
      isLoading: false,
      data: {
        summary: {
          total_records: 12,
          open_alerts: 1,
          overdue_records: 2,
          active_modules: 4,
        },
        modules: [
          { module_key: 'VAULTCLERK.PublicRecords', display_name: 'Public Records', open: 3, in_progress: 2, closed: 7, overdue: 1, total: 12 },
          { module_key: 'VAULTFISCAL.Budget', display_name: 'Budget', open: 1, in_progress: 0, closed: 2, overdue: 0, total: 3 },
        ],
      },
    })
  })

  it('keeps /commons as a dashboard instead of repeating the module launcher grid', () => {
    render(
      <MemoryRouter initialEntries={['/commons']}>
        <LogicCommonsHome />
      </MemoryRouter>,
    )

    expect(screen.getByRole('heading', { name: 'LogicCommons' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Alert Digest' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Module Overview' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Public Records/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Budget/i })).not.toBeInTheDocument()
  })
})
