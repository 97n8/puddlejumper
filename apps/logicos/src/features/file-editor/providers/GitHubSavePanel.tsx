import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { GithubLogo, CheckCircle, WarningCircle, Spinner } from '@phosphor-icons/react'
import type { ProviderAuthState, GitHubSaveTarget } from './types'
import { MOCK_REPOS } from './types'
import { pjApi } from '@/services/pjApi'

interface GitHubSavePanelProps {
  auth: ProviderAuthState
  suggestedPath?: string
  mode: 'create' | 'edit'
  sha?: string
  onChange: (target: GitHubSaveTarget | null) => void
}

type RepoItem = { full_name: string; default_branch: string; branches: string[] }

export function GitHubSavePanel({ auth, suggestedPath, mode, sha, onChange }: GitHubSavePanelProps) {
  const [repos, setRepos] = useState<RepoItem[]>(MOCK_REPOS)
  const [loadingRepos, setLoadingRepos] = useState(false)
  const [selectedRepo, setSelectedRepo] = useState(MOCK_REPOS[0].full_name)
  const [branch, setBranch] = useState(MOCK_REPOS[0].default_branch)
  const [path, setPath] = useState(suggestedPath ?? '')
  const [commitMessage, setCommitMessage] = useState(
    mode === 'create' ? `Create ${suggestedPath ?? 'file'}` : `Update ${suggestedPath ?? 'file'}`
  )

  useEffect(() => {
    if (auth.status !== 'connected') return
    setLoadingRepos(true)
    pjApi.github.get<Array<{ id: number; name: string; full_name: string; default_branch: string }>>('user/repos?sort=updated&per_page=30&affiliation=owner,collaborator')
      .then(repoList => {
        if (repoList?.length) {
          const mapped = repoList.map(r => ({
            full_name: r.full_name,
            default_branch: r.default_branch ?? 'main',
            branches: [r.default_branch ?? 'main'],
          }))
          setRepos(mapped)
          setSelectedRepo(mapped[0].full_name)
          setBranch(mapped[0].default_branch)
        }
      })
      .catch(() => { /* repo list is best-effort; user can retry */ })
      .finally(() => setLoadingRepos(false))
  }, [auth.status])

  const repo = repos.find(r => r.full_name === selectedRepo) ?? repos[0]

  useEffect(() => {
    setPath(suggestedPath ?? '')
    setCommitMessage(mode === 'create' ? `Create ${suggestedPath ?? 'file'}` : `Update ${suggestedPath ?? 'file'}`)
  }, [suggestedPath, mode])

  useEffect(() => {
    if (auth.status !== 'connected') {
      onChange(null)
      return
    }
    const [owner, repoName] = selectedRepo.split('/')
    if (!owner || !repoName || !branch || !path.trim() || !commitMessage.trim()) {
      onChange(null)
      return
    }
    onChange({
      provider: 'github',
      owner,
      repo: repoName,
      branch,
      path: path.trim(),
      commitMessage: commitMessage.trim(),
      sha: mode === 'edit' ? sha : undefined,
    })
  }, [auth.status, selectedRepo, branch, path, commitMessage, mode, sha, onChange])

  if (auth.status !== 'connected') {
    return (
      <div className="flex flex-col items-center justify-center gap-5 py-10 px-4 text-center">
        <div className="w-14 h-14 rounded-2xl bg-muted border border-border flex items-center justify-center">
          <GithubLogo size={30} className="text-foreground/70" />
        </div>
        <div>
          <p className="text-sm font-semibold text-foreground mb-1">Connect GitHub</p>
          <p className="text-xs text-muted-foreground leading-relaxed">Link your account to commit files directly to any of your repositories.</p>
        </div>
        <Button
          className="bg-primary text-primary-foreground hover:bg-primary/90 gap-2 h-9 px-5 text-sm"
          onClick={() => pjApi.connectors.connect('github')}
        >
          <GithubLogo size={15} />
          Connect GitHub
        </Button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2 text-xs text-emerald-500 bg-emerald-500/10 border border-emerald-500/20 rounded-md px-3 py-2">
        <CheckCircle size={14} weight="fill" />
        <span>Connected{auth.userEmail ? ` as ${auth.userEmail}` : ''}</span>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
          Repository
          {loadingRepos && <Spinner size={12} className="animate-spin text-muted-foreground/70" />}
        </Label>
        <Select value={selectedRepo} onValueChange={(v) => {
          setSelectedRepo(v)
          const r = repos.find(x => x.full_name === v)
          if (r) setBranch(r.default_branch)
        }}>
          <SelectTrigger className="bg-muted border-border text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-muted border-border">
            {repos.map(r => (
              <SelectItem key={r.full_name} value={r.full_name}>{r.full_name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label className="text-xs text-muted-foreground">Branch</Label>
        <Select value={branch} onValueChange={setBranch}>
          <SelectTrigger className="bg-muted border-border text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-muted border-border">
            {repo.branches.map(b => (
              <SelectItem key={b} value={b}>{b}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label className="text-xs text-muted-foreground">File Path</Label>
        <Input
          value={path}
          onChange={(e) => setPath(e.target.value)}
          disabled={mode === 'edit'}
          placeholder="src/components/MyFile.tsx"
          className="bg-muted border-border text-sm font-mono"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label className="text-xs text-muted-foreground">Commit Message</Label>
        <Input
          value={commitMessage}
          onChange={(e) => setCommitMessage(e.target.value)}
          placeholder="Describe your changes"
          className="bg-muted border-border text-sm"
        />
      </div>

      {mode === 'edit' ? (
        <div className="flex items-start gap-2 text-xs text-amber-400 bg-amber-950/30 border border-amber-900/50 rounded-md px-3 py-2">
          <WarningCircle size={14} weight="fill" className="mt-0.5 shrink-0" />
          <span>This will overwrite the existing file at <code className="font-mono">{path}</code> in <code className="font-mono">{branch}</code>.</span>
        </div>
      ) : (
        <div className="flex items-start gap-2 text-xs text-emerald-400 bg-emerald-950/30 border border-emerald-900/50 rounded-md px-3 py-2">
          <CheckCircle size={14} weight="fill" className="mt-0.5 shrink-0" />
          <span>A new file will be created at <code className="font-mono">{path || '(enter path)'}</code> in <code className="font-mono">{branch}</code>.</span>
        </div>
      )}
    </div>
  )
}
