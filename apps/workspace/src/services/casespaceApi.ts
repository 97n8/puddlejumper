// ── CaseSpace API Service ────────────────────────────────────────────────
//
// Wraps the PuddleJumper /api/v1/casespaces endpoints.
// All data lives on the server — consistent across browsers and shared
// between workspace members.
//
import { CaseSpace } from '@/lib/types'
import { pjBase } from '@/services/pjBase'

const PJ = pjBase
const caseApiBase = (() => {
  const configured = (import.meta.env.VITE_CASE_API_URL as string | undefined ?? '').replace(/\/$/, '')
  if (configured) return configured
  return import.meta.env.MODE === 'test' ? '' : 'http://localhost:3003'
})()

const CSRF_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])

export class CaseSpaceApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message)
    this.name = 'CaseSpaceApiError'
  }
}

export type CaseSpaceResolutionOutcome = 'unauthenticated' | 'not_found'

function caseApiUrl(path: string): string {
  const normalized = path.startsWith('/') ? path : `/${path}`
  return `${caseApiBase}${normalized}`
}

async function readErrorMessage(res: Response, fallback: string): Promise<string> {
  const raw = await res.text().catch(() => '')
  if (!raw) return fallback

  try {
    const parsed = JSON.parse(raw) as { error?: string; message?: string }
    return parsed.message ?? parsed.error ?? raw
  } catch {
    return raw
  }
}

let _refreshing: Promise<boolean> | null = null
async function tryRefresh(): Promise<boolean> {
  if (_refreshing) return _refreshing
  _refreshing = fetch(`${PJ}/api/refresh`, {
    method: 'POST', credentials: 'include',
    headers: { 'x-puddlejumper-request': 'true' },
  }).then(r => r.ok).catch(() => false).finally(() => { _refreshing = null })
  return _refreshing
}

async function csApiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const method = (init.method ?? 'GET').toUpperCase()
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(init.headers as Record<string, string> ?? {}),
  }
  if (CSRF_METHODS.has(method)) headers['x-puddlejumper-request'] = 'true'
  const opts = { ...init, credentials: 'include' as RequestCredentials, headers }
  const res = await fetch(`${PJ}${path}`, opts)
  if (res.status === 401) {
    const ok = await tryRefresh()
    if (ok) return fetch(`${PJ}${path}`, opts)
  }
  return res
}

// Convert server row → CaseSpace type used by Workspace
function rowToCs(row: Record<string, unknown>): CaseSpace {
  return {
    id: row.id as string,
    name: row.name as string,
    description: row.description as string | undefined,
    color: row.color as string | undefined,
    icon: row.icon as string | undefined,
    type: row.type as CaseSpace['type'],
    town: row.town as string | undefined,
    vaultModuleIds: row.vault_module_ids as string[] | undefined,
    visibility: row.visibility as CaseSpace['visibility'],
    members: row.members as string[],
    connectionIds: row.connection_ids as string[],
    auditEnabled: row.audit_enabled as boolean | undefined,
    retentionEnabled: row.retention_enabled as boolean | undefined,
    fileCount: (row.file_count as number) ?? 0,
    folderCount: (row.folder_count as number) ?? 0,
    templateCount: (row.template_count as number) ?? 0,
    createdAt: row.created_at as number,
    lastAccessed: row.last_accessed as number | undefined,
  }
}

export async function listCaseSpaces(): Promise<CaseSpace[]> {
  const res = await csApiFetch('/api/v1/casespaces')
  if (!res.ok) {
    throw new CaseSpaceApiError(
      res.status,
      await readErrorMessage(res, `listCaseSpaces failed (${res.status})`),
    )
  }
  const data = await res.json()
  return (data.casespaces ?? []).map(rowToCs)
}

export async function createCaseSpace(cs: CaseSpace): Promise<CaseSpace> {
  const res = await csApiFetch('/api/v1/casespaces', {
    method: 'POST',
    body: JSON.stringify({
      id: cs.id,
      name: cs.name,
      description: cs.description,
      color: cs.color,
      icon: cs.icon,
      type: cs.type,
      town: cs.town,
      vaultModuleIds: cs.vaultModuleIds,
      visibility: cs.visibility ?? 'organization',
      members: cs.members ?? [],
      connectionIds: cs.connectionIds ?? [],
      auditEnabled: cs.auditEnabled,
      retentionEnabled: cs.retentionEnabled,
      createdAt: cs.createdAt,
    }),
  })
  if (!res.ok) {
    throw new CaseSpaceApiError(
      res.status,
      await readErrorMessage(res, `createCaseSpace failed (${res.status})`),
    )
  }
  const data = await res.json()
  return rowToCs(data.casespace)
}

export async function updateCaseSpace(id: string, updates: Partial<CaseSpace>): Promise<CaseSpace> {
  const body: Record<string, unknown> = {}
  if (updates.name !== undefined) body.name = updates.name
  if (updates.description !== undefined) body.description = updates.description
  if (updates.color !== undefined) body.color = updates.color
  if (updates.icon !== undefined) body.icon = updates.icon
  if (updates.type !== undefined) body.type = updates.type
  if (updates.town !== undefined) body.town = updates.town
  if (updates.vaultModuleIds !== undefined) body.vaultModuleIds = updates.vaultModuleIds
  if (updates.visibility !== undefined) body.visibility = updates.visibility
  if (updates.members !== undefined) body.members = updates.members
  if (updates.connectionIds !== undefined) body.connectionIds = updates.connectionIds
  if (updates.auditEnabled !== undefined) body.auditEnabled = updates.auditEnabled
  if (updates.retentionEnabled !== undefined) body.retentionEnabled = updates.retentionEnabled
  if (updates.lastAccessed !== undefined) body.lastAccessed = updates.lastAccessed
  if (updates.fileCount !== undefined) body.fileCount = updates.fileCount
  if (updates.folderCount !== undefined) body.folderCount = updates.folderCount
  if (updates.templateCount !== undefined) body.templateCount = updates.templateCount
  const res = await csApiFetch(`/api/v1/casespaces/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    throw new CaseSpaceApiError(
      res.status,
      await readErrorMessage(res, `updateCaseSpace failed (${res.status})`),
    )
  }
  const data = await res.json()
  return rowToCs(data.casespace)
}

export async function deleteCaseSpace(id: string): Promise<{ ok: boolean; status: number }> {
  const res = await csApiFetch(`/api/v1/casespaces/${encodeURIComponent(id)}`, { method: 'DELETE' })
  return { ok: res.ok, status: res.status }
}

export async function logCaseSpaceResolutionFailure({
  requestedId,
  outcome,
  requestScope,
  actor,
}: {
  requestedId: string
  outcome: CaseSpaceResolutionOutcome
  requestScope?: string | null
  actor?: string | null
}) {
  const res = await fetch(caseApiUrl('/api/v1/audit/casespace-resolution'), {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      'x-workspace-request': '1',
    },
    body: JSON.stringify({
      requested_id: requestedId,
      outcome,
      request_scope: requestScope ?? null,
      actor: actor ?? null,
    }),
  })

  if (!res.ok) {
    throw new CaseSpaceApiError(
      res.status,
      await readErrorMessage(res, `logCaseSpaceResolutionFailure failed (${res.status})`),
    )
  }
}
