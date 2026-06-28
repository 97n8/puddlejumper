import { z } from 'zod'

export const LOGICOS_AREAS = ['PL', 'PI', 'CAM', 'LIFE', 'LAB'] as const
export const LOGICOS_PROVIDERS = ['google', 'microsoft', 'github'] as const
export const LOGICOS_RECORD_STATUSES = ['active', 'paused', 'archived'] as const
export const LOGICOS_ROUTING_STATES = ['pending', 'selected', 'completed', 'failed', 'placeholder'] as const
export const LOGICOS_CONNECTOR_STATES = ['idle', 'started', 'completed', 'failed', 'placeholder'] as const
export const LOGICOS_AUDIT_EVENT_TYPES = [
  'record_created',
  'route_selected',
  'connector_started',
  'connector_completed',
  'connector_failed',
] as const

export const LogicOSAreaSchema = z.enum(LOGICOS_AREAS)
export const LogicOSProviderSchema = z.enum(LOGICOS_PROVIDERS)
export const LogicOSRecordStatusSchema = z.enum(LOGICOS_RECORD_STATUSES)
export const LogicOSRoutingStateSchema = z.enum(LOGICOS_ROUTING_STATES)
export const LogicOSConnectorStateSchema = z.enum(LOGICOS_CONNECTOR_STATES)
export const LogicOSAuditEventTypeSchema = z.enum(LOGICOS_AUDIT_EVENT_TYPES)

const optionalTrimmedString = z.string().trim().min(1).max(500).optional()
const nullableTrimmedString = z.string().trim().min(1).max(500).nullable()

export const LogicOSRecordSchema = z.object({
  id: z.string().min(1),
  title: z.string().trim().min(1).max(200),
  area: LogicOSAreaSchema,
  status: LogicOSRecordStatusSchema,
  createdByActorId: z.string().trim().min(1).max(200).nullable(),
  ownerActorId: z.string().trim().min(1).max(200).nullable(),
  collaboratorActorId: z.string().trim().min(1).max(200).nullable(),
  owner: nullableTrimmedString,
  collaborator: nullableTrimmedString,
  home: LogicOSProviderSchema.nullable(),
  destination: LogicOSProviderSchema,
  connectorMode: z.enum(['google-folder', 'placeholder']),
  primaryLink: z.string().url().nullable(),
  googleLink: z.string().url().nullable(),
  m365Link: z.string().url().nullable(),
  githubLink: z.string().url().nullable(),
  nextAction: nullableTrimmedString,
  dueDate: z.string().trim().min(1).max(100).nullable(),
  notes: z.string().trim().min(1).max(10_000).nullable(),
  source: z.string().trim().min(1).max(100),
  googleParentId: z.string().trim().min(1).max(300).nullable(),
  routingState: LogicOSRoutingStateSchema,
  connectorState: LogicOSConnectorStateSchema,
  lastError: z.string().trim().min(1).max(2_000).nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
})

export const CreateLogicOSRecordInputSchema = z.object({
  title: z.string().trim().min(1).max(200),
  area: LogicOSAreaSchema,
  status: LogicOSRecordStatusSchema.optional(),
  createdByActorId: z.string().trim().min(1).max(200).optional(),
  ownerActorId: z.string().trim().min(1).max(200).optional(),
  collaboratorActorId: z.string().trim().min(1).max(200).optional(),
  owner: optionalTrimmedString,
  collaborator: optionalTrimmedString,
  home: LogicOSProviderSchema.optional(),
  nextAction: optionalTrimmedString,
  dueDate: z.string().trim().min(1).max(100).optional(),
  notes: z.string().trim().min(1).max(10_000).optional(),
  source: z.string().trim().min(1).max(100).optional(),
  googleParentId: z.string().trim().min(1).max(300).optional(),
}).strip()

export const PatchLogicOSRecordInputSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  area: LogicOSAreaSchema.optional(),
  status: LogicOSRecordStatusSchema.optional(),
  ownerActorId: z.string().trim().max(200).nullable().optional(),
  collaboratorActorId: z.string().trim().max(200).nullable().optional(),
  owner: z.string().trim().max(500).nullable().optional(),
  collaborator: z.string().trim().max(500).nullable().optional(),
  home: LogicOSProviderSchema.nullable().optional(),
  nextAction: z.string().trim().max(500).nullable().optional(),
  dueDate: z.string().trim().max(100).nullable().optional(),
  notes: z.string().trim().max(10_000).nullable().optional(),
  source: z.string().trim().min(1).max(100).optional(),
  googleParentId: z.string().trim().max(300).nullable().optional(),
}).strip()

export const LogicOSAuditEventSchema = z.object({
  id: z.string().min(1),
  recordId: z.string().min(1),
  type: LogicOSAuditEventTypeSchema,
  at: z.string().datetime(),
  actor: z.object({
    actorId: z.string().trim().min(1).max(200).nullable(),
    source: z.string().trim().min(1).max(100),
    ip: z.string().trim().min(1).max(200).nullable(),
    userAgent: z.string().trim().min(1).max(500).nullable(),
  }),
  detail: z.record(z.string(), z.unknown()).nullable(),
})

export const LogicOSListRecordsFiltersSchema = z.object({
  area: LogicOSAreaSchema.optional(),
  status: LogicOSRecordStatusSchema.optional(),
  destination: LogicOSProviderSchema.optional(),
  source: z.string().trim().min(1).max(100).optional(),
}).strip()

export type LogicOSArea = z.infer<typeof LogicOSAreaSchema>
export type LogicOSProvider = z.infer<typeof LogicOSProviderSchema>
export type LogicOSRecordStatus = z.infer<typeof LogicOSRecordStatusSchema>
export type LogicOSRoutingState = z.infer<typeof LogicOSRoutingStateSchema>
export type LogicOSConnectorState = z.infer<typeof LogicOSConnectorStateSchema>
export type LogicOSAuditEventType = z.infer<typeof LogicOSAuditEventTypeSchema>
export type LogicOSRecord = z.infer<typeof LogicOSRecordSchema>
export type CreateLogicOSRecordInput = z.infer<typeof CreateLogicOSRecordInputSchema>
export type PatchLogicOSRecordInput = z.infer<typeof PatchLogicOSRecordInputSchema>
export type LogicOSAuditEvent = z.infer<typeof LogicOSAuditEventSchema>
export type LogicOSListRecordsFilters = z.infer<typeof LogicOSListRecordsFiltersSchema>
