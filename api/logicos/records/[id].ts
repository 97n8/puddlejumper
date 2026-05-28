import type { VercelRequest, VercelResponse } from '@vercel/node'
import { PatchLogicOSRecordInputSchema } from '../../../src/lib/logicos/schema'
import {
  getLogicOSActorFromRequest,
  getLogicOSConnectorContextFromRequest,
  getLogicOSRecord,
  patchLogicOSRecord,
} from '../../../src/lib/logicos/store'

export const config = { maxDuration: 30 }

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const id = typeof req.query.id === 'string' ? req.query.id.trim() : ''
  if (!id) {
    return res.status(400).json({ error: 'Record id is required' })
  }

  try {
    if (req.method === 'GET') {
      const bundle = await getLogicOSRecord(id)
      if (!bundle) return res.status(404).json({ error: 'Record not found' })
      return res.status(200).json(bundle)
    }

    if (req.method === 'PATCH') {
      const parsed = PatchLogicOSRecordInputSchema.safeParse(req.body)
      if (!parsed.success) {
        return res.status(400).json({ error: 'Invalid patch payload', issues: parsed.error.flatten() })
      }

      const bundle = await patchLogicOSRecord(id, parsed.data, {
        actor: getLogicOSActorFromRequest(req, parsed.data.source ?? 'records_patch'),
        connectorContext: getLogicOSConnectorContextFromRequest(req),
      })
      if (!bundle) return res.status(404).json({ error: 'Record not found' })
      return res.status(200).json(bundle)
    }

    res.setHeader('Allow', 'GET, PATCH')
    return res.status(405).json({ error: 'Method not allowed' })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return res.status(500).json({ error: message })
  }
}
