import type { VercelRequest, VercelResponse } from '@vercel/node'
import { CreateLogicOSRecordInputSchema } from '../../src/lib/logicos/schema'
import {
  createLogicOSRecord,
  getLogicOSActorFromRequest,
  getLogicOSConnectorContextFromRequest,
} from '../../src/lib/logicos/store'

export const config = { maxDuration: 30 }

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const parsed = CreateLogicOSRecordInputSchema.safeParse({
    ...req.body,
    source: typeof req.body?.source === 'string' && req.body.source.trim() ? req.body.source : 'webhook',
  })

  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid intake payload', issues: parsed.error.flatten() })
  }

  try {
    const bundle = await createLogicOSRecord(parsed.data, {
      actor: getLogicOSActorFromRequest(req, parsed.data.source),
      connectorContext: getLogicOSConnectorContextFromRequest(req),
    })
    return res.status(201).json(bundle)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return res.status(500).json({ error: message })
  }
}
