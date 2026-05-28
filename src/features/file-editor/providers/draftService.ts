import type { FileDraft, DraftConflict, DraftStatus } from './types'
import { djb2 } from '../utils'
import { pjBase } from '@/services/pjBase'

const AUTOSAVE_INTERVAL_MS = 3_000
const SERVER_SYNC_INTERVAL_MS = 30_000
const MAX_LOCAL_DRAFTS = 50
const MAX_DRAFT_SIZE = 512 * 1024

const PJ = pjBase

function localKey(draftId: string) { return `pj:draft:${draftId}` }

function computeDraftId(userId: string | undefined, path: string): string {
  return djb2((userId ?? 'anon') + path)
}

function pruneLocalDrafts(exceptId: string) {
  const keys: Array<{ key: string; ts: number }> = []
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i)
    if (k?.startsWith('pj:draft:') && k !== localKey(exceptId)) {
      try { keys.push({ key: k, ts: JSON.parse(localStorage.getItem(k)!).timestamp ?? 0 }) } catch { /* intentional */ }
    }
  }
  if (keys.length >= MAX_LOCAL_DRAFTS) {
    keys.sort((a, b) => a.ts < b.ts ? -1 : 1)
    const toRemove = keys.slice(0, keys.length - MAX_LOCAL_DRAFTS + 1)
    toRemove.forEach(({ key }) => localStorage.removeItem(key))
  }
}

function saveLocal(draft: FileDraft) {
  const str = JSON.stringify(draft)
  if (str.length > MAX_DRAFT_SIZE) return
  pruneLocalDrafts(draft.draftId)
  try {
    localStorage.setItem(localKey(draft.draftId), str)
  } catch (e: unknown) {
    if (e instanceof Error && e.name === 'QuotaExceededError') {
      pruneLocalDrafts(draft.draftId)
      try { localStorage.setItem(localKey(draft.draftId), str) } catch { /* intentional */ }
    }
  }
}

function loadLocal(draftId: string): FileDraft | null {
  try {
    const raw = localStorage.getItem(localKey(draftId))
    if (!raw) return null
    return { ...JSON.parse(raw), source: 'local' }
  } catch { return null }
}

async function loadServer(draftId: string): Promise<FileDraft | null> {
  if (!PJ) return null
  try {
    const res = await fetch(`${PJ}/api/files/drafts/${draftId}`, { credentials: 'include' })
    if (res.status === 404) return null
    if (!res.ok) return null
    return { ...(await res.json()), source: 'server' as const }
  } catch { return null }
}

async function saveServer(draft: FileDraft): Promise<void> {
  if (!PJ) return
  try {
    await fetch(`${PJ}/api/files/drafts`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(draft),
    })
  } catch { /* intentional */ }
}

async function deleteServer(draftId: string): Promise<void> {
  if (!PJ) return
  try {
    await fetch(`${PJ}/api/files/drafts/${draftId}`, { method: 'DELETE', credentials: 'include' })
  } catch { /* intentional */ }
}

export class DraftService {
  private draftId: string
  private path: string
  private initialContent: string
  private userId?: string
  private baseContentHash: string
  private lastHash = ''
  private localTimer?: ReturnType<typeof setInterval>
  private serverTimer?: ReturnType<typeof setInterval>
  private onStatusChange?: (s: DraftStatus) => void
  private getContent?: () => string
  private getCursor?: () => { line: number; col: number }

  constructor(path: string, initialContent: string, userId?: string) {
    this.path = path
    this.initialContent = initialContent
    this.userId = userId
    this.draftId = computeDraftId(userId, path)
    this.baseContentHash = djb2(initialContent)
  }

  async loadDrafts(baseContent: string): Promise<DraftConflict | null> {
    const [local, server] = await Promise.all([
      Promise.resolve(loadLocal(this.draftId)),
      loadServer(this.draftId),
    ])
    const baseHash = djb2(baseContent)
    const filter = (d: FileDraft | null) => {
      if (!d) return null
      if (d.content === baseContent) return null
      if (d.baseContentHash === baseHash) return null
      return d
    }
    const lf = filter(local), sf = filter(server)
    if (!lf && !sf) return null
    const primary = lf && sf
      ? (lf.timestamp >= sf.timestamp ? lf : sf)
      : (lf ?? sf!)
    const newerSource = primary.source
    const hasConflict = !!(lf && sf && lf.content !== sf.content)
    return { localDraft: lf ?? sf!, serverDraft: sf ?? undefined, hasConflict, newerSource }
  }

  start(
    getContent: () => string,
    getCursor?: () => { line: number; col: number },
    onStatusChange?: (s: DraftStatus) => void,
  ) {
    this.getContent = getContent
    this.getCursor = getCursor
    this.onStatusChange = onStatusChange

    this.localTimer = setInterval(() => this._tickLocal(), AUTOSAVE_INTERVAL_MS)
    this.serverTimer = setInterval(() => this._tickServer(), SERVER_SYNC_INTERVAL_MS)
  }

  stop() {
    clearInterval(this.localTimer)
    clearInterval(this.serverTimer)
  }

  private _draft(): FileDraft {
    const content = this.getContent?.() ?? ''
    const cursor = this.getCursor?.()
    return {
      draftId: this.draftId,
      userId: this.userId,
      path: this.path,
      content,
      cursorLine: cursor?.line,
      cursorCol: cursor?.col,
      timestamp: new Date().toISOString(),
      source: 'local',
      baseContentHash: this.baseContentHash,
    }
  }

  private _tickLocal() {
    const content = this.getContent?.() ?? ''
    const hash = djb2(content)
    if (hash === this.lastHash || content === this.initialContent) return
    this.lastHash = hash
    saveLocal({ ...this._draft(), source: 'local' })
    this.onStatusChange?.({ saving: false, lastSaved: new Date(), error: null })
  }

  private async _tickServer() {
    const draft = this._draft()
    this.onStatusChange?.({ saving: true, lastSaved: null, error: null })
    await saveServer({ ...draft, source: 'server' })
    this.onStatusChange?.({ saving: false, lastSaved: new Date(), error: null })
  }

  async saveNow(content: string, cursor?: { line: number; col: number }): Promise<void> {
    const draft: FileDraft = {
      draftId: this.draftId, userId: this.userId, path: this.path,
      content, cursorLine: cursor?.line, cursorCol: cursor?.col,
      timestamp: new Date().toISOString(), source: 'local',
      baseContentHash: this.baseContentHash,
    }
    saveLocal(draft)
    await saveServer({ ...draft, source: 'server' })
  }

  async discard(): Promise<void> {
    localStorage.removeItem(localKey(this.draftId))
    await deleteServer(this.draftId)
  }
}
