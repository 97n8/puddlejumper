import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// pjApi uses import.meta.env.VITE_PJ_API_URL — it resolves to '' in test env.
// All constructed URLs will be of the form /api/{prefix}/{path}.
import { pjApi } from '@/services/pjApi'

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

function makeResponse(body: unknown, status = 200, headers: Record<string, string> = {}) {
  const h = new Headers({ 'Content-Type': 'application/json', ...headers })
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: h,
    json: vi.fn().mockResolvedValue(body),
    text: vi.fn().mockResolvedValue(typeof body === 'string' ? body : JSON.stringify(body)),
  } as unknown as Response
}

describe('pjApi — low-level fetch behaviour', () => {
  beforeEach(() => { mockFetch.mockReset() })
  afterEach(() => { vi.clearAllMocks() })

  it('GET request sends credentials: include', async () => {
    mockFetch.mockResolvedValue(makeResponse({ ok: true }))
    await pjApi.github.get('user/repos')
    const [, init] = mockFetch.mock.calls[0]
    expect((init as RequestInit).credentials).toBe('include')
  })

  it('GET does NOT add x-puddlejumper-request header (CSRF header only on mutating methods)', async () => {
    mockFetch.mockResolvedValue(makeResponse({}))
    await pjApi.github.get('user')
    const [, init] = mockFetch.mock.calls[0]
    const headers = new Headers((init as RequestInit).headers as HeadersInit)
    expect(headers.has('x-puddlejumper-request')).toBe(false)
  })

  it('POST request adds the CSRF header', async () => {
    mockFetch.mockResolvedValue(makeResponse({}))
    await pjApi.microsoft.post('me/sendMail', { message: 'hi' })
    const [, init] = mockFetch.mock.calls[0]
    const headers = new Headers((init as RequestInit).headers as HeadersInit)
    expect(headers.get('x-puddlejumper-request')).toBe('true')
  })

  it('non-ok response throws with status in message', async () => {
    mockFetch.mockResolvedValue(makeResponse('Not Found', 404))
    await expect(pjApi.github.get('nonexistent')).rejects.toThrow('404')
  })

  it('500 response throws', async () => {
    mockFetch.mockResolvedValue(makeResponse('Server Error', 500))
    await expect(pjApi.google.get('drive/v3/files')).rejects.toThrow('500')
  })
})

describe('pjApi — 401 token-refresh retry', () => {
  beforeEach(() => { mockFetch.mockReset() })

  it('retries the original request after a successful refresh', async () => {
    const refreshResp = makeResponse({ ok: true }, 200)
    const retryResp = makeResponse({ data: 'success' }, 200)

    mockFetch
      .mockResolvedValueOnce(makeResponse('Unauthorized', 401))  // original fails
      .mockResolvedValueOnce(refreshResp)                         // /api/refresh succeeds
      .mockResolvedValueOnce(retryResp)                           // retry succeeds

    const result = await pjApi.github.get('user/repos')
    expect(result).toEqual({ data: 'success' })
    expect(mockFetch).toHaveBeenCalledTimes(3)
  })

  it('returns the 401 response when refresh itself fails', async () => {
    mockFetch
      .mockResolvedValueOnce(makeResponse('Unauthorized', 401))
      .mockResolvedValueOnce(makeResponse('Refresh failed', 401)) // refresh fails
      // After failed refresh, the code returns the retry response
      .mockResolvedValueOnce(makeResponse('Still unauthorized', 401))

    await expect(pjApi.github.get('user/repos')).rejects.toThrow('401')
  })
})

