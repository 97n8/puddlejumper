import { WindowsLogo, GoogleLogo, CheckCircle, Spinner } from '@phosphor-icons/react'
import type { ConnectorStatus } from '../types'

export function ConnectorBadge({
  provider,
  status,
  connecting,
  onConnect,
}: {
  provider: 'microsoft' | 'google'
  status?: ConnectorStatus
  connecting: string | null
  onConnect: (p: 'microsoft' | 'google') => void
}) {
  const isMicrosoft = provider === 'microsoft'
  const label = isMicrosoft ? 'Microsoft 365' : 'Google Workspace'
  const Icon = isMicrosoft ? WindowsLogo : GoogleLogo
  const color = isMicrosoft ? 'text-[#0078D4]' : 'text-[#4285F4]'
  const isConnecting = connecting === provider

  if (status?.connected) {
    return (
      <div className="flex items-center gap-2 text-xs bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
        <Icon size={14} className={color} weight="fill" />
        <span className="text-emerald-700 font-medium">{label}</span>
        <CheckCircle size={13} className="text-emerald-500" weight="fill" />
        {status.account && <span className="text-emerald-600 ml-1 truncate max-w-[180px]">{status.account}</span>}
      </div>
    )
  }

  return (
    <button
      onClick={() => onConnect(provider)}
      disabled={!!isConnecting}
      className="flex items-center gap-2 text-xs bg-muted/50 border border-border rounded-lg px-3 py-2 hover:bg-muted transition-colors disabled:opacity-60"
    >
      {isConnecting
        ? <Spinner size={13} className="animate-spin" />
        : <Icon size={14} className={color} weight="fill" />
      }
      <span className="text-muted-foreground font-medium">{label}</span>
      <span className="text-primary font-semibold ml-1">Connect →</span>
    </button>
  )
}
