import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { CANONICAL_ACTIONS, CANONICAL_ROLE_TYPES } from '@pj/org-manager'
import type { CanonicalAction, RoleType } from '@publiclogic/core'
import type { CalDefinition, CalGateDefinition } from '../cal.js'
import type { PrrTrigger } from '../prrMachine.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const BUILTIN_SKIN_KEYS = [
  'STAY-001',
  'STAY-002',
  'STAY-003',
  'MUNI-001',
  'MUNI-002',
  'BIZ-001',
  'BIZ-002',
] as const

const CORE_FIELDS = [
  'casespace_ref',
  'subject_ref',
  'needed_by',
  'owner_identity_id',
  'default_pool',
  'links',
  'resources',
  'evidence',
  'fields',
  'skin_snapshot',
] as const

const POOL_KEYS = ['owner', 'closer', 'decider', 'approver'] as const
const HOLD_KINDS = ['scheduled', 'locked', 'derived', 'advisory'] as const
const TRIGGERS = [
  'intake_complete',
  'route',
  'search_begin',
  'search_complete',
  'respond',
  'reassign',
  'close',
] as const

type BuiltInSkinKey = (typeof BUILTIN_SKIN_KEYS)[number]
type CoreField = (typeof CORE_FIELDS)[number]
type PoolKey = (typeof POOL_KEYS)[number]
type HoldKind = (typeof HOLD_KINDS)[number]

interface PoolRefRaw {
  role?: string
  identity_id?: string
}

interface TransitionSkinRaw {
  action?: string
  requiredEvidence?: string[]
  approvalRole?: string
  assist?: unknown
  advisory?: unknown
  from?: unknown
  to?: unknown
  state?: unknown
  next_state?: unknown
}

interface DerivedHoldRaw {
  field: string
  hold_kind?: string
  resource_prefix?: string
}

export interface SkinDocumentRaw {
  skin_key: string
  domain: string
  field_labels?: Record<string, string>
  required_fields?: string[]
  pools?: Partial<Record<PoolKey, PoolRefRaw>>
  transitions?: Partial<Record<PrrTrigger, TransitionSkinRaw>>
  default_owner?: PoolKey
  derived_holds?: DerivedHoldRaw[]
  assist?: Record<string, unknown>
  states?: unknown
}

export interface PoolRef {
  role?: RoleType
  identityId?: string
}

export interface DerivedHoldSpec {
  field: CoreField
  holdKind: HoldKind
  resourcePrefix: string | null
}

export interface SkinOverlay {
  skinKey: string
  domain: string
  fieldLabels: Partial<Record<CoreField, string>>
  requiredFields: CoreField[]
  pools: Partial<Record<PoolKey, PoolRef>>
  cal: CalDefinition
  defaultOwner: PoolKey | null
  derivedHolds: DerivedHoldSpec[]
  assist: Record<string, unknown>
}

export class SkinValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'SkinValidationError'
  }
}

function isCoreField(value: string): value is CoreField {
  return (CORE_FIELDS as readonly string[]).includes(value)
}

function isPoolKey(value: string): value is PoolKey {
  return (POOL_KEYS as readonly string[]).includes(value)
}

function isTrigger(value: string): value is PrrTrigger {
  return (TRIGGERS as readonly string[]).includes(value)
}

function isHoldKind(value: string): value is HoldKind {
  return (HOLD_KINDS as readonly string[]).includes(value)
}

function isCanonicalRole(value: string): value is RoleType {
  return (CANONICAL_ROLE_TYPES as readonly string[]).includes(value)
}

function isCanonicalAction(value: string): value is CanonicalAction {
  return (CANONICAL_ACTIONS as readonly string[]).includes(value)
}

function validateField(field: string, skinKey: string, context: string): CoreField {
  if (!isCoreField(field)) {
    throw new SkinValidationError(`Skin '${skinKey}' attempts to add or reference unknown core field '${field}' in ${context}`)
  }
  return field
}

function validatePoolRef(skinKey: string, poolKey: PoolKey, raw: PoolRefRaw): PoolRef {
  const role = raw.role?.trim()
  const identityId = raw.identity_id?.trim()
  if (!role && !identityId) {
    throw new SkinValidationError(`Skin '${skinKey}' pool '${poolKey}' must reference either a canonical role or identity_id`)
  }
  if (role && !isCanonicalRole(role)) {
    throw new SkinValidationError(`Skin '${skinKey}' pool '${poolKey}' references unknown Org Manager role '${role}'`)
  }
  return {
    role: role as RoleType | undefined,
    identityId: identityId || undefined,
  }
}

