import { useState } from 'react'
import { ArrowLeft, Warning } from '@phosphor-icons/react'
import type { VaultCase, VaultModuleSettings } from '../types'
import { getModuleDef, computeDeadlines } from '../utils/moduleIntakeFields'
import { getVaultModule } from '@/lib/vault-modules'
import { uuid, fmtDate, generateCaseNumber } from '../utils/vaultHelpers'
import { pjApi } from '@/services/pjApi'
import { fireVaultEmailTrigger, type VaultEmailVars } from '../utils/sendVaultEmail'

export function CaseIntake({ moduleId, settings, existingCases, actor, onSubmit, onBack }: {
  moduleId: string
  settings: VaultModuleSettings
  existingCases: VaultCase[]
  actor: string
  onSubmit: (c: VaultCase) => void
  onBack: () => void
}) {
  const mod = getModuleDef(moduleId)
  const meta = getVaultModule(moduleId)
  const [form, setForm] = useState<Record<string, string>>({})
  const [scope, setScope] = useState('')
  const [rao, setRao] = useState(settings.raos.find(r => r.isPrimary)?.name || '')
  const [error, setError] = useState('')

  const set = (k: string, v: string) => setForm(prev => ({ ...prev, [k]: v }))

  const handleSubmit = async () => {
    // Check required fields
    const missing = mod.intakeFields.filter(f => f.required && !form[f.key]?.trim())
    if (missing.length > 0) { setError(`Required: ${missing.map(f => f.label).join(', ')}`); return }
    if (!scope.trim()) { setError('Scope definition is required'); return }

    const now = Date.now()
    const deadlineComputations = computeDeadlines(mod.deadlineDefs, now)
    const deadlines: VaultCase['deadlines'] = {}
    for (const [key, val] of Object.entries(deadlineComputations)) {
      const def = mod.deadlineDefs.find(d => d.key === key)
      deadlines[key] = { key, label: def?.label ?? key, dueDate: val.dueDate, status: val.status }
    }

    const newCase: VaultCase = {
      id: uuid(),
      caseNumber: generateCaseNumber(mod.casePrefix, existingCases),
      moduleId,
      envId: '',
      caseType: meta?.name ?? moduleId,
      createdAt: now,
      createdBy: actor,
      subject: { ...form },
      scopeDefinition: scope,
      scopeVersion: 1,
      scopeHistory: [],
      deadlines,
      tollingHistory: [],
      enforcementFlags: { feesAllowed: true },
      currentStage: mod.stages[0],
      transitionBlockers: [],
      processing: {},
      assets: [],
      auditLog: [{
        id: uuid(), timestamp: now, actor,
        action: 'CREATE',
        notes: `Case created. Stage: ${mod.stages[0]}. Deadlines computed from effective receipt date.`,
        ruleApplied: meta?.mglCitation
      }],
      assignedRAO: rao,
      approvals: [],
      notes: ''
    }
    // Best-effort sync to PuddleJumper
    let pjCase = { ...newCase }
    try {
      const tenantId = actor.split('@')[1]?.replace('.gov', '') || 'unknown'
      if (moduleId === 'VAULTDOG') {
        // Dog license → PJ dog endpoint
        const pjResult = await pjApi.dog.apply({
          tenantId,
          ownerName:    form['ownerName']    || 'Unknown Owner',
          ownerEmail:   form['ownerEmail']   || undefined,
          ownerAddress: form['ownerAddress'] || undefined,
          ownerPhone:   form['ownerPhone']   || undefined,
          dogName:      form['dogName']      || newCase.caseNumber,
          dogBreed:     form['dogBreed']     || 'Unknown',
          dogColor:     form['dogColor']     || undefined,
          dogSex:       form['dogSex']?.startsWith('F') ? 'F' : form['dogSex']?.startsWith('M') ? 'M' : undefined,
          dogAltered:   form['dogAltered']?.includes('Spayed') || form['dogAltered']?.includes('Yes'),
          dogDob:       form['dogDob']       || undefined,
          rabiesCert:   form['rabiesCert']   || undefined,
          rabiesExp:    form['rabiesExp']    || undefined,
          veterinarian: form['veterinarian'] || undefined,
          licenseYear:  new Date().getFullYear(),
          assignedTo:   settings.raos?.[0]?.email || undefined,
        })
        if (pjResult?.id) {
          pjCase = { ...pjCase, pjPrrId: pjResult.id, pjPrrPublicId: pjResult.public_id }
        }
      } else {
        // All other modules → PRR intake (generic case tracking)
        const pjResult = await pjApi.prr.intake({
          tenantId,
          requester_name: form['requesterName'] || form['applicantName'] || undefined,
          requester_email: form['requesterEmail'] || form['email'] || undefined,
          subject: (form['requestText'] || form['description'] || scope || newCase.caseNumber).slice(0, 512),
          description: form['requestText'] || form['description'] || scope || undefined,
        })
        if (pjResult?.id) {
          pjCase = { ...pjCase, pjPrrId: pjResult.id, pjPrrPublicId: pjResult.public_id, pjPrrTrackingUrl: pjResult.tracking_url }
        }
      }
    } catch {
      // Silent — PJ sync is best-effort; local case creation always succeeds
    }
    // Fire intake email via connected provider
    const _emailVars: VaultEmailVars = {
      requesterName: pjCase.subject.requesterName ?? pjCase.subject.name ?? 'Requester',
      caseNumber: pjCase.caseNumber,
      town: settings.municipalityName ?? moduleId,
      deadline: pjCase.deadlines?.['T10']?.dueDate ?? '',
      raoName: settings.raos?.[0]?.name ?? 'Records Access Officer',
      stage: pjCase.currentStage,
    }
    fireVaultEmailTrigger('INTAKE_RECEIVED', settings, _emailVars, {
      requesterEmail: pjCase.subject.requesterEmail ?? pjCase.subject.email,
    }).catch(() => {})
    onSubmit(pjCase)
  }

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="flex items-center gap-3 px-6 py-4 border-b border-border flex-shrink-0 bg-card">
        <button aria-label="Go back" onClick={onBack} className="text-muted-foreground hover:text-foreground/80 transition-colors"><ArrowLeft size={18} /></button>
        <div>
          <div className="text-xs text-indigo-500 font-bold uppercase tracking-wider">{moduleId.replace('VAULT', '')} — New Case</div>
          <div className="font-semibold text-foreground">Intake Form</div>
        </div>
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-6 py-8 space-y-6">
          {error && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-700 text-red-300 rounded-lg px-4 py-3 text-sm">
              <Warning size={16} />{error}
            </div>
          )}

          {/* Subject fields */}
          <div>
            <h3 className="text-sm font-semibold text-foreground mb-4">Requester / Subject Information</h3>
            <div className="space-y-4">
              {mod.intakeFields.map(f => (
                <div key={f.key}>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">
                    {f.label}{f.required && <span className="text-red-400 ml-1">*</span>}
                  </label>
                  {f.type === 'textarea' ? (
                    <textarea
                      rows={3}
                      value={form[f.key] ?? ''}
                      onChange={e => set(f.key, e.target.value)}
                      placeholder={f.placeholder}
                      className="w-full bg-card border border-border text-foreground rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-200"
                    />
                  ) : f.type === 'select' ? (
                    <select
                      value={form[f.key] ?? ''}
                      onChange={e => set(f.key, e.target.value)}
                      className="w-full bg-card border border-border text-foreground rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-200"
                    >
                      <option value="">Select…</option>
                      {f.options?.map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                  ) : (
                    <input
                      type={f.type === 'phone' ? 'tel' : f.type === 'number' ? 'number' : f.type === 'email' ? 'email' : f.type === 'date' ? 'date' : 'text'}
                      value={form[f.key] ?? ''}
                      onChange={e => set(f.key, e.target.value)}
                      placeholder={f.placeholder}
                      className="w-full bg-card border border-border text-foreground rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-200"
                    />
                  )}
                  {f.hint && <p className="text-xs text-muted-foreground mt-1">{f.hint}</p>}
                </div>
              ))}
            </div>
          </div>

          {/* Scope */}
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">
              Scope Description <span className="text-red-400">*</span>
            </label>
            <textarea
              rows={4}
              value={scope}
              onChange={e => setScope(e.target.value)}
              placeholder="Describe exactly what records or work this case covers. Be specific — this definition is versioned and may not be informally changed."
              className="w-full bg-card border border-border text-foreground rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-200"
            />
            <p className="text-xs text-muted-foreground mt-1">This scope is version-controlled. Changes create a new version with a reason.</p>
          </div>

          {/* RAO Assignment */}
          {settings.raos.length > 0 && (
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Assign Records Officer</label>
              <select
                value={rao}
                onChange={e => setRao(e.target.value)}
                className="w-full bg-card border border-border text-foreground rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-200"
              >
                <option value="">Unassigned</option>
                {settings.raos.map(r => (
                  <option key={r.id} value={r.name}>{r.name}{r.isPrimary ? ' (Primary RAO)' : ''}</option>
                ))}
              </select>
            </div>
          )}

          {/* Deadline preview */}
          {mod.deadlineDefs.length > 0 && (
            <div className="bg-card border border-border rounded-lg p-4 shadow-sm">
              <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">Deadlines (computed at creation)</div>
              <div className="space-y-2">
                {mod.deadlineDefs.filter(d => d.triggersOn === 'creation').map(d => {
                  const computed = computeDeadlines([d], Date.now())
                  const dueDate = computed[d.key]?.dueDate
                  return (
                    <div key={d.key} className="flex justify-between text-sm">
                      <span className="text-muted-foreground">{d.label}</span>
                      <span className="font-mono text-indigo-300">{dueDate ? fmtDate(dueDate) : '—'}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          <button
            onClick={handleSubmit}
            className="w-full bg-indigo-600 hover:bg-indigo-500 text-white py-3 rounded-lg font-semibold text-sm transition-colors"
          >
            Open Case
          </button>
        </div>
      </div>
    </div>
  )
}
