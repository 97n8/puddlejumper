import { useState, useMemo } from 'react'
import { MagnifyingGlass, X, CheckCircle } from '@phosphor-icons/react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { MA_MUNICIPALITIES } from '@/data/maMunicipalities'
import { getTownSealUrl, hasCuratedSeal } from '@/data/townSeals'
import { WorkspaceIcon } from '@/components/WorkspaceIcon'

interface TownSealPickerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  selected?: string | null
  onSelect: (sealUrl: string, townName: string) => void
}

// Deduplicated sorted list of all MA towns
const ALL_TOWNS = [...new Map(MA_MUNICIPALITIES.map(m => [m.name, m])).values()]
  .sort((a, b) => {
    // Curated seals first, then alphabetical
    const aC = hasCuratedSeal(a.name) ? 0 : 1
    const bC = hasCuratedSeal(b.name) ? 0 : 1
    if (aC !== bC) return aC - bC
    return a.name.localeCompare(b.name)
  })

export function TownSealPicker({ open, onOpenChange, selected, onSelect }: TownSealPickerProps) {
  const [query, setQuery] = useState('')
  const [failedUrls, setFailedUrls] = useState<Set<string>>(new Set())

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim()
    if (!q) return ALL_TOWNS
    return ALL_TOWNS.filter(t => t.name.toLowerCase().includes(q))
  }, [query])

  const markFailed = (url: string) =>
    setFailedUrls(prev => new Set([...prev, url]))

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-5 pt-5 pb-3 border-b shrink-0">
          <DialogTitle>Town Seals</DialogTitle>
          <DialogDescription>
            Choose an official Massachusetts town seal as your workspace icon.
          </DialogDescription>

          {/* Search */}
          <div className="relative mt-2">
            <MagnifyingGlass
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
            />
            <input
              autoFocus
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search towns…"
              className="w-full pl-8 pr-8 py-2 text-sm rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-ring"
            />
            {query && (
              <button
                onClick={() => setQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X size={13} />
              </button>
            )}
          </div>
        </DialogHeader>

        {/* Grid */}
        <div className="overflow-y-auto flex-1 px-4 py-3">
          {filtered.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-10">No towns found.</p>
          ) : (
            <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
              {filtered.map(town => {
                const url = getTownSealUrl(town.name)
                const isSel = selected === url
                const failed = failedUrls.has(url)

                return (
                  <button
                    key={town.name}
                    onClick={() => { onSelect(url, town.name); onOpenChange(false) }}
                    className={cn(
                      'flex flex-col items-center gap-1.5 p-2 rounded-xl transition-all group',
                      isSel
                        ? 'bg-primary/10 ring-1 ring-primary/40'
                        : 'hover:bg-muted/60 active:scale-95',
                    )}
                    title={town.name}
                  >
                    {/* Seal tile */}
                    <div className="w-12 h-12 rounded-lg bg-white/80 dark:bg-white/10 flex items-center justify-center overflow-hidden border border-border/30 relative">
                      {!failed ? (
                        <img
                          src={url}
                          alt={`Seal of ${town.name}`}
                          className="w-10 h-10 object-contain"
                          loading="lazy"
                          onError={() => markFailed(url)}
                        />
                      ) : (
                        <WorkspaceIcon icon="🏛️" name={town.name} className="text-xl" />
                      )}
                      {isSel && (
                        <div className="absolute inset-0 bg-primary/10 flex items-center justify-center rounded-lg">
                          <CheckCircle size={20} weight="fill" className="text-primary" />
                        </div>
                      )}
                    </div>
                    <span className="text-[9px] font-medium text-center leading-tight text-muted-foreground group-hover:text-foreground line-clamp-2">
                      {town.name}
                    </span>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        <div className="px-5 py-3 border-t shrink-0 flex items-center justify-between">
          <p className="text-[11px] text-muted-foreground">
            {filtered.length} of {ALL_TOWNS.length} towns · seals sourced from Wikimedia Commons
          </p>
          <button
            onClick={() => onOpenChange(false)}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Cancel
          </button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
