import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { RECIPES } from '@/features/flows/data/recipes'
import { fmtRelative } from '@/features/flows/utils'

// ── RECIPES data integrity ────────────────────────────────────────────────────

describe('RECIPES catalog', () => {
  it('has at least 10 recipes', () => {
    expect(RECIPES.length).toBeGreaterThan(10)
  })

  it('every recipe has required id and name', () => {
    for (const r of RECIPES) {
      expect(r.id, `Recipe missing id`).toBeTruthy()
      expect(r.name, `Recipe ${r.id} missing name`).toBeTruthy()
    }
  })

  it('recipe ids are unique', () => {
    const ids = RECIPES.map(r => r.id)
    const unique = new Set(ids)
    expect(unique.size).toBe(ids.length)
  })

  it('includes at least one utility recipe', () => {
    expect(RECIPES.some(r => r.id.startsWith('util-'))).toBe(true)
  })
})

// ── fmtRelative utility ───────────────────────────────────────────────────────

describe('fmtRelative', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('returns "just now" for < 60 seconds ago', () => {
    vi.setSystemTime(new Date('2026-04-06T12:00:30Z'))
    const ts = new Date('2026-04-06T12:00:00Z').getTime()
    expect(fmtRelative(ts)).toBe('just now')
  })

  it('returns minutes for < 1 hour', () => {
    vi.setSystemTime(new Date('2026-04-06T12:05:00Z'))
    const ts = new Date('2026-04-06T12:00:00Z').getTime()
    expect(fmtRelative(ts)).toBe('5m ago')
  })

  it('returns hours for < 1 day', () => {
    vi.setSystemTime(new Date('2026-04-06T15:00:00Z'))
    const ts = new Date('2026-04-06T12:00:00Z').getTime()
    expect(fmtRelative(ts)).toBe('3h ago')
  })

  it('returns days for >= 1 day', () => {
    vi.setSystemTime(new Date('2026-04-08T12:00:00Z'))
    const ts = new Date('2026-04-06T12:00:00Z').getTime()
    expect(fmtRelative(ts)).toBe('2d ago')
  })
})

// ── FlowsPanel smoke ─────────────────────────────────────────────────────────

vi.mock('@/hooks/useKV', () => ({
  useKV: vi.fn().mockReturnValue([[], vi.fn()]),
}))

vi.mock('@/services/pjApi', () => ({
  pjApi: {
    microsoft: { get: vi.fn() },
    google: { get: vi.fn() },
    github: { get: vi.fn() },
    connectors: { status: vi.fn().mockResolvedValue([]) },
  },
  pjBase: 'http://localhost:3002',
}))

vi.mock('@/services/pjBase', () => ({ pjBase: 'http://localhost:3002' }))

describe('FlowsPanel smoke', () => {
  it('renders without crashing', async () => {
    const { FlowsPanel } = await import('@/features/flows/components/FlowsPanel')
    render(<FlowsPanel />)
    expect(screen.getByText('SYNCHRON8')).toBeInTheDocument()
  })

  it('shows Integrations nav item', async () => {
    const { FlowsPanel } = await import('@/features/flows/components/FlowsPanel')
    render(<FlowsPanel />)
    expect(screen.getByText('Integrations')).toBeInTheDocument()
  })

  it('shows Catalog nav item', async () => {
    const { FlowsPanel } = await import('@/features/flows/components/FlowsPanel')
    render(<FlowsPanel />)
    expect(screen.getByText('Catalog')).toBeInTheDocument()
  })

  it('renders Run History nav item', async () => {
    const { FlowsPanel } = await import('@/features/flows/components/FlowsPanel')
    render(<FlowsPanel />)
    expect(screen.getByText('Run History')).toBeInTheDocument()
  })
})
