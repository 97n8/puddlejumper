import { useState, useMemo } from 'react'
import { MA_MUNICIPALITIES, type Municipality } from '@/data/maMunicipalities'
import { Gavel, FolderOpen, ShoppingCart, FileText, Lightning, MagnifyingGlass, ArrowRight } from '@phosphor-icons/react'

interface Props {
  actorName: string
  autoTown?: Municipality | null
  onSelect: (m: Municipality) => void
  loading?: boolean
}

export function CivicTownSelector({ actorName, autoTown, onSelect, loading }: Props) {
  const [query, setQuery] = useState('')

  const SMALL_TOWN_THRESHOLD = 15_000

  const filtered = useMemo(() => {
    if (!query.trim()) {
      return MA_MUNICIPALITIES
        .filter(m => (m.population ?? 0) < SMALL_TOWN_THRESHOLD)
        .sort((a, b) => a.name.localeCompare(b.name))
    }
    const q = query.toLowerCase()
    return MA_MUNICIPALITIES.filter(m =>
      m.name.toLowerCase().includes(q) || m.county.toLowerCase().includes(q)
    )
  }, [query])

  return (
    <div className="flex-1 flex overflow-hidden bg-background">

      {/* Left panel — info */}
      <div className="hidden lg:flex w-80 flex-shrink-0 flex-col bg-card/60 border-r border-border p-8 justify-between">
        <div>
          <div className="w-12 h-12 rounded-2xl bg-red-900/40 border border-red-800/40 flex items-center justify-center mb-6">
            <Gavel size={22} className="text-red-300" />
          </div>
          <h1 className="text-foreground font-black text-2xl leading-tight mb-2">Civic</h1>
          <p className="text-muted-foreground text-sm leading-relaxed mb-8">
            A complete governance workspace for your municipality — prefilled with your town's data and built around Massachusetts law.
          </p>
          <div className="space-y-5">
            {[
              {
                Icon: Gavel,
                label: 'Open Meetings Law (c.30A)',
                detail: 'Build agendas, post public notices, and record minutes within statutory deadlines.',
              },
              {
                Icon: FolderOpen,
                label: 'Public Records (c.66 §10)',
                detail: 'Track and fulfill public records requests. Deadlines enforced automatically.',
              },
              {
                Icon: ShoppingCart,
                label: 'Procurement (c.30B)',
                detail: 'Bid thresholds, vendor records, and contract templates aligned to state rules.',
              },
              {
                Icon: FileText,
                label: 'MGL-Compliant Templates',
                detail: "Every form and document prefilled with your town's name, officials, and statutes.",
              },
              {
                Icon: Lightning,
                label: 'Live Exceptions & Deadlines',
                detail: 'Flags surface when a deadline is at risk or a required step is incomplete.',
              },
            ].map(({ Icon, label, detail }) => (
              <div key={label} className="flex gap-3">
                <div className="mt-0.5 shrink-0 w-7 h-7 rounded-lg bg-muted flex items-center justify-center">
                  <Icon size={14} className="text-muted-foreground" />
                </div>
                <div>
                  <div className="text-foreground text-xs font-semibold leading-snug">{label}</div>
                  <div className="text-muted-foreground/70 text-[11px] leading-snug mt-0.5">{detail}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
        {actorName && (
          <div className="text-muted-foreground/60 text-xs pt-4">Signed in as {actorName}</div>
        )}
      </div>

      {/* Right panel — picker */}
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* Header */}
        <div className="flex-shrink-0 px-6 pt-10 pb-4 border-b border-border">
          <div className="text-muted-foreground text-sm mb-0.5">
            Welcome{actorName ? `, ${actorName.split(' ')[0]}` : ''}
          </div>
          <h2 className="text-foreground text-2xl font-black">Select your municipality</h2>
          <p className="text-muted-foreground text-sm mt-1">
            Your workspace opens with your town's officials, deadlines, and MGL templates already filled in.
          </p>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">

          {/* Search */}
          <div className="relative">
            <MagnifyingGlass size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search all 351 Massachusetts municipalities…"
              className="w-full bg-card border border-border text-foreground placeholder:text-muted-foreground/40 rounded-xl pl-9 pr-4 py-2.5 text-sm focus:outline-none focus:border-border transition"
              autoFocus={!autoTown}
            />
          </div>

          {/* List */}
          <div className="space-y-1">
            {filtered.map(m => (
              <button
                key={m.dor_code}
                onClick={() => onSelect(m)}
                disabled={loading}
                className="w-full flex items-center justify-between px-4 py-2.5 rounded-xl bg-card hover:bg-muted border border-transparent hover:border-border transition group text-left disabled:opacity-40"
              >
                <div className="flex items-center gap-2.5">
                  <span className="text-foreground text-sm font-medium">{m.name}</span>
                  <span className="text-muted-foreground/60 text-xs">{m.county} Co.</span>
                  {m.is_client && (
                    <span className="text-[9px] font-bold text-emerald-400 bg-emerald-400/10 px-1.5 py-0.5 rounded">CLIENT</span>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  {m.population && <span className="text-muted-foreground/60 text-xs">{m.population.toLocaleString()}</span>}
                  <ArrowRight size={14} className="text-muted-foreground/40 group-hover:text-muted-foreground transition" />
                </div>
              </button>
            ))}
            {filtered.length === 0 && (
              <div className="text-center py-10 text-muted-foreground/60 text-sm">No municipalities match "{query}"</div>
            )}
          </div>

          {!query && (
            <div className="text-center text-muted-foreground/40 text-xs pb-2">
              Showing 217 towns under 15,000 residents · Type to search all 351
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
