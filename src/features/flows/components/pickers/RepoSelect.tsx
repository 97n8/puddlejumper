import { useState, useRef, useEffect } from 'react'
import { pjApi } from '@/services/pjApi'
import { Input } from '@/components/ui/input'

interface GHRepo { full_name: string; private: boolean; pushed_at: string }

export function RepoSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [repos, setRepos] = useState<GHRepo[]>([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState(value || '')
  const [open, setOpen] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setLoading(true)
    pjApi.github.get('user/repos?per_page=100&sort=pushed&affiliation=owner,collaborator,organization_member')
      .then(r => setRepos((r as GHRepo[]) ?? []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const filtered = repos.filter(r => r.full_name.toLowerCase().includes(search.toLowerCase()))

  function select(name: string) {
    onChange(name)
    setSearch(name)
    setOpen(false)
  }

  return (
    <div className="relative">
      <Input
        ref={inputRef}
        value={search}
        onChange={e => { setSearch(e.target.value); setOpen(true) }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder={loading ? 'Loading repos…' : 'Search repos…'}
        className="text-sm"
      />
      {open && (filtered.length > 0 || search) && (
        <div className="absolute z-50 mt-1 w-full bg-popover border border-border rounded-lg shadow-lg max-h-48 overflow-y-auto">
          {filtered.slice(0, 30).map(r => (
            <button key={r.full_name} type="button"
              className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-muted text-left"
              onMouseDown={() => select(r.full_name)}>
              <span className="text-muted-foreground text-[10px]">{r.private ? '🔒' : '📦'}</span>
              {r.full_name}
            </button>
          ))}
          {filtered.length === 0 && search && (
            <div className="px-3 py-2 text-xs text-muted-foreground">No repos match. Type manually or check your GitHub connection.</div>
          )}
        </div>
      )}
    </div>
  )
}
