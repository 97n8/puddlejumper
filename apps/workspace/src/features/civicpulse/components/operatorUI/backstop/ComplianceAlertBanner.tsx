import { Warning } from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'

interface ComplianceAlertBannerProps {
  count: number
  onView: () => void
}

export function ComplianceAlertBanner({ count, onView }: ComplianceAlertBannerProps) {
  if (count === 0) return null

  return (
    <div className="flex items-center gap-3 rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3">
      <Warning size={18} weight="fill" className="text-red-400 shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-red-300">
          {count} action{count > 1 ? 's' : ''} approaching compliance window
        </p>
        <p className="text-xs text-red-300/60 mt-0.5">
          These actions meet the public communication threshold. Review and generate summaries to avoid a compliance gap.
        </p>
      </div>
      <Button size="sm" variant="outline" className="shrink-0 border-red-500/40 text-red-400 hover:bg-red-500/10" onClick={onView}>
        Review
      </Button>
    </div>
  )
}
