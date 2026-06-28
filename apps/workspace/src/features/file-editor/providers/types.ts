export type ProviderStatus = 'connected' | 'disconnected' | 'checking' | 'error'
export type ProviderId = 'github' | 'microsoft' | 'google' | 'logiccode'

export interface ProviderAuthState {
  status: ProviderStatus
  userEmail?: string
  displayName?: string
}

export interface AllProviderAuth {
  github: ProviderAuthState
  microsoft: ProviderAuthState
  google: ProviderAuthState
}

export interface GitHubSaveTarget {
  provider: 'github'
  owner: string
  repo: string
  branch: string
  path: string
  commitMessage: string
  sha?: string
}

export interface MicrosoftSaveTarget {
  provider: 'microsoft'
  driveId?: string
  folderId?: string
  folderPath: string
  fileName: string
  conflictBehavior: 'rename' | 'replace' | 'fail'
  openInOffice: boolean
}

export interface GoogleSaveTarget {
  provider: 'google'
  folderId?: string
  folderPath: string
  fileName: string
  convertToGoogleDoc: boolean
}

export interface LogicCodeSaveTarget {
  provider: 'logiccode'
  fileName: string
  mimeType?: string
}

export type SaveTarget = GitHubSaveTarget | MicrosoftSaveTarget | GoogleSaveTarget | LogicCodeSaveTarget

// §12 — SaveErrorCode
export type SaveErrorCode =
  | 'RATE_LIMITED'
  | 'NETWORK_ERROR'
  | 'SERVER_ERROR'
  | 'TIMEOUT'
  | 'AUTH_EXPIRED'
  | 'PERMISSION_DENIED'
  | 'PATH_CONFLICT'
  | 'QUOTA_EXCEEDED'
  | 'INVALID_PATH'
  | 'FILE_TOO_LARGE'
  | 'PROVIDER_UNAVAILABLE'
  | 'UNKNOWN'

// §8.1 — SaveResult v1.1
export interface SaveResult {
  provider: ProviderId
  success: boolean
  fileUrl?: string
  fileId?: string
  message?: string
  errorCode?: SaveErrorCode
  errorMessage?: string
  raw?: Record<string, unknown>
  timestamp: string           // ISO 8601
  idempotencyKey: string      // 32-hex
  retryCount: number          // 0 = first attempt succeeded
  // legacy compat
  error?: string
}

// §8.2 — FileDraft
export interface FileDraft {
  draftId: string
  userId?: string
  path: string
  content: string
  cursorLine?: number
  cursorCol?: number
  timestamp: string
  source: 'local' | 'server'
  baseContentHash?: string
}

// §8.3 — DraftConflict
export interface DraftConflict {
  localDraft: FileDraft
  serverDraft?: FileDraft
  hasConflict: boolean
  newerSource: 'local' | 'server'
}

// DraftStatus — status callback shape
export interface DraftStatus {
  saving: boolean
  lastSaved: Date | null
  error: string | null
}

// §18 — PathValidationResult
export interface PathValidationResult {
  valid: boolean
  normalized?: string
  errors: string[]
  warnings: string[]
}

// §14.6 — Diff types
export type EOLStyle = 'LF' | 'CRLF' | 'CR' | 'mixed'

export interface WordDiffToken {
  text: string
  type: 'same' | 'added' | 'removed'
}

export interface DiffLine {
  type: 'same' | 'added' | 'removed'
  content: string
  lineOld?: number
  lineNew?: number
  wordDiff?: { old: WordDiffToken[]; new: WordDiffToken[] }
}

export interface DiffHunk {
  header: string
  lines: DiffLine[]
  collapsed: boolean
  collapsedCount?: number
}

export interface DiffResult {
  hunks: DiffHunk[]
  added: number
  removed: number
  unchanged: number
  eolWarning: EOLStyle | null
  truncated: boolean
  strategy: 'full' | 'hirschberg' | 'contextual'
}

// Mock folder data
export const MOCK_MS_FOLDERS = [
  { id: '1', name: 'Documents', path: '/Documents', depth: 0 },
  { id: '2', name: 'Work', path: '/Documents/Work', depth: 1 },
  { id: '3', name: 'Projects', path: '/Documents/Work/Projects', depth: 2 },
  { id: '4', name: 'Archive', path: '/Archive', depth: 0 },
  { id: '5', name: 'Templates', path: '/Templates', depth: 0 },
]

export const MOCK_GD_FOLDERS = [
  { id: 'root', name: 'My Drive', path: '/', depth: 0 },
  { id: 'gd1', name: 'Documents', path: '/Documents', depth: 1 },
  { id: 'gd2', name: 'Shared Work', path: '/Shared Work', depth: 1 },
  { id: 'gd3', name: 'Archives', path: '/Archives', depth: 1 },
]

export const MOCK_REPOS = [
  { full_name: 'org/repo-1', default_branch: 'main', branches: ['main', 'develop', 'staging'] },
  { full_name: 'org/repo-2', default_branch: 'main', branches: ['main', 'feature/auth'] },
  { full_name: 'org/repo-3', default_branch: 'trunk', branches: ['trunk', 'release'] },
]
