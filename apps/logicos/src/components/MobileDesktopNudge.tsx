import { Desktop, ArrowSquareOut, X } from '@phosphor-icons/react'
import { useState } from 'react'
import type { ViewMode } from '@/hooks/useMobileMode'

interface MobileDesktopNudgeProps {
  onSetViewOverride: (m: ViewMode) => void
  townWebsiteUrl?: string | null
}

/**
 * A dismissible banner shown at the top of complex tools on mobile.
 * Offers to switch to desktop view or visit the town's website instead.
 */
export function MobileDesktopNudge({ onSetViewOverride, townWebsiteUrl }: MobileDesktopNudgeProps) {
  const [dismissed, setDismissed] = useState(false)
  if (dismissed) return null

  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-amber-950/40 border-b border-amber-800/30 text-amber-200 shrink-0">
      <Desktop size={14} className="shrink-0 opacity-70" weight="duotone" />
      <p className="flex-1 text-[11px] leading-tight">
        This tool works best on a computer.
      </p>
      <button
        onClick={() => onSetViewOverride('desktop')}
        className="flex items-center gap-1 text-[11px] font-semibold text-amber-300 hover:text-amber-100 transition-colors whitespace-nowrap"
      >
        Desktop view
        <ArrowSquareOut size={11} />
      </button>
      {townWebsiteUrl && (
        <>
          <span className="text-amber-700 text-[10px]">·</span>
          <a
            href={townWebsiteUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[11px] font-semibold text-amber-300 hover:text-amber-100 transition-colors whitespace-nowrap flex items-center gap-1"
          >
            Town site
            <ArrowSquareOut size={11} />
          </a>
        </>
      )}
      <button
        onClick={() => setDismissed(true)}
        aria-label="Dismiss"
        className="ml-1 p-0.5 text-amber-500 hover:text-amber-200 transition-colors shrink-0"
      >
        <X size={12} weight="bold" />
      </button>
    </div>
  )
}
