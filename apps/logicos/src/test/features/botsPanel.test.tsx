import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

vi.mock('@github/spark/hooks', () => ({
  useKV: (_key: string, defaultVal: unknown) => [defaultVal, vi.fn()],
}))

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

const { BotsPanel } = await import('@/features/logicbuilder/components/BotsPanel')

describe('BotsPanel smoke suite', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('renders without crashing', () => {
    render(<BotsPanel />)
    expect(document.body).toBeTruthy()
  })

  it('shows "Logic Bots" heading', () => {
    render(<BotsPanel />)
    expect(screen.getByText('Logic Bots')).toBeInTheDocument()
  })

  it('"New Bot" button is present in welcome panel', () => {
    render(<BotsPanel />)
    expect(screen.getByRole('button', { name: /new bot/i })).toBeInTheDocument()
  })

  it('empty state shows when no bots exist', () => {
    render(<BotsPanel />)
    expect(screen.getByText(/no bots yet/i)).toBeInTheDocument()
  })

  it('bot type options (Compliance, Personal, Connector) visible when creating', async () => {
    const user = userEvent.setup()
    render(<BotsPanel />)
    await user.click(screen.getByRole('button', { name: /new bot/i }))
    // BotWizard step 1 shows type selector — all bot types should be visible
    expect(screen.getByText('Compliance')).toBeInTheDocument()
    expect(screen.getByText('Personal')).toBeInTheDocument()
    expect(screen.getByText('Connector')).toBeInTheDocument()
  })

  it('"New" sidebar button also opens wizard', async () => {
    const user = userEvent.setup()
    render(<BotsPanel />)
    // The sidebar has a "New" button with Plus icon
    const newBtns = screen.getAllByRole('button', { name: /new/i })
    await user.click(newBtns[0])
    // Bot wizard step 1 heading should appear
    expect(screen.getByText('Bot Identity')).toBeInTheDocument()
  })
})
