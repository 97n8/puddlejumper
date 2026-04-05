import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import os from 'node:os'
import fs from 'node:fs'
import path from 'node:path'
import {
  createWorkspace,
  getWorkspace,
  getWorkspaceByOwner,
  listWorkspaces,
  ensurePersonalWorkspace,
  updateWorkspacePlan,
  incrementApprovalCount,
  decrementApprovalCount,
  incrementMemberCount,
  decrementMemberCount,
  getMemberRole,
  addWorkspaceMember,
  removeWorkspaceMember,
  updateMemberRole,
  resetWorkspaceDb,
} from './workspaceStore'

let tmpDir: string

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pj-test-'))
  resetWorkspaceDb()
})

afterEach(() => {
  resetWorkspaceDb()
  fs.rmSync(tmpDir, { recursive: true, force: true })
})

// ── createWorkspace / getWorkspace ────────────────────────────────────────────

describe('createWorkspace', () => {
  it('creates and retrieves a workspace', () => {
    createWorkspace(tmpDir, 'ws-001', 'Sutton Town Hall', 'user-1')
    const ws = getWorkspace(tmpDir, 'ws-001')
    expect(ws).not.toBeNull()
    expect(ws!.id).toBe('ws-001')
    expect(ws!.name).toBe('Sutton Town Hall')
    expect(ws!.owner_id).toBe('user-1')
    expect(ws!.plan).toBe('free')
  })

  it('returns null for unknown workspace id', () => {
    expect(getWorkspace(tmpDir, 'nonexistent')).toBeNull()
  })

  it('sets default counts (member_count starts at 1 for owner)', () => {
    createWorkspace(tmpDir, 'ws-002', 'Test WS', 'user-2')
    const ws = getWorkspace(tmpDir, 'ws-002')!
    expect(ws.approval_count).toBe(0)
    expect(ws.template_count).toBe(0)
    expect(ws.member_count).toBe(1)
  })
})

// ── getWorkspaceByOwner ───────────────────────────────────────────────────────

describe('getWorkspaceByOwner', () => {
  it('finds workspace by owner_id', () => {
    createWorkspace(tmpDir, 'ws-003', 'Owner WS', 'owner-99')
    const ws = getWorkspaceByOwner(tmpDir, 'owner-99')
    expect(ws).not.toBeNull()
    expect(ws!.id).toBe('ws-003')
  })

  it('returns null when owner has no workspace', () => {
    expect(getWorkspaceByOwner(tmpDir, 'ghost-owner')).toBeNull()
  })
})

// ── listWorkspaces ────────────────────────────────────────────────────────────

describe('listWorkspaces', () => {
  it('lists all workspaces', () => {
    createWorkspace(tmpDir, 'ws-a', 'Alpha', 'user-a')
    createWorkspace(tmpDir, 'ws-b', 'Beta', 'user-b')
    const all = listWorkspaces(tmpDir)
    expect(all.length).toBeGreaterThanOrEqual(2)
    expect(all.map(w => w.id)).toContain('ws-a')
    expect(all.map(w => w.id)).toContain('ws-b')
  })
})

// ── ensurePersonalWorkspace ───────────────────────────────────────────────────

describe('ensurePersonalWorkspace', () => {
  it('creates a workspace on first call', () => {
    const ws = ensurePersonalWorkspace(tmpDir, 'u-100', 'alice')
    expect(ws.owner_id).toBe('u-100')
    expect(ws.name).toContain('alice')
  })

  it('is idempotent — returns same workspace on repeat calls', () => {
    const ws1 = ensurePersonalWorkspace(tmpDir, 'u-101', 'bob')
    const ws2 = ensurePersonalWorkspace(tmpDir, 'u-101', 'bob')
    expect(ws1.id).toBe(ws2.id)
  })
})

// ── updateWorkspacePlan ───────────────────────────────────────────────────────

