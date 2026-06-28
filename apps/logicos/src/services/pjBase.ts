export const pjBase = (() => {
  const configured = (import.meta.env.VITE_PJ_API_URL as string | undefined ?? '').replace(/\/$/, '')
  if (configured) return configured
  return import.meta.env.MODE === 'test' ? '' : 'https://api.publiclogic.org'
})()

export function pjUrl(path: string): string {
  const normalized = path.startsWith('/') ? path : `/${path}`
  return `${pjBase}${normalized}`
}
