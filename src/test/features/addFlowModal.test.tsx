import { describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

vi.mock('@/features/civic/api/civicApi', () => ({
  civicApi: {
    me: vi.fn().mockResolvedValue({ actor: { object_id: 'actor-1', town_id: 'org-1' } }),
    flows: {
      frameworks: vi.fn().mockRejectedValue(new Error('registry unavailable')),
      create: vi.fn(),
    },
  },
}))

describe('AddFlowModal scenario builder', () => {
  it('builds a scenario from a linked app through framework logic', async () => {
    const user = userEvent.setup()
    const onAdd = vi.fn()
    const onClose = vi.fn()
    const { AddFlowModal } = await import('@/features/flows/components/AddFlowModal')

    render(<AddFlowModal installed={[]} onAdd={onAdd} onClose={onClose} />)

    await user.click(screen.getByRole('button', { name: /Google/i }))
    await user.click(screen.getByRole('button', { name: /Save a Gmail draft/i }))

    await user.type(screen.getByPlaceholderText('name@example.com'), 'ops@town.gov')
    await user.type(screen.getByPlaceholderText('Subject'), 'Test subject')

    const conditionInput = screen.getByDisplayValue('If the record is high risk')
    await user.clear(conditionInput)
    await user.type(conditionInput, 'If the issue is high impact')
    await user.clear(screen.getAllByPlaceholderText(/Describe the branch action/i)[0])
    await user.type(screen.getAllByPlaceholderText(/Describe the branch action/i)[0], 'Escalate to the duty maintainer and capture evidence.')

    await user.click(screen.getByRole('button', { name: /Add scenario/i }))

    await waitFor(() => {
      expect(onAdd).toHaveBeenCalledTimes(1)
    })

    expect(onAdd).toHaveBeenCalledWith(expect.objectContaining({
      recipeId: 'g-gmail-draft',
      connection: 'google',
      frameworkId: 'VAULTCLERK.PublicRecords',
      frameworkLabel: 'Public Records',
      frameworkChapter: 'c.66',
      config: expect.objectContaining({
        to: 'ops@town.gov',
        subject: 'Test subject',
      }),
      logicSteps: expect.arrayContaining([
        expect.objectContaining({
          kind: 'if',
          title: 'If the issue is high impact',
        }),
      ]),
    }))
  })

  it('disables save with an explicit message when the framework registry is unavailable', async () => {
    const user = userEvent.setup()
    const onAdd = vi.fn()
    const onClose = vi.fn()
    const { AddFlowModal } = await import('@/features/flows/components/AddFlowModal')

    render(<AddFlowModal installed={[]} onAdd={onAdd} onClose={onClose} persist={true} />)

    await user.click(screen.getByRole('button', { name: /Google/i }))
    await user.click(screen.getByRole('button', { name: /Save a Gmail draft/i }))

    expect(await screen.findByText(/VAULT framework registry is unavailable/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Save scenario/i })).toBeDisabled()
  })
})
