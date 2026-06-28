import React, { useState } from 'react'
import { toast } from 'sonner'
import { z } from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  GitBranch, ArrowLeft, Plus, FloppyDisk, Trash, ToggleLeft, ToggleRight,
  Play, ListBullets, CaretDown, CaretUp, Info,
} from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { RoutingRule, RuleCondition, RuleAction, ConditionOperator, ActionType } from '../types'
import { useRoutingRules, useCreateRule, useToggleRule } from '../api'

const DOMAINS = [
  { value: 'all', label: 'All Domains' },
  { value: 'procurement', label: 'Procurement' },
  { value: 'records', label: 'Records' },
  { value: 'org', label: 'Organization' },
  { value: 'watch', label: 'Watch Layer' },
]

const CONDITION_OPERATORS: { value: ConditionOperator; label: string }[] = [
  { value: 'equals', label: 'equals' },
  { value: 'not_equals', label: 'not equals' },
  { value: 'contains', label: 'contains' },
  { value: 'greater_than', label: 'greater than' },
  { value: 'less_than', label: 'less than' },
  { value: 'is_set', label: 'is set' },
  { value: 'is_empty', label: 'is empty' },
]

const ACTION_TYPES: { value: ActionType; label: string }[] = [
  { value: 'route_to', label: 'Route to' },
  { value: 'notify', label: 'Notify' },
  { value: 'set_status', label: 'Set status' },
  { value: 'require_approval', label: 'Require approval' },
  { value: 'block', label: 'Block' },
]

const ruleSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string(),
  triggerDomain: z.string().min(1, 'Domain is required'),
  priority: z.coerce.number().int().min(1).max(1000),
})
type RuleFormValues = z.infer<typeof ruleSchema>

function emptyCondition(): RuleCondition {
  return { field: '', operator: 'equals', value: '' }
}

function emptyAction(): RuleAction {
  return { type: 'route_to', target: '' }
}

// ── Local-only demo rules shown when backend is unavailable ──────────────────
const _DEMO_RULES: RoutingRule[] = [
  {
    id: 'demo-1',
    name: 'High-value procurement alert',
    description: 'Flag procurement items over $50k for admin review',
    enabled: true,
    priority: 10,
    triggerDomain: 'procurement',
    conditions: [{ field: 'amount', operator: 'greater_than', value: '50000' }],
    actions: [{ type: 'require_approval', target: 'admin' }, { type: 'notify', target: 'finance_director' }],
    hitCount: 12,
    lastTriggeredAt: new Date(Date.now() - 86400000).toISOString(),
    createdAt: new Date(Date.now() - 30 * 86400000).toISOString(),
  },
  {
    id: 'demo-2',
    name: 'PRR SLA breach block',
    description: 'Block auto-close when SLA is breached and notes are missing',
    enabled: true,
    priority: 5,
    triggerDomain: 'records',
    conditions: [
      { field: 'sla_breached', operator: 'equals', value: 'true' },
      { field: 'notes', operator: 'is_empty', value: '' },
    ],
    actions: [{ type: 'block', target: 'close' }],
    hitCount: 3,
    createdAt: new Date(Date.now() - 14 * 86400000).toISOString(),
  },
]

// ── Client-side rule evaluator for simulator ─────────────────────────────────
function evaluateRule(rule: RoutingRule, payload: Record<string, unknown>): boolean {
  if (!rule.enabled) return false
  return rule.conditions.every(cond => {
    const raw = payload[cond.field]
    const val = raw !== undefined && raw !== null ? String(raw) : ''
    switch (cond.operator) {
      case 'equals':       return val === cond.value
      case 'not_equals':   return val !== cond.value
      case 'contains':     return val.includes(cond.value)
      case 'greater_than': return !isNaN(Number(val)) && Number(val) > Number(cond.value)
      case 'less_than':    return !isNaN(Number(val)) && Number(val) < Number(cond.value)
      case 'is_set':       return val !== ''
      case 'is_empty':     return val === ''
      default:             return false
    }
  })
}

// ── Sub-components ────────────────────────────────────────────────────────────