function validateGate(skinKey: string, trigger: PrrTrigger, raw: TransitionSkinRaw): CalGateDefinition {
  if (raw.from !== undefined || raw.to !== undefined || raw.state !== undefined || raw.next_state !== undefined) {
    throw new SkinValidationError(`Skin '${skinKey}' attempts to rewire transition '${trigger}'`)
  }
  if (raw.action && !isCanonicalAction(raw.action)) {
    throw new SkinValidationError(`Skin '${skinKey}' transition '${trigger}' references unknown canonical action '${raw.action}'`)
  }
  if (raw.approvalRole && !isCanonicalRole(raw.approvalRole)) {
    throw new SkinValidationError(`Skin '${skinKey}' transition '${trigger}' references unknown approval role '${raw.approvalRole}'`)
  }
  return {
    action: raw.action as CanonicalAction | undefined,
    approvalRole: raw.approvalRole as RoleType | undefined,
    requiredEvidence: raw.requiredEvidence?.map((value) => value.trim()).filter(Boolean),
  }
}

function builtinSkinDir(): string {
  const candidates = [
    path.resolve(__dirname, 'data'),
    path.resolve(__dirname, '../../src/skins/data'),
  ]
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate
  }
  throw new Error('Unable to locate built-in skin JSON directory')
}

export function loadSkin(raw: SkinDocumentRaw): SkinOverlay {
  const skinKey = raw.skin_key?.trim()
  if (!skinKey) {
    throw new SkinValidationError('Skin is missing required skin_key')
  }
  if (raw.states !== undefined) {
    throw new SkinValidationError(`Skin '${skinKey}' attempts to add states`)
  }
  const domain = raw.domain?.trim()
  if (!domain) {
    throw new SkinValidationError(`Skin '${skinKey}' is missing required domain`)
  }

  const fieldLabels: Partial<Record<CoreField, string>> = {}
  for (const [field, label] of Object.entries(raw.field_labels ?? {})) {
    const coreField = validateField(field, skinKey, 'field_labels')
    fieldLabels[coreField] = label
  }

  const requiredFields = (raw.required_fields ?? []).map((field) =>
    validateField(field, skinKey, 'required_fields'),
  )

  const pools: Partial<Record<PoolKey, PoolRef>> = {}
  for (const [poolKey, poolRef] of Object.entries(raw.pools ?? {})) {
    if (!isPoolKey(poolKey)) {
      throw new SkinValidationError(`Skin '${skinKey}' declares unknown pool '${poolKey}'`)
    }
    pools[poolKey] = validatePoolRef(skinKey, poolKey, poolRef as PoolRefRaw)
  }

  if (raw.default_owner && !pools[raw.default_owner]) {
    throw new SkinValidationError(`Skin '${skinKey}' default_owner '${raw.default_owner}' is not defined in pools`)
  }

  const gates: Partial<Record<PrrTrigger, CalGateDefinition>> = {}
  for (const [trigger, gate] of Object.entries(raw.transitions ?? {})) {
    if (!isTrigger(trigger)) {
      throw new SkinValidationError(`Skin '${skinKey}' attempts to configure unknown transition '${trigger}'`)
    }
    gates[trigger] = validateGate(skinKey, trigger, gate as TransitionSkinRaw)
  }

  const derivedHolds = (raw.derived_holds ?? []).map((entry) => {
    const field = validateField(entry.field, skinKey, 'derived_holds')
    const holdKind = entry.hold_kind?.trim() ?? 'derived'
    if (!isHoldKind(holdKind)) {
      throw new SkinValidationError(`Skin '${skinKey}' derived_holds for field '${field}' uses unknown hold_kind '${holdKind}'`)
    }
    return {
      field,
      holdKind,
      resourcePrefix: entry.resource_prefix?.trim() || null,
    }
  })

  return {
    skinKey,
    domain,
    fieldLabels,
    requiredFields,
    pools,
    cal: { gates },
    defaultOwner: raw.default_owner ?? null,
    derivedHolds,
    assist: raw.assist ?? {},
  }
}

export function loadSkinFromJson(json: string): SkinOverlay {
  return loadSkin(JSON.parse(json) as SkinDocumentRaw)
}

export function loadBuiltInSkin(key: BuiltInSkinKey): SkinOverlay {
  const fullPath = path.join(builtinSkinDir(), `${key}.json`)
  return loadSkinFromJson(fs.readFileSync(fullPath, 'utf8'))
}

export function loadBuiltInSkins(): SkinOverlay[] {
  return BUILTIN_SKIN_KEYS.map((key) => loadBuiltInSkin(key))
}

export function builtInSkinKeys(): readonly BuiltInSkinKey[] {
  return BUILTIN_SKIN_KEYS
}
