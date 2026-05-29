import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, useLocation } from 'react-router-dom'

vi.mock('@/components/VaultPanel', () => ({
  VaultPanel: () => <div data-testid="vault-panel">Vault panel</div>,
}))

const { VaultWorkspacePanel } = await import('@/features/vault/components/VaultWorkspacePanel')

function LocationProbe() {
  const location = useLocation()
  return <div data-testid="location-probe">{`${location.pathname}${location.search}`}</div>
}

describe('VaultWorkspacePanel', () => {
  it('defaults to the Docs tab and shows suite navigation', () => {
    render(
      <MemoryRouter initialEntries={['/vault']}>
        <VaultWorkspacePanel />
      </MemoryRouter>,
    )

    expect(screen.getByRole('button', { name: /^docs$/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^forms$/i })).not.toBeInTheDocument()
    expect(screen.getByText('Forms create records. Vault keeps custody.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /open forms/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /open vault/i })).toBeInTheDocument()
  })

  it('switches to Vault from Docs', async () => {
    const user = userEvent.setup()

    render(
      <MemoryRouter initialEntries={['/vault']}>
        <VaultWorkspacePanel />
      </MemoryRouter>,
    )

    await user.click(screen.getByRole('button', { name: /^vault$/i }))
    expect(screen.getByTestId('vault-panel')).toBeInTheDocument()
  })

  it('honors the explicit vault tab route', () => {
    render(
      <MemoryRouter initialEntries={['/vault?tab=vault']}>
        <VaultWorkspacePanel />
      </MemoryRouter>,
    )

    expect(screen.getByTestId('vault-panel')).toBeInTheDocument()
  })

  it('redirects the legacy forms route to /formkey', () => {
    render(
      <MemoryRouter initialEntries={['/vault?tab=forms']}>
        <VaultWorkspacePanel />
        <LocationProbe />
      </MemoryRouter>,
    )

    expect(screen.getByTestId('location-probe')).toHaveTextContent('/formkey')
  })
})
