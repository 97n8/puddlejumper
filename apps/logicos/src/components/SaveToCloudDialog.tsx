import { useState, useEffect, useCallback } from 'react'
import { pjApi } from '@/services/pjApi'
import type { VaultFile, VaultDoc } from '@/services/pjApi'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { createLogger } from '@/lib/logger'
import {
  GoogleLogo, MicrosoftExcelLogo, GithubLogo,
  CloudArrowUp, ArrowSquareOut, Check, HardDrive,
  FolderOpen, Folder, CaretRight, CaretDown, ArrowClockwise, GitBranch, Lock,
} from '@phosphor-icons/react'
import { RepoImportDialog } from '@/components/RepoImportDialog'

export interface CloudSaveTarget {
  provider: 'google' | 'microsoft' | 'github' | 'vault'
  filename: string
  /** Raw string or Uint8Array — will be base64-encoded */
  content: string | Uint8Array
  mimeType?: string
}

interface SaveToCloudDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  defaultTarget: CloudSaveTarget
}

// ── Microsoft destination picker ─────────────────────────────────────────────

interface MsDrive { id: string; name: string; driveType: string }
interface MsSite  { id: string; name: string; webUrl: string }
interface MsItem  { id: string; name: string; folder?: object; webUrl: string }

const logger = createLogger('SaveToCloudDialog')

type MsSource =
  | { kind: 'drive'; drive: MsDrive }
  | { kind: 'site';  site: MsSite; driveId: string | null }

interface FolderPickerNode {
  item: MsItem
  driveId: string
}

function MsFolderTree({ driveId, parentId, depth, selected, onSelect }: {
  driveId: string; parentId: string; depth: number
  selected: FolderPickerNode | null
  onSelect: (node: FolderPickerNode) => void
}) {
  const [children, setChildren] = useState<MsItem[]>([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    if (open) { setOpen(false); return }
    setOpen(true)
    if (children.length) return
    setLoading(true)
    try {
      const data = await pjApi.microsoft.get(
        `drives/${driveId}/items/${parentId}/children?$select=id,name,folder,webUrl&$filter=folder ne null&$top=50`
      ) as { value: MsItem[] }
      setChildren((data.value ?? []).filter(i => i.folder))
    } catch { setChildren([]) }
    finally { setLoading(false) }
  }, [driveId, parentId, open, children.length])

  if (children.length === 0 && open && !loading) return null

  return (
    <div>
      {children.map(item => {
        const isSelected = selected?.item.id === item.id
        return (
          <div key={item.id}>
            <div
              style={{ paddingLeft: `${depth * 14 + 8}px` }}
              className={`flex items-center gap-1.5 py-1 pr-2 rounded cursor-pointer text-xs
                ${isSelected ? 'bg-primary/10 text-primary font-medium' : 'hover:bg-muted text-foreground'}`}
            >
              <button onClick={() => load()} className="flex items-center gap-1 shrink-0">
                {open ? <CaretDown size={9} className="text-muted-foreground" /> : <CaretRight size={9} className="text-muted-foreground" />}
                {open ? <FolderOpen size={13} className="text-yellow-500" /> : <Folder size={13} className="text-yellow-500" />}
              </button>
              <span className="flex-1 truncate" onClick={() => onSelect({ item, driveId })}>
                {item.name}
              </span>
              {loading && <ArrowClockwise size={10} className="animate-spin text-muted-foreground shrink-0" />}
            </div>
            {open && (
              <MsFolderTree driveId={driveId} parentId={item.id} depth={depth + 1} selected={selected} onSelect={onSelect} />
            )}
          </div>
        )
      })}
    </div>
  )
}

