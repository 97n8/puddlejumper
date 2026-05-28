import { pjFetch, PJ } from './_base'
import type { VaultFile, VaultFileFull } from './types'

export const builderDomain = {
// ── Module Builder: VAULT governance module sessions ─────────────────────

moduleBuilder: {
  createSession: (body: { town: string; selectedModuleIds: string[]; configs: Record<string, unknown> }): Promise<{ id: string; status: string; createdAt: number }> =>
    pjFetch(`${PJ}/api/v1/vault/modules/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }).then(r => r.json()),

  getSession: (id: string): Promise<unknown> =>
    pjFetch(`${PJ}/api/v1/vault/modules/sessions/${id}`, { credentials: 'include' }).then(r => r.json()),

  updateSession: (id: string, body: { selectedModuleIds?: string[]; configs?: Record<string, unknown>; status?: string }): Promise<{ ok: boolean; updatedAt: number }> =>
    pjFetch(`${PJ}/api/v1/vault/modules/sessions/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }).then(r => r.json()),

  activateSession: (id: string): Promise<{ ok: boolean; activatedAt: number }> =>
    pjFetch(`${PJ}/api/v1/vault/modules/sessions/${id}/activate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    }).then(r => r.json()),

  listSessions: (town?: string): Promise<{ sessions: unknown[] }> =>
    pjFetch(`${PJ}/api/v1/vault/modules/sessions${town ? `?town=${encodeURIComponent(town)}` : ''}`, { credentials: 'include' }).then(r => r.json()),
},

vaultFiles: {
  list: (): Promise<{ files: VaultFile[] }> =>
    pjFetch(`${PJ}/api/vault-files`, { credentials: 'include' }).then(r => r.json()),

  get: (id: string): Promise<VaultFileFull> =>
    pjFetch(`${PJ}/api/vault-files/${id}`, { credentials: 'include' }).then(r => r.json()),

  upload: (body: { name: string; mimeType: string; size: number; contentBase64: string }): Promise<VaultFile> =>
    pjFetch(`${PJ}/api/vault-files`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }).then(r => r.json()),

  delete: (id: string): Promise<{ ok: boolean }> =>
    pjFetch(`${PJ}/api/vault-files/${id}`, { method: 'DELETE' }).then(r => r.json()),
},

vault: {
  getRaos: (envId: string) =>
    pjFetch(`${PJ}/api/v1/vault/modules/environments/${encodeURIComponent(envId)}/raos`, { credentials: 'include' }).then(r => r.json()),
  createRao: (envId: string, rao: Record<string, unknown>) =>
    pjFetch(`${PJ}/api/v1/vault/modules/environments/${encodeURIComponent(envId)}/raos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(rao),
    }).then(r => r.json()),
  updateRao: (envId: string, raoId: string, rao: Record<string, unknown>) =>
    pjFetch(`${PJ}/api/v1/vault/modules/environments/${encodeURIComponent(envId)}/raos/${encodeURIComponent(raoId)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(rao),
    }).then(r => r.json()),
  deleteRao: (envId: string, raoId: string) =>
    pjFetch(`${PJ}/api/v1/vault/modules/environments/${encodeURIComponent(envId)}/raos/${encodeURIComponent(raoId)}`, {
      method: 'DELETE',
    }).then(r => r.json()),
  saveRaos: (envId: string, raos: unknown[]) =>
    pjFetch(`${PJ}/api/v1/vault/modules/environments/${encodeURIComponent(envId)}/raos/batch`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ raos }),
    }).then(r => r.json()),
},

/** PuddleJumper PRR (Public Records Request) integration */
prr: {
  intake: (data: {
    tenantId: string
    requester_name?: string
    requester_email?: string
    subject: string
    description?: string
  }) =>
    pjFetch(`${PJ}/api/prr/intake`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }).then(r => r.json()),

  list: (tenantId?: string, status?: string) => {
    const params = new URLSearchParams()
    if (status) params.set('status', status)
    return pjFetch(`${PJ}/api/prr?${params}`, { credentials: 'include' }).then(r => r.json())
  },

  updateStatus: (id: string, toStatus: 'submitted' | 'acknowledged' | 'in_progress' | 'closed') =>
    pjFetch(`${PJ}/api/prr/${encodeURIComponent(id)}/status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to_status: toStatus }),
    }).then(r => r.json()),

  close: (id: string, disposition: string) =>
    pjFetch(`${PJ}/api/prr/${encodeURIComponent(id)}/close`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ disposition }),
    }).then(r => r.json()),
},

