import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { getDb, migrate, type DatabaseHandle } from '@pj/db'
import { resolveActor, resolveActorForLogin } from '../src/index.js'

const TENANT = 'publiclogic'

function fresh(): DatabaseHandle {
  const db = getDb(':memory:')
  migrate(db)
  db.prepare('INSERT INTO tenants (id, name, canon_version) VALUES (?, ?, ?)').run(
    TENANT,
    'PublicLogic',
    '1.0.0',
  )
  return db
}

function seedIdentity(db: DatabaseHandle, identityId: string, email: string, displayName: string): void {
  db.prepare(
    `INSERT INTO identities (identity_id, tenant_id, kind, active, email, display_name)
     VALUES (?, ?, 'person', 1, ?, ?)`,
  ).run(identityId, TENANT, email, displayName)
}

describe('@publiclogic/logic-commons-runtime identity bridge', () => {
  let db: DatabaseHandle

  beforeEach(() => {
    db = fresh()
  })

  afterEach(() => {
    const current = db
    db = undefined as unknown as DatabaseHandle
    try { current?.close() } catch {}
  })

  it('resolves by explicit canonIdentityId first', () => {
    seedIdentity(db, 'id-nate', 'nate@publiclogic.org', 'Nate Boudreau')

    expect(resolveActor(db, TENANT, { canonIdentityId: 'id-nate' })).toEqual({
      ok: true,
      identityId: 'id-nate',
      match: 'canon_claim',
    })
  })

  it('resolves login by email to the canonical identity', () => {
    seedIdentity(db, 'id-allie', 'allie@publiclogic.org', 'Allie')

    expect(resolveActorForLogin(db, TENANT, { email: '  ALLIE@PUBLICLOGIC.ORG ' })).toEqual({
      ok: true,
      identityId: 'id-allie',
      match: 'email',
    })
  })

  it('fails closed when the actor cannot be resolved', () => {
    expect(resolveActor(db, TENANT, { sub: 'local-only-user' })).toEqual({
      ok: false,
      reason: 'identity_not_found',
    })
  })
})
