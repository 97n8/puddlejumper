import { useEffect, useMemo, useState } from 'react'
import { formatDistanceToNow } from 'date-fns'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  createPuddlesConversation,
  readPuddlesConversations,
  subscribeToPuddlesConversations,
  type PuddlesConversation,
} from './usePuddles'
import { PuddlesChat } from './PuddlesChat'

function timeAgo(value: string) {
  try {
    return formatDistanceToNow(new Date(value), { addSuffix: true })
  } catch {
    return value
  }
}

export function PuddlesPage() {
  const [conversations, setConversations] = useState<PuddlesConversation[]>(() => readPuddlesConversations())
  const [activeConversationId, setActiveConversationId] = useState<string | null>(() => readPuddlesConversations()[0]?.id ?? null)

  useEffect(() => {
    const sync = () => {
      const nextConversations = readPuddlesConversations()
      setConversations(nextConversations)
      setActiveConversationId(current => {
        if (current && nextConversations.some(conversation => conversation.id === current)) return current
        return nextConversations[0]?.id ?? null
      })
    }

    if (readPuddlesConversations().length === 0) {
      const conversation = createPuddlesConversation()
      setConversations([conversation])
      setActiveConversationId(conversation.id)
    }

    return subscribeToPuddlesConversations(sync)
  }, [])

  const activeConversation = useMemo(
    () => conversations.find(conversation => conversation.id === activeConversationId) ?? null,
    [activeConversationId, conversations],
  )

  const handleNewConversation = () => {
    const conversation = createPuddlesConversation()
    setConversations(readPuddlesConversations())
    setActiveConversationId(conversation.id)
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-background lg:flex-row">
      <aside className="flex w-full shrink-0 flex-col border-b border-border/60 bg-card/50 lg:w-60 lg:border-b-0 lg:border-r">
        <div className="border-b border-border/60 p-4">
          <Button className="w-full justify-center rounded-xl" onClick={handleNewConversation}>
            New Chat
          </Button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-3">
          <div className="space-y-1.5">
            {conversations.map(conversation => (
              <button
                key={conversation.id}
                type="button"
                onClick={() => setActiveConversationId(conversation.id)}
                className={cn(
                  'w-full rounded-xl border px-3 py-2.5 text-left transition-colors',
                  activeConversationId === conversation.id
                    ? 'border-primary/25 bg-primary/10'
                    : 'border-transparent hover:border-border/60 hover:bg-muted/40',
                )}
              >
                <div className="truncate text-sm font-medium text-foreground">
                  {conversation.title || 'New chat'}
                </div>
                <div className="mt-1 text-[11px] text-muted-foreground">
                  {timeAgo(conversation.updatedAt)}
                </div>
              </button>
            ))}
          </div>
        </div>
      </aside>

      <main className="min-h-0 flex-1">
        {activeConversation && (
          <PuddlesChat
            key={activeConversation.id}
            conversationId={activeConversation.id}
            onNewConversation={handleNewConversation}
          />
        )}
      </main>
    </div>
  )
}
