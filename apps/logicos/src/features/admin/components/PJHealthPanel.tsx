import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { pjApi, PJHealthResponse, type HealthMetrics } from '@/services/pjApi'
import { pjBase } from '@/services/pjBase'
import {
  CheckCircle, XCircle, Warning, ArrowClockwise, Lightning,
  Database, Shield, Key, Robot, Link, FileMagnifyingGlass,
  CloudArrowUp, Globe, Clock, HardDrive, ChartLine,
} from '@phosphor-icons/react'

const SUBSYSTEM_META: Record<string, { label: string; icon: React.ElementType; description: string }> = {
  vault:            { label: 'VAULT',            icon: Database,          description: 'Governed record storage' },
  archieve:         { label: 'ARCHIEVE',         icon: FileMagnifyingGlass, description: 'Immutable audit log' },
  seal:             { label: 'SEAL',             icon: Shield,            description: 'Cryptographic signing' },
  kms:              { label: 'KMS Client',       icon: Key,               description: 'Key management service' },
  axis:             { label: 'AXIS',             icon: Robot,             description: 'AI provider connectivity' },
  synchron8:        { label: 'SYNCHRON8',        icon: Lightning,         description: 'Governed automation engine' },
  logicbridge:      { label: 'LOGICBRIDGE',      icon: Link,              description: 'Connector builder & registry' },
  syncronate:       { label: 'Syncronate',       icon: CloudArrowUp,      description: 'Federation engine' },
  casespaceFactory: { label: 'CaseSpace Factory',icon: Globe,             description: 'Workspace provisioning' },
  formkey:          { label: 'Vault Forms',      icon: Shield,            description: 'Governed intake and consent pipeline' },
  templateLibrary:  { label: 'Template Library', icon: FileMagnifyingGlass, description: 'Versioned output templates' },
  spark:            { label: 'spark Runtime',    icon: Lightning,         description: 'Handler execution sandbox' },
  volume:           { label: 'Persistent Volume',icon: HardDrive,         description: 'Fly.io durable storage' },
}

// PJ-Compliant Deployment Standard §15 — 15 requirements
const COMPLIANCE_REQUIREMENTS = [
  { id: 1,  label: 'All modules loaded and healthy',          derive: (h: PJHealthResponse) => Object.values(h.subsystems).every(s => s.status === 'ok') ? 'pass' : 'fail' },
  { id: 2,  label: 'KMS external, reachable, fail-closed',   derive: (h: PJHealthResponse) => h.subsystems.kms?.status === 'ok' ? 'pass' : 'fail' },
  { id: 3,  label: 'DLP model hash verified at startup',      derive: (_h: PJHealthResponse) => 'ops' as const },
  { id: 4,  label: 'ARCHIEVE WAL on persistent volume, replay tested', derive: (h: PJHealthResponse) => h.subsystems.archieve?.status === 'ok' ? 'pass' : 'fail' },
  { id: 5,  label: 'All /api/* routes protected by RBAC',    derive: (_h: PJHealthResponse) => 'ops' as const },
  { id: 6,  label: 'Tenant isolation enforced across VAULT, kv, credentials', derive: (_h: PJHealthResponse) => 'ops' as const },
  { id: 7,  label: 'spark sandbox enforced (no fs/require/process)', derive: (h: PJHealthResponse) => h.subsystems.spark?.status === 'ok' ? 'pass' : 'fail' },
  { id: 8,  label: 'SEAL signing verified, offline-verifiable', derive: (h: PJHealthResponse) => (h.subsystems.seal as Record<string,unknown>)?.signingKeyStatus === 'loaded' ? 'pass' : 'fail' },
  { id: 9,  label: 'DLP conservative posture (blockOnDetectionFailure)', derive: (_h: PJHealthResponse) => 'ops' as const },
  { id: 10, label: 'ARCHIEVE hash chain integrity verified', derive: (h: PJHealthResponse) => h.subsystems.archieve?.status === 'ok' ? 'pass' : 'fail' },
  { id: 11, label: 'Fly volume snapshot ≥30-day retention configured', derive: (_h: PJHealthResponse) => 'ops' as const },
  { id: 12, label: 'OTEL exporter reporting spans to collector', derive: (_h: PJHealthResponse) => 'ops' as const },
  { id: 13, label: 'auto_stop_machines = false (no cold starts)', derive: (_h: PJHealthResponse) => 'verified' as const },
  { id: 14, label: 'NODE_ENV = production',                   derive: (_h: PJHealthResponse) => 'ops' as const },
  { id: 15, label: 'No secrets in container image or version control', derive: (_h: PJHealthResponse) => 'ops' as const },
] as const

