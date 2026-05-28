import { z } from 'zod'

export const WORKSPACE_AREAS = ['PL', 'PI', 'CAM', 'LIFE', 'LAB'] as const
export const WORKSPACE_PROVIDERS = ['google', 'microsoft', 'github'] as const
export const WORKSPACE_RECORD_STATUSES = ['active', 'paused', 'archived'] as const
export const WORKSPACE_ROUTING_STATES = ['pending', 'selected', 'completed', 'failed', 'placeholder'] as const
export const WORKSPACE_CONNECTOR_STATES = ['idle', 'started', 'completed', 'failed', 'placeholder'] as const
export const WORKSPACE_AUDIT_EVENT_TYPES = [
  'record_created',
  'route_selected',
  'connector_started',
  'connector_completed',
  'connector_failed',
] as const

export const WorkspaceAreaSchema = z.enum(WORKSPACE_AREAS)
export const WorkspaceProviderSchema = z.enum(WORKSPACE_PROVIDERS)
export const WorkspaceRecordStatusSchema = z.enum(WORKSPACE_RECORD_STATUSES)
export const WorkspaceRoutingStateSchema = z.enum(WORKSPACE_ROUTING_STATES)
export const WorkspaceConnectorStateSchema = z.enum(WORKSPACE_CONNECTOR_STATES)
export const WorkspaceAuditEventTypeSchema = z.enum(WORKSPACE_AUDIT_EVENT_TYPES)

const optionalTrimmedString = z.string().trim().min(1).max(500).optional()
const nullableTrimmedString = z.string().trim().min(1).max(500).nullable()

export const WorkspaceRecordSchema = z.object({
  id: z.string().min(1),
  title: z.string().trim().min(1).max(200),
  area: WorkspaceAreaSchema,
  status: WorkspaceRecordStatusSchema,
  createdByActorId: z.string().trim().min(1).max(200).nullable(),
  ownerActorId: z.string().trim().min(1).max(200).nullable(),
  collaboratorActorId: z.string().trim().min(1).max(200).nullable(),
  owner: nullableTrimmedString,
  collaborator: nullableTrimmedString,
  home: WorkspaceProviderSchema.nullable(),
  destination: WorkspaceProviderSchema,
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
  routingState: WorkspaceRoutingStateSchema,
  connectorState: WorkspaceConnectorStateSchema,
  lastError: z.string().trim().min(1).max(2_000).nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
})

export const CreateWorkspaceRecordInputSchema = z.object({
  title: z.string().trim().min(1).max(200),
  area: WorkspaceAreaSchema,
  status: WorkspaceRecordStatusSchema.optional(),
  createdByActorId: z.string().trim().min(1).max(200).optional(),
  ownerActorId: z.string().trim().min(1).max(200).optional(),
  collaboratorActorId: z.string().trim().min(1).max(200).optional(),
  owner: optionalTrimmedString,
  collaborator: optionalTrimmedString,
  home: WorkspaceProviderSchema.optional(),
  nextAction: optionalTrimmedString,
  dueDate: z.string().trim().min(1).max(100).optional(),
  notes: z.string().trim().min(1).max(10_000).optional(),
  source: z.string().trim().min(1).max(100).optional(),
  googleParentId: z.string().trim().min(1).max(300).optional(),
}).strip()

export const PatchWorkspaceRecordInputSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  area: WorkspaceAreaSchema.optional(),
  status: WorkspaceRecordStatusSchema.optional(),
  ownerActorId: z.string().trim().max(200).nullable().optional(),
  collaboratorActorId: z.string().trim().max(200).nullable().optional(),
  owner: z.string().trim().max(500).nullable().optional(),
  collaborator: z.string().trim().max(500).nullable().optional(),
  home: WorkspaceProviderSchema.nullable().optional(),
  nextAction: z.string().trim().max(500).nullable().optional(),
  dueDate: z.string().trim().max(100).nullable().optional(),
  notes: z.string().trim().max(10_000).nullable().optional(),
  source: z.string().trim().min(1).max(100).optional(),
  googleParentId: z.string().trim().max(300).nullable().optional(),
}).strip()

export const WorkspaceAuditEventSchema = z.object({
  id: z.string().min(1),
  recordId: z.string().min(1),
  type: WorkspaceAuditEventTypeSchema,
  at: z.string().datetime(),
  actor: z.object({
    actorId: z.string().trim().min(1).max(200).nullable(),
    source: z.string().trim().min(1).max(100),
    ip: z.string().trim().min(1).max(200).nullable(),
    userAgent: z.string().trim().min(1).max(500).nullable(),
  }),
  detail: z.record(z.string(), z.unknown()).nullable(),
})

export const WorkspaceListRecordsFiltersSchema = z.object({
  area: WorkspaceAreaSchema.optional(),
  status: WorkspaceRecordStatusSchema.optional(),
  destination: WorkspaceProviderSchema.optional(),
  source: z.string().trim().min(1).max(100).optional(),
}).strip()

export type WorkspaceArea = z.infer<typeof WorkspaceAreaSchema>
export type WorkspaceProvider = z.infer<typeof WorkspaceProviderSchema>
export type WorkspaceRecordStatus = z.infer<typeof WorkspaceRecordStatusSchema>
export type WorkspaceRoutingState = z.infer<typeof WorkspaceRoutingStateSchema>
export type WorkspaceConnectorState = z.infer<typeof WorkspaceConnectorStateSchema>
export type WorkspaceAuditEventType = z.infer<typeof WorkspaceAuditEventTypeSchema>
export type WorkspaceRecord = z.infer<typeof WorkspaceRecordSchema>
export type CreateWorkspaceRecordInput = z.infer<typeof CreateWorkspaceRecordInputSchema>
export type PatchWorkspaceRecordInput = z.infer<typeof PatchWorkspaceRecordInputSchema>
export type WorkspaceAuditEvent = z.infer<typeof WorkspaceAuditEventSchema>
export type WorkspaceListRecordsFilters = z.infer<typeof WorkspaceListRecordsFiltersSchema>
