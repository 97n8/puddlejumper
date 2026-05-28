import type { VercelRequest, VercelResponse } from '@vercel/node'
import { anthropic } from '@ai-sdk/anthropic'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js'
import { convertToModelMessages, jsonSchema, stepCountIs, streamText, tool, type ToolSet, type UIMessage } from 'ai'
import { PUDDLES_SYSTEM_PROMPT } from '../../src/features/puddles/puddlesSystemPrompt.js'

export const config = { maxDuration: 60 }

const DEFAULT_PJ_MCP_URL = 'https://api.publiclogic.org/mcp/sse'

function normalizeToolSchema(schema: unknown) {
  if (schema && typeof schema === 'object') return schema as Record<string, unknown>
  return {
    type: 'object',
    properties: {},
    additionalProperties: true,
  }
}

function extractTextContent(content: unknown) {
  if (!Array.isArray(content)) return null

  const text = content
    .filter((part): part is { type: string; text?: string } => !!part && typeof part === 'object' && 'type' in part)
    .filter(part => part.type === 'text' && typeof part.text === 'string')
    .map(part => part.text)
    .join('\n')
    .trim()

  return text || null
}

function normalizeToolResult(result: Record<string, unknown>) {
  return {
    isError: result.isError === true,
    content: extractTextContent(result.content),
    structuredContent: result.structuredContent ?? null,
    contentParts: result.content ?? [],
  }
}

async function createMcpToolSet(token: string) {
  const transport = new SSEClientTransport(
    new URL(process.env.PJ_MCP_URL || DEFAULT_PJ_MCP_URL),
    {
      requestInit: {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    },
  )

  const client = new Client(
    { name: 'Workspace Puddles', version: '1.0.0' },
    { capabilities: {} },
  )

  await client.connect(transport)
  const listed = await client.listTools()

  const tools = Object.fromEntries(
    listed.tools.map(toolDefinition => [
      toolDefinition.name,
      tool({
        description: toolDefinition.description ?? toolDefinition.name,
        inputSchema: jsonSchema(normalizeToolSchema(toolDefinition.inputSchema)),
        execute: async (input) => {
          const result = await client.callTool({
            name: toolDefinition.name,
            arguments: (input ?? {}) as Record<string, unknown>,
          })

          return normalizeToolResult(result as unknown as Record<string, unknown>)
        },
      }),
    ]),
  ) as ToolSet

  return {
    tools,
    close: async () => {
      await transport.close().catch(() => {})
    },
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(500).json({ error: 'ANTHROPIC_API_KEY is not configured' })
  }

  const requestMessages = Array.isArray(req.body?.messages) ? req.body.messages as UIMessage[] : []
  const modelMessages = await convertToModelMessages(
    requestMessages.map(({ id: _id, ...message }) => message),
  )

  let closeMcp = async () => {}
  let tools: ToolSet | undefined
  let warning: string | null = null
  const bearer = typeof req.headers.authorization === 'string' ? req.headers.authorization.replace(/^Bearer\s+/i, '').trim() : ''

  if (bearer) {
    try {
      const mcp = await createMcpToolSet(bearer)
      tools = mcp.tools
      closeMcp = mcp.close
    } catch (error) {
      warning = error instanceof Error ? error.message : 'PJ tools unavailable'
    }
  } else {
    warning = 'PJ tools unavailable'
  }

  res.on('close', () => {
    void closeMcp()
  })

  const result = streamText({
    model: anthropic('claude-sonnet-4-6'),
    system: PUDDLES_SYSTEM_PROMPT,
    messages: modelMessages,
    tools,
    stopWhen: stepCountIs(10),
    onFinish: async () => {
      await closeMcp()
    },
  })

  result.pipeUIMessageStreamToResponse(res, {
    headers: warning
      ? {
          'x-puddles-tools-unavailable': '1',
          'x-puddles-warning': warning,
        }
      : undefined,
  })
}
