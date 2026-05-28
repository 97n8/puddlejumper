// Language detection
type Language = 'typescript' | 'javascript' | 'python' | 'go' | 'rust' | 'json' | 'markdown' | 'shell' | 'yaml' | 'sql' | 'html' | 'css' | 'toml' | 'plaintext'

const EXT_MAP: Record<string, Language> = {
  ts: 'typescript', tsx: 'typescript',
  js: 'javascript', jsx: 'javascript',
  py: 'python', go: 'go', rs: 'rust',
  json: 'json',
  md: 'markdown', mdx: 'markdown',
  sh: 'shell', bash: 'shell', zsh: 'shell',
  yml: 'yaml', yaml: 'yaml',
  sql: 'sql',
  html: 'html', htm: 'html', xml: 'html', svg: 'html',
  css: 'css', scss: 'css',
  toml: 'toml',
}

export function detectLanguage(path: string): Language {
  const ext = path.split('.').pop()?.toLowerCase() ?? ''
  return EXT_MAP[ext] ?? 'plaintext'
}

export const LANGUAGE_META: Record<Language, { label: string; color: string; monoColor: string; comment: string }> = {
  typescript:  { label: 'TypeScript', color: '#3178c6', monoColor: '#60a5fa', comment: '//' },
  javascript:  { label: 'JavaScript', color: '#f1e05a', monoColor: '#fbbf24', comment: '//' },
  python:      { label: 'Python',     color: '#3572a5', monoColor: '#93c5fd', comment: '#' },
  go:          { label: 'Go',         color: '#00add8', monoColor: '#67e8f9', comment: '//' },
  rust:        { label: 'Rust',       color: '#dea584', monoColor: '#fdba74', comment: '//' },
  json:        { label: 'JSON',       color: '#8bc34a', monoColor: '#86efac', comment: '' },
  markdown:    { label: 'Markdown',   color: '#7c3aed', monoColor: '#c4b5fd', comment: '' },
  shell:       { label: 'Shell',      color: '#89e051', monoColor: '#86efac', comment: '#' },
  yaml:        { label: 'YAML',       color: '#cb171e', monoColor: '#fca5a5', comment: '#' },
  sql:         { label: 'SQL',        color: '#e38c00', monoColor: '#fcd34d', comment: '--' },
  html:        { label: 'HTML',       color: '#e44d26', monoColor: '#fb923c', comment: '<!--' },
  css:         { label: 'CSS',        color: '#563d7c', monoColor: '#a78bfa', comment: '/*' },
  toml:        { label: 'TOML',       color: '#9c4221', monoColor: '#fdba74', comment: '#' },
  plaintext:   { label: 'Plain Text', color: '#6b7280', monoColor: '#9ca3af', comment: '' },
}

// ── §13 Idempotency ──────────────────────────────────────────────────────────
export function generateIdempotencyKey(): string {
  const arr = new Uint8Array(16)
  crypto.getRandomValues(arr)
  return Array.from(arr, b => b.toString(16).padStart(2, '0')).join('')
}

// ── §10.2 djb2 hash ─────────────────────────────────────────────────────────
export function djb2(str: string): string {
  let hash = 5381
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) ^ str.charCodeAt(i)
    hash = hash >>> 0
  }
  return hash.toString(16)
}

// ── §12 Error code helpers ───────────────────────────────────────────────────
import type { SaveErrorCode } from './providers/types'

const RETRYABLE_CODES = new Set<SaveErrorCode>(['RATE_LIMITED', 'NETWORK_ERROR', 'SERVER_ERROR', 'TIMEOUT'])

export function isRetryable(code?: SaveErrorCode): boolean {
  return code ? RETRYABLE_CODES.has(code) : false
}

export function errorCodeLabel(code: SaveErrorCode): string {
  const labels: Record<SaveErrorCode, string> = {
    RATE_LIMITED:         'Provider rate limit reached — retrying',
    NETWORK_ERROR:        'Connection failed — check your network',
    SERVER_ERROR:         'Provider server error — retrying',
    TIMEOUT:              'Request timed out — retrying',
    AUTH_EXPIRED:         'Your session expired — reconnect the provider',
    PERMISSION_DENIED:    'Account lacks write permission on this path',
    PATH_CONFLICT:        'File already exists at that path',
    QUOTA_EXCEEDED:       'Storage quota exhausted on provider account',
    INVALID_PATH:         'Path failed validation — check for illegal characters',
    FILE_TOO_LARGE:       'File exceeds the provider size limit',
    PROVIDER_UNAVAILABLE: 'Provider is unavailable or in maintenance',
    UNKNOWN:              'Unexpected error — see error details',
  }
  return labels[code] ?? code
}

