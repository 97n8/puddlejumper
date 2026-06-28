/**
 * Shared PuddleJumper infrastructure: fetch wrapper + proxy client.
 * Imported by pjApi.ts and domain modules.
 */

import { pjBase } from '@/services/pjBase'
export const PJ = pjBase

const CSRF_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])

export class PJProxyError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly provider: string,
  ) {
    super(message)
    this.name = 'PJProxyError'
  }
}

const DEFAULT_TIMEOUT_MS = 15_000
const REFRESH_TIMEOUT_MS = 10_000

// Singleton refresh promise so concurrent 401s don't fan out into N parallel
// refresh calls. The fetch is bounded by AbortSignal.timeout, and the singleton
// is always cleared in `.finally()` — even on timeout/abort — so a hang on the
// refresh endpoint cannot permanently block subsequent retries.
let _refreshing: Promise<boolean> | null = null
async function tryRefresh(): Promise<boolean> {
  if (_refreshing) return _refreshing
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), REFRESH_TIMEOUT_MS)
  _refreshing = fetch(`${PJ}/api/refresh`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'x-puddlejumper-request': 'true' },
    signal: controller.signal,
  })
    .then(r => r.ok)
    .catch(() => false)
    .finally(() => {
      clearTimeout(timer)
      _refreshing = null
    })
  return _refreshing
}

export async function pjFetch(url: string, init: RequestInit = {}): Promise<Response> {
  const method = (init.method ?? 'GET').toUpperCase()
  const headers = new Headers(init.headers as HeadersInit | undefined)
  if (CSRF_METHODS.has(method)) headers.set('x-puddlejumper-request', 'true')
  // Apply default timeout unless the caller already supplied a signal
  const signal = init.signal ?? AbortSignal.timeout(DEFAULT_TIMEOUT_MS)
  const opts = { ...init, credentials: 'include' as RequestCredentials, headers, signal }
  const res = await fetch(url, opts)
  if (res.status === 401) {
    const ok = await tryRefresh()
    if (ok) return fetch(url, { ...opts, signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS) })
  }
  return res
}

export class PJProxyClient {
  constructor(private readonly prefix: string, private readonly toolId?: string) {}

  /** Returns a new client instance that sends x-pj-tool on every request.
   *  Use this in each tool panel so consent can be checked per-provider per-tool. */
  forTool(toolId: string): PJProxyClient {
    return new PJProxyClient(this.prefix, toolId)
  }

  private async request(method: string, path: string, body?: unknown): Promise<Response> {
    const cleanPath = path.startsWith('/') ? path.slice(1) : path
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    }
    if (this.toolId) headers['x-pj-tool'] = this.toolId
    const res = await pjFetch(`${PJ}/api/${this.prefix}/${cleanPath}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    })
    return res
  }

  async get<T = unknown>(path: string): Promise<T> {
    const res = await this.request('GET', path)
    if (!res.ok) { const errText = await res.text(); throw new PJProxyError(`${this.prefix} proxy error ${res.status}: ${errText}`, res.status, this.prefix) }
    if (res.status === 204 || res.headers.get('content-length') === '0') return null as T
    return res.json() as Promise<T>
  }

  async post<T = unknown>(path: string, body: unknown): Promise<T> {
    const res = await this.request('POST', path, body)
    if (!res.ok) { const errText = await res.text(); throw new PJProxyError(`${this.prefix} proxy error ${res.status}: ${errText}`, res.status, this.prefix) }
    if (res.status === 204 || res.status === 202 || res.headers.get('content-length') === '0') return null as T
    return res.json() as Promise<T>
  }

  /** Send a POST with a raw (non-JSON) body and custom Content-Type header. */
  async postRaw<T = unknown>(path: string, body: string, contentType: string): Promise<T> {
    const cleanPath = path.startsWith('/') ? path.slice(1) : path
    const headers: Record<string, string> = { 'Content-Type': contentType }
    if (this.toolId) headers['x-pj-tool'] = this.toolId
    const res = await pjFetch(`${PJ}/api/${this.prefix}/${cleanPath}`, {
      method: 'POST',
      headers,
      body,
      credentials: 'include',
    })
    if (!res.ok) { const errText = await res.text(); throw new PJProxyError(`${this.prefix} proxy error ${res.status}: ${errText}`, res.status, this.prefix) }
    if (res.status === 204 || res.status === 202 || res.headers.get('content-length') === '0') return null as T
    return res.json() as Promise<T>
  }

  async patch<T = unknown>(path: string, body: unknown): Promise<T> {
    const res = await this.request('PATCH', path, body)
    if (!res.ok) { const errText = await res.text(); throw new PJProxyError(`${this.prefix} proxy error ${res.status}: ${errText}`, res.status, this.prefix) }
    if (res.status === 204 || res.headers.get('content-length') === '0') return null as T
    return res.json() as Promise<T>
  }

  async put<T = unknown>(path: string, body: unknown): Promise<T> {
    const res = await this.request('PUT', path, body)
    if (!res.ok) { const errText = await res.text(); throw new PJProxyError(`${this.prefix} proxy error ${res.status}: ${errText}`, res.status, this.prefix) }
    if (res.status === 204 || res.headers.get('content-length') === '0') return null as T
    return res.json() as Promise<T>
  }

  async delete(path: string): Promise<void> {
    const res = await this.request('DELETE', path)
    if (!res.ok) { const errText = await res.text(); throw new PJProxyError(`${this.prefix} proxy error ${res.status}: ${errText}`, res.status, this.prefix) }
  }

  /** Raw fetch — use when you need the Response object directly (e.g. binary downloads) */
  raw(path: string, init?: RequestInit): Promise<Response> {
    const cleanPath = path.startsWith('/') ? path.slice(1) : path
    const headers = new Headers((init?.headers as HeadersInit | undefined) ?? {})
    if (this.toolId) headers.set('x-pj-tool', this.toolId)
    return pjFetch(`${PJ}/api/${this.prefix}/${cleanPath}`, {
      ...init,
      headers,
    })
  }
}
