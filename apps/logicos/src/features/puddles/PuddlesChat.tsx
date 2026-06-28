import { useEffect, useMemo, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'
import { clearPuddlesConversation, usePuddles } from './usePuddles'

function safeUrl(value: string) {
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.toString() : null
  } catch {
    return null
  }
}

function renderInlineMarkdown(text: string, keyPrefix: string) {
  const pattern = /(\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)|`([^`]+)`|\*\*([^*]+)\*\*|\*([^*]+)\*|(https?:\/\/[^\s<]+))/g
  const nodes: React.ReactNode[] = []
  let lastIndex = 0
  let match: RegExpExecArray | null = null
  let index = 0

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index))
    }

    if (match[2] && match[3]) {
      const href = safeUrl(match[3])
      nodes.push(
        href
          ? <a key={`${keyPrefix}-link-${index}`} href={href} target="_blank" rel="noreferrer" className="text-primary underline underline-offset-2">{match[2]}</a>
          : match[0],
      )
    } else if (match[4]) {
      nodes.push(
        <code key={`${keyPrefix}-code-${index}`} className="rounded bg-black/10 px-1.5 py-0.5 font-mono text-[0.9em] dark:bg-white/10">
          {match[4]}
        </code>,
      )
    } else if (match[5]) {
      nodes.push(<strong key={`${keyPrefix}-strong-${index}`}>{match[5]}</strong>)
    } else if (match[6]) {
      nodes.push(<em key={`${keyPrefix}-em-${index}`}>{match[6]}</em>)
    } else if (match[7]) {
      const href = safeUrl(match[7])
      nodes.push(
        href
          ? <a key={`${keyPrefix}-url-${index}`} href={href} target="_blank" rel="noreferrer" className="text-primary underline underline-offset-2">{match[7]}</a>
          : match[7],
      )
    }

    lastIndex = pattern.lastIndex
    index += 1
  }

  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex))
  }

  return nodes
}

function renderMarkdown(text: string, isStreaming = false) {
  const blocks = text.split(/```/)

  return (
    <div className="space-y-3">
      {blocks.map((block, blockIndex) => {
        if (blockIndex % 2 === 1) {
          const [language, ...rest] = block.split('\n')
          const code = rest.join('\n').trimEnd()
          return (
            <pre key={`code-${blockIndex}`} className="overflow-x-auto rounded-xl border border-border/60 bg-black/85 p-3 text-xs text-emerald-200">
              {language.trim() && <div className="mb-2 text-[10px] uppercase tracking-widest text-emerald-400/70">{language.trim()}</div>}
              <code>{code}</code>
            </pre>
          )
        }

        return block
          .split(/\n{2,}/)
          .filter(Boolean)
          .map((paragraph, paragraphIndex) => {
            const lines = paragraph.split('\n')
            const trimmed = paragraph.trim()

            if (/^#{1,3}\s/.test(trimmed)) {
              const level = trimmed.match(/^#+/)?.[0].length ?? 1
              const content = trimmed.replace(/^#{1,3}\s+/, '')
              const className = level === 1
                ? 'text-base font-semibold'
                : level === 2
                  ? 'text-sm font-semibold'
                  : 'text-sm font-medium'
              return (
                <div key={`heading-${blockIndex}-${paragraphIndex}`} className={className}>
                  {renderInlineMarkdown(content, `heading-${blockIndex}-${paragraphIndex}`)}
                </div>
              )
            }

            if (lines.every(line => /^(-|\*)\s+/.test(line.trim()))) {
              return (
                <ul key={`list-${blockIndex}-${paragraphIndex}`} className="list-disc space-y-1 pl-5">
                  {lines.map((line, lineIndex) => (
                    <li key={`list-item-${blockIndex}-${paragraphIndex}-${lineIndex}`}>
                      {renderInlineMarkdown(line.trim().replace(/^(-|\*)\s+/, ''), `list-${blockIndex}-${paragraphIndex}-${lineIndex}`)}
                    </li>
                  ))}
                </ul>
              )
            }

            return (
              <p key={`paragraph-${blockIndex}-${paragraphIndex}`} className="whitespace-pre-wrap break-words leading-6">
                {renderInlineMarkdown(paragraph, `paragraph-${blockIndex}-${paragraphIndex}`)}
              </p>
            )
          })
      })}

      {isStreaming && (
        <span className="inline-block animate-pulse font-mono text-primary">|</span>
      )}
    </div>
  )
}

function toolStateLabel(state: string) {
  switch (state) {
    case 'output-available':
      return 'done'
    case 'output-error':
      return 'error'
    case 'input-streaming':
    case 'input-available':
      return 'running'
    default:
      return state.replace(/-/g, ' ')
  }
}

function summarizeToolOutput(output: unknown) {
  if (output == null) return 'No result'
  if (typeof output === 'string') return output.length > 80 ? `${output.slice(0, 80).trimEnd()}…` : output
  if (Array.isArray(output)) return `${output.length} result${output.length === 1 ? '' : 's'}`
  if (typeof output === 'object') {
    const object = output as Record<string, unknown>
    const countKey = ['results', 'items', 'records', 'requests', 'users', 'tools'].find(key => Array.isArray(object[key]))
    if (countKey) {
      const count = (object[countKey] as unknown[]).length
      return `${count} result${count === 1 ? '' : 's'}`
    }
    if (typeof object.summary === 'string' && object.summary.trim()) return object.summary
    if (typeof object.content === 'string' && object.content.trim()) return object.content
  }
  return 'Result available'
}

function isToolPart(part: { type: string }) {
  return part.type === 'dynamic-tool' || part.type.startsWith('tool-')
}

function toolNameFromPart(part: { type: string; toolName?: string }) {
  return part.type === 'dynamic-tool' ? (part.toolName ?? 'tool') : part.type.replace(/^tool-/, '')
}

function ToolPartBlock({ part }: { part: Record<string, unknown> & { type: string; state: string } }) {
  const name = toolNameFromPart(part)
  const state = toolStateLabel(part.state)
  const output = part.output
  const summary = summarizeToolOutput(part.errorText ?? output)

  return (
    <details className="group rounded-xl border border-border/60 bg-background/65">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-2 text-xs text-muted-foreground">
        <span className="truncate font-mono">🔧 {name}</span>
        <span className="shrink-0 font-mono">{state}: {summary}</span>
      </summary>
      <div className="border-t border-border/60 px-3 py-3">
        <pre className="overflow-x-auto whitespace-pre-wrap break-words rounded-lg bg-muted/40 p-3 text-[11px] text-muted-foreground">
          {JSON.stringify({
            input: part.input,
            output: part.output,
            error: part.errorText,
          }, null, 2)}
        </pre>
      </div>
    </details>
  )
}

function messageText(message: { parts: Array<{ type: string; text?: string; state?: string }> }) {
  return message.parts
    .filter(part => part.type === 'text')
    .map(part => part.text ?? '')
    .join('')
}

export function PuddlesChat({
  conversationId,
  onNewConversation,
}: {
  conversationId: string
  onNewConversation: () => void
}) {
  const {
    messages,
    input,
    setInput,
    handleSubmit,
    isLoading,
    error,
    setMessages,
    toolsUnavailable,
    warning,
    stop,
  } = usePuddles(conversationId)
  const bottomRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [messages, isLoading])

  const hasMessages = messages.length > 0
  const lastAssistantMessageId = useMemo(() => {
    const assistants = messages.filter(message => message.role === 'assistant')
    return assistants.at(-1)?.id ?? null
  }, [messages])

  const clearConversation = () => {
    clearPuddlesConversation(conversationId)
    setMessages([])
  }

  return (
    <div className="flex h-full flex-col bg-background">
      {(toolsUnavailable || warning) && (
        <div className="border-b border-amber-500/20 bg-amber-500/10 px-4 py-2 text-xs text-amber-700 dark:text-amber-300">
          {toolsUnavailable ? (warning ?? 'PJ tools unavailable') : warning}
        </div>
      )}

      {error && (
        <div className="border-b border-destructive/20 bg-destructive/10 px-4 py-2 text-xs text-destructive">
          {error.message}
        </div>
      )}

      <ScrollArea className="min-h-0 flex-1">
        <div className="mx-auto flex w-full max-w-4xl flex-col gap-4 px-4 py-5">
          <div className="flex items-center justify-end gap-2">
            <Badge variant="outline" className="border-emerald-500/20 bg-emerald-500/8 text-emerald-700 dark:text-emerald-300">
              Sonnet 4.6
            </Badge>
            <Button type="button" variant="ghost" size="sm" className="h-8 rounded-xl px-2" onClick={clearConversation}>
              Clear
            </Button>
          </div>

          {!hasMessages && (
            <div className="flex flex-1 flex-col items-center justify-center gap-4 py-16 text-center">
              <div className="text-4xl">🦆</div>
              <div className="text-xl font-medium tracking-tight text-foreground">What do you need?</div>
              <Button type="button" variant="outline" size="sm" onClick={onNewConversation}>New chat</Button>
            </div>
          )}

          {messages.map(message => {
            const text = messageText(message)
            const toolParts = message.parts.filter(isToolPart)
            const isUser = message.role === 'user'
            const isAssistant = message.role === 'assistant'
            const isStreamingAssistant = isAssistant && message.id === lastAssistantMessageId && isLoading

            return (
              <div
                key={message.id}
                className={cn('flex w-full', isUser ? 'justify-end' : 'justify-start')}
              >
                <div className={cn('flex max-w-[85%] gap-3', isUser && 'flex-row-reverse')}>
                  {isAssistant && (
                    <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-emerald-500/12 text-sm">
                      🦆
                    </div>
                  )}

                  <div className={cn(
                    'space-y-2 rounded-2xl border px-4 py-3 shadow-sm',
                    isUser
                      ? 'border-border/60 bg-muted/80 text-foreground'
                      : 'border-border/60 bg-card text-card-foreground',
                  )}>
                    {text && (
                      <div className="text-sm">
                        {isUser ? (
                          <p className="whitespace-pre-wrap break-words leading-6">{text}</p>
                        ) : (
                          renderMarkdown(text, isStreamingAssistant)
                        )}
                      </div>
                    )}

                    {toolParts.map((part, index) => (
                      <ToolPartBlock key={`${message.id}-tool-${index}`} part={part as Record<string, unknown> & { type: string; state: string }} />
                    ))}
                  </div>
                </div>
              </div>
            )
          })}

          {isLoading && !messages.some(message => message.id === lastAssistantMessageId && message.role === 'assistant') && (
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-500/12">🦆</div>
              <div className="animate-pulse">Puddles is thinking…</div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>
      </ScrollArea>

      <form onSubmit={handleSubmit} className="border-t border-border/60 bg-background px-4 py-4">
        <div className="mx-auto flex w-full max-w-4xl items-end gap-3">
          <Textarea
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder="Ask Puddles"
            className="max-h-40 min-h-24 resize-y rounded-2xl"
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault()
                void handleSubmit()
              }
            }}
          />
          <div className="flex flex-col gap-2">
            {isLoading && (
              <Button type="button" variant="outline" size="sm" className="rounded-xl" onClick={() => { void stop() }}>
                Stop
              </Button>
            )}
            <Button type="submit" size="sm" className="rounded-xl px-4" disabled={!input.trim()}>
              Send
            </Button>
          </div>
        </div>
      </form>
    </div>
  )
}
