import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PublicFormPage } from '@/features/formkey/components/PublicFormPage'

describe('Public FormKey page', () => {
  beforeEach(() => {
    window.history.replaceState({}, '', '/forms?id=resident-service')
  })

  it('loads the published form and submits it through the public endpoint', async () => {
    const user = userEvent.setup()
    const fetchMock = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'form-1',
          formId: 'resident-service',
          tenantId: 'default',
          version: '1.0.0',
          name: 'Resident Service Intake',
          description: 'Public request intake',
          status: 'published',
          fields: [
            { id: 'email', label: 'Email', type: 'text', required: true, order: 0, pii: true, sensitive: false, dlpExempt: false, consentCovered: true },
            { id: 'details', label: 'Details', type: 'textarea', required: true, order: 1, pii: false, sensitive: false, dlpExempt: false, consentCovered: false },
            { id: 'consent', label: 'I agree to processing', type: 'consent_checkbox', required: true, order: 2, pii: false, sensitive: false, dlpExempt: false, consentCovered: true },
          ],
          createdAt: '2026-03-31T12:00:00.000Z',
        }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ record: { id: 'rec-1' } }),
      } as Response)

    render(<PublicFormPage />)

    expect(await screen.findByText('Resident Service Intake')).toBeInTheDocument()

    await user.type(screen.getByLabelText(/email/i), 'jane@example.com')
    await user.type(screen.getByLabelText(/details/i), 'Streetlight is out near the common.')
    await user.click(screen.getByLabelText(/i agree to processing/i))
    await user.click(screen.getByRole('button', { name: /submit form/i }))

    await waitFor(() => {
      expect(fetchMock).toHaveBeenNthCalledWith(2, expect.stringContaining('/v1/forms/resident-service/submit'), expect.objectContaining({
        method: 'POST',
      }))
    })

    expect(await screen.findByText(/submission received/i)).toBeInTheDocument()
    expect(screen.getByText('rec-1')).toBeInTheDocument()
  })
})
