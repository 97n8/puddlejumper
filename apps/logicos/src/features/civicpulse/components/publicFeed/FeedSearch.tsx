import { Input } from '@/components/ui/input'
import { MagnifyingGlass, X } from '@phosphor-icons/react'

interface FeedSearchProps {
  value: string
  onChange: (value: string) => void
}

export function FeedSearch({ value, onChange }: FeedSearchProps) {
  return (
    <div className="relative">
      <MagnifyingGlass size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
      <Input
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder="Search governance actions…"
        className="pl-9 pr-9 h-9 text-sm"
      />
      {value && (
        <button
          onClick={() => onChange('')}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
        >
          <X size={13} />
        </button>
      )}
    </div>
  )
}
