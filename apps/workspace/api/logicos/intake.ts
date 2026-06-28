import type { VercelRequest, VercelResponse } from '@vercel/node'
import { CreateWorkspaceRecordInputSchema } from '../../src/lib/logicos/schema'
import {
  createWorkspaceRecord,
  getWorkspaceActorFromRequest,
  getWorkspaceConnectorContextFromRequest,
} from '../../src/lib/logicos/store'

export const config = { maxDuration: 30 }

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const parsed = CreateWorkspaceRecordInputSchema.safeParse({
    ...req.body,
    source: typeof req.body?.source === 'string' && req.body.source.trim() ? req.body.source : 'webhook',
  })

  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid intake payload', issues: parsed.error.flatten() })
  }

  try {
    const bundle = await createWorkspaceRecord(parsed.data, {
      actor: getWorkspaceActorFromRequest(req, parsed.data.source),
      connectorContext: getWorkspaceConnectorContextFromRequest(req),
    })
    return res.status(201).json(bundle)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return res.status(500).json({ error: message })
  }
}