function StatusDot({ status }: { status: 'ok' | 'degraded' | 'down' }) {
  if (status === 'ok') return <span className="w-2 h-2 rounded-full bg-green-500 shrink-0" />
  if (status === 'degraded') return <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />
  return <span className="w-2 h-2 rounded-full bg-red-500 shrink-0" />
}

function StatusBadge({ status }: { status: 'ok' | 'degraded' | 'down' }) {
  const cls = status === 'ok'
    ? 'bg-green-500/10 text-green-400 border-green-500/30'
    : status === 'degraded'
    ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
    : 'bg-red-500/10 text-red-400 border-red-500/30'
  return <span className={`px-2 py-0.5 rounded-full text-xs font-semibold border uppercase tracking-wide ${cls}`}>{status}</span>
}

function ComplianceIcon({ result }: { result: 'pass' | 'fail' | 'ops' | 'verified' }) {
  if (result === 'pass')     return <CheckCircle size={16} weight="duotone" className="text-green-500 shrink-0" />
  if (result === 'verified') return <CheckCircle size={16} weight="duotone" className="text-blue-500 shrink-0" />
  if (result === 'fail')     return <XCircle     size={16} weight="duotone" className="text-red-500 shrink-0" />
  return <Warning size={16} weight="duotone" className="text-amber-500 shrink-0" />
}

function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400)
  const h = Math.floor((seconds % 86400) / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (d > 0) return `${d}d ${h}h ${m}m`
  if (h > 0) return `${h}h ${m}m`
  return `${m}m ${seconds % 60}s`
}

