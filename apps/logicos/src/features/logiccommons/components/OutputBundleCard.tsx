import type { Artifact, PlacementConfirmation } from '../types'
import { PlacementStatusBadge } from './PlacementStatusBadge'
import { Download } from 'lucide-react'

interface Props {
  artifact: Artifact
  placement?: PlacementConfirmation
}

export function OutputBundleCard({ artifact, placement }: Props) {
  const typeLabel = artifact.artifact_type.charAt(0).toUpperCase() + artifact.artifact_type.slice(1)
  const formatLabel = artifact.output_format.toUpperCase()

  return (
    <div className="rounded-lg border bg-card/50 p-3 flex items-center gap-3">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium">{typeLabel}</span>
          <span className="text-xs font-mono bg-slate-100 rounded px-2 py-0.5">{formatLabel}</span>
          <PlacementStatusBadge status={placement?.confirmation_status} />
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">
          {new Date(artifact.rendered_at).toLocaleString()}
        </p>
      </div>
      <button
        disabled
        title="Download (mock)"
        className="p-1.5 rounded-md border border-border text-muted-foreground opacity-40 cursor-not-allowed"
      >
        <Download size={14} />
      </button>
    </div>
  )
}
