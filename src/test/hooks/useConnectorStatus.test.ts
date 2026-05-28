import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'

const mockStatus = vi.hoisted(() => vi.fn())
const mockUseAuth = vi.hoisted(() => vi.fn(() => ({ user: { sub: 'u1', email: 'test@example.com' } })))

vi.mock('@/services/auth/AuthContext', () => ({
  useAuth: mockUseAuth,
}))

vi.mock('@/services/pjApi', () => ({
  pjApi: {
    connectors: { status: mockStatus },
  },
}))

import * as module from '@/hooks/useConnectorStatus'

describe('useConnectorStatus', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUseAuth.mockReturnValue({ user: { sub: 'u1', email: 'test@example.com' } })
    module._resetCacheForTesting()
  })

  it('returns EMPTY status and loading=false when user is null', async () => {
    mockUseAuth.mockReturnValue({ user: null as unknown as { sub: string; email: string } })
    mockStatus.mockResolvedValue({ connectors: {} })
    const { result } = renderHook(() => module.useConnectorStatus())
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.anyConnected).toBe(false)
    expect(result.current.status).toEqual({ google: false, microsoft: false, github: false })
  })

  it('fetches connector status when user is authenticated', async () => {
    mockStatus.mockResolvedValue({
      connectors: {
        google: { connected: true },
        microsoft: { connected: false },
        github: { connected: true },
      }
    })

    const { result } = renderHook(() => module.useConnectorStatus())
    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.status.google).toBe(true)
    expect(result.current.status.microsoft).toBe(false)
    expect(result.current.status.github).toBe(true)
    expect(result.current.anyConnected).toBe(true)
  })

  it('anyConnected is false when all connectors are disconnected', async () => {
    mockStatus.mockResolvedValue({
      connectors: {
        google: { connected: false },
        microsoft: { connected: false },
        github: { connected: false },
      }
    })

    const { result } = renderHook(() => module.useConnectorStatus())
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.anyConnected).toBe(false)
  })

  it('handles missing connector keys gracefully', async () => {
    mockStatus.mockResolvedValue({ connectors: {} })

    const { result } = renderHook(() => module.useConnectorStatus())
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.status).toEqual({ google: false, microsoft: false, github: false })
  })

  it('handles API errors without throwing', async () => {
    mockStatus.mockRejectedValue(new Error('Network error'))

    const { result } = renderHook(() => module.useConnectorStatus())
    await waitFor(() => expect(result.current.loading).toBe(false))
    // Should not throw — status stays at last known (EMPTY)
    expect(result.current.status).toEqual({ google: false, microsoft: false, github: false })
  })

  it('refresh() re-fetches and updates status', async () => {
    mockStatus
      .mockResolvedValueOnce({ connectors: { google: { connected: false } } })
      .mockResolvedValueOnce({ connectors: { google: { connected: true } } })

    const { result } = renderHook(() => module.useConnectorStatus())
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.status.google).toBe(false)

    await act(async () => { await result.current.refresh() })
    expect(result.current.status.google).toBe(true)
  })
})