describe('updateWorkspacePlan', () => {
  it('updates plan to a valid value', () => {
    createWorkspace(tmpDir, 'ws-plan', 'Plan WS', 'user-plan')
    updateWorkspacePlan(tmpDir, 'ws-plan', 'municipal')
    expect(getWorkspace(tmpDir, 'ws-plan')!.plan).toBe('municipal')
  })

  it('accepts all valid plan values', () => {
    createWorkspace(tmpDir, 'ws-plans', 'Plans WS', 'user-plans')
    for (const plan of ['free', 'pro', 'enterprise', 'municipal', 'pilot']) {
      expect(() => updateWorkspacePlan(tmpDir, 'ws-plans', plan)).not.toThrow()
    }
  })

  it('throws on invalid plan value', () => {
    createWorkspace(tmpDir, 'ws-bad-plan', 'Bad Plan', 'user-bad')
    expect(() => updateWorkspacePlan(tmpDir, 'ws-bad-plan', 'premium')).toThrow('Invalid plan value: premium')
  })

  it('throws on empty plan value', () => {
    createWorkspace(tmpDir, 'ws-empty', 'Empty Plan', 'user-empty')
    expect(() => updateWorkspacePlan(tmpDir, 'ws-empty', '')).toThrow()
  })
})

// ── counters ──────────────────────────────────────────────────────────────────

describe('approval counters', () => {
  it('increments and decrements approval count', () => {
    createWorkspace(tmpDir, 'ws-cnt', 'Counter WS', 'user-cnt')
    incrementApprovalCount(tmpDir, 'ws-cnt')
    incrementApprovalCount(tmpDir, 'ws-cnt')
    expect(getWorkspace(tmpDir, 'ws-cnt')!.approval_count).toBe(2)
    decrementApprovalCount(tmpDir, 'ws-cnt')
    expect(getWorkspace(tmpDir, 'ws-cnt')!.approval_count).toBe(1)
  })

  it('does not go below zero on decrement', () => {
    createWorkspace(tmpDir, 'ws-floor', 'Floor WS', 'user-floor')
    decrementApprovalCount(tmpDir, 'ws-floor')
    expect(getWorkspace(tmpDir, 'ws-floor')!.approval_count).toBeGreaterThanOrEqual(0)
  })
})

describe('member counters', () => {
  it('increments and decrements member count', () => {
    createWorkspace(tmpDir, 'ws-mem', 'Member WS', 'user-mem')
    const initial = getWorkspace(tmpDir, 'ws-mem')!.member_count // 1 (owner default)
    incrementMemberCount(tmpDir, 'ws-mem')
    expect(getWorkspace(tmpDir, 'ws-mem')!.member_count).toBe(initial + 1)
    decrementMemberCount(tmpDir, 'ws-mem')
    expect(getWorkspace(tmpDir, 'ws-mem')!.member_count).toBeGreaterThanOrEqual(1)
  })
})

// ── workspace members ─────────────────────────────────────────────────────────

describe('workspace members', () => {
  beforeEach(() => {
    createWorkspace(tmpDir, 'ws-mbr', 'Member Test', 'owner-mbr')
  })

  it('adds a member and retrieves their role', () => {
    addWorkspaceMember(tmpDir, 'ws-mbr', 'user-editor', 'admin', 'owner-mbr')
    expect(getMemberRole(tmpDir, 'ws-mbr', 'user-editor')).toBe('admin')
  })

  it('returns null for non-member', () => {
    expect(getMemberRole(tmpDir, 'ws-mbr', 'stranger')).toBeNull()
  })

  it('removes a member', () => {
    addWorkspaceMember(tmpDir, 'ws-mbr', 'user-temp', 'member', 'owner-mbr')
    expect(getMemberRole(tmpDir, 'ws-mbr', 'user-temp')).toBe('member')
    removeWorkspaceMember(tmpDir, 'ws-mbr', 'user-temp')
    expect(getMemberRole(tmpDir, 'ws-mbr', 'user-temp')).toBeNull()
  })

  it('updates a member role', () => {
    addWorkspaceMember(tmpDir, 'ws-mbr', 'user-role', 'viewer', 'owner-mbr')
    updateMemberRole(tmpDir, 'ws-mbr', 'user-role', 'admin', 'owner-mbr')
    expect(getMemberRole(tmpDir, 'ws-mbr', 'user-role')).toBe('admin')
  })
})
