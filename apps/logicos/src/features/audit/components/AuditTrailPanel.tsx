import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import {
  ShieldCheck, ShieldWarning, ArrowClockwise, DownloadSimple,
  WarningCircle, XCircle, Info, MagnifyingGlass,
  ArrowLeft, ArrowRight, LinkBreak, Seal
} from '@phosphor-icons/react'
import { pjApi, type ArchieveEvent, type ArchieveChainSummary, type ArchieveVerifyResult } from '@/services/pjApi'

const MODULES = ['vault', 'axis', 'synchron8', 'logicbridge', 'syncronate', 'formkey', 'system']
const SEVERITIES = ['info', 'warn', 'error', 'critical']
const PAGE_SIZE = 50

function severityBadge(s: string) {
  const map: Record<string, { color: string; icon: React.ReactNode }> = {
    info:     { color: 'bg-blue-500/10 text-blue-400 border-blue-500/20',    icon: <Info size={10} /> },
    warn:     { color: 'bg-amber-500/10 text-amber-400 border-amber-500/20', icon: <WarningCircle size={10} /> },
    error:    { color: 'bg-red-500/10 text-red-400 border-red-500/20',       icon: <XCircle size={10} /> },
    critical: { color: 'bg-red-700/20 text-red-300 border-red-600/30',       icon: <XCircle size={10} weight="fill" /> },
  }
  const { color, icon } = map[s] ?? map.info
  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[10px] font-mono uppercase ${color}`}>
      {icon}{s}
    </span>
  )
}

function chainStatusBadge(summary: ArchieveChainSummary | null, verifyResult: ArchieveVerifyResult | null) {
  if (!summary) return null
  const isViolation = summary.status === 'chain_violation' || verifyResult?.result === 'CHAIN_VIOLATION'
  return (
    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-medium ${
      isViolation
        ? 'bg-red-500/10 border-red-500/30 text-red-400'
        : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
    }`}>
      {isViolation
        ? <><LinkBreak size={13} weight="bold" /> CHAIN VIOLATION — {verifyResult?.reason ?? 'See details'}</>
        : <><ShieldCheck size={13} weight="bold" /> Chain valid · {(summary.totalEvents ?? 0).toLocaleString()} events</>
      }
      {summary.lastNotarizedAt && (
        <span className="text-muted-foreground ml-1">· Notarized {new Date(summary.lastNotarizedAt).toLocaleDateString()}</span>
      )}
    </div>
  )
}

