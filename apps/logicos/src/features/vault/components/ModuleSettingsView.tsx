import { useState, useEffect } from 'react'
import { ArrowLeft, Plus, X } from '@phosphor-icons/react'
import type { VaultModuleSettings, RAOContact, EscalationContact, TeamMember, TeamMemberRole, NotificationProvider } from '../types'
import { getVaultModule } from '@/lib/vault-modules'
import { uuid, fmtTs } from '../utils/vaultHelpers'
import { WorkflowTab } from './WorkflowTab'
import { defaultWorkflow } from './workflowDefaults'
import { pjApi } from '@/services/pjApi'

function TeamAccessTab(_props: { team: TeamMember[]; onChange: (team: TeamMember[]) => void }) {
  return null
}

export function ModuleSettingsView({ moduleId, settings, onSave, onBack }: {
  moduleId: string
  settings: VaultModuleSettings
  onSave: (s: VaultModuleSettings) => void
  onBack: () => void
}) {
  const [s, setS] = useState<VaultModuleSettings>(settings)
  const [syncing, setSyncing] = useState(false)
  const [stab, setStab] = useState<'people' | 'workflow' | 'environment' | 'training' | 'team'>('people')
  const meta = getVaultModule(moduleId)

  useEffect(() => {
    pjApi.vault.getRaos(settings.envId).then((data: { raos?: RAOContact[] }) => {
      if (data.raos && data.raos.length > 0) {
        setS(prev => ({ ...prev, raos: data.raos! }))
      }
    }).catch(() => {})
  }, [settings.envId])

  async function handleSave() {
    const updated = { ...s, workflow: s.workflow ?? defaultWorkflow(moduleId), updatedAt: Date.now() }
    onSave(updated)
    setSyncing(true)
    try {
      await pjApi.vault.saveRaos(s.envId, s.raos)
    } catch {
      // Silent — local save already happened
    } finally {
      setSyncing(false)
    }
  }

  const addRAO = () => setS(prev => ({
    ...prev,
    raos: [...prev.raos, { id: uuid(), name: '', email: '', phone: '', title: 'Records Access Officer', isPrimary: prev.raos.length === 0 }]
  }))

  const updateRAO = (id: string, field: keyof RAOContact, val: string | boolean) =>
    setS(prev => ({ ...prev, raos: prev.raos.map(r => r.id === id ? { ...r, [field]: val } : r) }))

  const removeRAO = (id: string) => setS(prev => ({ ...prev, raos: prev.raos.filter(r => r.id !== id) }))

  const addEscalation = () => setS(prev => ({
    ...prev,
    escalation: [...prev.escalation, { id: uuid(), name: '', email: '', title: '', severity: 'normal', triggerDaysBeforeDeadline: 3 }]
  }))

  const updateEsc = (id: string, field: keyof EscalationContact, val: string | number) =>
    setS(prev => ({ ...prev, escalation: prev.escalation.map(e => e.id === id ? { ...e, [field]: val } : e) }))

  const removeEsc = (id: string) => setS(prev => ({ ...prev, escalation: prev.escalation.filter(e => e.id !== id) }))

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="flex items-center justify-between px-6 py-4 border-b border-border flex-shrink-0">
        <div className="flex items-center gap-3">
          <button aria-label="Go back" onClick={onBack} className="text-muted-foreground hover:text-foreground/80 transition-colors"><ArrowLeft size={18} /></button>
          <div>
            <div className="text-xs text-indigo-400 font-bold uppercase tracking-wider">{moduleId}</div>
            <div className="font-semibold text-foreground">{meta?.name ?? moduleId} — Settings</div>
          </div>
        </div>
        <button onClick={handleSave} disabled={syncing}
          className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-foreground px-4 py-1.5 rounded-lg text-sm font-medium transition-colors">
          {syncing ? 'Saving…' : 'Save Settings'}
        </button>
      </div>

      {/* Settings tab bar */}
      <div className="flex gap-1 px-6 pt-4 border-b border-border flex-shrink-0">
        {([['people', '👥 People'], ['workflow', 'Workflow'], ['environment', 'Environment'], ['training', 'Training']] as const).map(([t, label]) => (
          <button key={t} onClick={() => setStab(t)}
            className={`text-sm px-4 py-2 rounded-t-lg border-b-2 transition-colors ${
              stab === t
                ? 'border-indigo-500 text-indigo-400 bg-indigo-950/30'
                : 'border-transparent text-muted-foreground hover:text-foreground/80'
            }`}>
            {label}
          </button>
        ))}
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-6 py-6 space-y-8">

          {/* ── PEOPLE TAB ── */}
          {stab === 'people' && (<>

          {/* RAOs */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-sm font-semibold text-foreground">Records Access Officers</h3>
                <p className="text-xs text-muted-foreground mt-0.5">The primary Records Access Officer is listed on all generated notices and decision letters.</p>
              </div>
              <button onClick={addRAO} className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1 transition-colors">
                <Plus size={13} /> Add Records Officer
              </button>
            </div>
            {s.raos.length === 0 ? (
              <div className="text-sm text-muted-foreground text-center py-4 border border-dashed border-border rounded-xl">
                No RAOs configured. Add at least one.
              </div>
            ) : (
              <div className="space-y-4">
                {s.raos.map(r => (
                  <div key={r.id} className="bg-card border border-border rounded-xl p-4 shadow-sm space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
                        <input type="checkbox" checked={r.isPrimary} onChange={e => updateRAO(r.id, 'isPrimary', e.target.checked)}
                          className="rounded" />
                        Primary RAO
                      </label>
                      <button aria-label="Remove RAO contact" onClick={() => removeRAO(r.id)} className="text-muted-foreground hover:text-red-400 transition-colors"><X size={14} /></button>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      {[
                        { key: 'name', label: 'Name', placeholder: 'Full name' },
                        { key: 'title', label: 'Title', placeholder: 'Records Access Officer' },
                        { key: 'email', label: 'Email', placeholder: 'rao@town.gov' },
                        { key: 'phone', label: 'Phone', placeholder: '(555) 000-0000' },
                      ].map(({ key, label, placeholder }) => (
                        <div key={key}>
                          <label className="block text-xs text-muted-foreground mb-1">{label}</label>
                          <input type="text" value={(r as unknown as Record<string, string>)[key] ?? ''} placeholder={placeholder}
                            onChange={e => updateRAO(r.id, key as keyof RAOContact, e.target.value)}
                            className="w-full bg-muted border border-border text-foreground rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-indigo-500" />
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Escalation */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-foreground">Escalation Contacts</h3>
              <button onClick={addEscalation} className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1 transition-colors">
                <Plus size={13} /> Add
              </button>
            </div>
            {s.escalation.length === 0 ? (
              <div className="text-sm text-muted-foreground text-center py-4 border border-dashed border-border rounded-xl">
                No escalation contacts. These receive alerts when deadlines are at risk.
              </div>
            ) : (
              <div className="space-y-3">
                {s.escalation.map(e => (
                  <div key={e.id} className="bg-card border border-border rounded-xl p-4 shadow-sm space-y-3">
                    <div className="flex justify-end">
                      <button aria-label="Remove escalation contact" onClick={() => removeEsc(e.id)} className="text-muted-foreground hover:text-red-400 transition-colors"><X size={14} /></button>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div><label className="block text-xs text-muted-foreground mb-1">Name</label>
                        <input type="text" value={e.name} onChange={ev => updateEsc(e.id, 'name', ev.target.value)}
                          className="w-full bg-muted border border-border text-foreground rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-indigo-500" /></div>
                      <div><label className="block text-xs text-muted-foreground mb-1">Email</label>
                        <input type="email" value={e.email} onChange={ev => updateEsc(e.id, 'email', ev.target.value)}
                          className="w-full bg-muted border border-border text-foreground rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-indigo-500" /></div>
                      <div><label className="block text-xs text-muted-foreground mb-1">Severity</label>
                        <select value={e.severity} onChange={ev => updateEsc(e.id, 'severity', ev.target.value)}
                          className="w-full bg-muted border border-border text-foreground rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-indigo-500">
                          <option value="critical">Critical (24h)</option>
                          <option value="high">High (3 days)</option>
                          <option value="normal">Normal (1 week)</option>
                        </select>
                      </div>
                      <div><label className="block text-xs text-muted-foreground mb-1">Alert days before deadline</label>
                        <input type="number" min={1} max={30} value={e.triggerDaysBeforeDeadline}
                          onChange={ev => updateEsc(e.id, 'triggerDaysBeforeDeadline', parseInt(ev.target.value))}
                          className="w-full bg-muted border border-border text-foreground rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-indigo-500" /></div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* ── Team Members ── */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-sm font-semibold text-foreground">Team Members</h3>
                <p className="text-xs text-muted-foreground mt-0.5">Staff who can access this module. Role controls what they can do.</p>
              </div>
              <button onClick={() => setS(prev => ({ ...prev, team: [...(prev.team ?? []), { id: uuid(), name: '', email: '', role: 'viewer', canSeeAllCases: false, department: '' }] }))}
                className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1 transition-colors">
                <Plus size={13} /> Add Member
              </button>
            </div>
            {(s.team ?? []).length === 0 ? (
              <div className="text-sm text-muted-foreground text-center py-4 border border-dashed border-border rounded-xl">
                No team members added. Add staff who need access to this case module.
              </div>
            ) : (
              <div className="space-y-3">
                {(s.team ?? []).map(m => (
                  <div key={m.id} className="bg-card border border-border rounded-xl p-4 shadow-sm space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                          m.role === 'admin' ? 'bg-purple-900 text-purple-300' :
                          m.role === 'approver' ? 'bg-indigo-900 text-indigo-300' :
                          m.role === 'editor' ? 'bg-blue-900 text-blue-300' :
                          'bg-slate-700 text-muted-foreground'
                        }`}>{m.role}</span>
                        {m.canSeeAllCases && <span className="text-[10px] text-muted-foreground">· all cases</span>}
                      </div>
                      <button onClick={() => setS(prev => ({ ...prev, team: (prev.team ?? []).filter(x => x.id !== m.id) }))}
                        className="text-muted-foreground hover:text-red-400 transition-colors"><X size={14} /></button>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div><label className="block text-xs text-muted-foreground mb-1">Name</label>
                        <input value={m.name} onChange={e => setS(prev => ({ ...prev, team: (prev.team ?? []).map(x => x.id === m.id ? { ...x, name: e.target.value } : x) }))}
                          placeholder="Full name" className="w-full bg-muted border border-border text-foreground rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-indigo-500" /></div>
                      <div><label className="block text-xs text-muted-foreground mb-1">Email</label>
                        <input type="email" value={m.email} onChange={e => setS(prev => ({ ...prev, team: (prev.team ?? []).map(x => x.id === m.id ? { ...x, email: e.target.value } : x) }))}
                          placeholder="staff@town.gov" className="w-full bg-muted border border-border text-foreground rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-indigo-500" /></div>
                      <div><label className="block text-xs text-muted-foreground mb-1">Department</label>
                        <input value={m.department ?? ''} onChange={e => setS(prev => ({ ...prev, team: (prev.team ?? []).map(x => x.id === m.id ? { ...x, department: e.target.value } : x) }))}
                          placeholder="Town Clerk" className="w-full bg-muted border border-border text-foreground rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-indigo-500" /></div>
                      <div><label className="block text-xs text-muted-foreground mb-1">Role</label>
                        <select value={m.role} onChange={e => setS(prev => ({ ...prev, team: (prev.team ?? []).map(x => x.id === m.id ? { ...x, role: e.target.value as TeamMemberRole } : x) }))}
                          className="w-full bg-muted border border-border text-foreground rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-indigo-500">
                          <option value="viewer">Viewer — read only, own cases only</option>
                          <option value="editor">Editor — create & edit cases</option>
                          <option value="approver">Approver — can issue decisions</option>
                          <option value="admin">Admin — full module access</option>
                        </select></div>
                    </div>
                    <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
                      <input type="checkbox" checked={m.canSeeAllCases} onChange={e => setS(prev => ({ ...prev, team: (prev.team ?? []).map(x => x.id === m.id ? { ...x, canSeeAllCases: e.target.checked } : x) }))} className="rounded" />
                      Can see all cases (not just assigned ones)
                    </label>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* ── Escalation Contacts ── */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-sm font-semibold text-foreground">Escalation Contacts</h3>
                <p className="text-xs text-muted-foreground mt-0.5">Receive alerts when deadlines are at risk.</p>
              </div>
              <button onClick={addEscalation} className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1 transition-colors">
                <Plus size={13} /> Add
              </button>
            </div>
            {s.escalation.length === 0 ? (
              <div className="text-sm text-muted-foreground text-center py-4 border border-dashed border-border rounded-xl">
                No escalation contacts. These receive alerts when deadlines are at risk.
              </div>
            ) : (
              <div className="space-y-3">
                {s.escalation.map(e => (
                  <div key={e.id} className="bg-card border border-border rounded-xl p-4 shadow-sm space-y-3">
                    <div className="flex justify-end">
                      <button aria-label="Remove escalation contact" onClick={() => removeEsc(e.id)} className="text-muted-foreground hover:text-red-400 transition-colors"><X size={14} /></button>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div><label className="block text-xs text-muted-foreground mb-1">Name</label>
                        <input type="text" value={e.name} onChange={ev => updateEsc(e.id, 'name', ev.target.value)}
                          className="w-full bg-muted border border-border text-foreground rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-indigo-500" /></div>
                      <div><label className="block text-xs text-muted-foreground mb-1">Email</label>
                        <input type="email" value={e.email} onChange={ev => updateEsc(e.id, 'email', ev.target.value)}
                          className="w-full bg-muted border border-border text-foreground rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-indigo-500" /></div>
                      <div><label className="block text-xs text-muted-foreground mb-1">Severity</label>
                        <select value={e.severity} onChange={ev => updateEsc(e.id, 'severity', ev.target.value)}
                          className="w-full bg-muted border border-border text-foreground rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-indigo-500">
                          <option value="critical">Critical (24h)</option>
                          <option value="high">High (3 days)</option>
                          <option value="normal">Normal (1 week)</option>
                        </select></div>
                      <div><label className="block text-xs text-muted-foreground mb-1">Alert days before deadline</label>
                        <input type="number" min={1} max={30} value={e.triggerDaysBeforeDeadline}
                          onChange={ev => updateEsc(e.id, 'triggerDaysBeforeDeadline', parseInt(ev.target.value))}
                          className="w-full bg-muted border border-border text-foreground rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-indigo-500" /></div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          </>)}

          {/* ── WORKFLOW TAB ── */}
          {stab === 'workflow' && (<WorkflowTab s={s} setS={setS} moduleId={moduleId} />)}

          {/* ── ENVIRONMENT TAB ── */}
          {stab === 'environment' && (<>

          <section>
            <h3 className="text-sm font-semibold text-foreground mb-4">Municipality</h3>
            <div className="space-y-3">
              {[
                { key: 'municipalityName', label: 'Municipality Name', placeholder: 'Town of Phillipston', type: 'text' },
                { key: 'municipalityAddress', label: 'Address', placeholder: '50 The Common, Phillipston, MA 01331', type: 'text' },
                { key: 'municipalityPhone', label: 'Main Phone', placeholder: '(978) 249-1605', type: 'tel' },
                { key: 'municipalityWebsite', label: 'Website', placeholder: 'https://phillipston-ma.gov', type: 'url' },
              ].map(({ key, label, placeholder, type }) => (
                <div key={key}>
                  <label className="block text-xs text-muted-foreground mb-1">{label}</label>
                  <input type={type} value={(s as unknown as Record<string, string>)[key] ?? ''}
                    onChange={e => setS(prev => ({ ...prev, [key]: e.target.value }))}
                    placeholder={placeholder}
                    className="w-full bg-card border border-border text-foreground rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-200" />
                </div>
              ))}
            </div>
          </section>

          <section>
            <h3 className="text-sm font-semibold text-foreground mb-3">Notifications</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-muted-foreground mb-1">Notification Reply-To Email</label>
                <input type="email" value={s.notificationEmail}
                  onChange={e => setS(prev => ({ ...prev, notificationEmail: e.target.value }))}
                  placeholder="notices@town.gov"
                  className="w-full bg-card border border-border text-foreground rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-200" />
                <p className="text-xs text-muted-foreground mt-1">Used as reply-to in generated mailto links.</p>
              </div>
              <label className="flex items-center gap-2 text-sm text-foreground/80 cursor-pointer">
                <input type="checkbox" checked={s.emailNotificationsEnabled}
                  onChange={e => setS(prev => ({ ...prev, emailNotificationsEnabled: e.target.checked }))}
                  className="rounded" />
                Enable email notifications
              </label>
              {/* Notification provider — which cloud account to send from */}
              {s.emailNotificationsEnabled && (
                <div className="mt-3">
                  <label className="block text-xs text-muted-foreground font-semibold uppercase tracking-wide mb-2">
                    Send emails via
                  </label>
                  <div className="flex gap-2 flex-wrap">
                    {(['microsoft', 'google', 'mailto'] as const).map(p => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setS(prev => ({ ...prev, notificationProvider: p as NotificationProvider }))}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                          (s.notificationProvider ?? 'mailto') === p
                            ? 'border-primary bg-primary/10 text-primary'
                            : 'border-border text-muted-foreground hover:border-primary/40'
                        }`}
                      >
                        {p === 'microsoft' ? '📧 Microsoft 365' : p === 'google' ? '✉ Gmail' : '🔗 mailto: link'}
                      </button>
                    ))}
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-1.5">
                    {(s.notificationProvider ?? 'mailto') === 'microsoft'
                      ? 'Sends via your connected Microsoft 365 account through PuddleJumper.'
                      : (s.notificationProvider ?? 'mailto') === 'google'
                      ? 'Sends via your connected Gmail account through PuddleJumper.'
                      : 'Opens your default email client. Connect M365 or Gmail for server-side delivery.'}
                  </p>
                </div>
              )}
            </div>
          </section>

          <section>
            <h3 className="text-sm font-semibold text-foreground mb-3">SLA Override</h3>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Response deadline (business days)</label>
              <input type="number" min={1} max={90}
                value={s.slaDaysOverride ?? ''}
                onChange={e => setS(prev => ({ ...prev, slaDaysOverride: e.target.value ? parseInt(e.target.value) : undefined }))}
                placeholder="10 (statutory default)"
                className="w-48 bg-card border border-border text-foreground rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-200" />
              <p className="text-xs text-muted-foreground mt-1">Leave blank to use the module's statutory default (10 days for PRR).</p>
            </div>
          </section>

          <section>
            <h3 className="text-sm font-semibold text-foreground mb-3">Accent Color</h3>
            <div className="flex items-center gap-4">
              {['#6366f1', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'].map(c => (
                <button key={c} onClick={() => setS(prev => ({ ...prev, accentColor: c }))}
                  className={`w-7 h-7 rounded-full border-2 transition-all ${s.accentColor === c ? 'border-white scale-110' : 'border-transparent hover:scale-105'}`}
                  style={{ background: c }} />
              ))}
              <input type="color" value={s.accentColor ?? '#4ade80'}
                onChange={e => setS(prev => ({ ...prev, accentColor: e.target.value }))}
                className="w-7 h-7 rounded-full border border-border cursor-pointer bg-transparent" title="Custom color" />
            </div>
          </section>

          </>)}

          {/* ── TRAINING TAB ── */}
          {stab === 'training' && (<>

          {/* Training Links */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-foreground">Training Resources</h3>
              <button onClick={() => setS(prev => ({
                ...prev,
                trainingLinks: [...(prev.trainingLinks ?? []), { id: uuid(), title: '', url: '', description: '' }]
              }))} className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1 transition-colors">
                <Plus size={13} /> Add
              </button>
            </div>

            {/* Statutory references — always shown */}
            <div className="mb-3 rounded-lg bg-slate-700/40 border border-border px-4 py-3">
              <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Statutory References (auto-included)</div>
              <div className="space-y-1.5 text-xs text-muted-foreground">
                {meta?.mglCitation && <div>📖 {meta.mglCitation}</div>}
                <div>🔗 <a href="https://malegislature.gov" target="_blank" className="underline hover:text-indigo-600">malegislature.gov</a></div>
                <div>🔗 <a href="https://www.sec.state.ma.us/pre/preidx.htm" target="_blank" className="underline hover:text-indigo-600">MA Supervisor of Records</a></div>
              </div>
            </div>

            {(s.trainingLinks ?? []).length === 0 ? (
              <div className="text-sm text-muted-foreground text-center py-3 border border-dashed border-border rounded-xl">
                No custom training links. Add SOPs, internal wikis, or training videos.
              </div>
            ) : (
              <div className="space-y-2">
                {(s.trainingLinks ?? []).map((t, i) => (
                  <div key={t.id} className="flex items-center gap-2 bg-card border border-border rounded-lg px-3 py-2">
                    <span className="text-base">📄</span>
                    <div className="flex-1 grid grid-cols-2 gap-2">
                      <input type="text" value={t.title} placeholder="Title" onChange={e => {
                        const links = [...(s.trainingLinks ?? [])]
                        links[i] = { ...links[i], title: e.target.value }
                        setS(prev => ({ ...prev, trainingLinks: links }))
                      }} className="bg-slate-700 border border-border text-foreground rounded px-2 py-1 text-xs focus:outline-none focus:border-indigo-500" />
                      <input type="url" value={t.url} placeholder="https://…" onChange={e => {
                        const links = [...(s.trainingLinks ?? [])]
                        links[i] = { ...links[i], url: e.target.value }
                        setS(prev => ({ ...prev, trainingLinks: links }))
                      }} className="bg-slate-700 border border-border text-foreground rounded px-2 py-1 text-xs focus:outline-none focus:border-indigo-500" />
                    </div>
                    <button onClick={() => setS(prev => ({ ...prev, trainingLinks: (prev.trainingLinks ?? []).filter(l => l.id !== t.id) }))}
                      className="text-muted-foreground hover:text-red-400 transition-colors"><X size={12} /></button>
                  </div>
                ))}
              </div>
            )}

            {s.updatedAt && (
              <div className="mt-3 text-xs text-muted-foreground">Last updated: {fmtTs(s.updatedAt)}</div>
            )}
          </section>

          {/* Curated PRR Training (for VAULTPRR) */}
          {moduleId === 'VAULTPRR' && (
            <section>
              <h3 className="text-sm font-semibold text-foreground mb-3">Official PRR Training Resources</h3>
              <div className="space-y-2">
                {[
                  { icon: '🏛️', title: 'MA Supervisor of Records — Public Records Guide', url: 'https://www.sec.state.ma.us/pre/preidx.htm' },
                  { icon: '📖', title: 'M.G.L. c. 66 — Public Records Law (full text)', url: 'https://malegislature.gov/Laws/GeneralLaws/PartI/TitleX/Chapter66/Section10' },
                  { icon: '📋', title: 'M.G.L. c. 4, §7(26) — Exemptions (full list)', url: 'https://malegislature.gov/Laws/GeneralLaws/PartI/TitleI/Chapter4/Section7' },
                  { icon: '📚', title: '950 CMR 32.00 — Public Records Regulations', url: 'https://www.sec.state.ma.us/pre/prepdf/950cmr32.pdf' },
                  { icon: '🎓', title: 'MCATA — RAO Training Program', url: 'https://www.mma.org/resource/public-records-access-officer-training/' },
                  { icon: '📊', title: 'Annual PRR Reporting to Supervisor of Records', url: 'https://www.sec.state.ma.us/pre/preannrep.htm' },
                ].map(r => (
                  <a key={r.url} href={r.url} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-3 bg-card border border-border rounded-lg px-3 py-2.5 hover:border-indigo-600/50 transition-colors group">
                    <span className="text-base flex-shrink-0">{r.icon}</span>
                    <div className="text-xs text-muted-foreground group-hover:text-foreground/90 transition-colors min-w-0 truncate">{r.title}</div>
                    <span className="text-muted-foreground ml-auto flex-shrink-0">→</span>
                  </a>
                ))}
              </div>
            </section>
          )}

          {/* Curated Dog Licensing Training (for VAULTDOG) */}
          {moduleId === 'VAULTDOG' && (
            <section>
              <h3 className="text-sm font-semibold text-foreground mb-3">🐾 MA Dog Licensing — ACO Training Guide</h3>

              {/* Law summary */}
              <div className="rounded-lg bg-slate-700/40 border border-border px-4 py-3 mb-3 space-y-2">
                <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">Key Statutes — M.G.L. c.140</div>
                {[
                  { sec: '§137', text: 'Annual license required for every dog 6+ months old. Issued by city/town clerk or licensing authority. Dogs must wear tag at all times.' },
                  { sec: '§139', text: 'Fee set by municipality. Reduced fee for spayed/neutered dogs. Exemptions: service dogs, dogs owned by persons 70+ years old.' },
                  { sec: '§140', text: 'Dog must wear license tag attached to collar at all times when off owner\'s premises.' },
                  { sec: '§145B', text: 'Rabies vaccination required. Current certificate from licensed vet must accompany application. Vet issues rabies tag as well.' },
                  { sec: '§151', text: 'ACO powers: may seize unlicensed or dangerous dogs, execute warrants, impound pending hearings.' },
                  { sec: '§155', text: 'STRICT LIABILITY for dog bites — owner liable regardless of prior notice of viciousness. Defenses: victim trespassing, victim provoked, victim under 7 presumed non-provoking.' },
                  { sec: '§157', text: 'Nuisance/dangerous dog hearing: licensing authority must hold hearing within 10 days of complaint. Dog may be ordered destroyed, muzzled, or confined.' },
                ].map(r => (
                  <div key={r.sec} className="flex gap-2 text-xs">
                    <span className="text-amber-400 font-mono w-10 shrink-0 pt-0.5">{r.sec}</span>
                    <span className="text-muted-foreground">{r.text}</span>
                  </div>
                ))}
              </div>

              {/* Intake procedure */}
              <div className="rounded-lg bg-slate-700/40 border border-border px-4 py-3 mb-3">
                <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Intake Procedure</div>
                <ol className="text-xs text-muted-foreground space-y-1 list-decimal list-inside">
                  <li>Collect owner info (name, address, phone, email)</li>
                  <li>Collect dog info (name, breed, color, sex, DOB, altered status)</li>
                  <li>Verify rabies certificate — check expiration and vet license number</li>
                  <li>Collect license fee: $5.00 (altered) / $10.00 (intact) — or note exemption</li>
                  <li>Issue receipt and record in system</li>
                  <li>Issue license tag — attach year + sequence number</li>
                  <li>Remind owner: dog must wear tag at all times (§140)</li>
                </ol>
              </div>

              {/* Bite protocol */}
              <div className="rounded-lg bg-amber-900/20 border border-amber-700/40 px-4 py-3 mb-3">
                <div className="text-xs font-bold text-amber-400 uppercase tracking-wider mb-2">⚠ Bite Protocol (§155)</div>
                <ol className="text-xs text-muted-foreground space-y-1 list-decimal list-inside">
                  <li>Collect incident details: victim, location, date/time, circumstances</li>
                  <li>Verify dog rabies status immediately — if expired/unknown, notify Board of Health for quarantine order (M.G.L. c.129 §21)</li>
                  <li>Document whether victim was trespassing or provoked the dog (§155 defenses)</li>
                  <li>Note if victim is under 7 years old (presumed non-provoking under §155)</li>
                  <li>File incident report in case file and log in ACO duty log</li>
                  <li>If second incident or severe injury: initiate §157 dangerous dog hearing. Notify owner in writing within 48h.</li>
                  <li>Record retention: minimum 3 years per MA public records law</li>
                </ol>
              </div>

              {/* Official resources */}
              <h3 className="text-sm font-semibold text-foreground mb-2">Official Resources</h3>
              <div className="space-y-2">
                {[
                  { icon: '📖', title: 'M.G.L. c.140 §§137–174 — full dog licensing law', url: 'https://malegislature.gov/Laws/GeneralLaws/PartI/TitleXX/Chapter140' },
                  { icon: '🐶', title: 'MA Animal Control Officers Association (MACO)', url: 'https://www.maco.pet/' },
                  { icon: '💉', title: 'MA Rabies Control — DPH', url: 'https://www.mass.gov/info-details/massachusetts-animal-rabies-control' },
                  { icon: '⚖️', title: 'MA DPH — Animal Bite & Quarantine Protocol', url: 'https://www.mass.gov/info-details/report-an-animal-bite-in-massachusetts' },
                  { icon: '🏛️', title: 'MA Municipal Law Network — Dog Officer Resources', url: 'https://www.mma.org' },
                ].map(r => (
                  <a key={r.url} href={r.url} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-3 bg-card border border-border rounded-lg px-3 py-2.5 hover:border-amber-600/50 transition-colors group">
                    <span className="text-base flex-shrink-0">{r.icon}</span>
                    <div className="text-xs text-muted-foreground group-hover:text-foreground/90 transition-colors min-w-0 truncate">{r.title}</div>
                    <span className="text-muted-foreground ml-auto flex-shrink-0">→</span>
                  </a>
                ))}
              </div>
            </section>
          )}

          </>)}

          {/* ── TEAM TAB ── */}
          {stab === 'team' && (
            <TeamAccessTab
              team={s.team ?? []}
              onChange={team => setS(prev => ({ ...prev, team }))}
            />
          )}

        </div>
      </div>
    </div>
  )
}
