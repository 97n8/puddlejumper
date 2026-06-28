import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import {
  ArrowLeft,
  ArrowClockwise,
  Robot,
  Warning,
  PaperPlaneRight,
  MagnifyingGlass,
  BookOpen,
  CheckCircle,
  XCircle,
  Clock,
  Lightbulb,
} from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import type { AIModel, AIInteractionStatus } from '../types'
import type { DiscoveryResult, ArchieveRule, RuleRecommendation, NormalizeResult } from '@/services/pjApi'
import { useAIHistory, useAIUsage, useSubmitAIQuery } from '../api'
import { pjApi } from '@/services/pjApi'

const querySchema = z.object({
  model: z.enum(['gpt-4o', 'gpt-4o-mini', 'claude-sonnet', 'claude-haiku']),
  prompt: z.string().min(1, 'Prompt is required'),
})
type QueryFormValues = z.infer<typeof querySchema>

const STATUS_CONFIG: Record<AIInteractionStatus, { label: string; className: string }> = {
  pending: { label: 'Pending', className: 'bg-amber-500/10 text-amber-600 border-amber-500/20' },
  completed: { label: 'Completed', className: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' },
  flagged: { label: 'Flagged', className: 'bg-red-500/10 text-red-600 border-red-500/20' },
  rejected: { label: 'Rejected', className: 'bg-slate-500/10 text-slate-600 border-slate-500/20' },
}

const AI_MODELS: { value: AIModel; label: string }[] = [
  { value: 'gpt-4o', label: 'GPT-4o' },
  { value: 'gpt-4o-mini', label: 'GPT-4o Mini' },
  { value: 'claude-sonnet', label: 'Claude Sonnet' },
  { value: 'claude-haiku', label: 'Claude Haiku' },
]

function StatusBadge({ status }: { status: AIInteractionStatus }) {
  const cfg = STATUS_CONFIG[status]
  return (
    <span className={cn('inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium', cfg.className)}>
      {cfg.label}
    </span>
  )
}

function truncate(str: string, len: number) {
  return str.length > len ? str.slice(0, len) + '…' : str
}

export function GovAIPanel({ onBack }: { onBack: () => void }) {
  const [response, setResponse] = useState<string | null>(null)
  const { data: history = [], isLoading: historyLoading, refetch: refetchHistory } = useAIHistory()
  const { data: usage, isLoading: usageLoading, refetch: refetchUsage } = useAIUsage()
  const submitMutation = useSubmitAIQuery()

  // ── Discovery state ──────────────────────────────────────────────────────
  const [discoverQ, setDiscoverQ] = useState('')
  const [discoverJurisdiction, setDiscoverJurisdiction] = useState('')
  const [discoverLoading, setDiscoverLoading] = useState(false)
  const [discoverResult, setDiscoverResult] = useState<DiscoveryResult | null>(null)

  // ── Normalize state (Layer 3/4 — AI intake → form match) ─────────────────
  const [normalizeResult, setNormalizeResult] = useState<NormalizeResult | null>(null)
  const [normalizing, setNormalizing] = useState(false)

  async function runNormalize(text: string) {
    if (!text.trim()) return
    setNormalizing(true); setNormalizeResult(null)
    try {
      const r = await pjApi.formkey.normalize(text.trim())
      setNormalizeResult(r)
    } catch { /* silent — normalize is best-effort */ }
    finally { setNormalizing(false) }
  }

  async function runDiscovery() {
    if (!discoverQ.trim()) return
    setDiscoverLoading(true); setDiscoverResult(null)
    void runNormalize(discoverQ.trim()) // best-effort form match in parallel
    try {
      const r = await pjApi.discover.query({ question: discoverQ.trim(), jurisdictionId: discoverJurisdiction.trim() || undefined })
      setDiscoverResult(r)
    } catch { toast.error('Discovery query failed') }
    finally { setDiscoverLoading(false) }
  }

  // ── Rules state ──────────────────────────────────────────────────────────
  const [rules, setRules] = useState<ArchieveRule[]>([])
  const [rulesLoading, setRulesLoading] = useState(false)
  const [rulesLoaded, setRulesLoaded] = useState(false)
  const [deployForm, setDeployForm] = useState({ title: '', description: '', jurisdiction: '', category: 'compliance' as ArchieveRule['category'] })
  const [deployOpen, setDeployOpen] = useState(false)
  const [deploying, setDeploying] = useState(false)

  async function loadRules() {
    setRulesLoading(true)
    try {
      const r = await pjApi.rules.list()
      setRules(r.rules ?? [])
      setRulesLoaded(true)
    } catch { toast.error('Failed to load rules') }
    finally { setRulesLoading(false) }
  }

  async function deployRule() {
    if (!deployForm.title.trim() || !deployForm.jurisdiction.trim()) return
    setDeploying(true)
    try {
      await pjApi.rules.ingest({
        title: deployForm.title.trim(),
        description: deployForm.description.trim(),
        jurisdiction: deployForm.jurisdiction.trim(),
        category: deployForm.category,
        conditions: [],
        actions: [],
        source: 'ai',
        ai_confidence: response ? 0.8 : undefined,
      })
      toast.success('Rule deployed to ARCHIEVE')
      setDeployOpen(false)
      setDeployForm({ title: '', description: '', jurisdiction: '', category: 'compliance' })
      await loadRules()
    } catch { toast.error('Deploy failed') }
    finally { setDeploying(false) }
  }

  async function toggleRuleStatus(rule: ArchieveRule) {
    if (rule.status === 'pending') return // pending rules go through approve/reject
    const next = rule.status === 'active' ? 'archived' : 'active'
    try {
      const r = await pjApi.rules.updateStatus(rule.id, next)
      setRules(prev => prev.map(x => x.id === rule.id ? r.rule : x))
    } catch { toast.error('Failed to update rule') }
  }

  // ── Pending rules state ────────────────────────────────────────────────────
  const [pendingRules, setPendingRules] = useState<ArchieveRule[]>([])
  const [pendingLoading, setPendingLoading] = useState(false)
  const [pendingLoaded, setPendingLoaded] = useState(false)

  async function loadPending() {
    setPendingLoading(true)
    try {
      const r = await pjApi.rules.listPending()
      setPendingRules(r.rules ?? [])
      setPendingLoaded(true)
    } catch { toast.error('Failed to load pending rules') }
    finally { setPendingLoading(false) }
  }

  async function handleApprove(rule: ArchieveRule, approve: boolean) {
    try {
      await pjApi.rules.approve(rule.id, approve)
      toast.success(approve ? 'Rule approved and activated' : 'Rule rejected')
      setPendingRules(prev => prev.filter(r => r.id !== rule.id))
      if (approve) setRules(prev => [...prev, { ...rule, status: 'active' }])
    } catch { toast.error('Approval action failed') }
  }

  // ── Suggestions state ──────────────────────────────────────────────────────
  const [suggestions, setSuggestions] = useState<RuleRecommendation[]>([])
  const [suggestionsLoading, setSuggestionsLoading] = useState(false)
  const [suggestionsLoaded, setSuggestionsLoaded] = useState(false)

  async function loadSuggestions() {
    setSuggestionsLoading(true)
    try {
      const r = await pjApi.rules.recommendations()
      setSuggestions(r.recommendations ?? [])
      setSuggestionsLoaded(true)
    } catch { toast.error('Failed to load suggestions') }
    finally { setSuggestionsLoading(false) }
  }

  async function deploySuggestion(rec: RuleRecommendation) {
    try {
      await pjApi.rules.ingest({
        title: rec.title,
        description: rec.description,
        jurisdiction: '',
        category: rec.category,
        conditions: [],
        actions: [],
        source: 'ai',
        ai_confidence: rec.avgConfidence,
      })
      toast.success('Suggestion submitted for approval')
      setSuggestions(prev => prev.filter(s => s.suggestedRuleId !== rec.suggestedRuleId))
    } catch { toast.error('Failed to submit suggestion') }
  }

  const isLoading = historyLoading || usageLoading

  const form = useForm<QueryFormValues>({
    resolver: zodResolver(querySchema),
    defaultValues: { model: 'gpt-4o', prompt: '' },
  })

  async function onSubmit(values: QueryFormValues) {
    try {
      const result = await submitMutation.mutateAsync(values)
      setResponse(result.response)
      form.setValue('prompt', '')
    } catch {
      toast.error('Query failed')
    }
  }

  return (
    <div className="h-full flex flex-col overflow-hidden" data-tool-panel>
      <div className="shrink-0 flex items-center gap-3 px-5 py-4 border-b bg-background/80 backdrop-blur sticky top-0 z-10">
        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={onBack}>
          <ArrowLeft size={16} />
        </Button>
        <Robot size={20} className="text-muted-foreground shrink-0" />
        <div className="min-w-0 flex-1">
          <h1 className="font-semibold text-sm leading-tight">AI Assistant</h1>
          <p className="text-xs text-muted-foreground leading-tight">Ask questions and get AI-powered answers — every query is logged for accountability</p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0"
          onClick={() => { refetchHistory(); refetchUsage() }}
          disabled={isLoading}
        >
          <ArrowClockwise size={16} className={isLoading ? 'animate-spin' : ''} />
        </Button>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto">
        <Tabs defaultValue="console" className="h-full">
          <div className="px-5 pt-4 border-b">
            <TabsList>
              <TabsTrigger value="console">Console</TabsTrigger>
              <TabsTrigger value="discovery"><MagnifyingGlass size={13} className="mr-1" />Discovery</TabsTrigger>
              <TabsTrigger value="rules"><BookOpen size={13} className="mr-1" />Rules</TabsTrigger>
              <TabsTrigger value="pending" onClick={() => { if (!pendingLoaded) loadPending() }}>
                <Clock size={13} className="mr-1" />Pending
                {pendingRules.length > 0 && (
                  <span className="ml-1 rounded-full bg-amber-500 text-white text-[10px] px-1.5 py-0.5 leading-none">{pendingRules.length}</span>
                )}
              </TabsTrigger>
              <TabsTrigger value="suggestions" onClick={() => { if (!suggestionsLoaded) loadSuggestions() }}>
                <Lightbulb size={13} className="mr-1" />Suggestions
              </TabsTrigger>
              <TabsTrigger value="history">
                History
                {history.length > 0 && (
                  <span className="ml-1.5 text-xs bg-muted rounded-full px-1.5 py-0.5">{history.length}</span>
                )}
              </TabsTrigger>
              <TabsTrigger value="usage">Usage</TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="console" className="p-5 space-y-4">
            <div className="rounded-lg border bg-amber-500/5 border-amber-500/20 p-3 flex items-start gap-2 text-sm text-amber-700">
              <Warning size={16} className="mt-0.5 shrink-0" />
              <span>Every query you submit is logged with your name, timestamp, and the full response. This creates an accountable record of AI use.</span>
            </div>

            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="ai-model">Model</Label>
                <select
                  id="ai-model"
                  {...form.register('model')}
                  className="w-full h-9 rounded-md border bg-background px-3 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                >
                  {AI_MODELS.map(m => (
                    <option key={m.value} value={m.value}>{m.label}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ai-prompt">Your question</Label>
                <Textarea
                  id="ai-prompt"
                  {...form.register('prompt')}
                  rows={6}
                  placeholder="Ask anything — draft a memo, summarize a document, look up a policy..."
                  className="resize-none"
                />
                {form.formState.errors.prompt && (
                  <p className="text-xs text-destructive">{form.formState.errors.prompt.message}</p>
                )}
              </div>
              <Button type="submit" disabled={submitMutation.isPending} className="gap-1.5">
                <PaperPlaneRight size={14} />
                {submitMutation.isPending ? 'Submitting...' : 'Submit'}
              </Button>
            </form>

            {response !== null && (
              <div className="space-y-1.5">
                <Label>Response</Label>
                <pre className="text-sm font-mono bg-muted p-3 rounded-md overflow-auto whitespace-pre-wrap max-h-64">
                  {response}
                </pre>
              </div>
            )}
          </TabsContent>

          <TabsContent value="discovery" className="p-5 space-y-4">
            <div className="space-y-1.5">
              <Label>What do you need help with?</Label>
              <Textarea
                rows={3}
                placeholder="e.g. 'I want to build a deck on my property' or 'We received a public records request'"
                value={discoverQ}
                onChange={e => setDiscoverQ(e.target.value)}
                className="resize-none"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Jurisdiction (optional)</Label>
              <input
                type="text"
                placeholder="e.g. Sutton, MA"
                value={discoverJurisdiction}
                onChange={e => setDiscoverJurisdiction(e.target.value)}
                className="w-full h-9 rounded-md border bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
            <Button onClick={runDiscovery} disabled={discoverLoading || !discoverQ.trim()} className="gap-1.5">
              <MagnifyingGlass size={14} />
              {discoverLoading ? 'Discovering…' : 'Discover'}
            </Button>

            {discoverResult && (
              <div className="rounded-lg border bg-card p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 uppercase">{discoverResult.caseType}</span>
                    <span className="text-xs text-muted-foreground">confidence {Math.round(discoverResult.confidence * 100)}%</span>
                    <span className="text-xs text-muted-foreground">via {discoverResult.source}</span>
                  </div>
                </div>
                <div>
                  <div className="text-xs font-medium text-muted-foreground mb-0.5">Suggested Title</div>
                  <div className="text-sm font-semibold">{discoverResult.suggestedTitle}</div>
                </div>
                {discoverResult.obligations.length > 0 && (
                  <div>
                    <div className="text-xs font-medium text-muted-foreground mb-2">Obligations ({discoverResult.obligations.length})</div>
                    <div className="space-y-1.5">
                      {discoverResult.obligations.map((ob, i) => (
                        <div key={i} className="flex items-start gap-2 text-sm">
                          {ob.required
                            ? <CheckCircle size={14} className="text-red-500 mt-0.5 shrink-0" weight="fill" />
                            : <XCircle size={14} className="text-muted-foreground mt-0.5 shrink-0" />}
                          <div>
                            <span className="font-medium">{ob.title}</span>
                            {ob.description && <p className="text-xs text-muted-foreground">{ob.description}</p>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {discoverResult.reasoning && (
                  <p className="text-xs text-muted-foreground italic border-t pt-2">{discoverResult.reasoning}</p>
                )}
              </div>
            )}

            {/* Normalize result — best matching FormKey form */}
            {(normalizeResult || normalizing) && (
              <div className={cn('rounded-lg border p-3 text-xs', normalizeResult?.matched ? 'bg-emerald-50 border-emerald-200 dark:bg-emerald-950/20 dark:border-emerald-800' : 'bg-muted/30')}>
                {normalizing && <span className="text-muted-foreground italic">Matching to form…</span>}
                {!normalizing && normalizeResult && !normalizeResult.matched && (
                  <span className="text-muted-foreground">No FormKey form matched for this request.</span>
                )}
                {!normalizing && normalizeResult?.matched && (
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2 font-semibold">
                      <CheckCircle size={13} className="text-emerald-600" weight="fill" />
                      <span>Best form: {normalizeResult.formTitle}</span>
                      <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300">
                        {Math.round(normalizeResult.confidence * 100)}% match • {normalizeResult.mode}
                      </span>
                    </div>
                    {Object.keys(normalizeResult.prefill).length > 0 && (
                      <div className="mt-2 space-y-1">
                        <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Prefill preview</div>
                        {Object.entries(normalizeResult.prefill).map(([k, v]) => (
                          <div key={k} className="flex items-center gap-2">
                            <span className="text-muted-foreground">{k}:</span>
                            <span className="font-medium">{String(v)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </TabsContent>

          <TabsContent value="rules" className="p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold">Governance Rules</h2>
                <p className="text-xs text-muted-foreground">Rules deployed to ARCHIEVE drive automated case workflows.</p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={loadRules} disabled={rulesLoading} className="gap-1.5 h-8 text-xs">
                  <ArrowClockwise size={13} className={rulesLoading ? 'animate-spin' : ''} /> {rulesLoaded ? 'Refresh' : 'Load'}
                </Button>
                <Button size="sm" onClick={() => setDeployOpen(p => !p)} className="gap-1.5 h-8 text-xs">
                  <BookOpen size={13} /> Deploy Rule
                </Button>
              </div>
            </div>

            {deployOpen && (
              <div className="rounded-lg border bg-card p-4 space-y-3">
                <div className="text-sm font-semibold">Deploy Rule to ARCHIEVE</div>
                <input type="text" placeholder="Rule title" value={deployForm.title}
                  onChange={e => setDeployForm(p => ({ ...p, title: e.target.value }))}
                  className="w-full h-9 rounded-md border bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring" />
                <Textarea rows={2} placeholder="Description" value={deployForm.description}
                  onChange={e => setDeployForm(p => ({ ...p, description: e.target.value }))}
                  className="resize-none" />
                <div className="flex gap-2">
                  <input type="text" placeholder="Jurisdiction (e.g. Sutton, MA)" value={deployForm.jurisdiction}
                    onChange={e => setDeployForm(p => ({ ...p, jurisdiction: e.target.value }))}
                    className="flex-1 h-9 rounded-md border bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring" />
                  <select value={deployForm.category} onChange={e => setDeployForm(p => ({ ...p, category: e.target.value as ArchieveRule['category'] }))}
                    className="h-9 rounded-md border bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring">
                    <option value="compliance">Compliance</option>
                    <option value="permit">Permit</option>
                    <option value="license">License</option>
                    <option value="zoning">Zoning</option>
                    <option value="grant">Grant</option>
                    <option value="general">General</option>
                  </select>
                </div>
                {response && (
                  <p className="text-xs text-muted-foreground italic">Pre-filling from last AI response. Edit as needed.</p>
                )}
                <div className="flex gap-2">
                  <Button size="sm" disabled={deploying || !deployForm.title.trim() || !deployForm.jurisdiction.trim()} onClick={deployRule} className="gap-1.5">
                    {deploying ? 'Deploying…' : 'Deploy to ARCHIEVE'}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setDeployOpen(false)}>Cancel</Button>
                </div>
              </div>
            )}

            {!rulesLoaded ? (
              <div className="py-8 text-center text-muted-foreground text-sm">Click "Load" to fetch governance rules.</div>
            ) : rules.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground text-sm">No rules yet. Deploy your first rule above.</div>
            ) : (
              <div className="rounded-md border overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-muted/40 border-b">
                      <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Title</th>
                      <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Category</th>
                      <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Jurisdiction</th>
                      <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Status</th>
                      <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Source</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rules.map((rule, i) => (
                      <tr key={rule.id} className={cn('border-b last:border-0', i % 2 === 0 ? '' : 'bg-muted/20')}>
                        <td className="px-4 py-3 font-medium">{rule.title}</td>
                        <td className="px-4 py-3 text-xs">{rule.category}</td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">{rule.jurisdiction}</td>
                        <td className="px-4 py-3">
                        <button
                            onClick={() => toggleRuleStatus(rule)}
                            disabled={rule.status === 'pending'}
                            className={cn('text-xs px-2 py-0.5 rounded-full font-medium transition-colors',
                              rule.status === 'active' ? 'bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20' :
                              rule.status === 'pending' ? 'bg-amber-500/10 text-amber-600 cursor-default' :
                              rule.status === 'draft' ? 'bg-amber-500/10 text-amber-600 hover:bg-amber-500/20' :
                              'bg-muted text-muted-foreground hover:bg-muted/80')}>
                            {rule.status}
                          </button>
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">{rule.source}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </TabsContent>

          <TabsContent value="pending" className="p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold">Pending Approval</h2>
                <p className="text-xs text-muted-foreground">AI-suggested rules waiting for a human to approve or reject before going live.</p>
              </div>
              <Button variant="outline" size="sm" onClick={loadPending} disabled={pendingLoading} className="gap-1.5 h-8 text-xs">
                <ArrowClockwise size={13} className={pendingLoading ? 'animate-spin' : ''} /> Refresh
              </Button>
            </div>
            {!pendingLoaded ? (
              <div className="py-8 text-center text-muted-foreground text-sm">Loading pending rules…</div>
            ) : pendingRules.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground text-sm">No rules pending approval.</div>
            ) : (
              <div className="space-y-3">
                {pendingRules.map(rule => (
                  <div key={rule.id} className="rounded-lg border bg-card p-4 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="text-sm font-semibold">{rule.title}</div>
                        <div className="text-xs text-muted-foreground mt-0.5">{rule.description}</div>
                      </div>
                      <span className="shrink-0 text-xs px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 font-medium">pending</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>{rule.category}</span>
                      {rule.jurisdiction && <><span>·</span><span>{rule.jurisdiction}</span></>}
                      {rule.ai_confidence != null && <><span>·</span><span>{Math.round(rule.ai_confidence * 100)}% confidence</span></>}
                    </div>
                    <div className="flex gap-2 pt-1">
                      <Button size="sm" className="gap-1.5 h-7 text-xs" onClick={() => handleApprove(rule, true)}>
                        <CheckCircle size={12} /> Approve
                      </Button>
                      <Button variant="outline" size="sm" className="gap-1.5 h-7 text-xs text-destructive hover:text-destructive" onClick={() => handleApprove(rule, false)}>
                        <XCircle size={12} /> Reject
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="suggestions" className="p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold">AI Suggestions</h2>
                <p className="text-xs text-muted-foreground">High-frequency inquiry patterns detected in your history — candidates for governance rules.</p>
              </div>
              <Button variant="outline" size="sm" onClick={loadSuggestions} disabled={suggestionsLoading} className="gap-1.5 h-8 text-xs">
                <ArrowClockwise size={13} className={suggestionsLoading ? 'animate-spin' : ''} /> Refresh
              </Button>
            </div>
            {!suggestionsLoaded ? (
              <div className="py-8 text-center text-muted-foreground text-sm">Loading suggestions…</div>
            ) : suggestions.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground text-sm">No suggestions yet — submit more queries to surface patterns.</div>
            ) : (
              <div className="space-y-3">
                {suggestions.map(rec => (
                  <div key={rec.suggestedRuleId} className="rounded-lg border bg-card p-4 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="text-sm font-semibold">{rec.title}</div>
                        <div className="text-xs text-muted-foreground mt-0.5">{rec.description}</div>
                      </div>
                      <span className="shrink-0 text-xs px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-600 font-medium">
                        {rec.frequency}× seen
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>{rec.category}</span>
                      <span>·</span>
                      <span>Last seen {new Date(rec.lastSeen).toLocaleDateString()}</span>
                      <span>·</span>
                      <span>{Math.round(rec.avgConfidence * 100)}% avg confidence</span>
                    </div>
                    <Button size="sm" className="gap-1.5 h-7 text-xs mt-1" onClick={() => deploySuggestion(rec)}>
                      <Lightbulb size={12} /> Submit for Approval
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="history" className="p-5">
            {history.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground text-sm">No queries yet. Ask a question in the Console tab.</div>
            ) : (
              <div className="rounded-md border overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-muted/40 border-b">
                      <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Model</th>
                      <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Prompt</th>
                      <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Status</th>
                      <th className="text-left px-4 py-2.5 font-medium text-muted-foreground hidden sm:table-cell">Tokens</th>
                      <th className="text-left px-4 py-2.5 font-medium text-muted-foreground hidden md:table-cell">Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.map((item, i) => (
                      <tr key={item.id} className={cn('border-b last:border-0', i % 2 === 0 ? '' : 'bg-muted/20')}>
                        <td className="px-4 py-3 text-xs font-mono">{item.model}</td>
                        <td className="px-4 py-3 text-muted-foreground max-w-xs">{truncate(item.prompt, 80)}</td>
                        <td className="px-4 py-3"><StatusBadge status={item.status} /></td>
                        <td className="px-4 py-3 tabular-nums hidden sm:table-cell">{item.usageTokens.toLocaleString()}</td>
                        <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">
                          {new Date(item.createdAt).toLocaleDateString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </TabsContent>

          <TabsContent value="usage" className="p-5 space-y-5">
            {usage ? (
              <>
                <div className="grid grid-cols-3 gap-3">
                  <div className="rounded-lg border bg-card p-4">
                    <div className="text-2xl font-bold">{usage.totalInteractions.toLocaleString()}</div>
                    <div className="text-xs text-muted-foreground mt-1">Total Interactions</div>
                  </div>
                  <div className="rounded-lg border bg-card p-4">
                    <div className="text-2xl font-bold">{usage.totalTokens.toLocaleString()}</div>
                    <div className="text-xs text-muted-foreground mt-1">Total Tokens</div>
                  </div>
                  <div className="rounded-lg border bg-card p-4">
                    <div className="text-2xl font-bold text-red-600">{usage.flaggedCount.toLocaleString()}</div>
                    <div className="text-xs text-muted-foreground mt-1">Flagged</div>
                  </div>
                </div>

                <div>
                  <h2 className="text-sm font-semibold mb-3">By Model</h2>
                  <div className="rounded-md border overflow-hidden">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-muted/40 border-b">
                          <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Model</th>
                          <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Interactions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(Object.entries(usage.byModel) as [AIModel, number][]).map(([model, count], i) => (
                          <tr key={model} className={cn('border-b last:border-0', i % 2 === 0 ? '' : 'bg-muted/20')}>
                            <td className="px-4 py-3 font-mono text-xs">{model}</td>
                            <td className="px-4 py-3 tabular-nums">{count.toLocaleString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            ) : (
              <div className="py-12 text-center text-muted-foreground text-sm">Usage data will appear after your first query.</div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
