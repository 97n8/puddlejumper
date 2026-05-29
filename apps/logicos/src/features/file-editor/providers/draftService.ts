import type { DraftConflict, DraftStatus, FileDraft } from './types'
import { djb2 } from '../utils'
import { pjApi } from '@/services/pjApi'

const AUTOSAVE_INTERVAL_MS = 3_000
const FORM_TYPE = 'file_editor'

function errorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message
  return 'Draft sync failed'
}

function toFileDraft(draft: Awaited<ReturnType<typeof pjApi.drafts.get>>): FileDraft {
  return {
    draftId: draft.draftId,
    formType: draft.formType,
    formKey: draft.formKey,
    casespaceId: draft.casespaceId,
    authorPrincipalId: draft.authorPrincipalId,
    draftState: draft.draftState,
    path: draft.path,
    content: draft.content,
    cursorLine: draft.cursorLine,
    cursorCol: draft.cursorCol,
    timestamp: draft.timestamp,
    source: 'server',
    baseContentHash: draft.baseContentHash,
    createdAt: draft.createdAt,
    updatedAt: draft.updatedAt,
    submittedAt: draft.submittedAt,
    currentState: draft.currentState,
  }
}

export class DraftService {
  private draftId: string | null = null
  private formKey: string | null = null
  private path: string
  private initialContent: string
  private userId?: string
  private casespaceId?: string
  private baseContentHash: string
  private lastHash = ''
  private serverTimer?: ReturnType<typeof setInterval>
  private onStatusChange?: (s: DraftStatus) => void
  private getContent?: () => string
  private getCursor?: () => { line: number; col: number }

  constructor(path: string, initialContent: string, casespaceId?: string | null, userId?: string) {
    this.path = path
    this.initialContent = initialContent
    this.userId = userId
    this.casespaceId = casespaceId ?? undefined
    this.baseContentHash = djb2(initialContent)
  }

  async loadDrafts(baseContent: string): Promise<DraftConflict | null> {
    if (!this.casespaceId) return null

    const { drafts } = await pjApi.drafts.list(this.casespaceId, this.path)
    const match = drafts[0]
    if (!match) return null

    this.draftId = match.draftId
    this.formKey = match.formKey

    if (match.content === baseContent) return null

    const serverDraft = toFileDraft(match)
    const baseHash = djb2(baseContent)
    return {
      localDraft: serverDraft,
      serverDraft,
      hasConflict: Boolean(match.baseContentHash && match.baseContentHash !== baseHash),
      newerSource: 'server',
    }
  }

  start(
    getContent: () => string,
    getCursor?: () => { line: number; col: number },
    onStatusChange?: (s: DraftStatus) => void,
  ) {
    this.getContent = getContent
    this.getCursor = getCursor
    this.onStatusChange = onStatusChange

    if (!this.casespaceId) return
    this.serverTimer = setInterval(() => {
      void this.tickServer()
    }, AUTOSAVE_INTERVAL_MS)
  }

  stop() {
    clearInterval(this.serverTimer)
  }

  private buildBody() {
    const content = this.getContent?.() ?? ''
    const cursor = this.getCursor?.()
    return {
      path: this.path,
      content,
      cursorLine: cursor?.line,
      cursorCol: cursor?.col,
      baseContentHash: this.baseContentHash,
      draftState: 'working' as const,
    }
  }

  private async persistDraft(): Promise<void> {
    if (!this.casespaceId) return

    const body = this.buildBody()
    this.onStatusChange?.({ saving: true, lastSaved: null, error: null })

    try {
      const response = this.draftId
        ? await pjApi.drafts.update(this.draftId, body)
        : await pjApi.drafts.create({ ...body, casespaceId: this.casespaceId })

      this.draftId = response.draft.draftId
      this.formKey = response.draft.formKey
      this.onStatusChange?.({ saving: false, lastSaved: new Date(), error: null })
    } catch (error) {
      this.onStatusChange?.({ saving: false, lastSaved: null, error: errorMessage(error) })
      throw error
    }
  }

  private async tickServer() {
    if (!this.casespaceId) return

    const content = this.getContent?.() ?? ''
    const hash = djb2(content)
    if (!this.draftId && content === this.initialContent) return
    if (hash === this.lastHash) return

    await this.persistDraft()
    this.lastHash = hash
  }

  async saveNow(content: string, cursor?: { line: number; col: number }): Promise<void> {
    if (!this.casespaceId) return

    this.getContent = () => content
    this.getCursor = () => cursor ?? { line: 1, col: 1 }
    await this.persistDraft()
    this.lastHash = djb2(content)
  }

  async discard(): Promise<void> {
    if (!this.draftId) return
    await pjApi.drafts.discard(this.draftId)
    this.draftId = null
    this.formKey = null
    this.lastHash = ''
  }

  async submit(): Promise<void> {
    if (!this.draftId) return
    const { draft } = await pjApi.drafts.submit(this.draftId)
    this.draftId = draft.draftId
    this.formKey = draft.formKey
    this.lastHash = ''
  }
}
