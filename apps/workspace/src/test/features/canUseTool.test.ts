import { describe, it, expect } from 'vitest'

/**
 * Extracted canUseTool logic from App.tsx for unit testing.
 * This mirrors the logic exactly — keep in sync if App.tsx changes.
 */
type PJUser = { sub: string; email: string | null; role: string }
type ToolAccess = string[] | Record<string, boolean> | null
type Membership = { role: string | null; toolAccess: ToolAccess } | null
type LocalUser = { email?: string; id?: string; role?: string; permissions?: { toolAccess?: ToolAccess } }

function isToolAccessMap(value: unknown): value is Record<string, boolean> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function hasToolGrant(toolAccess: ToolAccess | undefined, toolKey: string): boolean {
  if (Array.isArray(toolAccess)) return toolAccess.includes(toolKey)
  if (isToolAccessMap(toolAccess)) return toolAccess[toolKey] === true
  return false
}

function hasToolDeny(toolAccess: ToolAccess | undefined, toolKey: string): boolean {
  if (isToolAccessMap(toolAccess)) return toolAccess[toolKey] === false
  return false
}

function canUseTool(
  toolKey: string,
  user: PJUser | null,
  membershipLoaded: boolean,
  myMembership: Membership,
  workspaceUsers: LocalUser[],
  overrideDemoRestricted = false,
): boolean {
  if (!user) return false
  if (!membershipLoaded) return false
  if (overrideDemoRestricted && toolKey !== 'casespaces') return false
  const localUser = workspaceUsers.find(u => u.email === user.email || u.id === user.sub)
  const wsRole = myMembership?.role ?? localUser?.role ?? user.role
  if (toolKey === 'admin') return wsRole === 'owner' || wsRole === 'admin'
  if (wsRole === 'owner' || wsRole === 'admin') return true
  if (!myMembership && !localUser) return false
  const toolAccess = myMembership?.toolAccess ?? localUser?.permissions?.toolAccess
  if ((wsRole === 'member' || wsRole === 'editor') && !toolAccess) return true
  if (!toolAccess) return false
  if (toolKey === 'vault') return hasToolGrant(toolAccess, 'vault')
  if (toolKey === 'formkey') {
    if (hasToolDeny(toolAccess, 'formkey')) return false
    if (hasToolGrant(toolAccess, 'formkey')) return true
    if (!hasToolDeny(toolAccess, 'vault') && hasToolGrant(toolAccess, 'vault')) return true
    if (!hasToolDeny(toolAccess, 'logicdash') && hasToolGrant(toolAccess, 'logicdash')) return true
    return false
  }
  return hasToolGrant(toolAccess, toolKey)
}

const baseUser: PJUser = { sub: 'u1', email: 'user@example.com', role: 'member' }

