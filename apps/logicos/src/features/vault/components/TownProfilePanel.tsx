/**
 * TownProfilePanel
 *
 * Full town intelligence view — aggregates data from:
 *   - MMA Data Hub (demographics, finances, governance, representation)
 *   - MassGIS hosted feature service (census pop history 1960-2020, area, FIPS)
 *   - MA Legislature API (local bills, legislator contact enrichment)
 *   - PuddleJumper registry (DLS fiscal snapshot, staff directory)
 *
 * Shows a "Your Town" placeholder for demo/Logicville environments.
 */

import { useState, useEffect, useCallback } from 'react'
import { pjApi } from '@/services/pjApi'

// ── Types inferred from pjApi ──────────────────────────────────────────────
type MMAResponse = Awaited<ReturnType<typeof pjApi.registry.mmaProfile>>
type MMAProfile = MMAResponse['profile']
type MassGISResponse = Awaited<ReturnType<typeof pjApi.registry.massgis>>
type MassGISData = MassGISResponse['data']
type LegislationResponse = Awaited<ReturnType<typeof pjApi.registry.legislation>>
type RegistryResponse = Awaited<ReturnType<typeof pjApi.registry.town>>
type MembersResponse = Awaited<ReturnType<typeof pjApi.registry.members>>
type MALegMember = MembersResponse['members'][number]

type Tab = 'overview' | 'community' | 'finances' | 'legislation' | 'representation' | 'staff'

const DEMO_TOWNS = ['Your Town', 'Logicville', 'Town of Logicville', 'City of Logicville']
const isDemo = (t: string) => !t || DEMO_TOWNS.some(d => d.toLowerCase() === t.toLowerCase())

// ── Simple SVG population sparkline ───────────────────────────────────────
function PopSparkline({ data }: { data: MassGISData }) {
  const years = [1960, 1970, 1980, 1990, 2000, 2010, 2020] as const
  const pops = years.map(y => data[`pop${y}` as keyof MassGISData] as number | undefined)
  const valid = pops.filter((p): p is number => p != null && p > 0)
  if (valid.length < 2) return null

  const max = Math.max(...valid)
  const min = Math.min(...valid)
  const range = max - min || 1
  const W = 280
  const H = 64
  const pts = pops
    .map((p, i) => {
      if (p == null || p <= 0) return null
      const x = (i / (years.length - 1)) * W
      const y = H - ((p - min) / range) * (H - 10) - 2
      return `${x},${y}`
    })
    .filter(Boolean)

  if (pts.length < 2) return null

  return (
    <svg width={W} height={H} className="w-full" viewBox={`0 0 ${W} ${H}`}>
      <polyline
        points={pts.join(' ')}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        className="text-sky-400"
      />
      {pops.map((p, i) => {
        if (p == null || p <= 0) return null
        const x = (i / (years.length - 1)) * W
        const y = H - ((p - min) / range) * (H - 10) - 2
        return (
          <circle key={years[i]} cx={x} cy={y} r="3"
            className="text-sky-400 fill-current" />
        )
      })}
      <g className="text-slate-500 fill-current text-[9px]">
        {years.map((yr, i) => (
          <text key={yr} x={(i / (years.length - 1)) * W} y={H}
            textAnchor="middle" fontSize="9" fill="currentColor"
            className="fill-slate-500">{yr}</text>
        ))}
      </g>
    </svg>
  )
}

