import { useState, useEffect, useCallback } from 'react'
import { pjApi } from '@/services/pjApi'
import type { ImportRepoResult } from '@/services/pjApi'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import {
  GitBranch, GithubLogo, GoogleDriveLogo, MicrosoftExcelLogo,
  CloudArrowDown, Check, X, Spinner, ArrowClockwise, File, Folder,
} from '@phosphor-icons/react'
import { toast } from 'sonner'

export interface RepoImportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

type DialogState = 'idle' | 'loading-tree' | 'ready' | 'importing' | 'done'

interface RepoInfo {
  name: string
  fullName: string
  description: string | null
  defaultBranch: string
  branches: string[]
  fileCount: number
  topLevel: Array<{ name: string; type: 'tree' | 'blob' }>
}

function parseRepoInput(input: string): { owner: string; repo: string } | null {
  const trimmed = input.trim()
  // https://github.com/owner/repo or github.com/owner/repo
  const urlMatch = trimmed.match(/(?:https?:\/\/)?github\.com\/([^/]+)\/([^/\s?#]+)/)
  if (urlMatch) return { owner: urlMatch[1], repo: urlMatch[2].replace(/\.git$/, '') }
  // owner/repo
  const slashMatch = trimmed.match(/^([^/\s]+)\/([^/\s]+)$/)
  if (slashMatch) return { owner: slashMatch[1], repo: slashMatch[2].replace(/\.git$/, '') }
  return null
}

export function RepoImportDialog({ open, onOpenChange }: RepoImportDialogProps) {
  const [state, setState] = useState<DialogState>('idle')
  const [repoInput, setRepoInput] = useState('')
  const [repoInfo, setRepoInfo] = useState<RepoInfo | null>(null)
  const [selectedBranch, setSelectedBranch] = useState('')
  const [targetProvider, setTargetProvider] = useState<'google' | 'microsoft' | 'github'>('google')
  const [googleFolderId, setGoogleFolderId] = useState('')
  const [msBasePath, setMsBasePath] = useState('')
  const [githubTargetRepo, setGithubTargetRepo] = useState('')
  const [githubBasePath, setGithubBasePath] = useState('')
  const [basePath, setBasePath] = useState('')
  const [connectedProviders, setConnectedProviders] = useState<Set<string>>(new Set())
  const [result, setResult] = useState<ImportRepoResult | null>(null)
  const [importProgress, setImportProgress] = useState(0)
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    pjApi.connectors.status().then(res => {
      const connected = new Set<string>()
      if (res.connectors?.github?.connected) connected.add('github')
      if (res.connectors?.google?.connected) connected.add('google')
      if (res.connectors?.microsoft?.connected) connected.add('microsoft')
      setConnectedProviders(connected)
      if (connected.has('google')) setTargetProvider('google')
      else if (connected.has('microsoft')) setTargetProvider('microsoft')
      else if (connected.has('github')) setTargetProvider('github')
    }).catch(() => {})
  }, [open])

  const resetDialog = useCallback(() => {
    setState('idle')
    setRepoInput('')
    setRepoInfo(null)
    setSelectedBranch('')
    setBasePath('')
    setResult(null)
    setLoadError(null)
    setImportProgress(0)
  }, [])

  useEffect(() => {
    if (!open) resetDialog()
  }, [open, resetDialog])

  const loadTree = useCallback(async () => {
    const parsed = parseRepoInput(repoInput)
    if (!parsed) { setLoadError('Enter a valid GitHub repo (owner/repo or URL)'); return; }
    setState('loading-tree')
    setLoadError(null)
    try {
      const { owner, repo } = parsed
      const [repoData, branchesData] = await Promise.all([
        pjApi.github.get(`repos/${owner}/${repo}`) as Promise<{
          name: string; full_name: string; description: string | null; default_branch: string
        }>,
        pjApi.github.get(`repos/${owner}/${repo}/branches?per_page=50`) as Promise<Array<{ name: string }>>,
      ])
      const defaultBranch = repoData.default_branch ?? 'main'
      const branchRes = await pjApi.github.get(`repos/${owner}/${repo}/branches/${defaultBranch}`) as {
        commit?: { commit?: { tree?: { sha?: string } } }
      }
      const treeSha = branchRes.commit?.commit?.tree?.sha
      const treeData = treeSha
        ? await pjApi.github.get(`repos/${owner}/${repo}/git/trees/${treeSha}?recursive=1`) as {
            tree?: Array<{ path?: string; type?: string; size?: number }>
          }
        : { tree: [] }

      const blobs = (treeData.tree ?? []).filter(n => n.type === 'blob' && (n.size ?? 0) <= 1_000_000)

      // Top-level entries
      const topLevelMap = new Map<string, 'tree' | 'blob'>()
      for (const node of treeData.tree ?? []) {
        if (!node.path) continue
        const top = node.path.split('/')[0]
        if (!topLevelMap.has(top)) topLevelMap.set(top, node.type === 'tree' ? 'tree' : 'blob')
      }

      setRepoInfo({
        name: repoData.name,
        fullName: repoData.full_name,
        description: repoData.description,
        defaultBranch,
        branches: branchesData.map(b => b.name),
        fileCount: Math.min(blobs.length, 500),
        topLevel: Array.from(topLevelMap.entries()).slice(0, 20).map(([name, type]) => ({ name, type })),
      })
      setSelectedBranch(defaultBranch)
      setBasePath(repoData.name)
      setState('ready')
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Failed to load repository')
      setState('idle')
    }
  }, [repoInput])

  const handleImport = useCallback(async () => {
    if (!repoInfo) return
    const parsed = parseRepoInput(repoInput)
    if (!parsed) return
    setState('importing')
    setImportProgress(10)
    try {
      const res = await pjApi.importRepo({
        owner: parsed.owner,
        repo: parsed.repo,
        branch: selectedBranch || repoInfo.defaultBranch,
        targetProvider,
        targetFolderId: targetProvider === 'google' ? (googleFolderId || 'root') : undefined,
        targetDriveId: targetProvider === 'microsoft' ? undefined : undefined,
        targetRepo: targetProvider === 'github' ? githubTargetRepo : undefined,
        targetBasePath: targetProvider === 'github' ? (githubBasePath || basePath) : basePath || repoInfo.name,
        commitMessage: `Import ${repoInfo.fullName} into LogicOS`,
      })
      setImportProgress(100)
      setResult(res)
      setState('done')
      if (res.succeeded > 0) {
        toast.success(`Imported ${res.succeeded} files to ${targetProvider}`)
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Import failed')
      setState('ready')
    }
  }, [repoInfo, repoInput, selectedBranch, targetProvider, googleFolderId, githubTargetRepo, githubBasePath, basePath])

  const providerLabel = { google: 'Google Drive', microsoft: 'OneDrive', github: 'GitHub' }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <GitBranch size={18} className="text-primary" />
            Import GitHub Repo
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-1">

          {/* Repo URL input */}
          <div className="space-y-1.5">
            <Label className="text-xs">GitHub Repository</Label>
            <div className="flex gap-2">
              <Input
                value={repoInput}
                onChange={e => { setRepoInput(e.target.value); setLoadError(null) }}
                placeholder="owner/repo or https://github.com/owner/repo"
                className="h-8 text-sm flex-1"
                onKeyDown={e => e.key === 'Enter' && loadTree()}
                disabled={state === 'loading-tree' || state === 'importing'}
              />
              <Button
                size="sm"
                variant="outline"
                className="h-8 px-3 shrink-0"
                onClick={loadTree}
                disabled={!repoInput.trim() || state === 'loading-tree' || state === 'importing'}
              >
                {state === 'loading-tree'
                  ? <Spinner size={14} className="animate-spin" />
                  : <ArrowClockwise size={14} />}
                <span className="ml-1">{repoInfo ? 'Reload' : 'Load'}</span>
              </Button>
            </div>
            {loadError && <p className="text-xs text-destructive">{loadError}</p>}
          </div>

          {/* Repo info card */}
          {repoInfo && state !== 'idle' && (
            <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold">{repoInfo.fullName}</p>
                  {repoInfo.description && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{repoInfo.description}</p>}
                </div>
                <span className="text-xs bg-primary/10 text-primary border border-primary/20 rounded-full px-2 py-0.5 shrink-0">
                  {repoInfo.fileCount} files
                </span>
              </div>

              {/* Branch selector */}
              <div className="flex items-center gap-2">
                <GitBranch size={12} className="text-muted-foreground shrink-0" />
                <select
                  value={selectedBranch}
                  onChange={e => setSelectedBranch(e.target.value)}
                  className="text-xs bg-background border border-input rounded h-6 px-1.5 flex-1"
                  disabled={state === 'importing'}
                >
                  {repoInfo.branches.map(b => <option key={b} value={b}>{b}</option>)}
                </select>
              </div>

              {/* Top-level entries preview */}
              <div className="flex flex-wrap gap-1 max-h-20 overflow-y-auto">
                {repoInfo.topLevel.map(entry => (
                  <span key={entry.name} className="flex items-center gap-0.5 text-[10px] bg-muted border border-border rounded px-1.5 py-0.5">
                    {entry.type === 'tree'
                      ? <Folder size={9} className="text-yellow-500" />
                      : <File size={9} className="text-muted-foreground" />}
                    {entry.name}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Target provider tabs */}
          {(state === 'ready' || state === 'importing' || state === 'done') && repoInfo && (
            <div className="space-y-1.5">
              <Label className="text-xs">Save to</Label>
              <Tabs value={targetProvider} onValueChange={v => setTargetProvider(v as typeof targetProvider)}>
                <TabsList className="h-auto p-0 bg-transparent gap-1.5 flex flex-wrap">
                  {([
                    { key: 'google' as const, label: 'Google Drive', icon: <GoogleDriveLogo size={14} weight="fill" className="text-[#4285F4]" /> },
                    { key: 'microsoft' as const, label: 'OneDrive', icon: <MicrosoftExcelLogo size={14} weight="fill" className="text-[#0078D4]" /> },
                    { key: 'github' as const, label: 'GitHub', icon: <GithubLogo size={14} /> },
                  ]).map(p => (
                    <TabsTrigger
                      key={p.key}
                      value={p.key}
                      disabled={!connectedProviders.has(p.key) || state === 'importing'}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors
                        data-[state=active]:border-primary data-[state=active]:bg-primary/5 data-[state=active]:text-primary
                        border-border text-muted-foreground hover:border-foreground/40
                        disabled:opacity-40 disabled:cursor-not-allowed`}
                    >
                      {p.icon}
                      {p.label}
                      {!connectedProviders.has(p.key) && <span className="text-[9px]">(not connected)</span>}
                    </TabsTrigger>
                  ))}
                </TabsList>

                <TabsContent value="google" className="mt-3 space-y-2">
                  <div className="space-y-1">
                    <Label className="text-xs">Destination Folder ID</Label>
                    <Input
                      value={googleFolderId}
                      onChange={e => setGoogleFolderId(e.target.value)}
                      placeholder="root (or paste a Google Drive folder ID)"
                      className="h-8 text-sm"
                      disabled={state === 'importing'}
                    />
                    <p className="text-[10px] text-muted-foreground">Leave blank to save to My Drive root. Subfolders will be created automatically.</p>
                  </div>
                </TabsContent>

                <TabsContent value="microsoft" className="mt-3 space-y-2">
                  <div className="space-y-1">
                    <Label className="text-xs">Base Path (optional)</Label>
                    <Input
                      value={msBasePath}
                      onChange={e => setMsBasePath(e.target.value)}
                      placeholder="e.g. Documents/Imports"
                      className="h-8 text-sm"
                      disabled={state === 'importing'}
                    />
                    <p className="text-[10px] text-muted-foreground">Subfolder path in your OneDrive. Leave blank for root.</p>
                  </div>
                </TabsContent>

                <TabsContent value="github" className="mt-3 space-y-2">
                  <div className="space-y-1">
                    <Label className="text-xs">Target Repository</Label>
                    <Input
                      value={githubTargetRepo}
                      onChange={e => setGithubTargetRepo(e.target.value)}
                      placeholder="owner/repo"
                      className="h-8 text-sm"
                      disabled={state === 'importing'}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Base Path in Repo</Label>
                    <Input
                      value={githubBasePath}
                      onChange={e => setGithubBasePath(e.target.value)}
                      placeholder={`imported/${repoInfo?.name ?? 'repo'}`}
                      className="h-8 text-sm"
                      disabled={state === 'importing'}
                    />
                  </div>
                </TabsContent>
              </Tabs>
            </div>
          )}

          {/* Base path field */}
          {(state === 'ready' || state === 'importing' || state === 'done') && repoInfo && targetProvider !== 'github' && (
            <div className="space-y-1">
              <Label className="text-xs">Import Base Path</Label>
              <Input
                value={basePath}
                onChange={e => setBasePath(e.target.value)}
                placeholder={repoInfo.name}
                className="h-8 text-sm"
                disabled={state === 'importing'}
              />
              <p className="text-[10px] text-muted-foreground">All files will be placed under this path. Defaults to the repo name.</p>
            </div>
          )}

          {/* Import progress */}
          {state === 'importing' && (
            <div className="space-y-2 py-1">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5"><Spinner size={12} className="animate-spin" /> Importing files…</span>
                <span>{importProgress}%</span>
              </div>
              <Progress value={importProgress} className="h-1.5" />
            </div>
          )}

          {/* Done result */}
          {state === 'done' && result && (
            <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-2">
              <div className="flex items-center gap-2">
                <Check size={16} className="text-emerald-500" weight="bold" />
                <span className="text-sm font-medium">Import complete</span>
              </div>
              <div className="flex gap-4 text-xs">
                <span className="text-emerald-600 font-medium">{result.succeeded} succeeded</span>
                {result.failed > 0 && <span className="text-destructive font-medium">{result.failed} failed</span>}
                {result.skipped > 0 && <span className="text-muted-foreground">{result.skipped} skipped (too large)</span>}
              </div>
              {result.failed > 0 && (
                <div className="max-h-28 overflow-y-auto space-y-0.5">
                  {result.manifest.filter(m => !m.success).map(m => (
                    <div key={m.path} className="flex items-center gap-1.5 text-[10px] text-destructive">
                      <X size={9} weight="bold" />
                      <span className="font-mono truncate">{m.path}</span>
                      <span className="text-muted-foreground shrink-0">— {m.error}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} disabled={state === 'importing'}>
            {state === 'done' ? 'Close' : 'Cancel'}
          </Button>
          {(state === 'ready') && repoInfo && (
            <Button
              size="sm"
              onClick={handleImport}
              disabled={targetProvider === 'github' && !githubTargetRepo}
              className="gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90"
            >
              <CloudArrowDown size={14} />
              Import {repoInfo.fileCount} files to {providerLabel[targetProvider]}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
