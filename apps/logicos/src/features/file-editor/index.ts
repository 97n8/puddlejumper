export { FileEditor } from './FileEditor'
export type { FileEditorProps } from './FileEditor'
export { CodeEditor } from './CodeEditor'
export { DiffViewer } from './DiffViewer'
export { DraftRecoveryDialog } from './DraftRecoveryDialog'
export { DraftService } from './providers/draftService'
export {
  computeDiff, buildHunks, wordDiff,
  detectEOL, normalizeEOL, restoreEOL,
  validatePath, isBinaryPath,
  generateIdempotencyKey, isRetryable, errorCodeLabel, djb2,
  detectLanguage, LANGUAGE_META,
  diffStats,
  googleMimeForPath, microsoftFormatLabel,
  GOOGLE_CONVERTIBLE, MICROSOFT_OFFICE_EXTS,
} from './utils'
export type {
  SaveResult, SaveErrorCode, SaveTarget, ProviderId,
  AllProviderAuth, ProviderAuthState, ProviderStatus,
  GitHubSaveTarget, MicrosoftSaveTarget, GoogleSaveTarget,
  FileDraft, DraftConflict, DraftStatus,
  DiffResult, DiffHunk, DiffLine, WordDiffToken, EOLStyle,
  PathValidationResult,
} from './providers/types'
export { MOCK_MS_FOLDERS, MOCK_GD_FOLDERS, MOCK_REPOS } from './providers/types'
