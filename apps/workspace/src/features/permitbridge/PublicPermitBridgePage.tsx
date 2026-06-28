import { useCallback, useEffect, useMemo, useState } from 'react'
import { ArrowSquareOut, Buildings, ChartBar, ClockCounterClockwise, SpinnerGap, WarningCircle } from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import { pjApi } from '@/services/pjApi'
import { getEmbeddedPermitBridgeUrl } from './permitBridgeRoutes'
import { getLogicDashUrl, getPermitBridgeProcessContext, getPermitBridgeTownContext } from './permitBridgeContext'

type BriefingState = {
  fiscalYear: number | null
  computedAt: string | null
  metrics: {
    operatingBudget: number | null
    freeCash: number | null
    totalEmployees: number | null
    totalStateAid: number | null
  }
  stats: {
    openRecords: number | null
    overdueRecords: number | null
    dueThisWeek: number | null
    sealedThisMonth: number | null
  }
  deadlines: Array<{ id: string; title: string; daysRemaining: number; dueDate: string }>
  activity: Array<{ id: string; label: string; timestamp: string }>
  contacts: Array<{ id: string; name: string; title: string; email: string; phone?: string; sourceUrl: string }>
  sources: string[]
  profile: {
    website: string | null
    phone: string | null
    government: string | null
    chief: string | null
    board: string | null
    annualTownMeetingDate: string | null
    municipalElectionDate: string | null
    population: number | null
    popChange1020: number | null
    areaSqMi: number | null
    representatives: string[]
  }
  legislation: Array<{ id: string; title: string; billNumber: string | null; docketNumber: string; sponsor: string | null; branch: string | null }>
  legalNotes: string[]
}

const EMPTY_BRIEFING: BriefingState = {
  fiscalYear: null,
  computedAt: null,
  metrics: {
    operatingBudget: null,
    freeCash: null,
    totalEmployees: null,
    totalStateAid: null,
  },
  stats: {
    openRecords: null,
    overdueRecords: null,
    dueThisWeek: null,
    sealedThisMonth: null,
  },
  deadlines: [],
  activity: [],
  contacts: [],
  sources: [],
  profile: {
    website: null,
    phone: null,
    government: null,
    chief: null,
    board: null,
    annualTownMeetingDate: null,
    municipalElectionDate: null,
    population: null,
    popChange1020: null,
    areaSqMi: null,
    representatives: [],
  },
  legislation: [],
  legalNotes: [],
}

function formatMoney(value: number | null | undefined) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '—'
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value)
}

function formatNumber(value: number | null | undefined) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '—'
  return new Intl.NumberFormat('en-US').format(value)
}

function formatPercentDelta(value: number | null | undefined) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null
  const prefix = value > 0 ? '+' : ''
  return `${prefix}${value.toFixed(1)}%`
}

function formatDate(value: string | null | undefined, options?: Intl.DateTimeFormatOptions) {
  if (!value) return null
  return new Date(value).toLocaleDateString('en-US', options ?? { month: 'short', day: 'numeric' })
}

