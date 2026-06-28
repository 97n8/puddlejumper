import { useState, useMemo } from 'react'
import { MagnifyingGlass, Shield, MapPin, Table } from '@phosphor-icons/react'
import { MA_MUNICIPALITIES } from '@/data/maMunicipalities'
import type { Municipality } from '@/data/maMunicipalities'

interface TownSelectProps {
  onSelect: (muni: Municipality) => void
  onOpenWorkbook?: () => void
}

function planTier(pop: number): string {
  if (pop < 3000) return 'Starter'
  if (pop < 10000) return 'Full'
  return 'Enterprise'
}

function planColor(tier: string): string {
  if (tier === 'Enterprise') return '#2C5F2D'
  if (tier === 'Full') return '#97BC62'
  return '#B8911E'
}

function fmtBudget(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}m`
  return `$${(n / 1000).toFixed(0)}k`
}

export function TownSelect({ onSelect, onOpenWorkbook }: TownSelectProps) {
  const [query, setQuery] = useState('')

  const filtered = useMemo(() => {
    const q = query.toLowerCase()
    return MA_MUNICIPALITIES
      .filter(m => (m.population ?? 0) < 15_000)   // small towns only
      .filter(m =>
        m.name.toLowerCase().includes(q) || m.county.toLowerCase().includes(q)
      )
  }, [query])

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: '#F5F1E8' }}>
      {/* Header */}
      <div className="py-10 text-center px-4">
        <div className="flex items-center justify-center gap-3 mb-3">
          <Shield size={36} weight="fill" style={{ color: '#2C5F2D' }} />
          <h1 className="text-4xl font-mono font-bold tracking-tight" style={{ color: '#2C5F2D' }}>
            VAULT MGL-001
          </h1>
        </div>
        <p className="text-lg" style={{ color: '#7A7870' }}>
          Select your municipality to begin the governance environment
        </p>
        <div className="flex items-center justify-center gap-3 mt-3 flex-wrap">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium" style={{ backgroundColor: '#2C5F2D', color: '#fff' }}>
            {filtered.length} Massachusetts municipalities (under 15,000 residents)
          </div>
          {onOpenWorkbook && (
            <button
              onClick={onOpenWorkbook}
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border transition-colors hover:bg-stone-100"
              style={{ borderColor: '#DDD8CE', color: '#7A7870', backgroundColor: '#fff' }}
            >
              <Table size={12} />
              Registry Workbook
            </button>
          )}
        </div>
      </div>

      {/* Search */}
      <div className="px-4 max-w-xl mx-auto w-full mb-6">
        <div className="relative">
          <MagnifyingGlass size={18} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#7A7870' }} />
          <input
            type="text"
            placeholder="Search by town or county…"
            value={query}
            onChange={e => setQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-3 rounded-lg border text-sm outline-none focus:ring-2 focus:ring-[#2C5F2D]"
            style={{ borderColor: '#DDD8CE', backgroundColor: '#fff', color: '#1A1D16' }}
          />
        </div>
        <p className="text-xs mt-2 text-center" style={{ color: '#7A7870' }}>
          {filtered.length} town{filtered.length !== 1 ? 's' : ''} found
        </p>
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-y-auto px-4 pb-10">
        <div className="max-w-6xl mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {filtered.map(muni => {
            const pop = muni.population ?? 0
            const budget = pop * 3400
            const tier = planTier(pop)
            return (
              <button
                key={muni.dor_code}
                onClick={() => onSelect(muni)}
                className="text-left rounded-lg border p-4 transition-all hover:shadow-md focus:outline-none focus:ring-2 focus:ring-offset-1"
                style={{ borderColor: '#DDD8CE', backgroundColor: '#fff', color: '#1A1D16' }}
              >
                <div className="flex items-start justify-between mb-2">
                  <span className="font-semibold text-sm leading-tight">{muni.name}</span>
                  <span
                    className="text-xs px-2 py-0.5 rounded-full font-medium ml-2 shrink-0"
                    style={{ backgroundColor: planColor(tier), color: '#fff' }}
                  >
                    {tier}
                  </span>
                </div>
                <div className="flex items-center gap-1 text-xs mb-1" style={{ color: '#7A7870' }}>
                  <MapPin size={12} />
                  {muni.county} County
                </div>
                {pop > 0 && (
                  <div className="text-xs mt-1" style={{ color: '#7A7870' }}>
                    Pop. {pop.toLocaleString()} · Est. budget {fmtBudget(budget)}
                  </div>
                )}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