// ── §17 EOL Detection and Normalization ──────────────────────────────────────
import type { EOLStyle } from './providers/types'

export function detectEOL(text: string): EOLStyle {
  const hasCRLF = /\r\n/.test(text)
  const hasCR   = /\r(?!\n)/.test(text)
  const hasLF   = /(?<!\r)\n/.test(text)
  const count = [hasCRLF, hasCR, hasLF].filter(Boolean).length
  if (count > 1) return 'mixed'
  if (hasCRLF)   return 'CRLF'
  if (hasCR)     return 'CR'
  return 'LF'
}

export function normalizeEOL(text: string): string {
  return text.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
}

export function restoreEOL(text: string, style: EOLStyle): string {
  const normalized = normalizeEOL(text)
  if (style === 'CRLF') return normalized.replace(/\n/g, '\r\n')
  if (style === 'CR')   return normalized.replace(/\n/g, '\r')
  return normalized
}

// ── §18 Path Validation ──────────────────────────────────────────────────────
import type { PathValidationResult } from './providers/types'

// eslint-disable-next-line no-control-regex -- intentional: rejects control characters in file paths
const ILLEGAL_CHARS = /[<>:"|?*\x00-\x1F]/
const WINDOWS_RESERVED = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\.|$)/i
const TRAVERSAL = /\.\.(\/|\\|$)/

export function validatePath(path: string): PathValidationResult {
  const errors: string[] = []
  const warnings: string[] = []

  if (!path || !path.trim()) {
    errors.push('Path must not be empty')
    return { valid: false, errors, warnings }
  }
  if (TRAVERSAL.test(path)) errors.push('Path must not contain directory traversal sequences (../)')
  if (ILLEGAL_CHARS.test(path)) errors.push('Path contains illegal characters (< > : " | ? * or control characters)')
  const segments = path.replace(/^\//, '').split('/')
  for (const seg of segments) {
    if (WINDOWS_RESERVED.test(seg)) errors.push(`"${seg}" is a reserved name on Windows`)
  }
  if (path.length > 1024) errors.push('Path exceeds maximum length of 1,024 characters')

  if (segments.some(s => s !== s.trimEnd())) warnings.push('One or more path segments have trailing whitespace (auto-trimmed)')
  const nfc = path.normalize('NFC')
  if (nfc !== path) warnings.push('Path contains characters that will be NFC-normalized')

  const normalized = ('/' + segments.map(s => s.trimEnd()).join('/')).replace(/^\/\//, '/').normalize('NFC')

  return { valid: errors.length === 0, normalized, errors, warnings }
}

// ── §19 Binary File Guard ────────────────────────────────────────────────────
const BINARY_EXTS = new Set([
  'png','jpg','jpeg','gif','webp','ico','bmp','tiff',
  'pdf',
  'zip','tar','gz','rar','7z',
  'exe','dll','so','dylib',
  'wasm','bin','dat',
  'mp3','mp4','avi','mov','mkv','flac','wav',
  'ttf','otf','woff','woff2',
  'psd','ai','sketch','fig',
  'docx','xlsx','pptx','doc','xls','ppt',
])

export function isBinaryPath(path: string): boolean {
  const ext = path.split('.').pop()?.toLowerCase() ?? ''
  return BINARY_EXTS.has(ext)
}

// ── §14 Tiered Diff Algorithm ────────────────────────────────────────────────
import type { DiffLine, DiffHunk, DiffResult, WordDiffToken } from './providers/types'

const MAX_DIFF_LINES_RENDERED = 10_000
const CONTEXT_LINES = 3

// Myers LCS for ≤ 800 lines
function myersLCS(oldLines: string[], newLines: string[]): DiffLine[] {
  const m = oldLines.length, n = newLines.length
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0))
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] = oldLines[i-1] === newLines[j-1] ? dp[i-1][j-1] + 1 : Math.max(dp[i-1][j], dp[i][j-1])
  const result: DiffLine[] = []
  let i = m, j = n
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldLines[i-1] === newLines[j-1]) {
      result.push({ type: 'same', content: oldLines[i-1], lineOld: i, lineNew: j })
      i--; j--
    } else if (j > 0 && (i === 0 || dp[i][j-1] >= dp[i-1][j])) {
      result.push({ type: 'added', content: newLines[j-1], lineNew: j })
      j--
    } else {
      result.push({ type: 'removed', content: oldLines[i-1], lineOld: i })
      i--
    }
  }
  return result.reverse()
}

// lcsLength for Hirschberg (two-row rolling DP)
function lcsLength(a: string[], b: string[]): number[] {
  const n = b.length
  let prev = new Array(n + 1).fill(0)
  let curr = new Array(n + 1).fill(0)
  for (let i = 0; i < a.length; i++) {
    for (let j = 1; j <= n; j++)
      curr[j] = a[i] === b[j-1] ? prev[j-1] + 1 : Math.max(prev[j], curr[j-1])
    ;[prev, curr] = [curr, prev]
  }
  return prev
}

