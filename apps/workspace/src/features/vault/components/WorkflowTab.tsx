import { useState, type Dispatch, type SetStateAction } from 'react'
import type { VaultModuleSettings, WorkflowConfig, WorkflowTimer, WorkflowEmailTemplate, WorkflowTrigger, WorkflowRecipient } from '../types'
import { uuid } from '../utils/vaultHelpers'
import { defaultWorkflow } from './workflowDefaults'

export function WorkflowTab({ s, setS, moduleId }: {
  s: VaultModuleSettings
  setS: Dispatch<SetStateAction<VaultModuleSettings>>
  moduleId: string
}) {
  const workflow = s.workflow ?? defaultWorkflow(moduleId)
  const [editingEmail, setEditingEmail] = useState<string | null>(null)
  const [addTimerOpen, setAddTimerOpen] = useState(false)
  const [newTimer, setNewTimer] = useState<Partial<WorkflowTimer>>({
    businessDays: 10, statutory: false, startEvent: 'CASE_CREATED', warningDaysBefore: 3, onMiss: ['SEND_EMAIL']
  })

  function updateWorkflow(patch: Partial<WorkflowConfig>) {
    setS(prev => ({ ...prev, workflow: { ...(prev.workflow ?? defaultWorkflow(moduleId)), ...patch } }))
  }

  function toggleTimerMiss(timerId: string, action: WorkflowTimer['onMiss'][number]) {
    updateWorkflow({
      timers: workflow.timers.map(t =>
        t.id === timerId
          ? { ...t, onMiss: t.onMiss.includes(action) ? t.onMiss.filter(a => a !== action) : [...t.onMiss, action] }
          : t
      )
    })
  }

  function updateTemplate(id: string, patch: Partial<WorkflowEmailTemplate>) {
    updateWorkflow({
      emailTemplates: workflow.emailTemplates.map(t => t.id === id ? { ...t, ...patch } : t)
    })
  }

  function addTemplate() {
    const tpl: WorkflowEmailTemplate = {
      id: uuid(), trigger: 'CUSTOM_TIMER', toRecipient: 'RAO',
      subject: 'Notification — {{caseNumber}}',
      body: 'Dear {{raoName}},\n\nThis is a workflow notification for case {{caseNumber}}.\n\nTown of {{town}}',
      enabled: true,
    }
    updateWorkflow({ emailTemplates: [...workflow.emailTemplates, tpl] })
    setEditingEmail(tpl.id)
  }

  function removeTemplate(id: string) {
    updateWorkflow({ emailTemplates: workflow.emailTemplates.filter(t => t.id !== id) })
  }

  function addTimer() {
    if (!newTimer.name || !newTimer.businessDays) return
    const t: WorkflowTimer = {
      id: uuid(), name: newTimer.name!, businessDays: newTimer.businessDays!,
      statutory: false, startEvent: newTimer.startEvent ?? 'CASE_CREATED',
      warningDaysBefore: newTimer.warningDaysBefore ?? 3,
      onMiss: newTimer.onMiss ?? ['SEND_EMAIL'],
    }
    updateWorkflow({ timers: [...workflow.timers, t] })
    setAddTimerOpen(false)
    setNewTimer({ businessDays: 10, statutory: false, startEvent: 'CASE_CREATED', warningDaysBefore: 3, onMiss: ['SEND_EMAIL'] })
  }

  function removeTimer(id: string) {
    updateWorkflow({ timers: workflow.timers.filter(t => t.id !== id) })
  }

  const TRIGGER_LABELS: Record<string, string> = {
    INTAKE_RECEIVED: 'Intake Received',
    STAGE_CHANGE: 'Stage Change',
    T10_WARNING: 'T10 Warning',
    T10_MISSED: 'T10 Missed',
    T25_WARNING: 'T25 Warning',
    APPROVAL_ISSUED: 'Approval Issued',
    CASE_CLOSED: 'Case Closed',
    CUSTOM_TIMER: 'Custom Timer',
  }
  const RECIPIENT_LABELS: Record<string, string> = {
    REQUESTER: 'Requester', RAO: 'Records Officer', SUPERVISOR: 'Supervisor of Records', CUSTOM: 'Custom Email',
  }
  const MISS_LABELS: Record<string, string> = {
    WAIVE_FEES: 'Waive Fees', AUTO_ESCALATE: 'Auto-Escalate', SEND_EMAIL: 'Send Email', BLOCK_CLOSE: 'Block Close',
  }
  const MISS_COLORS: Record<string, string> = {
    WAIVE_FEES: 'bg-red-950/50 border-red-800/60 text-red-400',
    AUTO_ESCALATE: 'bg-orange-950/50 border-orange-800/60 text-orange-400',
    SEND_EMAIL: 'bg-blue-950/50 border-blue-800/60 text-blue-400',
    BLOCK_CLOSE: 'bg-yellow-950/50 border-yellow-800/60 text-yellow-400',
  }

  const editingTpl = workflow.emailTemplates.find(t => t.id === editingEmail)

  return (
    <div className="space-y-8">

      {/* ── TIMERS ── */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-semibold text-foreground">Deadline Timers</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Statutory timers are locked. Custom timers can be added.</p>
          </div>
          <button onClick={() => setAddTimerOpen(v => !v)}
            className="text-xs px-3 py-1.5 bg-muted hover:bg-muted text-foreground rounded-lg transition-colors">
            + Add Timer
          </button>
        </div>

        {addTimerOpen && (
          <div className="mb-4 bg-card border border-indigo-600/40 rounded-xl p-4 space-y-3">
            <div className="text-xs font-semibold text-indigo-400 uppercase tracking-wider">New Custom Timer</div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-muted-foreground mb-1">Name</label>
                <input value={newTimer.name ?? ''} onChange={e => setNewTimer(p => ({ ...p, name: e.target.value }))}
                  placeholder="e.g. Department Review"
                  className="w-full bg-card border border-border rounded-lg px-3 py-1.5 text-sm text-foreground placeholder-slate-600 focus:outline-none focus:border-indigo-500" />
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1">Business Days</label>
                <input type="number" min={1} max={365} value={newTimer.businessDays ?? 10}
                  onChange={e => setNewTimer(p => ({ ...p, businessDays: parseInt(e.target.value) }))}
                  className="w-full bg-card border border-border rounded-lg px-3 py-1.5 text-sm text-foreground focus:outline-none focus:border-indigo-500" />
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1">Starts On</label>
                <select value={newTimer.startEvent} onChange={e => setNewTimer(p => ({ ...p, startEvent: e.target.value as WorkflowTimer['startEvent'] }))}
                  className="w-full bg-card border border-border rounded-lg px-3 py-1.5 text-sm text-foreground focus:outline-none focus:border-indigo-500">
                  <option value="CASE_CREATED">Case Created</option>
                  <option value="STAGE_ENTERED">Stage Entered</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1">Warning (days before)</label>
                <input type="number" min={0} max={30} value={newTimer.warningDaysBefore ?? 3}
                  onChange={e => setNewTimer(p => ({ ...p, warningDaysBefore: parseInt(e.target.value) }))}
                  className="w-full bg-card border border-border rounded-lg px-3 py-1.5 text-sm text-foreground focus:outline-none focus:border-indigo-500" />
              </div>
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-2">On Miss Actions</label>
              <div className="flex gap-2 flex-wrap">
                {(['WAIVE_FEES', 'AUTO_ESCALATE', 'SEND_EMAIL', 'BLOCK_CLOSE'] as const).map(a => {
                  const active = (newTimer.onMiss ?? []).includes(a)
                  return (
                    <button key={a} onClick={() => setNewTimer(p => ({
                      ...p,
                      onMiss: active ? (p.onMiss ?? []).filter(x => x !== a) : [...(p.onMiss ?? []), a]
                    }))} className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${active ? MISS_COLORS[a] : 'border-border text-muted-foreground hover:text-foreground/80'}`}>
                      {MISS_LABELS[a]}
                    </button>
                  )
                })}
              </div>
            </div>
            <div className="flex gap-2 pt-1">
              <button onClick={addTimer} className="text-xs px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-colors">Add Timer</button>
              <button onClick={() => setAddTimerOpen(false)} className="text-xs px-3 py-1.5 text-muted-foreground hover:text-foreground/80 transition-colors">Cancel</button>
            </div>
          </div>
        )}

        <div className="space-y-3">
          {workflow.timers.map(timer => (
            <div key={timer.id} className={`rounded-xl border p-4 ${timer.statutory ? 'bg-indigo-50 border-indigo-200' : 'bg-card border-border'}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-white text-sm">{timer.name}</span>
                    {timer.statutory && (
                      <span className="text-[10px] px-1.5 py-0.5 bg-red-950/50 border border-red-800/50 text-red-400 rounded-full">🔒 Statutory</span>
                    )}
                  </div>
                  {timer.statutorycitation && (
                    <div className="text-xs text-muted-foreground mt-0.5">{timer.statutorycitation}</div>
                  )}
                  <div className="flex gap-4 mt-2 text-xs text-muted-foreground">
                    <span><span className="text-white font-medium">{timer.businessDays}</span> business days</span>
                    <span>Starts: <span className="text-white">{timer.startEvent === 'CASE_CREATED' ? 'Case Created' : `Stage: ${timer.startStage ?? '—'}`}</span></span>
                    <span>Warning: <span className="text-white">{timer.warningDaysBefore}d before</span></span>
                  </div>
                  <div className="flex gap-1.5 mt-2 flex-wrap">
                    {(['WAIVE_FEES', 'AUTO_ESCALATE', 'SEND_EMAIL', 'BLOCK_CLOSE'] as const).map(a => {
                      const active = timer.onMiss.includes(a)
                      return (
                        <button key={a}
                          disabled={timer.statutory}
                          onClick={() => !timer.statutory && toggleTimerMiss(timer.id, a)}
                          className={`text-xs px-2 py-0.5 rounded-full border transition-colors ${
                            active ? MISS_COLORS[a] : 'border-border text-muted-foreground'
                          } ${timer.statutory ? 'opacity-60 cursor-default' : 'hover:border-slate-500'}`}>
                          {MISS_LABELS[a]}
                        </button>
                      )
                    })}
                  </div>
                </div>
                {!timer.statutory && (
                  <button onClick={() => removeTimer(timer.id)} className="text-muted-foreground hover:text-red-400 transition-colors text-xs">✕</button>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── EMAIL TEMPLATES ── */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-semibold text-foreground">Email Templates</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Variables: {`{{requesterName}} {{caseNumber}} {{town}} {{deadline}} {{raoName}} {{stage}}`}</p>
          </div>
          <button onClick={addTemplate}
            className="text-xs px-3 py-1.5 bg-muted hover:bg-muted text-foreground rounded-lg transition-colors">
            + Add Template
          </button>
        </div>

        {editingTpl && (
          <div className="mb-4 bg-card border border-indigo-600/40 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-xs font-semibold text-indigo-400 uppercase tracking-wider">Editing: {TRIGGER_LABELS[editingTpl.trigger]}</div>
              <button onClick={() => setEditingEmail(null)} className="text-muted-foreground hover:text-foreground/80 text-xs">✕ Close</button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-muted-foreground mb-1">Trigger</label>
                <select value={editingTpl.trigger}
                  onChange={e => updateTemplate(editingTpl.id, { trigger: e.target.value as WorkflowTrigger })}
                  className="w-full bg-card border border-border rounded-lg px-3 py-1.5 text-sm text-foreground focus:outline-none focus:border-indigo-500">
                  {Object.entries(TRIGGER_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1">Send To</label>
                <select value={editingTpl.toRecipient}
                  onChange={e => updateTemplate(editingTpl.id, { toRecipient: e.target.value as WorkflowRecipient })}
                  className="w-full bg-card border border-border rounded-lg px-3 py-1.5 text-sm text-foreground focus:outline-none focus:border-indigo-500">
                  {Object.entries(RECIPIENT_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
              {editingTpl.toRecipient === 'CUSTOM' && (
                <div className="col-span-2">
                  <label className="block text-xs text-muted-foreground mb-1">Custom Email</label>
                  <input value={editingTpl.customEmail ?? ''} onChange={e => updateTemplate(editingTpl.id, { customEmail: e.target.value })}
                    placeholder="email@town.gov"
                    className="w-full bg-card border border-border rounded-lg px-3 py-1.5 text-sm text-foreground focus:outline-none focus:border-indigo-500" />
                </div>
              )}
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Subject</label>
              <input value={editingTpl.subject} onChange={e => updateTemplate(editingTpl.id, { subject: e.target.value })}
                className="w-full bg-card border border-border rounded-lg px-3 py-1.5 text-sm text-foreground focus:outline-none focus:border-indigo-500" />
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Body</label>
              <textarea value={editingTpl.body} onChange={e => updateTemplate(editingTpl.id, { body: e.target.value })} rows={8}
                className="w-full bg-card border border-border rounded-lg px-3 py-2 text-sm text-foreground font-mono focus:outline-none focus:border-indigo-500 resize-y" />
            </div>
          </div>
        )}

        <div className="space-y-2">
          {workflow.emailTemplates.map(tpl => (
            <div key={tpl.id} className="flex items-center gap-3 bg-card border border-border rounded-xl px-4 py-3">
              <button
                onClick={() => updateTemplate(tpl.id, { enabled: !tpl.enabled })}
                className={`flex-shrink-0 w-8 h-4 rounded-full border transition-colors relative ${tpl.enabled ? 'bg-indigo-600 border-indigo-500' : 'bg-slate-700 border-border'}`}>
                <span className={`absolute top-0.5 w-3 h-3 rounded-full bg-card transition-all ${tpl.enabled ? 'left-4' : 'left-0.5'}`} />
              </button>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className={`text-xs px-1.5 py-0.5 rounded border ${tpl.enabled ? 'text-indigo-400 border-indigo-800/50 bg-indigo-950/40' : 'text-muted-foreground border-border'}`}>
                    {TRIGGER_LABELS[tpl.trigger]}
                  </span>
                  <span className="text-xs text-muted-foreground">→ {RECIPIENT_LABELS[tpl.toRecipient]}{tpl.customEmail ? ` (${tpl.customEmail})` : ''}</span>
                </div>
                <div className="text-xs text-foreground mt-0.5 truncate">{tpl.subject}</div>
              </div>
              <div className="flex gap-1 flex-shrink-0">
                <button onClick={() => setEditingEmail(editingEmail === tpl.id ? null : tpl.id)}
                  className="text-xs px-2 py-1 text-muted-foreground hover:text-foreground/80 border border-border hover:border-border bg-card rounded transition-colors">
                  Edit
                </button>
                <button onClick={() => removeTemplate(tpl.id)}
                  className="text-xs px-2 py-1 text-muted-foreground hover:text-red-400 border border-border hover:border-red-800/50 rounded transition-colors">
                  ✕
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

    </div>
  )
}
