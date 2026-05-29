/**
 * Unified PuddleJumper API client.
 *
 * All external provider calls (GitHub, Microsoft, Google) go through
 * PuddleJumper. Tokens never touch the browser — the session cookie
 * carries auth and PJ injects the stored connector token server-side.
 *
 * Usage:
 *   import { pjApi } from '@/services/pjApi'
 *
 *   // GitHub
 *   const repos = await pjApi.github.get('user/repos')
 *
 *   // Microsoft Graph (same paths as graph.microsoft.com/v1.0/*)
 *   const me = await pjApi.microsoft.get('me')
 *   const files = await pjApi.microsoft.get('me/drive/root/children')
 *
 *   // Google APIs (same paths as googleapis.com/*)
 *   const files = await pjApi.google.get('drive/v3/files')
 */

import { PJ, pjFetch, PJProxyClient } from './pj/_base'
export { PJProxyError } from './pj/_base'

export * from './pj/types'
import type { ConnectorStatusResponse, CloudSaveBatchItem, CloudSaveBatchResult, ImportRepoRequest, ImportRepoResult } from './pj/types'

import { contentDomain } from './pj/content'
import { builderDomain } from './pj/builder'
import { governanceDomain } from './pj/governance'
import { bridgeDomain } from './pj/bridge'
import { dataDomain } from './pj/data'

export const pjApi = {
  github: new PJProxyClient('github'),
  microsoft: new PJProxyClient('microsoft'),
  google: new PJProxyClient('google'),

  /** Check connector status for all providers */
  connectors: {
    status: (): Promise<ConnectorStatusResponse> =>
      pjFetch(`${PJ}/api/connectors`, { credentials: 'include' }).then(r => r.json()),
    connect: async (provider: 'github' | 'microsoft' | 'google') => {
      // Use connector-specific OAuth flow — does NOT replace the user session
      const res = await pjFetch(`${PJ}/api/connectors/${provider}/auth/start`, {
        method: 'POST',
        
      })
      if (!res.ok) throw new Error(`Failed to start ${provider} connector auth`)
      const { authUrl } = await res.json()
      if (!authUrl) throw new Error('No authUrl returned')
      window.location.href = authUrl
    },
    disconnect: (provider: 'github' | 'microsoft' | 'google') =>
      pjFetch(`${PJ}/api/connectors/${provider}/disconnect`, {
        method: 'POST',
      }),
    resources: (provider: 'github' | 'microsoft' | 'google', query = '') =>
      pjFetch(`${PJ}/api/connectors/${provider}/resources${query ? `?q=${encodeURIComponent(query)}` : ''}`, {
        
      }).then(r => r.json()),

    /** Fetch the user's per-tool consent settings for all providers. */
    getConsents: () =>
      pjFetch(`${PJ}/api/connectors/consent`, { credentials: 'include' }).then(r => r.json()),

    /** Fetch consent for a single provider. */
    getConsent: (provider: 'github' | 'microsoft' | 'google') =>
      pjFetch(`${PJ}/api/connectors/consent/${provider}`, { credentials: 'include' }).then(r => r.json()),

    /** Update which tools can use a provider. Pass null for unrestricted. */
    setConsent: (provider: 'github' | 'microsoft' | 'google', allowedTools: string[] | null) =>
      pjFetch(`${PJ}/api/connectors/consent/${provider}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ allowedTools }),
      }).then(r => r.json()),
  },

  identity: {
    token: async (): Promise<{ token_type: 'Bearer'; token: string; expires_in: number; expires_at: string; correlationId?: string }> => {
      const res = await pjFetch(`${PJ}/api/pj/identity-token`, { credentials: 'include' })
      const data = await res.json().catch(() => ({})) as { error?: string; token_type?: 'Bearer'; token?: string; expires_in?: number; expires_at?: string; correlationId?: string }
      if (!res.ok || !data.token) {
        throw new Error(data.error ?? 'Could not mint a PJ identity token')
      }
      return {
        token_type: data.token_type ?? 'Bearer',
        token: data.token,
        expires_in: data.expires_in ?? 900,
        expires_at: data.expires_at ?? new Date(Date.now() + 900_000).toISOString(),
        correlationId: data.correlationId,
      }
    },
  },

  /** Axis AI chat — key management + chat completions */
  axis: {
    getKeyStatus: () =>
      pjFetch(`${PJ}/api/v1/axis/keys`, { credentials: 'include' }).then(r => r.json()),
    saveKeys: (keys: { openai?: string; anthropic?: string; tavily?: string }) =>
      pjFetch(`${PJ}/api/v1/axis/keys`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(keys),
        credentials: 'include',
      }).then(r => r.json()),
    chat: (model: 'claude-opus' | 'gpt-4.1', messages: { role: 'user' | 'assistant' | 'system'; content: string }[]) =>
      pjFetch(`${PJ}/api/v1/axis/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, messages }),
        credentials: 'include',
      }).then(r => r.json()),
    search: (query: string) =>
      pjFetch(`${PJ}/api/v1/axis/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query }),
        credentials: 'include',
      }).then(r => r.json()),
  },

  cloudSave: async (opts: {
    provider: 'google' | 'microsoft' | 'github'
    filename: string
    contentBase64: string
    mimeType?: string
    folderId?: string
    driveId?: string
    githubRepo?: string
    githubPath?: string
    githubMessage?: string
  }): Promise<{ fileId: string; url: string }> => {
    const res = await pjFetch(`${PJ}/api/cloud-save`, {
      method: 'POST',
      
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(opts),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({})) as { error?: string }
      throw new Error(err.error ?? 'Cloud save failed')
    }
    return res.json()
  },

  cloudSaveBatch: (items: CloudSaveBatchItem[]): Promise<{ results: CloudSaveBatchResult[] }> =>
    pjFetch(`${PJ}/api/cloud-save/batch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items }),
    }).then(r => r.json()),

  importRepo: (body: ImportRepoRequest): Promise<ImportRepoResult> =>
    pjFetch(`${PJ}/api/cloud-save/import-repo`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }).then(r => r.json()),

  ...contentDomain,
  ...builderDomain,
  ...governanceDomain,
  ...bridgeDomain,
  ...dataDomain,
}
