import type { CaseSpace } from '@/lib/types'
import { createCaseSpace, listCaseSpaces, updateCaseSpace } from '@/services/casespaceApi'
import type { LiveTownData } from '@/features/environments/demo/townCaseDemoData'

export const LOGICVILLE_ENVIRONMENT_ID = 'vault-logicville'
export const LOGICVILLE_ENVIRONMENT_NAME = 'Town of Logicville'
export const LOGICVILLE_MODULE_IDS = [
  'VAULTCLERK',
  'VAULTPRR',
  'VAULTFISCAL',
  'VAULTTIME',
  'VAULTFIX',
  'VAULTONBOARD',
  'VAULTPERMIT',
  'VAULTHR',
  'VAULTPROCURE',
  'VAULTRECS',
  'VAULTMEET',
]

export function isLogicvilleEnvironmentId(id?: string | null): boolean {
  return id === LOGICVILLE_ENVIRONMENT_ID
}

/** Synthetic town profile for the Logicville demo — shown without a DLS data pull. */
export const LOGICVILLE_LIVE_DATA: LiveTownData = {
  municipality: 'Logicville',
  dorCode: 0,
  county: 'Middlesex',
  fiscalYear: 2025,
  computedAt: new Date('2026-01-15').toISOString(),
  metrics: {
    operatingBudget: 24_480_000,
    totalEmployees: 127,
    totalSalariesWages: 8_230_000,
    averageSalary: 64_803,
    salariesPctBudget: 33.6,
    certifiedFreeCash: 1_820_000,
    freeCashPctBudget: 7.4,
    excessLevyCapacityPct: 3.2,
    totalStateAid: 3_910_000,
    debtServicePctBudget: 8.1,
  },
  riskFlags: [
    { code: 'PRR-BACKLOG', label: 'Public records backlog', severity: 'warning', detail: '16 open requests, 4 past the 10-day statutory limit — one response due April 9', threshold: '10 business days (M.G.L. c.66 §10)' },
    { code: 'BOARD-PACKETS', label: 'Board packet prep time', severity: 'warning', detail: 'Manual assembly averaging 4.2 hours per meeting cycle — Select Board packet due tonight for April 9 meeting', threshold: 'Best practice: < 1 hour with automation' },
    { code: 'PERMIT-QUEUE', label: 'Permit queue depth', severity: 'info', detail: '22 open permits, average 11 days to first review', threshold: 'State guidance: 30-day issuance target' },
    { code: 'FREE-CASH', label: 'Free cash certified', severity: 'passing', detail: '7.4% of operating budget — within healthy range', threshold: 'Recommended: > 5%' },
  ],
}

/** Operating areas shown in the Logicville demo overview card. */
export const LOGICVILLE_OPERATING_AREAS = [
  { id: 'prr',         label: 'Public Records',    color: '#D4A853', bg: 'bg-amber-500/10',   border: 'border-amber-400/30',   text: 'text-amber-700 dark:text-amber-300' },
  { id: 'permitting',  label: 'Permitting',         color: '#6B9EBB', bg: 'bg-sky-500/10',     border: 'border-sky-400/30',     text: 'text-sky-700 dark:text-sky-300' },
  { id: 'board',       label: 'Board Compliance',   color: '#8BBF7A', bg: 'bg-emerald-500/10', border: 'border-emerald-400/30', text: 'text-emerald-700 dark:text-emerald-300' },
  { id: 'appts',       label: 'Appointments',       color: '#B07FBB', bg: 'bg-violet-500/10',  border: 'border-violet-400/30',  text: 'text-violet-700 dark:text-violet-300' },
  { id: 'fiscal',      label: 'Fiscal Operations',  color: '#CC7070', bg: 'bg-rose-500/10',    border: 'border-rose-400/30',    text: 'text-rose-700 dark:text-rose-300' },
] as const

export function buildLogicvilleCaseSpace(): CaseSpace {
  return {
    id: LOGICVILLE_ENVIRONMENT_ID,
    name: LOGICVILLE_ENVIRONMENT_NAME,
    description: 'The primary municipal operating environment for intake, review, records, routing, and follow-up.',
    color: '#3B6FD4',
    icon: '🏛️',
    type: 'vault',
    town: LOGICVILLE_ENVIRONMENT_NAME,
    vaultModuleIds: LOGICVILLE_MODULE_IDS,
    visibility: 'organization',
    members: [],
    connectionIds: [],
    auditEnabled: true,
    retentionEnabled: true,
    createdAt: Date.now(),
    fileCount: 0,
    folderCount: 0,
    templateCount: 0,
  }
}