function normalizeUrl(value: string | null | undefined) {
  if (!value) return null
  if (/^https?:\/\//i.test(value)) return value
  return `https://${value}`
}

function formatHostLabel(value: string | null | undefined) {
  const normalized = normalizeUrl(value)
  if (!normalized) return null
  try {
    return new URL(normalized).hostname.replace(/^www\./, '')
  } catch {
    return normalized.replace(/^https?:\/\//i, '').replace(/^www\./, '')
  }
}

function buildLegalNotes(options: {
  townName: string | null
  hasEnvId: boolean
  legislationCount: number
  annualTownMeetingDate: string | null
  municipalElectionDate: string | null
}) {
  const townLabel = options.townName ?? 'This municipality'
  const notes = [
    `${townLabel} permit intake still runs on local charter, zoning/bylaw, board, filing, fee, and posting requirements. Workspace helps route the work; it does not replace the town's legal authority.`,
    'Use this rail as operational guidance. Final sufficiency still depends on notice periods, hearing procedure, quorum, signature, and record-retention rules before anything is issued or enforced.',
    options.legislationCount > 0
      ? 'Beacon Hill items below are informational watch signals. Confirm engrossed text, effective dates, and local adoption requirements before changing forms, fees, or process.'
      : 'State legislative watch stays available here as soon as a town-linked bill feed is present.',
  ]

  if (options.annualTownMeetingDate || options.municipalElectionDate) {
    notes.push(
      `Calendar pressure matters: annual town meeting ${formatDate(options.annualTownMeetingDate) ?? 'not loaded'}; municipal election ${formatDate(options.municipalElectionDate) ?? 'not loaded'}. Keep notice, agenda, and publication lead times in sync.`,
    )
  }

  if (!options.hasEnvId) {
    notes.push('Add an `envId` to this Permit&Bridge route to surface live LogicDash records, deadlines, and audit activity for the exact town workspace.')
  }

  return notes.slice(0, 4)
}

function InfoTile({ label, value, detail }: { label: string; value: string; detail?: string | null }) {
  return (
    <div className="rounded-2xl border border-slate-200/90 bg-white px-3 py-2.5 shadow-sm">
      <div className="text-[11px] font-medium uppercase tracking-[0.12em] text-slate-500">{label}</div>
      <div className="mt-1 text-sm font-semibold text-slate-950">{value}</div>
      {detail ? <div className="mt-1 text-[11px] text-slate-500">{detail}</div> : null}
    </div>
  )
}

function ActionLink({ href, label, detail, tone = 'light' }: { href: string; label: string; detail?: string; tone?: 'light' | 'dark' }) {
  return (
    <a
      href={href}
      target={href.startsWith('http') ? '_blank' : undefined}
      rel={href.startsWith('http') ? 'noreferrer' : undefined}
      className={[
        'rounded-2xl border px-3 py-2.5 text-left transition-colors',
        tone === 'dark'
          ? 'border-slate-950 bg-slate-950 text-white hover:opacity-90'
          : 'border-slate-200 bg-white text-slate-900 hover:border-emerald-300 hover:text-emerald-800',
      ].join(' ')}
    >
      <div className="text-sm font-semibold">{label}</div>
      {detail ? <div className="mt-1 text-[11px] text-inherit/70">{detail}</div> : null}
    </a>
  )
}

export function PublicPermitBridgePage() {
  const embeddedUrl = useMemo(
    () => getEmbeddedPermitBridgeUrl(window.location.pathname, window.location.search, window.location.hash),
    [],
  )
  const publicRouteUrl = useMemo(
    () => `${window.location.pathname}${window.location.search}${window.location.hash}`,
    [],
  )
  const context = useMemo(
    () => getPermitBridgeTownContext(window.location.search),
    [],
  )
  const process = useMemo(
    () => getPermitBridgeProcessContext(window.location.pathname),
    [],
  )
  const [isFrameReady, setIsFrameReady] = useState(false)
  const [showSlowLoad, setShowSlowLoad] = useState(false)
  const [activeTab, setActiveTab] = useState<'overview' | 'about'>('overview')
  const [isBriefingLoading, setIsBriefingLoading] = useState(Boolean(context.townName || context.envId))
  const [briefingError, setBriefingError] = useState<string | null>(null)
  const [briefing, setBriefing] = useState<BriefingState>(EMPTY_BRIEFING)

  useEffect(() => {
    setIsFrameReady(false)
    setShowSlowLoad(false)
  }, [embeddedUrl])

  useEffect(() => {
    if (isFrameReady) return
    const timeoutId = window.setTimeout(() => setShowSlowLoad(true), 3200)
    return () => window.clearTimeout(timeoutId)
  }, [embeddedUrl, isFrameReady])

  const loadBriefing = useCallback(async (withSync = false) => {
    if (!context.townName && !context.envId) {
      setIsBriefingLoading(false)
      return
    }

    setIsBriefingLoading(true)
    setBriefingError(null)

    const [townResult, syncResult, statsResult, deadlinesResult, activityResult, mmaResult, massgisResult, legislationResult] = await Promise.allSettled([
      context.townName ? pjApi.registry.town(context.townName) : Promise.resolve(null),
      withSync && context.townName ? pjApi.fiscal.sync(context.townName) : Promise.resolve(null),
      context.envId ? pjApi.logicdash.stats(context.envId) : Promise.resolve(null),
      context.envId ? pjApi.logicdash.deadlines(context.envId) : Promise.resolve(null),
      context.envId ? pjApi.logicdash.activity(context.envId, 3) : Promise.resolve(null),
      context.townName ? pjApi.registry.mmaProfile(context.townName) : Promise.resolve(null),
      context.townName ? pjApi.registry.massgis(context.townName) : Promise.resolve(null),
      context.townName ? pjApi.registry.legislation(context.townName) : Promise.resolve(null),
    ])

    const nextMetrics = {
      operatingBudget: null as number | null,
      freeCash: null as number | null,
      totalEmployees: null as number | null,
      totalStateAid: null as number | null,
    }
    let nextFiscalYear: number | null = null
    let nextComputedAt: string | null = null

    if (townResult.status === 'fulfilled' && townResult.value?.fiscal) {
      const metrics = townResult.value.fiscal.metrics
      nextMetrics.operatingBudget = typeof metrics.operatingBudget === 'number' ? metrics.operatingBudget : null
      nextMetrics.freeCash = typeof metrics.freeCash === 'number' ? metrics.freeCash : null
      nextMetrics.totalEmployees = typeof metrics.totalEmployees === 'number' ? metrics.totalEmployees : null
      nextMetrics.totalStateAid = typeof metrics.totalStateAid === 'number' ? metrics.totalStateAid : null
      nextFiscalYear = townResult.value.fiscal.fiscalYear
      nextComputedAt = townResult.value.fiscal.computedAt
    }

    if (syncResult.status === 'fulfilled' && syncResult.value) {
      const metrics = syncResult.value.metrics
      nextMetrics.operatingBudget = typeof metrics.operatingBudget === 'number' ? metrics.operatingBudget : nextMetrics.operatingBudget
      nextMetrics.freeCash = typeof metrics.certifiedFreeCash === 'number' ? metrics.certifiedFreeCash : nextMetrics.freeCash
      nextMetrics.totalEmployees = typeof metrics.totalEmployees === 'number' ? metrics.totalEmployees : nextMetrics.totalEmployees
      nextMetrics.totalStateAid = typeof metrics.totalStateAid === 'number' ? metrics.totalStateAid : nextMetrics.totalStateAid
      nextFiscalYear = syncResult.value.fiscalYear
      nextComputedAt = syncResult.value.computedAt
    }

    const nextStats = {
      openRecords: null as number | null,
      overdueRecords: null as number | null,
      dueThisWeek: null as number | null,
      sealedThisMonth: null as number | null,
    }

    if (statsResult.status === 'fulfilled' && statsResult.value) {
      nextStats.openRecords = typeof statsResult.value.openRecords === 'number' ? statsResult.value.openRecords : null
      nextStats.overdueRecords = typeof statsResult.value.overdueRecords === 'number' ? statsResult.value.overdueRecords : null
      nextStats.dueThisWeek = typeof statsResult.value.dueThisWeek === 'number' ? statsResult.value.dueThisWeek : null
      nextStats.sealedThisMonth = typeof statsResult.value.sealedThisMonth === 'number' ? statsResult.value.sealedThisMonth : null
    }

    const nextDeadlines = deadlinesResult.status === 'fulfilled' && deadlinesResult.value?.items
      ? deadlinesResult.value.items.slice().sort((a, b) => a.daysRemaining - b.daysRemaining).slice(0, 3).map(item => ({
          id: item.id,
          title: item.title,
          daysRemaining: item.daysRemaining,
          dueDate: item.dueDate,
        }))
      : []

    const nextActivity = activityResult.status === 'fulfilled' && activityResult.value?.events
      ? activityResult.value.events.slice(0, 3).map(event => ({
          id: event.eventId,
          label: [event.module, event.eventType].filter(Boolean).join(' · '),
          timestamp: event.timestamp,
        }))
      : []

    const nextContacts = townResult.status === 'fulfilled' && townResult.value?.staff?.employees
      ? townResult.value.staff.employees.slice(0, 3)
      : []

    const nextSources = townResult.status === 'fulfilled' && townResult.value?.staff?.sourcePages
      ? townResult.value.staff.sourcePages.slice(0, 2)
      : []

    const profile = mmaResult.status === 'fulfilled' && mmaResult.value?.profile ? mmaResult.value.profile : null
    const geography = massgisResult.status === 'fulfilled' && massgisResult.value?.data ? massgisResult.value.data : null
    const fallbackPopulation = townResult.status === 'fulfilled'
      ? (townResult.value?.population ?? context.municipality?.population ?? null)
      : (context.municipality?.population ?? null)
    const nextProfile = {
      website: normalizeUrl(profile?.website ?? null),
      phone: profile?.phone ?? null,
      government: [profile?.formOfGovernment, profile?.legislativeBody].filter(Boolean).join(' · ') || null,
      chief: profile?.chiefMunicipalOfficial ?? null,
      board: profile?.selectBoardChair ?? profile?.policyBoard ?? null,
      annualTownMeetingDate: profile?.annualTownMeetingDate ?? null,
      municipalElectionDate: profile?.municipalElectionDate ?? null,
      population: geography?.pop2020 ?? fallbackPopulation,
      popChange1020: geography?.popChange1020 ?? null,
      areaSqMi: geography?.areaSqMi ?? null,
      representatives: [
        ...(profile?.maSenatorsors ?? []),
        ...(profile?.maRepresentatives ?? []),
        ...(profile?.usRepresentative ?? []),
      ].filter(Boolean),
    }

    const nextLegislation = legislationResult.status === 'fulfilled' && legislationResult.value?.bills
      ? legislationResult.value.bills.slice(0, 8).map(bill => ({
          id: `${bill.docketNumber}-${bill.billNumber ?? 'bill'}`,
          title: bill.title,
          billNumber: bill.billNumber,
          docketNumber: bill.docketNumber,
          sponsor: bill.primarySponsor,
          branch: bill.branch,
        }))
      : []

    const nextLegalNotes = buildLegalNotes({
      townName: context.townName,
      hasEnvId: Boolean(context.envId),
      legislationCount: nextLegislation.length,
      annualTownMeetingDate: nextProfile.annualTownMeetingDate,
      municipalElectionDate: nextProfile.municipalElectionDate,
    })

    const errors = [townResult, syncResult, statsResult, deadlinesResult, activityResult, mmaResult, massgisResult, legislationResult]
      .filter((result): result is PromiseRejectedResult => result.status === 'rejected')
      .map(result => result.reason instanceof Error ? result.reason.message : 'Live Permit&Bridge briefing unavailable')

    setBriefing({
      fiscalYear: nextFiscalYear,
      computedAt: nextComputedAt,
      metrics: nextMetrics,
      stats: nextStats,
      deadlines: nextDeadlines,
      activity: nextActivity,
      contacts: nextContacts,
      sources: nextSources,
      profile: nextProfile,
      legislation: nextLegislation,
      legalNotes: nextLegalNotes,
    })
    setBriefingError(errors[0] ?? null)
    setIsBriefingLoading(false)
  }, [context.envId, context.municipality?.population, context.townName])

  useEffect(() => {
    void loadBriefing(false)
  }, [loadBriefing])

  const townCode = context.municipality?.dor_code ?? null
  const dashboardUrl = getLogicDashUrl({ townCode })
  const governanceUrl = getLogicDashUrl({ townCode, domain: 'governance' })
  const riskUrl = getLogicDashUrl({ townCode, tab: 'risk' })
  const sourceTrailUrl = getLogicDashUrl({ townCode, tab: 'sync', autoSync: true })
  const representativeSummary = briefing.profile.representatives.slice(0, 3).join(' · ')
  const legislationTickerItems = briefing.legislation.length > 0 ? [...briefing.legislation, ...briefing.legislation] : []
  const primaryContact = briefing.contacts[0] ?? null
  const websiteHost = formatHostLabel(briefing.profile.website)

  return (
    <main className="min-h-[100dvh] overflow-y-auto bg-[radial-gradient(circle_at_top,rgba(4,120,87,0.16),transparent_28%),linear-gradient(180deg,#f6faf7_0%,#edf5ef_50%,#e7efe9_100%)] text-slate-950 lg:h-[100dvh] lg:overflow-hidden">
      <div className="flex min-h-[100dvh] flex-col lg:h-[100dvh] lg:flex-row">
        <aside className="relative z-20 w-full shrink-0 p-3 sm:p-4 lg:w-[25rem] lg:pr-0 xl:w-[27rem]">
          <section className="w-full rounded-[28px] border border-white/75 bg-white/90 p-4 shadow-[0_20px_60px_rgba(15,23,42,0.14)] backdrop-blur lg:max-h-[calc(100dvh-2rem)] lg:overflow-y-auto">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="inline-flex items-center gap-2 rounded-full bg-emerald-500/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-800">
                <ChartBar size={12} weight="bold" />
                Permit&amp;Bridge concierge
              </div>
              <h1 className="mt-2 text-lg font-black tracking-tight text-slate-950">
                {context.municipality ? `${context.municipality.name} ${process.title}` : process.title}
              </h1>
              <p className="mt-1 text-sm leading-5 text-slate-600">
                {context.municipality
                  ? `${context.municipality.county} County · DOR ${context.municipality.dor_code}. ${process.summary} One click should put people at the exact front door.`
                  : `${process.summary} One click should put people at the exact front door.`}
              </p>
            </div>
            {context.municipality && (
              <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-2.5 py-2 text-right text-[11px] font-semibold text-emerald-800">
                <div>DOR {context.municipality.dor_code}</div>
                <div>{context.municipality.county}</div>
              </div>
            )}
          </div>

          <div className="mt-4 flex items-center gap-2 rounded-2xl border border-slate-200/90 bg-slate-50/85 p-1">
            <button
              type="button"
              onClick={() => setActiveTab('overview')}
              className={activeTab === 'overview'
                ? 'flex-1 rounded-xl bg-white px-3 py-2 text-sm font-semibold text-slate-950 shadow-sm'
                : 'flex-1 rounded-xl px-3 py-2 text-sm font-medium text-slate-600 hover:text-slate-950'}
            >
              Overview
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('about')}
              className={activeTab === 'about'
                ? 'flex-1 rounded-xl bg-white px-3 py-2 text-sm font-semibold text-slate-950 shadow-sm'
                : 'flex-1 rounded-xl px-3 py-2 text-sm font-medium text-slate-600 hover:text-slate-950'}
            >
              About
            </button>
          </div>

          {activeTab === 'overview' ? (
            <>
              <div className="mt-4 grid grid-cols-2 gap-2">
                <ActionLink href={publicRouteUrl} label="Town front door" detail={`${process.title} inside Workspace`} tone="dark" />
                <ActionLink href={embeddedUrl} label="Open exact process" detail={`${process.title} in standalone Permit&Bridge`} />
                {briefing.profile.website ? (
                  <ActionLink href={briefing.profile.website} label="Town website" detail="Official municipal site" />
                ) : null}
                {primaryContact ? (
                  <ActionLink href={`mailto:${primaryContact.email}`} label="Contact permit desk" detail={`${primaryContact.name} · ${primaryContact.title}`} />
                ) : briefing.sources[0] ? (
                  <ActionLink href={briefing.sources[0]} label="Contact source" detail="Public staff/contact listing" />
                ) : null}
              </div>

              <section className="mt-4 rounded-[24px] border border-slate-200/90 bg-slate-50/85 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-slate-900">One track from first click to final record</div>
                    <div className="mt-1 text-xs leading-5 text-slate-500">
                      Search, start, submit, review, and record all stay tied to the same town, same permit, and same source trail.
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-auto shrink-0 rounded-2xl px-3 py-2 text-sm font-semibold"
                    onClick={() => { void loadBriefing(true) }}
                    disabled={!context.townName || isBriefingLoading}
                  >
                    <ClockCounterClockwise size={14} weight="bold" />
                    {isBriefingLoading ? 'Refreshing…' : 'Refresh'}
                  </Button>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <InfoTile
                    label="Permit desk"
                    value={primaryContact?.name ?? 'Loading'}
                    detail={primaryContact ? `${primaryContact.title}${primaryContact.phone ? ` · ${primaryContact.phone}` : ''}` : 'Town contact when available'}
                  />
                  <InfoTile
                    label="Town site"
                    value={websiteHost ?? 'Loading'}
                    detail={briefing.profile.website ? 'Official municipal website' : 'Pulled from town registry'}
                  />
                  <InfoTile
                    label="Due this week"
                    value={formatNumber(briefing.stats.dueThisWeek)}
                    detail={briefing.deadlines[0] ? `${briefing.deadlines[0].title} · ${briefing.deadlines[0].daysRemaining}d` : 'LogicDash deadlines'}
                  />
                  <InfoTile
                    label="Open records"
                    value={formatNumber(briefing.stats.openRecords)}
                    detail={briefing.stats.overdueRecords !== null ? `${formatNumber(briefing.stats.overdueRecords)} overdue` : 'Town-wide pressure'}
                  />
                </div>
                {briefingError ? (
                  <div className="mt-3 flex items-start gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                    <WarningCircle size={14} className="mt-0.5 shrink-0" weight="fill" />
                    <span>{briefingError}</span>
                  </div>
                ) : null}

                {legislationTickerItems.length > 0 ? (
                  <div className="mt-3 rounded-2xl border border-white/70 bg-white px-3 py-2 shadow-sm">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Beacon Hill watch</div>
                    <div className="permitbridge-ticker-mask mt-1" aria-label="State legislative watch">
                      <div className="permitbridge-ticker-track">
                        {legislationTickerItems.map((item, index) => (
                          <div key={`${item.id}-${index}`} className="mx-3 shrink-0 text-xs text-slate-600">
                            <span className="font-semibold text-slate-900">{item.billNumber ?? item.docketNumber}</span>
                            {' · '}
                            {item.title}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : null}
              </section>

              <details className="mt-4 rounded-[24px] border border-slate-200/90 bg-slate-50/85 p-3">
                <summary className="cursor-pointer list-none text-sm font-semibold text-slate-900">
                  <div className="flex items-center justify-between gap-3">
                    <span>Town context</span>
                    <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-slate-500">
                      {briefing.fiscalYear && briefing.computedAt
                        ? `FY${briefing.fiscalYear}`
                        : 'On demand'}
                    </span>
                  </div>
                </summary>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <InfoTile label="Operating budget" value={formatMoney(briefing.metrics.operatingBudget)} />
                  <InfoTile label="Free cash" value={formatMoney(briefing.metrics.freeCash)} />
                  <InfoTile label="Team size" value={formatNumber(briefing.metrics.totalEmployees)} />
                  <InfoTile label="State aid" value={formatMoney(briefing.metrics.totalStateAid)} />
                  <InfoTile
                    label="Municipal profile"
                    value={briefing.profile.government ?? 'Profile loading'}
                    detail={[briefing.profile.chief, briefing.profile.board, briefing.profile.phone].filter(Boolean).join(' · ') || null}
                  />
                  <InfoTile
                    label="Town calendar"
                    value={formatDate(briefing.profile.annualTownMeetingDate) ?? 'Meeting date not loaded'}
                    detail={briefing.profile.municipalElectionDate ? `Election ${formatDate(briefing.profile.municipalElectionDate)}` : 'Election date not loaded'}
                  />
                  <InfoTile
                    label="Population"
                    value={formatNumber(briefing.profile.population)}
                    detail={[
                      briefing.profile.popChange1020 !== null ? `2020 change ${formatPercentDelta(briefing.profile.popChange1020)}` : null,
                      briefing.profile.areaSqMi !== null ? `${briefing.profile.areaSqMi.toFixed(1)} sq mi` : null,
                    ].filter(Boolean).join(' · ') || null}
                  />
                  <InfoTile
                    label="Legislative map"
                    value={representativeSummary || 'Representation loading'}
                    detail="State and federal representation in one place"
                  />
                </div>

                <div className="mt-3 grid gap-3">
                  <div className="rounded-2xl border border-white/70 bg-white px-3 py-3 shadow-sm">
                    <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                      <Buildings size={12} weight="bold" />
                      Operational load
                    </div>
                    <div className="mt-2 grid gap-2 sm:grid-cols-2">
                      <div className="rounded-2xl bg-slate-50 px-3 py-2 text-xs text-slate-700">
                        <div className="font-semibold text-slate-900">Upcoming deadlines</div>
                        {briefing.deadlines.length > 0 ? (
                          <ul className="mt-1.5 space-y-1.5">
                            {briefing.deadlines.map(item => (
                              <li key={item.id}>
                                <div>{item.title}</div>
                                <div className="text-slate-500">
                                  {item.daysRemaining < 0 ? `${Math.abs(item.daysRemaining)}d overdue` : `${item.daysRemaining}d left`}
                                  {formatDate(item.dueDate) ? ` · due ${formatDate(item.dueDate)}` : ''}
                                </div>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <div className="mt-1.5 text-slate-500">Add an `envId` to surface live deadline pressure from LogicDash.</div>
                        )}
                      </div>
                      <div className="rounded-2xl bg-slate-50 px-3 py-2 text-xs text-slate-700">
                        <div className="font-semibold text-slate-900">Recent activity</div>
                        {briefing.activity.length > 0 ? (
                          <ul className="mt-1.5 space-y-1.5">
                            {briefing.activity.map(item => (
                              <li key={item.id}>
                                <div>{item.label}</div>
                                <div className="text-slate-500">{formatDate(item.timestamp) ?? 'Just now'}</div>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <div className="mt-1.5 text-slate-500">Recent LogicDash activity appears here when this route is tied to the town workspace.</div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-white/70 bg-white px-3 py-3 shadow-sm">
                    <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                      <Buildings size={12} weight="bold" />
                      Town contacts
                    </div>
                    {briefing.contacts.length > 0 ? (
                      <ul className="mt-2 space-y-2">
                        {briefing.contacts.map(contact => (
                          <li key={contact.id} className="rounded-2xl bg-slate-50 px-3 py-2 text-xs text-slate-700">
                            <div className="font-semibold text-slate-900">{contact.name}</div>
                            <div className="mt-1">{contact.title}</div>
                            <div className="mt-1 break-all text-slate-500">{contact.email}</div>
                            {contact.phone ? <div className="text-slate-500">{contact.phone}</div> : null}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <div className="mt-2 text-xs text-slate-500">Town contacts load from the registry and public staff sources when available.</div>
                    )}
                  </div>
                </div>
              </details>

              <details className="mt-4 rounded-[24px] border border-slate-200/90 bg-slate-50/85 p-3">
                <summary className="cursor-pointer list-none text-sm font-semibold text-slate-900">Staff tools</summary>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <ActionLink href={dashboardUrl} label="Open dashboard" detail="Town-specific LogicDash view" />
                  <ActionLink href={governanceUrl} label="Governance view" detail="Boards, packets, and legal context" />
                  <ActionLink href={riskUrl} label="Risk flags" detail="Permit pressure, reserves, and alerts" />
                  <ActionLink href={sourceTrailUrl} label="Source trail" detail="Audit, sync, and evidence trail" />
                </div>
              </details>

              <details className="mt-4 rounded-[24px] border border-slate-200/90 bg-slate-50/85 p-3">
                <summary className="cursor-pointer list-none text-sm font-semibold text-slate-900">Municipal notes</summary>
                <ul className="mt-3 space-y-2">
                  {briefing.legalNotes.map(note => (
                    <li key={note} className="rounded-2xl border border-white/70 bg-white px-3 py-2 text-xs leading-5 text-slate-700 shadow-sm">
                      {note}
                    </li>
                  ))}
                </ul>
              </details>
            </>
          ) : (
            <section className="mt-4 rounded-[24px] border border-slate-200/90 bg-slate-50/85 p-3">
              <div className="text-sm font-semibold text-slate-900">About this experience</div>
              <div className="mt-2 space-y-3 text-xs leading-6 text-slate-700">
                <p>
                  This page stays intentionally light. People get the exact front door first, while the town keeps the context nearby instead of opening three other systems just to answer the next question.
                </p>
                <p>
                  <strong>Permit&amp;Bridge</strong> handles the live permit work. <strong>PuddleJumper</strong> pulls the town context. <strong>LogicDash</strong> keeps records,
                  deadlines, and source trail attached when the case needs follow-through.
                </p>
                <p>
                  Routine filings stay clean and direct for the public. Higher-touch cases keep the municipal operating layer attached so staff can move faster, stay consistent,
                  and spend time where judgment actually matters.
                </p>
              </div>
              </section>
          )}
          </section>
        </aside>

        <div className="flex-1 px-3 pb-3 sm:px-4 sm:pb-4 lg:p-4 lg:pl-3">
          <div className="relative h-[68dvh] min-h-[32rem] overflow-hidden rounded-[28px] border border-white/75 bg-white shadow-[0_20px_60px_rgba(15,23,42,0.12)] lg:h-full lg:min-h-0">
            {!isFrameReady && (
              <div className="absolute inset-0 z-10 flex items-center justify-center bg-[linear-gradient(180deg,rgba(247,251,247,0.95)_0%,rgba(238,244,239,0.96)_100%)] px-6 text-center">
                <div className="max-w-xl rounded-[28px] border border-white/80 bg-white/90 p-6 shadow-[0_20px_60px_rgba(15,23,42,0.10)]">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-700">
                    <SpinnerGap size={24} className="animate-spin" weight="bold" />
                  </div>
                  <div className="mt-4 text-xl font-black tracking-tight text-slate-950">Launching Permit&amp;Bridge</div>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    Opening the live permit workspace now. The wrapper stays minimal so the embedded product can own the page hierarchy.
                  </p>
                  {showSlowLoad ? (
                    <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                      Taking longer than usual. You can keep waiting here or open the standalone route directly.
                    </div>
                  ) : null}
                  <div className="mt-5 flex flex-wrap justify-center gap-3">
                    <a
                      href={embeddedUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-2 rounded-2xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
                    >
                      Open standalone route
                      <ArrowSquareOut size={15} weight="bold" />
                    </a>
                    <a
                      href="/"
                      className="inline-flex items-center gap-2 rounded-2xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:border-emerald-300 hover:text-emerald-800"
                    >
                      Return to Workspace
                    </a>
                  </div>
                </div>
              </div>
            )}

            <iframe
              title="Permit&Bridge"
              src={embeddedUrl}
              className="h-full w-full border-0 bg-white"
              loading="eager"
              referrerPolicy="strict-origin-when-cross-origin"
              allow="clipboard-read; clipboard-write"
              sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-downloads"
              onLoad={() => setIsFrameReady(true)}
            />
          </div>
        </div>
      </div>
    </main>
  )
}
