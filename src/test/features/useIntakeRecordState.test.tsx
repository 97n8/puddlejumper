import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { useIntakeRecord } from '@/features/logiccommons/hooks/useIntakeRecord'

const mockFetch = vi.fn()

vi.stubGlobal('fetch', mockFetch)

function createWrapper() {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  })

  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>
  }
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('useIntakeRecord', () => {
  beforeEach(() => {
    mockFetch.mockReset()
  })

  it('maps 404 to not_found', async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({}, 404))
    const { result } = renderHook(() => useIntakeRecord('rec-404'), { wrapper: createWrapper() })
    await waitFor(() => expect(result.current.status).toBe('not_found'))
  })

  it('maps 401 to unauthenticated', async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ error: 'Authentication required' }, 401))
    const { result } = renderHook(() => useIntakeRecord('rec-401'), { wrapper: createWrapper() })
    await waitFor(() => expect(result.current.status).toBe('unauthenticated'))
  })

  it('maps 403 to unauthorized', async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ error: 'Forbidden' }, 403))
    const { result } = renderHook(() => useIntakeRecord('rec-403'), { wrapper: createWrapper() })
    await waitFor(() => expect(result.current.status).toBe('unauthorized'))
  })

  it('maps 500 and network failures to load_error', async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ error: 'Server failed' }, 500))
    const first = renderHook(() => useIntakeRecord('rec-500'), { wrapper: createWrapper() })
    await waitFor(() => expect(first.result.current.status).toBe('load_error'))

    mockFetch.mockRejectedValueOnce(new Error('Network offline'))
    const second = renderHook(() => useIntakeRecord('rec-network'), { wrapper: createWrapper() })
    await waitFor(() => expect(second.result.current.status).toBe('load_error'))
  })

  it('maps successful record fetch to ok', async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({
      id: 'rec-ok',
      status: 'open',
      pipeline_stage: 'intake',
      created_at: new Date().toISOString(),
    }))
    const { result } = renderHook(() => useIntakeRecord('rec-ok'), { wrapper: createWrapper() })
    await waitFor(() => expect(result.current.status).toBe('ok'))
  })
})
