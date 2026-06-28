import { useState, useCallback, useEffect, useRef } from 'react'
import type { VaultCase, VaultModuleSettings, CaseAsset, ScopeVersion } from '../types'
import { uuid, appendAudit, enforceT10IfMissed } from '../utils/vaultHelpers'
import { getModuleDef, computeDeadlines } from '../utils/moduleIntakeFields'
import { getVaultModule } from '@/lib/vault-modules'
import { calendarDaysUntil } from '../utils/deadlines'
import { fireVaultEmailTrigger, type VaultEmailVars } from '../utils/sendVaultEmail'
import { generateBossHTML } from '../utils/generateBossHTML'
import { pjApi } from '@/services/pjApi'
import { createLogger } from '@/lib/logger'

const logger = createLogger('CaseDetail')

export type DetailTab = 'overview' | 'stage' | 'approvals' | 'assets' | 'builder' | 'tasks' | 'audit'

export function useCaseDetail(
  vaultCase: VaultCase,
  onUpdate: (c: VaultCase) => void,
  actor: string,
  settings: VaultModuleSettings,
  connectorProvider: string,
) {
  const [tab, setTab] = useState<DetailTab>('overview')
  const [stageForm, setStageForm] = useState<Record<string, string>>(
    vaultCase.processing[vaultCase.currentStage] ?? {}
  )
  const [scopeEdit, setScopeEdit] = useState(false)
  const [newScope, setNewScope] = useState(vaultCase.scopeDefinition)
  const [scopeReason, setScopeReason] = useState('')
  const [addAsset, setAddAsset] = useState(false)
  const [assetForm, setAssetForm] = useState({ type: '', filename: '', description: '', retention: 'REFERENCE' as const })
  const [closeDialog, setCloseDialog] = useState(false)
  const [closureReason, setClosureReason] = useState('')
  const [t25Gate, setT25Gate] = useState<{ show: boolean; agreed?: boolean; petitioned?: boolean }>({ show: false })
  const [backupStatus, setBackupStatus] = useState('')
  const [saving, setSaving] = useState(false)
  const enforcedRef = useRef(false)

  // Builder tab state
  const [builderTitle, setBuilderTitle] = useState('')
  const [builderContent, setBuilderContent] = useState('')
  const [builderTemplate, setBuilderTemplate] = useState('blank')
  const [builderSaveStatus, setBuilderSaveStatus] = useState('')
  const [builderSaving, setBuilderSaving] = useState(false)

  const mod = getModuleDef(vaultCase.moduleId)
  const meta = getVaultModule(vaultCase.moduleId)
  const stageDef = mod.stageFields[vaultCase.currentStage]
  const currentStageIdx = mod.stages.indexOf(vaultCase.currentStage)
  const isClosed = vaultCase.currentStage === 'CLOSED'

  // T10 enforcement runs once on mount per case load
  useEffect(() => {
    if (enforcedRef.current) return
    enforcedRef.current = true
    const enforced = enforceT10IfMissed(vaultCase)
    if (enforced) onUpdate(enforced)
  }, [vaultCase.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const update = useCallback((c: VaultCase) => onUpdate(c), [onUpdate])

  // Stage form sync when case changes
  useEffect(() => {
    setStageForm(vaultCase.processing[vaultCase.currentStage] ?? {})
  }, [vaultCase.currentStage, vaultCase.id, vaultCase.processing])

  const setField = (k: string, v: string) => setStageForm(prev => ({ ...prev, [k]: v }))

  const saveStageData = () => {
    const updated: VaultCase = {
      ...vaultCase,
      processing: { ...vaultCase.processing, [vaultCase.currentStage]: stageForm }
    }
    update(appendAudit(updated, actor, 'UPDATE', `Stage data saved: ${vaultCase.currentStage}`))
  }

  const markDeadlineMet = (key: string) => {
    const dl = vaultCase.deadlines[key]
    if (!dl || dl.status === 'MET') return
    update(appendAudit({
      ...vaultCase,
      deadlines: { ...vaultCase.deadlines, [key]: { ...dl, status: 'MET', metAt: new Date().toISOString() } }
    }, actor, 'DEADLINE_MET', `${dl.label} marked as MET`))
  }

  const checkT25Gate = (): boolean => {
    if (vaultCase.moduleId !== 'VAULTPRR') return true
    if (vaultCase.currentStage !== 'ASSESSMENT') return true
    const t25 = vaultCase.deadlines['T25']
    if (!t25 || !t25.dueDate) return true
    const { agreed, petitioned } = t25Gate
    if (agreed || petitioned) return true
    const daysLeft = calendarDaysUntil(t25.dueDate)
    if (daysLeft <= 3) {
      setT25Gate({ show: true })
      return false
    }
    return true
  }

  const advanceStage = () => {
    if (isClosed) return
    const stageDef = mod.stageFields[vaultCase.currentStage]

    if (stageDef?.requiredToAdvance) {
      const missing = stageDef.requiredToAdvance.filter(k => !stageForm[k]?.trim())
      if (missing.length > 0) {
        alert(`Complete required fields first:\n${missing.map(k => stageDef.fields.find(f => f.key === k)?.label ?? k).join('\n')}`)
        return
      }
    }

    if (!checkT25Gate()) return

    const nextStage = mod.stages[currentStageIdx + 1]
    if (!nextStage || nextStage === 'CLOSED') {
      setCloseDialog(true)
      return
    }

    let updated: VaultCase = {
      ...vaultCase,
      processing: { ...vaultCase.processing, [vaultCase.currentStage]: stageForm },
      currentStage: nextStage
    }
    const enforced = enforceT10IfMissed(updated)
    if (enforced) updated = enforced

    updated = appendAudit(updated, actor, 'STAGE_TRANSITION', `Advanced from ${vaultCase.currentStage} to ${nextStage}`)
    update(updated)
    const _stageVars: VaultEmailVars = {
      requesterName: vaultCase.subject.requesterName ?? vaultCase.subject.name ?? 'Requester',
      caseNumber: vaultCase.caseNumber,
      town: settings.municipalityName ?? vaultCase.moduleId,
      stage: nextStage,
      raoName: settings.raos?.[0]?.name ?? 'Records Access Officer',
    }
    fireVaultEmailTrigger('STAGE_CHANGE', settings, _stageVars, {
      requesterEmail: vaultCase.subject.requesterEmail ?? vaultCase.subject.email,
      triggerStage: nextStage,
    }).catch(() => {})
    setTab('stage')
  }

  const closeCase = async () => {
    if (!closureReason) { alert('Select a closure reason'); return }
    setSaving(true)
    const now = Date.now()
    const closedDeadlines = { ...vaultCase.deadlines }
    if (vaultCase.moduleId === 'VAULTPRR') {
      const t90Def = mod.deadlineDefs.find(d => d.key === 'T90')
      if (t90Def) {
        const computed = computeDeadlines([t90Def], vaultCase.createdAt, now)
        if (computed['T90']) {
          closedDeadlines['T90'] = { key: 'T90', label: 'T90 Appeal Window', dueDate: computed['T90'].dueDate, status: 'OPEN' }
        }
      }
    }

    let closed: VaultCase = {
      ...vaultCase,
      processing: { ...vaultCase.processing, [vaultCase.currentStage]: stageForm },
      currentStage: 'CLOSED',
      closureReason,
      closedAt: now,
      deadlines: closedDeadlines
    }
    closed = appendAudit(closed, actor, 'CLOSE', `Case closed. Reason: ${closureReason}. Assets locked where required.`)

    closed = {
      ...closed,
      assets: closed.assets.map(a => a.retentionClass === 'KEEPER' && !a.isLocked
        ? { ...a, isLocked: true, lockedAt: now, lockedBy: actor } : a)
    }

    try {
      const html = await generateBossHTML(closed, '', connectorProvider)
      const filename = `${closed.caseNumber}-${closureReason.toLowerCase().replace(/\s/g, '-')}.html`

      if (connectorProvider && connectorProvider !== 'none') {
        try {
          const b64 = btoa(unescape(encodeURIComponent(html)))
          await pjApi.cloudSave({
            provider: connectorProvider as 'google' | 'microsoft' | 'github',
            filename,
            contentBase64: b64,
            mimeType: 'text/html'
          })
          closed = appendAudit(closed, actor, 'BACKUP', `Boss HTML backed up to ${connectorProvider.toUpperCase()}: ${filename}`)
          setBackupStatus(`✓ Backed up to ${connectorProvider.toUpperCase()}`)
        } catch {
          setBackupStatus('Backup failed — download manually')
        }
      }

      const blob = new Blob([html], { type: 'text/html' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url; a.download = filename; a.click()
      URL.revokeObjectURL(url)
    } catch (error) {
      logger.error('Failed to generate executive HTML output for the case.', error, { caseId: vaultCase.id })
    }

    update(closed)
    if (vaultCase.pjPrrId) {
      pjApi.prr.close(vaultCase.pjPrrId, closureReason || 'Closed').catch(() => {})
    }
    setCloseDialog(false)
    setSaving(false)
  }

  const submitAsset = () => {
    if (!assetForm.filename.trim()) { alert('Filename required'); return }
    const asset: CaseAsset = {
      id: uuid(), assetType: assetForm.type || 'General', filename: assetForm.filename,
      description: assetForm.description, retentionClass: assetForm.retention as CaseAsset['retentionClass'],
      isLocked: false, createdAt: Date.now(), createdBy: actor, tags: []
    }
    const updated = appendAudit({ ...vaultCase, assets: [...vaultCase.assets, asset] },
      actor, 'ASSET_ADD', `Asset added: ${asset.filename} (${asset.retentionClass})`, { assetIds: [asset.id] })
    update(updated); setAddAsset(false); setAssetForm({ type: '', filename: '', description: '', retention: 'REFERENCE' })
  }

  const lockAsset = (assetId: string) => {
    if (!confirm('Lock this record? It cannot be edited after locking. To make a correction, create a new version.')) return
    const now = Date.now()
    const updated = appendAudit({
      ...vaultCase,
      assets: vaultCase.assets.map(a => a.id === assetId ? { ...a, isLocked: true, lockedAt: now, lockedBy: actor } : a)
    }, actor, 'ASSET_LOCK', `Asset LOCKED: ${vaultCase.assets.find(a => a.id === assetId)?.filename}`, { assetIds: [assetId] })
    update(updated)
  }

  const updateScope = () => {
    if (!newScope.trim()) return
    if (!scopeReason.trim()) { alert('Reason required for scope change'); return }
    const prev: ScopeVersion = {
      version: vaultCase.scopeVersion,
      definition: vaultCase.scopeDefinition,
      changedAt: Date.now(),
      changedBy: actor,
      reason: scopeReason
    }
    const updated = appendAudit({
      ...vaultCase,
      scopeDefinition: newScope,
      scopeVersion: vaultCase.scopeVersion + 1,
      scopeHistory: [...vaultCase.scopeHistory, prev]
    }, actor, 'UPDATE', `Scope updated to v${vaultCase.scopeVersion + 1}. Reason: ${scopeReason}`)
    update(updated); setScopeEdit(false); setScopeReason('')
  }

  const mailtoRAO = (subject: string, body: string) => {
    const emails = settings.raos.map(r => r.email).filter(Boolean).join(',')
    if (!emails) { alert('No Records Officer email configured — go to Settings to add officers'); return }
    window.open(`mailto:${emails}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`)
  }

  return {
    // State
    tab, setTab,
    stageForm, setStageForm,
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
    // Derived
    mod, meta, stageDef, currentStageIdx, isClosed,
    // Callbacks
    update,
    setField,
    saveStageData,
    markDeadlineMet,
    checkT25Gate,
    advanceStage,
    closeCase,
    submitAsset,
    lockAsset,
    updateScope,
    mailtoRAO,
  }
}
