import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MobileNav } from '@/components/MobileNav'

let mobileMode = false

vi.mock('@/hooks/useMobileMode', () => ({
  useMobileMode: () => ({ isMobile: mobileMode, viewOverride: mobileMode ? 'mobile' : 'desktop', setViewOverride: vi.fn() }),
}))

describe('govtech smoke suite', () => {
  beforeEach(() => {
    mobileMode = false
  })

  describe('Mobile shell close-out behavior', () => {
    it('only shows allowed tools and closes cleanly after tool selection', async () => {
      const user = userEvent.setup()
      const onSelectTool = vi.fn()

      render(
        <MobileNav
          activeTool={null}
          onSelectTool={onSelectTool}
          onHome={vi.fn()}
          viewOverride="auto"
          onSetViewOverride={vi.fn()}
          canUseTool={(key) => key !== 'settings'}
        />
      )

      // Click "More" tab — shows inline tools list (no sheet)
      await user.click(screen.getByRole('button', { name: 'More' }))

      expect(screen.getByRole('heading', { name: 'Tools' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /vault/i })).toBeInTheDocument()
      // settings is filtered out via canUseTool
      expect(screen.queryByRole('button', { name: /^settings$/i })).not.toBeInTheDocument()

      await user.click(screen.getByRole('button', { name: /vault/i }))

      await waitFor(() => {
        expect(onSelectTool).toHaveBeenCalledWith('vault')
      })
      // Tools list dismissed after selection
      await waitFor(() => {
        expect(screen.queryByRole('heading', { name: 'Tools' })).not.toBeInTheDocument()
      })
    })

    it('switches to desktop mode from the tools list', async () => {
      const user = userEvent.setup()
      const onSetViewOverride = vi.fn()

      render(
        <MobileNav
          activeTool={null}
          onSelectTool={vi.fn()}
          onHome={vi.fn()}
          viewOverride="auto"
          onSetViewOverride={onSetViewOverride}
          canUseTool={() => true}
        />
      )

      await user.click(screen.getByRole('button', { name: 'More' }))
      await user.click(screen.getByRole('button', { name: /open on desktop/i }))

      expect(onSetViewOverride).toHaveBeenCalledWith('desktop')
      await waitFor(() => {
        expect(screen.queryByRole('heading', { name: 'Tools' })).not.toBeInTheDocument()
      })
    })
  })
})
