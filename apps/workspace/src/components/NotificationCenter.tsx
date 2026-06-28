// NotificationCenter — Global notification bell with popover panel
// Tracks system events, action items, and status changes.

import { useMemo } from 'react'
import { Bell, CheckCircle, WarningCircle, Info, ArrowCircleRight, X } from '@phosphor-icons/react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { useKV } from '@/hooks/useKV'

// ── Types ──────────────────────────────────────────────────────────────────

export type NotifType = 'info' | 'success' | 'warning' | 'action'

export interface AppNotification {
  id: string
  type: NotifType
  title: string
  description: string
  timestamp: string // ISO
  read: boolean
  tool?: string
}



// ── Helpers ────────────────────────────────────────────────────────────────

function relativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  const h = Math.floor(m / 60)
  const d = Math.floor(h / 24)
  if (m < 2) return 'Just now'
  if (m < 60) return `${m}m ago`
  if (h < 24) return `${h}h ago`
  if (d === 1) return 'Yesterday'
  if (d < 7) return `${d}d ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

const TYPE_META: Record<NotifType, { icon: React.ReactNode; color: string; dot: string }> = {
  action:  { icon: <ArrowCircleRight size={14} weight="duotone" />, color: 'text-primary',      dot: 'bg-primary' },
  warning: { icon: <WarningCircle size={14} weight="duotone" />,    color: 'text-amber-400',    dot: 'bg-amber-400' },
  success: { icon: <CheckCircle size={14} weight="duotone" />,      color: 'text-emerald-400',  dot: 'bg-emerald-400' },
  info:    { icon: <Info size={14} weight="duotone" />,              color: 'text-blue-400',     dot: 'bg-blue-400' },
}

// ── Main Component ─────────────────────────────────────────────────────────

interface NotificationCenterProps {
  onNavigateTool?: (tool: string) => void
}

export function NotificationCenter({ onNavigateTool }: NotificationCenterProps) {
  const [notifs, setNotifs] = useKV<AppNotification[]>('workspace-notifications', [])

  const unreadCount = useMemo(() => notifs.filter(n => !n.read).length, [notifs])

  const markRead = (id: string) =>
    setNotifs(prev => prev.map(n => n.id === id ? { ...n, read: true } : n))

  const markAllRead = () =>
    setNotifs(prev => prev.map(n => ({ ...n, read: true })))

  const dismiss = (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setNotifs(prev => prev.filter(n => n.id !== id))
  }

  const unread = notifs.filter(n => !n.read)
  const read = notifs.filter(n => n.read)

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          aria-label="Notifications"
          className="relative w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-all"
        >
          <Bell size={16} weight={unreadCount > 0 ? 'fill' : 'duotone'} className={unreadCount > 0 ? 'text-primary' : ''} />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-[15px] h-[15px] rounded-full bg-primary text-primary-foreground text-[9px] font-bold flex items-center justify-center px-0.5 leading-none border border-background">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" sideOffset={8} className="w-80 p-0 shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <div className="flex items-center gap-2">
            <Bell size={14} weight="duotone" className="text-muted-foreground" />
            <span className="text-sm font-semibold text-foreground">Notifications</span>
            {unreadCount > 0 && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/15 text-primary font-semibold border border-primary/20">
                {unreadCount} new
              </span>
            )}
          </div>
          {unreadCount > 0 && (
            <button
              onClick={markAllRead}
              className="text-[11px] text-muted-foreground hover:text-foreground transition-colors"
            >
              Mark all read
            </button>
          )}
        </div>

        <div className="overflow-y-auto max-h-[420px]">
          {notifs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 gap-2 text-muted-foreground">
              <Bell size={22} weight="duotone" className="opacity-30" />
              <p className="text-sm">All caught up!</p>
            </div>
          ) : (
            <>
              {/* Unread */}
              {unread.length > 0 && (
                <div>
                  <p className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-widest px-4 pt-3 pb-1.5">New</p>
                  {unread.map(n => {
                    const tm = TYPE_META[n.type]
                    return (
                      <div
                        key={n.id}
                        onClick={() => { markRead(n.id); if (n.tool) onNavigateTool?.(n.tool) }}
                        className="flex items-start gap-3 px-4 py-3 hover:bg-muted/40 cursor-pointer transition-colors border-b border-border/30 relative group"
                      >
                        <span className={`w-1.5 h-1.5 rounded-full shrink-0 mt-1.5 ${tm.dot}`} />
                        <span className={`shrink-0 mt-0.5 ${tm.color}`}>{tm.icon}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-foreground leading-tight">{n.title}</p>
                          <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">{n.description}</p>
                          <p className="text-[10px] text-muted-foreground/50 mt-1">{relativeTime(n.timestamp)}</p>
                        </div>
                        <button
                          onClick={e => dismiss(n.id, e)}
                          className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0 text-muted-foreground/50 hover:text-muted-foreground mt-0.5"
                        >
                          <X size={11} />
                        </button>
                      </div>
                    )
                  })}
                </div>
              )}

              {/* Read */}
              {read.length > 0 && (
                <div>
                  {unread.length > 0 && (
                    <p className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-widest px-4 pt-3 pb-1.5">Earlier</p>
                  )}
                  {read.map(n => {
                    const tm = TYPE_META[n.type]
                    return (
                      <div
                        key={n.id}
                        onClick={() => { if (n.tool) onNavigateTool?.(n.tool) }}
                        className={`flex items-start gap-3 px-4 py-3 border-b border-border/30 transition-colors group ${n.tool ? 'hover:bg-muted/40 cursor-pointer' : ''}`}
                      >
                        <span className="w-1.5 h-1.5 shrink-0 mt-1.5" />
                        <span className={`shrink-0 mt-0.5 opacity-50 ${tm.color}`}>{tm.icon}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-muted-foreground leading-tight">{n.title}</p>
                          <p className="text-[11px] text-muted-foreground/60 mt-0.5 leading-snug">{n.description}</p>
                          <p className="text-[10px] text-muted-foreground/40 mt-1">{relativeTime(n.timestamp)}</p>
                        </div>
                        <button
                          onClick={e => dismiss(n.id, e)}
                          className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0 text-muted-foreground/50 hover:text-muted-foreground mt-0.5"
                        >
                          <X size={11} />
                        </button>
                      </div>
                    )
                  })}
                </div>
              )}
            </>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
