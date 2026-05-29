export const PERMITBRIDGE_APP_ORIGIN = 'https://permitbridge.vercel.app'

const PERMITBRIDGE_ROUTE_PREFIXES = ['/permitbridge', '/permit-bridge', '/permit&bridge'] as const

export function getEmbeddedPermitBridgeUrl(pathname: string, search: string, hash: string): string {
  const normalizedPath = pathname.toLowerCase()
  const matchedPrefix = PERMITBRIDGE_ROUTE_PREFIXES.find((prefix) => normalizedPath === prefix || normalizedPath.startsWith(`${prefix}/`))
  const remainder = matchedPrefix ? pathname.slice(matchedPrefix.length) : ''
  const url = new URL(remainder || '/', PERMITBRIDGE_APP_ORIGIN)
  url.search = search
  url.hash = hash
  return url.toString()
}

export function isPermitBridgePathname(pathname: string): boolean {
  const normalizedPath = pathname.toLowerCase()
  return PERMITBRIDGE_ROUTE_PREFIXES.some((prefix) => normalizedPath === prefix || normalizedPath.startsWith(`${prefix}/`))
}
