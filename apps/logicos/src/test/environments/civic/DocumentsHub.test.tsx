import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { DocumentsHub } from '@/environments/civic/components/DocumentsHub'

const { docsCreateMock, toastSuccessMock, toastErrorMock } = vi.hoisted(() => ({
  docsCreateMock: vi.fn(),
  toastSuccessMock: vi.fn(),
  toastErrorMock: vi.fn(),
}))

vi.mock('@/environments/civic/context/CivicTownContext', () => ({
  useCivicTown: () => ({
    town: { name: 'Berlin', dor_code: '020' },
    townName: 'Berlin',
    governanceForm: 'open_town_meeting',
    fiscalYearEnd: 'June 30',
    county: 'Worcester',
  }),
}))

vi.mock('@/features/builder/components/VaultModuleMaker', () => ({
  VaultModuleMaker: () => <div>Vault Module Maker</div>,
}))

vi.mock('@/features/comms/components/CommsPanel', () => ({
  CommsPanel: () => <div>Comms Panel</div>,
}))

vi.mock('@/services/pjApi', () => ({
  pjApi: {
    docs: {
      create: (...args: unknown[]) => docsCreateMock(...args),
    },
  },
}))

vi.mock('sonner', () => ({
  toast: {
    success: (...args: unknown[]) => toastSuccessMock(...args),
    error: (...args: unknown[]) => toastErrorMock(...args),
  },
}))

describe('DocumentsHub', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    docsCreateMock.mockResolvedValue({ id: 'doc-1', name: 'OML Meeting Notice — Berlin' })
  })

  it('creates a vault document from the selected civic template', async () => {
    const user = userEvent.setup()

    render(<DocumentsHub />)

    await user.click(screen.getByRole('button', { name: /oml meeting notice/i }))
    await user.type(screen.getByPlaceholderText(/enter body name/i), 'Select Board')
    await user.type(screen.getByPlaceholderText(/enter meeting date/i), 'May 12, 2026')
    await user.type(screen.getByPlaceholderText(/enter agenda items/i), 'Budget review')

    await user.click(screen.getByRole('button', { name: /generate document/i }))

    await waitFor(() => {
      expect(docsCreateMock).toHaveBeenCalledWith(expect.objectContaining({
        name: 'OML Meeting Notice — Berlin',
        pageSize: 'letter',
      }))
    })

    expect(docsCreateMock).toHaveBeenCalledWith(expect.objectContaining({
      html: expect.stringContaining('Select Board'),
      css: expect.stringContaining('.civic-doc'),
    }))
    expect(toastSuccessMock).toHaveBeenCalledWith('Generated OML Meeting Notice — Berlin')
    expect(toastErrorMock).not.toHaveBeenCalled()
  })
})