function RuleRow({ rule, onToggle, isPending }: { rule: RoutingRule; onToggle: () => void; isPending: boolean }) {
  const [expanded, setExpanded] = useState(false)
  return (
    <div className={cn('rounded-lg border bg-card transition-colors', !rule.enabled && 'opacity-60')}>
      <div
        className="flex items-center gap-3 px-4 py-3 cursor-pointer select-none"
        onClick={() => setExpanded(p => !p)}
      >
        <button
          className="shrink-0"
          onClick={e => { e.stopPropagation(); onToggle() }}
          disabled={isPending}
          aria-label={rule.enabled ? 'Disable rule' : 'Enable rule'}
        >
          {rule.enabled
            ? <ToggleRight size={22} weight="fill" className="text-primary" />
            : <ToggleLeft size={22} className="text-muted-foreground" />}
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium truncate">{rule.name}</span>
            <Badge variant="outline" className="text-[10px] capitalize shrink-0">{rule.triggerDomain}</Badge>
          </div>
          <p className="text-xs text-muted-foreground truncate mt-0.5">{rule.description}</p>
        </div>
        <div className="flex items-center gap-4 shrink-0 text-xs text-muted-foreground">
          <span>P{rule.priority}</span>
          <span>{rule.conditions.length} cond</span>
          <span>{rule.actions.length} act</span>
          <span>{rule.hitCount} hits</span>
          {expanded ? <CaretUp size={14} /> : <CaretDown size={14} />}
        </div>
      </div>
      {expanded && (
        <div className="border-t px-4 py-3 grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div>
            <div className="font-semibold text-muted-foreground uppercase tracking-wide mb-2">Conditions</div>
            <div className="space-y-1">
              {rule.conditions.map((c, i) => (
                <div key={i} className="flex items-center gap-1.5 bg-muted/30 rounded px-2 py-1">
                  <span className="font-mono text-foreground">{c.field}</span>
                  <span className="text-muted-foreground">{c.operator.replace('_', ' ')}</span>
                  {c.value && <span className="font-mono text-primary">{c.value}</span>}
                </div>
              ))}
              {rule.conditions.length === 0 && <span className="text-muted-foreground italic">Always matches</span>}
            </div>
          </div>
          <div>
            <div className="font-semibold text-muted-foreground uppercase tracking-wide mb-2">Actions</div>
            <div className="space-y-1">
              {rule.actions.map((a, i) => (
                <div key={i} className="flex items-center gap-1.5 bg-muted/30 rounded px-2 py-1">
                  <span className="capitalize text-foreground">{a.type.replace('_', ' ')}</span>
                  {a.target && <span className="text-muted-foreground">→ {a.target}</span>}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Main panel ────────────────────────────────────────────────────────────────

export function RoutingEnginePanel({ onBack }: { onBack: () => void }) {
  const { data: remoteRules, isLoading } = useRoutingRules()
  const createRule = useCreateRule()
  const toggleRule = useToggleRule()

  // Fall back to empty list if backend is unavailable
  const [localRules, setLocalRules] = useState<RoutingRule[]>([])
  const rules: RoutingRule[] = remoteRules ?? localRules

  // New rule dialog state
  const [newRuleOpen, setNewRuleOpen] = useState(false)
  const [conditions, setConditions] = useState<RuleCondition[]>([emptyCondition()])
  const [actions, setActions] = useState<RuleAction[]>([emptyAction()])

  const { register, handleSubmit, reset, setValue, watch, formState: { errors } } = useForm<RuleFormValues>({
    resolver: zodResolver(ruleSchema),
    defaultValues: { name: '', description: '', triggerDomain: 'all', priority: 50 },
  })

  // Simulator state
  const [simDomain, setSimDomain] = useState('all')
  const [simPayload, setSimPayload] = useState('{\n  "amount": "60000",\n  "status": "new"\n}')
  const [simResults, setSimResults] = useState<{ rule: RoutingRule; fired: boolean }[] | null>(null)

  function openNewRule() {
    reset()
    setConditions([emptyCondition()])
    setActions([emptyAction()])
    setNewRuleOpen(true)
  }

  async function handleCreateRule(values: RuleFormValues) {
    const newRule: Omit<RoutingRule, 'id' | 'hitCount' | 'createdAt' | 'lastTriggeredAt'> = {
      ...values,
      enabled: true,
      conditions,
      actions,
    }
    try {
      await createRule.mutateAsync(newRule)
      toast.success('Rule created')
      setNewRuleOpen(false)
    } catch {
      // backend unavailable — add locally
      const localRule: RoutingRule = {
        ...newRule,
        id: `local-${Date.now()}`,
        hitCount: 0,
        createdAt: new Date().toISOString(),
      }
      setLocalRules(prev => [...prev, localRule])
      toast.success('Rule created (local)')
      setNewRuleOpen(false)
    }
  }

  function handleToggle(id: string) {
    toggleRule.mutate(id, {
      onError: () => {
        // toggle locally if backend unavailable
        setLocalRules(prev => prev.map(r => r.id === id ? { ...r, enabled: !r.enabled } : r))
      },
    })
  }

  function runSimulator() {
    let payload: Record<string, unknown> = {}
    try {
      payload = JSON.parse(simPayload)
    } catch {
      toast.error('Invalid JSON payload')
      return
    }
    const domainRules = simDomain === 'all' ? rules : rules.filter(r => r.triggerDomain === simDomain || r.triggerDomain === 'all')
    setSimResults(
      domainRules
        .sort((a, b) => a.priority - b.priority)
        .map(rule => ({ rule, fired: evaluateRule(rule, payload) }))
    )
  }

  // Condition helpers
  function updateCondition(i: number, patch: Partial<RuleCondition>) {
    setConditions(prev => prev.map((c, idx) => idx === i ? { ...c, ...patch } : c))
  }
  function addCondition() { setConditions(prev => [...prev, emptyCondition()]) }
  function removeCondition(i: number) { setConditions(prev => prev.filter((_, idx) => idx !== i)) }

  // Action helpers
  function updateAction(i: number, patch: Partial<RuleAction>) {
    setActions(prev => prev.map((a, idx) => idx === i ? { ...a, ...patch } : a))
  }
  function addAction() { setActions(prev => [...prev, emptyAction()]) }
  function removeAction(i: number) { setActions(prev => prev.filter((_, idx) => idx !== i)) }

  return (
    <div className="h-full flex flex-col overflow-hidden" data-tool-panel>
      {/* Header */}
      <div className="shrink-0 flex items-center gap-3 px-5 py-4 border-b bg-background/80 backdrop-blur sticky top-0 z-10">
        <Button variant="ghost" size="icon" onClick={onBack} aria-label="Back">
          <ArrowLeft size={18} />
        </Button>
        <GitBranch size={20} className="text-primary" />
        <div className="flex-1 min-w-0">
          <h1 className="text-sm font-semibold truncate">Routing Engine</h1>
          <p className="text-xs text-muted-foreground">Set rules for how work gets automatically routed, approved, or blocked</p>
        </div>
        <Button size="sm" onClick={openNewRule} className="gap-1.5">
          <Plus size={14} />
          New Rule
        </Button>
      </div>

      {/* Body */}
      <div className="flex-1 min-h-0 overflow-auto">
        <div className="max-w-4xl mx-auto p-5">
          <Tabs defaultValue="rules">
            <TabsList className="mb-4">
              <TabsTrigger value="rules" className="gap-1.5">
                <ListBullets size={14} />
                Rules
              </TabsTrigger>
              <TabsTrigger value="simulator" className="gap-1.5">
                <Play size={14} />
                Simulator
              </TabsTrigger>
            </TabsList>

            {/* ── Rules tab ── */}
            <TabsContent value="rules" className="space-y-3">
              {isLoading && (
                <p className="text-sm text-muted-foreground py-8 text-center">Loading rules…</p>
              )}
              {!isLoading && rules.length === 0 && (
                <div className="flex flex-col items-center gap-3 py-16 text-center">
                  <GitBranch size={36} className="text-muted-foreground/40" />
                  <p className="text-sm text-muted-foreground">No rules yet. Rules automatically route, notify, or block actions based on conditions — like flagging a procurement over $50k for admin approval.</p>
                  <Button size="sm" onClick={openNewRule}>
                    <Plus size={14} className="mr-1" />
                    Create your first rule
                  </Button>
                </div>
              )}
              {rules
                .slice()
                .sort((a, b) => a.priority - b.priority)
                .map(rule => (
                  <RuleRow
                    key={rule.id}
                    rule={rule}
                    onToggle={() => handleToggle(rule.id)}
                    isPending={toggleRule.isPending}
                  />
                ))}
            </TabsContent>

            {/* ── Simulator tab ── */}
            <TabsContent value="simulator" className="space-y-4">
              <div className="rounded-lg border bg-card p-4 space-y-4">
                <div className="flex items-center gap-2">
                  <Info size={14} className="text-muted-foreground shrink-0" />
                  <p className="text-xs text-muted-foreground">
                    Test a rule against sample data to see what actions it would trigger. Paste a JSON payload and select a domain — this runs entirely in your browser.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Domain filter</Label>
                    <Select value={simDomain} onValueChange={setSimDomain}>
                      <SelectTrigger>
                        <SelectValue placeholder="All domains" />
                      </SelectTrigger>
                      <SelectContent>
                        {DOMAINS.map(d => (
                          <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs">JSON payload</Label>
                  <Textarea
                    value={simPayload}
                    onChange={e => setSimPayload(e.target.value)}
                    rows={6}
                    className="font-mono text-xs resize-none"
                    placeholder='{ "field": "value" }'
                  />
                </div>

                <Button onClick={runSimulator} className="gap-1.5 w-full sm:w-auto">
                  <Play size={14} />
                  Evaluate
                </Button>
              </div>

              {simResults && (
                <div className="rounded-lg border bg-card p-4 space-y-3">
                  <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Results</div>
                  {simResults.length === 0 && (
                    <p className="text-sm text-muted-foreground">No rules match this domain filter.</p>
                  )}
                  {simResults.map(({ rule, fired }) => (
                    <div
                      key={rule.id}
                      className={cn(
                        'rounded-lg border px-3 py-2.5 text-xs',
                        fired ? 'border-primary/30 bg-primary/5' : 'border-border bg-muted/20 opacity-60',
                      )}
                    >
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className={cn('font-semibold', fired ? 'text-primary' : 'text-muted-foreground')}>
                          {fired ? '✓ Fires' : '✗ No match'}
                        </span>
                        <span className="font-medium text-foreground">{rule.name}</span>
                        <Badge variant="outline" className="text-[10px] capitalize">{rule.triggerDomain}</Badge>
                      </div>
                      {fired && rule.actions.map((a, i) => (
                        <div key={i} className="text-muted-foreground pl-4">
                          → <span className="capitalize">{a.type.replace('_', ' ')}</span>
                          {a.target && <span className="text-primary"> {a.target}</span>}
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* New Rule Dialog */}
      <Dialog open={newRuleOpen} onOpenChange={open => { if (!open) setNewRuleOpen(false) }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>New Routing Rule</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(handleCreateRule)} className="space-y-5">
            {/* Basic fields */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Rule name</Label>
                <Input {...register('name')} placeholder="e.g. High-value procurement alert" />
                {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label>Priority</Label>
                <Input {...register('priority')} type="number" min={1} max={1000} placeholder="50" />
                {errors.priority && <p className="text-xs text-destructive">{errors.priority.message}</p>}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Description</Label>
              <Input {...register('description')} placeholder="What does this rule do?" />
            </div>

            <div className="space-y-1.5">
              <Label>Trigger domain</Label>
              <Select
                value={watch('triggerDomain')}
                onValueChange={v => setValue('triggerDomain', v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select domain" />
                </SelectTrigger>
                <SelectContent>
                  {DOMAINS.map(d => (
                    <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.triggerDomain && <p className="text-xs text-destructive">{errors.triggerDomain.message}</p>}
            </div>

            {/* Conditions */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Conditions</Label>
                <Button type="button" variant="ghost" size="sm" onClick={addCondition} className="h-7 text-xs gap-1">
                  <Plus size={12} /> Add
                </Button>
              </div>
              <div className="space-y-2">
                {conditions.map((cond, i) => (
                  <div key={i} className="flex items-center gap-2 bg-muted/30 rounded-lg p-2">
                    <Input
                      className="flex-1 h-8 text-xs font-mono"
                      placeholder="field"
                      value={cond.field}
                      onChange={e => updateCondition(i, { field: e.target.value })}
                    />
                    <Select value={cond.operator} onValueChange={v => updateCondition(i, { operator: v as ConditionOperator })}>
                      <SelectTrigger className="h-8 text-xs w-[130px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {CONDITION_OPERATORS.map(op => (
                          <SelectItem key={op.value} value={op.value}>{op.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {cond.operator !== 'is_set' && cond.operator !== 'is_empty' && (
                      <Input
                        className="flex-1 h-8 text-xs font-mono"
                        placeholder="value"
                        value={cond.value}
                        onChange={e => updateCondition(i, { value: e.target.value })}
                      />
                    )}
                    <Button type="button" variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => removeCondition(i)}>
                      <Trash size={13} className="text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>

            {/* Actions */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Actions</Label>
                <Button type="button" variant="ghost" size="sm" onClick={addAction} className="h-7 text-xs gap-1">
                  <Plus size={12} /> Add
                </Button>
              </div>
              <div className="space-y-2">
                {actions.map((action, i) => (
                  <div key={i} className="flex items-center gap-2 bg-muted/30 rounded-lg p-2">
                    <Select value={action.type} onValueChange={v => updateAction(i, { type: v as ActionType })}>
                      <SelectTrigger className="h-8 text-xs w-[160px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ACTION_TYPES.map(at => (
                          <SelectItem key={at.value} value={at.value}>{at.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input
                      className="flex-1 h-8 text-xs"
                      placeholder="target (role, queue, status…)"
                      value={action.target}
                      onChange={e => updateAction(i, { target: e.target.value })}
                    />
                    <Button type="button" variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => removeAction(i)}>
                      <Trash size={13} className="text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setNewRuleOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={createRule.isPending} className="gap-1.5">
                <FloppyDisk size={14} />
                {createRule.isPending ? 'Saving…' : 'Create Rule'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