function MicrosoftPicker({ selected, onSelect }: {
  selected: FolderPickerNode | null
  onSelect: (node: FolderPickerNode) => void
}) {
  const [drives, setDrives] = useState<MsDrive[]>([])
  const [sites, setSites] = useState<MsSite[]>([])
  const [sitesDriveId, setSitesDriveId] = useState<Record<string, string>>({})
  const [activeSource, setActiveSource] = useState<MsSource | null>(null)
  const [rootItems, setRootItems] = useState<MsItem[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    Promise.all([
      pjApi.microsoft.get('me/drives?$select=id,name,driveType').then((d: unknown) => setDrives(((d as Record<string,unknown>).value as typeof drives) ?? [])).catch(() => {}),
      pjApi.microsoft.get('me/followedSites?$select=id,displayName,webUrl').then((d: unknown) => {
        setSites(((d as Record<string,unknown>).value as Array<{id:string;displayName?:string;name?:string;webUrl:string}> ?? []).map((s) => ({ id: s.id, name: s.displayName ?? s.name ?? '', webUrl: s.webUrl })))
      }).catch(() => {}),
    ])
  }, [])

  // When no source selected yet and drives load, pick first
  useEffect(() => {
    if (!activeSource && drives.length > 0) {
      selectDrive(drives[0])
    }
  }, [drives])

  const selectDrive = async (drive: MsDrive) => {
    setActiveSource({ kind: 'drive', drive })
    loadRoot(drive.id)
  }

  const selectSite = async (site: MsSite) => {
    setActiveSource({ kind: 'site', site, driveId: sitesDriveId[site.id] ?? null })
    // Resolve driveId lazily
    if (!sitesDriveId[site.id]) {
      try {
        const d = await pjApi.microsoft.get(`sites/${site.id}/drive?$select=id`) as { id: string }
        setSitesDriveId(prev => ({ ...prev, [site.id]: d.id }))
        setActiveSource({ kind: 'site', site, driveId: d.id })
        loadRoot(d.id)
      } catch (error) {
        logger.error('Failed to resolve the selected SharePoint site drive.', error, { siteId: site.id })
      }
    } else {
      loadRoot(sitesDriveId[site.id])
    }
  }

  const loadRoot = async (driveId: string) => {
    setLoading(true)
    setRootItems([])
    try {
      const data = await pjApi.microsoft.get(
        `drives/${driveId}/root/children?$select=id,name,folder,webUrl&$filter=folder ne null&$top=50`
      ) as { value: MsItem[] }
      setRootItems((data.value ?? []).filter(i => i.folder))
    } catch { setRootItems([]) }
    finally { setLoading(false) }
  }

  const activeDriveId = activeSource?.kind === 'drive'
    ? activeSource.drive.id
    : activeSource?.kind === 'site'
    ? (activeSource.driveId ?? '')
    : ''

  return (
    <div className="flex gap-2 h-52 rounded-lg border overflow-hidden">
      {/* Sidebar */}
      <div className="w-36 shrink-0 border-r bg-muted/20 overflow-y-auto flex flex-col text-xs">
        {drives.length > 0 && (
          <>
            <div className="px-2 py-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">OneDrive</div>
            {drives.map(d => (
              <button
                key={d.id}
                onClick={() => selectDrive(d)}
                className={`flex items-center gap-1.5 px-2 py-1.5 text-left transition-colors
                  ${activeSource?.kind === 'drive' && activeSource.drive.id === d.id ? 'bg-primary/10 text-primary font-medium' : 'hover:bg-muted'}`}
              >
                <HardDrive size={12} className="shrink-0 text-muted-foreground" />
                <span className="truncate">{d.name}</span>
              </button>
            ))}
          </>
        )}
        {sites.length > 0 && (
          <>
            <div className="px-2 pt-2 pb-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">SharePoint</div>
            {sites.map(s => (
              <button
                key={s.id}
                onClick={() => selectSite(s)}
                className={`flex items-center gap-1.5 px-2 py-1.5 text-left transition-colors
                  ${activeSource?.kind === 'site' && activeSource.site.id === s.id ? 'bg-primary/10 text-primary font-medium' : 'hover:bg-muted'}`}
              >
                <MicrosoftExcelLogo size={12} className="shrink-0 text-[#0078D4]" />
                <span className="truncate">{s.name}</span>
              </button>
            ))}
          </>
        )}
      </div>

      {/* Folder tree */}
      <div className="flex-1 min-h-0 overflow-y-auto p-1 text-xs">
        {/* Root = the drive/site itself */}
        {activeDriveId && (
          <button
            onClick={() => onSelect({ item: { id: 'root', name: 'Root', folder: {}, webUrl: '' }, driveId: activeDriveId })}
            className={`flex items-center gap-1.5 px-2 py-1 rounded w-full text-left
              ${selected?.item.id === 'root' && selected?.driveId === activeDriveId ? 'bg-primary/10 text-primary font-medium' : 'hover:bg-muted'}`}
          >
            <Folder size={13} className="text-yellow-500" />
            Root
          </button>
        )}
        {loading ? (
          <p className="px-3 py-2 text-muted-foreground animate-pulse">Loading…</p>
        ) : rootItems.length === 0 && activeDriveId ? (
          <p className="px-3 py-2 text-muted-foreground">No sub-folders</p>
        ) : rootItems.map(item => {
          const isSelected = selected?.item.id === item.id
          return (
            <div key={item.id}>
              <button
                onClick={() => onSelect({ item, driveId: activeDriveId })}
                className={`flex items-center gap-1.5 px-2 py-1 rounded w-full text-left
                  ${isSelected ? 'bg-primary/10 text-primary font-medium' : 'hover:bg-muted'}`}
              >
                <Folder size={13} className="text-yellow-500" />
                <span className="flex-1 truncate">{item.name}</span>
              </button>
              <MsFolderTree driveId={activeDriveId} parentId={item.id} depth={1} selected={selected} onSelect={onSelect} />
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Google folder picker (rich 2-panel) ──────────────────────────────────────

interface GFolder { id: string; name: string }
interface GSelected { id: string; name: string; driveId?: string }
interface GDrive { id: string; name: string }
type GActiveRoot = { kind: 'my' } | { kind: 'shared'; driveId: string; name: string }

function GoogleFolderTree({ parentId, driveId, isShared, depth, selected, onSelect }: {
  parentId: string; driveId?: string; isShared: boolean; depth: number
  selected: GSelected | null
  onSelect: (node: GSelected) => void
}) {
  const [children, setChildren] = useState<GFolder[]>([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    if (open) { setOpen(false); return }
    setOpen(true)
    if (children.length) return
    setLoading(true)
    try {
      const q = encodeURIComponent(`'${parentId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`)
      let url = `drive/v3/files?q=${q}&fields=files(id,name)&orderBy=name&pageSize=50`
      if (isShared && driveId) {
        url += `&driveId=${driveId}&includeItemsFromAllDrives=true&supportsAllDrives=true&corpora=drive`
      }
      const data = await pjApi.google.get(url) as { files: GFolder[] }
      setChildren(data.files ?? [])
    } catch { setChildren([]) }
    finally { setLoading(false) }
  }, [parentId, driveId, isShared, open, children.length])

  if (children.length === 0 && open && !loading) return null

  return (
    <div>
      {children.map(item => {
        const isSelected = selected?.id === item.id
        return (
          <div key={item.id}>
            <div
              style={{ paddingLeft: `${depth * 14 + 8}px` }}
              className={`flex items-center gap-1.5 py-1 pr-2 rounded cursor-pointer text-xs
                ${isSelected ? 'bg-primary/10 text-primary font-medium' : 'hover:bg-muted text-foreground'}`}
            >
              <button onClick={() => load()} className="flex items-center gap-1 shrink-0">
                {open ? <CaretDown size={9} className="text-muted-foreground" /> : <CaretRight size={9} className="text-muted-foreground" />}
                {open ? <FolderOpen size={13} className="text-[#4285F4]" /> : <Folder size={13} className="text-[#4285F4]" />}
              </button>
              <span className="flex-1 truncate" onClick={() => onSelect({ id: item.id, name: item.name, driveId })}>
                {item.name}
              </span>
              {loading && <ArrowClockwise size={10} className="animate-spin text-muted-foreground shrink-0" />}
            </div>
            {open && (
              <GoogleFolderTree parentId={item.id} driveId={driveId} isShared={isShared} depth={depth + 1} selected={selected} onSelect={onSelect} />
            )}
          </div>
        )
      })}
    </div>
  )
}

function GooglePicker({ selected, onSelect }: {
  selected: GSelected | null
  onSelect: (node: GSelected) => void
}) {
  const [sharedDrives, setSharedDrives] = useState<GDrive[]>([])
  const [activeRoot, setActiveRoot] = useState<GActiveRoot>({ kind: 'my' })
  const [rootFolders, setRootFolders] = useState<GFolder[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    pjApi.google.get('drive/v3/drives?pageSize=20')
      .then((d: unknown) => setSharedDrives(((d as Record<string, unknown>).drives as GDrive[]) ?? []))
      .catch(() => {})
  }, [])

  useEffect(() => {
    setLoading(true)
    setRootFolders([])
    const isShared = activeRoot.kind === 'shared'
    const parentId = isShared ? activeRoot.driveId : 'root'
    const q = encodeURIComponent(`'${parentId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`)
    let url = `drive/v3/files?q=${q}&fields=files(id,name)&orderBy=name&pageSize=50`
    if (isShared) {
      url += `&driveId=${activeRoot.driveId}&includeItemsFromAllDrives=true&supportsAllDrives=true&corpora=drive`
    }
    pjApi.google.get(url)
      .then((d: unknown) => setRootFolders(((d as Record<string, unknown>).files as GFolder[]) ?? []))
      .catch(() => setRootFolders([]))
      .finally(() => setLoading(false))
  }, [activeRoot])

  const isShared = activeRoot.kind === 'shared'
  const activeDriveId = isShared ? activeRoot.driveId : undefined
  const rootId = isShared ? activeRoot.driveId : 'root'
  const rootLabel = activeRoot.kind === 'my' ? 'My Drive' : activeRoot.name

  return (
    <div className="flex gap-0 h-52 rounded-lg border overflow-hidden">
      {/* Sidebar */}
      <div className="w-36 shrink-0 border-r bg-muted/20 overflow-y-auto flex flex-col text-xs">
        <button
          onClick={() => setActiveRoot({ kind: 'my' })}
          className={`flex items-center gap-1.5 px-2 py-2 text-left transition-colors
            ${activeRoot.kind === 'my' ? 'bg-primary/10 text-primary font-medium' : 'hover:bg-muted'}`}
        >
          <GoogleLogo size={12} weight="fill" className="shrink-0 text-[#4285F4]" />
          <span className="truncate">My Drive</span>
        </button>
        {sharedDrives.length > 0 && (
          <>
            <div className="px-2 pt-2 pb-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Shared Drives</div>
            {sharedDrives.map(d => (
              <button
                key={d.id}
                onClick={() => setActiveRoot({ kind: 'shared', driveId: d.id, name: d.name })}
                className={`flex items-center gap-1.5 px-2 py-1.5 text-left transition-colors
                  ${activeRoot.kind === 'shared' && activeRoot.driveId === d.id ? 'bg-primary/10 text-primary font-medium' : 'hover:bg-muted'}`}
              >
                <HardDrive size={12} className="shrink-0 text-muted-foreground" />
                <span className="truncate">{d.name}</span>
              </button>
            ))}
          </>
        )}
      </div>

      {/* Folder tree */}
      <div className="flex-1 min-h-0 overflow-y-auto p-1 text-xs">
        <button
          onClick={() => onSelect({ id: rootId, name: rootLabel, driveId: activeDriveId })}
          className={`flex items-center gap-1.5 px-2 py-1 rounded w-full text-left
            ${selected?.id === rootId ? 'bg-primary/10 text-primary font-medium' : 'hover:bg-muted'}`}
        >
          <Folder size={13} className="text-[#4285F4]" />
          {rootLabel}
        </button>
        {loading ? (
          <p className="px-3 py-2 text-muted-foreground animate-pulse">Loading…</p>
        ) : rootFolders.length === 0 ? (
          <p className="px-3 py-2 text-muted-foreground">No sub-folders</p>
        ) : rootFolders.map(item => {
          const isSelected = selected?.id === item.id
          return (
            <div key={item.id}>
              <button
                onClick={() => onSelect({ id: item.id, name: item.name, driveId: activeDriveId })}
                className={`flex items-center gap-1.5 px-2 py-1 rounded w-full text-left
                  ${isSelected ? 'bg-primary/10 text-primary font-medium' : 'hover:bg-muted'}`}
              >
                <Folder size={13} className="text-[#4285F4]" />
                <span className="flex-1 truncate">{item.name}</span>
              </button>
              <GoogleFolderTree parentId={item.id} driveId={activeDriveId} isShared={isShared} depth={1} selected={selected} onSelect={onSelect} />
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── GitHub picker (2-panel) ───────────────────────────────────────────────────

// ── GitHub folder tree (recursive dir browser) ───────────────────────────────

interface GHItem { name: string; path: string; type: 'file' | 'dir' }

function GitHubFolderTree({ repo, parentPath, depth, selected, onSelect }: {
  repo: string; parentPath: string; depth: number
  selected: string | null; onSelect: (path: string) => void
}) {
  const [children, setChildren] = useState<GHItem[]>([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    if (open) { setOpen(false); return }
    setOpen(true)
    if (children.length) return
    setLoading(true)
    try {
      const data = await pjApi.github.get(`repos/${repo}/contents/${parentPath}`) as GHItem[]
      setChildren((Array.isArray(data) ? data : []).filter(i => i.type === 'dir'))
    } catch { setChildren([]) }
    finally { setLoading(false) }
  }, [repo, parentPath, open, children.length])

  if (children.length === 0 && open && !loading) return null

  return (
    <div>
      {children.map(item => {
        const isSelected = selected === item.path
        return (
          <div key={item.path}>
            <div
              style={{ paddingLeft: `${depth * 14 + 8}px` }}
              className={`flex items-center gap-1.5 py-1 pr-2 rounded cursor-pointer text-xs
                ${isSelected ? 'bg-primary/10 text-primary font-medium' : 'hover:bg-muted text-foreground'}`}
            >
              <button onClick={load} className="flex items-center gap-1 shrink-0">
                {open ? <CaretDown size={9} className="text-muted-foreground" /> : <CaretRight size={9} className="text-muted-foreground" />}
                {open ? <FolderOpen size={13} className="text-[#f0ad4e]" /> : <Folder size={13} className="text-[#f0ad4e]" />}
              </button>
              <span className="flex-1 truncate" onClick={() => onSelect(item.path)}>{item.name}</span>
              {loading && open && <ArrowClockwise size={10} className="animate-spin text-muted-foreground shrink-0" />}
            </div>
            {open && <GitHubFolderTree repo={repo} parentPath={item.path} depth={depth + 1} selected={selected} onSelect={onSelect} />}
          </div>
        )
      })}
    </div>
  )
}

interface GitHubPickerProps {
  repo: string; onRepoChange: (r: string) => void
  path: string; onPathChange: (p: string) => void
  filename: string
}
function GitHubPicker({ repo, onRepoChange, path, onPathChange, filename }: GitHubPickerProps) {
  const [repos, setRepos] = useState<{ id: number; full_name: string; name: string }[]>([])
  useEffect(() => {
    pjApi.github.get('user/repos?per_page=50&sort=updated')
      .then((d: unknown) => {
        const list = (Array.isArray(d) ? d : []) as typeof repos
        setRepos(list)
        if (!repo && list.length > 0) onRepoChange(list[0].full_name)
      }).catch(() => {})
  }, [])

  return (
    <div className="flex gap-0 h-52 rounded-lg border overflow-hidden">
      {/* Sidebar — repo list */}
      <div className="w-36 shrink-0 border-r bg-muted/20 overflow-y-auto flex flex-col text-xs">
        <div className="px-2 py-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Repositories</div>
        {repos.map(r => (
          <button key={r.id} onClick={() => { onRepoChange(r.full_name); onPathChange('') }}
            className={`flex items-center gap-1.5 px-2 py-1.5 text-left transition-colors
              ${repo === r.full_name ? 'bg-primary/10 text-primary font-medium' : 'hover:bg-muted'}`}
          >
            <GithubLogo size={12} className="shrink-0 text-muted-foreground" />
            <span className="truncate">{r.name}</span>
          </button>
        ))}
      </div>

      {/* Right panel — folder tree */}
      <div className="flex-1 min-h-0 overflow-y-auto p-1 text-xs">
        {!repo ? (
          <p className="px-3 py-2 text-muted-foreground">Select a repository</p>
        ) : (
          <>
            {/* Root */}
            <button
              onClick={() => onPathChange('')}
              className={`flex items-center gap-1.5 px-2 py-1 rounded w-full text-left
                ${path === '' ? 'bg-primary/10 text-primary font-medium' : 'hover:bg-muted'}`}
            >
              <Folder size={13} className="text-[#f0ad4e]" />
              Root <span className="text-muted-foreground ml-1 font-normal">({filename})</span>
            </button>
            <GitHubFolderTree repo={repo} parentPath="" depth={1} selected={path || null} onSelect={onPathChange} />
          </>
        )}
      </div>
    </div>
  )
}

// ── Vault picker ──────────────────────────────────────────────────────────────

type VaultSection = 'templates' | 'files'

function VaultPicker({ saveName, onSaveNameChange }: {
  saveName: string
  onSaveNameChange: (name: string) => void
}) {
  const [docs, setDocs] = useState<VaultDoc[]>([])
  const [files, setFiles] = useState<VaultFile[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [section, setSection] = useState<VaultSection>('templates')

  const CLASS_COLORS: Record<string, string> = {
    confidential: 'text-red-500', restricted: 'text-orange-500',
    internal: 'text-blue-500', public: 'text-green-500',
  }

  useEffect(() => {
    setLoading(true)
    Promise.all([
      pjApi.docs.list().then(d => setDocs(d.documents ?? [])).catch(() => setDocs([])),
      pjApi.vaultFiles.list().then(d => setFiles(d.files ?? [])).catch(() => setFiles([])),
    ]).finally(() => setLoading(false))
  }, [])

  const selectDoc = (doc: VaultDoc) => {
    setSelectedId(`doc-${doc.id}`)
    onSaveNameChange(`${doc.name}.html`)
  }

  const selectFile = (file: VaultFile) => {
    setSelectedId(`file-${file.id}`)
    onSaveNameChange(file.name)
  }

  const SECTIONS: { id: VaultSection; label: string; count: number }[] = [
    { id: 'templates', label: 'Templates', count: docs.length },
    { id: 'files',     label: 'Files',     count: files.length },
  ]

  return (
    <div className="space-y-2">
      <div className="flex gap-0 h-52 rounded-lg border overflow-hidden">
        {/* Sidebar — section tabs */}
        <div className="w-36 shrink-0 border-r bg-muted/20 overflow-y-auto flex flex-col text-xs">
          <div className="px-2 py-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Vault</div>
          {SECTIONS.map(s => (
            <button key={s.id} onClick={() => setSection(s.id)}
              className={`flex items-center gap-1.5 px-2 py-1.5 text-left transition-colors
                ${section === s.id ? 'bg-primary/10 text-primary font-medium' : 'hover:bg-muted'}`}
            >
              <Lock size={11} className="shrink-0 text-purple-500" />
              <span className="flex-1 truncate">{s.label}</span>
              <span className="text-[10px] text-muted-foreground">{s.count}</span>
            </button>
          ))}
        </div>

        {/* Right — item list */}
        <div className="flex-1 min-h-0 overflow-y-auto p-1 text-xs">
          {loading ? (
            <p className="px-3 py-2 text-muted-foreground animate-pulse">Loading…</p>
          ) : section === 'templates' ? (
            docs.length === 0 ? (
              <p className="px-3 py-2 text-muted-foreground">No vault templates</p>
            ) : docs.map(doc => (
              <button key={doc.id} onClick={() => selectDoc(doc)}
                className={`flex items-center gap-1.5 px-2 py-1.5 rounded w-full text-left transition-colors
                  ${selectedId === `doc-${doc.id}` ? 'bg-primary/10 text-primary font-medium' : 'hover:bg-muted'}`}
              >
                <Lock size={10} className={`shrink-0 ${CLASS_COLORS[doc.classification] ?? 'text-muted-foreground'}`} />
                <span className="flex-1 truncate">{doc.name}</span>
                <span className="text-[10px] text-muted-foreground shrink-0 capitalize">{doc.status}</span>
              </button>
            ))
          ) : (
            files.length === 0 ? (
              <p className="px-3 py-2 text-muted-foreground">No vault files</p>
            ) : files.map(file => (
              <button key={file.id} onClick={() => selectFile(file)}
                className={`flex items-center gap-1.5 px-2 py-1.5 rounded w-full text-left transition-colors
                  ${selectedId === `file-${file.id}` ? 'bg-primary/10 text-primary font-medium' : 'hover:bg-muted'}`}
              >
                <HardDrive size={10} className="shrink-0 text-muted-foreground" />
                <span className="flex-1 truncate">{file.name}</span>
                <span className="text-[10px] text-muted-foreground shrink-0">{(file.size / 1024).toFixed(0)} KB</span>
              </button>
            ))
          )}
        </div>
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Save as</Label>
        <Input value={saveName} onChange={e => onSaveNameChange(e.target.value)}
          placeholder="document-name" className="h-8 text-sm" />
      </div>
    </div>
  )
}

// ── Main dialog ───────────────────────────────────────────────────────────────

export function SaveToCloudDialog({ open, onOpenChange, defaultTarget }: SaveToCloudDialogProps) {
  const [connectedProviders, setConnectedProviders] = useState<string[]>([])
  const [loadingProviders, setLoadingProviders] = useState(false)
  const [provider, setProvider] = useState<'google' | 'microsoft' | 'github' | 'vault'>('microsoft')
  const [filename, setFilename] = useState(defaultTarget.filename)
  const [saving, setSaving] = useState(false)
  const [savedUrl, setSavedUrl] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saveErrorIsAuth, setSaveErrorIsAuth] = useState(false)
  const [repoImportOpen, setRepoImportOpen] = useState(false)

  // Microsoft
  const [msSelected, setMsSelected] = useState<FolderPickerNode | null>(null)

  // Google
  const [gSelected, setGSelected] = useState<GSelected | null>(null)

  // GitHub
  const [githubRepo, setGithubRepo] = useState('')
  const [githubPath, setGithubPath] = useState('')

  // Vault
  const [vaultSaveName, setVaultSaveName] = useState(defaultTarget.filename)

  useEffect(() => {
    if (!open) return
    setFilename(defaultTarget.filename)
    setVaultSaveName(defaultTarget.filename)
    setSavedUrl(null)
    setSaveError(null)
    setSaveErrorIsAuth(false)
    setLoadingProviders(true)
    pjApi.connectors.status().then((d: unknown) => {
      const connected = Object.entries(((d as Record<string,unknown>)?.connectors as Record<string,unknown>) ?? {})
        .filter(([, v]) => (v as Record<string,unknown>)?.connected)
        .map(([k]) => k)
      setConnectedProviders(connected)
      if (connected.includes('microsoft')) setProvider('microsoft')
      else if (connected.includes('google')) setProvider('google')
      else if (connected.includes('github')) setProvider('github')
      else setProvider('vault')
    }).catch(() => {
      setConnectedProviders([])
      setProvider('vault')
    }).finally(() => setLoadingProviders(false))
  }, [open])

  const toBase64 = (content: string | Uint8Array): string => {
    if (typeof content === 'string') return btoa(unescape(encodeURIComponent(content)))
    return btoa(Array.from(content).map(b => String.fromCharCode(b)).join(''))
  }

  const handleSave = async () => {
    setSaving(true)
    setSavedUrl(null)
    setSaveError(null)
    try {
      const name = filename.trim() || defaultTarget.filename

      // Vault uses a different upload path
      if (provider === 'vault') {
        const contentBase64 = toBase64(defaultTarget.content)
        const content = defaultTarget.content
        const size = typeof content === 'string'
          ? new TextEncoder().encode(content).length
          : content.length
        const saveName = vaultSaveName.trim() || name
        await pjApi.vaultFiles.upload({
          name: saveName,
          mimeType: defaultTarget.mimeType ?? 'text/plain',
          size,
          contentBase64,
        })
        setSavedUrl(null)
        toast.success('Saved to Vault!', { description: saveName })
        setSaving(false)
        return
      }

      const contentBase64 = toBase64(defaultTarget.content)
      const opts: Parameters<typeof pjApi.cloudSave>[0] = {
        provider: provider as 'google' | 'microsoft' | 'github',
        filename: name,
        contentBase64,
        mimeType: defaultTarget.mimeType,
      }

      if (provider === 'microsoft' && msSelected) {
        opts.driveId = msSelected.driveId
        if (msSelected.item.id !== 'root') opts.folderId = msSelected.item.id
      } else if (provider === 'google') {
        if (gSelected && gSelected.id !== 'root') opts.folderId = gSelected.id
        if (gSelected?.driveId) opts.driveId = gSelected.driveId
      } else if (provider === 'github') {
        opts.githubRepo = githubRepo
        opts.githubPath = githubPath.trim() || `docs/${name}`
      }

      const result = await pjApi.cloudSave(opts)
      setSavedUrl(result.url)
      toast.success(`Saved to ${providerLabel(provider)}!`, {
        description: name,
        action: result.url ? { label: 'Open', onClick: () => window.open(result.url, '_blank') } : undefined,
      })
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error'
      const providerName = providerLabel(provider)
      const isAuth = /auth|token|unauthorized|401|not connected|expired|revoked/i.test(msg)
      const errorText = isAuth
        ? `${providerName} session expired — reconnect to continue saving`
        : `Save to ${providerName} failed: ${msg}`
      toast.error(errorText, { duration: 8000 })
      setSaveError(errorText)
      setSaveErrorIsAuth(isAuth)
    } finally {
      setSaving(false)
    }
  }

  const providerLabel = (p: string) =>
    p === 'google' ? 'Google Drive'
    : p === 'microsoft' ? 'OneDrive / SharePoint'
    : p === 'github' ? 'GitHub'
    : 'Vault'

  const providerIcon = (p: string, active: boolean) => {
    const cls = active ? '' : 'opacity-60'
    if (p === 'google') return <GoogleLogo size={14} weight="fill" className={`text-[#4285F4] ${cls}`} />
    if (p === 'microsoft') return <MicrosoftExcelLogo size={14} weight="fill" className={`text-[#0078D4] ${cls}`} />
    if (p === 'vault') return <Lock size={14} weight="fill" className={`text-purple-500 ${cls}`} />
    return <GithubLogo size={14} weight="fill" className={cls} />
  }

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-2">
              <CloudArrowUp size={18} className="text-primary" />
              CloudSync
            </span>
            <Button variant="outline" size="sm" className="h-7 gap-1.5 text-xs font-normal" onClick={() => setRepoImportOpen(true)}>
              <GitBranch size={13} />
              Import Repo
            </Button>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-1">
          {/* Provider tabs */}
          <div className="flex gap-1.5 flex-wrap">
            {(['microsoft', 'google', 'github'] as const)
              .filter(p => connectedProviders.includes(p))
              .map(p => (
                <button
                  key={p}
                  onClick={() => setProvider(p)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors
                    ${provider === p ? 'border-primary bg-primary/5 text-primary' : 'border-border text-muted-foreground hover:border-foreground/40'}`}
                >
                  {providerIcon(p, provider === p)}
                  {p === 'microsoft' ? 'OneDrive / SharePoint' : p === 'google' ? 'Google Drive' : 'GitHub'}
                </button>
              ))}
            {/* Vault is always available — no connector needed */}
            <button
              onClick={() => setProvider('vault')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors
                ${provider === 'vault' ? 'border-primary bg-primary/5 text-primary' : 'border-border text-muted-foreground hover:border-foreground/40'}`}
            >
              {providerIcon('vault', provider === 'vault')}
              Vault
            </button>
            {loadingProviders && (
              <p className="text-xs text-muted-foreground animate-pulse self-center">Loading connected providers…</p>
            )}
          </div>

          {/* Filename */}
          <div className="space-y-1.5">
            <Label htmlFor="cloud-filename" className="text-xs">Filename</Label>
            <Input id="cloud-filename" value={filename} onChange={e => setFilename(e.target.value)} className="h-8 text-sm" />
          </div>

          {/* Destination picker */}
          {provider === 'microsoft' && (
            <div className="space-y-1.5">
              <Label className="text-xs">
                Save to{msSelected && msSelected.item.id !== 'root' ? `: ${msSelected.item.name}` : ' root'}
              </Label>
              <MicrosoftPicker selected={msSelected} onSelect={setMsSelected} />
            </div>
          )}
          {provider === 'google' && (
            <div className="space-y-1.5">
              <Label className="text-xs">
                Folder{gSelected ? `: ${gSelected.name}` : ' (root)'}
              </Label>
              <GooglePicker selected={gSelected} onSelect={setGSelected} />
            </div>
          )}
          {provider === 'github' && (
            <GitHubPicker
              repo={githubRepo} onRepoChange={setGithubRepo}
              path={githubPath} onPathChange={setGithubPath}
              filename={filename}
            />
          )}
          {provider === 'vault' && (
            <div className="space-y-1.5">
              <Label className="text-xs">Vault destination</Label>
              <VaultPicker saveName={vaultSaveName} onSaveNameChange={setVaultSaveName} />
            </div>
          )}

          {/* Success */}
          {savedUrl && (
            <a href={savedUrl} target="_blank" rel="noreferrer"
              className="flex items-center gap-1.5 text-xs text-primary hover:underline">
              <Check size={13} weight="bold" />
              Saved — click to open
              <ArrowSquareOut size={12} />
            </a>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button size="sm" onClick={handleSave} disabled={saving || (provider !== 'vault' && connectedProviders.length === 0)} className="gap-1.5 min-w-28">
            {saving
              ? <span className="animate-pulse">Syncing…</span>
              : <><CloudArrowUp size={14} />CloudSync</>}
          </Button>
        </div>
        {saveError && (
          <div className="flex items-start gap-2 pt-1 text-xs text-destructive">
            <span className="shrink-0 mt-px">⚠</span>
            <span className="flex-1">{saveError}</span>
            {saveErrorIsAuth && provider !== 'vault' && (
              <Button size="sm" variant="outline" className="h-6 px-2 text-xs shrink-0"
                onClick={() => pjApi.connectors.connect(provider as 'google' | 'microsoft' | 'github')}>
                Reconnect
              </Button>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
    <RepoImportDialog open={repoImportOpen} onOpenChange={setRepoImportOpen} />
    </>
  )
}
