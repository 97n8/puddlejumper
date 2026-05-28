import { Badge } from '@/components/ui/badge'

interface ToolTileProps {
  icon: React.ReactNode
  label: string
  description: string
  onClick?: () => void
  comingSoon?: boolean
}

export function ToolTile({ icon, label, description, onClick, comingSoon }: ToolTileProps) {
  return (
    <button
      type="button"
      onClick={comingSoon ? undefined : onClick}
      disabled={comingSoon}
      className={`
        relative flex flex-col gap-2 p-4 rounded-lg border text-left transition-all w-full
        ${comingSoon
          ? 'opacity-60 cursor-not-allowed bg-muted/30 border-border'
          : 'hover:shadow-md hover:border-primary/30 bg-card border-border cursor-pointer'}
      `}
    >
      {comingSoon && (
        <span className="absolute top-2 right-2">
          <Badge variant="secondary" className="text-[10px] px-1.5 py-0">Coming soon</Badge>
        </span>
      )}
      <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center">
        {icon}
      </div>
      <div>
        <p className="font-medium text-sm leading-tight">{label}</p>
        <p className="text-xs text-muted-foreground mt-0.5 leading-tight">{description}</p>
      </div>
    </button>
  )
}