/** Animal Control & Dog Licensing  M.G.L. c.140 §§137–174 */
dog: {
  apply: (data: {
    tenantId: string
    ownerName: string
    ownerEmail?: string
    ownerAddress?: string
    ownerPhone?: string
    dogName: string
    dogBreed: string
    dogColor?: string
    dogSex?: 'M' | 'F'
    dogAltered?: boolean
    dogDob?: string
    rabiesCert?: string
    rabiesExp?: string
    veterinarian?: string
    licenseYear?: number
    renewalOf?: string
    feeWaived?: boolean
    assignedTo?: string
  }) =>
    pjFetch(`${PJ}/api/dog/license`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }).then(r => r.json()),

  list: (status?: string) => {
    const p = new URLSearchParams()
    if (status) p.set('status', status)
    return pjFetch(`${PJ}/api/dog/license?${p}`, { credentials: 'include' }).then(r => r.json())
  },

  get: (id: string) =>
    pjFetch(`${PJ}/api/dog/license/${encodeURIComponent(id)}`, { credentials: 'include' }).then(r => r.json()),

  issue: (id: string, notes?: string) =>
    pjFetch(`${PJ}/api/dog/license/${encodeURIComponent(id)}/issue`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notes }),
      credentials: 'include',
    }).then(r => r.json()),

  updateStatus: (id: string, toStatus: 'applied' | 'verified' | 'licensed' | 'expired' | 'revoked', notes?: string) =>
    pjFetch(`${PJ}/api/dog/license/${encodeURIComponent(id)}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ toStatus, notes }),
      credentials: 'include',
    }).then(r => r.json()),

  auditLog: (id: string) =>
    pjFetch(`${PJ}/api/dog/license/${encodeURIComponent(id)}/audit`, { credentials: 'include' }).then(r => r.json()),

  listExpiring: (days = 30) =>
    pjFetch(`${PJ}/api/dog/expiring?days=${days}`, { credentials: 'include' }).then(r => r.json()),

  publicStatus: (publicId: string) =>
    pjFetch(`${PJ}/api/public/dog/${encodeURIComponent(publicId)}`).then(r => r.json()),

  fileBiteReport: (data: {
    licenseId?: string; dogName: string; ownerName?: string
    victimName: string; victimDob?: string; incidentDate: string
    incidentLocation?: string; provoked?: boolean; victimTrespassing?: boolean
    victimUnder7?: boolean; quarantineRequired?: boolean; quarantineStart?: string
    quarantineEnd?: string; boardOfHealthNotified?: boolean; dangerousDogHearing?: boolean
    hearingDate?: string; notes?: string
  }) =>
    pjFetch(`${PJ}/api/dog/bite-report`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
      credentials: 'include',
    }).then(r => r.json()),

  listBiteReports: () =>
    pjFetch(`${PJ}/api/dog/bite-report`, { credentials: 'include' }).then(r => r.json()),

  logAco: (data: { logDate: string; activityType: string; description: string; licenseId?: string; biteReportId?: string }) =>
    pjFetch(`${PJ}/api/dog/aco-log`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
      credentials: 'include',
    }).then(r => r.json()),

  listAcoLog: () =>
    pjFetch(`${PJ}/api/dog/aco-log`, { credentials: 'include' }).then(r => r.json()),
},

/** Auth status — detect which provider the user signed in with */
auth: {
  getStatus: (): Promise<{ authenticated: boolean; provider?: string; userId?: string; tenantId?: string }> =>
    pjFetch(`${PJ}/api/auth/status`, { credentials: 'include' }).then(r => r.json()).catch(() => ({ authenticated: false })),

  /** POST /api/auth/change-password — local user changes their own password */
  changePassword: (currentPassword: string, newPassword: string): Promise<{ ok: boolean; message?: string; error?: string }> =>
    pjFetch(`${PJ}/api/auth/change-password`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentPassword, newPassword }),
    }).then(r => r.json()),
},

// ── Workspace Collaboration ──────────────────────────────────────────────

workspace: {
  /** GET /api/workspace/members — list all members of the current workspace */
  listMembers: (): Promise<{ success: boolean; data: Array<{ id: string; workspace_id: string; user_id: string; role: string; tool_access: string | null; invited_by: string | null; joined_at: string }> }> =>
    pjFetch(`${PJ}/api/workspace/members`, { credentials: 'include' }).then(r => r.json()),

  /** GET /api/workspace/me — current user's workspace role + toolAccess */
  me: (): Promise<{ success: boolean; data: { workspaceId: string; role: string | null; toolAccess: string[] | null } }> =>
    pjFetch(`${PJ}/api/workspace/me`, { credentials: 'include' }).then(r => r.json()),

  /** PATCH /api/workspace/members/:userId — update a member's role (owner only) */
  updateMemberRole: (userId: string, role: 'admin' | 'member' | 'viewer'): Promise<{ success: boolean }> =>
    pjFetch(`${PJ}/api/workspace/members/${encodeURIComponent(userId)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role }),
    }).then(r => r.json()),

  /** PATCH /api/workspace/members/:userId — update a member's tool access (owner only) */
  updateMemberToolAccess: (userId: string, toolAccess: string[] | null): Promise<{ success: boolean }> =>
    pjFetch(`${PJ}/api/workspace/members/${encodeURIComponent(userId)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ toolAccess }),
    }).then(r => r.json()),

  /** DELETE /api/workspace/members/:userId — remove a member */
  removeMember: (userId: string): Promise<{ success: boolean }> =>
    pjFetch(`${PJ}/api/workspace/members/${encodeURIComponent(userId)}`, {
      method: 'DELETE',
    }).then(r => r.json()),

  /** POST /api/workspace/invite — invite a user by email with optional tool access */
  invite: (email: string, role: 'admin' | 'member' | 'viewer', toolAccess?: string[] | null): Promise<{ success: boolean; data?: { id: string; email: string; role: string; token: string; expires_at: string } }> =>
    pjFetch(`${PJ}/api/workspace/invite`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, role, toolAccess: toolAccess ?? null }),
    }).then(r => r.json()),

  /** GET /api/workspace/invitations — list pending invitations */
  listInvitations: (): Promise<{ success: boolean; data: Array<{ id: string; email: string; role: string; invited_by: string; created_at: string; expires_at: string }> }> =>
    pjFetch(`${PJ}/api/workspace/invitations`, { credentials: 'include' }).then(r => r.json()),

  /** DELETE /api/workspace/invitations/:id — revoke a pending invitation */
  revokeInvitation: (id: string): Promise<{ success: boolean }> =>
    pjFetch(`${PJ}/api/workspace/invitations/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    }).then(r => r.json()),

  /** GET /api/invitations/:token — peek at invite details without accepting */
  peekInvitation: (token: string): Promise<{ success: boolean; data?: { email: string; role: string; workspaceName: string; expiresAt: string }; error?: string }> =>
    fetch(`${PJ}/api/invitations/${encodeURIComponent(token)}`).then(r => r.json()),

  /** POST /api/invitations/:token/accept — accept an invitation */
  acceptInvitation: (token: string): Promise<{ success: boolean }> =>
    pjFetch(`${PJ}/api/invitations/${encodeURIComponent(token)}/accept`, {
      method: 'POST',
    }).then(r => r.json()),

  /** GET /api/workspace/usage — workspace tier limits and usage */
  usage: (): Promise<{ success: boolean; data: { plan: string; limits: Record<string, number>; usage: Record<string, number>; at_limit: boolean } }> =>
    pjFetch(`${PJ}/api/workspace/usage`, { credentials: 'include' }).then(r => r.json()),

  /** POST /api/workspace/leave — leave workspace (non-owners) */
  leave: (): Promise<{ success: boolean }> =>
    pjFetch(`${PJ}/api/workspace/leave`, { method: 'POST' }).then(r => r.json()),
},

