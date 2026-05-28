import { Badge } from '@/components/ui/badge'
import { Gavel } from '@phosphor-icons/react'

interface LegalHoldBannerProps {
  note?: string
}

export function LegalHoldBanner({ note }: LegalHoldBannerProps) {
  return (
    <div className="flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3">
      <Gavel size={16} className="text-amber-400 mt-0.5 shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-amber-300">Legal Hold Active</span>
          <Badge className="text-[10px] px-1.5 py-0 h-4 bg-amber-500/20 text-amber-400 border-0">
            Counsel Review Required
          </Badge>
        </div>
        {note && (
          <p className="mt-1 text-xs text-amber-200/60">{note}</p>
        )}
        <p className="mt-1 text-xs text-amber-200/40">
          Publication is blocked until counsel clearance is logged in PuddleJumper.
        </p>
      </div>
    </div>
  )
}
