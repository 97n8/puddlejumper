import type { VercelRequest, VercelResponse } from '@vercel/node'
import Anthropic from '@anthropic-ai/sdk'

export const config = { maxDuration: 30 }

function extractTextReply(content: Anthropic.Messages.Message['content']) {
  return content
    .filter(block => block.type === 'text')
    .map(block => block.text)
    .join('')
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const started = Date.now()
  const apiKey = process.env.ANTHROPIC_API_KEY

  if (!apiKey) {
    return res.status(500).json({
      ok: false,
      stage: 'env',
      error: 'ANTHROPIC_API_KEY not set',
    })
  }

  try {
    const client = new Anthropic({ apiKey })
    const message = await client.messages.create({
      model: 'claude-opus-4-7',
      max_tokens: 32,
      messages: [{ role: 'user', content: 'Reply with exactly: OK' }],
    })

    return res.status(200).json({
      ok: true,
      latency_ms: Date.now() - started,
      model: message.model,
      stop_reason: message.stop_reason,
      reply: extractTextReply(message.content),
      usage: message.usage,
    })
  } catch (error) {
    const status = typeof error === 'object' && error && 'status' in error ? error.status : undefined
    const type = typeof error === 'object' && error && 'error' in error && typeof error.error === 'object' && error.error && 'type' in error.error
      ? error.error.type
      : undefined
    const message = error instanceof Error ? error.message : String(error)

    return res.status(500).json({
      ok: false,
      stage: 'api_call',
      error: message,
      status,
      type,
    })
  }
}
