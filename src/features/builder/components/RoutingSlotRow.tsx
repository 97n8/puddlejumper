import {
  Warning, FolderOpen, WindowsLogo, GoogleLogo,
  Plug, PlugsConnected, Spinner,
} from '@phosphor-icons/react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { Provider, ConnectorStatus } from '../types'
import { suggestFolder } from '../utils/makerUtils'

export function RoutingSlotRow({
  slotKey: _slotKey, slotLabel, slotDesc,
  provider, folder, town, moduleName,
  connectors, connecting,
  onProviderChange, onFolderChange, onConnect,
}: {
  slotKey: string
  slotLabel: string
  slotDesc: string
  provider: Provider
  folder: string
  town: string
  moduleName: string
  connectors: Record<string, ConnectorStatus>
  connecting: string | null
  onProviderChange: (p: Provider) => void
  onFolderChange: (f: string) => void
  onConnect: (p: 'microsoft' | 'google') => void
}) {
  const msConnected = connectors['microsoft']?.connected
  const gConnected  = connectors['google']?.connected

  function handleProviderChange(p: Provider) {
    onProviderChange(p)
    if (p !== 'none' && !folder) {
      onFolderChange(suggestFolder(p, town, moduleName, slotLabel))
    }
  }

  return (
    <div className="rounded-xl border border-border bg-background p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-foreground">{slotLabel}</p>
          <p className="text-xs text-muted-foreground">{slotDesc}</p>
        </div>
      </div>

      {/* Provider picker */}
      <div className="flex gap-2">
        {(['sharepoint', 'google', 'none'] as Provider[]).map(opt => {
          const active = provider === opt
          const needsConnect = (opt === 'sharepoint' && !msConnected) || (opt === 'google' && !gConnected)
          return (
            <button
              key={opt}
              onClick={() => handleProviderChange(opt)}
              className={`flex-1 py-2 px-3 rounded-lg border text-xs font-semibold transition-all flex items-center justify-center gap-1.5 ${
                active
                  ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                  : 'bg-card border-border text-muted-foreground hover:border-primary/40 hover:text-foreground'
              }`}
            >
              {opt === 'sharepoint' && <WindowsLogo size={13} weight="fill" className={active ? '' : 'text-[#0078D4]'} />}
              {opt === 'google'     && <GoogleLogo  size={13} weight="fill" className={active ? '' : 'text-[#4285F4]'} />}
              {opt === 'none'       && <span className="text-[10px]">○</span>}
              {opt === 'sharepoint' ? 'SharePoint' : opt === 'google' ? 'Google Drive' : 'None'}
              {needsConnect && !active && (
                <span className="text-[9px] bg-amber-100 text-amber-700 rounded px-1">setup needed</span>
              )}
            </button>
          )
        })}
      </div>

      {/* Connection status + connect button when provider selected but not connected */}
      {provider === 'sharepoint' && !msConnected && (
        <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          <Warning size={14} className="text-amber-600 shrink-0" />
          <p className="text-xs text-amber-700 flex-1">Microsoft 365 is not connected. Documents can't route to SharePoint.</p>
          <button
            onClick={() => onConnect('microsoft')}
            disabled={connecting === 'microsoft'}
            className="text-xs text-primary font-semibold hover:underline whitespace-nowrap flex items-center gap-1"
          >
            {connecting === 'microsoft' ? <Spinner size={12} className="animate-spin" /> : <Plug size={12} />}
            Connect M365
          </button>
        </div>
      )}
      {provider === 'google' && !gConnected && (
        <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          <Warning size={14} className="text-amber-600 shrink-0" />
          <p className="text-xs text-amber-700 flex-1">Google Workspace is not connected. Documents can't route to Drive.</p>
          <button
            onClick={() => onConnect('google')}
            disabled={connecting === 'google'}
            className="text-xs text-primary font-semibold hover:underline whitespace-nowrap flex items-center gap-1"
          >
            {connecting === 'google' ? <Spinner size={12} className="animate-spin" /> : <Plug size={12} />}
            Connect Google
          </button>
        </div>
      )}

      {/* Folder path input */}
      {provider !== 'none' && (
        <div className="space-y-1.5">
          <Label className="text-xs flex items-center gap-1.5">
            <FolderOpen size={12} className="text-muted-foreground" />
            {provider === 'sharepoint' ? 'SharePoint folder path' : 'Google Drive folder'}
          </Label>
          <div className="relative">
            <Input
              value={folder}
              onChange={e => onFolderChange(e.target.value)}
              placeholder={suggestFolder(provider, town, moduleName, slotLabel)}
              className="text-xs font-mono pr-20"
            />
            {!folder && (
              <button
                onClick={() => onFolderChange(suggestFolder(provider, town, moduleName, slotLabel))}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-primary font-semibold hover:underline"
              >
                Use suggested
              </button>
            )}
          </div>
          {(provider === 'sharepoint' && msConnected) && (
            <p className="text-[10px] text-emerald-600 flex items-center gap-1">
              <PlugsConnected size={10} />
              Connected as {connectors['microsoft']?.account}
            </p>
          )}
          {(provider === 'google' && gConnected) && (
            <p className="text-[10px] text-emerald-600 flex items-center gap-1">
              <PlugsConnected size={10} />
              Connected as {connectors['google']?.account}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
