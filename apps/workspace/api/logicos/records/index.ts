import type { VercelRequest, VercelResponse } from '@vercel/node'
import {
  CreateWorkspaceRecordInputSchema,
  WorkspaceListRecordsFiltersSchema,
} from '../../../src/lib/logicos/schema'
import {
  createWorkspaceRecord,
  getWorkspaceActorFromRequest,
  getWorkspaceConnectorContextFromRequest,
  listWorkspaceRecords,
} from '../../../src/lib/logicos/store'

export const config = { maxDuration: 30 }

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method === 'POST') {
      const parsed = CreateWorkspaceRecordInputSchema.safeParse(req.body)
      if (!parsed.success) {
        return res.status(400).json({ error: 'Invalid record payload', issues: parsed.error.flatten() })
      }

      const bundle = await createWorkspaceRecord(parsed.data, {
        actor: getWorkspaceActorFromRequest(req, parsed.data.source ?? 'records_api'),
        connectorContext: getWorkspaceConnectorContextFromRequest(req),
      })

      return res.status(201).json(bundle)
    }

    if (req.method === 'GET') {
      const parsed = WorkspaceListRecordsFiltersSchema.safeParse(req.query)
      if (!parsed.success) {
        return res.status(400).json({ error: 'Invalid record filters', issues: parsed.error.flatten() })
      }

      const records = await listWorkspaceRecords(parsed.data)
      return res.status(200).json({ records })
    }

    res.setHeader('Allow', 'GET, POST')
    return res.status(405).json({ error: 'Method not allowed' })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return res.status(500).json({ error: message })
  }
}
