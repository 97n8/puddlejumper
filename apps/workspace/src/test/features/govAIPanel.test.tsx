import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { GovAIPanel } from '@/features/govai/components/GovAIPanel'

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

vi.mock('@/features/govai/api', () => ({
  useAIHistory: () => ({ data: [], isLoading: false, refetch: vi.fn() }),
  useAIUsage: () => ({ data: null, isLoading: false, refetch: vi.fn() }),
  useSubmitAIQuery: () => ({ mutateAsync: vi.fn().mockResolvedValue({ response: 'AI response text' }), isPending: false }),
}))

describe('GovAIPanel smoke suite', () => {
  it('renders AI Assistant heading', () => {
    render(<GovAIPanel onBack={vi.fn()} />)
    expect(screen.getByText('AI Assistant')).toBeInTheDocument()
  })

  it('shows model selector with GPT-4o selected by default', () => {
    render(<GovAIPanel onBack={vi.fn()} />)
    const select = screen.getByRole('combobox', { name: /model/i })
    expect(select).toBeInTheDocument()
    expect((select as HTMLSelectElement).value).toBe('gpt-4o')
  })

  it('shows prompt textarea and Submit button', () => {
    render(<GovAIPanel onBack={vi.fn()} />)
    expect(screen.getByRole('textbox', { name: /your question/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /submit/i })).toBeInTheDocument()
  })

  it('History tab shows empty state when no history', async () => {
    const user = userEvent.setup()
    render(<GovAIPanel onBack={vi.fn()} />)
    await user.click(screen.getByRole('tab', { name: /history/i }))
    const panel = screen.getByRole('tabpanel')
    expect(panel).toHaveTextContent(/No queries yet/i)
  })

  it('Usage tab shows no-data message when usage is null', async () => {
    const user = userEvent.setup()
    render(<GovAIPanel onBack={vi.fn()} />)
    await user.click(screen.getByRole('tab', { name: /usage/i }))
    const panel = screen.getByRole('tabpanel')
    expect(panel).toHaveTextContent(/Usage data will appear/i)
  })

  it('shows accountability warning banner in console tab', () => {
    render(<GovAIPanel onBack={vi.fn()} />)
    expect(screen.getByText(/Every query you submit is logged/i)).toBeInTheDocument()
  })
})
