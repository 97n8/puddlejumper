import type { DatabaseHandle } from '@pj/db'
import { resolveIdentityByEmail, whois } from '@pj/org-manager'

export interface AuthenticatedActor {
  sub?: string | null
  userId?: string | null
  email?: string | null
  name?: string | null
  canonIdentityId?: string | null
}

export type ResolveActorResult =
  | { ok: true; identityId: string; match: 'canon_claim' | 'user_id' | 'sub' | 'email' }
  | { ok: false; reason: 'identity_not_found' | 'missing_tenant' | 'missing_actor' }

function matchesIdentityId(
  db: DatabaseHandle,
  tenantId: string,
  identityId: string | null | undefined,
): string | null {
  if (!identityId?.trim()) return null
  try {
    const identity = whois(db, identityId.trim(), tenantId)
    return identity.active ? identity.identity_id : null
  } catch {
    return null
  }
}

export function resolveActor(
  db: DatabaseHandle,
  tenantId: string | null | undefined,
  actor: AuthenticatedActor,
): ResolveActorResult {
  if (!tenantId?.trim()) return { ok: false, reason: 'missing_tenant' }

  const directCanon = matchesIdentityId(db, tenantId, actor.canonIdentityId)
  if (directCanon) return { ok: true, identityId: directCanon, match: 'canon_claim' }

  const directUserId = matchesIdentityId(db, tenantId, actor.userId)
  if (directUserId) return { ok: true, identityId: directUserId, match: 'user_id' }

  const directSub = matchesIdentityId(db, tenantId, actor.sub)
  if (directSub) return { ok: true, identityId: directSub, match: 'sub' }

  if (actor.email?.trim()) {
    const found = resolveIdentityByEmail(db, tenantId, actor.email)
    if (found) return { ok: true, identityId: found.identity_id, match: 'email' }
  }

  const hasActorMaterial = Boolean(actor.canonIdentityId || actor.userId || actor.sub || actor.email)
  return { ok: false, reason: hasActorMaterial ? 'identity_not_found' : 'missing_actor' }
}

export function resolveActorForLogin(
  db: DatabaseHandle,
  tenantId: string | null | undefined,
  actor: Pick<AuthenticatedActor, 'email'>,
): ResolveActorResult {
  return resolveActor(db, tenantId, actor)
}
