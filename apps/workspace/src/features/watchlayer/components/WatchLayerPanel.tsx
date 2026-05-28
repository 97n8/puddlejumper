import React, { useState, useEffect } from 'react'
import { toast } from 'sonner'
import {
  Eye, ArrowLeft, ArrowClockwise, CheckCircle, Warning,
  WarningCircle, Info, ShieldWarning, Broadcast,
  CheckSquare, ListChecks, ClipboardText, Gear,
} from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import type { WatchAlert, AlertSeverity, AlertDomain, AlertStatus } from '../types'
import { useWatchAlerts, useWatchDigest, useResolveAlert, useRunChecks } from '../api'
import { ApprovalQueueView } from '../../civicpulse/components/operatorUI/approvalQueue/ApprovalQueueView'
import { BackstopStatusPanel } from '../../civicpulse/components/operatorUI/backstop/BackstopStatusPanel'
import { ComplianceAlertBanner } from '../../civicpulse/components/operatorUI/backstop/ComplianceAlertBanner'
import { PublicationLogView } from '../../civicpulse/components/operatorUI/auditLog/PublicationLogView'
import { ChannelConfigPanel } from '../../civicpulse/components/operatorUI/channelConfig/ChannelConfigPanel'
import { ApprovalBehaviorSettings } from '../../civicpulse/components/operatorUI/channelConfig/ApprovalBehaviorSettings'
import { TownActivityFeed } from '../../civicpulse/components/publicFeed/TownActivityFeed'
import { civicpulseClient } from '../../civicpulse/api/civicpulseClient'

const SEVERITY_CONFIG: Record<AlertSeverity, { label: string; color: string; dot: string; icon: React.ReactNode }> = {
  critical: { label: 'Critical', color: 'bg-red-500/10 text-red-600 border-red-500/20 dark:text-red-400',     dot: 'bg-red-500',    icon: <ShieldWarning size={12} weight="fill" /> },
  high:     { label: 'High',     color: 'bg-orange-500/10 text-orange-600 border-orange-500/20 dark:text-orange-400', dot: 'bg-orange-500', icon: <WarningCircle size={12} weight="fill" /> },
  warning:  { label: 'Warning',  color: 'bg-yellow-500/10 text-yellow-700 border-yellow-500/20 dark:text-yellow-400', dot: 'bg-yellow-500', icon: <Warning size={12} weight="fill" /> },
  info:     { label: 'Info',     color: 'bg-muted text-muted-foreground border-muted-foreground/20',           dot: 'bg-slate-400',  icon: <Info size={12} /> },
}

const DOMAIN_LABELS: Record<AlertDomain, string> = {
  data_freshness:     'Data Freshness',
  organizational:     'Organizational',
  workflow:           'Workflow',
  financial:          'Financial',
  compliance:         'Compliance',
  access:             'Access',
  ai_activity:        'AI Activity',
  environment_health: 'Environment Health',
}

