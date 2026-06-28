import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { CheckCircle, Folder, GoogleDriveLogo, Spinner } from '@phosphor-icons/react'
import type { ProviderAuthState, GoogleSaveTarget } from './types'
import { MOCK_GD_FOLDERS } from './types'
import { pjApi } from '@/services/pjApi'
import { GOOGLE_CONVERTIBLE } from '../utils'

interface GoogleSavePanelProps {
  auth: ProviderAuthState
  suggestedFileName?: string
  onChange: (target: GoogleSaveTarget | null) => void
}

function googleDocLabel(fileName: string, convert: boolean): string {
  if (!convert) return fileName
  const ext = fileName.split('.').pop()?.toLowerCase() ?? ''
  if (['md', 'txt', 'docx', 'doc', 'html'].includes(ext)) return `${fileName} → Google Doc`
  if (['xlsx', 'xls', 'csv'].includes(ext)) return `${fileName} → Google Sheet`
  if (['pptx'].includes(ext)) return `${fileName} → Google Slides`
  return fileName
}

export function GoogleSavePanel({ auth, suggestedFileName, onChange }: GoogleSavePanelProps) {
  const [fileName, setFileName] = useState(suggestedFileName ?? '')
  const [folders, setFolders] = useState(MOCK_GD_FOLDERS)
  const [loadingFolders, setLoadingFolders] = useState(false)
  const [selectedFolderId, setSelectedFolderId] = useState('root')
  const [convertToGoogleDoc, setConvertToGoogleDoc] = useState(true)

  useEffect(() => {
    if (auth.status !== 'connected') return
    setLoadingFolders(true)
    pjApi.google.get<{ files?: Array<{ id: string; name: string }> }>('drive/v3/files?q=mimeType%3D%27application%2Fvnd.google-apps.folder%27&fields=files(id,name)&pageSize=50')
      .then(res => {
        if (res.files?.length) {
          setFolders([
            { id: 'root', name: 'My Drive', path: '/', depth: 0 },
            ...res.files.map(f => ({ id: f.id, name: f.name, path: `/${f.name}`, depth: 1 })),
          ])
        }
      })
      .catch(() => {})
      .finally(() => setLoadingFolders(false))
  }, [auth.status])

  const selectedFolder = folders.find(f => f.id === selectedFolderId) ?? folders[0]
  const ext = fileName.split('.').pop()?.toLowerCase() ?? ''
  const canConvert = GOOGLE_CONVERTIBLE.has(ext)

  useEffect(() => {
    setFileName(suggestedFileName ?? '')
    const newExt = (suggestedFileName ?? '').split('.').pop()?.toLowerCase() ?? ''
    setConvertToGoogleDoc(GOOGLE_CONVERTIBLE.has(newExt))
  }, [suggestedFileName])

  useEffect(() => {
    if (auth.status !== 'connected' || !fileName.trim()) {
      onChange(null)
      return
    }
    onChange({
      provider: 'google',
      folderId: selectedFolderId,
      folderPath: selectedFolder.path,
      fileName: fileName.trim(),
      convertToGoogleDoc: canConvert ? convertToGoogleDoc : false,
    })
  }, [auth.status, fileName, selectedFolder.path, selectedFolderId, convertToGoogleDoc, canConvert, onChange])

  if (auth.status !== 'connected') {
    return (
      <div className="flex flex-col items-center justify-center gap-5 py-10 px-4 text-center">
        <div className="w-14 h-14 rounded-2xl bg-muted border border-border flex items-center justify-center">
          <GoogleDriveLogo size={30} className="text-yellow-500" />
        </div>
        <div>
          <p className="text-sm font-semibold text-foreground mb-1">Connect Google Workspace</p>
          <p className="text-xs text-muted-foreground leading-relaxed">Link your account to save files to Google Drive and convert to Docs, Sheets, or Slides.</p>
        </div>
        <Button
          className="bg-primary text-primary-foreground hover:bg-primary/90 gap-2 h-9 px-5 text-sm"
          onClick={() => pjApi.connectors.connect('google')}
        >
          <GoogleDriveLogo size={14} className="text-yellow-400" />
          Connect Google Workspace
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
            <GoogleDriveLogo size={15} className="text-yellow-400" />
          </div>
          <Input
            value={fileName}
            onChange={(e) => setFileName(e.target.value)}
            placeholder="document.md"
            className="bg-muted border-border text-sm pl-8 font-mono"
          />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
          Destination Folder
          {loadingFolders && <Spinner size={12} className="animate-spin text-muted-foreground/70" />}
        </Label>
        <div className="border border-border rounded-md overflow-hidden max-h-36 overflow-y-auto bg-muted">
          {folders.map(folder => (
            <button
              key={folder.id}
              onClick={() => setSelectedFolderId(folder.id)}
              className={`w-full flex items-center gap-2 px-3 py-2 text-xs text-left hover:bg-muted transition-colors ${
                folder.id === selectedFolderId ? 'bg-muted text-yellow-400' : 'text-foreground/80'
              }`}
              style={{ paddingLeft: `${folder.depth * 12 + 12}px` }}
            >
              <Folder size={13} weight={folder.id === selectedFolderId ? 'fill' : 'regular'} />
              {folder.name}
            </button>
          ))}
        </div>
      </div>

      {canConvert && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <Label className="text-xs text-muted-foreground">Convert to Google Doc/Sheet/Slides</Label>
            <Switch checked={convertToGoogleDoc} onCheckedChange={setConvertToGoogleDoc} />
          </div>
        </div>
      )}

      <div className="text-xs text-muted-foreground/70 bg-muted border border-border rounded px-2 py-1">
        <span className="text-muted-foreground/50">Saved as: </span>
        <span className="font-mono">{googleDocLabel(fileName || 'file', canConvert && convertToGoogleDoc)}</span>
      </div>
    </div>
  )
}
