import { MA_MUNICIPALITIES, type Municipality } from '@/data/maMunicipalities'

const LOGICDASH_TABS = new Set(['snapshot', 'risk', 'peers', 'trends', 'forecast', 'sync'])
const LOGICDASH_DOMAINS = new Set(['fiscal', 'education', 'retirement', 'infra', 'env', 'parcels', 'governance', 'health', 'intelligence'])
const PERMITBRIDGE_ROUTE_PREFIXES = ['/permitbridge', '/permit-bridge', '/permit&bridge'] as const

function normalizeTownValue(value: string) {
  return value.trim().replace(/\+/g, ' ').replace(/\s+/g, ' ').toLowerCase()
}

function firstParam(searchParams: URLSearchParams, keys: string[]) {
  for (const key of keys) {
    const value = searchParams.get(key)
    if (value?.trim()) return value.trim()
  }
  return null
}

export function findMunicipality(value: string | null): Municipality | null {
  if (!value) return null

  const normalized = normalizeTownValue(value)
  const numeric = Number(normalized)

  if (Number.isFinite(numeric)) {
    return MA_MUNICIPALITIES.find(municipality => municipality.dor_code === numeric) ?? null
  }

  return MA_MUNICIPALITIES.find(municipality => normalizeTownValue(municipality.name) === normalized) ?? null
}

export function getPermitBridgeTownContext(search: string) {
  const searchParams = new URLSearchParams(search)
  const rawTown = firstParam(searchParams, ['town', 'municipality', 'city', 'community'])
  const municipality = findMunicipality(firstParam(searchParams, ['town', 'municipality', 'city', 'community', 'dor', 'dorCode']))
  const envId = firstParam(searchParams, ['envId', 'environmentId', 'environment', 'workspaceId', 'caseSpaceId'])

  return {
    municipality,
    townName: municipality?.name ?? rawTown,
    envId,
  }
}

function titleCaseSegment(value: string) {
  return value
    .replace(/[-_]+/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

export function getPermitBridgeProcessContext(pathname: string) {
  const normalizedPath = pathname.toLowerCase()
  const matchedPrefix = PERMITBRIDGE_ROUTE_PREFIXES.find((prefix) => normalizedPath === prefix || normalizedPath.startsWith(`${prefix}/`))
  const remainder = matchedPrefix ? pathname.slice(matchedPrefix.length) : pathname
  const segments = remainder.split('/').filter(Boolean)

  const stage = segments[0] ?? 'start'
  const subject = segments[1] ?? 'permit'
  const detail = segments[2] ?? null

  const stageLabelMap: Record<string, string> = {
    apply: 'Application',
    review: 'Review',
    inspections: 'Inspection',
    inspection: 'Inspection',
    renew: 'Renewal',
    pay: 'Payment',
    status: 'Status',
    start: 'Permit',
  }

  const subjectLabel = titleCaseSegment(subject)
  const detailLabel = detail ? titleCaseSegment(detail) : null
  const stageLabel = stageLabelMap[stage] ?? titleCaseSegment(stage)
  const isGenericFrontDoor = segments.length === 0 || (stage === 'start' && subject === 'permit' && !detail)
  const titleParts = [
    detailLabel,
    subjectLabel !== detailLabel ? subjectLabel : null,
    stageLabel !== subjectLabel ? stageLabel : null,
  ].filter(Boolean)
  const title = isGenericFrontDoor ? 'Permit front door' : titleParts.join(' ')

  return {
    stage,
    subject,
    detail,
    title: title || 'Permit process',
    summary: isGenericFrontDoor
      ? 'Start in the right permit path and keep the town context attached as the case moves forward.'
      : detailLabel
        ? `Direct front door to the ${detailLabel.toLowerCase()} ${subjectLabel.toLowerCase()} ${stageLabel.toLowerCase()} flow.`
        : `Direct front door to the ${subjectLabel.toLowerCase()} ${stageLabel.toLowerCase()} flow.`,
  }
}

export function getLogicDashUrl(options: {
  townCode?: number | null
  tab?: string | null
  domain?: string | null
  autoSync?: boolean
}) {
  const params = new URLSearchParams()
  if (options.townCode) params.set('town', String(options.townCode))
  if (options.domain && LOGICDASH_DOMAINS.has(options.domain)) params.set('domain', options.domain)
  if (options.tab && LOGICDASH_TABS.has(options.tab)) params.set('tab', options.tab)
  if (options.autoSync) params.set('autosync', '1')
  const query = params.toString()
  return `/dashboard${query ? `?${query}` : ''}`
}
