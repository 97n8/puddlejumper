import { cn } from '@/lib/utils'
import { MagnifyingGlass, Buildings, Star } from '@phosphor-icons/react'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { Municipality } from '@/data/maMunicipalities'
import { fmtNum, MA_COUNTIES } from './townfinderTypes'

interface TownListPanelProps {
  towns: Municipality[]
  filtered: Municipality[]
  activeTownCode: number | null
  search: string
  countyFilter: string
  showDetail: boolean
  onSearch: (q: string) => void
  onCountyFilter: (c: string) => void
  onSelectTown: (town: Municipality) => void
}

export function TownListPanel({
  towns,
  filtered,
  activeTownCode,
  search,
  countyFilter,
  showDetail,
  onSearch,
  onCountyFilter,
  onSelectTown,
}: TownListPanelProps) {
  return (
    <div className={cn(
      'flex flex-col border-r bg-card',
      'w-full sm:w-72 lg:w-80 flex-shrink-0',
      showDetail && 'hidden sm:flex',
    )}>
      {/* Search + filter */}
      <div className="p-3 border-b space-y-2">
        <div className="relative">
          <MagnifyingGlass size={15} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search towns…"
            value={search}
            onChange={e => onSearch(e.target.value)}
            className="pl-8 h-8 text-sm"
          />
        </div>
        <Select value={countyFilter} onValueChange={onCountyFilter}>
          <SelectTrigger className="h-8 text-xs">
            <SelectValue placeholder="All counties" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All counties</SelectItem>
            {MA_COUNTIES.map(c => (
              <SelectItem key={c} value={c}>{c} County</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-[11px] text-muted-foreground">{filtered.length} towns</p>
      </div>

      {/* List */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        {filtered.map(town => {
          const isActive = town.dor_code === activeTownCode
          return (
            <button
              key={town.dor_code}
              onClick={() => onSelectTown(town)}
              className={cn(
                'w-full flex items-start gap-3 px-3 py-2.5 text-left transition-colors border-b border-muted/50',
                isActive
                  ? 'bg-primary/10 border-l-2 border-l-primary'
                  : 'hover:bg-muted/50',
              )}
            >
              <div className="w-7 h-7 rounded-md bg-muted flex items-center justify-center flex-shrink-0 mt-0.5">
                <Buildings size={14} className="text-muted-foreground" />
              </div>
              <div className="min-w-0 flex-1">
                <p className={cn('text-sm font-medium leading-tight', isActive && 'text-primary')}>
                  {town.name}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {town.county} · {fmtNum(town.population ?? 0)}
                </p>
              </div>
              {isActive && <Star size={12} weight="fill" className="text-primary mt-1 flex-shrink-0" />}
            </button>
          )
        })}
        {filtered.length === 0 && (
          <p className="p-4 text-sm text-muted-foreground text-center">No towns found</p>
        )}
      </div>

      {/* Footer: show total count */}
      <div className="px-3 py-2 border-t text-[11px] text-muted-foreground">
        {towns.length} total towns
      </div>
    </div>
  )
}
