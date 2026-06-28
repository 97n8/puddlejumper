import { PAGE_SIZES } from './vaultConstants'
import type { PageSizeKey } from './vaultConstants'

export function fmtTime(ms: number): string {
  const d = new Date(ms)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) + ' at ' + d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

export function buildPreview(html: string, css: string, pageSize?: string): string {
  const printCSS = pageSize && PAGE_SIZES[pageSize as PageSizeKey]?.print
    ? `@page { size: ${PAGE_SIZES[pageSize as PageSizeKey].print}; margin: 1in; }` : ''
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>${printCSS}${css}</style></head><body>${html}</body></html>`
}
