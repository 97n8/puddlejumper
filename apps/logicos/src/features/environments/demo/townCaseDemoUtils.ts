import { MA_MUNICIPALITIES, type Municipality } from '@/data/maMunicipalities'
import type { FileItem } from '@/lib/types'
import { pjApi } from '@/services/pjApi'
import { toast } from 'sonner'
import { createLogger } from '@/lib/logger'
import type {
  DemoModule,
  DemoArtifact,
  TrialApp,
  VaultBuildTemplate,
  LiveTownData,
  DataSource,
} from './townCaseDemoData'
import { PROVISIONING_TOOLS } from './townCaseDemoData'

const logger = createLogger('townCaseDemoUtils')

export function slugifyName(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
}

export function utf8ToBase64(value: string): string {
  return btoa(unescape(encodeURIComponent(value)))
}

export function normalizeValue(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '')
}

export function findMunicipalityByName(value: string): Municipality | null {
  const normalized = normalizeValue(value)
  if (!normalized) return null

  const exactMatch = MA_MUNICIPALITIES.find(municipality => normalizeValue(municipality.name) === normalized)
  if (exactMatch) return exactMatch

  return MA_MUNICIPALITIES.find(municipality => normalizeValue(municipality.name).startsWith(normalized)) ?? null
}

export function formatPopulation(population?: number): string {
  if (!population) return 'Population data available at implementation kickoff'
  return population.toLocaleString()
}

