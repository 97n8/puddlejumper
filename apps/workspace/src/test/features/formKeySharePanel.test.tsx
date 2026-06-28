import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { FormKeySharePanel } from '@/features/formkey/components/FormKeySharePanel'
import type { FKFormDefinition } from '@/services/pjApi'

const { toastSuccess, qrToDataUrl } = vi.hoisted(() => ({
  toastSuccess: vi.fn(),
  qrToDataUrl: vi.fn(async () => 'data:image/png;base64,qr-demo'),
}))

let clipboardWriteText = vi.fn()

vi.mock('sonner', () => ({
  toast: {
    success: toastSuccess,
    error: vi.fn(),
  },
}))

vi.mock('qrcode', () => ({
  default: {
    toDataURL: qrToDataUrl,
  },
}))

const form: FKFormDefinition = {
  id: 'form-1',
  formId: 'resident-service',
  tenantId: 'default',
  version: '1.0.0',
  name: 'Resident Service Intake',
  description: 'Public request intake',
  status: 'published',
  fields: [],
  createdAt: '2026-03-31T12:00:00.000Z',
}

describe('FormKey share panel', () => {
  beforeEach(() => {
    toastSuccess.mockReset()
    qrToDataUrl.mockClear()
    clipboardWriteText = vi.fn().mockResolvedValue(undefined)
    Object.assign(navigator, {
      clipboard: {
        writeText: clipboardWriteText,
      },
    })
  })

  it('shows live share surfaces and copies embed code', async () => {
    const user = userEvent.setup()

    render(<FormKeySharePanel form={form} />)

    await waitFor(() => {
      expect(screen.getByAltText(/qr code for resident service intake/i)).toBeInTheDocument()
    })

    expect(screen.getByText(/public-ready/i)).toBeInTheDocument()
    expect(screen.getByDisplayValue(/<iframe src="http:\/\/localhost:3000\/forms\?id=resident-service&embed=1"/i)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /copy embed/i }))

    expect(toastSuccess).toHaveBeenCalledWith('Embed code copied.')
  })
})