// Hirschberg divide-and-conquer for 800–5000 lines
function hirschberg(oldLines: string[], newLines: string[]): DiffLine[] {
  if (oldLines.length === 0) return newLines.map((c, i) => ({ type: 'added' as const, content: c, lineNew: i + 1 }))
  if (newLines.length === 0) return oldLines.map((c, i) => ({ type: 'removed' as const, content: c, lineOld: i + 1 }))
  if (oldLines.length === 1) {
    if (newLines.includes(oldLines[0])) {
      const idx = newLines.indexOf(oldLines[0])
      return [
        ...newLines.slice(0, idx).map((c, i) => ({ type: 'added' as const, content: c, lineNew: i + 1 })),
        { type: 'same' as const, content: oldLines[0], lineOld: 1, lineNew: idx + 1 },
        ...newLines.slice(idx + 1).map((c, i) => ({ type: 'added' as const, content: c, lineNew: idx + 2 + i })),
      ]
    }
    return [
      { type: 'removed' as const, content: oldLines[0], lineOld: 1 },
      ...newLines.map((c, i) => ({ type: 'added' as const, content: c, lineNew: i + 1 })),
    ]
  }
  const mid = Math.floor(oldLines.length / 2)
  const scoreL = lcsLength(oldLines.slice(0, mid), newLines)
  const scoreR = lcsLength(oldLines.slice(mid).reverse(), newLines.slice().reverse())
  let splitJ = 0, best = -1
  for (let j = 0; j <= newLines.length; j++) {
    const val = scoreL[j] + scoreR[newLines.length - j]
    if (val > best) { best = val; splitJ = j }
  }
  return [
    ...hirschberg(oldLines.slice(0, mid), newLines.slice(0, splitJ)),
    ...hirschberg(oldLines.slice(mid), newLines.slice(splitJ)),
  ]
}

// Contextual (linear) for > 5000 lines
function contextualDiff(oldLines: string[], newLines: string[]): DiffLine[] {
  const result: DiffLine[] = []
  const maxLen = Math.max(oldLines.length, newLines.length)
  let lo = 1, ln = 1
  for (let i = 0; i < maxLen; i++) {
    const o = oldLines[i], n = newLines[i]
    if (o !== undefined && n !== undefined) {
      if (o === n) result.push({ type: 'same', content: o, lineOld: lo++, lineNew: ln++ })
      else {
        result.push({ type: 'removed', content: o, lineOld: lo++ })
        result.push({ type: 'added', content: n, lineNew: ln++ })
      }
    } else if (o !== undefined) {
      result.push({ type: 'removed', content: o, lineOld: lo++ })
    } else {
      result.push({ type: 'added', content: n, lineNew: ln++ })
    }
  }
  return result
}

// §16 Word-level diff
export function wordDiff(oldLine: string, newLine: string): { old: WordDiffToken[]; new: WordDiffToken[] } {
  const tok = (s: string) => s.match(/\w+|\W/g) ?? []
  const oldToks = tok(oldLine), newToks = tok(newLine)
  if (oldToks.length * newToks.length > 40_000) {
    return {
      old: [{ text: oldLine, type: 'removed' }],
      new: [{ text: newLine, type: 'added' }],
    }
  }
  const m = oldToks.length, n = newToks.length
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0))
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] = oldToks[i-1] === newToks[j-1] ? dp[i-1][j-1] + 1 : Math.max(dp[i-1][j], dp[i][j-1])
  const oldResult: WordDiffToken[] = [], newResult: WordDiffToken[] = []
  let i = m, j = n
  const stack: Array<{ io: number; jo: number }> = []
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldToks[i-1] === newToks[j-1]) { stack.push({ io: i--, jo: j-- }) }
    else if (j > 0 && (i === 0 || dp[i][j-1] >= dp[i-1][j])) { stack.push({ io: -1, jo: j-- }) }
    else { stack.push({ io: i--, jo: -1 }) }
  }
  stack.reverse().forEach(({ io, jo }) => {
    if (io > 0 && jo > 0) {
      oldResult.push({ text: oldToks[io-1], type: 'same' })
      newResult.push({ text: newToks[jo-1], type: 'same' })
    } else if (io < 0) newResult.push({ text: newToks[jo-1], type: 'added' })
    else oldResult.push({ text: oldToks[io-1], type: 'removed' })
  })
  return { old: oldResult, new: newResult }
}

