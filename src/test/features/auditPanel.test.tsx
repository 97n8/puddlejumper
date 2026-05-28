import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { AuditTrailPanel } from '@/features/audit/components/AuditTrailPanel'

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

vi.mock('@/services/pjApi', () => ({
  pjApi: {
    archieve: {
      events: vi.fn().mockResolvedValue({ events: [], total: 0 }),
      chain: vi.fn().mockResolvedValue(null),
      verify: vi.fn().mockResolvedValue(null),
      exportUrl: vi.fn().mockReturnValue('http://example.com/export'),
    },
  },
}))

describe('AuditTrailPanel smoke suite', () => {
  it('renders without crashing and shows ARCHIEVE heading', async () => {
    render(<AuditTrailPanel />)
    expect(screen.getByText(/ARCHIEVE.*Audit Trail/i)).toBeInTheDocument()
  })

  it('shows module filter with All modules option', async () => {
    render(<AuditTrailPanel />)
    expect(screen.getByText('All modules')).toBeInTheDocument()
  })

  it('shows severity filter with All severity option', async () => {
    render(<AuditTrailPanel />)
    expect(screen.getByText('All severity')).toBeInTheDocument()
  })

  it('shows Verify Chain and Export action buttons', async () => {
    render(<AuditTrailPanel />)
    expect(screen.getByRole('button', { name: /verify chain/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /export/i })).toBeInTheDocument()
  })

  it('shows empty state when no events returned', async () => {
    render(<AuditTrailPanel />)
    expect(await screen.findByText('No events found')).toBeInTheDocument()
  })
})
