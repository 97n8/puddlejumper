import express from 'express'
import { getAuthContext } from '@publiclogic/core'
import type Database from 'better-sqlite3'
import { z } from 'zod'
import {
  addDocketItem,
  addSource,
  buildProjectAIContext,
  createCapture,
  createFlow,
  createProject,
  deleteDocketItem,
  deleteProject,
  deleteSource,
  getFlow,
  getProject,
  listCaptures,
  listDocketItems,
  listFlowRuns,
  listFlows,
  listProjects,
  listRunSteps,
  listSources,
  markCaptureSynced,
  type ProjectSourceKind,
  toggleDocketItem,
  updateFlow,
  updateProject,
} from '../projectStore.js'

const projectDomainSchema = z.enum(['civic', 'campaign', 'client', 'personal', 'business', 'compliance', 'general'])
const projectGovernanceSchema = z.enum(['none', 'light', 'governed', 'statutory'])
const projectStatusSchema = z.enum(['active', 'paused', 'archived'])
const sourceKindSchema = z.enum(['document', 'link', 'statute', 'contract', 'recording', 'code', 'note', 'image'])
const docketPrioritySchema = z.enum(['none', 'low', 'medium', 'high'])
const flowStatusSchema = z.enum(['draft', 'active', 'paused', 'archived'])

const metadataSchema = z.record(z.string(), z.unknown())
const stringArraySchema = z.array(z.string())

const flowScenarioNodeSchema = z.object({
  id: z.string().min(1),
  kind: z.string().min(1),
  title: z.string().optional(),
  detail: z.string().optional(),
  target: z.string().optional(),
  gate_condition: z.string().optional(),
  gate_enforced: z.boolean().optional(),
  human_review: z.boolean().optional(),
  humanReview: z.boolean().optional(),
  next: z.union([z.string(), z.array(z.string())]).optional(),
  branches: z.array(z.record(z.string(), z.unknown())).optional(),
}).catchall(z.unknown())

const flowScenarioSchema = z.object({
  version: z.number().int().positive().optional(),
  root_id: z.string().optional(),
  rootId: z.string().optional(),
  nodes: z.array(flowScenarioNodeSchema),
}).catchall(z.unknown())

const triggerSpecSchema = z.object({
  type: z.enum(['manual', 'capture_arrival', 'docket_due', 'source_added', 'scheduled']).optional(),
}).catchall(z.unknown())

const createCaptureSchema = z.object({
  project_id: z.string().min(1).nullable().optional(),
  text: z.string().trim().min(1),
  meta: metadataSchema.optional(),
}).strict()

const createProjectSchema = z.object({
  name: z.string().trim().min(1),
  kicker: z.string().optional(),
  domain: projectDomainSchema.optional(),
  governance: projectGovernanceSchema.optional(),
  color: z.string().optional(),
  status: projectStatusSchema.optional(),
  framework_id: z.string().min(1).nullable().optional(),
  tools: stringArraySchema.optional(),
  connections: stringArraySchema.optional(),
  ai_models: stringArraySchema.optional(),
  meta: metadataSchema.optional(),
  pinned: z.boolean().optional(),
}).strict()

const updateProjectSchema = createProjectSchema.partial().strict()

const addSourceSchema = z.object({
  kind: sourceKindSchema,
  title: z.string().trim().min(1),
  reference: z.string().optional(),
  summary: z.string().nullable().optional(),
  content_hash: z.string().nullable().optional(),
  size_bytes: z.number().int().nonnegative().nullable().optional(),
  mime_type: z.string().nullable().optional(),
  meta: metadataSchema.optional(),
}).strict()

const addDocketItemSchema = z.object({
  text: z.string().trim().min(1),
  due_at: z.string().nullable().optional(),
  priority: docketPrioritySchema.optional(),
}).strict()

const createFlowSchema = z.object({
  name: z.string().trim().min(1),
  framework_id: z.string().min(1).nullable().optional(),
  trigger_spec: triggerSpecSchema.optional(),
  scenario: flowScenarioSchema.optional(),
  status: flowStatusSchema.optional(),
}).strict()

const updateFlowSchema = createFlowSchema.partial().strict()

function invalidRequest(res: express.Response, parsedError: z.ZodError): void {
  res.status(400).json({ success: false, error: 'Invalid request', detail: parsedError.flatten() })
}

function ownerIdFromRequest(req: express.Request): string | null {
  const auth = getAuthContext(req)
  return auth?.userId ?? auth?.sub ?? null
}

function unauthorized(res: express.Response): void {
  res.status(401).json({ success: false, error: 'Unauthorized' })
}