export function PJHealthPanel() {
  const [health, setHealth] = useState<PJHealthResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshedAt, setRefreshedAt] = useState<Date | null>(null)
  const [metrics, setMetrics] = useState<HealthMetrics | null>(null)
  const [metricsError, setMetricsError] = useState(false)

  const loadMetrics = useCallback(async () => {
    try {
      const r = await pjApi.health.metrics()
      setMetrics(r.metrics)
    } catch { setMetricsError(true) }
  }, [])

  const load = async () => {
    setLoading(true); setError(null)
    try {
      const data = await pjApi.system.health()
      setHealth(data)
      setRefreshedAt(new Date())
      await loadMetrics()
    } catch {
      setError('Could not reach PuddleJumper. Check that PJ is running.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-refresh metrics every 30s
  useEffect(() => {
    const id = setInterval(loadMetrics, 30_000)
    return () => clearInterval(id)
  }, [loadMetrics])

  const PJ_URL = pjBase

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-lg">PJ System Health</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {refreshedAt ? `Last checked ${refreshedAt.toLocaleTimeString()}` : 'Checking…'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {PJ_URL && (
            <a href={`${PJ_URL}/v1/metrics`} target="_blank" rel="noopener noreferrer"
              className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 border border-border rounded-lg px-3 py-1.5 transition-colors hover:border-foreground/30">
              <ChartLine size={13} /> Metrics
            </a>
          )}
          <Button variant="outline" size="sm" onClick={load} disabled={loading} className="gap-1.5 h-8 text-xs">
            <ArrowClockwise size={13} className={loading ? 'animate-spin' : ''} />
            Refresh
          </Button>
        </div>
      </div>

      {error && (
        <Card className="border-red-500/30 bg-red-500/5">
          <CardContent className="pt-4 pb-4 flex items-center gap-2 text-red-400 text-sm">
            <XCircle size={16} weight="duotone" /> {error}
          </CardContent>
        </Card>
      )}

      {health && (
        <>
          {/* Overview strip */}
          <Card>
            <CardContent className="pt-5 pb-5">
              <div className="flex flex-wrap gap-6">
                <div className="flex items-center gap-2">
                  <StatusDot status={health.status} />
                  <div>
                    <div className="text-xs text-muted-foreground">Overall</div>
                    <StatusBadge status={health.status} />
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Version</div>
                  <div className="font-mono text-sm font-semibold">{health.version}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Region</div>
                  <div className="font-mono text-sm font-semibold uppercase">{health.region}</div>
                </div>
                <div className="flex items-center gap-1.5">
                  <Clock size={14} className="text-muted-foreground" />
                  <div>
                    <div className="text-xs text-muted-foreground">Uptime</div>
                    <div className="text-sm font-semibold">{formatUptime(health.uptime_seconds)}</div>
                  </div>
                </div>
                {health.alerts.length > 0 && (
                  <div className="flex items-center gap-1.5 text-amber-400">
                    <Warning size={14} weight="duotone" />
                    <span className="text-xs font-medium">{health.alerts.length} alert{health.alerts.length !== 1 ? 's' : ''}</span>
                  </div>
                )}
              </div>
              {health.alerts.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {health.alerts.map(a => (
                    <span key={a} className="px-2 py-0.5 rounded-full text-xs bg-amber-500/10 text-amber-400 border border-amber-500/20 font-mono">{a}</span>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Live Operational Metrics */}
          {metrics && !metricsError && (
            <div>
              <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Live Metrics</h4>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                <div className="rounded-lg border bg-card p-3">
                  <div className="text-xs text-muted-foreground mb-1 flex items-center gap-1"><Clock size={12} /> Uptime</div>
                  <div className="text-sm font-semibold">{formatUptime(metrics.uptime)}</div>
                </div>
                <div className="rounded-lg border bg-card p-3">
                  <div className="text-xs text-muted-foreground mb-1 flex items-center gap-1"><HardDrive size={12} /> DB Backend</div>
                  <div className="text-sm font-semibold font-mono">{metrics.dbBackend}</div>
                  {metrics.dbSizeBytes != null && (
                    <div className="text-xs text-muted-foreground">{(metrics.dbSizeBytes / 1024 / 1024).toFixed(1)} MB</div>
                  )}
                </div>
                <div className="rounded-lg border bg-card p-3">
                  <div className="text-xs text-muted-foreground mb-1 flex items-center gap-1"><FileMagnifyingGlass size={12} /> ARCHIEVE</div>
                  <div className="text-sm font-semibold">{metrics.archieve.chainLength.toLocaleString()} events</div>
                  <div className="text-xs text-muted-foreground">Queue: {metrics.archieve.queueDepth}</div>
                </div>
                <div className="rounded-lg border bg-card p-3">
                  <div className="text-xs text-muted-foreground mb-1 flex items-center gap-1"><Globe size={12} /> Tenants</div>
                  <div className="text-sm font-semibold">{metrics.tenants.active} active</div>
                  <div className="text-xs text-muted-foreground">{metrics.tenants.total} total</div>
                </div>
                <div className="rounded-lg border bg-card p-3">
                  <div className="text-xs text-muted-foreground mb-1 flex items-center gap-1"><Database size={12} /> Documents</div>
                  <div className="text-sm font-semibold">{metrics.documents.total.toLocaleString()}</div>
                  <div className="text-xs text-muted-foreground truncate">
                    {Object.entries(metrics.documents.byStatus).map(([s, n]) => `${s}: ${n}`).join(' · ')}
                  </div>
                </div>
                <div className="rounded-lg border bg-card p-3">
                  <div className="text-xs text-muted-foreground mb-1 flex items-center gap-1"><ChartLine size={12} /> Requests (1h)</div>
                  <div className="text-sm font-semibold">{metrics.requests.last1h.toLocaleString()}</div>
                </div>
                <div className="rounded-lg border bg-card p-3">
                  <div className="text-xs text-muted-foreground mb-1 flex items-center gap-1"><Shield size={12} /> SEAL Keys</div>
                  <div className="text-sm font-semibold">{metrics.seal.keyCount}</div>
                </div>
                <div className="rounded-lg border bg-card p-3">
                  <div className="text-xs text-muted-foreground mb-1 flex items-center gap-1"><Database size={12} /> Heap Used</div>
                  <div className="text-sm font-semibold">{(metrics.memory.heapUsed / 1024 / 1024).toFixed(0)} MB</div>
                  <div className="text-xs text-muted-foreground">of {(metrics.memory.heapTotal / 1024 / 1024).toFixed(0)} MB</div>
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-2">Auto-refreshes every 30s · {new Date(metrics.timestamp).toLocaleTimeString()}</p>
            </div>
          )}

          {/* Subsystems grid */}
          <div>
            <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Subsystems</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {Object.entries(health.subsystems).map(([key, sub]) => {
                const meta = SUBSYSTEM_META[key]
                const Icon = meta?.icon ?? Database
                return (
                  <div key={key}
                    className={`flex items-center gap-3 p-3 rounded-lg border transition-colors
                      ${sub.status === 'ok' ? 'border-border bg-card' : sub.status === 'degraded' ? 'border-amber-500/30 bg-amber-500/5' : 'border-red-500/30 bg-red-500/5'}`}>
                    <Icon size={18} weight="duotone" className={
                      sub.status === 'ok' ? 'text-green-500' : sub.status === 'degraded' ? 'text-amber-500' : 'text-red-500'
                    } />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm truncate">{meta?.label ?? key}</div>
                      <div className="text-xs text-muted-foreground">{meta?.description ?? ''}</div>
                    </div>
                    <StatusDot status={sub.status} />
                  </div>
                )
              })}
            </div>
          </div>

          {/* PJ Compliance Standard §15 */}
          <div>
            <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">PJ Compliance Standard</h4>
            <Card>
              <CardContent className="pt-4 pb-2 divide-y divide-border">
                {COMPLIANCE_REQUIREMENTS.map(req => {
                  const result = req.derive(health)
                  return (
                    <div key={req.id} className="flex items-center gap-3 py-2.5">
                      <span className="text-xs text-muted-foreground font-mono w-5 shrink-0 text-right">{req.id}</span>
                      <ComplianceIcon result={result} />
                      <span className="text-sm flex-1">{req.label}</span>
                      {result === 'ops' && (
                        <span className="text-[10px] text-muted-foreground border border-border rounded px-1.5 py-0.5 shrink-0">Requires Ops</span>
                      )}
                      {result === 'verified' && (
                        <span className="text-[10px] text-blue-400 border border-blue-500/30 rounded px-1.5 py-0.5 shrink-0">Verified</span>
                      )}
                    </div>
                  )
                })}
              </CardContent>
            </Card>
            <p className="text-xs text-muted-foreground mt-2">
              ✓ = verified via /v1/health &nbsp;·&nbsp; ⚠ = requires deployment ops check &nbsp;·&nbsp; 🔵 = confirmed in fly.toml
            </p>
          </div>
        </>
      )}

      {loading && !health && (
        <div className="flex items-center justify-center py-16">
          <ArrowClockwise size={24} className="animate-spin text-muted-foreground" />
        </div>
      )}
    </div>
  )
}
