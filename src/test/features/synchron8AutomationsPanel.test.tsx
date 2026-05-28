import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const listMock = vi.fn()
const createMock = vi.fn()
const updateMock = vi.fn()
const deleteMock = vi.fn()
const triggerMock = vi.fn()
const listRunsMock = vi.fn()
const getRunEvidenceMock = vi.fn()

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

vi.mock('@/services/pjApi', () => ({
  pjApi: {
    synchron8: {
      list: listMock,
      create: createMock,
      update: updateMock,
      delete: deleteMock,
      trigger: triggerMock,
      listRuns: listRunsMock,
      getRunEvidence: getRunEvidenceMock,
    },
  },
}))

const baseAutomation = {
  id: 'auto-1',
  name: 'Records escalation',
  envId: 'env-1',
  moduleId: 'VAULTPRR',
  complianceProfile: 'prr-10-day',
  trigger: { type: 'deadline_approaching', module: 'VAULTPRR', days_before: '3', field: 'dueDate' },
  steps: [
    { type: 'send_alert', role: 'records-access-officer', message: 'Deadline in 3 days.' },
    { type: 'require_attestation', role: 'town-administrator', prompt: 'Confirm owner assigned.' },
  ],
  enabled: true,
} as const

describe('Synchron8AutomationsPanel', () => {
  beforeEach(() => {
    listMock.mockReset()
    createMock.mockReset()
    updateMock.mockReset()
    deleteMock.mockReset()
    triggerMock.mockReset()
    listRunsMock.mockReset()
    getRunEvidenceMock.mockReset()

    listMock.mockResolvedValue({ automations: [] })
    createMock.mockImplementation(async (payload: Record<string, unknown>) => ({
      automation: { id: 'created-1', ...payload },
    }))
    updateMock.mockResolvedValue({ automation: baseAutomation })
    deleteMock.mockResolvedValue({ ok: true })
    triggerMock.mockResolvedValue({ runId: 'run-new' })
    listRunsMock.mockResolvedValue({
      runs: [{
        runId: 'run-1',
        automationId: 'auto-1',
        status: 'success',
        startedAt: '2026-05-03T12:00:00.000Z',
        completedAt: '2026-05-03T12:00:05.000Z',
        steps: [{ stepIndex: 0, status: 'success' }],
      }],
    })
    getRunEvidenceMock.mockResolvedValue({ evidence: { decision: 'approved', actor: 'system' } })
  })

  it('creates a scenario from a blueprint', async () => {
    const user = userEvent.setup()
    const { Synchron8AutomationsPanel } = await import('@/features/flows/components/Synchron8AutomationsPanel')

    render(<Synchron8AutomationsPanel envId="env-1" />)

    await user.click(screen.getByRole('button', { name: /prr escalation lane/i }))
    expect(screen.getByDisplayValue('PRR escalation lane')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /create scenario/i }))

    await waitFor(() => {
      expect(createMock).toHaveBeenCalledWith(expect.objectContaining({
        envId: 'env-1',
        name: 'PRR escalation lane',
        moduleId: 'VAULTPRR',
        complianceProfile: 'prr-10-day',
        enabled: true,
        trigger: expect.objectContaining({
          type: 'deadline_approaching',
          module: 'VAULTPRR',
          days_before: '3',
          field: 'dueDate',
        }),
      }))
    })

    expect(createMock.mock.calls[0]?.[0]?.steps).toHaveLength(3)
  })

  it('loads run history and evidence for an automation', async () => {
    const user = userEvent.setup()
    listMock.mockResolvedValueOnce({ automations: [baseAutomation] })
    const { Synchron8AutomationsPanel } = await import('@/features/flows/components/Synchron8AutomationsPanel')

    render(<Synchron8AutomationsPanel envId="env-1" />)

    await screen.findByText('Records escalation')
    await user.click(screen.getByRole('button', { name: /runs/i }))

    await waitFor(() => {
      expect(listRunsMock).toHaveBeenCalledWith('auto-1')
    })

    expect(await screen.findByText('run-1')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /inspect evidence/i }))

    await waitFor(() => {
      expect(getRunEvidenceMock).toHaveBeenCalledWith('run-1')
    })

    expect(await screen.findByText(/"decision": "approved"/i)).toBeInTheDocument()
  })
})