// ── Approvals ───────────────────────────────────────────────────────────

approvals: {
  /** GET /api/approvals — list approvals (filter by status) */
  list: (status?: string): Promise<unknown[]> => {
    const qs = status ? `?status=${encodeURIComponent(status)}` : ''
    return pjFetch(`${PJ}/api/approvals${qs}`, { credentials: 'include' }).then(r => r.json())
  },

  /** GET /api/approvals/:id */
  get: (id: string): Promise<unknown> =>
    pjFetch(`${PJ}/api/approvals/${encodeURIComponent(id)}`, { credentials: 'include' }).then(r => r.json()),

  /** GET /api/approvals/count/pending */
  countPending: (): Promise<{ count: number }> =>
    pjFetch(`${PJ}/api/approvals/count/pending`, { credentials: 'include' }).then(r => r.json()).catch(() => ({ count: 0 })),

  /** POST /api/approvals/:id/decide */
  decide: (id: string, decision: 'approve' | 'reject', reason?: string): Promise<unknown> =>
    pjFetch(`${PJ}/api/approvals/${encodeURIComponent(id)}/decide`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ decision, reason }),
    }).then(r => r.json()),

  /** POST /api/approvals/:id/dispatch */
  dispatch: (id: string): Promise<unknown> =>
    pjFetch(`${PJ}/api/approvals/${encodeURIComponent(id)}/dispatch`, {
      method: 'POST',
    }).then(r => r.json()),
},

// ── Chain Templates ─────────────────────────────────────────────────────

chainTemplates: {
  list: (): Promise<unknown[]> =>
    pjFetch(`${PJ}/api/chain-templates`, { credentials: 'include' }).then(r => r.json()),
  get: (id: string): Promise<unknown> =>
    pjFetch(`${PJ}/api/chain-templates/${encodeURIComponent(id)}`, { credentials: 'include' }).then(r => r.json()),
  create: (data: Record<string, unknown>): Promise<unknown> =>
    pjFetch(`${PJ}/api/chain-templates`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }).then(r => r.json()),
  update: (id: string, data: Record<string, unknown>): Promise<unknown> =>
    pjFetch(`${PJ}/api/chain-templates/${encodeURIComponent(id)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }).then(r => r.json()),
  delete: (id: string): Promise<unknown> =>
    pjFetch(`${PJ}/api/chain-templates/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    }).then(r => r.json()),
},

}
