import { useState, useEffect, useCallback, useRef } from 'react'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { pjBase } from '@/services/pjBase'
import { pjApi } from '@/services/pjApi'
import {
  GithubLogo, MicrosoftExcelLogo, GoogleDriveLogo,
  FloppyDisk, Code, GitDiff, Link, CheckCircle, XCircle,
  Spinner, BookOpen, Warning, ArrowClockwise, Clock, CloudArrowUp, CaretDown,
} from '@phosphor-icons/react'
import { toast } from 'sonner'
import { DiffViewer } from './DiffViewer'
import { DraftRecoveryDialog } from './DraftRecoveryDialog'
import { DraftService } from './providers/draftService'
import { GitHubSavePanel } from './providers/GitHubSavePanel'
import { MicrosoftSavePanel } from './providers/MicrosoftSavePanel'
import { GoogleSavePanel } from './providers/GoogleSavePanel'
import { LogicCodeSavePanel } from './providers/LogicCodeSavePanel'
import {
  validatePath, generateIdempotencyKey, isRetryable, errorCodeLabel, isBinaryPath
} from './utils'
import type {
  AllProviderAuth, GitHubSaveTarget, MicrosoftSaveTarget,
  GoogleSaveTarget, LogicCodeSaveTarget, SaveResult, DraftConflict, DraftStatus,
  SaveErrorCode,
} from './providers/types'
import { CodeEditor } from './CodeEditor'

export interface FileEditorProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  mode: 'create' | 'edit'
  initialPath?: string
  initialContent?: string
  fileSha?: string
  userId?: string
  onSave?: (path: string, content: string, message: string, sha?: string) => Promise<void>
  onSaveMulti?: (results: SaveResult[]) => Promise<void>
  onPublishAsTemplate?: (content: string, path: string) => void
}

const MOCK_AUTH: AllProviderAuth = {
  github: { status: 'disconnected' },
  microsoft: { status: 'disconnected' },
  google: { status: 'disconnected' },
}

type ProviderKey = 'github' | 'microsoft' | 'google' | 'logiccode'

const PJ = pjBase

async function sleep(ms: number) { return new Promise<void>(r => setTimeout(r, ms)) }

/** Encode content as base64, handling UTF-8 characters correctly */
function toBase64(str: string): string {
  return btoa(unescape(encodeURIComponent(str)))
}

/** Extract a human-readable message from a cloud save error string.
 *  PJ sometimes returns raw provider JSON (e.g. Microsoft Graph error objects).
 *  Returns { message, isAuthError } so callers can offer a reconnect flow.
 */
function parseCloudError(raw: string | undefined): { message: string; isAuthError: boolean } {
  if (!raw) return { message: 'Unknown error', isAuthError: false }
  // Look for embedded JSON like `...failed: {...}`
  const jsonMatch = raw.match(/(\{.*\})/s)
  if (jsonMatch) {
    try {
      const obj = JSON.parse(jsonMatch[1]) as { code?: string; message?: string }
      const code = obj.code ?? ''
      const msg = obj.message ?? ''
      const isAuthError = /InvalidAuthenticationToken|InvalidToken|AuthenticationError|Unauthorized|expired|revoked/i.test(code + msg)
      const humanMsg = isAuthError
        ? 'Session expired — reconnect to continue'
        : (msg || code || raw)
      return { message: humanMsg, isAuthError }
    } catch { /* fall through */ }
  }
  const isAuthError = /auth|token|unauthorized|401|expired|revoked/i.test(raw)
  return {
    message: isAuthError ? 'Session expired — reconnect to continue' : raw,
    isAuthError,
  }
}


function buildCloudSaveBody(target: GitHubSaveTarget | MicrosoftSaveTarget | GoogleSaveTarget, content: string): import('@/services/pjApi').CloudSaveBatchItem {
  const contentBase64 = toBase64(content)
  if (target.provider === 'github') {
    return {
      provider: 'github',
      filename: target.path.split('/').pop() ?? target.path,
      contentBase64,
      githubRepo: `${target.owner}/${target.repo}`,
      githubPath: target.path,
      githubMessage: target.commitMessage,
    }
  }
  if (target.provider === 'microsoft') {
    return {
      provider: 'microsoft',
      filename: target.fileName,
      contentBase64,
      folderId: target.folderId,
      driveId: target.driveId,
      conflictBehavior: target.conflictBehavior,
    }
  }
  return {
    provider: 'google',
    filename: target.fileName,
    contentBase64,
    folderId: target.folderId,
    targetMimeType: target.convertToGoogleDoc ? googleConvertMime(target.fileName) : undefined,
  }
}