export function WatchLayerPanel({ onBack }: { onBack: () => void }) {
  const [severityFilter, setSeverityFilter] = useState<'all' | AlertSeverity>('all')
  const [domainFilter, setDomainFilter] = useState<'all' | AlertDomain>('all')
  const [statusFilter, setStatusFilter] = useState<AlertStatus>('open')
  const [resolveDialogOpen, setResolveDialogOpen] = useState(false)
  const [resolveTarget, setResolveTarget] = useState<WatchAlert | null>(null)
  const [resolveNote, setResolveNote] = useState('')
  const [tab, setTab] = useState('inbox')
  const [transparencyTab, setTransparencyTab] = useState('queue')
  const [backstopCount, setBackstopCount] = useState<number | null>(null)
  const [backstopUnavailable, setBackstopUnavailable] = useState(false)

  const { data: alerts = [], isLoading: loading, refetch: refetchAlerts } = useWatchAlerts({
    severity: severityFilter !== 'all' ? severityFilter : undefined,
    domain: domainFilter !== 'all' ? domainFilter : undefined,
    status: statusFilter,
  })
  const { data: digest, isLoading: digestLoading, refetch: refetchDigest } = useWatchDigest()
  const resolve = useResolveAlert()
  const runChecks = useRunChecks()

  useEffect(() => {
    civicpulseClient.getBackstopItems()
      .then(items => {
        setBackstopCount(items.filter(i => !i.resolved).length)
        setBackstopUnavailable(false)
      })
      .catch(() => {
        setBackstopCount(null)
        setBackstopUnavailable(true)
      })
  }, [])

  const handleResolve = async () => {
    if (!resolveTarget) return
    try {
      await resolve.mutateAsync({ alertId: resolveTarget.id, resolution_notes: resolveNote })
      toast.success('Alert resolved')
      setResolveDialogOpen(false)
      setResolveNote('')
      setResolveTarget(null)
    } catch {
      toast.error('Failed to resolve alert')
    }
  }

  const handleRunChecks = async () => {
    try {
      await runChecks.mutateAsync()
      toast.success('Checks completed')
    } catch {
      toast.error('Failed to run checks')
    }
  }

  return (
    <div className="h-full flex flex-col overflow-hidden" data-tool-panel>
      {/* Sticky top bar */}
      <div className="shrink-0 flex items-center gap-3 px-5 py-4 border-b bg-background/80 backdrop-blur sticky top-0 z-10">
        <Button variant="ghost" size="icon" onClick={onBack} aria-label="Back">
          <ArrowLeft size={18} />
        </Button>
        <Eye size={20} className="text-primary" />
        <div className="flex-1 min-w-0">
          <h1 className="text-sm font-semibold truncate">Watch Layer</h1>
          <p className="text-xs text-muted-foreground">Monitors your system for compliance gaps, missing data, and risk conditions</p>
        </div>
        <Button variant="ghost" size="icon" onClick={() => { refetchAlerts(); refetchDigest() }} aria-label="Refresh">
          <ArrowClockwise size={16} />
        </Button>
      </div>

      <div className="flex-1 min-h-0 overflow-auto">
        <div className="p-4 space-y-4">
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList>
              <TabsTrigger value="inbox">Alert Inbox</TabsTrigger>
              <TabsTrigger value="digest">System Digest</TabsTrigger>
              <TabsTrigger value="transparency" className="gap-1.5">
                <Broadcast size={13} weight="duotone" />
                Transparency
                {backstopUnavailable && (
                  <span className="ml-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold px-1.5 py-0 leading-4">!</span>
                )}
                {!backstopUnavailable && backstopCount !== null && backstopCount > 0 && (
                  <span className="ml-1 rounded-full bg-amber-500 text-white text-[10px] font-bold px-1.5 py-0 leading-4">{backstopCount}</span>
                )}
              </TabsTrigger>
            </TabsList>

            {/* ── Alert Inbox ── */}
            <TabsContent value="inbox" className="mt-4">
              {/* Filter bar */}
              <div className="flex flex-wrap gap-2 mb-4">
                <Select value={severityFilter} onValueChange={v => setSeverityFilter(v as typeof severityFilter)}>
                  <SelectTrigger className="w-36 h-8 text-xs">
                    <SelectValue placeholder="Severity" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All severities</SelectItem>
                    {(Object.keys(SEVERITY_CONFIG) as AlertSeverity[]).map(s => (
                      <SelectItem key={s} value={s}>{SEVERITY_CONFIG[s].label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={domainFilter} onValueChange={v => setDomainFilter(v as typeof domainFilter)}>
                  <SelectTrigger className="w-44 h-8 text-xs">
                    <SelectValue placeholder="Domain" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All domains</SelectItem>
                    {(Object.keys(DOMAIN_LABELS) as AlertDomain[]).map(d => (
                      <SelectItem key={d} value={d}>{DOMAIN_LABELS[d]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={statusFilter} onValueChange={v => setStatusFilter(v as AlertStatus)}>
                  <SelectTrigger className="w-36 h-8 text-xs">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="open">Open</SelectItem>
                    <SelectItem value="acknowledged">Acknowledged</SelectItem>
                    <SelectItem value="resolved">Resolved</SelectItem>
                    <SelectItem value="dismissed">Dismissed</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Alert list */}
              {loading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="rounded-lg border bg-card p-4 space-y-2 animate-pulse">
                      <div className="flex gap-2">
                        <div className="h-5 w-16 rounded-full bg-muted" />
                        <div className="h-5 w-24 rounded-full bg-muted" />
                      </div>
                      <div className="h-4 w-2/3 rounded bg-muted" />
                      <div className="h-3 w-full rounded bg-muted" />
                    </div>
                  ))}
                </div>
              ) : alerts.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
                  <CheckCircle size={36} className="text-emerald-500" weight="fill" />
                  <p className="text-sm font-medium">No alerts — system is healthy</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {alerts.map(alert => (
                    <div key={alert.id} className="rounded-lg border bg-card/50 p-4 flex flex-col gap-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={cn(
                            'inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs font-medium',
                            SEVERITY_CONFIG[alert.severity].color,
                          )}>
                            {SEVERITY_CONFIG[alert.severity].icon}
                            {SEVERITY_CONFIG[alert.severity].label}
                          </span>
                          <span className="text-xs text-muted-foreground px-2 py-0.5 rounded-full bg-muted/50 border">
                            {DOMAIN_LABELS[alert.domain]}
                          </span>
                        </div>
                        {alert.status === 'open' && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => { setResolveTarget(alert); setResolveDialogOpen(true) }}
                          >
                            Resolve
                          </Button>
                        )}
                      </div>

                      <div>
                        <p className="text-sm font-semibold">{alert.title}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{alert.detail}</p>
                      </div>

                      {alert.affectedObjectType && (
                        <p className="text-xs text-muted-foreground">
                          Affected: {alert.affectedObjectType} #{alert.affectedObjectId}
                        </p>
                      )}

                      {alert.suggestedAction && (
                        <p className="text-xs text-muted-foreground">→ {alert.suggestedAction}</p>
                      )}

                      <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                        <span>First: {new Date(alert.firstOccurredAt).toLocaleString()}</span>
                        <span>Last: {new Date(alert.lastOccurredAt).toLocaleString()}</span>
                        {alert.occurenceCount > 1 && (
                          <span className="font-medium">{alert.occurenceCount}× occurred</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>

            {/* ── System Digest ── */}
            <TabsContent value="digest" className="mt-4 space-y-4">
              <div className="flex justify-end">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleRunChecks}
                  disabled={runChecks.isPending}
                >
                  <ArrowClockwise size={14} className={cn('mr-1.5', runChecks.isPending && 'animate-spin')} />
                  {runChecks.isPending ? 'Running…' : 'Run Checks Now'}
                </Button>
              </div>

              {digestLoading ? (
                <div className="space-y-3 animate-pulse">
                  <div className="h-20 rounded-lg bg-muted" />
                  <div className="h-32 rounded-lg bg-muted" />
                </div>
              ) : !digest ? (
                <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
                  <p className="text-sm">No digest data available</p>
                  <Button size="sm" variant="outline" onClick={handleRunChecks} disabled={runChecks.isPending}>
                    Run Checks Now
                  </Button>
                </div>
              ) : (
                <>
                  {/* Summary card */}
                  <div className="rounded-lg border bg-card p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold">Open Alerts</p>
                      <span className="text-2xl font-bold">{digest.totalOpen}</span>
                    </div>

                    {/* Severity counters */}
                    <div className="grid grid-cols-4 gap-2">
                      {([
                        { key: 'critical' as AlertSeverity, bg: 'bg-red-500/10',    text: 'text-red-600 dark:text-red-400',       border: 'border-red-500/20' },
                        { key: 'high'     as AlertSeverity, bg: 'bg-orange-500/10', text: 'text-orange-600 dark:text-orange-400', border: 'border-orange-500/20' },
                        { key: 'warning'  as AlertSeverity, bg: 'bg-yellow-500/10', text: 'text-yellow-700 dark:text-yellow-400', border: 'border-yellow-500/20' },
                        { key: 'info'     as AlertSeverity, bg: 'bg-muted',         text: 'text-muted-foreground',                border: 'border-muted-foreground/20' },
                      ]).map(({ key, bg, text, border }) => (
                        <div key={key} className={cn('rounded-lg border p-2 text-center', bg, border)}>
                          <p className={cn('text-lg font-bold', text)}>{digest.bySeverity[key] ?? 0}</p>
                          <p className={cn('text-[10px] font-medium', text)}>{SEVERITY_CONFIG[key].label}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Domain breakdown */}
                  <div className="rounded-lg border bg-card p-4 space-y-2">
                    <p className="text-sm font-semibold mb-3">By Domain</p>
                    {(Object.entries(digest.byDomain) as [AlertDomain, number][])
                      .filter(([, count]) => count > 0)
                      .sort(([, a], [, b]) => b - a)
                      .map(([domain, count]) => (
                        <div key={domain} className="flex items-center justify-between py-1 border-b last:border-0">
                          <span className="text-xs text-muted-foreground">{DOMAIN_LABELS[domain]}</span>
                          <Badge variant="secondary" className="text-xs">{count}</Badge>
                        </div>
                      ))}
                    {Object.values(digest.byDomain).every(c => c === 0) && (
                      <p className="text-xs text-muted-foreground">No open alerts by domain</p>
                    )}
                  </div>

                  {/* Recent critical alerts */}
                  {digest.recentCritical.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-sm font-semibold text-red-600 dark:text-red-400">Recent Critical</p>
                      {digest.recentCritical.map(alert => (
                        <div key={alert.id} className="rounded-md border border-red-500/20 bg-red-500/5 p-3 space-y-1">
                          <p className="text-sm font-medium">{alert.title}</p>
                          <p className="text-xs text-muted-foreground">{alert.detail}</p>
                          <p className="text-[10px] text-muted-foreground">
                            {new Date(alert.lastOccurredAt).toLocaleString()}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}

                  <p className="text-[10px] text-muted-foreground text-right">
                    Generated {new Date(digest.generatedAt).toLocaleString()}
                  </p>
                </>
              )}
            </TabsContent>

            {/* ── Civic Transparency ── */}
            <TabsContent value="transparency" className="mt-4">
              {backstopCount !== null && backstopCount > 0 && (
                <div className="mb-4">
                  <ComplianceAlertBanner count={backstopCount} onView={() => setTransparencyTab('compliance')} />
                </div>
              )}
              <Tabs value={transparencyTab} onValueChange={setTransparencyTab}>
                <div className="border-b border-border mb-4">
                  <TabsList className="h-9 bg-transparent gap-0 p-0 rounded-none">
                    <TabsTrigger value="queue" className="h-9 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none text-xs gap-1.5 px-3">
                      <CheckSquare size={12} weight="duotone" /> Approval Queue
                    </TabsTrigger>
                    <TabsTrigger value="feed" className="h-9 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none text-xs gap-1.5 px-3">
                      <Broadcast size={12} weight="duotone" /> Activity Feed
                    </TabsTrigger>
                    <TabsTrigger value="compliance" className="h-9 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none text-xs gap-1.5 px-3">
                      <ListChecks size={12} weight="duotone" /> Compliance
                    </TabsTrigger>
                    <TabsTrigger value="log" className="h-9 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none text-xs gap-1.5 px-3">
                      <ClipboardText size={12} weight="duotone" /> Publication Log
                    </TabsTrigger>
                    <TabsTrigger value="config" className="h-9 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none text-xs gap-1.5 px-3">
                      <Gear size={12} weight="duotone" /> Settings
                    </TabsTrigger>
                  </TabsList>
                </div>
                <TabsContent value="queue" className="m-0">
                  <ApprovalQueueView />
                </TabsContent>
                <TabsContent value="feed" className="m-0">
                  <TownActivityFeed />
                </TabsContent>
                <TabsContent value="compliance" className="m-0 space-y-4">
                  <div>
                    <h2 className="text-sm font-semibold text-foreground">Compliance Windows</h2>
                    <p className="text-xs text-muted-foreground mt-0.5">Actions approaching or past their required communication window.</p>
                  </div>
                  <BackstopStatusPanel />
                </TabsContent>
                <TabsContent value="log" className="m-0">
                  <PublicationLogView />
                </TabsContent>
                <TabsContent value="config" className="m-0 space-y-8">
                  <div>
                    <h2 className="text-sm font-semibold text-foreground">Output Channels</h2>
                    <p className="text-xs text-muted-foreground mt-0.5 mb-4">Enable output channels and set approval behavior per channel.</p>
                    <ChannelConfigPanel />
                  </div>
                  <div>
                    <h2 className="text-sm font-semibold text-foreground">Approval Behavior by Action Type</h2>
                    <p className="text-xs text-muted-foreground mt-0.5 mb-4">Override default approval behavior for specific municipal action types.</p>
                    <ApprovalBehaviorSettings />
                  </div>
                </TabsContent>
              </Tabs>
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* Resolve Dialog */}
      <Dialog open={resolveDialogOpen} onOpenChange={setResolveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Resolve Alert</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm font-medium">{resolveTarget?.title}</p>
            <div>
              <Label>Resolution Note</Label>
              <Textarea
                value={resolveNote}
                onChange={e => setResolveNote(e.target.value)}
                placeholder="Describe how this was resolved..."
                className="mt-1"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResolveDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleResolve} disabled={resolve.isPending}>
              {resolve.isPending ? 'Resolving…' : 'Mark Resolved'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
