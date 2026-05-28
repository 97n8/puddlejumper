/**
 * WorkbookPanel — PuddleJumper-backed registry of all <15k MA municipalities.
 * Shows fiscal snapshots, staff counts, source websites, and sync status.
 * Falls back to estimated baseline data (population-based) when PJ has no real data.
 */

import { useState, useEffect } from 'react'
import {
  MagnifyingGlass, ArrowsClockwise, CheckCircle,
  WarningCircle, Clock, Buildings, Users, CurrencyDollar,
} from '@phosphor-icons/react'
import { pjApi } from '@/services/pjApi'
import { MA_MUNICIPALITIES } from '@/data/maMunicipalities'

type TownRow = {
  name: string
  dorCode: number
  county: string
  population?: number
  fiscal: { metrics: Record<string, unknown>; computedAt: string } | null
  fiscalEstimated: boolean
  staffCount: number | null
  staffEstimated: boolean
  staffScrapedAt: string | null
}

type SyncLog = {
  id: string
  status: string
  started_at: string
  finished_at?: string
  towns_total?: number
  towns_ok?: number
  towns_err?: number
}

function fmt$$(n: number | null | undefined): string {
  if (!n) return '—'
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`
  return `$${n}`
}

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function fmtAge(iso: string | null | undefined): { label: string; stale: boolean } {
  if (!iso) return { label: 'Never', stale: true }
  const ms = Date.now() - new Date(iso).getTime()
  const days = Math.floor(ms / 86400000)
  const hours = Math.floor(ms / 3600000)
  if (hours < 24) return { label: `${hours}h ago`, stale: false }
  if (days === 1) return { label: '1 day ago', stale: false }
  if (days < 7) return { label: `${days} days ago`, stale: false }
  if (days < 14) return { label: '1 week ago', stale: true }
  return { label: `${days} days ago`, stale: true }
}

interface WorkbookPanelProps {
  onSelectTown?: (name: string) => void
}

export function WorkbookPanel({ onSelectTown }: WorkbookPanelProps) {
  const [towns, setTowns] = useState<TownRow[]>([])
  const [syncLogs, setSyncLogs] = useState<SyncLog[]>([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [_error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [countyFilter, setCountyFilter] = useState('ALL')
  const [tab, setTab] = useState<'registry' | 'synclog'>('registry')

  async function load() {
    setLoading(true)
    setError(null)

    // Build baseline from MA_MUNICIPALITIES (population-based estimates for all towns)
    const baseTowns: TownRow[] = MA_MUNICIPALITIES.filter(m => (m.population ?? 0) < 15_000).map(m => {
      const pop = m.population ?? 0
      const estBudget = Math.round(pop * 3400)
      const estStaff = Math.max(4, Math.round(pop / 75))
      return {
        name: m.name,
        dorCode: m.dor_code,
        county: m.county,
        population: m.population,
        fiscal: {
          metrics: { operatingBudget: estBudget },
          computedAt: '',
        },
        fiscalEstimated: true,
        staffCount: estStaff,
        staffEstimated: true,
        staffScrapedAt: null,
      }
    })

    setTowns(baseTowns) // Show baseline immediately
    setLoading(false)

    // Then try PJ registry to get real data
    try {
      const [regRes, logRes] = await Promise.allSettled([
        pjApi.registry.towns(),
        pjApi.registry.synclog(),
      ])
      if (regRes.status === 'fulfilled') {
        const pjMap = new Map<string, typeof regRes.value.towns[0]>()
        for (const t of regRes.value.towns) pjMap.set(t.name.toLowerCase(), t)

        setTowns(prev => prev.map(base => {
          const pj = pjMap.get(base.name.toLowerCase())
          if (!pj) return base
          const realStaff = pj.staffCount && pj.staffCount > 0
          const realFiscal = !!pj.fiscal
          return {
            ...base,
            fiscal: realFiscal ? pj.fiscal as TownRow['fiscal'] : base.fiscal,
            fiscalEstimated: !realFiscal,
            staffCount: realStaff ? pj.staffCount : base.staffCount,
            staffEstimated: !realStaff,
            staffScrapedAt: pj.staffScrapedAt ?? null,
          }
        }))
      }
      if (logRes.status === 'fulfilled') setSyncLogs(logRes.value.syncs as SyncLog[])
    } catch {
      // PJ unreachable — baseline data is still shown
    }
  }

  async function triggerSync() {
    setSyncing(true)
    try {
      // Fast MMA sync first (all towns in one request), then reload data
      await pjApi.registry.syncMma()
      setTimeout(() => {
        load()
        setSyncing(false)
      }, 2000)
    } catch {
      setSyncing(false)
    }
  }

  useEffect(() => { load() }, [])

  const counties = ['ALL', ...Array.from(new Set(towns.map(t => t.county))).sort()]
  const filtered = towns.filter(t => {
    const matchSearch = !search || t.name.toLowerCase().includes(search.toLowerCase())
    const matchCounty = countyFilter === 'ALL' || t.county === countyFilter
    return matchSearch && matchCounty
  })

  const withFiscal = towns.filter(t => t.fiscal && !t.fiscalEstimated).length
  const withStaff = towns.filter(t => t.staffCount && t.staffCount > 0 && !t.staffEstimated).length
  const totalStaff = towns.reduce((a, t) => a + (t.staffCount ?? 0), 0)
  const lastSync = syncLogs[0]

  const TabBtn = ({ id, label }: { id: 'registry' | 'synclog'; label: string }) => (
    <button onClick={() => setTab(id)}
      className="px-4 py-2.5 text-sm transition"
      style={{
        fontWeight: tab === id ? 600 : 400,
        borderBottom: tab === id ? '2px solid #2C5F2D' : '2px solid transparent',
        color: tab === id ? '#2C5F2D' : '#7A7870',
      }}>{label}</button>
  )

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#F5F1E8' }}>
      {/* Header */}
      <div className="px-6 pt-6 pb-4">
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-xl font-bold" style={{ color: '#1A1D16' }}>Town Registry Workbook</h1>
            <p className="text-sm mt-0.5" style={{ color: '#7A7870' }}>
              {towns.length} municipalities under 15,000 residents — synced daily via PuddleJumper
            </p>
          </div>
          <button
            onClick={triggerSync}
            disabled={syncing}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-opacity hover:opacity-80 disabled:opacity-50"
            style={{ backgroundColor: '#2C5F2D', color: '#fff' }}
          >
            <ArrowsClockwise size={15} className={syncing ? 'animate-spin' : ''} />
            {syncing ? 'Syncing…' : 'Sync Now'}
          </button>
        </div>

        {/* Stats strip */}
        {!loading && (
          <div className="flex gap-3 mt-4 flex-wrap">
            {[
              { icon: Buildings, label: 'Towns', value: towns.length.toString() },
              { icon: CurrencyDollar, label: 'Live Fiscal', value: `${withFiscal} / ${towns.length}` },
              { icon: Users, label: 'Live Staff', value: `${withStaff} / ${towns.length}` },
              { icon: Users, label: 'Est. Staff Total', value: totalStaff.toLocaleString() },
              { icon: Clock, label: 'Last Sync', value: lastSync ? fmtDate(lastSync.started_at) : 'Pending' },
            ].map(s => (
              <div key={s.label} className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm"
                style={{ backgroundColor: '#fff', border: '1px solid #DDD8CE' }}>
                <s.icon size={14} style={{ color: '#7A7870' }} />
                <span style={{ color: '#7A7870' }}>{s.label}:</span>
                <span className="font-semibold" style={{ color: '#1A1D16' }}>{s.value}</span>
              </div>
            ))}
          </div>
        )}

        {/* PJ status */}
        {!loading && (
          <div className="mt-3 flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs"
            style={{ backgroundColor: withFiscal > 0 ? '#E8F2EB' : '#FEF9EC', border: `1px solid ${withFiscal > 0 ? '#97BC62' : '#D4A017'}`, color: withFiscal > 0 ? '#2C5F2D' : '#92400E' }}>
            {withFiscal > 0 ? <CheckCircle size={14} /> : <WarningCircle size={14} />}
            {withFiscal > 0
              ? `Connected to PuddleJumper · ${withFiscal} towns with live data · api.publiclogic.org/api/registry`
              : `Showing estimated data (population-based) — live registry sync pending. Click "Sync Now" to populate.`}
          </div>
        )}
      </div>

      {/* Tab bar */}
      <div className="flex gap-0 px-6 border-b" style={{ borderColor: '#DDD8CE' }}>
        <TabBtn id="registry" label={`Registry (${towns.length})`} />
        <TabBtn id="synclog" label="Sync Log" />
      </div>

      {/* ── Registry tab ─────────────────────────────────────────────────── */}
      {tab === 'registry' && (
        <div className="p-6 space-y-4">
          {/* Filters */}
          <div className="flex gap-3 flex-wrap">
            <div className="relative flex-1 min-w-48">
              <MagnifyingGlass size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#7A7870' }} />
              <input
                type="text" placeholder="Search towns…" value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 rounded-lg border text-sm outline-none"
                style={{ borderColor: '#DDD8CE', backgroundColor: '#fff', color: '#1A1D16' }}
              />
            </div>
            <select value={countyFilter} onChange={e => setCountyFilter(e.target.value)}
              className="px-3 py-2 rounded-lg border text-sm outline-none"
              style={{ borderColor: '#DDD8CE', backgroundColor: '#fff', color: '#1A1D16' }}>
              {counties.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <span className="flex items-center text-xs px-3 rounded-lg" style={{ backgroundColor: '#F5F1E8', color: '#7A7870' }}>
              {filtered.length} towns
            </span>
          </div>

          {loading ? (
            <div className="py-16 text-center text-sm" style={{ color: '#7A7870' }}>
              <div className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin mx-auto mb-3" style={{ borderColor: '#2C5F2D', borderTopColor: 'transparent' }} />
              Loading registry from PuddleJumper…
            </div>
          ) : (
            <div className="rounded-xl border overflow-hidden" style={{ borderColor: '#DDD8CE', backgroundColor: '#fff' }}>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{ backgroundColor: '#F5F1E8', borderBottom: '1px solid #DDD8CE' }}>
                      {['Town', 'County', 'Population', 'Est. Budget', 'Est. Staff', 'Last Scraped', 'Source'].map(h => (
                        <th key={h} className="text-left px-4 py-2.5 text-xs font-medium whitespace-nowrap" style={{ color: '#7A7870' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map(t => {
                      const budget = t.fiscal?.metrics?.operatingBudget as number | null | undefined
                      const age = fmtAge(t.staffScrapedAt)
                      const isLive = !t.fiscalEstimated || !t.staffEstimated
                      return (
                        <tr key={t.name} className="border-t hover:bg-stone-50 cursor-pointer transition-colors"
                          style={{ borderColor: '#DDD8CE' }}
                          onClick={() => onSelectTown?.(t.name)}>
                          <td className="px-4 py-3">
                            <div className="font-semibold" style={{ color: '#1A1D16' }}>{t.name}</div>
                          </td>
                          <td className="px-4 py-3 text-xs" style={{ color: '#7A7870' }}>{t.county}</td>
                          <td className="px-4 py-3 text-xs" style={{ color: '#7A7870' }}>
                            {t.population ? t.population.toLocaleString() : '—'}
                          </td>
                          <td className="px-4 py-3 text-xs font-mono">
                            {budget ? (
                              <span className="flex items-center gap-1" style={{ color: t.fiscalEstimated ? '#B8911E' : '#2C5F2D' }}>
                                {fmt$$(budget)}
                                {t.fiscalEstimated && <span className="text-[10px] opacity-70">est.</span>}
                              </span>
                            ) : <span style={{ color: '#DDD8CE' }}>—</span>}
                          </td>
                          <td className="px-4 py-3">
                            {t.staffCount && t.staffCount > 0 ? (
                              <span className="flex items-center gap-1 text-xs" style={{ color: t.staffEstimated ? '#B8911E' : '#2C5F2D' }}>
                                <Users size={12} />{t.staffCount}
                                {t.staffEstimated && <span className="opacity-70">est.</span>}
                              </span>
                            ) : (
                              <span className="text-xs" style={{ color: '#DDD8CE' }}>—</span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <span className="text-xs" style={{ color: t.staffScrapedAt ? (age.stale ? '#B8911E' : '#7A7870') : '#DDD8CE' }}>
                              {t.staffScrapedAt ? age.label : 'Pending'}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span className="text-xs px-2 py-0.5 rounded font-medium"
                              style={{
                                backgroundColor: isLive ? '#E8F2EB' : '#FEF9EC',
                                color: isLive ? '#2C5F2D' : '#92400E',
                              }}>
                              {isLive ? 'Live' : 'Estimated'}
                            </span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              {filtered.length === 0 && (
                <div className="py-10 text-center text-sm" style={{ color: '#7A7870' }}>No towns found</div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Sync Log tab ─────────────────────────────────────────────────── */}
      {tab === 'synclog' && (
        <div className="p-6 space-y-3">
          <p className="text-xs" style={{ color: '#7A7870' }}>
            PuddleJumper runs a full sync of all 351 MA towns daily at 2 AM (scraping stale records ≥7 days old).
            Staff data is from DuckDuckGo → town website parsing. Fiscal data is from MA Division of Local Services.
          </p>
          {syncLogs.length === 0 ? (
            <div className="py-10 text-center text-sm" style={{ color: '#7A7870' }}>
              No sync runs found. Click "Sync Now" to trigger the first run.
            </div>
          ) : (
            <div className="rounded-xl border overflow-hidden" style={{ borderColor: '#DDD8CE', backgroundColor: '#fff' }}>
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ backgroundColor: '#F5F1E8', borderBottom: '1px solid #DDD8CE' }}>
                    {['Started', 'Status', 'OK', 'Errors', 'Duration', 'Total'].map(h => (
                      <th key={h} className="text-left px-4 py-2.5 text-xs font-medium" style={{ color: '#7A7870' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {syncLogs.map(s => {
                    const dur = s.finished_at
                      ? Math.round((new Date(s.finished_at).getTime() - new Date(s.started_at).getTime()) / 60000)
                      : null
                    return (
                      <tr key={s.id} className="border-t" style={{ borderColor: '#DDD8CE' }}>
                        <td className="px-4 py-3 text-xs" style={{ color: '#7A7870' }}>{fmtDate(s.started_at)}</td>
                        <td className="px-4 py-3">
                          <span className="text-xs px-2 py-0.5 rounded-full font-medium capitalize"
                            style={{
                              backgroundColor: s.status === 'success' ? '#E8F2EB' : s.status === 'running' ? '#EFF6FF' : '#FEF2F2',
                              color: s.status === 'success' ? '#2C5F2D' : s.status === 'running' ? '#1D4ED8' : '#DC2626',
                            }}>
                            {s.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs font-medium" style={{ color: '#2C5F2D' }}>{s.towns_ok ?? '—'}</td>
                        <td className="px-4 py-3 text-xs" style={{ color: s.towns_err ? '#DC2626' : '#7A7870' }}>{s.towns_err ?? '—'}</td>
                        <td className="px-4 py-3 text-xs" style={{ color: '#7A7870' }}>{dur !== null ? `${dur}m` : 'Running…'}</td>
                        <td className="px-4 py-3 text-xs" style={{ color: '#7A7870' }}>{s.towns_total ?? '—'}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