function googleConvertMime(filename: string): string | undefined {
  const ext = filename.split('.').pop()?.toLowerCase() ?? ''
  if (['md', 'txt', 'docx', 'doc', 'html'].includes(ext)) return 'application/vnd.google-apps.document'
  if (['xlsx', 'xls', 'csv'].includes(ext)) return 'application/vnd.google-apps.spreadsheet'
  if (['pptx'].includes(ext)) return 'application/vnd.google-apps.presentation'
  return undefined
}

export function FileEditor({
  open, onOpenChange, mode, initialPath = '', initialContent = '',
  fileSha, userId, onSave, onSaveMulti, onPublishAsTemplate,
}: FileEditorProps) {
  const [path, setPath] = useState(initialPath)
  const [content, setContent] = useState(initialContent)
  const [viewMode, setViewMode] = useState<'edit' | 'diff'>('edit')
  const [auth, setAuth] = useState<AllProviderAuth>(MOCK_AUTH)
  const [activeProvider, setActiveProvider] = useState<ProviderKey>('logiccode')
  const [githubTarget, setGithubTarget] = useState<GitHubSaveTarget | null>(null)
  const [microsoftTarget, setMicrosoftTarget] = useState<MicrosoftSaveTarget | null>(null)
  const [googleTarget, setGoogleTarget] = useState<GoogleSaveTarget | null>(null)
  const [logicCodeTarget, setLogicCodeTarget] = useState<LogicCodeSaveTarget | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveResults, setSaveResults] = useState<Array<SaveResult & { label: string }>>([])
  const [pathError, setPathError] = useState<string | null>(null)
  const [draftConflict, setDraftConflict] = useState<DraftConflict | null>(null)
  const [showDraftDialog, setShowDraftDialog] = useState(false)
  const [draftStatus, setDraftStatus] = useState<DraftStatus | null>(null)
  const [cursor, setCursor] = useState({ line: 1, col: 1 })
  const [showMobileProviders, setShowMobileProviders] = useState(false)
  const [typePickerDismissed, setTypePickerDismissed] = useState(false)
  const [multiSaveMode, setMultiSaveMode] = useState(false)
  const [multiSaveSelected, setMultiSaveSelected] = useState<Set<ProviderKey>>(new Set())

  const contentRef = useRef(content)
  const cursorRef = useRef(cursor)
  const draftServiceRef = useRef<DraftService | null>(null)

  useEffect(() => { contentRef.current = content }, [content])
  useEffect(() => { cursorRef.current = cursor }, [cursor])

  // Fetch real connector status — enriches auth with account email
  const refreshAuth = useCallback(() => {
    pjApi.connectors.status().then(res => {
      if (res.connectors) {
        setAuth({
          github: {
            status: res.connectors.github?.connected ? 'connected' : 'disconnected',
            userEmail: res.connectors.github?.account,
          },
          microsoft: {
            status: res.connectors.microsoft?.connected ? 'connected' : 'disconnected',
            userEmail: res.connectors.microsoft?.account,
          },
          google: {
            status: res.connectors.google?.connected ? 'connected' : 'disconnected',
            userEmail: res.connectors.google?.account,
          },
        })
      }
    }).catch(() => {})
  }, [])

  useEffect(() => {
    refreshAuth()
    // Re-check auth when user returns from OAuth redirect
    const onFocus = () => refreshAuth()
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [refreshAuth])

  // Path validation
  useEffect(() => {
    if (!path) { setPathError(null); return }
    const result = validatePath(path)
    setPathError(result.errors[0] ?? null)
  }, [path])

  // Dialog open/close lifecycle
  useEffect(() => {
    if (!open) {
      draftServiceRef.current?.stop()
      draftServiceRef.current = null
      return
    }
    setPath(initialPath)
    setContent(initialContent)
    contentRef.current = initialContent
    setViewMode('edit')
    setSaveResults([])
    setPathError(null)
    setDraftStatus(null)
    setTypePickerDismissed(false)

    if (isBinaryPath(initialPath)) return

    const svc = new DraftService(initialPath, initialContent, userId)
    draftServiceRef.current = svc

    svc.loadDrafts(initialContent).then(conflict => {
      if (conflict) {
        setDraftConflict(conflict)
        setShowDraftDialog(true)
      } else {
        svc.start(
          () => contentRef.current,
          () => cursorRef.current,
          setDraftStatus,
        )
      }
    })
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  const isUnchanged = mode === 'edit' ? content === initialContent : !content.trim()
  const binary = isBinaryPath(path)

  const activeTargets = [
    githubTarget && auth.github.status === 'connected' ? githubTarget : null,
    microsoftTarget && auth.microsoft.status === 'connected' ? microsoftTarget : null,
    googleTarget && auth.google.status === 'connected' ? googleTarget : null,
    logicCodeTarget,
  ].filter((t): t is GitHubSaveTarget | MicrosoftSaveTarget | GoogleSaveTarget | LogicCodeSaveTarget => t !== null)

  const handleSave = useCallback(async (retryProvider?: string) => {
    if (saving || !activeTargets.length) return
    const iKey = generateIdempotencyKey()
    setSaving(true)

    const targets = retryProvider
      ? activeTargets.filter(t => t.provider === retryProvider)
      : activeTargets

    // Multi-save mode: batch all cloud targets in one call
    const cloudTargets = targets.filter(t =>
      t.provider !== 'logiccode' && (!multiSaveMode || multiSaveSelected.has(t.provider as ProviderKey))
    ) as Array<GitHubSaveTarget | MicrosoftSaveTarget | GoogleSaveTarget>
    const logicTarget = targets.find(t => t.provider === 'logiccode') as LogicCodeSaveTarget | undefined

    const results: Array<SaveResult & { label: string }> = []
    const providerLabels: Record<string, string> = { github: 'GitHub', microsoft: 'Microsoft 365', google: 'Google Drive', logiccode: 'Workspace' }

    // Save to Workspace vault
    if (logicTarget && PJ) {
      try {
        const res = await fetch(`${PJ}/api/vault-files`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json', 'Idempotency-Key': iKey, 'x-puddlejumper-request': 'true' },
          body: JSON.stringify({
            name: logicTarget.fileName,
            mimeType: logicTarget.mimeType ?? 'text/plain',
            size: new TextEncoder().encode(content).length,
            contentBase64: toBase64(content),
          }),
        })
        const json = await res.json() as { id?: string; url?: string; error?: string }
        results.push({
          provider: 'logiccode', success: res.ok && !json.error,
          fileId: json.id,
          errorCode: !res.ok || json.error ? 'SERVER_ERROR' : undefined,
          errorMessage: json.error,
          timestamp: new Date().toISOString(), idempotencyKey: iKey, retryCount: 0, label: 'Workspace',
        })
      } catch {
        results.push({ provider: 'logiccode', success: false, errorCode: 'NETWORK_ERROR', errorMessage: 'Network error', timestamp: new Date().toISOString(), idempotencyKey: iKey, retryCount: 0, label: 'Workspace' })
      }
    }

    // Batch save cloud targets
    if (cloudTargets.length > 0 && PJ) {
      if (cloudTargets.length > 1 || multiSaveMode) {
        try {
          const items = cloudTargets.map(t => buildCloudSaveBody(t, content))
          const batchRes = await pjApi.cloudSaveBatch(items)
          for (let i = 0; i < cloudTargets.length; i++) {
            const t = cloudTargets[i]
            const r = batchRes.results[i]
            results.push({
              provider: t.provider, success: r?.success ?? false,
              fileId: r?.fileId, fileUrl: r?.url,
              errorCode: r?.success ? undefined : 'SERVER_ERROR',
              errorMessage: r?.error,
              timestamp: new Date().toISOString(), idempotencyKey: iKey, retryCount: 0,
              label: providerLabels[t.provider] ?? t.provider,
            })
          }
        } catch {
          cloudTargets.forEach(t => results.push({
            provider: t.provider, success: false, errorCode: 'NETWORK_ERROR', errorMessage: 'Network error',
            timestamp: new Date().toISOString(), idempotencyKey: iKey, retryCount: 0, label: providerLabels[t.provider] ?? t.provider,
          }))
        }
      } else {
        // Single cloud target — use original per-provider save with retries
        for (const target of cloudTargets) {
          const providerLabel = providerLabels[target.provider] ?? target.provider
          let lastResult: (SaveResult & { label: string }) | null = null
          for (let attempt = 0; attempt < 3; attempt++) {
            if (attempt > 0) await sleep(500 * Math.pow(2, attempt - 1))
            try {
              const res = await fetch(`${PJ}/api/cloud-save`, {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json', 'Idempotency-Key': iKey, 'x-puddlejumper-request': 'true' },
                body: JSON.stringify(buildCloudSaveBody(target, content)),
              })
              const json = await res.json() as { fileId?: string; url?: string; error?: string; code?: string }
              const success = res.ok && !json.error
              lastResult = {
                provider: target.provider, success, fileUrl: json.url, fileId: json.fileId,
                errorCode: !success ? (json.code as SaveResult['errorCode'] ?? 'UNKNOWN') : undefined,
                errorMessage: json.error,
                timestamp: new Date().toISOString(), idempotencyKey: iKey, retryCount: attempt, label: providerLabel,
              }
              if (success || !isRetryable(lastResult.errorCode)) break
            } catch {
              lastResult = { provider: target.provider, success: false, errorCode: 'NETWORK_ERROR', errorMessage: 'Network error', timestamp: new Date().toISOString(), idempotencyKey: iKey, retryCount: attempt, label: providerLabel }
              if (attempt === 2) break
            }
          }
          if (lastResult) results.push(lastResult)
        }
      }
    } else if (cloudTargets.length > 0 && !PJ) {
      // Fallback without PJ
      for (const target of cloudTargets) {
        if (target.provider === 'github' && onSave && githubTarget) {
          await onSave(githubTarget.path, content, githubTarget.commitMessage, fileSha)
          results.push({ provider: 'github', success: true, fileUrl: `https://github.com/${githubTarget.owner}/${githubTarget.repo}/blob/${githubTarget.branch}/${githubTarget.path}`, timestamp: new Date().toISOString(), idempotencyKey: iKey, retryCount: 0, label: 'GitHub' })
        } else {
          await sleep(400)
          results.push({ provider: target.provider, success: true, timestamp: new Date().toISOString(), idempotencyKey: iKey, retryCount: 0, label: providerLabels[target.provider] ?? target.provider })
        }
      }
    }

    setSaveResults(prev => {
      const updated = [...prev]
      results.forEach(r => {
        const idx = updated.findIndex(p => p.provider === r.provider)
        if (idx >= 0) updated[idx] = r; else updated.push(r)
      })
      return updated
    })

    if (results.every(r => r.success)) {
      await draftServiceRef.current?.discard()
      toast.success(`Saved to ${results.map(r => r.label).join(' + ')}`)
    } else {
      results.filter(r => !r.success).forEach(r => {
        const { message, isAuthError } = parseCloudError(r.errorMessage)
        if (isAuthError) {
          const provider = r.provider === 'microsoft' ? 'microsoft' : r.provider === 'google' ? 'google' : null
          toast.error(`${r.label}: ${message}`, {
            action: provider ? {
              label: `Reconnect ${r.label}`,
              onClick: () => pjApi.connectors.connect(provider as 'microsoft' | 'google'),
            } : undefined,
            duration: 8000,
          })
        } else {
          toast.error(`${r.label} save failed: ${message}`)
        }
      })
    }

    setSaving(false)
    if (onSaveMulti) await onSaveMulti(results)
  }, [saving, activeTargets, content, onSave, onSaveMulti, fileSha, githubTarget, multiSaveMode, multiSaveSelected])  

  const handleDraftRestore = (restoredContent: string) => {
    setContent(restoredContent)
    contentRef.current = restoredContent
    setShowDraftDialog(false)
    setDraftConflict(null)
    if (draftServiceRef.current) {
      draftServiceRef.current.start(() => contentRef.current, () => cursorRef.current, setDraftStatus)
    }
  }

  const handleDraftDiscard = () => {
    draftServiceRef.current?.discard()
    setShowDraftDialog(false)
    setDraftConflict(null)
    if (draftServiceRef.current) {
      draftServiceRef.current.start(() => contentRef.current, () => cursorRef.current, setDraftStatus)
    }
  }

  const FILE_STARTERS = [
    { label: 'TypeScript', ext: 'ts', emoji: '🟦', content: '// TypeScript\nexport {}\n' },
    { label: 'TSX', ext: 'tsx', emoji: '⚛️', content: 'export default function Component() {\n  return <div></div>\n}\n' },
    { label: 'Markdown', ext: 'md', emoji: '📝', content: '# Title\n\n' },
    { label: 'JSON', ext: 'json', emoji: '📦', content: '{\n  \n}\n' },
    { label: 'Python', ext: 'py', emoji: '🐍', content: '#!/usr/bin/env python3\n\n' },
    { label: 'SQL', ext: 'sql', emoji: '🗄️', content: '-- SQL\nSELECT\n' },
    { label: 'HTML', ext: 'html', emoji: '🌐', content: '<!DOCTYPE html>\n<html lang="en">\n<head><meta charset="UTF-8"><title>Title</title></head>\n<body>\n\n</body>\n</html>\n' },
    { label: 'CSS', ext: 'css', emoji: '🎨', content: '/* styles */\n\n' },
    { label: 'YAML', ext: 'yml', emoji: '⚙️', content: '# config\n\n' },
    { label: 'Plain text', ext: 'txt', emoji: '📄', content: '' },
  ] as const

  function applyStarter(ext: string, starterContent: string) {
    setPath(`untitled.${ext}`)
    setContent(starterContent)
    contentRef.current = starterContent
    setTypePickerDismissed(true)
  }

  const showTypePicker = mode === 'create' && !typePickerDismissed && !path && !content

  const fileName = path.split('/').pop() ?? path

  return (
    <>
      {showDraftDialog && draftConflict && (
        <DraftRecoveryDialog
          conflict={draftConflict}
          onRestore={handleDraftRestore}
          onDiscard={handleDraftDiscard}
        />
      )}

      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          role="dialog"
          aria-modal="true"
          aria-labelledby="file-editor-title"
          className="p-0 gap-0 border-border bg-background text-foreground overflow-hidden flex flex-col"
          style={{ maxWidth: '92vw', width: '92vw', height: '88vh', maxHeight: '88vh' }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-border bg-card flex-shrink-0">
            <div className="flex items-center gap-3 min-w-0">
              <BookOpen size={15} className="text-muted-foreground shrink-0" />
              <span id="file-editor-title" className="text-sm font-medium text-foreground truncate max-w-md">
                {path || 'untitled'}
              </span>
              {!isUnchanged && (
                <span className="w-2 h-2 rounded-full bg-amber-400 flex-shrink-0" title="Unsaved changes" />
              )}
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {/* Draft status */}
              {draftStatus && (
                <span className={`text-xs flex items-center gap-1 ${draftStatus.saving ? 'text-amber-400' : 'text-muted-foreground/70'}`}>
                  {draftStatus.saving
                    ? <><Spinner size={11} className="animate-spin" /> Saving draft…</>
                    : draftStatus.lastSaved
                    ? <><Clock size={11} /> Draft saved</>
                    : null
                  }
                </span>
              )}

              {/* Save result chips */}
              {saveResults.map(r => (
                <span key={r.provider}
                  title={!r.success ? (r.errorMessage ?? (r.errorCode ? errorCodeLabel(r.errorCode as SaveErrorCode) : undefined)) : undefined}
                  className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border font-medium
                    ${r.success ? 'bg-emerald-950/50 border-emerald-900/50 text-emerald-400' : 'bg-red-950/50 border-red-900/50 text-red-400'}`}
                >
                  {r.success
                    ? <CheckCircle size={11} weight="fill" />
                    : <XCircle size={11} weight="fill" />
                  }
                  {r.label}
                  {r.errorCode && !r.success && (
                    <span className="ml-0.5 px-1 rounded bg-red-500/20 text-[9px] uppercase tracking-wide">{r.errorCode}</span>
                  )}
                  {!r.success && isRetryable(r.errorCode) && (
                    <button onClick={() => handleSave(r.provider)}
                      className="ml-0.5 underline text-[10px] hover:no-underline flex items-center gap-0.5">
                      <ArrowClockwise size={9} /> retry
                    </button>
                  )}
                  {r.success && r.fileUrl && (
                    <a href={r.fileUrl} target="_blank" rel="noopener noreferrer nofollow"
                      className="ml-0.5"><Link size={10} /></a>
                  )}
                </span>
              ))}
            </div>
          </div>

          {/* Body */}
          <div className="flex flex-col md:flex-row flex-1 min-h-0">
            {/* Left: editor */}
            <div className="flex flex-col flex-1 min-h-0 min-w-0 border-b md:border-b-0 md:border-r border-border">
              {/* Sub-header: path + toggle */}
              <div className="flex flex-col flex-shrink-0">
                <div className="flex items-center gap-2 px-3 py-1.5 border-b border-border bg-card">
                  <span className="text-xs text-muted-foreground/70 shrink-0">Path</span>
                  <input
                    value={path}
                    onChange={e => setPath(e.target.value)}
                    aria-label="File path"
                    aria-invalid={!!pathError}
                    aria-describedby={pathError ? 'path-error' : undefined}
                    placeholder="src/filename.ts"
                    className="flex-1 bg-transparent text-xs font-mono outline-none placeholder:text-muted-foreground/50 text-foreground/80"
                  />
                  {mode === 'edit' && (
                    <div className="flex rounded-md overflow-hidden border border-border text-xs shrink-0">
                      <button
                        onClick={() => setViewMode('edit')}
                        className={`flex items-center gap-1.5 px-2.5 py-1 transition-colors ${viewMode === 'edit' ? 'bg-muted text-foreground' : 'text-muted-foreground hover:bg-muted'}`}
                      >
                        <Code size={12} /> Edit
                      </button>
                      <button
                        onClick={() => setViewMode('diff')}
                        className={`flex items-center gap-1.5 px-2.5 py-1 transition-colors ${viewMode === 'diff' ? 'bg-muted text-foreground' : 'text-muted-foreground hover:bg-muted'}`}
                      >
                        <GitDiff size={12} /> Diff
                      </button>
                    </div>
                  )}
                </div>
                {pathError && (
                  <div className="px-3 py-1 bg-red-950/30 border-b border-red-900/30">
                    <span id="path-error" role="alert" className="text-xs text-red-400 flex items-center gap-1">
                      <Warning size={11} /> {pathError}
                    </span>
                  </div>
                )}
              </div>

              {/* Editor content */}
              <div className="flex-1 min-h-0 overflow-hidden">
                {showTypePicker ? (
                  <div className="h-full flex flex-col items-center justify-center gap-8 p-8 bg-background">
                    <div className="text-center">
                      <div className="w-10 h-10 rounded-xl bg-muted border border-border flex items-center justify-center mx-auto mb-4">
                        <BookOpen size={20} className="text-muted-foreground" />
                      </div>
                      <p className="text-base font-semibold text-foreground">New file</p>
                      <p className="text-xs text-muted-foreground mt-1">Pick a type or type a path above to start blank</p>
                    </div>
                    <div className="grid grid-cols-5 gap-2 max-w-xs w-full">
                      {FILE_STARTERS.map(s => (
                        <button
                          key={s.ext}
                          onClick={() => applyStarter(s.ext, s.content)}
                          className="flex flex-col items-center gap-2 rounded-xl border border-border bg-card hover:bg-muted hover:border-border/80 px-2 py-4 transition-all text-center group"
                        >
                          <span className="text-lg leading-none">{s.emoji}</span>
                          <span className="text-[10px] font-medium text-muted-foreground group-hover:text-foreground leading-tight transition-colors">{s.label}</span>
                        </button>
                      ))}
                    </div>
                    <button
                      onClick={() => setTypePickerDismissed(true)}
                      className="text-xs text-muted-foreground/50 hover:text-muted-foreground transition-colors"
                    >
                      Start blank →
                    </button>
                  </div>
                ) : viewMode === 'edit' ? (
                  <CodeEditor
                    value={content}
                    onChange={setContent}
                    path={path}
                    onSaveShortcut={() => handleSave()}
                    onCursorChange={setCursor}
                    disabled={saving}
                  />
                ) : (
                  <DiffViewer
                    oldText={initialContent}
                    newText={content}
                  />
                )}
              </div>
            </div>

            {/* Right: providers — side panel on desktop, collapsible on mobile */}
            <div className="flex flex-col bg-background md:w-80 md:flex-shrink-0">
              {/* Mobile toggle header */}
              <button
                className="md:hidden flex items-center justify-between px-4 py-2.5 border-t border-border bg-card text-xs text-muted-foreground hover:text-foreground transition-colors"
                onClick={() => setShowMobileProviders(v => !v)}
              >
                <span className="flex items-center gap-2 font-medium">
                  <CloudArrowUp size={13} /> Save to cloud
                  {activeTargets.length > 0 && (
                    <span className="bg-emerald-600/30 text-emerald-400 border border-emerald-600/40 px-1.5 py-0.5 rounded-full text-[10px] font-bold">{activeTargets.length} configured</span>
                  )}
                </span>
                <CaretDown size={13} className={`transition-transform ${showMobileProviders ? 'rotate-180' : ''}`} />
              </button>
              <div className={`${showMobileProviders ? 'flex' : 'hidden'} md:flex flex-col flex-1`}>
              <Tabs value={activeProvider} onValueChange={(v) => setActiveProvider(v as ProviderKey)} className="flex flex-col h-full">
                <div className="flex items-center border-b border-border bg-card">
                  <TabsList
                    role="tablist"
                    aria-label="Save destination providers"
                    className="flex-1 rounded-none border-b-0 bg-card h-auto p-0"
                  >
                    {([
                      { key: 'github' as ProviderKey, label: 'GitHub', icon: <GithubLogo size={14} />, status: auth.github.status, hasTarget: !!githubTarget },
                      { key: 'microsoft' as ProviderKey, label: 'Microsoft', icon: <MicrosoftExcelLogo size={14} />, status: auth.microsoft.status, hasTarget: !!microsoftTarget },
                      { key: 'google' as ProviderKey, label: 'Google', icon: <GoogleDriveLogo size={14} />, status: auth.google.status, hasTarget: !!googleTarget },
                      { key: 'logiccode' as ProviderKey, label: 'Workspace', icon: <Code size={14} />, status: 'connected' as const, hasTarget: !!logicCodeTarget },
                    ] as const).map(p => (
                      <TabsTrigger
                        key={p.key}
                        value={p.key}
                        id={`tab-${p.key}`}
                        role="tab"
                        aria-selected={activeProvider === p.key}
                        aria-controls={`panel-${p.key}`}
                        className="flex-1 flex items-center gap-1.5 py-2.5 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent text-xs"
                      >
                        {multiSaveMode && p.key !== 'logiccode' && (
                          <span
                            role="checkbox"
                            aria-checked={multiSaveSelected.has(p.key)}
                            onClick={e => {
                              e.stopPropagation()
                              setMultiSaveSelected(prev => {
                                const next = new Set(prev)
                                if (next.has(p.key)) next.delete(p.key); else next.add(p.key)
                                return next
                              })
                            }}
                            className={`w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 transition-colors cursor-pointer
                              ${multiSaveSelected.has(p.key) ? 'bg-primary border-primary' : 'border-muted-foreground/40 bg-background'}`}
                          >
                            {multiSaveSelected.has(p.key) && <CheckCircle size={9} weight="fill" className="text-primary-foreground" />}
                          </span>
                        )}
                        {p.icon}
                        <span className="hidden sm:inline">{p.label}</span>
                        <span className={`w-1.5 h-1.5 rounded-full ${p.status === 'connected' ? 'bg-emerald-500' : p.status === 'checking' ? 'bg-amber-500 animate-pulse' : p.status === 'error' ? 'bg-red-500' : 'bg-muted-foreground/40'}`} />
                        {p.hasTarget && (
                          <CheckCircle size={10} weight="fill" className="text-emerald-400" />
                        )}
                      </TabsTrigger>
                    ))}
                  </TabsList>
                  <button
                    onClick={() => {
                      setMultiSaveMode(v => !v)
                      setMultiSaveSelected(new Set())
                    }}
                    title={multiSaveMode ? 'Exit multi-save mode' : 'Save to multiple providers at once'}
                    className={`shrink-0 px-2 py-1.5 text-[10px] font-medium border-l border-border transition-colors
                      ${multiSaveMode ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:text-foreground hover:bg-muted'}`}
                  >
                    Multi-save
                  </button>
                </div>

                <div className="flex-1 min-h-0 overflow-y-auto p-4">
                  <TabsContent value="github" id="panel-github" role="tabpanel" aria-labelledby="tab-github" className="mt-0 h-full">
                    <GitHubSavePanel
                      auth={auth.github}
                      suggestedPath={path}
                      mode={mode}
                      sha={fileSha}
                      onChange={setGithubTarget}
                    />
                  </TabsContent>
                  <TabsContent value="microsoft" id="panel-microsoft" role="tabpanel" aria-labelledby="tab-microsoft" className="mt-0 h-full">
                    <MicrosoftSavePanel
                      auth={auth.microsoft}
                      suggestedFileName={fileName}
                      onChange={setMicrosoftTarget}
                    />
                  </TabsContent>
                  <TabsContent value="google" id="panel-google" role="tabpanel" aria-labelledby="tab-google" className="mt-0 h-full">
                    <GoogleSavePanel
                      auth={auth.google}
                      suggestedFileName={fileName}
                      onChange={setGoogleTarget}
                    />
                  </TabsContent>
                  <TabsContent value="logiccode" id="panel-logiccode" role="tabpanel" aria-labelledby="tab-logiccode" className="mt-0 h-full">
                    <LogicCodeSavePanel
                      suggestedFileName={fileName}
                      onChange={setLogicCodeTarget}
                    />
                  </TabsContent>
                </div>
              </Tabs>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-4 py-2.5 border-t border-border bg-card flex-shrink-0">
            <div className="flex items-center gap-4 text-[10px] text-muted-foreground/70 font-mono" aria-label="File statistics">
              <span>Ln {cursor.line}, Col {cursor.col}</span>
              <span>{content.split('\n').length} lines</span>
              <span>{content.length} chars</span>
              {isUnchanged && <span className="text-muted-foreground/30">No changes</span>}
              {onPublishAsTemplate && content.trim() && !isUnchanged && (
                <button
                  onClick={() => onPublishAsTemplate(content, path)}
                  className="flex items-center gap-1.5 text-muted-foreground/70 hover:text-foreground/80 transition-colors"
                >
                  <BookOpen size={11} />
                  Publish as template
                </button>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => onOpenChange(false)}
                disabled={saving}
                className="border-border text-foreground/80 hover:bg-muted"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={() => handleSave()}
                disabled={saving || isUnchanged || !activeTargets.length || !!pathError || binary || (multiSaveMode && multiSaveSelected.size === 0 && !logicCodeTarget)}
                aria-busy={saving}
                aria-label={saving ? 'Saving…' : 'Save to selected providers'}
                className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {saving ? (
                  <><Spinner size={14} className="animate-spin" /> Saving…</>
                ) : multiSaveMode ? (
                  <><FloppyDisk size={14} /> {multiSaveSelected.size === 0 ? 'Select providers' : `Save to ${multiSaveSelected.size} provider${multiSaveSelected.size > 1 ? 's' : ''}`}</>
                ) : (
                  <><FloppyDisk size={14} /> {activeTargets.length === 0 ? 'Configure destination' : activeTargets.length === 1 ? `Save to ${{ github: 'GitHub', microsoft: 'Microsoft 365', google: 'Google Drive', logiccode: 'Workspace' }[activeTargets[0].provider] ?? activeTargets[0].provider}` : `Save to ${activeTargets.length} providers`}</>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
