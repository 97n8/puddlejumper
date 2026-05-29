import { useEffect, useMemo, useState } from 'react'
import { DefaultChatTransport, type UIMessage } from 'ai'
import { useChat } from '@ai-sdk/react'
import { pjApi } from '@/services/pjApi'

export interface PuddlesConversation {
  id: string
  title: string
  messages: UIMessage[]
  createdAt: string
  updatedAt: string
}

export const PUDDLES_STORAGE_KEY = 'puddles_conversations'
const PUDDLES_UPDATED_EVENT = 'puddles-conversations-updated'

function isBrowser() {
  return typeof window !== 'undefined'
}

function emitConversationUpdate() {
  if (!isBrowser()) return
  window.dispatchEvent(new CustomEvent(PUDDLES_UPDATED_EVENT))
}

function clampTitle(value: string) {
  const trimmed = value.trim()
  if (!trimmed) return 'New chat'
  return trimmed.length > 40 ? `${trimmed.slice(0, 40).trimEnd()}…` : trimmed
}

function firstUserMessage(messages: UIMessage[]) {
  const userMessage = messages.find(message => message.role === 'user')
  if (!userMessage) return ''

  const text = userMessage.parts
    .filter(part => part.type === 'text')
    .map(part => part.text)
    .join(' ')

  return text.trim()
}

function sortConversations(conversations: PuddlesConversation[]) {
  return [...conversations].sort((left, right) => (
    new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime()
  ))
}

export function readPuddlesConversations(): PuddlesConversation[] {
  if (!isBrowser()) return []

  try {
    const raw = window.localStorage.getItem(PUDDLES_STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as PuddlesConversation[]
    return sortConversations(Array.isArray(parsed) ? parsed : [])
  } catch {
    return []
  }
}

function writePuddlesConversations(conversations: PuddlesConversation[]) {
  if (!isBrowser()) return
  window.localStorage.setItem(PUDDLES_STORAGE_KEY, JSON.stringify(sortConversations(conversations)))
  emitConversationUpdate()
}

export function getPuddlesConversation(conversationId: string) {
  return readPuddlesConversations().find(conversation => conversation.id === conversationId) ?? null
}

export function createPuddlesConversation() {
  const now = new Date().toISOString()
  const conversation: PuddlesConversation = {
    id: crypto.randomUUID(),
    title: 'New chat',
    messages: [],
    createdAt: now,
    updatedAt: now,
  }

  writePuddlesConversations([conversation, ...readPuddlesConversations()])
  return conversation
}

export function savePuddlesConversation(conversationId: string, messages: UIMessage[]) {
  const conversations = readPuddlesConversations()
  const existing = conversations.find(conversation => conversation.id === conversationId)
  const now = new Date().toISOString()

  const nextConversation: PuddlesConversation = {
    id: conversationId,
    title: clampTitle(firstUserMessage(messages)),
    messages,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  }

  const nextConversations = existing
    ? conversations.map(conversation => conversation.id === conversationId ? nextConversation : conversation)
    : [nextConversation, ...conversations]

  writePuddlesConversations(nextConversations)
  return nextConversation
}

export function clearPuddlesConversation(conversationId: string) {
  const conversations = readPuddlesConversations()
  const existing = conversations.find(conversation => conversation.id === conversationId)
  if (!existing) return

  writePuddlesConversations(conversations.map(conversation => (
    conversation.id === conversationId
      ? {
          ...conversation,
          title: 'New chat',
          messages: [],
          updatedAt: new Date().toISOString(),
        }
      : conversation
  )))
}

export function subscribeToPuddlesConversations(callback: () => void) {
  if (!isBrowser()) return () => {}

  window.addEventListener(PUDDLES_UPDATED_EVENT, callback)
  window.addEventListener('storage', callback)

  return () => {
    window.removeEventListener(PUDDLES_UPDATED_EVENT, callback)
    window.removeEventListener('storage', callback)
  }
}

async function getIdentityToken() {
  const response = await pjApi.identity.token()
  return response.token
}

function headerRecord(headers: HeadersInit | undefined) {
  if (!headers) return {} as Record<string, string>
  if (headers instanceof Headers) return Object.fromEntries(headers.entries())
  if (Array.isArray(headers)) return Object.fromEntries(headers)
  return headers
}

export function usePuddles(conversationId: string) {
  const initialMessages = useMemo(
    () => getPuddlesConversation(conversationId)?.messages ?? [],
    [conversationId],
  )
  const [input, setInput] = useState('')
  const [toolsUnavailable, setToolsUnavailable] = useState(false)
  const [warning, setWarning] = useState<string | null>(null)

  const {
    messages,
    setMessages,
    sendMessage,
    error,
    status,
    stop,
  } = useChat({
    id: conversationId,
    messages: initialMessages,
    transport: new DefaultChatTransport({
      api: '/api/puddles/chat',
      body: { conversationId },
      prepareSendMessagesRequest: async ({ body, headers }) => {
        const nextHeaders = headerRecord(headers)

        try {
          const token = await getIdentityToken()
          nextHeaders.Authorization = `Bearer ${token}`
        } catch {
          setToolsUnavailable(true)
          setWarning('PJ tools unavailable')
        }

        return {
          body: { ...body, conversationId },
          headers: nextHeaders,
        }
      },
      fetch: async (request, init) => {
        const response = await fetch(request, init)
        const unavailable = response.headers.get('x-puddles-tools-unavailable') === '1'
        const headerWarning = response.headers.get('x-puddles-warning')

        setToolsUnavailable(unavailable)
        setWarning(unavailable ? (headerWarning ?? 'PJ tools unavailable') : null)

        return response
      },
    }),
    onFinish: ({ messages: finishedMessages }) => {
      savePuddlesConversation(conversationId, finishedMessages)
    },
    onError: (nextError) => {
      setWarning(nextError.message)
    },
  })

  useEffect(() => {
    setMessages(initialMessages)
    setInput('')
  }, [conversationId, initialMessages, setMessages])

  useEffect(() => {
    savePuddlesConversation(conversationId, messages)
  }, [conversationId, messages])

  const handleSubmit = async (event?: { preventDefault?: () => void }) => {
    event?.preventDefault?.()
    const nextInput = input.trim()
    if (!nextInput || status === 'submitted' || status === 'streaming') return

    setInput('')
    await sendMessage({ text: nextInput })
  }

  return {
    messages,
    input,
    setInput,
    handleSubmit,
    isLoading: status === 'submitted' || status === 'streaming',
    status,
    error,
    stop,
    setMessages,
    toolsUnavailable,
    warning,
  }
}