// §15 Hunk Building
export function buildHunks(lines: DiffLine[], contextLines = CONTEXT_LINES): DiffHunk[] {
  const changedIdx = new Set<number>()
  lines.forEach((l, i) => { if (l.type !== 'same') changedIdx.add(i) })

  const keep = new Set<number>()
  changedIdx.forEach(ci => {
    for (let k = Math.max(0, ci - contextLines); k <= Math.min(lines.length - 1, ci + contextLines); k++)
      keep.add(k)
  })

  const hunks: DiffHunk[] = []
  let i = 0
  while (i < lines.length) {
    if (keep.has(i)) {
      const hunkLines: DiffLine[] = []
      while (i < lines.length && keep.has(i)) hunkLines.push(lines[i++])
      const firstOld = hunkLines.find(l => l.lineOld !== undefined)?.lineOld ?? 1
      const firstNew = hunkLines.find(l => l.lineNew !== undefined)?.lineNew ?? 1
      const addedC = hunkLines.filter(l => l.type === 'added').length
      const removedC = hunkLines.filter(l => l.type === 'removed').length
      const sameC = hunkLines.filter(l => l.type === 'same').length
      hunks.push({
        header: `@@ -${firstOld},${removedC + sameC} +${firstNew},${addedC + sameC} @@`,
        lines: hunkLines,
        collapsed: false,
      })
    } else {
      let count = 0
      while (i < lines.length && !keep.has(i)) { count++; i++ }
      hunks.push({ header: `… ${count} unchanged lines collapsed …`, lines: [], collapsed: true, collapsedCount: count })
    }
  }
  return hunks
}

// §14 main computeDiff — tiered strategy selection
export function computeDiff(oldText: string, newText: string): DiffResult {
  const eolStyle = detectEOL(oldText)
  const eolWarning: EOLStyle | null = eolStyle !== 'LF' ? eolStyle : null
  const normOld = normalizeEOL(oldText)
  const normNew = normalizeEOL(newText)

  const oldLines = normOld.split('\n')
  const newLines = normNew.split('\n')
  const maxLines = Math.max(oldLines.length, newLines.length)

  let flatLines: DiffLine[]
  let strategy: DiffResult['strategy']

  if (maxLines <= 800) {
    flatLines = myersLCS(oldLines, newLines)
    strategy = 'full'
  } else if (maxLines <= 5000) {
    flatLines = hirschberg(oldLines, newLines)
    strategy = 'hirschberg'
  } else {
    flatLines = contextualDiff(oldLines, newLines)
    strategy = 'contextual'
  }

  let truncated = false
  if (flatLines.length > MAX_DIFF_LINES_RENDERED) {
    flatLines = flatLines.slice(0, MAX_DIFF_LINES_RENDERED)
    truncated = true
  }

  const added = flatLines.filter(l => l.type === 'added').length
  const removed = flatLines.filter(l => l.type === 'removed').length
  const unchanged = flatLines.filter(l => l.type === 'same').length

  const hunks = buildHunks(flatLines)

  return { hunks, added, removed, unchanged, eolWarning, truncated, strategy }
}

// Legacy compat — old callers used DiffLine[] directly
export function diffStats(result: DiffResult | DiffLine[]): { added: number; removed: number; changed: boolean } {
  if (Array.isArray(result)) {
    const added = result.filter(d => d.type === 'added').length
    const removed = result.filter(d => d.type === 'removed').length
    return { added, removed, changed: added > 0 || removed > 0 }
  }
  return { added: result.added, removed: result.removed, changed: result.added > 0 || result.removed > 0 }
}

// Provider helpers (unchanged)
export function googleMimeForPath(path: string): string {
  const ext = path.split('.').pop()?.toLowerCase() ?? ''
  const map: Record<string, string> = {
    md: 'application/vnd.google-apps.document', txt: 'application/vnd.google-apps.document',
    docx: 'application/vnd.google-apps.document', xlsx: 'application/vnd.google-apps.spreadsheet',
    csv: 'application/vnd.google-apps.spreadsheet', pptx: 'application/vnd.google-apps.presentation',
    html: 'application/vnd.google-apps.document',
  }
  return map[ext] ?? 'text/plain'
}

export function microsoftFormatLabel(path: string): string {
  const ext = path.split('.').pop()?.toLowerCase() ?? ''
  if (['docx', 'doc'].includes(ext)) return 'Word Document'
  if (['xlsx', 'xls'].includes(ext)) return 'Excel Workbook'
  if (['pptx', 'ppt'].includes(ext)) return 'PowerPoint'
  return 'Plain File'
}

export const GOOGLE_CONVERTIBLE = new Set(['md', 'txt', 'docx', 'doc', 'xlsx', 'xls', 'csv', 'pptx', 'html'])
export const MICROSOFT_OFFICE_EXTS = new Set(['docx', 'doc', 'xlsx', 'xls', 'pptx', 'ppt'])
