import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { LogicOSGoogleDrivePage } from '@/features/mobile/LogicOSGoogleDrivePage'
import { LogicOSMobilePage } from '@/features/mobile/LogicOSMobilePage'

describe('LogicOSMobilePage', () => {
  beforeEach(() => {
    window.localStorage.clear()
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        status: 'ok',
        checks: {
          github: true,
          microsoft: true,
          google: true,
          seal: true,
        },
      }),
    }))
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('renders the coherent mobile shell and runtime contract', async () => {
    render(<LogicOSMobilePage />)

    expect(screen.getByText(/mobile-first field capture/i)).toBeInTheDocument()
    expect(screen.getByText(/latest flow receipt/i)).toBeInTheDocument()
    expect(screen.getByText(/post \/api\/vault\/intake/i)).toBeInTheDocument()

    await waitFor(() => {
      expect(screen.getByText(/puddlejumper live/i)).toBeInTheDocument()
    })
  })

  it('routes a capture into the selected case workspace and creates a live flow receipt', () => {
    render(<LogicOSMobilePage />)

    fireEvent.change(screen.getByPlaceholderText(/capture what happened/i), {
      target: { value: 'Create a real flow receipt instead of abstract copy.' },
    })
    fireEvent.click(screen.getByRole('button', { name: /send to vault/i }))

    expect(screen.getByText(/create a real flow receipt instead of abstract copy/i)).toBeInTheDocument()
    expect(screen.getAllByText(/post \/api\/vault\/intake/i).length).toBeGreaterThan(0)
  })

  it('renders the LogicOS Google Drive page with the integrated contract', () => {
    render(<LogicOSGoogleDrivePage />)

    expect(screen.getByRole('heading', { name: /the google page now lives inside logicos/i })).toBeInTheDocument()
    expect(screen.getByText(/google drive is a logicos workflow surface/i)).toBeInTheDocument()
    expect(screen.getAllByText(/post \/api\/google\/drive\/v3\/files/i).length).toBeGreaterThan(0)
  })
})
