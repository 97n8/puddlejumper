import { useState, useEffect } from 'react'
import { ArrowLeft, Warning, Envelope, CaretRight, CheckCircle, Shield, Plus, Lock, FileText, Link, ListChecks } from '@phosphor-icons/react'
import { toast } from 'sonner'
import type { VaultCase, VaultModuleSettings, CaseAsset } from '../types'
import type { CaseTask } from '@/services/pjApi'
import { uuid, fmtTs, fmtDate, appendAudit, deadlineBadge } from '../utils/vaultHelpers'
import { ApprovalsTab } from './ApprovalsTab'
import { STAGE_HELP } from '../utils/staffHelp'
import { generateFullDisclosureLetter, generatePartialDisclosureLetter, generateDenialLetter, generateExtensionLetter } from '../utils/generateFormTemplates'
import { generateBossHTML } from '../utils/generateBossHTML'
import { pjApi } from '@/services/pjApi'
import { useCaseDetail, type DetailTab } from '../hooks/useCaseDetail'

export function CaseDetail({ vaultCase, settings, actor, connectorProvider, onUpdate, onBack }: {
  vaultCase: VaultCase
  settings: VaultModuleSettings
  actor: string
  connectorProvider: string
  onUpdate: (c: VaultCase) => void
  onBack: () => void
}) {
  const {
    tab, setTab,
    stageForm, setStageForm: _setStageForm,
    scopeEdit, setScopeEdit,
    newScope, setNewScope,
    scopeReason, setScopeReason,
    addAsset, setAddAsset,
    assetForm, setAssetForm,
    closeDialog, setCloseDialog,
    closureReason, setClosureReason,
    t25Gate, setT25Gate,
    backupStatus,
    saving,
    builderTitle, setBuilderTitle,
    builderContent, setBuilderContent,
    builderTemplate, setBuilderTemplate,
    builderSaveStatus, setBuilderSaveStatus,
    builderSaving, setBuilderSaving,
    mod, meta, stageDef, currentStageIdx, isClosed,
    update,
    setField,
    saveStageData,
    markDeadlineMet,
    advanceStage,
    closeCase,
    submitAsset,
    lockAsset,
    updateScope,
    mailtoRAO,
  } = useCaseDetail(vaultCase, onUpdate, actor, settings, connectorProvider)

  // ── Case Tasks ────────────────────────────────────────────────────────────
  const [tasks, setTasks] = useState<CaseTask[]>([])
  const [tasksLoading, setTasksLoading] = useState(false)
  const [taskForm, setTaskForm] = useState({ title: '', description: '', assigned_side: 'A' as 'A' | 'B', due_at: '' })
  const [addTask, setAddTask] = useState(false)
  const [taskSaving, setTaskSaving] = useState(false)

  useEffect(() => {
    if (tab !== 'tasks') return
    setTasksLoading(true)
    pjApi.docs.listTasks(vaultCase.id).then(r => setTasks(r.tasks ?? [])).catch(() => {}).finally(() => setTasksLoading(false))
  }, [tab, vaultCase.id])

  async function submitTask() {
    if (!taskForm.title.trim()) return
    setTaskSaving(true)
    try {
      const r = await pjApi.docs.createTask(vaultCase.id, {
        title: taskForm.title.trim(),
        description: taskForm.description.trim() || undefined,
        assigned_side: taskForm.assigned_side,
        due_at: taskForm.due_at || undefined,
      })
      setTasks(prev => [r.task, ...prev])
      setTaskForm({ title: '', description: '', assigned_side: 'A', due_at: '' })
      setAddTask(false)
    } catch { toast.error('Failed to create task') }
    finally { setTaskSaving(false) }
  }

  async function finishTask(taskId: string, status: 'done' | 'cancelled') {
    try {
      const r = await pjApi.docs.updateTask(vaultCase.id, taskId, { status })
      setTasks(prev => prev.map(t => t.id === taskId ? r.task : t))
    } catch { toast.error('Failed to update task') }
  }

  return (
    <div className="flex flex-col flex-1 min-h-0 bg-background">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-border flex-shrink-0 bg-card shadow-sm">
        <div className="flex items-center gap-3">
          <button aria-label="Go back" onClick={onBack} className="text-muted-foreground hover:text-foreground/80 transition-colors"><ArrowLeft size={18} /></button>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono font-bold text-indigo-600 text-sm">{vaultCase.caseNumber}</span>
              <button
                onClick={() => {
                  const url = `${window.location.origin}/track?c=${encodeURIComponent(vaultCase.caseNumber)}`
                  navigator.clipboard.writeText(url).then(() => toast.success('Tracking link copied'))
                }}
                title="Copy public tracking link"
                className="text-muted-foreground hover:text-indigo-600 transition-colors p-0.5 rounded"
              >
                <Link size={13} />
              </button>
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${isClosed ? 'bg-muted text-muted-foreground' : 'bg-indigo-50 text-indigo-600 ring-1 ring-inset ring-indigo-200'}`}>{vaultCase.currentStage}</span>
              {vaultCase.closureReason && <span className="text-xs text-muted-foreground">{vaultCase.closureReason}</span>}
              {vaultCase.enforcementFlags.feesAllowed === false && (
                <span className="flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full bg-red-50 text-red-600 border border-red-200">
                  ⚠ FEES PROHIBITED
                </span>
              )}
              {/* Retention lifecycle indicator */}
              {(() => {
                const retYears = settings.retentionYears ?? meta?.defaultRetentionYears ?? 0
                if (!retYears) return null
                const closedTs = vaultCase.closedAt
                if (closedTs) {
                  const dispositionDate = new Date(closedTs)
                  dispositionDate.setFullYear(dispositionDate.getFullYear() + retYears)
                  const daysLeft = Math.ceil((dispositionDate.getTime() - Date.now()) / 86400000)
                  return (
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                      daysLeft < 90
                        ? 'bg-amber-50 text-amber-700 border border-amber-200'
                        : 'bg-muted text-muted-foreground'
                    }`}>
                      📁 Retain until {dispositionDate.getFullYear()} ({retYears}yr)
                    </span>
                  )
                }
                return (
                  <span className="text-[10px] text-muted-foreground">
                    📁 {retYears}yr retention
                  </span>
                )
              })()}
            </div>
            <div className="text-xs text-muted-foreground mt-0.5">
              {Object.values(vaultCase.subject).filter(Boolean).slice(0, 2).join(' · ')}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {!isClosed && (
            <>
              <button
                onClick={() => mailtoRAO(`[${vaultCase.caseNumber}] Action Required`, `Case: ${vaultCase.caseNumber}\nStage: ${vaultCase.currentStage}\n\nPlease review this case.`)}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground/80 px-2 py-1.5 rounded border border-border hover:border-border bg-card transition-colors"
              >
                <Envelope size={13} /> Email Records Officer
              </button>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={advanceStage}
                  className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
                >
                  {currentStageIdx >= mod.stages.length - 2 ? 'Close Case' : `Advance → ${mod.stages[currentStageIdx + 1]}`}
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* T25 Gate Dialog */}
      {t25Gate.show && (
        <div className="flex-shrink-0 mx-6 mt-4 bg-amber-50 border border-amber-600 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <Warning size={20} className="text-amber-400 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <div className="font-semibold text-amber-300 mb-1">Extension Required Before Continuing</div>
              <p className="text-sm text-amber-200/80 mb-3">
                The 25-day response deadline is within 3 days. Under M.G.L. c. 66, §10, you must either obtain the requester's written agreement to extend the deadline, or file a petition with the Supervisor of Records — before advancing this case to Gathering.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setT25Gate({ show: false, agreed: true })
                    update(appendAudit(vaultCase, actor, 'UPDATE', 'T25 extension: Requester agreement obtained. Proceeding to Gathering.', { ruleApplied: 'M.G.L. c. 66, §10 — T25 extension with requester agreement' }))
                  }}
                  className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-sm font-medium transition-colors"
                >
                  ✓ Requester Agreed
                </button>
                <button
                  onClick={() => {
                    setT25Gate({ show: false, petitioned: true })
                    update(appendAudit(vaultCase, actor, 'ESCALATION', 'T25 extension: Petition filed with Supervisor of Records.', { ruleApplied: 'M.G.L. c. 66, §10 — T25 petition to Supervisor' }))
                  }}
                  className="px-3 py-1.5 bg-muted hover:bg-muted text-foreground rounded-lg text-sm font-medium transition-colors"
                >
                  Petition Filed
                </button>
                <button onClick={() => setT25Gate({ show: false })} className="px-3 py-1.5 text-muted-foreground hover:text-foreground/80 text-sm transition-colors">
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-border px-6 flex-shrink-0">
        {(['overview', 'stage', 'approvals', 'assets', 'builder', 'tasks', 'audit'] as DetailTab[]).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-3 text-sm font-medium capitalize border-b-2 transition-colors flex-shrink-0 flex items-center gap-1.5 ${tab === t ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-muted-foreground hover:text-foreground/80'}`}
          >
            {t === 'stage' ? `Stage: ${vaultCase.currentStage}` : t === 'builder' ? '✏️ Builder' : t === 'tasks' ? <><ListChecks size={14} /> Tasks</> : t.charAt(0).toUpperCase() + t.slice(1)}
            {t === 'approvals' && (vaultCase.approvals ?? []).length > 0 && (
              <span className="text-xs bg-muted text-muted-foreground rounded-full px-1.5 py-0.5">{(vaultCase.approvals ?? []).length}</span>
            )}
            {t === 'assets' && vaultCase.assets.length > 0 && (
              <span className="text-xs bg-muted text-muted-foreground rounded-full px-1.5 py-0.5">{vaultCase.assets.length}</span>
            )}
            {t === 'tasks' && tasks.filter(x => x.status === 'open').length > 0 && (
              <span className="text-xs bg-indigo-100 text-indigo-600 rounded-full px-1.5 py-0.5">{tasks.filter(x => x.status === 'open').length}</span>
            )}
            {t === 'audit' && (
              <span className="text-xs bg-muted text-muted-foreground rounded-full px-1.5 py-0.5">{vaultCase.auditLog.length}</span>
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 min-h-0 overflow-y-auto">

        {/* Overview Tab */}
        {tab === 'overview' && (
          <div className="max-w-3xl mx-auto px-6 py-6 space-y-6">
            {/* Identity */}
            <section>
              <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">Case Information</h3>
              <div className="bg-card border border-border rounded-xl p-4 grid grid-cols-2 gap-4 shadow-sm">
                {[
                  ['Case ID', <span className="font-mono text-xs">{vaultCase.id}</span>],
                  ['Case Number', <span className="font-semibold text-indigo-600 text-sm">{vaultCase.caseNumber}</span>],
                  ['Module', vaultCase.moduleId],
                  ['Case Type', vaultCase.caseType],
                  ['Created', fmtTs(vaultCase.createdAt)],
                  ['Created By', vaultCase.createdBy || '—'],
                  ['Assigned RAO', vaultCase.assignedRAO || <span className="text-muted-foreground italic">Unassigned</span>],
                  ['Closed', vaultCase.closedAt ? fmtTs(vaultCase.closedAt) : '—'],
                ].map(([label, value], i) => (
                  <div key={i}>
                    <div className="text-xs text-muted-foreground mb-0.5">{label}</div>
                    <div className="text-sm text-foreground">{value as React.ReactNode}</div>
                  </div>
                ))}
              </div>
            </section>

            {/* Subject */}
            <section>
              <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">Subject</h3>
              <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
                {Object.entries(vaultCase.subject).filter(([,v]) => v).map(([k, v]) => {
                  const field = mod.intakeFields.find(f => f.key === k)
                  return (
                    <div key={k} className="flex border-b border-border/80 last:border-0">
                      <div className="w-48 px-4 py-2.5 text-xs text-muted-foreground flex-shrink-0 border-r border-border/80">
                        {field?.label ?? k}
                      </div>
                      <div className="px-4 py-2.5 text-sm text-foreground">{v}</div>
                    </div>
                  )
                })}
              </div>
            </section>

            {/* Scope */}
            <section>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                  Scope — v{vaultCase.scopeVersion}
                </h3>
                {!isClosed && !scopeEdit && (
                  <button onClick={() => setScopeEdit(true)} className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors">
                    Update Scope
                  </button>
                )}
              </div>
              <div className="bg-card border border-border rounded-xl p-4 shadow-sm">
                {scopeEdit ? (
                  <div className="space-y-3">
                    <textarea rows={4} value={newScope} onChange={e => setNewScope(e.target.value)}
                      className="w-full bg-card border border-border text-foreground rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-200" />
                    <input type="text" placeholder="Reason for scope change (required)" value={scopeReason} onChange={e => setScopeReason(e.target.value)}
                      className="w-full bg-card border border-border text-foreground rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-200" />
                    <div className="flex gap-2">
                      <button onClick={updateScope} className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm transition-colors">Save New Version</button>
                      <button onClick={() => { setScopeEdit(false); setNewScope(vaultCase.scopeDefinition) }} className="px-3 py-1.5 text-muted-foreground hover:text-foreground/80 text-sm transition-colors">Cancel</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <p className="text-sm text-foreground leading-relaxed">{vaultCase.scopeDefinition}</p>
                    {vaultCase.scopeHistory.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-border space-y-2">
                        <div className="text-xs text-muted-foreground font-medium">Scope History</div>
                        {vaultCase.scopeHistory.map(sv => (
                          <div key={sv.version} className="text-xs text-muted-foreground bg-muted rounded p-2">
                            <span className="font-semibold">v{sv.version}</span> — {sv.reason} <span className="text-muted-foreground">({fmtTs(sv.changedAt)})</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            </section>

            {/* Deadlines */}
            {Object.keys(vaultCase.deadlines).length > 0 && (
              <section>
                <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">Deadlines & Compliance</h3>
                <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
                  {Object.entries(vaultCase.deadlines).map(([key, dl]) => {
                    const badge = deadlineBadge(dl.dueDate, dl.status)
                    return (
                      <div key={key} className="flex items-center border-b border-border/80 last:border-0 px-4 py-3">
                        <div className="flex items-center gap-1.5 w-12">
                          <div className="font-mono text-xs font-bold text-muted-foreground">{key}</div>
                        </div>
                        <div className="flex-1 ml-3">
                          <div className="text-sm text-foreground">{dl.label}</div>
                          <div className="text-xs text-muted-foreground">{dl.dueDate ? fmtDate(dl.dueDate) : 'Computed at closure'}</div>
                        </div>
                        <span className="text-xs font-semibold px-2.5 py-1 rounded-full border"
                          style={{ color: badge.color, borderColor: badge.color + '60', background: badge.bg + '30' }}>
                          {badge.label}
                        </span>
                        {!isClosed && dl.status === 'OPEN' && dl.dueDate && (
                          <button onClick={() => markDeadlineMet(key)}
                            className="ml-3 text-xs text-muted-foreground hover:text-green-400 transition-colors px-2 py-1 rounded border border-border hover:border-green-600">
                            Mark Met
                          </button>
                        )}
                      </div>
                    )
                  })}
                </div>
                {vaultCase.enforcementFlags.feesAllowed === false && (
                  <div className="mt-2 flex items-center gap-2 bg-red-900/20 border border-red-700/50 rounded-lg px-4 py-2 text-xs text-red-300">
                    <Shield size={14} className="flex-shrink-0" />
                    Fees may not be charged for this case — the 10-day response deadline was missed. This is permanent and cannot be reversed per M.G.L. c. 66, §10.
                  </div>
                )}
              </section>
            )}

            {/* Quick notifications */}
            {!isClosed && settings.raos.length > 0 && (
              <section>
                <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">Notifications</h3>
                <div className="flex flex-wrap gap-2">
                  {[
                    { label: 'Clarification Request', subject: `[${vaultCase.caseNumber}] Clarification Needed`, body: `Dear Requester,\n\nWe are writing regarding your request (${vaultCase.caseNumber}) submitted on ${fmtTs(vaultCase.createdAt)}.\n\nWe need clarification on the scope of your request before we can proceed.\n\nPlease respond within 30 days.\n\nRecords Access Officer\n${settings.notificationEmail}` },
                    { label: 'Extension Notice', subject: `[${vaultCase.caseNumber}] Extension of Time`, body: `Dear Requester,\n\nRegarding your request (${vaultCase.caseNumber}):\n\nWe are writing to notify you that additional time is needed to fulfill your request. We will require an extension to complete our search.\n\nRecords Access Officer` },
                    { label: 'Status Update', subject: `[${vaultCase.caseNumber}] Status Update`, body: `Regarding case ${vaultCase.caseNumber}: Current stage is ${vaultCase.currentStage}.` },
                  ].map(n => (
                    <button key={n.label}
                      onClick={() => mailtoRAO(n.subject, n.body)}
                      className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground/80 px-3 py-1.5 rounded-lg border border-border hover:border-border bg-card transition-colors">
                      <Envelope size={13} /> {n.label}
                    </button>
                  ))}
                </div>
              </section>
            )}

            {/* PuddleJumper tracking + CloudSync + Templates */}
            <div className="mt-6 space-y-4">
              {/* PJ Tracking */}
              {vaultCase.pjPrrId && (
                <div className="bg-indigo-950/40 border border-indigo-800/40 rounded-xl p-4">
                  <div className="text-xs font-bold text-indigo-400 uppercase tracking-wider mb-2">PuddleJumper Tracking</div>
                  <div className="flex items-center justify-between text-sm">
                    <div>
                      <div className="text-white font-mono text-xs">{vaultCase.pjPrrPublicId}</div>
                      {vaultCase.pjPrrTrackingUrl && (
                        <a href={vaultCase.pjPrrTrackingUrl} target="_blank" rel="noopener noreferrer"
                          className="text-indigo-400 hover:text-indigo-300 text-xs underline mt-0.5 block">
                          {vaultCase.pjPrrTrackingUrl}
                        </a>
                      )}
                    </div>
                    <span className="text-xs text-indigo-500/60">Synced with PJ</span>
                  </div>
                </div>
              )}

              {/* CloudSync */}
              {!isClosed && (
                <div className="bg-card border border-border rounded-xl p-4 shadow-sm">
                  <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-1">☁ CloudSync</div>
                  <div className="flex gap-2 flex-wrap">
                    {(['microsoft', 'google', 'github'] as const).map(provider => (
                      <button key={provider} onClick={async () => {
                        try {
                          const html = await generateBossHTML(vaultCase, actor.split('@')[0], provider)
                          const filename = `${vaultCase.caseNumber}-backup-${new Date().toISOString().slice(0, 10)}.html`
                          await pjApi.cloudSave({ provider, filename, contentBase64: btoa(unescape(encodeURIComponent(html))), mimeType: 'text/html' })
                          update(appendAudit(vaultCase, actor, 'BACKUP', `Case CloudSync'd to ${provider}`, { ruleApplied: 'Manual CloudSync' }))
                        } catch (e) {
                          const msg = e instanceof Error ? e.message : 'Unknown error'
                          const providerName = provider === 'microsoft' ? 'SharePoint' : provider === 'google' ? 'Drive' : 'GitHub'
                          const isAuth = /auth|token|unauthorized|401/i.test(msg)
                          toast.error(
                            isAuth
                              ? `${providerName} session expired — reconnect in Connections`
                              : `CloudSync to ${providerName} failed: ${msg}`,
                            { duration: 6000 }
                          )
                        }
                      }} className="text-xs px-3 py-1.5 rounded-lg border border-border bg-card text-muted-foreground hover:border-border hover:text-foreground/90 transition-all capitalize">
                        {provider === 'microsoft' ? '📁 SharePoint' : provider === 'google' ? '📂 Drive' : '🐙 GitHub'}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Letter Templates */}
              <div className="bg-card border border-border rounded-xl p-4 shadow-sm">
                <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">Letter Templates</div>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { label: '✅ Full Disclosure', key: 'full' },
                    { label: '🟡 Partial Disclosure', key: 'partial' },
                    { label: '🔴 Denial Letter', key: 'denial' },
                    { label: '⏳ Extension Notice', key: 'extension' },
                  ].map(({ label, key }) => (
                    <button key={key} onClick={() => {
                      const rao = settings.raos.find(r => r.isPrimary) ?? settings.raos[0]
                      const ctx = {
                        town: actor.split('@')[1]?.replace('.gov', '').replace(/^\w/, (c: string) => c.toUpperCase()) || 'Town',
                        caseNumber: vaultCase.caseNumber,
                        requesterName: vaultCase.subject['requesterName'] || vaultCase.subject['applicantName'],
                        requesterEmail: vaultCase.subject['requesterEmail'] || vaultCase.subject['email'],
                        raoName: rao?.name,
                        raoTitle: rao?.title,
                        raoEmail: rao?.email,
                        raoPhone: rao?.phone,
                        today: new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
                        requestDescription: vaultCase.subject['requestText'],
                        extensionDays: 10,
                      }
                      const lastApproval = (vaultCase.approvals ?? []).slice(-1)[0]
                      const exemptionDetails = (lastApproval?.exemptionsCited ?? []).map((code: string) => {
                        const map: Record<string, string> = {
                          'a': 'Personnel/medical files — invasion of privacy [M.G.L. c. 4, §7(26)(a)]',
                          'b': 'Investigatory materials — law enforcement [M.G.L. c. 4, §7(26)(b)]',
                          'c': 'Inter-agency deliberative process [M.G.L. c. 4, §7(26)(c)]',
                          'd': 'Attorney-client privilege [M.G.L. c. 4, §7(26)(d)]',
                          'e': 'Competitive harm to public body [M.G.L. c. 4, §7(26)(e)]',
                          'f': 'Security information [M.G.L. c. 4, §7(26)(f)]',
                          'g': 'Trade secrets [M.G.L. c. 4, §7(26)(g)]',
                          'h': 'CORI / Criminal records [M.G.L. c. 4, §7(26)(h)]',
                          'i': 'Victim privacy [M.G.L. c. 4, §7(26)(i)]',
                          'j': 'Homeland security [M.G.L. c. 4, §7(26)(j)]',
                          'k': 'Proprietary procurement info [M.G.L. c. 4, §7(26)(k)]',
                          'l': 'Surveillance techniques [M.G.L. c. 4, §7(26)(l)]',
                          'n': 'Grand jury materials [M.G.L. c. 4, §7(26)(n)]',
                        }
                        return map[code] ?? `Exemption (${code}) [M.G.L. c. 4, §7(26)]`
                      })
                      let html = ''
                      if (key === 'full') html = generateFullDisclosureLetter(ctx)
                      else if (key === 'partial') html = generatePartialDisclosureLetter(ctx, exemptionDetails.length > 0 ? exemptionDetails : ['[Specify exemption(s) from M.G.L. c. 4, §7(26)]'])
                      else if (key === 'denial') html = generateDenialLetter(ctx, exemptionDetails.length > 0 ? exemptionDetails : ['[Specify exemption(s) from M.G.L. c. 4, §7(26)]'])
                      else html = generateExtensionLetter(ctx)
                      const blob = new Blob([html], { type: 'text/html' })
                      const url = URL.createObjectURL(blob)
                      const a = document.createElement('a')
                      a.href = url
                      a.download = `${vaultCase.caseNumber}-${key}-letter.html`
                      a.click()
                      URL.revokeObjectURL(url)
                    }} className="text-xs px-3 py-2 rounded-lg border border-border bg-card text-muted-foreground hover:border-border hover:text-foreground/90 transition-all text-left">
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Stage Tab */}
        {tab === 'stage' && (
          <div className="max-w-2xl mx-auto px-6 py-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-foreground">{stageDef?.label ?? vaultCase.currentStage}</h3>
              {!isClosed && (
                <button onClick={saveStageData} className="text-xs text-indigo-400 hover:text-indigo-300 px-3 py-1.5 rounded border border-indigo-800 hover:border-indigo-600 transition-colors">
                  Save
                </button>
              )}
            </div>

            {/* Stage path breadcrumb */}
            <div className="flex items-center gap-1 mb-4 flex-wrap">
              {mod.stages.filter(s => s !== 'CLOSED').map((s, i) => (
                <div key={s} className="flex items-center gap-1">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${s === vaultCase.currentStage ? 'bg-indigo-600 text-white' : i < currentStageIdx ? 'bg-green-100 text-green-700' : 'bg-slate-700 text-muted-foreground'}`}>
                    {s}
                  </span>
                  {i < mod.stages.filter(s => s !== 'CLOSED').length - 1 && <CaretRight size={12} className="text-muted-foreground" />}
                </div>
              ))}
            </div>

            {/* Stage guidance banner */}
            {!isClosed && STAGE_HELP[vaultCase.moduleId]?.[vaultCase.currentStage] && (
              <div className="mb-5 bg-indigo-50 border border-indigo-200 rounded-xl px-4 py-3">
                <div className="text-xs font-bold text-indigo-500 uppercase tracking-wider mb-1">What's happening at this stage</div>
                <p className="text-sm text-foreground/80 mb-2">{STAGE_HELP[vaultCase.moduleId][vaultCase.currentStage].what}</p>
                <div className="text-xs font-bold text-indigo-500 uppercase tracking-wider mb-1">What you need to do</div>
                <p className="text-sm text-foreground/80">{STAGE_HELP[vaultCase.moduleId][vaultCase.currentStage].doThis}</p>
              </div>
            )}

            {isClosed ? (
              <div className="text-center py-8 text-muted-foreground">
                <CheckCircle size={40} className="mx-auto mb-3 text-green-600" weight="thin" />
                <p>Case is closed — {vaultCase.closureReason}</p>
                <p className="text-xs mt-1">Closed {vaultCase.closedAt ? fmtTs(vaultCase.closedAt) : ''}</p>
              </div>
            ) : stageDef ? (
              <div className="space-y-4">
                {stageDef.gateChecks && stageDef.gateChecks.length > 0 && (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
                    <div className="text-xs font-bold text-amber-700 uppercase tracking-wider mb-2">Gate Checks — Complete before advancing</div>
                    <ul className="space-y-1.5">
                      {stageDef.gateChecks.map((g, i) => (
                        <li key={i} className="text-xs text-amber-800 flex items-start gap-2">
                          <span className="mt-0.5 text-amber-500">☐</span>{g}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {stageDef.fields.map(f => (
                  <div key={f.key}>
                    <label className="block text-xs font-medium text-muted-foreground mb-1">
                      {f.label}
                      {stageDef.requiredToAdvance?.includes(f.key) && <span className="text-red-400 ml-1">* required to advance</span>}
                    </label>
                    {f.type === 'textarea' ? (
                      <textarea rows={4} value={stageForm[f.key] ?? ''} onChange={e => setField(f.key, e.target.value)}
                        placeholder={f.placeholder} disabled={isClosed}
                        className="w-full bg-card border border-border text-foreground rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-200 disabled:opacity-50" />
                    ) : f.type === 'select' ? (
                      <select value={stageForm[f.key] ?? ''} onChange={e => setField(f.key, e.target.value)} disabled={isClosed}
                        className="w-full bg-card border border-border text-foreground rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-200 disabled:opacity-50">
                        <option value="">Select…</option>
                        {f.options?.map(o => <option key={o} value={o}>{o}</option>)}
                      </select>
                    ) : (
                      <input type={f.type === 'phone' ? 'tel' : f.type === 'number' ? 'number' : f.type === 'email' ? 'email' : f.type === 'date' ? 'date' : 'text'}
                        value={stageForm[f.key] ?? ''} onChange={e => setField(f.key, e.target.value)}
                        placeholder={f.placeholder} disabled={isClosed}
                        className="w-full bg-card border border-border text-foreground rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-200 disabled:opacity-50" />
                    )}
                    {f.hint && <p className="text-xs text-muted-foreground mt-1">ⓘ {f.hint}</p>}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-muted-foreground text-sm py-8 text-center">No form fields defined for this stage.</div>
            )}
          </div>
        )}

        {/* Approvals Tab */}
        {tab === 'approvals' && (
          <ApprovalsTab
            vaultCase={vaultCase}
            actor={actor}
            isClosed={isClosed}
            onUpdate={update}
            settings={settings}
          />
        )}

        {/* Assets Tab */}
        {tab === 'assets' && (
          <div className="max-w-3xl mx-auto px-6 py-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-semibold text-foreground">
                  Assets ({vaultCase.assets.length})
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">Permanent records are locked when the case closes. Locked records cannot be edited — create a new version to make corrections.</p>
              </div>
              {!isClosed && (
                <button onClick={() => setAddAsset(true)}
                  className="flex items-center gap-2 text-sm text-indigo-400 hover:text-indigo-300 px-3 py-1.5 rounded border border-indigo-800 hover:border-indigo-600 transition-colors">
                  <Plus size={14} /> Add Asset
                </button>
              )}
            </div>

            {addAsset && (
              <div className="mb-6 bg-card border border-indigo-700 rounded-xl p-4 space-y-3">
                <div className="text-sm font-semibold text-foreground">Add Asset</div>
                <input type="text" placeholder="Record type (e.g. Assessment Decision, Withholding Letter)" value={assetForm.type}
                  onChange={e => setAssetForm(p => ({ ...p, type: e.target.value }))}
                  className="w-full bg-card border border-border text-foreground rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-200" />
                <input type="text" placeholder="Filename (e.g. assessment-decision-2026-001.pdf)" value={assetForm.filename}
                  onChange={e => setAssetForm(p => ({ ...p, filename: e.target.value }))}
                  className="w-full bg-card border border-border text-foreground rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-200" />
                <textarea rows={2} placeholder="Description (optional)" value={assetForm.description}
                  onChange={e => setAssetForm(p => ({ ...p, description: e.target.value }))}
                  className="w-full bg-card border border-border text-foreground rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-200" />
                <select value={assetForm.retention} onChange={e => setAssetForm(p => ({ ...p, retention: e.target.value as typeof p.retention }))}
                  className="w-full bg-card border border-border text-foreground rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-200">
                  <option value="KEEPER">Permanent — Keep Forever</option>
                  <option value="REFERENCE">Reference — Keep 7 Years</option>
                  <option value="TRANSACTIONAL">Transactional — Keep 1–2 Years</option>
                </select>
                <div className="flex gap-2">
                  <button onClick={submitAsset} className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm transition-colors">Add Asset</button>
                  <button onClick={() => setAddAsset(false)} className="px-3 py-1.5 text-muted-foreground hover:text-foreground/80 text-sm transition-colors">Cancel</button>
                </div>
              </div>
            )}

            {vaultCase.assets.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">No assets yet.</div>
            ) : (
              <div className="space-y-2">
                {vaultCase.assets.map(a => (
                  <div key={a.id} className={`flex items-center gap-3 bg-card border ${a.isLocked ? 'border-green-800/50' : 'border-border'} rounded-xl px-4 py-3`}>
                    <FileText size={18} className={a.isLocked ? 'text-green-500' : 'text-muted-foreground'} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-foreground truncate">{a.filename}</span>
                        {a.isLocked && <span className="text-xs font-bold text-green-400 flex items-center gap-0.5"><Lock size={11} /> LOCKED</span>}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className={`text-xs font-semibold px-1.5 rounded ${a.retentionClass === 'KEEPER' ? 'bg-indigo-900/50 text-indigo-300' : a.retentionClass === 'REFERENCE' ? 'bg-amber-50 text-amber-400' : 'bg-slate-700 text-muted-foreground'}`}>
                          {a.retentionClass}
                        </span>
                        {a.assetType && <span className="text-xs text-muted-foreground">{a.assetType}</span>}
                        <span className="text-xs text-muted-foreground">{fmtTs(a.createdAt)}</span>
                      </div>
                      {a.isLocked && a.lockedBy && (
                        <div className="text-xs text-muted-foreground mt-0.5">Locked by {a.lockedBy} on {fmtTs(a.lockedAt!)}</div>
                      )}
                    </div>
                    {!a.isLocked && !isClosed && (
                      <button onClick={() => lockAsset(a.id)}
                        className="text-xs text-muted-foreground hover:text-amber-400 px-2 py-1 rounded border border-border hover:border-amber-700 transition-colors flex items-center gap-1">
                        <Lock size={12} /> Lock
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Builder Tab */}
        {tab === 'builder' && (
          <div className="max-w-3xl mx-auto px-6 py-6 space-y-5">
            {/* Template picker */}
            <div>
              <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">Document Template</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {[
                  { key: 'blank',        label: 'Blank',              emoji: '📄' },
                  { key: 'ack',          label: 'Acknowledgment',     emoji: '📬' },
                  { key: 'decision',     label: 'Decision Notice',    emoji: '⚖️' },
                  { key: 'extension',    label: 'Extension Notice',   emoji: '📅' },
                  { key: 'memo',         label: 'Internal Memo',      emoji: '📝' },
                  { key: 'status',       label: 'Status Report',      emoji: '📊' },
                ].map(tmpl => {
                  const intake = (vaultCase as unknown as Record<string,unknown>).intakeData as Record<string,unknown> ?? {}
                  const requester = intake.requester_name || intake.requesterName || 'Requester'
                  const caseNum = vaultCase.caseNumber
                  const today = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
                  const moduleName = meta?.name ?? vaultCase.moduleId
                  const body: Record<string, string> = {
                    blank: '',
                    ack: `${today}\n\nDear ${requester},\n\nThis letter serves as acknowledgment that we have received your ${moduleName} request, assigned Case Number ${caseNum}.\n\nYour request is currently under review. We will respond within the applicable statutory timeframe.\n\nIf you have questions, please contact our office.\n\nSincerely,\n[Officer Name]\n[Title]\n[Town / Department]`,
                    decision: `${today}\n\nRe: Case ${caseNum} — Decision Notice\n\nDear ${requester},\n\nAfter review of your ${moduleName} request (${caseNum}), we have reached the following decision:\n\n[DECISION]\n\n[EXPLANATION]\n\nThis decision is effective as of the date of this notice.\n\nSincerely,\n[Officer Name]\n[Title]`,
                    extension: `${today}\n\nRe: Case ${caseNum} — Extension Notice\n\nDear ${requester},\n\nWe are writing to notify you that additional time is needed to process your ${moduleName} request (${caseNum}).\n\nReason: [REASON FOR EXTENSION]\n\nEstimated completion date: [DATE]\n\nWe apologize for any inconvenience.\n\nSincerely,\n[Officer Name]\n[Title]`,
                    memo: `INTERNAL MEMORANDUM\n\nDate: ${today}\nCase: ${caseNum}\nModule: ${moduleName}\nStage: ${vaultCase.currentStage}\n\nTo: [Recipient]\nFrom: [Author]\n\nSubject: [SUBJECT]\n\n[BODY]\n\nAction Required: [YES / NO]\nDeadline: [DATE IF APPLICABLE]`,
                    status: `STATUS REPORT — ${moduleName}\n\nCase: ${caseNum}\nDate: ${today}\nCurrent Stage: ${vaultCase.currentStage}\nRequester: ${requester}\n\nSummary:\n[BRIEF SUMMARY OF CURRENT STATUS]\n\nCompleted Steps:\n• [STEP 1]\n• [STEP 2]\n\nPending:\n• [NEXT ACTION]\n\nNotes:\n[ANY ADDITIONAL NOTES]`,
                  }
                  return (
                    <button key={tmpl.key}
                      onClick={() => {
                        setBuilderTemplate(tmpl.key)
                        setBuilderContent(body[tmpl.key])
                        if (!builderTitle) setBuilderTitle(`${tmpl.label} — ${vaultCase.caseNumber}`)
                      }}
                      className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border text-sm transition-all text-left ${builderTemplate === tmpl.key ? 'border-indigo-500 bg-indigo-50 text-indigo-300' : 'border-border text-muted-foreground hover:border-slate-500 hover:text-slate-200'}`}
                    >
                      <span className="text-base">{tmpl.emoji}</span>
                      <span className="font-medium">{tmpl.label}</span>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Title */}
            <div>
              <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5">Document Title / Filename</label>
              <input
                value={builderTitle}
                onChange={e => setBuilderTitle(e.target.value)}
                placeholder={`e.g. decision-notice-${vaultCase.caseNumber.toLowerCase()}.txt`}
                className="w-full bg-card border border-border text-foreground rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500 font-mono"
              />
            </div>

            {/* Content editor */}
            <div>
              <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5">Content</label>
              <textarea
                value={builderContent}
                onChange={e => setBuilderContent(e.target.value)}
                rows={18}
                placeholder="Start writing or pick a template above…"
                className="w-full bg-background border border-border text-foreground/90 rounded-xl px-4 py-3 text-sm font-mono leading-relaxed focus:outline-none focus:border-indigo-500 resize-y"
              />
              <div className="flex items-center justify-between mt-1">
                <span className="text-xs text-muted-foreground">{builderContent.length} chars · {builderContent.split('\n').length} lines</span>
                <button onClick={() => { setBuilderContent(''); setBuilderTitle(''); setBuilderTemplate('blank') }}
                  className="text-xs text-muted-foreground hover:text-muted-foreground transition-colors">Clear</button>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-3 pt-1">
              {/* Save as Case Asset */}
              <button
                disabled={!builderContent.trim() || !builderTitle.trim() || builderSaving}
                onClick={async () => {
                  if (!builderContent.trim() || !builderTitle.trim()) return
                  setBuilderSaving(true)
                  setBuilderSaveStatus('')
                  const filename = builderTitle.trim().endsWith('.txt') || builderTitle.trim().endsWith('.html') ? builderTitle.trim() : `${builderTitle.trim()}.txt`
                  const newAsset: CaseAsset = {
                    id: uuid(), assetType: 'BuilderDoc', filename,
                    description: `Created in Builder — ${vaultCase.caseNumber}`,
                    retentionClass: 'REFERENCE', isLocked: false, createdAt: Date.now(), createdBy: actor,
                    tags: ['builder'],
                    contentBase64: btoa(unescape(encodeURIComponent(builderContent))),
                    contentType: 'text/plain',
                  }
                  const updated = appendAudit(
                    { ...vaultCase, assets: [...vaultCase.assets, newAsset] },
                    actor, 'ASSET_ADD', `Builder document created: ${filename}`
                  )
                  onUpdate(updated)
                  setBuilderSaveStatus('✓ Saved to Assets tab')
                  setBuilderSaving(false)
                }}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-700 hover:bg-indigo-600 disabled:opacity-40 text-foreground text-sm font-medium transition-colors"
              >
                <FileText size={14} /> Save to Case
              </button>

              {/* CloudSync */}
              {connectorProvider && connectorProvider !== 'none' && (
                <button
                  disabled={!builderContent.trim() || !builderTitle.trim() || builderSaving}
                  onClick={async () => {
                    if (!builderContent.trim() || !builderTitle.trim()) return
                    setBuilderSaving(true)
                    setBuilderSaveStatus('')
                    try {
                      const filename = builderTitle.trim().endsWith('.txt') ? builderTitle.trim() : `${builderTitle.trim()}.txt`
                      const contentBase64 = btoa(unescape(encodeURIComponent(builderContent)))
                      await pjApi.cloudSave({
                        provider: connectorProvider as 'google' | 'microsoft' | 'github',
                        filename: `VAULT/${vaultCase.caseNumber}/${filename}`,
                        contentBase64,
                        mimeType: 'text/plain',
                      })
                      // Also save as asset
                      const newAsset: CaseAsset = {
                        id: uuid(), assetType: 'BuilderDoc', filename,
                        description: `Builder doc — CloudSync'd to ${connectorProvider.toUpperCase()}`,
                        retentionClass: 'REFERENCE', isLocked: false, createdAt: Date.now(), createdBy: actor,
                        tags: ['builder'],
                        contentBase64,
                        contentType: 'text/plain',
                      }
                      const updated = appendAudit(
                        { ...vaultCase, assets: [...vaultCase.assets, newAsset] },
                        actor, 'BACKUP', `Builder doc CloudSync'd to ${connectorProvider.toUpperCase()}: ${filename}`
                      )
                      onUpdate(updated)
                      setBuilderSaveStatus(`✓ CloudSync'd to ${connectorProvider.toUpperCase()} + Assets`)
                    } catch (e) {
                      const msg = e instanceof Error ? e.message : 'Unknown error'
                      const isAuth = /auth|token|unauthorized|401/i.test(msg)
                      const providerName = connectorProvider === 'microsoft' ? 'SharePoint' : connectorProvider === 'google' ? 'Drive' : 'GitHub'
                      toast.error(
                        isAuth
                          ? `${providerName} session expired — reconnect in Connections`
                          : `CloudSync to ${providerName} failed: ${msg}`,
                        { duration: 6000 }
                      )
                      setBuilderSaveStatus('⚠ CloudSync failed — saved locally only')
                      const newAsset: CaseAsset = {
                        id: uuid(), assetType: 'BuilderDoc', filename: builderTitle.trim(),
                        description: 'Builder doc (CloudSync failed)',
                        retentionClass: 'REFERENCE', isLocked: false, createdAt: Date.now(), createdBy: actor,
                        tags: ['builder'],
                        contentBase64: btoa(unescape(encodeURIComponent(builderContent))),
                        contentType: 'text/plain',
                      }
                      onUpdate(appendAudit({ ...vaultCase, assets: [...vaultCase.assets, newAsset] }, actor, 'ASSET_ADD', `Builder doc: ${builderTitle}`))
                    }
                    setBuilderSaving(false)
                  }}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-800 hover:bg-emerald-700 disabled:opacity-40 text-emerald-200 text-sm font-medium transition-colors"
                >
                  ☁ CloudSync → {connectorProvider === 'microsoft' ? 'SharePoint' : connectorProvider === 'google' ? 'Drive' : 'GitHub'}
                </button>
              )}

              {/* Download */}
              <button
                disabled={!builderContent.trim()}
                onClick={() => {
                  const filename = builderTitle.trim() || `builder-${vaultCase.caseNumber}.txt`
                  const blob = new Blob([builderContent], { type: 'text/plain' })
                  const url = URL.createObjectURL(blob)
                  const a = document.createElement('a'); a.href = url
                  a.download = filename.endsWith('.txt') ? filename : `${filename}.txt`
                  a.click(); URL.revokeObjectURL(url)
                }}
                className="flex items-center gap-2 px-4 py-2 rounded-lg border border-border hover:border-slate-500 disabled:opacity-40 text-muted-foreground hover:text-slate-200 text-sm font-medium transition-colors"
              >
                ⬇ Download
              </button>
            </div>

            {builderSaveStatus && (
              <div className={`text-sm px-3 py-2 rounded-lg ${builderSaveStatus.startsWith('✓') ? 'text-emerald-400 bg-emerald-900/20' : 'text-amber-400 bg-amber-900/20'}`}>
                {builderSaveStatus}
              </div>
            )}
          </div>
        )}

        {/* Tasks Tab */}
        {tab === 'tasks' && (
          <div className="max-w-3xl mx-auto px-6 py-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-semibold text-foreground flex items-center gap-2">
                  <ListChecks size={16} /> Case Tasks
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">Dual-sided action items for reviewer (A) and applicant (B). Auto-created on key transitions.</p>
              </div>
              {!isClosed && (
                <button onClick={() => setAddTask(true)}
                  className="flex items-center gap-2 text-sm text-indigo-400 hover:text-indigo-300 px-3 py-1.5 rounded border border-indigo-800 hover:border-indigo-600 transition-colors">
                  <Plus size={14} /> New Task
                </button>
              )}
            </div>

            {addTask && (
              <div className="mb-6 bg-card border border-indigo-700 rounded-xl p-4 space-y-3">
                <div className="text-sm font-semibold text-foreground">New Task</div>
                <input type="text" placeholder="Task title" value={taskForm.title}
                  onChange={e => setTaskForm(p => ({ ...p, title: e.target.value }))}
                  className="w-full bg-card border border-border text-foreground rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-200" />
                <textarea rows={2} placeholder="Description (optional)" value={taskForm.description}
                  onChange={e => setTaskForm(p => ({ ...p, description: e.target.value }))}
                  className="w-full bg-card border border-border text-foreground rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-200" />
                <div className="flex gap-3">
                  <select value={taskForm.assigned_side} onChange={e => setTaskForm(p => ({ ...p, assigned_side: e.target.value as 'A' | 'B' }))}
                    className="bg-card border border-border text-foreground rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500">
                    <option value="A">Side A — Reviewer</option>
                    <option value="B">Side B — Applicant</option>
                  </select>
                  <input type="date" value={taskForm.due_at}
                    onChange={e => setTaskForm(p => ({ ...p, due_at: e.target.value }))}
                    className="bg-card border border-border text-foreground rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500" />
                </div>
                <div className="flex gap-2">
                  <button onClick={submitTask} disabled={taskSaving || !taskForm.title.trim()}
                    className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white rounded-lg text-sm transition-colors">
                    {taskSaving ? 'Saving…' : 'Create Task'}
                  </button>
                  <button onClick={() => setAddTask(false)} className="px-3 py-1.5 text-muted-foreground hover:text-foreground/80 text-sm transition-colors">Cancel</button>
                </div>
              </div>
            )}

            {tasksLoading ? (
              <div className="py-8 text-center text-muted-foreground text-sm">Loading tasks…</div>
            ) : tasks.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground text-sm">No tasks yet. Tasks are auto-created on review transitions.</div>
            ) : (
              <div className="space-y-2">
                {tasks.map(task => (
                  <div key={task.id} className={`flex items-start gap-3 bg-card border rounded-xl px-4 py-3 ${task.status === 'done' ? 'border-green-800/40 opacity-70' : task.status === 'cancelled' ? 'border-border opacity-50' : 'border-border'}`}>
                    <span className={`mt-0.5 shrink-0 text-xs font-bold px-2 py-0.5 rounded-full ${task.assigned_side === 'A' ? 'bg-indigo-900/50 text-indigo-300' : 'bg-amber-900/40 text-amber-300'}`}>
                      Side {task.assigned_side}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`text-sm font-medium ${task.status === 'done' ? 'line-through text-muted-foreground' : 'text-foreground'}`}>{task.title}</span>
                        {task.status === 'done' && <span className="text-xs text-green-500">✓ Done</span>}
                        {task.status === 'cancelled' && <span className="text-xs text-muted-foreground">Cancelled</span>}
                      </div>
                      {task.description && <p className="text-xs text-muted-foreground mt-0.5">{task.description}</p>}
                      <div className="flex items-center gap-3 mt-1">
                        <span className="text-xs text-muted-foreground">By {task.created_by}</span>
                        {task.due_at && <span className="text-xs text-amber-400">Due {task.due_at}</span>}
                        {task.completed_by && <span className="text-xs text-muted-foreground">Completed by {task.completed_by}</span>}
                      </div>
                    </div>
                    {task.status === 'open' && !isClosed && (
                      <div className="flex gap-1 shrink-0">
                        <button onClick={() => finishTask(task.id, 'done')}
                          className="text-xs px-2 py-1 rounded border border-green-800 text-green-400 hover:bg-green-900/30 transition-colors">Done</button>
                        <button onClick={() => finishTask(task.id, 'cancelled')}
                          className="text-xs px-2 py-1 rounded border border-border text-muted-foreground hover:text-foreground/80 transition-colors">Cancel</button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Audit Tab */}
        {tab === 'audit' && (
          <div className="max-w-3xl mx-auto px-6 py-6">
            <div className="mb-4">
              <h3 className="font-semibold text-foreground">Audit Log ({vaultCase.auditLog.length} entries)</h3>
              <p className="text-xs text-muted-foreground mt-0.5">Append-only. No entries may be edited or deleted.</p>
            </div>
            <div className="space-y-1">
              {[...vaultCase.auditLog].reverse().map((e, i) => (
                <div key={e.id} className={`flex gap-3 py-2.5 ${i < vaultCase.auditLog.length - 1 ? 'border-b border-border' : ''}`}>
                  <div className="w-36 flex-shrink-0 text-xs text-muted-foreground font-mono pt-0.5">{fmtTs(e.timestamp)}</div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className={`text-xs font-bold px-1.5 py-0.5 rounded uppercase ${
                        e.action === 'ENFORCEMENT' ? 'bg-red-100 text-red-600' :
                        e.action === 'STAGE_TRANSITION' ? 'bg-indigo-100 text-indigo-600' :
                        e.action === 'ASSET_LOCK' ? 'bg-green-100 text-green-700' :
                        e.action === 'CLOSE' ? 'bg-muted text-muted-foreground' :
                        'bg-muted text-muted-foreground'
                      }`}>
                        {e.action.replace(/_/g, ' ')}
                      </span>
                      <span className="text-xs text-muted-foreground">{e.actor}</span>
                    </div>
                    <p className="text-sm text-foreground/80">{e.notes}</p>
                    {e.ruleApplied && <p className="text-xs text-muted-foreground mt-0.5 italic">{e.ruleApplied}</p>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Close Case Dialog */}
      {closeDialog && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" role="presentation">
          <div className="bg-slate-800 border border-border rounded-2xl p-6 w-full max-w-lg"
            role="dialog" aria-modal="true" aria-labelledby="close-case-dialog-title">
            <h3 id="close-case-dialog-title" className="font-bold text-foreground text-lg mb-1">Close Case</h3>
            <p className="text-sm text-muted-foreground mb-4">Closure is final. All permanent records will be locked and a complete case record will be generated and downloaded.</p>

            <div className="mb-4">
              <label className="block text-xs font-medium text-muted-foreground mb-2">Closure Reason</label>
              <select value={closureReason} onChange={e => setClosureReason(e.target.value)}
                className="w-full bg-card border border-border text-foreground rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-200">
                <option value="">Select reason…</option>
                {mod.closureReasons.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>

            <div className="mb-4 bg-muted rounded-lg p-3 text-xs text-muted-foreground space-y-1">
              <div>✓ Permanent records will be locked at closure</div>
              {vaultCase.moduleId === 'VAULTPRR' && <div>✓ T90 appeal window will be computed (90 calendar days)</div>}
              <div>✓ Complete case record will be generated and downloaded</div>
              {connectorProvider && connectorProvider !== 'none' && <div>✓ Backup to {connectorProvider.toUpperCase()} will be attempted</div>}
              {vaultCase.enforcementFlags.feesAllowed === false && <div className="text-red-400">⚠ Fees prohibited — 10-day response deadline was missed (cannot charge fees for this case)</div>}
            </div>

            {backupStatus && <div className="mb-3 text-sm text-green-400">{backupStatus}</div>}

            <div className="flex gap-3">
              <button onClick={closeCase} disabled={saving}
                className="flex-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-foreground py-2 rounded-xl font-semibold text-sm transition-colors">
                {saving ? 'Closing…' : 'Close Case'}
              </button>
              <button onClick={() => setCloseDialog(false)} className="px-4 text-muted-foreground hover:text-foreground/80 text-sm transition-colors">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
