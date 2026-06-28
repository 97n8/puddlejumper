import type { CaseSpace } from './types'

export const SUTTON_TOWN_ENTRY_PATH = '/town'
export const SUTTON_TOWN_ENTRY_KEY = 'workspace-town-entry'
export const DEFAULT_SUTTON_ENVIRONMENT_ID = 'vault-sutton'

export type SuttonViewer = {
  sub?: string | null
  email?: string | null
  name?: string | null
}

const SUTTON_LOCKED_EMAILS = new Set([
  'a.cyganiewicz@town.sutton.ma.us',
  'nboudreauma@gmail.com',
])

const SUTTON_LOCKED_NAMES = new Set([
  'sutton town manager',
  'n8 demo operator',
  'n8',
])

const SUTTON_ENVIRONMENT_IDS = ['vault-sutton', 'vault-sutton-2', 'vault-sutton-3']

function normalize(value: string | null | undefined) {
  return (value ?? '').trim().toLowerCase()
}

function normalizeScope(value: string | null | undefined) {
  const normalized = normalize(value)
  return normalized.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
}

export function isSuttonRestrictedUser(
  viewer: SuttonViewer | string | null | undefined,
  name?: string | null,
) {
  if (typeof viewer === 'string' || viewer == null) {
    return SUTTON_LOCKED_EMAILS.has(normalize(viewer)) || SUTTON_LOCKED_NAMES.has(normalize(name))
  }

  return (
    SUTTON_LOCKED_EMAILS.has(normalize(viewer.email)) ||
    SUTTON_LOCKED_NAMES.has(normalize(viewer.name))
  )
}

export function isDemoRestrictedUser(
  viewer: SuttonViewer | string | null | undefined,
  name?: string | null,
) {
  return isSuttonRestrictedUser(viewer, name)
}

export function getDemoUserScope(
  viewer: SuttonViewer | string | null | undefined,
  name?: string | null,
) {
  if (!isDemoRestrictedUser(viewer, name)) return null

  if (typeof viewer === 'string' || viewer == null) {
    return normalizeScope(viewer) || normalizeScope(name) || null
  }

  return normalizeScope(viewer.sub) || normalizeScope(viewer.email) || normalizeScope(viewer.name) || null
}

export function isSuttonEnvironmentId(environmentId: string | null | undefined) {
  const id = normalize(environmentId)
  return SUTTON_ENVIRONMENT_IDS.includes(id) || id.includes('sutton')
}

export function isSuttonEnvironment(environment: Pick<CaseSpace, 'id' | 'name' | 'town'> | null | undefined) {
  if (!environment) return false
  return (
    isSuttonEnvironmentId(environment.id) ||
    normalize(environment.name).includes('sutton') ||
    normalize(environment.town).includes('sutton')
  )
}

export function filterEnvironmentsForUser<T extends Pick<CaseSpace, 'id' | 'name' | 'town'>>(
  environments: T[],
  viewer: SuttonViewer | string | null | undefined,
) {
  if (!isSuttonRestrictedUser(viewer)) return environments
  return environments.filter(isSuttonEnvironment)
}

export function getPreferredSuttonEnvironmentId<T extends Pick<CaseSpace, 'id' | 'name' | 'town'>>(
  environments: T[],
) {
  const filtered = environments.filter(isSuttonEnvironment)
  return (
    filtered.find((environment) => normalize(environment.id) === DEFAULT_SUTTON_ENVIRONMENT_ID)?.id ??
    filtered.find((environment) => SUTTON_ENVIRONMENT_IDS.includes(normalize(environment.id)))?.id ??
    filtered[0]?.id ??
    DEFAULT_SUTTON_ENVIRONMENT_ID
  )
}
