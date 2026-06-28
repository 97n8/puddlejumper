import { beforeEach, describe, expect, it, vi } from 'vitest'

const testState = vi.hoisted(() => ({
  list: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  discard: vi.fn(),
  submit: vi.fn(),
}))

vi.mock('@/services/pjApi', () => ({
  pjApi: {
    drafts: testState,
  },
}))

const { DraftService } = await import('@/features/file-editor/providers/draftService')

describe('DraftService', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    localStorage.clear()
    sessionStorage.clear()
    testState.list.mockReset()
    testState.create.mockReset()
    testState.update.mockReset()
    testState.discard.mockReset()
    testState.submit.mockReset()
  })

  it('loads existing drafts from PJ and never writes browser storage', async () => {
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem')
    testState.list.mockResolvedValue({
      drafts: [{
        draftId: 'draft-1',
        formType: 'file_editor',
        formKey: 'formkey:file_editor:cs-1:draft-1',
        casespaceId: 'cs-1',
        authorPrincipalId: 'u1',
        draftState: 'working',
        payload: { path: 'notes/a.md', content: 'saved draft', cursorLine: 1, cursorCol: 1, baseContentHash: 'base-1' },
        path: 'notes/a.md',
        content: 'saved draft',
        cursorLine: 1,
        cursorCol: 1,
        baseContentHash: 'base-1',
        createdAt: '2026-05-28T00:00:00.000Z',
        updatedAt: '2026-05-28T00:01:00.000Z',
        submittedAt: null,
        currentState: 'pre_received',
        timestamp: '2026-05-28T00:01:00.000Z',
        source: 'server',
      }],
    })

    const svc = new DraftService('notes/a.md', 'base content', 'cs-1', 'u1')
    const conflict = await svc.loadDrafts('base content')

    expect(testState.list).toHaveBeenCalledWith('cs-1', 'notes/a.md')
    expect(conflict?.serverDraft?.content).toBe('saved draft')
    expect(setItemSpy).not.toHaveBeenCalled()
  })

  it('creates, updates, submits, and discards through pjApi only', async () => {
    let content = 'first draft'
    let cursor = { line: 1, col: 1 }

    testState.list.mockResolvedValue({ drafts: [] })
    testState.create.mockResolvedValue({
      draft: {
        draftId: 'draft-2',
        formType: 'file_editor',
        formKey: 'formkey:file_editor:cs-1:draft-2',
        casespaceId: 'cs-1',
        authorPrincipalId: 'u1',
        draftState: 'working',
        payload: { path: 'notes/b.md', content: 'first draft' },
        path: 'notes/b.md',
        content: 'first draft',
        createdAt: '2026-05-28T00:00:00.000Z',
        updatedAt: '2026-05-28T00:00:01.000Z',
        submittedAt: null,
        currentState: 'pre_received',
        timestamp: '2026-05-28T00:00:01.000Z',
        source: 'server',
      },
    })
    testState.update.mockResolvedValue({
      draft: {
        draftId: 'draft-2',
        formType: 'file_editor',
        formKey: 'formkey:file_editor:cs-1:draft-2',
        casespaceId: 'cs-1',
        authorPrincipalId: 'u1',
        draftState: 'working',
        payload: { path: 'notes/b.md', content: 'second draft' },
        path: 'notes/b.md',
        content: 'second draft',
        createdAt: '2026-05-28T00:00:00.000Z',
        updatedAt: '2026-05-28T00:00:05.000Z',
        submittedAt: null,
        currentState: 'pre_received',
        timestamp: '2026-05-28T00:00:05.000Z',
        source: 'server',
      },
    })
    testState.submit.mockResolvedValue({
      draft: {
        draftId: 'draft-2',
        formType: 'file_editor',
        formKey: 'formkey:file_editor:cs-1:draft-2',
        casespaceId: 'cs-1',
        authorPrincipalId: 'u1',
        draftState: 'ready',
        payload: { path: 'notes/b.md', content: 'second draft' },
        path: 'notes/b.md',
        content: 'second draft',
        createdAt: '2026-05-28T00:00:00.000Z',
        updatedAt: '2026-05-28T00:00:06.000Z',
        submittedAt: '2026-05-28T00:00:06.000Z',
        currentState: 'received',
        timestamp: '2026-05-28T00:00:06.000Z',
        source: 'server',
      },
    })
    testState.discard.mockResolvedValue(undefined)

    const svc = new DraftService('notes/b.md', '', 'cs-1', 'u1')
    svc.start(() => content, () => cursor, vi.fn())

    await vi.advanceTimersByTimeAsync(3_000)
    expect(testState.create).toHaveBeenCalledWith(expect.objectContaining({
      casespaceId: 'cs-1',
      path: 'notes/b.md',
      content: 'first draft',
    }))

    content = 'second draft'
    cursor = { line: 2, col: 4 }
    await vi.advanceTimersByTimeAsync(3_000)

    expect(testState.update).toHaveBeenCalledWith('draft-2', expect.objectContaining({
      path: 'notes/b.md',
      content: 'second draft',
      cursorLine: 2,
      cursorCol: 4,
    }))

    await svc.submit()
    expect(testState.submit).toHaveBeenCalledWith('draft-2')

    await svc.discard()
    expect(testState.discard).toHaveBeenCalledWith('draft-2')
  })
})
