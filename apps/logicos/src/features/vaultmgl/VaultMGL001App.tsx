import { useState, useCallback } from 'react'
import type { Municipality } from '@/data/maMunicipalities'
import { MA_MUNICIPALITIES } from '@/data/maMunicipalities'
import { pjApi } from '@/services/pjApi'
import { TownSelect } from './components/TownSelect'
import { VaultLayout } from './components/VaultLayout'
import { WorkbookPanel } from './components/WorkbookPanel'
import { generateTownData } from './data/generator'
import type { GeneratedTownData } from './data/generator'
import { mergeRealData } from './data/realData'
import type { StaffApiResponse } from './data/realData'

type LoadPhase = 'registry' | 'fallback' | 'done'

interface LoadState {
  phase: LoadPhase
  pct: number
  label: string
  error: string | null
}

export function VaultMGL001App() {
  const [town, setTown] = useState<Municipality | null>(null)
  const [townData, setTownData] = useState<GeneratedTownData | null>(null)
  const [loading, setLoading] = useState<LoadState | null>(null)
  const [showWorkbook, setShowWorkbook] = useState(false)

  const handleSelect = useCallback(async (muni: Municipality) => {
    setTown(muni)
    setLoading({ phase: 'registry', pct: 10, label: 'Checking PuddleJumper registry…', error: null })

    const base = generateTownData(muni)
    setTownData(base)

    // ── Try PJ registry first (fast, cached) ────────────────────────────────
    try {
      setLoading(l => l ? { ...l, pct: 40, label: `Loading ${muni.name} from registry…` } : l)
      const pjData = await pjApi.registry.town(muni.name)

      if (pjData && (pjData.fiscal || pjData.staff)) {
        setLoading(l => l ? { ...l, pct: 90, label: 'Merging registry data…' } : l)
        const rawStaff: StaffApiResponse | null = pjData.staff
          ? { employees: pjData.staff.employees, sourcePages: pjData.staff.sourcePages, notice: pjData.staff.notice }
          : null
        const merged = mergeRealData(base, muni, pjData.fiscal as Record<string, unknown> | null, rawStaff)
        setTownData(merged)
        setLoading(null)
        return
      }
    } catch {
      // Registry not available — fall through to live scrape
    }

    // ── Fallback: live Vercel scrape ─────────────────────────────────────────
    setLoading({ phase: 'fallback', pct: 20, label: 'Registry miss — fetching live fiscal data…', error: null })

    let realFiscal: Record<string, unknown> | null = null
    try {
      realFiscal = await pjApi.fiscal.sync(muni.name) as Record<string, unknown>
      setLoading(l => l ? { ...l, pct: 55, label: 'Fetching staff directory…' } : l)
    } catch {
      setLoading(l => l ? { ...l, pct: 55, label: 'Fetching staff directory…' } : l)
    }

    let realStaff: StaffApiResponse | null = null
    try {
      realStaff = await pjApi.civic.staff(muni.name) as StaffApiResponse
      setLoading(l => l ? { ...l, pct: 90, label: 'Merging data…' } : l)
    } catch {
      setLoading(l => l ? { ...l, pct: 90, label: 'Merging data…' } : l)
    }

    const merged = mergeRealData(base, muni, realFiscal, realStaff)
    setTownData(merged)
    setLoading(null)
  }, [])

  const handleWorkbookSelect = useCallback((name: string) => {
    const muni = MA_MUNICIPALITIES.find(m => m.name.toLowerCase() === name.toLowerCase())
    if (muni) {
      setShowWorkbook(false)
      handleSelect(muni)
    }
  }, [handleSelect])

  const handleChangeTown = useCallback(() => {
    setTown(null)
    setTownData(null)
    setLoading(null)
  }, [])

  if (town && loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-6" style={{ backgroundColor: '#F5F1E8' }}>
        <div className="flex flex-col items-center gap-2">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ backgroundColor: '#2C5F2D' }}>
            <svg className="w-6 h-6 text-white animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
            </svg>
          </div>
          <h2 className="text-xl font-semibold" style={{ color: '#1A1D16' }}>Loading {town.name}</h2>
          <p className="text-sm" style={{ color: '#7A7870' }}>{loading.label}</p>
        </div>
        <div className="w-72">
          <div className="h-2 rounded-full" style={{ backgroundColor: '#DDD8CE' }}>
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{ width: `${loading.pct}%`, backgroundColor: '#2C5F2D' }}
            />
          </div>
          <p className="text-xs text-center mt-2" style={{ color: '#7A7870' }}>
            {loading.phase === 'registry' ? 'Checking PuddleJumper registry first…' : 'Live scrape from state databases…'}
          </p>
        </div>
      </div>
    )
  }

  if (!town || !townData) {
    if (showWorkbook) {
      return (
        <div>
          <div className="px-6 pt-4 flex items-center gap-3" style={{ backgroundColor: '#F5F1E8' }}>
            <button onClick={() => setShowWorkbook(false)}
              className="text-sm flex items-center gap-1.5 px-3 py-1.5 rounded-lg border transition-colors hover:bg-stone-100"
              style={{ borderColor: '#DDD8CE', color: '#7A7870', backgroundColor: '#fff' }}>
              ← Back to Town Select
            </button>
          </div>
          <WorkbookPanel onSelectTown={handleWorkbookSelect} />
        </div>
      )
    }
    return <TownSelect onSelect={handleSelect} onOpenWorkbook={() => setShowWorkbook(true)} />
  }

  return <VaultLayout town={town} townData={townData} onChangeTown={handleChangeTown} />
}
