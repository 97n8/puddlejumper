import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

vi.mock('@github/spark/hooks', () => ({
  useKV: (_key: string, defaultVal: unknown) => [defaultVal, vi.fn()],
}))

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

const { AppsPanel } = await import('@/features/logicbuilder/components/AppsPanel')

describe('AppsPanel smoke suite', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('renders without crashing with no apps', () => {
    render(<AppsPanel onOpenTool={vi.fn()} />)
    expect(document.body).toBeTruthy()
  })

  it('shows "Personal Apps" heading', () => {
    render(<AppsPanel onOpenTool={vi.fn()} />)
    expect(screen.getByText('Personal Apps')).toBeInTheDocument()
  })

  it('"New" button is present in sidebar', () => {
    render(<AppsPanel onOpenTool={vi.fn()} />)
    expect(screen.getAllByRole('button', { name: /new/i }).length).toBeGreaterThan(0)
  })

  it('empty state shows when no apps exist', () => {
    render(<AppsPanel onOpenTool={vi.fn()} />)
    expect(screen.getByText(/no apps yet/i)).toBeInTheDocument()
  })

  it('service catalog shows Workspace services (Vault Forms, VAULT, Automations)', async () => {
    const user = userEvent.setup()
    render(<AppsPanel onOpenTool={vi.fn()} />)
    // Click the "New" button in the sidebar (first one)
    const newBtns = screen.getAllByRole('button', { name: /new/i })
    await user.click(newBtns[0])
    // Enter app name so we can proceed to service selection
    const nameInput = screen.getByPlaceholderText(/my awesome app/i)
    await user.type(nameInput, 'Test App')
    await user.click(screen.getByRole('button', { name: /next/i }))
    // Step 2: service catalog
    expect(screen.getByText('Vault Forms')).toBeInTheDocument()
    expect(screen.getByText('VAULT')).toBeInTheDocument()
    expect(screen.getByText('Automations')).toBeInTheDocument()
  })

  it('create-your-first-app link is present in empty state', () => {
    render(<AppsPanel onOpenTool={vi.fn()} />)
    expect(screen.getByText(/create your first app/i)).toBeInTheDocument()
  })
})
