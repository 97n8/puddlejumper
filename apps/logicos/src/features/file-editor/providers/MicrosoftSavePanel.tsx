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
import { Switch } from '@/components/ui/switch'
import { CheckCircle, Folder, FileDoc, FileXls, FilePpt, File, Spinner } from '@phosphor-icons/react'
import type { ProviderAuthState, MicrosoftSaveTarget } from './types'
import { pjApi } from '@/services/pjApi'
import { microsoftFormatLabel, MICROSOFT_OFFICE_EXTS } from '../utils'

interface MicrosoftSavePanelProps {
  auth: ProviderAuthState
  suggestedFileName?: string
  onChange: (target: MicrosoftSaveTarget | null) => void
}

function MsFileIcon({ ext }: { ext: string }) {
  if (['docx', 'doc'].includes(ext)) return <FileDoc size={16} className="text-blue-400" />
  if (['xlsx', 'xls'].includes(ext)) return <FileXls size={16} className="text-green-400" />
  if (['pptx', 'ppt'].includes(ext)) return <FilePpt size={16} className="text-orange-400" />
  return <File size={16} className="text-muted-foreground" />
}

type FolderEntry = { id: string; name: string; path: string; depth: number; driveId?: string; isHeader?: boolean }

export function MicrosoftSavePanel({ auth, suggestedFileName, onChange }: MicrosoftSavePanelProps) {
  const [fileName, setFileName] = useState(suggestedFileName ?? '')
  const [folders, setFolders] = useState<FolderEntry[]>([{ id: 'root', name: 'OneDrive — root', path: '/', depth: 0 }])
  const [loadingFolders, setLoadingFolders] = useState(false)
  const [selectedFolderId, setSelectedFolderId] = useState('root')
  const [conflictBehavior, setConflictBehavior] = useState<'rename' | 'replace' | 'fail'>('rename')
  const [openInOffice, setOpenInOffice] = useState(false)

  useEffect(() => {
    if (auth.status !== 'connected') return
    setLoadingFolders(true)

    const personalDrive = pjApi.microsoft
      .get<{ value?: Array<{ id: string; name: string; folder?: unknown }> }>(
        'me/drive/root/children?$select=id,name,folder&$top=50'
      )
      .then(res => {
        const subfolders: FolderEntry[] = (res.value ?? [])
          .filter(item => item.folder !== undefined)
          .map(f => ({ id: f.id, name: f.name, path: `/OneDrive/${f.name}`, depth: 1 }))
        return [
          { id: 'root', name: 'OneDrive', path: '/', depth: 0 },
          ...subfolders,
        ] as FolderEntry[]
      })
      .catch(() => [{ id: 'root', name: 'OneDrive', path: '/', depth: 0 }] as FolderEntry[])

    // Fetch SharePoint sites the user follows + their document libraries
    const sharepointDrives = pjApi.microsoft
      .get<{ value?: Array<{ id: string; displayName?: string; name?: string }> }>(
        'sites?search=*&$select=id,displayName,name&$top=15'
      )
      .then(async res => {
        const sites = (res.value ?? []).slice(0, 8)
        const entries: FolderEntry[] = []
        for (const site of sites) {
          const label = site.displayName ?? site.name ?? 'SharePoint Site'
          const drives = await pjApi.microsoft
            .get<{ value?: Array<{ id: string; name: string; driveType?: string }> }>(
              `sites/${site.id}/drives?$select=id,name,driveType&$top=10`
            )
            .catch(() => ({ value: [] as Array<{ id: string; name: string; driveType?: string }> }))
          const libs = (drives.value ?? []).filter(d => d.driveType === 'documentLibrary' || d.driveType === 'business')
          if (libs.length) {
            entries.push({ id: `hdr-${site.id}`, name: label, path: '', depth: 0, isHeader: true })
            for (const lib of libs) {
              entries.push({ id: lib.id, name: lib.name, path: `/${label}/${lib.name}`, depth: 1, driveId: lib.id })
            }
          }
        }
        return entries
      })
      .catch(() => [] as FolderEntry[])

    Promise.all([personalDrive, sharepointDrives])
      .then(([personal, sharepoint]) => {
        const all = [...personal, ...sharepoint]
        setFolders(all)
        setSelectedFolderId(all[0].id)
      })
      .finally(() => setLoadingFolders(false))
  }, [auth.status])

  const selectedFolder = folders.find(f => f.id === selectedFolderId) ?? folders[0]
  const ext = fileName.split('.').pop()?.toLowerCase() ?? ''
  const isOfficeFile = MICROSOFT_OFFICE_EXTS.has(ext)

  useEffect(() => {
    setFileName(suggestedFileName ?? '')
  }, [suggestedFileName])

  useEffect(() => {
    if (auth.status !== 'connected' || !fileName.trim()) {
      onChange(null)
      return
    }
    onChange({
      provider: 'microsoft',
      folderId: (selectedFolderId !== 'root' && !selectedFolderId.startsWith('hdr-')) ? selectedFolderId : undefined,
      driveId: selectedFolder?.driveId,
      folderPath: selectedFolder?.path ?? '/',
      fileName: fileName.trim(),
      conflictBehavior,
      openInOffice: isOfficeFile ? openInOffice : false,
    })
  }, [auth.status, fileName, selectedFolder?.path, selectedFolder?.driveId, selectedFolderId, conflictBehavior, openInOffice, isOfficeFile, onChange])

  if (auth.status !== 'connected') {
    return (
      <div className="flex flex-col items-center justify-center gap-5 py-10 px-4 text-center">
        <div className="w-14 h-14 rounded-2xl bg-muted border border-border flex items-center justify-center">
          <svg width="30" height="30" viewBox="0 0 21 21" fill="none">
            <rect x="1" y="1" width="9" height="9" fill="#f25022"/>
            <rect x="11" y="1" width="9" height="9" fill="#7fba00"/>
            <rect x="1" y="11" width="9" height="9" fill="#00a4ef"/>
            <rect x="11" y="11" width="9" height="9" fill="#ffb900"/>
          </svg>
        </div>
        <div>
          <p className="text-sm font-semibold text-foreground mb-1">Connect Microsoft 365</p>
          <p className="text-xs text-muted-foreground leading-relaxed">Link your account to save files directly to OneDrive and SharePoint.</p>
        </div>
        <Button
          className="bg-primary text-primary-foreground hover:bg-primary/90 gap-2 h-9 px-5 text-sm"
          onClick={() => pjApi.connectors.connect('microsoft')}
        >
          <svg width="14" height="14" viewBox="0 0 21 21" fill="none">
            <rect x="1" y="1" width="9" height="9" fill="#f25022"/>
            <rect x="11" y="1" width="9" height="9" fill="#7fba00"/>
            <rect x="1" y="11" width="9" height="9" fill="#00a4ef"/>
            <rect x="11" y="11" width="9" height="9" fill="#ffb900"/>
          </svg>
          Connect Microsoft 365
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
        <Label className="text-xs text-muted-foreground">File Name</Label>
        <div className="relative">
          <div className="absolute left-3 top-1/2 -translate-y-1/2">
            <MsFileIcon ext={ext} />
          </div>
          <Input
            value={fileName}
            onChange={(e) => setFileName(e.target.value)}
            placeholder="document.docx"
            className="bg-muted border-border text-sm pl-8 font-mono"
          />
        </div>
        <p className="text-xs text-muted-foreground/70">{microsoftFormatLabel(fileName)}</p>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
          Destination Folder
          {loadingFolders && <Spinner size={12} className="animate-spin text-muted-foreground/70" />}
        </Label>
        <div className="border border-border rounded-md overflow-hidden max-h-48 overflow-y-auto bg-muted">
          {folders.map(folder => {
            if (folder.isHeader) {
              return (
                <div key={folder.id} className="px-3 py-1.5 text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-wider border-t border-border/50 first:border-t-0 bg-muted/50">
                  {folder.name}
                </div>
              )
            }
            const isSelected = folder.id === selectedFolderId
            return (
              <button
                key={folder.id}
                onClick={() => setSelectedFolderId(folder.id)}
                className={`w-full flex items-center gap-2 py-2 text-xs text-left transition-colors hover:bg-background/40 ${
                  isSelected ? 'text-blue-400 bg-background/40' : 'text-foreground/80'
                }`}
                style={{ paddingLeft: `${folder.depth * 12 + 12}px` }}
              >
                <Folder size={13} weight={isSelected ? 'fill' : 'regular'} />
                {folder.name}
              </button>
            )
          })}
        </div>
        <div className="text-xs text-muted-foreground/70 bg-muted border border-border rounded px-2 py-1 font-mono">
          {selectedFolder.path}/{fileName || 'file'}
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label className="text-xs text-muted-foreground">If file exists</Label>
        <Select value={conflictBehavior} onValueChange={(v) => setConflictBehavior(v as 'rename' | 'replace' | 'fail')}>
          <SelectTrigger className="bg-muted border-border text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-muted border-border">
            <SelectItem value="rename">Rename (add suffix)</SelectItem>
            <SelectItem value="replace">Replace existing</SelectItem>
            <SelectItem value="fail">Fail with error</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isOfficeFile && (
        <div className="flex items-center justify-between">
          <Label className="text-xs text-muted-foreground">Open in Office after save</Label>
          <Switch checked={openInOffice} onCheckedChange={setOpenInOffice} />
        </div>
      )}
    </div>
  )
}