export function createProjectRouter(db: Database.Database): express.Router {
  const router = express.Router()

  router.get('/today/docket', (req, res) => {
    const ownerId = ownerIdFromRequest(req)
    if (!ownerId) return unauthorized(res)
    res.json({ success: true, data: listDocketItems(db, ownerId) })
  })

  router.get('/captures', (req, res) => {
    const ownerId = ownerIdFromRequest(req)
    if (!ownerId) return unauthorized(res)
    res.json({ success: true, data: listCaptures(db, ownerId) })
  })

  router.post('/captures', (req, res) => {
    const ownerId = ownerIdFromRequest(req)
    if (!ownerId) return unauthorized(res)
    const parsed = createCaptureSchema.safeParse(req.body)
    if (!parsed.success) {
      invalidRequest(res, parsed.error)
      return
    }
    try {
      const capture = createCapture(db, {
        owner_id: ownerId,
        project_id: parsed.data.project_id ?? null,
        text: parsed.data.text,
        meta: parsed.data.meta ?? {},
      })
      res.status(201).json({ success: true, data: capture })
    } catch (error) {
      res.status(400).json({ success: false, error: error instanceof Error ? error.message : 'Failed to create capture' })
    }
  })

  router.post('/captures/:captureId/sync', (req, res) => {
    const ownerId = ownerIdFromRequest(req)
    if (!ownerId) return unauthorized(res)
    const capture = markCaptureSynced(db, ownerId, req.params.captureId)
    if (!capture) {
      res.status(404).json({ success: false, error: 'Capture not found' })
      return
    }
    res.json({ success: true, data: capture })
  })

  router.get('/runs/:runId/steps', (req, res) => {
    const ownerId = ownerIdFromRequest(req)
    if (!ownerId) return unauthorized(res)
    res.json({ success: true, data: listRunSteps(db, ownerId, req.params.runId) })
  })

  router.get('/', (req, res) => {
    const ownerId = ownerIdFromRequest(req)
    if (!ownerId) return unauthorized(res)
    res.json({ success: true, data: listProjects(db, ownerId) })
  })

  router.post('/', (req, res) => {
    const ownerId = ownerIdFromRequest(req)
    if (!ownerId) return unauthorized(res)
    const parsed = createProjectSchema.safeParse(req.body)
    if (!parsed.success) {
      invalidRequest(res, parsed.error)
      return
    }
    try {
      const project = createProject(db, {
        owner_id: ownerId,
        ...parsed.data,
      })
      res.status(201).json({ success: true, data: project })
    } catch (error) {
      res.status(400).json({ success: false, error: error instanceof Error ? error.message : 'Failed to create project' })
    }
  })

  router.get('/:id/ai-context', (req, res) => {
    const ownerId = ownerIdFromRequest(req)
    if (!ownerId) return unauthorized(res)
    try {
      res.json({ success: true, data: { context: buildProjectAIContext(db, ownerId, req.params.id) } })
    } catch (error) {
      res.status(404).json({ success: false, error: error instanceof Error ? error.message : 'Project not found' })
    }
  })

  router.post('/:id/open', (req, res) => {
    const ownerId = ownerIdFromRequest(req)
    if (!ownerId) return unauthorized(res)
    const project = updateProject(db, ownerId, req.params.id, { last_opened_at: new Date().toISOString() })
    if (!project) {
      res.status(404).json({ success: false, error: 'Project not found' })
      return
    }
    res.json({ success: true, data: project })
  })

  router.get('/:id/sources', (req, res) => {
    const ownerId = ownerIdFromRequest(req)
    if (!ownerId) return unauthorized(res)
    res.json({ success: true, data: listSources(db, ownerId, req.params.id) })
  })

  router.post('/:id/sources', (req, res) => {
    const ownerId = ownerIdFromRequest(req)
    if (!ownerId) return unauthorized(res)
    const parsed = addSourceSchema.safeParse(req.body)
    if (!parsed.success) {
      invalidRequest(res, parsed.error)
      return
    }
    try {
      const source = addSource(db, {
        owner_id: ownerId,
        project_id: req.params.id,
        kind: parsed.data.kind as ProjectSourceKind,
        title: parsed.data.title,
        reference: parsed.data.reference,
        summary: parsed.data.summary,
        content_hash: parsed.data.content_hash,
        size_bytes: parsed.data.size_bytes,
        mime_type: parsed.data.mime_type,
        meta: parsed.data.meta,
      })
      res.status(201).json({ success: true, data: source })
    } catch (error) {
      res.status(400).json({ success: false, error: error instanceof Error ? error.message : 'Failed to add source' })
    }
  })

  router.delete('/:projectId/sources/:sourceId', (req, res) => {
    const ownerId = ownerIdFromRequest(req)
    if (!ownerId) return unauthorized(res)
    const deleted = deleteSource(db, ownerId, req.params.sourceId)
    if (!deleted) {
      res.status(404).json({ success: false, error: 'Source not found' })
      return
    }
    res.json({ success: true, data: { deleted: true } })
  })

  router.get('/:id/docket', (req, res) => {
    const ownerId = ownerIdFromRequest(req)
    if (!ownerId) return unauthorized(res)
    res.json({ success: true, data: listDocketItems(db, ownerId, req.params.id) })
  })

  router.post('/:id/docket', (req, res) => {
    const ownerId = ownerIdFromRequest(req)
    if (!ownerId) return unauthorized(res)
    const parsed = addDocketItemSchema.safeParse(req.body)
    if (!parsed.success) {
      invalidRequest(res, parsed.error)
      return
    }
    const item = addDocketItem(db, {
      owner_id: ownerId,
      project_id: req.params.id,
      text: parsed.data.text,
      due_at: parsed.data.due_at,
      priority: parsed.data.priority,
    })
    res.status(201).json({ success: true, data: item })
  })

  router.post('/:projectId/docket/:itemId/toggle', (req, res) => {
    const ownerId = ownerIdFromRequest(req)
    if (!ownerId) return unauthorized(res)
    const item = toggleDocketItem(db, ownerId, req.params.itemId)
    if (!item) {
      res.status(404).json({ success: false, error: 'Docket item not found' })
      return
    }
    res.json({ success: true, data: item })
  })

  router.delete('/:projectId/docket/:itemId', (req, res) => {
    const ownerId = ownerIdFromRequest(req)
    if (!ownerId) return unauthorized(res)
    const deleted = deleteDocketItem(db, ownerId, req.params.itemId)
    if (!deleted) {
      res.status(404).json({ success: false, error: 'Docket item not found' })
      return
    }
    res.json({ success: true, data: { deleted: true } })
  })

  router.get('/:id/flows', (req, res) => {
    const ownerId = ownerIdFromRequest(req)
    if (!ownerId) return unauthorized(res)
    res.json({ success: true, data: listFlows(db, ownerId, req.params.id) })
  })

  router.post('/:id/flows', (req, res) => {
    const ownerId = ownerIdFromRequest(req)
    if (!ownerId) return unauthorized(res)
    const parsed = createFlowSchema.safeParse(req.body)
    if (!parsed.success) {
      invalidRequest(res, parsed.error)
      return
    }
    try {
      const flow = createFlow(db, {
        owner_id: ownerId,
        project_id: req.params.id,
        ...parsed.data,
      })
      res.status(201).json({ success: true, data: flow })
    } catch (error) {
      res.status(400).json({ success: false, error: error instanceof Error ? error.message : 'Failed to create flow' })
    }
  })

  router.get('/:projectId/flows/:flowId', (req, res) => {
    const ownerId = ownerIdFromRequest(req)
    if (!ownerId) return unauthorized(res)
    const flow = getFlow(db, ownerId, req.params.flowId)
    if (!flow || flow.project_id !== req.params.projectId) {
      res.status(404).json({ success: false, error: 'Flow not found' })
      return
    }
    res.json({ success: true, data: flow })
  })

  router.patch('/:projectId/flows/:flowId', (req, res) => {
    const ownerId = ownerIdFromRequest(req)
    if (!ownerId) return unauthorized(res)
    const parsed = updateFlowSchema.safeParse(req.body)
    if (!parsed.success) {
      invalidRequest(res, parsed.error)
      return
    }
    try {
      const flow = updateFlow(db, ownerId, req.params.flowId, parsed.data)
      if (!flow || flow.project_id !== req.params.projectId) {
        res.status(404).json({ success: false, error: 'Flow not found' })
        return
      }
      res.json({ success: true, data: flow })
    } catch (error) {
      res.status(400).json({ success: false, error: error instanceof Error ? error.message : 'Failed to update flow' })
    }
  })

  router.get('/:projectId/flows/:flowId/runs', (req, res) => {
    const ownerId = ownerIdFromRequest(req)
    if (!ownerId) return unauthorized(res)
    res.json({ success: true, data: listFlowRuns(db, ownerId, req.params.flowId, req.params.projectId) })
  })

  router.get('/:id', (req, res) => {
    const ownerId = ownerIdFromRequest(req)
    if (!ownerId) return unauthorized(res)
    const project = getProject(db, ownerId, req.params.id)
    if (!project) {
      res.status(404).json({ success: false, error: 'Project not found' })
      return
    }
    res.json({ success: true, data: project })
  })

  router.patch('/:id', (req, res) => {
    const ownerId = ownerIdFromRequest(req)
    if (!ownerId) return unauthorized(res)
    const parsed = updateProjectSchema.safeParse(req.body)
    if (!parsed.success) {
      invalidRequest(res, parsed.error)
      return
    }
    try {
      const project = updateProject(db, ownerId, req.params.id, parsed.data)
      if (!project) {
        res.status(404).json({ success: false, error: 'Project not found' })
        return
      }
      res.json({ success: true, data: project })
    } catch (error) {
      res.status(400).json({ success: false, error: error instanceof Error ? error.message : 'Failed to update project' })
    }
  })

  router.delete('/:id', (req, res) => {
    const ownerId = ownerIdFromRequest(req)
    if (!ownerId) return unauthorized(res)
    const deleted = deleteProject(db, ownerId, req.params.id)
    if (!deleted) {
      res.status(404).json({ success: false, error: 'Project not found' })
      return
    }
    res.json({ success: true, data: { deleted: true } })
  })

  return router
}
