import { useCallback } from 'react'
import { toast } from 'sonner'
import type { VaultCase, VaultModuleSettings } from '../types'
import { generatePublicForm } from '../utils/generatePublicForm'
import { generateBossHTML } from '../utils/generateBossHTML'
import { getVaultModule } from '@/lib/vault-modules'
import { pjApi } from '@/services/pjApi'
import { createLogger } from '@/lib/logger'
import { defaultSettings, slugifyName, fmtDate, downloadArtifact, utf8ToBase64 } from '../utils/vaultHelpers'

const logger = createLogger('useVaultExports')

export function useVaultExports({
  envId, town, modules, normalizedCases, allSettings, exportBusyId: _exportBusyId, setExportBusyId
}: {
  envId: string
  town: string
  modules: string[]
  normalizedCases: VaultCase[]
  allSettings: Record<string, VaultModuleSettings>
  exportBusyId: string | null
  setExportBusyId: (id: string | null) => void
}) {
  const createPublicFormArtifact = useCallback((moduleId: string) => {
    const settings = allSettings[moduleId] ?? defaultSettings(moduleId, envId)
    return {
      filename: `${slugifyName(town)}-${moduleId.toLowerCase()}-public-form.html`,
      mimeType: 'text/html',
      content: generatePublicForm(moduleId, settings, town),
    }
  }, [allSettings, envId, town])

  const buildExecutiveUpdate = useCallback(() => {
    const openCases = normalizedCases.filter(c => c.currentStage !== 'CLOSED')
    const lines = openCases
      .slice(0, 5)
      .map((c) => {
        const nextDeadline = Object.values(c.deadlines)
          .filter(d => d.status === 'OPEN' && d.dueDate)
          .sort((a, b) => a.dueDate.localeCompare(b.dueDate))[0]
        const summary = Object.values(c.subject).filter(Boolean).slice(0, 2).join(' · ') || c.caseType
        return `- ${c.caseNumber} (${c.moduleId.replace('VAULT', '')}): ${summary}${nextDeadline ? ` — next due ${fmtDate(nextDeadline.dueDate)}` : ''}`
      })
      .join('\n')

    return `${town} — Municipal Operations Summary

${town} is running ${modules.length} active modules on Workspace, with statute-enforced deadlines and full audit history on every case.

Current snapshot:
- ${openCases.length} active case${openCases.length !== 1 ? 's' : ''} across ${modules.length} module${modules.length !== 1 ? 's' : ''}
- Public intake pages available for all modules
- Executive updates and archive packets available on demand

Active cases:
${lines || '- No open cases at this time.'}

Workspace handles intake, compliance, notifications, and retention — all in one place.`
  }, [modules.length, normalizedCases, town])

  const handleCopyExecutiveUpdate = useCallback(async () => {
    setExportBusyId('copy-update')
    const content = buildExecutiveUpdate()
    try {
      await navigator.clipboard.writeText(content)
      toast.success('Executive update copied — paste it into an email or text.')
    } catch {
      downloadArtifact(`${slugifyName(town)}-workspace-demo-follow-up.txt`, content, 'text/plain')
      toast.success('Clipboard was blocked, so a ready-to-send follow-up was downloaded instead.')
    } finally {
      setExportBusyId(null)
    }
  }, [buildExecutiveUpdate, setExportBusyId, town])

  const handleDownloadPublicForms = useCallback(() => {
    setExportBusyId('download-forms')
    try {
      modules.forEach((moduleId) => {
        const artifact = createPublicFormArtifact(moduleId)
        downloadArtifact(artifact.filename, artifact.content, artifact.mimeType)
      })
      toast.success(`Downloaded ${modules.length} working intake form${modules.length === 1 ? '' : 's'}.`)
    } finally {
      setExportBusyId(null)
    }
  }, [createPublicFormArtifact, modules, setExportBusyId])

  const handleExportOperationsPack = useCallback(async () => {
    setExportBusyId('provision-pack')
    const dateStamp = new Date().toISOString().slice(0, 10)
    const openCases = normalizedCases.filter(c => c.currentStage !== 'CLOSED')
    const closedCases = normalizedCases.filter(c => c.currentStage === 'CLOSED')
    const moduleManifest = modules.map((moduleId) => {
      const settings = allSettings[moduleId] ?? defaultSettings(moduleId, envId)
      return {
        moduleId,
        name: getVaultModule(moduleId)?.name ?? moduleId,
        primaryOfficer: settings.raos.find(rao => rao.isPrimary)?.name ?? settings.raos[0]?.name ?? null,
        primaryOfficerEmail: settings.raos.find(rao => rao.isPrimary)?.email ?? settings.raos[0]?.email ?? null,
        trainingLinks: settings.trainingLinks?.length ?? 0,
        activeCases: normalizedCases.filter(c => c.moduleId === moduleId && c.currentStage !== 'CLOSED').length,
      }
    })
    const artifacts = [
      {
        filename: `${slugifyName(town)}-ops-flythrough-${dateStamp}.md`,
        mimeType: 'text/markdown',
        content: `# ${town} — Workspace Operations Overview

## What's active
1. Open the approvals queue to see work in motion.
2. Open any case in HR, payroll, or DPW for a detailed view.
3. Download public intake forms for deployable front-door pages.
4. Export the archive packet to see the full case closeout record.

## Live cases
${openCases.map(c => `- ${c.caseNumber}: ${Object.values(c.subject).filter(Boolean).slice(0, 2).join(' · ') || c.caseType}`).join('\n') || '- No active cases at this time.'}

## Why this matters
- Module ownership: every module has a named officer, chain of escalation, and statute citations.
- LogicDash: deadlines and activity summarized instantly for leadership.
- SYNCHRON8: the same workspace can emit an automation blueprint without custom development.

## Next steps
Use the generated public forms and status report to continue the conversation.`,
      },
      {
        filename: `${slugifyName(town)}-town-manager-briefing-${dateStamp}.md`,
        mimeType: 'text/markdown',
        content: buildExecutiveUpdate(),
      },
      {
        filename: `${slugifyName(town)}-ops-hotlist-${dateStamp}.csv`,
        mimeType: 'text/csv',
        content: [
          'case_number,module,stage,summary,next_deadline',
          ...normalizedCases.filter(c => c.currentStage !== 'CLOSED').map((c) => {
            const nextDeadline = Object.values(c.deadlines)
              .filter(d => d.status === 'OPEN' && d.dueDate)
              .sort((a, b) => a.dueDate.localeCompare(b.dueDate))[0]
            const summary = (Object.values(c.subject).filter(Boolean).slice(0, 2).join(' · ') || c.caseType).replace(/"/g, '""')
            return `${c.caseNumber},${c.moduleId.replace('VAULT', '')},${c.currentStage},"${summary}",${nextDeadline?.dueDate ?? ''}`
          }),
        ].join('\n'),
      },
      {
        filename: `${slugifyName(town)}-module-provisioning-manifest-${dateStamp}.json`,
        mimeType: 'application/json',
        content: JSON.stringify({
          town,
          environmentId: envId,
          generatedAt: new Date().toISOString(),
          moduleCount: modules.length,
          modules: moduleManifest,
        }, null, 2),
      },
      {
        filename: `${slugifyName(town)}-logicdash-snapshot-${dateStamp}.md`,
        mimeType: 'text/markdown',
        content: `# ${town} — LogicDash Snapshot

## Live counts
- Open cases: ${openCases.length}
- Closed cases: ${closedCases.length}
- Modules configured: ${modules.length}

## At-a-glance deadlines
${openCases.map((c) => {
  const nextDeadline = Object.values(c.deadlines)
    .filter(d => d.status === 'OPEN' && d.dueDate)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))[0]
  return `- ${c.caseNumber}: ${c.currentStage}${nextDeadline ? ` — ${nextDeadline.label} due ${fmtDate(nextDeadline.dueDate)}` : ''}`
}).join('\n') || '- No active deadlines right now.'}

## Recent modules in motion
${moduleManifest.map((m) => `- ${m.name}: ${m.activeCases} active case(s) · lead ${m.primaryOfficer ?? 'unassigned'}`).join('\n')}`,
      },
      {
        filename: `${slugifyName(town)}-synchron8-automation-blueprint-${dateStamp}.json`,
        mimeType: 'application/json',
        content: JSON.stringify({
          name: `${town} Executive Deadline Digest`,
          description: 'Daily municipal digest generated from live VAULT modules.',
          complianceProfile: 'municipal-core-v1',
          trigger: {
            type: 'schedule',
            cron: '0 7 * * 1-5',
            scope: envId,
          },
          steps: [
            { type: 'logicdash_snapshot', envId, outputs: ['overdue', 'due_soon', 'activity'] },
            { type: 'generate_briefing', template: 'town-manager-briefing', town },
            { type: 'send_alert', role: 'town-manager', channel: 'email', subject: `${town} morning deadline digest` },
          ],
          modules: modules.map((moduleId) => ({
            id: moduleId,
            activeCases: normalizedCases.filter(c => c.moduleId === moduleId && c.currentStage !== 'CLOSED').length,
          })),
        }, null, 2),
      },
      ...modules.map(createPublicFormArtifact),
    ]

    try {
      for (const artifact of artifacts) {
        await pjApi.vaultFiles.upload({
          name: artifact.filename,
          mimeType: artifact.mimeType,
          size: new Blob([artifact.content]).size,
          contentBase64: utf8ToBase64(artifact.content),
        })
      }
      toast.success(`Operations pack exported — ${artifacts.length} files ready.`)
    } catch (error) {
      artifacts.forEach((artifact) => downloadArtifact(artifact.filename, artifact.content, artifact.mimeType))
      toast.success('Fell back to direct downloads — all operations pack files downloaded.')
      logger.error('Operations pack upload fell back to direct downloads.', error, { artifactCount: artifacts.length })
    } finally {
      setExportBusyId(null)
    }
  }, [allSettings, buildExecutiveUpdate, createPublicFormArtifact, envId, modules, normalizedCases, setExportBusyId, town])

  const handleExportArchivePacket = useCallback(async () => {
    setExportBusyId('archive-packet')
    const closedCase = normalizedCases.find(c => c.currentStage === 'CLOSED')
    if (!closedCase) {
      toast.error('No closed demo case is available yet for archive export.')
      setExportBusyId(null)
      return
    }

    try {
      const html = await generateBossHTML(closedCase, town)
      downloadArtifact(`${closedCase.caseNumber}-archive-demo.html`, html, 'text/html')
      toast.success(`Archive packet exported for ${closedCase.caseNumber}.`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to export archive packet.')
    } finally {
      setExportBusyId(null)
    }
  }, [normalizedCases, setExportBusyId, town])

  return { createPublicFormArtifact, buildExecutiveUpdate, handleCopyExecutiveUpdate, handleDownloadPublicForms, handleExportOperationsPack, handleExportArchivePacket }
}