// ── Helpers ─────────────────────────────────────────────────────────────────
function fmt(n: number | undefined, style: 'currency' | 'number' = 'number', dec = 0) {
  if (n == null) return '—'
  return new Intl.NumberFormat('en-US', {
    style: style === 'currency' ? 'currency' : 'decimal',
    currency: 'USD', maximumFractionDigits: dec,
  }).format(n)
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 py-1.5 border-b border-slate-800 last:border-0">
      <span className="text-slate-400 text-sm shrink-0">{label}</span>
      <span className="text-slate-100 text-sm text-right font-medium">
        {value ?? <span className="text-slate-600">—</span>}
      </span>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-slate-900 rounded-xl p-4 flex flex-col gap-0.5">
      <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">{title}</h3>
      {children}
    </div>
  )
}

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
        active
          ? 'bg-sky-500/20 text-sky-300 border border-sky-500/30'
          : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
      }`}
    >
      {children}
    </button>
  )
}

// ── Main component ───────────────────────────────────────────────────────────
export function TownProfilePanel({ town }: { town: string }) {
  const [tab, setTab] = useState<Tab>('overview')

  const [mma, setMma] = useState<MMAProfile | null>(null)
  const [mmaSource, setMmaSource] = useState<string>('')
  const [massgis, setMassgis] = useState<MassGISData | null>(null)
  const [bills, setBills] = useState<LegislationResponse['bills']>([])
  const [registry, setRegistry] = useState<RegistryResponse | null>(null)
  const [members, setMembers] = useState<MALegMember[]>([])

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null)

  const demo = isDemo(town)

  const load = useCallback(async (refresh = false) => {
    if (demo) return
    setLoading(true)
    setError(null)
    try {
      const [mmaRes, gisRes, legRes, regRes, memRes] = await Promise.allSettled([
        pjApi.registry.mmaProfile(town, refresh),
        pjApi.registry.massgis(town, refresh),
        pjApi.registry.legislation(town, refresh),
        pjApi.registry.town(town),
        pjApi.registry.members(),
      ])
      if (mmaRes.status === 'fulfilled') {
        setMma(mmaRes.value.profile)
        setMmaSource(mmaRes.value.source)
      }
      if (gisRes.status === 'fulfilled') setMassgis(gisRes.value.data)
      if (legRes.status === 'fulfilled') setBills(legRes.value.bills)
      if (regRes.status === 'fulfilled') setRegistry(regRes.value)
      if (memRes.status === 'fulfilled') setMembers(memRes.value.members)
      if (mmaRes.status === 'rejected') setError(String(mmaRes.reason))
    } finally {
      setLoading(false)
      setLastRefresh(new Date())
    }
  }, [town, demo])

  useEffect(() => { void load() }, [load])

  if (demo) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
        <div className="text-4xl">🏛️</div>
        <h2 className="text-lg font-semibold text-slate-300">Town Profile</h2>
        <p className="text-slate-500 text-sm max-w-xs">
          Town data is available for all 351 Massachusetts municipalities.
          Create an environment for a real MA town to explore demographics,
          population trends, local legislation, and more.
        </p>
      </div>
    )
  }

  const govType = massgis?.type === 'C' ? 'City' : massgis?.type === 'T' ? 'Town' : null
  const currentPop = massgis?.pop2020 ?? mma?.population
  const popChange = massgis?.popChange1020

  // Match MMA senator/rep names against cached Legislature members for enriched contact
  const mmaRepNames: string[] = [
    ...(mma?.maSenatorsors ?? []),
    ...(mma?.maRepresentatives ?? []),
  ]
  const enrichedReps = mmaRepNames
    .map(n => members.find(m => m.name.toLowerCase().includes(n.toLowerCase().split(' ').pop() ?? '')))
    .filter((m): m is MALegMember => m != null)
  const enrichedRepsByName = Object.fromEntries(enrichedReps.map(m => [m.name, m]))

  return (
    <div className="flex flex-col gap-4 p-4 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-100">{town}</h2>
          <p className="text-sm text-slate-500">
            {govType ? `${govType} · ` : ''}{mma?.county ?? massgis?.county ?? ''} County
            {currentPop ? ` · Pop. ${fmt(currentPop)}` : ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {mmaSource === 'stale-cache' && (
            <span className="text-xs text-amber-400 bg-amber-400/10 px-2 py-1 rounded">Stale cache</span>
          )}
          {lastRefresh && (
            <span className="text-xs text-slate-600">
              {lastRefresh.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
          <button
            onClick={() => void load(true)}
            disabled={loading}
            className="px-3 py-1.5 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors disabled:opacity-50"
          >
            {loading ? '…' : '↻ Refresh'}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 flex-wrap">
        <TabBtn active={tab === 'overview'} onClick={() => setTab('overview')}>Overview</TabBtn>
        <TabBtn active={tab === 'community'} onClick={() => setTab('community')}>Community</TabBtn>
        <TabBtn active={tab === 'finances'} onClick={() => setTab('finances')}>Finances</TabBtn>
        <TabBtn active={tab === 'legislation'} onClick={() => setTab('legislation')}>
          Legislation {bills.length > 0 ? <span className="ml-1 text-sky-400">({bills.length})</span> : null}
        </TabBtn>
        <TabBtn active={tab === 'representation'} onClick={() => setTab('representation')}>Representation</TabBtn>
        <TabBtn active={tab === 'staff'} onClick={() => setTab('staff')}>
          Staff {registry?.staff?.employees?.length ? `(${registry.staff.employees.length})` : ''}
        </TabBtn>
      </div>

      {error && (
        <div className="bg-red-900/20 border border-red-700/30 rounded-lg px-4 py-3 text-red-300 text-sm">{error}</div>
      )}

      {loading && !mma && (
        <div className="flex justify-center py-16 text-slate-500 text-sm">Loading town data…</div>
      )}

      {/* ── OVERVIEW TAB ─────────────────────────────────────────────────── */}
      {tab === 'overview' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Section title="At a Glance">
            <Row label="Population (2020)" value={fmt(massgis?.pop2020 ?? mma?.population)} />
            <Row label="Pop. change 2010–20" value={
              popChange != null
                ? <span className={popChange >= 0 ? 'text-emerald-400' : 'text-red-400'}>
                    {popChange >= 0 ? '+' : ''}{fmt(popChange)}
                  </span>
                : null
            } />
            <Row label="Area" value={
              massgis?.areaSqMi
                ? `${massgis.areaSqMi.toFixed(1)} sq mi (${Math.round(massgis.areaAcres).toLocaleString()} acres)`
                : mma?.areaSqMi != null ? `${mma.areaSqMi} sq mi` : null
            } />
            <Row label="County" value={mma?.county ?? massgis?.county} />
            <Row label="Government type" value={
              mma?.formOfGovernment
                ? `${mma.formOfGovernment}${govType ? ` (${govType})` : ''}`
                : govType
            } />
            <Row label="Incorporated" value={mma?.incorporationDate} />
            <Row label="Regional planning" value={mma?.regionalPlanningAgency} />
            <Row label="FIPS Code" value={massgis?.fipsStateCo ? String(massgis.fipsStateCo) : null} />
          </Section>

          <Section title="Key Financials">
            <Row label="Residential tax rate" value={mma?.residentialTaxRate != null ? `$${mma.residentialTaxRate}/k` : null} />
            <Row label="Avg. tax bill" value={fmt(mma?.avgTaxBill, 'currency')} />
            <Row label="EQV per capita" value={fmt(mma?.eqvPerCapita, 'currency')} />
            <Row label="Total expenditures" value={fmt(mma?.totalExpenditures, 'currency')} />
            <Row label="Tax levy" value={fmt(mma?.taxLevy, 'currency')} />
            <Row label="State aid" value={fmt(mma?.stateAid, 'currency')} />
            <Row label="Local receipts" value={fmt(mma?.localReceipts, 'currency')} />
          </Section>

          <Section title="Contact">
            <Row label="Chief official" value={mma?.chiefMunicipalOfficial} />
            <Row label="Policy board" value={mma?.policyBoard ? `${mma.policyBoard}${mma.policyBoardSize ? ` (${mma.policyBoardSize} members)` : ''}` : null} />
            <Row label="Legislative body" value={mma?.legislativeBody} />
            <Row label="Phone" value={mma?.phone} />
            <Row label="Website" value={mma?.website
              ? <a href={mma.website} target="_blank" rel="noopener noreferrer"
                  className="text-sky-400 hover:text-sky-300 truncate max-w-[200px] block">
                  {mma.website.replace(/^https?:\/\//, '')}
                </a>
              : null}
            />
          </Section>

          <Section title="Meetings & Elections">
            <Row label="Annual Town Meeting" value={mma?.annualTownMeetingDate ?? mma?.annualTownMeetingDesc} />
            <Row label="Municipal election" value={mma?.municipalElectionDate ?? mma?.municipalElectionDesc} />
            <Row label="Public roads" value={mma?.publicRoadsMi != null ? `${mma.publicRoadsMi} mi` : null} />
          </Section>
        </div>
      )}

      {/* ── COMMUNITY TAB ─────────────────────────────────────────────────── */}
      {tab === 'community' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <Section title="Population Trend (Census 1960–2020)">
              {massgis ? (
                <div className="flex flex-col gap-3">
                  <PopSparkline data={massgis} />
                  <div className="grid grid-cols-4 md:grid-cols-7 gap-2 text-center">
                    {([1960, 1970, 1980, 1990, 2000, 2010, 2020] as const).map(yr => {
                      const p = massgis[`pop${yr}` as keyof MassGISData] as number | undefined
                      return (
                        <div key={yr} className="bg-slate-800 rounded p-2">
                          <div className="text-xs text-slate-500">{yr}</div>
                          <div className="text-sm font-semibold text-slate-200">{p ? p.toLocaleString() : '—'}</div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ) : (
                <p className="text-slate-500 text-sm">Population history unavailable</p>
              )}
            </Section>
          </div>

          <Section title="Demographics">
            <Row label="Population (2020)" value={fmt(massgis?.pop2020 ?? mma?.population)} />
            <Row label="Pop. density" value={mma?.populationDensity != null ? `${fmt(mma.populationDensity)}/sq mi` : null} />
            <Row label="Registered voters" value={fmt(mma?.registeredVoters)} />
            <Row label="Total households" value={fmt(mma?.totalHouseholds)} />
            <Row label="Avg household size" value={mma?.avgHouseholdSize} />
            <Row label="Owner-occupied rate" value={mma?.ownerOccupiedHousingRate} />
            <Row label="Median home value" value={fmt(mma?.medianHomeValue, 'currency')} />
            <Row label="Median gross rent" value={fmt(mma?.medianGrossRent, 'currency')} />
            <Row label="Income per capita" value={fmt(mma?.incomePerCapita, 'currency')} />
          </Section>

          <Section title="Geography">
            <Row label="Area" value={massgis?.areaSqMi != null ? `${massgis.areaSqMi.toFixed(2)} sq mi` : mma?.areaSqMi != null ? `${mma.areaSqMi} sq mi` : null} />
            <Row label="Acreage" value={massgis?.areaAcres != null ? `${Math.round(massgis.areaAcres).toLocaleString()} acres` : null} />
            <Row label="County" value={mma?.county ?? massgis?.county} />
            <Row label="Gov. type" value={govType} />
            <Row label="FIPS" value={massgis?.fipsStateCo ? String(massgis.fipsStateCo) : null} />
            <Row label="Public roads" value={mma?.publicRoadsMi != null ? `${mma.publicRoadsMi} mi` : null} />
            <Row label="Regional planning agency" value={mma?.regionalPlanningAgency} />
          </Section>
        </div>
      )}

      {/* ── FINANCES TAB ────────────────────────────────────────────────── */}
      {tab === 'finances' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Section title="Tax Rates & Burden">
            <Row label="Residential tax rate" value={mma?.residentialTaxRate != null ? `$${mma.residentialTaxRate}/k` : null} />
            <Row label="Commercial tax rate" value={mma?.commercialTaxRate != null ? `$${mma.commercialTaxRate}/k` : null} />
            <Row label="Avg. tax bill" value={fmt(mma?.avgTaxBill, 'currency')} />
            <Row label="EQV per capita" value={fmt(mma?.eqvPerCapita, 'currency')} />
          </Section>

          <Section title="Revenue">
            <Row label="Tax levy" value={fmt(mma?.taxLevy, 'currency')} />
            <Row label="State aid" value={fmt(mma?.stateAid, 'currency')} />
            <Row label="Local receipts" value={fmt(mma?.localReceipts, 'currency')} />
          </Section>

          <Section title="Expenditures">
            <Row label="Total expenditures" value={fmt(mma?.totalExpenditures, 'currency')} />
            {registry?.fiscal?.metrics && Object.entries(registry.fiscal.metrics as Record<string, unknown>)
              .filter(([k]) => !['municipality', 'fiscalYear', 'computedAt', 'totalEmployees'].includes(k) && typeof (registry.fiscal!.metrics as Record<string, unknown>)[k] === 'number')
              .slice(0, 8)
              .map(([k, v]) => (
                <Row key={k}
                  label={k.replace(/([A-Z])/g, ' $1').trim()}
                  value={typeof v === 'number' ? fmt(v, 'currency') : String(v)}
                />
              ))
            }
            {registry?.fiscal && (
              <p className="text-xs text-slate-600 mt-1">
                DLS FY{registry.fiscal.fiscalYear} · Computed {new Date(registry.fiscal.computedAt).toLocaleDateString()}
              </p>
            )}
          </Section>

          <Section title="Community Preservation Act">
            <Row label="CPA enacted" value={mma?.cpaYearEnacted} />
            <Row label="Surcharge" value={mma?.cpaSurcharge} />
            <Row label="Exemptions" value={mma?.cpaExemptions} />
          </Section>
        </div>
      )}

      {/* ── LEGISLATION TAB ────────────────────────────────────────────── */}
      {tab === 'legislation' && (
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-500">
              Local bills filed on behalf of {town} in the 194th General Court (2025–2026)
            </p>
            {bills.length === 0 && !loading && (
              <span className="text-xs text-slate-600 bg-slate-800 px-2 py-1 rounded">No active local bills</span>
            )}
          </div>
          {bills.length > 0 ? (
            <div className="flex flex-col gap-2">
              {bills.map(b => (
                <div key={b.docketNumber}
                  className="bg-slate-900 rounded-xl p-4 flex flex-col gap-1 border border-slate-800">
                  <div className="flex items-center gap-2">
                    {b.billNumber && (
                      <a
                        href={`https://malegislature.gov/Bills/194/${b.billNumber}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs font-mono text-sky-400 hover:text-sky-300 bg-sky-400/10 px-2 py-0.5 rounded"
                      >
                        {b.billNumber}
                      </a>
                    )}
                    {b.branch && (
                      <span className="text-xs text-slate-500 bg-slate-800 px-2 py-0.5 rounded">{b.branch}</span>
                    )}
                    <span className="text-xs text-slate-600">{b.docketNumber}</span>
                  </div>
                  <p className="text-sm text-slate-200 leading-snug">{b.title}</p>
                  {b.primarySponsor && (
                    <p className="text-xs text-slate-500">
                      Sponsor: {b.primarySponsor}
                      {b.cosponsors.length > 0 && ` + ${b.cosponsors.length} cosponsor${b.cosponsors.length > 1 ? 's' : ''}`}
                    </p>
                  )}
                </div>
              ))}
            </div>
          ) : !loading ? (
            <div className="text-center py-12 text-slate-600 text-sm">
              <div className="text-3xl mb-3">📋</div>
              No local legislation found for {town} in the current General Court.
              <br />
              <span className="text-xs text-slate-700 mt-1 block">
                Local bills are typically filed only for larger cities and special districts.
              </span>
            </div>
          ) : null}
        </div>
      )}

      {/* ── REPRESENTATION TAB ─────────────────────────────────────────── */}
      {tab === 'representation' && (
        <div className="flex flex-col gap-4">
          {mma?.usSenators && mma.usSenators.length > 0 && (
            <Section title="U.S. Senators">
              {mma.usSenators.map(n => <Row key={n} label={n} value="U.S. Senate" />)}
            </Section>
          )}
          {mma?.usRepresentative && mma.usRepresentative.length > 0 && (
            <Section title="U.S. Representative">
              {mma.usRepresentative.map(n => <Row key={n} label={n} value="U.S. House" />)}
            </Section>
          )}
          {(mma?.maSenatorsors ?? []).length > 0 && (
            <Section title="MA State Senators">
              {(mma!.maSenatorsors ?? []).map(n => {
                const match = enrichedRepsByName[n] ?? enrichedReps.find(m => m.name.toLowerCase().includes(n.toLowerCase().split(' ').pop() ?? ''))
                return (
                  <div key={n} className="py-2 border-b border-slate-800 last:border-0">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="text-sm text-slate-200 font-medium">{match?.name ?? n}</p>
                        {match?.district && <p className="text-xs text-slate-500">{match.district}</p>}
                      </div>
                      {match?.party && (
                        <span className={`text-xs px-2 py-0.5 rounded-full ${match.party === 'D' ? 'bg-blue-500/20 text-blue-300' : match.party === 'R' ? 'bg-red-500/20 text-red-300' : 'bg-slate-700 text-slate-400'}`}>
                          {match.party === 'D' ? 'Democrat' : match.party === 'R' ? 'Republican' : match.party}
                        </span>
                      )}
                    </div>
                    {match && (
                      <div className="flex gap-3 mt-1">
                        {match.emailAddress && (
                          <a href={`mailto:${match.emailAddress}`}
                            className="text-xs text-sky-400 hover:text-sky-300">✉ {match.emailAddress}</a>
                        )}
                        {match.phoneNumber && (
                          <a href={`tel:${match.phoneNumber}`}
                            className="text-xs text-slate-400 hover:text-slate-300">📞 {match.phoneNumber}</a>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </Section>
          )}
          {(mma?.maRepresentatives ?? []).length > 0 && (
            <Section title="MA State Representatives">
              {(mma!.maRepresentatives ?? []).map(n => {
                const match = enrichedRepsByName[n] ?? enrichedReps.find(m => m.name.toLowerCase().includes(n.toLowerCase().split(' ').pop() ?? ''))
                return (
                  <div key={n} className="py-2 border-b border-slate-800 last:border-0">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="text-sm text-slate-200 font-medium">{match?.name ?? n}</p>
                        {match?.district && <p className="text-xs text-slate-500">{match.district}</p>}
                      </div>
                      {match?.party && (
                        <span className={`text-xs px-2 py-0.5 rounded-full ${match.party === 'D' ? 'bg-blue-500/20 text-blue-300' : match.party === 'R' ? 'bg-red-500/20 text-red-300' : 'bg-slate-700 text-slate-400'}`}>
                          {match.party === 'D' ? 'Democrat' : match.party === 'R' ? 'Republican' : match.party}
                        </span>
                      )}
                    </div>
                    {match && (
                      <div className="flex gap-3 mt-1">
                        {match.emailAddress && (
                          <a href={`mailto:${match.emailAddress}`}
                            className="text-xs text-sky-400 hover:text-sky-300">✉ {match.emailAddress}</a>
                        )}
                        {match.phoneNumber && (
                          <a href={`tel:${match.phoneNumber}`}
                            className="text-xs text-slate-400 hover:text-slate-300">📞 {match.phoneNumber}</a>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </Section>
          )}
          {(mma?.selectBoard ?? []).length > 0 && (
            <Section title="Select Board">
              {mma!.selectBoard!.map((n, i) => (
                <Row key={i} label={n} value={i === 0 && mma!.selectBoardChair === n ? 'Chair' : ''} />
              ))}
            </Section>
          )}
          {(mma?.maSenatorsors ?? []).length === 0 && (mma?.maRepresentatives ?? []).length === 0 && !loading && (
            <div className="text-center py-12 text-slate-600 text-sm">
              <div className="text-3xl mb-3">🏛️</div>
              Representation data not yet available for {town}.
            </div>
          )}
        </div>
      )}

      {/* ── STAFF TAB ────────────────────────────────────────────────────── */}
      {tab === 'staff' && (
        <div className="flex flex-col gap-4">
          {registry?.staff ? (
            <>
              <div className="flex items-center justify-between">
                <p className="text-sm text-slate-500">
                  {registry.staff.employees.length} staff members · scraped {new Date(registry.staff.scrapedAt).toLocaleDateString()}
                </p>
                {registry.staff.notice && (
                  <span className="text-xs text-amber-400 bg-amber-400/10 px-2 py-1 rounded">{registry.staff.notice}</span>
                )}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {registry.staff.employees.map((e, i) => (
                  <div key={e.id ?? i}
                    className="bg-slate-900 rounded-xl p-3 flex flex-col gap-0.5 border border-slate-800">
                    <p className="text-sm font-medium text-slate-200">{e.name}</p>
                    <p className="text-xs text-slate-400">{e.title}</p>
                    {e.department && <p className="text-xs text-slate-600">{e.department}</p>}
                    <div className="flex gap-3 mt-1">
                      {e.email && (
                        <a href={`mailto:${e.email}`} className="text-xs text-sky-400 hover:text-sky-300 truncate">
                          ✉ {e.email}
                        </a>
                      )}
                      {e.phone && (
                        <a href={`tel:${e.phone}`} className="text-xs text-slate-400">📞 {e.phone}</a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : !loading ? (
            <div className="text-center py-12 text-slate-600 text-sm">
              <div className="text-3xl mb-3">👤</div>
              Staff directory not yet available for {town}.
              <br />
              <span className="text-xs text-slate-700 mt-1 block">
                Staff data is scraped from town websites during registry sync.
              </span>
            </div>
          ) : null}
        </div>
      )}
    </div>
  )
}