export async function ensureLogicvilleCaseSpace(existingCaseSpaces?: CaseSpace[]): Promise<CaseSpace> {
  const spaces = existingCaseSpaces ?? await listCaseSpaces()
  const base = buildLogicvilleCaseSpace()
  const existing = spaces.find(space => isLogicvilleEnvironmentId(space.id))

  if (!existing) {
    return await createCaseSpace(base).catch(() => base)
  }

  const currentModules = existing.vaultModuleIds ?? []
  const modulesOutOfSync = currentModules.length !== LOGICVILLE_MODULE_IDS.length
    || LOGICVILLE_MODULE_IDS.some(moduleId => !currentModules.includes(moduleId))

  if (!modulesOutOfSync
    && existing.name === base.name
    && existing.town === base.town
    && existing.type === base.type
    && existing.description === base.description) {
    return existing
  }

  return await updateCaseSpace(existing.id, {
    name: base.name,
    description: base.description,
    town: base.town,
    type: base.type,
    color: existing.color ?? base.color,
    icon: existing.icon ?? base.icon,
    visibility: existing.visibility ?? base.visibility,
    auditEnabled: existing.auditEnabled ?? base.auditEnabled,
    retentionEnabled: existing.retentionEnabled ?? base.retentionEnabled,
    vaultModuleIds: LOGICVILLE_MODULE_IDS,
  }) ?? {
    ...existing,
    ...base,
    color: existing.color ?? base.color,
    icon: existing.icon ?? base.icon,
    visibility: existing.visibility ?? base.visibility,
    vaultModuleIds: LOGICVILLE_MODULE_IDS,
  }
}

// ── Phillipston ──────────────────────────────────────────────────────────────

export const PHILLIPSTON_ENVIRONMENT_ID = 'vault-phillipston-prr'
export const PHILLIPSTON_ENVIRONMENT_NAME = 'Town of Phillipston'
export const PHILLIPSTON_MODULE_IDS = ['VAULTPRR', 'VAULTCLERK', 'VAULTMEET']

export function isPhillipstonEnvironmentId(id?: string | null): boolean {
  return id === PHILLIPSTON_ENVIRONMENT_ID
}

export function buildPhillipstonCaseSpace(): CaseSpace {
  return {
    id: PHILLIPSTON_ENVIRONMENT_ID,
    name: PHILLIPSTON_ENVIRONMENT_NAME,
    description: 'Phillipston municipal operating environment — public records, clerk operations, and board meetings.',
    color: '#2E7D52',
    icon: '🌲',
    type: 'vault',
    town: PHILLIPSTON_ENVIRONMENT_NAME,
    vaultModuleIds: PHILLIPSTON_MODULE_IDS,
    visibility: 'organization',
    members: [],
    connectionIds: [],
    auditEnabled: true,
    retentionEnabled: true,
    createdAt: Date.now(),
    fileCount: 0,
    folderCount: 0,
    templateCount: 0,
  }
}

export async function ensurePhillipstonCaseSpace(existingCaseSpaces?: CaseSpace[]): Promise<CaseSpace> {
  const spaces = existingCaseSpaces ?? await listCaseSpaces()
  const base = buildPhillipstonCaseSpace()
  const existing = spaces.find(space => isPhillipstonEnvironmentId(space.id))

  if (!existing) {
    return await createCaseSpace(base).catch(() => base)
  }

  const currentModules = existing.vaultModuleIds ?? []
  const modulesOutOfSync = PHILLIPSTON_MODULE_IDS.some(m => !currentModules.includes(m))

  if (!modulesOutOfSync
    && existing.name === base.name
    && existing.town === base.town) {
    return existing
  }

  const merged = Array.from(new Set([...currentModules, ...PHILLIPSTON_MODULE_IDS]))
  return await updateCaseSpace(existing.id, {
    name: base.name,
    town: base.town,
    type: base.type,
    description: base.description,
    color: existing.color ?? base.color,
    icon: existing.icon ?? base.icon,
    vaultModuleIds: merged,
  }) ?? { ...existing, ...base, vaultModuleIds: merged }
}
