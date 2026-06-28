import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { FormKeyDemoPanel } from '@/features/formkey/components/FormKeyDemoPanel'

const { toastSuccess, toastError, toastLoading, downloadBlobMock, generateDocumentMock, fiscalSyncMock } = vi.hoisted(() => ({
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
  toastLoading: vi.fn(),
  downloadBlobMock: vi.fn(),
  generateDocumentMock: vi.fn(async () => new Blob(['demo'], { type: 'application/pdf' })),
  fiscalSyncMock: vi.fn(),
}))

vi.mock('sonner', () => ({
  toast: {
    success: toastSuccess,
    error: toastError,
    loading: toastLoading,
  },
}))

vi.mock('@/lib/documentUtils', () => ({
  downloadBlob: downloadBlobMock,
  generateDocument: generateDocumentMock,
}))

vi.mock('@/services/pjApi', () => ({
  pjApi: {
    fiscal: {
      sync: fiscalSyncMock,
    },
  },
}))

describe('FormKey civic templates', () => {
  beforeEach(() => {
    toastSuccess.mockReset()
    toastError.mockReset()
    toastLoading.mockReset()
    downloadBlobMock.mockClear()
    generateDocumentMock.mockClear()
    fiscalSyncMock.mockReset()
    vi.restoreAllMocks()
  })

  it('pulls LogicDASH town data and exports a board-ready packet', async () => {
    const user = userEvent.setup()
    const mockData = {
      municipality: 'Sutton',
      dorCode: 297,
      county: 'Worcester',
      fiscalYear: 2026,
      computedAt: '2026-03-31T14:00:00.000Z',
      metrics: {
        operatingBudget: 37_850_000,
        totalEmployees: 332,
        certifiedFreeCash: 1_200_000,
        freeCashPctBudget: 3.2,
        totalStateAid: 3_400_000,
        salariesPctBudget: 64.7,
        averageSalary: 73_735,
        excessLevyCapacityPct: 2.3,
        debtServicePctBudget: 5.1,
      },
      riskFlags: [
        {
          code: 'FREE_CASH_LOW',
          label: 'Free cash watch',
          severity: 'warning',
          detail: 'Reserve cushion is thinner than the comfort line.',
          threshold: '5%',
        },
      ],
    }
    fiscalSyncMock.mockResolvedValue(mockData)

    render(
      <FormKeyDemoPanel
        onCreateBlank={vi.fn()}
        onUseStarter={vi.fn()}
        creatingStarter={false}
      />,
    )

    await user.click(screen.getByRole('button', { name: /open civic templates builder/i }))
    await user.click(screen.getByRole('button', { name: /pull logicdash data/i }))

    await waitFor(() => {
      expect(fiscalSyncMock).toHaveBeenCalledWith(expect.any(String))
    })

    await waitFor(() => {
      expect(screen.getAllByText(/logicdash pull · fy2026/i).length).toBeGreaterThan(0)
    })
    expect(screen.getByText('Free cash watch')).toBeInTheDocument()
    expect(screen.getByText('Sutton Board Decision Brief')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /download html/i }))
    expect(downloadBlobMock).toHaveBeenCalledWith(expect.any(Blob), expect.stringMatching(/sutton-board-brief-.*\.html$/))

    await user.click(screen.getByRole('button', { name: /download pdf/i }))
    await waitFor(() => {
      expect(generateDocumentMock).toHaveBeenCalledWith(expect.objectContaining({
        title: 'Sutton Board Decision Brief',
        format: 'pdf',
      }))
    })
  })
})
