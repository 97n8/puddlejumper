import { describe, it, expect } from 'vitest'
import {
  isSuttonRestrictedUser,
  isDemoRestrictedUser,
  getDemoUserScope,
  isSuttonEnvironmentId,
  isSuttonEnvironment,
  filterEnvironmentsForUser,
  getPreferredSuttonEnvironmentId,
  DEFAULT_SUTTON_ENVIRONMENT_ID,
} from '@/lib/environmentAccess'

const LOCKED_EMAIL = 'a.cyganiewicz@town.sutton.ma.us'
const LOCKED_NAME = 'sutton town manager'
const UNLOCKED_EMAIL = 'jane@example.com'
const UNLOCKED_NAME = 'Jane Smith'

describe('isSuttonRestrictedUser', () => {
  it('restricts locked email string', () => {
    expect(isSuttonRestrictedUser(LOCKED_EMAIL)).toBe(true)
  })

  it('restricts locked email (case insensitive)', () => {
    expect(isSuttonRestrictedUser(LOCKED_EMAIL.toUpperCase())).toBe(true)
  })

  it('does not restrict unlocked email string', () => {
    expect(isSuttonRestrictedUser(UNLOCKED_EMAIL)).toBe(false)
  })

  it('restricts locked name string', () => {
    expect(isSuttonRestrictedUser(null, LOCKED_NAME)).toBe(true)
  })

  it('does not restrict unlocked name', () => {
    expect(isSuttonRestrictedUser(null, UNLOCKED_NAME)).toBe(false)
  })

  it('returns false for null/undefined viewer', () => {
    expect(isSuttonRestrictedUser(null)).toBe(false)
    expect(isSuttonRestrictedUser(undefined)).toBe(false)
  })

  it('restricts viewer object with locked email', () => {
    expect(isSuttonRestrictedUser({ email: LOCKED_EMAIL })).toBe(true)
  })

  it('restricts viewer object with locked name', () => {
    expect(isSuttonRestrictedUser({ name: LOCKED_NAME })).toBe(true)
  })

  it('does not restrict viewer object with unlocked email', () => {
    expect(isSuttonRestrictedUser({ email: UNLOCKED_EMAIL, name: UNLOCKED_NAME })).toBe(false)
  })
})

describe('isDemoRestrictedUser', () => {
  it('is an alias for isSuttonRestrictedUser', () => {
    expect(isDemoRestrictedUser(LOCKED_EMAIL)).toBe(true)
    expect(isDemoRestrictedUser(UNLOCKED_EMAIL)).toBe(false)
  })
})

describe('getDemoUserScope', () => {
  it('returns null for unrestricted user', () => {
    expect(getDemoUserScope(UNLOCKED_EMAIL)).toBeNull()
  })

  it('returns normalized email slug for locked string', () => {
    const scope = getDemoUserScope(LOCKED_EMAIL)
    expect(scope).toBeTruthy()
    expect(scope).not.toContain('@')
  })

  it('returns normalized name slug for locked name', () => {
    const scope = getDemoUserScope(null, LOCKED_NAME)
    expect(scope).toBe('sutton-town-manager')
  })

  it('returns scope from viewer object sub', () => {
    const scope = getDemoUserScope({ sub: 'user123', email: LOCKED_EMAIL })
    expect(scope).toBe('user123')
  })

  it('falls back to email if sub is empty', () => {
    const scope = getDemoUserScope({ sub: '', email: LOCKED_EMAIL })
    expect(scope).toBeTruthy()
    expect(scope).toMatch(/sutton/)
  })
})

describe('isSuttonEnvironmentId', () => {
  it('matches exact sutton IDs', () => {
    expect(isSuttonEnvironmentId('vault-sutton')).toBe(true)
    expect(isSuttonEnvironmentId('vault-sutton-2')).toBe(true)
    expect(isSuttonEnvironmentId('vault-sutton-3')).toBe(true)
  })

  it('matches IDs containing "sutton"', () => {
    expect(isSuttonEnvironmentId('vault-sutton-custom')).toBe(true)
  })

  it('does not match unrelated IDs', () => {
    expect(isSuttonEnvironmentId('vault-springfield')).toBe(false)
  })

  it('handles null/undefined gracefully', () => {
    expect(isSuttonEnvironmentId(null)).toBe(false)
    expect(isSuttonEnvironmentId(undefined)).toBe(false)
  })
})

describe('isSuttonEnvironment', () => {
  it('matches by ID', () => {
    expect(isSuttonEnvironment({ id: 'vault-sutton', name: 'Other', town: 'Other' })).toBe(true)
  })

  it('matches by name containing sutton', () => {
    expect(isSuttonEnvironment({ id: 'vault-abc', name: 'Sutton Demo', town: 'Other' })).toBe(true)
  })

  it('matches by town containing sutton', () => {
    expect(isSuttonEnvironment({ id: 'vault-abc', name: 'Other', town: 'Sutton' })).toBe(true)
  })

  it('does not match unrelated environment', () => {
    expect(isSuttonEnvironment({ id: 'vault-springfield', name: 'Springfield', town: 'Springfield' })).toBe(false)
  })

  it('returns false for null', () => {
    expect(isSuttonEnvironment(null)).toBe(false)
  })
})

describe('filterEnvironmentsForUser', () => {
  const envs = [
    { id: 'vault-sutton', name: 'Sutton', town: 'Sutton' },
    { id: 'vault-springfield', name: 'Springfield', town: 'Springfield' },
    { id: 'vault-abc', name: 'ABC Town', town: 'ABC' },
  ]

  it('returns all environments for unrestricted user', () => {
    expect(filterEnvironmentsForUser(envs, UNLOCKED_EMAIL)).toHaveLength(3)
  })

  it('filters to only sutton environments for restricted user', () => {
    const filtered = filterEnvironmentsForUser(envs, LOCKED_EMAIL)
    expect(filtered).toHaveLength(1)
    expect(filtered[0].id).toBe('vault-sutton')
  })
})

describe('getPreferredSuttonEnvironmentId', () => {
  it('prefers vault-sutton exactly', () => {
    const envs = [
      { id: 'vault-sutton-2', name: 'Sutton 2', town: 'Sutton' },
      { id: 'vault-sutton', name: 'Sutton', town: 'Sutton' },
    ]
    expect(getPreferredSuttonEnvironmentId(envs)).toBe('vault-sutton')
  })

  it('falls back to other sutton IDs', () => {
    const envs = [{ id: 'vault-sutton-2', name: 'Sutton 2', town: 'Sutton' }]
    expect(getPreferredSuttonEnvironmentId(envs)).toBe('vault-sutton-2')
  })

  it('returns default ID when no sutton environments exist', () => {
    const envs = [{ id: 'vault-springfield', name: 'Springfield', town: 'Springfield' }]
    expect(getPreferredSuttonEnvironmentId(envs)).toBe(DEFAULT_SUTTON_ENVIRONMENT_ID)
  })

  it('returns default for empty array', () => {
    expect(getPreferredSuttonEnvironmentId([])).toBe(DEFAULT_SUTTON_ENVIRONMENT_ID)
  })
})
