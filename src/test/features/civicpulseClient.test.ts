import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CivicPulseApiError, civicpulseClient } from '@/features/civicpulse/api/civicpulseClient'

const mockFetch = vi.fn()

function makeResponse(body: unknown, status = 200) {
  const payload = typeof body === 'string' ? body : JSON.stringify(body)
  return new Response(payload, {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('civicpulseClient', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', mockFetch)
    mockFetch.mockReset()
  })

  it('preserves a true successful empty array', async () => {
    mockFetch.mockResolvedValueOnce(makeResponse({ data: [] }))

    await expect(civicpulseClient.getPendingSummaries()).resolves.toEqual([])
  })

  it('does not collapse 401 into an empty array', async () => {
    mockFetch.mockResolvedValueOnce(makeResponse({ error: 'Unauthorized' }, 401))

    await expect(civicpulseClient.getPendingSummaries()).rejects.toMatchObject({
      name: 'CivicPulseApiError',
      status: 401,
    } satisfies Partial<CivicPulseApiError>)
  })

  it('does not collapse 403 into an empty array', async () => {
    mockFetch.mockResolvedValueOnce(makeResponse({ error: 'Forbidden' }, 403))

    await expect(civicpulseClient.getBackstopItems()).rejects.toMatchObject({
      name: 'CivicPulseApiError',
      status: 403,
    } satisfies Partial<CivicPulseApiError>)
  })

  it('does not collapse 500 or network failures into an empty array', async () => {
    mockFetch.mockResolvedValueOnce(makeResponse({ error: 'Server failed' }, 500))
    await expect(civicpulseClient.getPublicationLog()).rejects.toMatchObject({
      name: 'CivicPulseApiError',
      status: 500,
    } satisfies Partial<CivicPulseApiError>)

    mockFetch.mockRejectedValueOnce(new Error('Network offline'))
    await expect(civicpulseClient.getFeed()).rejects.toThrow('Network offline')
  })

  it('does not collapse config errors into blank config', async () => {
    mockFetch.mockResolvedValueOnce(makeResponse({ error: 'Unauthorized' }, 401))
    await expect(civicpulseClient.getMunicipalityConfig()).rejects.toMatchObject({
      name: 'CivicPulseApiError',
      status: 401,
    } satisfies Partial<CivicPulseApiError>)

    mockFetch.mockResolvedValueOnce(makeResponse({ data: undefined }))
    await expect(civicpulseClient.getMunicipalityConfig()).rejects.toThrow(
      'CivicPulse municipality config missing from response.',
    )
  })
})