export function AuditTrailPanel() {
  const [events, setEvents] = useState<ArchieveEvent[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [verifying, setVerifying] = useState(false)
  const [chainSummary, setChainSummary] = useState<ArchieveChainSummary | null>(null)
  const [verifyResult, setVerifyResult] = useState<ArchieveVerifyResult | null>(null)
  const [selected, setSelected] = useState<ArchieveEvent | null>(null)

  // Filters
  const [filterModule, setFilterModule] = useState('')
  const [filterSeverity, setFilterSeverity] = useState('')
  const [filterEventType, setFilterEventType] = useState('')
  const [filterActor, setFilterActor] = useState('')
  const [filterRecordId, setFilterRecordId] = useState('')
  const [filterAfter, setFilterAfter] = useState('')
  const [filterBefore, setFilterBefore] = useState('')

  const loadChain = useCallback(() => {
    pjApi.archieve.chain()
      .then(setChainSummary)
      .catch(() => { /* archieve unavailable — chain summary is non-critical */ })
  }, [])

  const loadEvents = useCallback((p = page) => {
    setLoading(true)
    const filters: Record<string, string | number> = { page: p, limit: PAGE_SIZE }
    if (filterModule)    filters.module    = filterModule
    if (filterSeverity)  filters.severity  = filterSeverity
    if (filterEventType) filters.eventType = filterEventType
    if (filterActor)     filters.actor     = filterActor
    if (filterRecordId)  filters.recordId  = filterRecordId
    if (filterAfter)     filters.after     = filterAfter
    if (filterBefore)    filters.before    = filterBefore

    pjApi.archieve.events(filters)
      .then(res => {
        setEvents(res.events ?? [])
        setTotal(res.total ?? 0)
      })
      .catch(() => toast.error('Could not load ARCHIEVE events'))
      .finally(() => setLoading(false))
  }, [page, filterModule, filterSeverity, filterEventType, filterActor, filterRecordId, filterAfter, filterBefore])

  useEffect(() => { loadChain(); loadEvents(1) }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleSearch = () => { setPage(1); loadEvents(1) }

  const handleVerify = async () => {
    setVerifying(true)
    try {
      const res = await pjApi.archieve.verify()
      setVerifyResult(res)
      if (res.result === 'CHAIN_VALID') toast.success(`Chain valid — ${res.eventsVerified} events verified`)
      else toast.error(`Chain violation at position ${res.chainPos}`)
      loadChain()
    } catch {
      toast.error('Verification failed — is PuddleJumper reachable?')
    } finally {
      setVerifying(false)
    }
  }

  const handleExport = () => {
    const after = filterAfter || new Date(Date.now() - 30 * 86400_000).toISOString().split('T')[0]
    const before = filterBefore || new Date().toISOString().split('T')[0]
    window.open(pjApi.archieve.exportUrl(after, before), '_blank')
  }

  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <div className="flex flex-col h-full bg-background text-foreground overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b shrink-0">
        <div className="flex items-center gap-2">
          <ShieldCheck size={18} weight="duotone" className="text-primary" />
          <span className="font-semibold text-sm">ARCHIEVE — Audit Trail</span>
          {chainStatusBadge(chainSummary, verifyResult)}
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => { loadChain(); loadEvents() }} disabled={loading}>
            <ArrowClockwise size={13} className={loading ? 'animate-spin' : ''} />
          </Button>
          <Button size="sm" variant="outline" onClick={handleVerify} disabled={verifying}>
            {verifying ? <ArrowClockwise size={13} className="animate-spin" /> : <Seal size={13} />}
            {verifying ? 'Verifying…' : 'Verify Chain'}
          </Button>
          <Button size="sm" variant="outline" onClick={handleExport}>
            <DownloadSimple size={13} /> Export
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2 px-4 py-2 border-b bg-muted/30 shrink-0">
        <Select value={filterModule || '_all'} onValueChange={v => setFilterModule(v === '_all' ? '' : v)}>
          <SelectTrigger className="h-7 text-xs w-32"><SelectValue placeholder="Module" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="_all">All modules</SelectItem>
            {MODULES.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterSeverity || '_all'} onValueChange={v => setFilterSeverity(v === '_all' ? '' : v)}>
          <SelectTrigger className="h-7 text-xs w-28"><SelectValue placeholder="Severity" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="_all">All severity</SelectItem>
            {SEVERITIES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
        <Input
          className="h-7 text-xs w-44" placeholder="Event type…"
          value={filterEventType} onChange={e => setFilterEventType(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSearch()}
        />
        <Input
          className="h-7 text-xs w-36" placeholder="Actor / user ID…"
          value={filterActor} onChange={e => setFilterActor(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSearch()}
        />
        <Input
          className="h-7 text-xs w-36" placeholder="Record ID…"
          value={filterRecordId} onChange={e => setFilterRecordId(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSearch()}
        />
        <Input type="date" className="h-7 text-xs w-36" value={filterAfter} onChange={e => setFilterAfter(e.target.value)} />
        <span className="text-xs text-muted-foreground">→</span>
        <Input type="date" className="h-7 text-xs w-36" value={filterBefore} onChange={e => setFilterBefore(e.target.value)} />
        <Button size="sm" className="h-7 text-xs" onClick={handleSearch}>
          <MagnifyingGlass size={12} /> Search
        </Button>
        <span className="text-xs text-muted-foreground ml-auto">{total.toLocaleString()} events</span>
      </div>

      <div className="flex flex-1 min-h-0">
        {/* Event table */}
        <div className="flex-1 min-h-0 overflow-auto">
          {events.length === 0 && !loading && (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-2">
              <ShieldWarning size={32} weight="duotone" />
              <p className="text-sm">No events found</p>
              <p className="text-xs">Adjust filters or click Search</p>
            </div>
          )}
          {events.length > 0 && (
            <table className="w-full text-xs border-collapse">
              <thead className="sticky top-0 bg-muted/80 backdrop-blur-sm z-10">
                <tr>
                  <th className="text-left px-3 py-2 font-medium text-muted-foreground w-40">Timestamp</th>
                  <th className="text-left px-3 py-2 font-medium text-muted-foreground w-20">Severity</th>
                  <th className="text-left px-3 py-2 font-medium text-muted-foreground w-24">Module</th>
                  <th className="text-left px-3 py-2 font-medium text-muted-foreground">Event Type</th>
                  <th className="text-left px-3 py-2 font-medium text-muted-foreground w-32">Actor</th>
                  <th className="text-left px-3 py-2 font-medium text-muted-foreground w-16 text-right">Pos</th>
                </tr>
              </thead>
              <tbody>
                {events.map(ev => (
                  <tr
                    key={ev.eventId}
                    onClick={() => setSelected(selected?.eventId === ev.eventId ? null : ev)}
                    className={`border-b border-border/40 cursor-pointer transition-colors ${
                      selected?.eventId === ev.eventId ? 'bg-primary/10' : 'hover:bg-muted/40'
                    }`}
                  >
                    <td className="px-3 py-1.5 font-mono text-muted-foreground whitespace-nowrap">
                      {ev.timestamp ? new Date(ev.timestamp).toLocaleString() : '—'}
                    </td>
                    <td className="px-3 py-1.5">{severityBadge(ev.severity)}</td>
                    <td className="px-3 py-1.5 text-muted-foreground font-mono">{ev.module}</td>
                    <td className="px-3 py-1.5 font-mono">{ev.eventType}</td>
                    <td className="px-3 py-1.5 text-muted-foreground truncate max-w-[128px]">{ev.actor?.userId}</td>
                    <td className="px-3 py-1.5 text-right text-muted-foreground font-mono">{ev.chainPos}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Event detail drawer */}
        {selected && (
          <div className="fixed md:relative inset-0 md:inset-auto md:w-80 z-30 md:z-auto md:border-l overflow-auto shrink-0 bg-card">
            <div className="sticky top-0 bg-card border-b px-3 py-2 flex items-center justify-between">
              <span className="text-xs font-semibold">Event Detail</span>
              <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => setSelected(null)}>×</Button>
            </div>
            <div className="p-3 space-y-3">
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">Event ID</p>
                <p className="font-mono text-[11px] break-all">{selected.eventId}</p>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">Type</p>
                <p className="font-mono text-xs">{selected.eventType}</p>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">Actor</p>
                <p className="text-xs">{selected.actor?.userId} <span className="text-muted-foreground">({selected.actor?.role})</span></p>
                {selected.actor?.ip && <p className="text-[11px] text-muted-foreground font-mono">{selected.actor.ip}</p>}
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">Chain</p>
                <p className="text-[11px] font-mono text-muted-foreground">pos: {selected.chainPos}</p>
                <p className="text-[10px] font-mono text-muted-foreground break-all mt-0.5">hash: {selected.hash?.slice(0, 16)}…</p>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">Data</p>
                <pre className="text-[10px] font-mono bg-muted/50 p-2 rounded overflow-auto max-h-64 whitespace-pre-wrap break-all">
                  {JSON.stringify(selected.data, null, 2)}
                </pre>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between px-4 py-2 border-t shrink-0 text-xs text-muted-foreground">
        <span>Page {page} of {pages}</span>
        <div className="flex gap-1">
          <Button size="sm" variant="outline" className="h-6 px-2" disabled={page <= 1}
            onClick={() => { const p = page - 1; setPage(p); loadEvents(p) }}>
            <ArrowLeft size={11} />
          </Button>
          <Button size="sm" variant="outline" className="h-6 px-2" disabled={page >= pages}
            onClick={() => { const p = page + 1; setPage(p); loadEvents(p) }}>
            <ArrowRight size={11} />
          </Button>
        </div>
      </div>
    </div>
  )
}