export function formatCurrency(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—'
  if (Math.abs(value) >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`
  return `$${Math.round(value).toLocaleString()}`
}

export function getMunicipalityProfile(population?: number): {
  label: string
  operatingShape: string
  pressureAreas: string[]
} {
  if (!population || population < 7500) {
    return {
      label: 'Lean staff / board-heavy town',
      operatingShape: 'Best fit for step-by-step provisioning, light staffing coverage, and strong continuity rules.',
      pressureAreas: ['Open Meeting Law', 'Public Records', 'Accounts Payable'],
    }
  }

  if (population < 25000) {
    return {
      label: 'General-purpose municipal operator',
      operatingShape: 'Best fit for cross-department dashboards, repeatable approvals, and easier handoffs between town hall teams.',
      pressureAreas: ['Public Records', 'Building Permit', 'Procurement'],
    }
  }

  if (population < 75000) {
    return {
      label: 'Higher-volume service town or small city',
      operatingShape: 'Best fit for queue visibility, audit-ready records, and department-specific module packs with stronger automation.',
      pressureAreas: ['Building Permit', 'Board of Health', 'Payroll / Time'],
    }
  }

  return {
    label: 'City-scale operating environment',
    operatingShape: 'Best fit for phased rollout, department playbooks, and volume-aware triage surfaces across multiple offices.',
    pressureAreas: ['Building Permit', 'Procurement', 'Health / Human Services'],
  }
}

export function estimateModuleVolume(template: VaultBuildTemplate, population?: number): string {
  if (!population) return 'Volume estimate will populate once live town data is connected.'

  const perThousandMap: Record<string, number> = {
    BLD: 14,
    BOH: 11,
    PRR: 9,
    PAY: 26,
    AP: 24,
    PROC: 8,
    ELEC: 6,
    DOG: 15,
    COA: 12,
    UTIL: 18,
  }

  const perThousand = perThousandMap[template.code] ?? 7
  const annualCases = Math.max(18, Math.round((population / 1000) * perThousand))

  if (annualCases < 80) return `${annualCases} projected cases or packets per year`
  if (annualCases < 400) return `${annualCases} projected cases or packets per year`
  return `${Math.round(annualCases / 10) * 10}+ projected cases or packets per year`
}

export function getRecommendedTemplateIds(municipality: Municipality | null): string[] {
  const population = municipality?.population

  if (!population || population < 7500) return ['oml', 'prr', 'ap']
  if (population < 25000) return ['prr', 'bld', 'proc']
  if (population < 75000) return ['bld', 'boh', 'pay']
  return ['bld', 'proc', 'boh']
}

export function mapTemplateIdToModuleId(templateId: string): DemoModule['id'] {
  if (['oml'].includes(templateId)) return 'board_compliance'
  if (['prr'].includes(templateId)) return 'public_records'
  if (['bld', 'boh'].includes(templateId)) return 'permitting'
  if (['pay', 'ap', 'proc'].includes(templateId)) return 'fiscal'
  return 'appointments'
}

export function getPriorityTemplateIdsFromTownData(townData: LiveTownData | null, municipality: Municipality | null): string[] {
  if (!townData) return getRecommendedTemplateIds(municipality)

  const ids = new Set<string>()
  const add = (...items: string[]) => items.forEach(item => ids.add(item))
  const hasFlag = (code: string) => townData.riskFlags.some(flag => flag.code === code)

  if (hasFlag('FREE_CASH_LOW') || hasFlag('FREE_CASH_WATCH') || hasFlag('LEVY_CAPACITY_LOW')) add('proc', 'pay', 'oml')
  if (townData.metrics.totalEmployees !== null && townData.metrics.totalEmployees > 250) add('pay', 'prr')
  if (townData.metrics.totalEmployees !== null && townData.metrics.totalEmployees < 80) add('oml', 'ap')
  if (townData.metrics.totalStateAid !== null && townData.metrics.operatingBudget !== null) {
    const aidPct = townData.metrics.operatingBudget > 0 ? (townData.metrics.totalStateAid / townData.metrics.operatingBudget) * 100 : 0
    if (aidPct > 25) add('proc', 'prr')
  }

  getRecommendedTemplateIds(municipality).forEach(item => ids.add(item))
  return [...ids].slice(0, 4)
}

export function buildTrialAppPreviewDoc(townName: string, app: TrialApp, module: DemoModule): string {
  const fieldRows = app.keyFields.map(field => `<div class="field">${field.replace(/_/g, ' ')}</div>`).join('')

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <style>
      :root { color-scheme: dark; }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        font-family: Inter, ui-sans-serif, system-ui, sans-serif;
        background: linear-gradient(160deg, #020617, #0f172a 60%, #111827);
        color: #e2e8f0;
      }
      .shell { padding: 20px; min-height: 100vh; }
      .card {
        border-radius: 24px;
        border: 1px solid rgba(255,255,255,0.10);
        background: rgba(15,23,42,0.82);
        padding: 20px;
      }
      .eyebrow {
        font-size: 11px;
        text-transform: uppercase;
        letter-spacing: 0.18em;
        color: #cbd5e1;
        font-weight: 700;
      }
      h1 { margin: 10px 0 4px; font-size: 24px; color: white; }
      .subtle { color: #94a3b8; font-size: 13px; line-height: 1.6; }
      .button {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        border-radius: 999px;
        background: white;
        color: #0f172a;
        font-weight: 700;
        padding: 10px 16px;
        margin-top: 16px;
        font-size: 13px;
      }
      .grid {
        margin-top: 18px;
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 12px;
      }
      .tile, .field {
        border-radius: 16px;
        border: 1px solid rgba(255,255,255,0.10);
        background: rgba(2,6,23,0.45);
        padding: 12px 14px;
      }
      .field {
        text-transform: capitalize;
        font-size: 12px;
      }
      .label {
        font-size: 10px;
        text-transform: uppercase;
        letter-spacing: 0.16em;
        color: #94a3b8;
      }
    </style>
  </head>
  <body>
    <div class="shell">
      <div class="card">
        <div class="eyebrow">Enclosed trial app</div>
        <h1>${app.name}</h1>
        <div class="subtle">${app.summary}</div>
        <div class="button">${app.primaryAction}</div>
        <div class="grid">
          <div class="tile">
            <div class="label">Audience</div>
            <div style="margin-top:8px;">${app.audience}</div>
          </div>
          <div class="tile">
            <div class="label">Connected lane</div>
            <div style="margin-top:8px;">${module.label}</div>
          </div>
        </div>
        <div style="margin-top:18px;" class="label">Key fields in this app</div>
        <div style="margin-top:10px; display:grid; grid-template-columns:1fr 1fr; gap:10px;">
          ${fieldRows}
        </div>
      </div>
    </div>
  </body>
</html>`
}

export function buildLogicDocsPreviewDoc(townName: string, module: DemoModule, townContext: string): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <style>
      :root { color-scheme: dark; }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        font-family: Inter, ui-sans-serif, system-ui, sans-serif;
        background: linear-gradient(180deg, #f8fafc, #eef2ff);
        color: #0f172a;
      }
      .page {
        max-width: 980px;
        margin: 0 auto;
        padding: 28px;
      }
      .doc {
        background: white;
        border-radius: 24px;
        border: 1px solid #e2e8f0;
        box-shadow: 0 24px 60px -36px rgba(15, 23, 42, 0.28);
        padding: 30px;
      }
      .eyebrow {
        font-size: 11px;
        text-transform: uppercase;
        letter-spacing: 0.18em;
        color: #64748b;
        font-weight: 700;
      }
      h1 {
        margin: 10px 0 6px;
        font-size: 28px;
      }
      p, li {
        font-size: 14px;
        line-height: 1.7;
        color: #334155;
      }
      .callout {
        margin-top: 20px;
        border-radius: 18px;
        background: #eff6ff;
        border: 1px solid #bfdbfe;
        padding: 16px;
      }
    </style>
  </head>
  <body>
    <div class="page">
      <div class="doc">
        <div class="eyebrow">LogicDocs preview</div>
        <h1>${townName} ${module.label} Executive Brief</h1>
        <p>${module.summary}</p>
        <div class="callout">
          <strong>Town context</strong>
          <p>${townContext}</p>
        </div>
        <h2>What this document is doing</h2>
        <ul>
          <li>Capturing the operating lane in plain municipal language.</li>
          <li>Holding the authority chain and protections in one brief.</li>
          <li>Giving leadership a document they can actually read while the governed system handles the rest.</li>
        </ul>
      </div>
    </div>
  </body>
</html>`
}

export function downloadArtifact(filename: string, content: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}

export function buildStageNarrative(stage: string, module: DemoModule, townContext: string) {
  const stageNarratives: Record<string, string> = {
    Discover: `Map the real operating load behind ${module.label.toLowerCase()} so the town knows where deadlines, approvals, and handoffs are actually breaking.`,
    Design: `Turn ${module.label.toLowerCase()} into one governed operating lane with named authorities, visible triggers, and durable records.`,
    Build: `Stand up the actual workspace artifacts for ${module.label.toLowerCase()}: forms, queues, templates, dashboards, and automation hooks.`,
    Encode: `Lock the working process into reusable rules so ${townContext} no longer depends on oral tradition.`,
    Transfer: 'Hand the module to town operators with clear guides, configured outputs, and a repeatable environment pack.',
    Monitor: 'Run the module as an ongoing municipal operating layer with alerts, packets, snapshots, and audit-ready history.',
  }

  return stageNarratives[stage] ?? stageNarratives.Build
}

export function buildImplementationPacket(
  townName: string,
  module: DemoModule,
  stage: string,
  townContext: string,
  activeSources: DataSource[],
) {
  return `# ${townName} ${module.label} Implementation Packet

## Demo note
This workspace is a demonstration. The records and snapshots here are meant to show how the environment works. In implementation, the environment connects live to the town's own sources.

## Why a town administrator would care
${module.summary}

## Provisioning stack
${PROVISIONING_TOOLS.map(tool => `### ${tool.label}
- ${tool.summary}
- Outcome: ${tool.outcome}`).join('\n\n')}

## Selected sources
${activeSources.map(source => `- ${source.label} (${source.category}): ${source.summary} ${source.liveNote}`).join('\n')}

## ModuleMaker build notes
- Module: ${module.label}
- Lifecycle stage: ${stage}
- Town context: ${townContext}
- Required automations: ${module.suggestedAutomations.join('; ')}
- Core protections: ${module.operatorProtections.join('; ')}

## LogicDASH view
- Governed records: ${module.metrics.records}
- Active work items: ${module.metrics.openItems}
- Automation hooks: ${module.metrics.automations}

## White-label and ownership
This environment can be customized for the municipality's own language, policies, branding, and operating structure. It can be white-labeled for municipal use whether the town continues with PublicLogic or not.
`
}

export function buildEnvironmentArtifacts(
  townName: string,
  module: DemoModule,
  lifecycleStage: string,
  townContext: string,
  activeSources: DataSource[],
  implementationPacket: string,
  stageNarrative: string,
): DemoArtifact[] {
  const dateStamp = new Date().toISOString().slice(0, 10)

  return [
    {
      filename: `${slugifyName(townName)}-${module.id}-implementation-packet-${dateStamp}.md`,
      mimeType: 'text/markdown',
      content: implementationPacket,
    },
    {
      filename: `${slugifyName(townName)}-${module.id}-environment-blueprint-${dateStamp}.json`,
      mimeType: 'application/json',
      content: JSON.stringify({
        town: townName,
        module: module.label,
        lifecycleStage,
        context: townContext,
        tools: PROVISIONING_TOOLS.map(tool => ({ label: tool.label, summary: tool.summary, outcome: tool.outcome })),
        activeSources: activeSources.map(source => ({
          label: source.label,
          category: source.category,
          status: source.status,
          liveNote: source.liveNote,
        })),
        authorityChain: module.authorityChain,
        accountabilityTriggers: module.accountabilityTriggers,
        boundaryRules: module.boundaryRules,
        continuityRequirements: module.continuityRequirements,
        suggestedAutomations: module.suggestedAutomations,
        whiteLabel: true,
        customizationNote: 'Customize language, branding, workflows, roles, and live data connections for municipal use.',
      }, null, 2),
    },
    {
      filename: `${slugifyName(townName)}-${module.id}-modulemaker-build-sheet-${dateStamp}.md`,
      mimeType: 'text/markdown',
      content: `# ${townName} ${module.label} ModuleMaker Build Sheet

## Lane objective
${module.summary}

## Build stage
${lifecycleStage}

## Forms and records
- Governed records in demo: ${module.metrics.records}
- Active items shown: ${module.metrics.openItems}
- Suggested automations: ${module.suggestedAutomations.join(', ')}

## Required controls
${module.boundaryRules.map(item => `- ${item}`).join('\n')}

## Staff protections
${module.operatorProtections.map(item => `- ${item}`).join('\n')}

## Live implementation note
Connect town and state sources in the live environment, then tune the build sheet to the municipality's own language, branding, and operating rules.
`,
    },
    {
      filename: `${slugifyName(townName)}-${module.id}-logicdash-source-map-${dateStamp}.md`,
      mimeType: 'text/markdown',
      content: `# ${townName} LogicDASH Source Map

Module in focus: ${module.label}

## Sources selected for the demo
${activeSources.map(source => `- ${source.label}: ${source.summary}`).join('\n')}

## What goes live in implementation
${activeSources.map(source => `- ${source.label}: ${source.liveNote}`).join('\n')}

## Snapshot proof points
- Governed records: ${module.metrics.records}
- Active items: ${module.metrics.openItems}
- Automation hooks: ${module.metrics.automations}

## Demo note
This is a demo view. In the municipality's own environment, LogicDASH connects to live town and state sources selected during implementation.
`,
    },
    {
      filename: `${slugifyName(townName)}-${module.id}-automation-runbook-${dateStamp}.json`,
      mimeType: 'application/json',
      content: JSON.stringify({
        name: `${townName} ${module.label} demo automation runbook`,
        goal: 'Show a believable municipal automation path from demo to live deployment.',
        steps: [
          { type: 'logicdash_snapshot', description: 'Generate leadership visibility for the selected lane.' },
          { type: 'modulemaker_build_sheet', description: 'Create the working module definition and controls.' },
          { type: 'workspace_drop', description: 'Drop files into workspace so staff can immediately open them.' },
          { type: 'share_packet', description: 'Send or share a specific packet to the operator or to yourself.' },
          { type: 'vault_provision', description: 'Provision final artifacts into Vault for durable storage.' },
        ],
        stageNarrative,
      }, null, 2),
    },
  ]
}

export function buildModuleArtifacts(townName: string, template: VaultBuildTemplate, municipality: Municipality | null): DemoArtifact[] {
  const dateStamp = new Date().toISOString().slice(0, 10)
  const slug = slugifyName(townName)
  const populationProfile = getMunicipalityProfile(municipality?.population)
  const municipalityLabel = municipality ? `${municipality.name}, Massachusetts` : `${townName}, Massachusetts`
  const annualVolume = estimateModuleVolume(template, municipality?.population)
  const buildSpec = {
    vault_version: 'demo-derived',
    module_code: template.code,
    module_id: template.moduleId,
    module_name: template.name,
    town: municipalityLabel,
    municipality_profile: {
      county: municipality?.county ?? 'County applied during implementation',
      dor_code: municipality?.dor_code ?? null,
      population: municipality?.population ?? null,
      operating_shape: populationProfile.label,
      projected_volume: annualVolume,
    },
    department: template.department,
    vault_workspace: template.workspace,
    statutory_authority: template.statutoryAuthority,
    retention_code: template.retentionCode,
    retention_description: template.retentionDescription,
    statutory_deadline: template.statutoryDeadline,
    archieve: {
      folder_path: template.archieveFolder.replace('{TOWN}', slug),
      file_naming: template.archieveNaming,
    },
    summary: template.summary,
    casespace_stages: template.stages.map((stage, index) => ({ stage: `S${index + 1}`, name: stage })),
    key_formkey_fields: template.keyFields,
    acceptance_criteria: template.acceptanceCriteria,
    stop_rules: template.stopRules,
    training_focus: template.trainingFocus,
    deployment_prerequisites: template.deploymentPrerequisites,
  }

  return [
    {
      filename: `${slug}-${template.code.toLowerCase()}-vault-build-spec-${dateStamp}.json`,
      mimeType: 'application/json',
      content: JSON.stringify(buildSpec, null, 2),
    },
    {
      filename: `${slug}-${template.code.toLowerCase()}-stagemap-${dateStamp}.md`,
      mimeType: 'text/markdown',
      content: `# ${townName} ${template.name} CaseSpace Stage Map

## Workspace
${template.workspace}

## Municipality profile
- Town: ${municipalityLabel}
- County: ${municipality?.county ?? 'To be connected in the live environment'}
- DOR code: ${municipality?.dor_code ?? 'TBD at implementation kickoff'}
- Population: ${formatPopulation(municipality?.population)}
- Operating profile: ${populationProfile.label}
- Projected annual volume: ${annualVolume}

## Stages
${template.stages.map((stage, index) => `${index + 1}. ${stage}`).join('\n')}

## Acceptance criteria
${template.acceptanceCriteria.map(item => `- ${item}`).join('\n')}

## Stop rules
${template.stopRules.map(item => `- ${item}`).join('\n')}
`,
    },
    {
      filename: `${slug}-${template.code.toLowerCase()}-formkey-schema-${dateStamp}.json`,
      mimeType: 'application/json',
      content: JSON.stringify({
        formId: `VAULT-FORMKEY-${template.code}-demo`,
        moduleId: template.moduleId,
        town: municipalityLabel,
        municipalityProfile: {
          county: municipality?.county ?? null,
          dorCode: municipality?.dor_code ?? null,
          population: municipality?.population ?? null,
        },
        fields: template.keyFields.map((field, index) => ({
          id: field,
          label: field.replace(/_/g, ' '),
          order: index + 1,
          required: true,
          type: field.includes('date') ? 'date' : field.includes('email') ? 'email' : 'text',
        })),
      }, null, 2),
    },
    {
      filename: `${slug}-${template.code.toLowerCase()}-training-guide-${dateStamp}.md`,
      mimeType: 'text/markdown',
      content: `# ${townName} ${template.name} Training Guide

## What this module does
${template.summary}

## Municipality profile
- ${populationProfile.label}
- ${populationProfile.operatingShape}
- Projected live volume: ${annualVolume}

## Training focus
${template.trainingFocus}

## Core operator rule
Everything belongs inside the CaseSpace. Do not send key work outside the case via personal email, sticky notes, or side conversations.

## Common mistakes to prevent
- Doing the work but not documenting it in CaseSpace
- Sending information outside the case via email
- Waiting for someone to tell staff it is their turn instead of following the system

## Core fields
${template.keyFields.map(item => `- ${item}`).join('\n')}
`,
    },
    {
      filename: `${slug}-${template.code.toLowerCase()}-deployment-checklist-${dateStamp}.md`,
      mimeType: 'text/markdown',
      content: `# ${townName} ${template.name} Deployment Checklist

## Prerequisites
${template.deploymentPrerequisites.map(item => `- ${item}`).join('\n')}

## Statutory authority
- ${template.statutoryAuthority}
- Deadline: ${template.statutoryDeadline}
- Retention: ${template.retentionCode} — ${template.retentionDescription}

## Auto-pulled Massachusetts context
- Municipality: ${municipalityLabel}
- County: ${municipality?.county ?? 'To be connected in live deployment'}
- DOR code: ${municipality?.dor_code ?? 'Assigned during implementation review'}
- Population: ${formatPopulation(municipality?.population)}
- Operating profile: ${populationProfile.label}

## ARCHIEVE profile
- Folder path: ${template.archieveFolder.replace('{TOWN}', slug)}
- File naming: ${template.archieveNaming}
`,
    },
    {
      filename: `${slug}-${template.code.toLowerCase()}-archieve-manifest-${dateStamp}.json`,
      mimeType: 'application/json',
      content: JSON.stringify({
        town: municipalityLabel,
        moduleId: template.moduleId,
        workspace: template.workspace,
        folderPath: template.archieveFolder.replace('{TOWN}', slug),
        namingPattern: template.archieveNaming,
        retentionCode: template.retentionCode,
        retentionDescription: template.retentionDescription,
      }, null, 2),
    },
    {
      filename: `${slug}-${template.code.toLowerCase()}-quick-reference-${dateStamp}.md`,
      mimeType: 'text/markdown',
      content: `# ${townName} ${template.name} Quick Reference

## What staff do here
- Work out of ${template.workspace}
- Move the case through ${template.stages.length} governed stages
- Record every approval, note, and file inside the CaseSpace

## First things to watch
${template.acceptanceCriteria.slice(0, 4).map(item => `- ${item}`).join('\n')}

## When to stop the line
${template.stopRules.map(item => `- ${item}`).join('\n')}

## Town profile
- ${populationProfile.label}
- ${annualVolume}
`,
    },
    {
      filename: `${slug}-${template.code.toLowerCase()}-escalation-playbook-${dateStamp}.md`,
      mimeType: 'text/markdown',
      content: `# ${townName} ${template.name} Escalation Playbook

## Trigger conditions
${template.stopRules.map(item => `- ${item}`).join('\n')}

## Who gets pulled in
- Department owner for ${template.department}
- Town administrator or delegated executive reviewer when deadlines or legal exposure escalate
- PublicLogic implementation lead during demo-to-live conversion

## What happens next
1. Freeze the case at the current stage.
2. Attach the missing proof, decision, or exception note.
3. Route to the named reviewer instead of relying on side-channel follow-up.
4. Resume only after the stop rule is cleared inside the CaseSpace.
`,
    },
  ]
}

export function buildTrialAppArtifacts(townName: string, app: TrialApp, module: DemoModule): DemoArtifact[] {
  const dateStamp = new Date().toISOString().slice(0, 10)
  const slug = slugifyName(townName)
  const appSlug = slugifyName(app.name)

  return [
    {
      filename: `${slug}-${appSlug}-app-spec-${dateStamp}.json`,
      mimeType: 'application/json',
      content: JSON.stringify({
        town: townName,
        appId: app.id,
        name: app.name,
        audience: app.audience,
        connectedModule: module.label,
        summary: app.summary,
        primaryAction: app.primaryAction,
        keyFields: app.keyFields,
      }, null, 2),
    },
    {
      filename: `${slug}-${appSlug}-operator-card-${dateStamp}.md`,
      mimeType: 'text/markdown',
      content: `# ${townName} ${app.name} Operator Card

## What this app does
${app.summary}

## Who it is for
${app.audience}

## Connected lane
${module.label}

## Primary action
${app.primaryAction}

## Key fields
${app.keyFields.map(item => `- ${item}`).join('\n')}

## Outcome
${app.outcome}
`,
    },
    {
      filename: `${slug}-${appSlug}-embedded-preview-${dateStamp}.html`,
      mimeType: 'text/html',
      content: buildTrialAppPreviewDoc(townName, app, module),
    },
  ]
}

export function artifactsToWorkspaceFiles(artifacts: DemoArtifact[]): FileItem[] {
  const now = Date.now()
  return artifacts.map((artifact, index) => ({
    id: `demo-${now}-${index}-${slugifyName(artifact.filename)}`,
    name: artifact.filename,
    type: artifact.filename.split('.').pop() ?? 'txt',
    size: new Blob([artifact.content]).size,
    content: artifact.content,
    uploadedAt: now + index,
  }))
}

export async function uploadArtifactsToVault(artifacts: DemoArtifact[], successMessage: string, fallbackMessage: string) {
  try {
    for (const artifact of artifacts) {
      await pjApi.vaultFiles.upload({
        name: artifact.filename,
        mimeType: artifact.mimeType,
        size: new Blob([artifact.content]).size,
        contentBase64: utf8ToBase64(artifact.content),
      })
    }
    toast.success(successMessage)
  } catch (error) {
    artifacts.forEach(artifact => downloadArtifact(artifact.filename, artifact.content, artifact.mimeType))
    toast.success(fallbackMessage)
    logger.error('Vault provisioning fell back to direct downloads for demo artifacts.', error, { artifactCount: artifacts.length })
  }
}

export async function shareArtifactToSelf(townName: string, artifact: DemoArtifact, fallbackLabel: string, recipientEmail?: string) {
  try {
    const file = new File([artifact.content], artifact.filename, { type: artifact.mimeType })
    const title = `${townName} demo packet`
    const text = `Here is the ${artifact.filename} packet generated from the LogicOS demo for ${townName}.`

    if (navigator.share && (!navigator.canShare || navigator.canShare({ files: [file] }))) {
      await navigator.share({ title, text, files: [file] })
      toast.success('Share sheet opened with the selected file.')
      return
    }

    downloadArtifact(artifact.filename, artifact.content, artifact.mimeType)
    const subject = encodeURIComponent(`${townName} demo file: ${artifact.filename}`)
    const body = encodeURIComponent(`The file "${artifact.filename}" was generated from the LogicOS demo.\n\nIt has been downloaded locally so you can attach or forward it.\n\nIn live use, Logicville can also auto-route this file into Vault, remind the next owner, and log the handoff.`)
    const recipient = recipientEmail ? encodeURIComponent(recipientEmail) : ''
    window.location.href = `mailto:${recipient}?subject=${subject}&body=${body}`
    toast.success(`${fallbackLabel} downloaded and an email draft opened${recipientEmail ? ` for ${recipientEmail}` : ''}.`)
  } catch (error) {
    downloadArtifact(artifact.filename, artifact.content, artifact.mimeType)
    toast.success(`${fallbackLabel} downloaded locally.`)
    logger.error('Artifact sharing fell back to local download only.', error, { filename: artifact.filename, recipientEmail: recipientEmail ?? null })
  }
}

export type TownCaseSpaceDemoSection = 'trial' | 'saved' | 'apps' | 'automations' | 'connections' | 'logicdocs'