describe('pjApi — proxy URL routing', () => {
  beforeEach(() => { mockFetch.mockReset() })

  it('pjApi.github.get() hits /api/github/{path}', async () => {
    mockFetch.mockResolvedValue(makeResponse([]))
    await pjApi.github.get('user/repos')
    const [url] = mockFetch.mock.calls[0]
    expect(url).toMatch(/\/api\/github\/user\/repos$/)
  })

  it('pjApi.microsoft.get() hits /api/microsoft/{path}', async () => {
    mockFetch.mockResolvedValue(makeResponse({ id: '123' }))
    await pjApi.microsoft.get('me')
    const [url] = mockFetch.mock.calls[0]
    expect(url).toMatch(/\/api\/microsoft\/me$/)
  })

  it('pjApi.google.get() hits /api/google/{path}', async () => {
    mockFetch.mockResolvedValue(makeResponse({ files: [] }))
    await pjApi.google.get('drive/v3/files')
    const [url] = mockFetch.mock.calls[0]
    expect(url).toMatch(/\/api\/google\/drive\/v3\/files$/)
  })

  it('strips leading slash from path', async () => {
    mockFetch.mockResolvedValue(makeResponse({}))
    await pjApi.github.get('/user/repos')
    const [url] = mockFetch.mock.calls[0]
    expect(url).not.toMatch(/\/api\/github\/\//)
    expect(url).toMatch(/\/api\/github\/user\/repos$/)
  })
})

describe('pjApi — health endpoint', () => {
  beforeEach(() => { mockFetch.mockReset() })

  it('system.health() hits /v1/health', async () => {
    const healthResp = {
      status: 'ok', timestamp: '2024-01-01T00:00:00Z',
      version: '1.0', region: 'us', uptime_seconds: 1000,
      subsystems: {}, alerts: [],
    }
    mockFetch.mockResolvedValue(makeResponse(healthResp))
    const result = await pjApi.system.health()
    const [url] = mockFetch.mock.calls[0]
    expect(url).toMatch(/\/v1\/health$/)
    expect(result).toEqual(healthResp)
  })
})

describe('pjApi — PATCH and DELETE', () => {
  beforeEach(() => { mockFetch.mockReset() })

  it('PATCH sends method PATCH and JSON body', async () => {
    mockFetch.mockResolvedValue(makeResponse({ updated: true }))
    await pjApi.microsoft.patch('me/drive/items/123', { name: 'newname' })
    const [url, init] = mockFetch.mock.calls[0]
    expect(url).toMatch(/\/api\/microsoft\/me\/drive\/items\/123$/)
    expect((init as RequestInit).method).toBe('PATCH')
    expect((init as RequestInit).body).toContain('"name"')
  })

  it('DELETE sends method DELETE', async () => {
    mockFetch.mockResolvedValue(makeResponse(null, 204))
    await pjApi.github.delete('repos/owner/repo')
    const [url, init] = mockFetch.mock.calls[0]
    expect(url).toMatch(/\/api\/github\/repos\/owner\/repo$/)
    expect((init as RequestInit).method).toBe('DELETE')
  })

  it('PUT sends method PUT and JSON body', async () => {
    mockFetch.mockResolvedValue(makeResponse({ ok: true }))
    await pjApi.google.put('calendar/v3/events/abc', { summary: 'updated' })
    const [, init] = mockFetch.mock.calls[0]
    expect((init as RequestInit).method).toBe('PUT')
    expect((init as RequestInit).body).toContain('"summary"')
  })
})

describe('pjApi — postRaw', () => {
  beforeEach(() => { mockFetch.mockReset() })

  it('postRaw sends raw body without JSON-stringifying', async () => {
    mockFetch.mockResolvedValue(makeResponse({ id: 'page-123' }))
    const htmlBody = '<html><body>Hello</body></html>'
    await pjApi.microsoft.postRaw('me/onenote/pages', htmlBody, 'text/html')
    const [, init] = mockFetch.mock.calls[0]
    expect((init as RequestInit).body).toBe(htmlBody)
  })

  it('postRaw sets custom content-type header', async () => {
    mockFetch.mockResolvedValue(makeResponse({}))
    await pjApi.microsoft.postRaw('endpoint', 'data', 'application/octet-stream')
    const [, init] = mockFetch.mock.calls[0]
    const headers = new Headers((init as RequestInit).headers as HeadersInit)
    expect(headers.get('Content-Type')).toBe('application/octet-stream')
  })
})

describe('pjApi — connectors', () => {
  beforeEach(() => { mockFetch.mockReset() })

  it('connectors.status() hits /api/connectors', async () => {
    mockFetch.mockResolvedValue(makeResponse({ connectors: {} }))
    await pjApi.connectors.status()
    const [url] = mockFetch.mock.calls[0]
    expect(url).toMatch(/\/api\/connectors$/)
  })

  it('connectors.disconnect() hits /api/connectors/{provider}/disconnect', async () => {
    mockFetch.mockResolvedValue(makeResponse({ ok: true }))
    await pjApi.connectors.disconnect('google')
    const [url, init] = mockFetch.mock.calls[0]
    expect(url).toMatch(/\/api\/connectors\/google\/disconnect$/)
    expect((init as RequestInit).method).toBe('POST')
  })
})

describe('pjApi — error paths', () => {
  beforeEach(() => { mockFetch.mockReset() })

  it('throws on 500 server error', async () => {
    mockFetch.mockResolvedValue(makeResponse('Internal Server Error', 500))
    await expect(pjApi.github.get('user')).rejects.toThrow('500')
  })

  it('throws on 403 forbidden', async () => {
    mockFetch.mockResolvedValue(makeResponse('Forbidden', 403))
    await expect(pjApi.microsoft.get('me')).rejects.toThrow('403')
  })

  it('throws on 404 not found', async () => {
    mockFetch.mockResolvedValue(makeResponse('Not Found', 404))
    await expect(pjApi.google.get('drive/v3/files/missing')).rejects.toThrow('404')
  })

  it('POST throws on non-ok response', async () => {
    mockFetch.mockResolvedValue(makeResponse('Bad Request', 400))
    await expect(pjApi.github.post('repos', { name: 'test' })).rejects.toThrow('400')
  })

  it('PATCH throws on non-ok response', async () => {
    mockFetch.mockResolvedValue(makeResponse('Conflict', 409))
    await expect(pjApi.microsoft.patch('me/drive/items/abc', {})).rejects.toThrow('409')
  })

  it('returns null on 204 No Content from GET', async () => {
    mockFetch.mockResolvedValue(makeResponse(null, 204))
    const result = await pjApi.github.get('repos/owner/repo/contents/empty')
    expect(result).toBeNull()
  })

  it('returns null on 204 No Content from POST', async () => {
    mockFetch.mockResolvedValue(makeResponse(null, 204))
    const result = await pjApi.microsoft.post('me/sendMail', {})
    expect(result).toBeNull()
  })

  it('returns null on content-length: 0 header', async () => {
    mockFetch.mockResolvedValue(makeResponse(null, 200, { 'content-length': '0' }))
    const result = await pjApi.github.get('user/repos')
    expect(result).toBeNull()
  })
})

describe('pjApi — 401 refresh retry', () => {
  beforeEach(() => { mockFetch.mockReset() })

  it('retries request after successful refresh on 401', async () => {
    // First call: 401 auth failure
    // Second call: refresh succeeds
    // Third call: retry succeeds
    mockFetch
      .mockResolvedValueOnce(makeResponse('Unauthorized', 401))
      .mockResolvedValueOnce(makeResponse({ ok: true }))   // refresh
      .mockResolvedValueOnce(makeResponse({ user: 'me' })) // retry
    const result = await pjApi.github.get('user')
    expect(result).toEqual({ user: 'me' })
    expect(mockFetch).toHaveBeenCalledTimes(3)
  })

  it('does not retry after failed refresh on 401', async () => {
    // First call: 401
    // Refresh: fails (not ok)
    // No retry expected; should return the 401 response
    mockFetch
      .mockResolvedValueOnce(makeResponse('Unauthorized', 401))
      .mockResolvedValueOnce(makeResponse('Refresh failed', 401)) // refresh fails
    // pjFetch returns the last response without throwing for proxy client
    // The PJProxyClient checks !res.ok and throws
    await expect(pjApi.github.get('user')).rejects.toThrow('401')
  })
})

describe('pjApi — proxy URL construction', () => {
  beforeEach(() => { mockFetch.mockReset() })

  it('strips leading slash from path', async () => {
    mockFetch.mockResolvedValue(makeResponse({}))
    await pjApi.github.get('/user/repos')
    const [url] = mockFetch.mock.calls[0]
    expect(url).not.toMatch(/\/api\/github\/\/user/)
    expect(url).toMatch(/\/api\/github\/user\/repos$/)
  })

  it('github prefix routes to /api/github/', async () => {
    mockFetch.mockResolvedValue(makeResponse([]))
    await pjApi.github.get('user/repos')
    const [url] = mockFetch.mock.calls[0]
    expect(url).toMatch(/\/api\/github\/user\/repos/)
  })

  it('microsoft prefix routes to /api/microsoft/', async () => {
    mockFetch.mockResolvedValue(makeResponse({}))
    await pjApi.microsoft.get('me')
    const [url] = mockFetch.mock.calls[0]
    expect(url).toMatch(/\/api\/microsoft\/me/)
  })

  it('google prefix routes to /api/google/', async () => {
    mockFetch.mockResolvedValue(makeResponse({}))
    await pjApi.google.get('drive/v3/files')
    const [url] = mockFetch.mock.calls[0]
    expect(url).toMatch(/\/api\/google\/drive\/v3\/files/)
  })
})

describe('pjApi — request timeout', () => {
  beforeEach(() => { mockFetch.mockReset() })

  it('attaches an AbortSignal to outgoing requests', async () => {
    mockFetch.mockResolvedValue(makeResponse({ ok: true }))
    await pjApi.github.get('user/repos')
    const [, init] = mockFetch.mock.calls[0]
    expect((init as RequestInit).signal).toBeDefined()
  })

  it('propagates AbortError when signal fires', async () => {
    const err = new DOMException('Timed out', 'TimeoutError')
    mockFetch.mockRejectedValue(err)
    await expect(pjApi.github.get('user/repos')).rejects.toThrow('Timed out')
  })
})
