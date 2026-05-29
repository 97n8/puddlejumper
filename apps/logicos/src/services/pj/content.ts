import { pjFetch, PJ } from './_base'
import type { CaseTask, VaultClassification, VaultDoc, VaultDocFull, VaultEvent, VaultSignature, VaultStatus, VaultVersion } from './types'

export const contentDomain = {
// ── Environment Provisioner ──────────────────────────────────────────────

provision: {
  create: (body: {
    environment: string
    providers: ('google' | 'microsoft')[]
  }): Promise<{
    google?: { rootId: string; rootLink: string; folders: { name: string; id: string; link: string }[] } | { error: string }
    microsoft?: { rootId: string; driveId: string; rootLink: string; folders: { name: string; id: string; link: string }[] } | { error: string }
    errors?: string[]
  }> =>
    pjFetch(`${PJ}/api/cloud-provision`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }).then(r => r.json()),

  share: (body: {
    provider: 'google' | 'microsoft'
    folderId: string
    driveId?: string
    email: string
    role: 'reader' | 'writer' | 'commenter'
  }): Promise<{ ok: boolean; permissionId?: string; error?: string }> =>
    pjFetch(`${PJ}/api/cloud-provision/share`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }).then(r => r.json()),

  link: (body: {
    provider: 'google' | 'microsoft'
    folderId: string
    driveId?: string
  }): Promise<{ link: string; error?: string }> =>
    pjFetch(`${PJ}/api/cloud-provision/link`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }).then(r => r.json()),

  automations: (body: {
    environment: string
    selected?: string[]
  }): Promise<{
    automations: Array<{
      id: string; name: string; description: string
      triggerType: string; actionType: string; enabled: boolean; createdAt: string
    }>
    total?: number
  }> =>
    pjFetch(`${PJ}/api/cloud-provision/automations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }).then(r => r.json()),

  turnover: (body: {
    departing: string
    successor: string
    providers: ('google' | 'microsoft')[]
    environment?: string
    googleFolderId?: string
    microsoftFolderId?: string
    microsoftDriveId?: string
  }): Promise<{
    results: Record<string, { ok?: boolean; error?: string; revokedPermId?: string | null; successorPermId?: string | null }>
    checklist: { title: string; departing: string; successor: string; date: string; items: string[] }
  }> =>
    pjFetch(`${PJ}/api/cloud-provision/turnover`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }).then(r => r.json()),

  report: (environment: string): Promise<{
    generatedAt: string
    environment: string
    period: { start: string; end: string }
    prr?: { total: number; open: number; overdue: number; statute: string; error?: string }
    deadlines?: { overdue: number; upcoming: number; error?: string }
    automations?: { total: number; enabled: number; items: unknown[] }
    summary: string
  }> =>
    pjFetch(`${PJ}/api/cloud-provision/report?environment=${encodeURIComponent(environment)}`, {
      credentials: 'include',
    }).then(r => r.json()),
},

// ── Vault: server-side document + file storage ───────────────────────────

docs: {
  list: (): Promise<{ documents: VaultDoc[] }> =>
    pjFetch(`${PJ}/api/documents`, { credentials: 'include' }).then(r => r.json()),

  get: (id: string): Promise<VaultDocFull> =>
    pjFetch(`${PJ}/api/documents/${id}`, { credentials: 'include' }).then(r => r.json()),

  create: (body: { name: string; html?: string; css?: string; pageSize?: string }): Promise<VaultDoc> =>
    pjFetch(`${PJ}/api/documents`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }).then(r => r.json()),

  update: (id: string, body: { name?: string; html?: string; css?: string; pageSize?: string; userName?: string }): Promise<{ ok: boolean; updated_at: number }> =>
    pjFetch(`${PJ}/api/documents/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }).then(r => r.json()),

  delete: (id: string): Promise<{ ok: boolean }> =>
    pjFetch(`${PJ}/api/documents/${id}`, { method: 'DELETE' }).then(r => r.json()),

  setStatus: (id: string, status: VaultStatus, userName: string): Promise<{ ok: boolean; status: VaultStatus }> =>
    pjFetch(`${PJ}/api/documents/${id}/status`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, userName }),
    }).then(r => r.json()),

  classify: (id: string, classification: VaultClassification, userName: string): Promise<{ ok: boolean; classification: VaultClassification }> =>
    pjFetch(`${PJ}/api/documents/${id}/classify`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ classification, userName }),
    }).then(r => r.json()),

  sign: (id: string, userName: string, comment: string): Promise<VaultSignature> =>
    pjFetch(`${PJ}/api/documents/${id}/sign`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userName, comment }),
    }).then(r => r.json()),

  getSignatures: (id: string): Promise<{ signatures: VaultSignature[] }> =>
    pjFetch(`${PJ}/api/documents/${id}/signatures`, { credentials: 'include' }).then(r => r.json()),

  getAudit: (id: string): Promise<{ events: VaultEvent[]; signatures: VaultSignature[] }> =>
    pjFetch(`${PJ}/api/documents/${id}/audit`, { credentials: 'include' }).then(r => r.json()),

  getVersions: (id: string): Promise<{ versions: VaultVersion[] }> =>
    pjFetch(`${PJ}/api/documents/${id}/versions`, { credentials: 'include' }).then(r => r.json()),

  getVersion: (id: string, versionId: string): Promise<VaultVersion & { html: string; css: string }> =>
    pjFetch(`${PJ}/api/documents/${id}/versions/${versionId}`, { credentials: 'include' }).then(r => r.json()),

  /** GET /api/documents/:id/tasks — list case tasks */
  listTasks: (id: string): Promise<{ tasks: CaseTask[] }> =>
    pjFetch(`${PJ}/api/documents/${id}/tasks`, { credentials: 'include' }).then(r => r.json()),

  /** POST /api/documents/:id/tasks — create a task */
  createTask: (id: string, body: { title: string; description?: string; assigned_side: 'A' | 'B'; due_at?: string }): Promise<{ task: CaseTask }> =>
    pjFetch(`${PJ}/api/documents/${id}/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }).then(r => r.json()),

  /** PUT /api/documents/:docId/tasks/:taskId — complete or cancel a task */
  updateTask: (docId: string, taskId: string, body: { status: 'done' | 'cancelled' }): Promise<{ task: CaseTask }> =>
    pjFetch(`${PJ}/api/documents/${docId}/tasks/${taskId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }).then(r => r.json()),
},

}
