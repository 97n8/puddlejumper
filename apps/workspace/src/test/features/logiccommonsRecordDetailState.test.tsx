import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockUseIntakeRecord = vi.fn()

vi.mock('@/features/logiccommons/hooks/useIntakeRecord', () => ({
  useIntakeRecord: (...args: unknown[]) => mockUseIntakeRecord(...args),
}))

vi.mock('@/features/logiccommons/hooks/useModuleInstance', () => ({
  useModuleInstance: () => ({ data: null, isLoading: false }),
}))

vi.mock('@/features/logiccommons/hooks/useOutputs', () => ({
  useOutputs: () => ({ data: [] }),
}))

vi.mock('@/features/logiccommons/hooks/usePlacements', () => ({
  usePlacements: () => ({ data: [] }),
}))

vi.mock('@/features/logiccommons/hooks/useWorkflow', () => ({
  useWorkflow: () => ({ advance: vi.fn(), isLoading: false }),
}))

vi.mock('@/features/logiccommons/components/PipelineStageTracker', () => ({
  PipelineStageTracker: () => <div>Pipeline</div>,
}))

vi.mock('@/features/logiccommons/components/WorkflowStageRow', () => ({
  WorkflowStageRow: () => <div>Workflow Row</div>,
}))

vi.mock('@/features/logiccommons/components/OutputBundleCard', () => ({
  OutputBundleCard: () => <div>Output Bundle</div>,
}))

import { ModuleDetail } from '@/features/logiccommons/components/ModuleDetail'
import { PRRDetail } from '@/features/logiccommons/domains/PublicRecords/PRRDetail'

describe('logiccommons record detail states', () => {
  beforeEach(() => {
    mockUseIntakeRecord.mockReset()
  })

  it('renders Record not found only for not_found', () => {
    mockUseIntakeRecord.mockReturnValue({ status: 'not_found', retry: vi.fn() })
    const { rerender } = render(<ModuleDetail recordId="rec-1" displayName="Records" onBack={vi.fn()} />)
    expect(screen.getByText('Record not found')).toBeInTheDocument()

    mockUseIntakeRecord.mockReturnValue({ status: 'unauthenticated', message: 'Authentication required', retry: vi.fn() })
    rerender(<ModuleDetail recordId="rec-1" displayName="Records" onBack={vi.fn()} />)
    expect(screen.queryByText('Record not found')).not.toBeInTheDocument()
    expect(screen.getAllByText(/^Authentication required$/).length).toBeGreaterThan(0)

    mockUseIntakeRecord.mockReturnValue({ status: 'not_found', retry: vi.fn() })
    rerender(<PRRDetail recordId="rec-2" />)
    expect(screen.getByText('Record not found.')).toBeInTheDocument()

    mockUseIntakeRecord.mockReturnValue({ status: 'unauthorized', message: 'Forbidden', retry: vi.fn() })
    rerender(<PRRDetail recordId="rec-2" />)
    expect(screen.queryByText('Record not found.')).not.toBeInTheDocument()
    expect(screen.getByText(/Access denied/i)).toBeInTheDocument()
  })

  it('renders load_error instead of not_found for server failures', () => {
    mockUseIntakeRecord.mockReturnValue({ status: 'load_error', message: 'Server failed', retry: vi.fn() })
    const { rerender } = render(<ModuleDetail recordId="rec-3" displayName="Records" onBack={vi.fn()} />)
    expect(screen.getByText("Couldn't load record")).toBeInTheDocument()
    expect(screen.queryByText('Record not found')).not.toBeInTheDocument()

    rerender(<PRRDetail recordId="rec-3" />)
    expect(screen.getByText(/Couldn't load record/i)).toBeInTheDocument()
    expect(screen.queryByText('Record not found.')).not.toBeInTheDocument()
  })

  it('renders successful detail views when record is ok', () => {
    const record = {
      id: 'rec-ok',
      status: 'open',
      pipeline_stage: 'intake',
      created_at: new Date().toISOString(),
      intake_channel: 'portal',
      requester_name: 'Jane Doe',
      department_id: 'Clerk',
      request_description: 'Need a copy',
    }

    mockUseIntakeRecord.mockReturnValue({ status: 'ok', record, retry: vi.fn() })
    const { rerender } = render(<ModuleDetail recordId="rec-ok" displayName="Records" onBack={vi.fn()} />)
    expect(screen.getByText('Record Details')).toBeInTheDocument()

    rerender(<PRRDetail recordId="rec-ok" />)
    expect(screen.getByText('Request description')).toBeInTheDocument()
  })
})
