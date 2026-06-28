import { Warning, XCircle, Info, CheckCircle, FolderOpen } from '@phosphor-icons/react'
import type { WatchFlag } from '../data/generator'

interface WatchPanelProps {
  flags: WatchFlag[]
  onResolve: (id: string) => void
}

const LEVEL_CONFIG = {
  critical: {
    bg: '#FDEFEA',
    border: '#B84020',
    stripe: '#B84020',
    icon: XCircle,
    iconColor: '#B84020',
    badgeBg: '#B84020',
    label: 'CRITICAL',
  },
  urgent: {
    bg: '#FBF5E6',
    border: '#B8911E',
    stripe: '#B8911E',
    icon: Warning,
    iconColor: '#B8911E',
    badgeBg: '#B8911E',
    label: 'URGENT',
  },
  warn: {
    bg: '#F5F1E8',
    border: '#DDD8CE',
    stripe: '#B8911E',
    icon: Warning,
    iconColor: '#B8911E',
    badgeBg: '#97BC62',
    label: 'WARN',
  },
  info: {
    bg: '#E8F2EB',
    border: '#2C5F2D',
    stripe: '#97BC62',
    icon: Info,
    iconColor: '#2C5F2D',
    badgeBg: '#2C5F2D',
    label: 'INFO',
  },
}

const SORT_ORDER: Record<string, number> = { critical: 0, urgent: 1, warn: 2, info: 3 }

export function WatchPanel({ flags, onResolve }: WatchPanelProps) {
  const active = flags
    .filter(f => !f.resolvedAt)
    .sort((a, b) => SORT_ORDER[a.level] - SORT_ORDER[b.level])

  const resolved = flags.filter(f => f.resolvedAt)

  if (active.length === 0 && resolved.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <CheckCircle size={36} style={{ color: '#97BC62', marginBottom: 12 }} />
        <div className="text-sm font-medium" style={{ color: '#1A1D16' }}>No active flags</div>
        <p className="text-xs mt-1" style={{ color: '#7A7870' }}>All watch flags have been resolved.</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {active.length > 0 && (
        <>
          <div className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: '#7A7870' }}>
            Active — {active.length} flag{active.length !== 1 ? 's' : ''}
          </div>
          {active.map(flag => {
            const cfg = LEVEL_CONFIG[flag.level]
            const Icon = cfg.icon

            return (
              <div
                key={flag.id}
                className="rounded-lg border overflow-hidden flex"
                style={{ borderColor: cfg.border, backgroundColor: cfg.bg }}
              >
                {/* Colored left stripe */}
                <div className="w-1 shrink-0" style={{ backgroundColor: cfg.stripe }} />

                <div className="flex-1 p-3">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <div className="flex items-center gap-2">
                      <Icon size={14} style={{ color: cfg.iconColor }} />
                      <span
                        className="text-[10px] px-1.5 py-0.5 rounded-full font-bold"
                        style={{ backgroundColor: cfg.badgeBg, color: '#fff' }}
                      >
                        {cfg.label}
                      </span>
                    </div>
                  </div>
                  <div className="text-sm font-semibold mb-1" style={{ color: '#1A1D16' }}>{flag.title}</div>
                  <p className="text-xs mb-2" style={{ color: '#7A7870' }}>{flag.body}</p>
                  {flag.mglCitation && (
                    <div className="text-[11px] font-mono mb-2" style={{ color: '#7A7870' }}>{flag.mglCitation}</div>
                  )}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => onResolve(flag.id)}
                      className="text-xs px-2.5 py-1 rounded-md font-medium transition-opacity hover:opacity-80"
                      style={{ backgroundColor: cfg.stripe, color: '#fff' }}
                    >
                      Resolve
                    </button>
                    {flag.caseId && (
                      <button
                        className="flex items-center gap-1 text-xs"
                        style={{ color: '#7A7870' }}
                      >
                        <FolderOpen size={12} />
                        View Case
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </>
      )}

      {resolved.length > 0 && (
        <div className="mt-4">
          <div className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: '#7A7870' }}>
            Resolved — {resolved.length}
          </div>
          {resolved.map(flag => (
            <div
              key={flag.id}
              className="rounded-lg border px-3 py-2 mb-2 flex items-center gap-2"
              style={{ borderColor: '#DDD8CE', backgroundColor: '#fff' }}
            >
              <CheckCircle size={14} style={{ color: '#97BC62' }} />
              <span className="text-xs line-through" style={{ color: '#7A7870' }}>{flag.title}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