describe('canUseTool', () => {
  it('returns false when user is null', () => {
    expect(canUseTool('vault', null, true, { role: 'owner', toolAccess: null }, [])).toBe(false)
  })

  it('returns false when membershipLoaded is false', () => {
    expect(canUseTool('vault', baseUser, false, { role: 'owner', toolAccess: null }, [])).toBe(false)
  })

  it('owner can use any regular tool', () => {
    const owner: PJUser = { sub: 'o1', email: 'owner@example.com', role: 'owner' }
    const membership: Membership = { role: 'owner', toolAccess: null }
    expect(canUseTool('vault', owner, true, membership, [])).toBe(true)
    expect(canUseTool('logicdash', owner, true, membership, [])).toBe(true)
    expect(canUseTool('formkey', owner, true, membership, [])).toBe(true)
    expect(canUseTool('logicbridge', owner, true, membership, [])).toBe(true)
  })

  it('owner can use admin panel', () => {
    const owner: PJUser = { sub: 'o1', email: 'owner@example.com', role: 'owner' }
    expect(canUseTool('admin', owner, true, { role: 'owner', toolAccess: null }, [])).toBe(true)
  })

  it('admin can use any tool including admin panel', () => {
    const admin: PJUser = { sub: 'a1', email: 'admin@example.com', role: 'admin' }
    const membership: Membership = { role: 'admin', toolAccess: null }
    expect(canUseTool('vault', admin, true, membership, [])).toBe(true)
    expect(canUseTool('admin', admin, true, membership, [])).toBe(true)
  })

  it('member role is denied admin panel', () => {
    const membership: Membership = { role: 'member', toolAccess: null }
    expect(canUseTool('admin', baseUser, true, membership, [])).toBe(false)
  })

  it('viewer role is denied admin panel', () => {
    const viewer: PJUser = { sub: 'v1', email: 'viewer@example.com', role: 'viewer' }
    const membership: Membership = { role: 'viewer', toolAccess: null }
    expect(canUseTool('admin', viewer, true, membership, [])).toBe(false)
  })

  it('member with no toolAccess can use all non-admin tools', () => {
    const membership: Membership = { role: 'member', toolAccess: null }
    expect(canUseTool('vault', baseUser, true, membership, [])).toBe(true)
    expect(canUseTool('logicdash', baseUser, true, membership, [])).toBe(true)
  })

  it('user with toolAccess=[vault] can use vault', () => {
    const membership: Membership = { role: 'viewer', toolAccess: ['vault'] }
    const viewer: PJUser = { sub: 'v1', email: 'viewer@example.com', role: 'viewer' }
    expect(canUseTool('vault', viewer, true, membership, [])).toBe(true)
  })

  it('user with legacy vault access can use formkey', () => {
    const membership: Membership = { role: 'viewer', toolAccess: ['vault'] }
    const viewer: PJUser = { sub: 'v1', email: 'viewer@example.com', role: 'viewer' }
    expect(canUseTool('formkey', viewer, true, membership, [])).toBe(true)
  })

  it('user with legacy logicdash access can use formkey', () => {
    const membership: Membership = { role: 'viewer', toolAccess: ['logicdash'] }
    const viewer: PJUser = { sub: 'v1', email: 'viewer@example.com', role: 'viewer' }
    expect(canUseTool('formkey', viewer, true, membership, [])).toBe(true)
  })

  it('explicit formkey deny beats legacy vault fallback', () => {
    const membership: Membership = { role: 'viewer', toolAccess: { formkey: false, vault: true } }
    const viewer: PJUser = { sub: 'v1', email: 'viewer@example.com', role: 'viewer' }
    expect(canUseTool('formkey', viewer, true, membership, [])).toBe(false)
  })

  it('user with toolAccess=[vault] cannot use logicdash', () => {
    const membership: Membership = { role: 'viewer', toolAccess: ['vault'] }
    const viewer: PJUser = { sub: 'v1', email: 'viewer@example.com', role: 'viewer' }
    expect(canUseTool('logicdash', viewer, true, membership, [])).toBe(false)
  })

  it('viewer with null toolAccess and no membership gets no access', () => {
    const viewer: PJUser = { sub: 'v1', email: 'viewer@example.com', role: 'viewer' }
    // No membership, no localUser
    expect(canUseTool('vault', viewer, true, null, [])).toBe(false)
  })

  it('user falls back to localUser role when no membership', () => {
    const localUsers: LocalUser[] = [{ email: 'user@example.com', id: 'u1', role: 'admin' }]
    // myMembership is null but localUser has admin role
    expect(canUseTool('vault', baseUser, true, null, localUsers)).toBe(true)
  })

  it('user falls back to localUser toolAccess', () => {
    const localUsers: LocalUser[] = [{
      email: 'user@example.com',
      id: 'u1',
      role: 'viewer',
      permissions: { toolAccess: ['logicbackend'] },
    }]
    expect(canUseTool('logicbackend', baseUser, true, null, localUsers)).toBe(true)
    expect(canUseTool('vault', baseUser, true, null, localUsers)).toBe(false)
  })

  it('demo-restricted user can only access casespaces', () => {
    const owner: PJUser = { sub: 'o1', email: 'demo@example.com', role: 'owner' }
    const membership: Membership = { role: 'owner', toolAccess: null }
    expect(canUseTool('casespaces', owner, true, membership, [], true)).toBe(true)
    expect(canUseTool('vault', owner, true, membership, [], true)).toBe(false)
  })
})
