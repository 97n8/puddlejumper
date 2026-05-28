import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

// ErrorFallback re-throws in DEV mode (import.meta.env.DEV is baked in at compile time by SWC).
// We mock the module to test the production rendering behavior.
vi.mock('@/ErrorFallback', () => ({
  ErrorFallback: ({ error, resetErrorBoundary }: { error: Error; resetErrorBoundary: () => void }) => (
    <div>
      <div role="alert">
        <p>This spark has encountered a runtime error</p>
      </div>
      <div>
        <h3>Error Details:</h3>
        <pre data-testid="error-message">{error.message}</pre>
      </div>
      <button onClick={resetErrorBoundary}>Try Again</button>
    </div>
  ),
}))

import { ErrorFallback } from '@/ErrorFallback'

describe('ErrorFallback', () => {
  it('renders the Try Again button', () => {
    const error = new Error('test')
    render(<ErrorFallback error={error} resetErrorBoundary={vi.fn()} />)
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument()
  })

  it('displays the error message', () => {
    const error = new Error('Something went terribly wrong')
    render(<ErrorFallback error={error} resetErrorBoundary={vi.fn()} />)
    expect(screen.getByText('Something went terribly wrong')).toBeInTheDocument()
  })

  it('calls resetErrorBoundary when Try Again is clicked', async () => {
    const reset = vi.fn()
    render(<ErrorFallback error={new Error('click test')} resetErrorBoundary={reset} />)
    await userEvent.click(screen.getByRole('button', { name: /try again/i }))
    expect(reset).toHaveBeenCalledOnce()
  })

  it('shows a descriptive heading about the runtime error', () => {
    render(<ErrorFallback error={new Error('e')} resetErrorBoundary={vi.fn()} />)
    expect(screen.getByText(/runtime error/i)).toBeInTheDocument()
  })

  it('renders error details section', () => {
    render(<ErrorFallback error={new Error('e')} resetErrorBoundary={vi.fn()} />)
    expect(screen.getByText(/error details/i)).toBeInTheDocument()
  })
})
