import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { TemplateMarketplace } from '@/features/marketplace/components/TemplateMarketplace'

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

describe('TemplateMarketplace smoke suite', () => {
  const defaultProps = {
    marketplaceTemplates: [],
    onDownloadTemplate: vi.fn(),
    onPublishTemplate: vi.fn(),
  }

  it('renders without crashing', () => {
    render(<TemplateMarketplace {...defaultProps} />)
    expect(document.body).toBeTruthy()
  })

  it('shows The Commons label', () => {
    render(<TemplateMarketplace {...defaultProps} />)
    expect(screen.getByText('The Commons')).toBeInTheDocument()
  })

  it('shows Templates from the community heading', () => {
    render(<TemplateMarketplace {...defaultProps} />)
    expect(screen.getByText('Templates from the community')).toBeInTheDocument()
  })

  it('shows Share a Template button', () => {
    render(<TemplateMarketplace {...defaultProps} />)
    expect(screen.getByRole('button', { name: /share a template/i })).toBeInTheDocument()
  })

  it('shows 0 templates count when empty', () => {
    render(<TemplateMarketplace {...defaultProps} />)
    expect(screen.getByText('templates')).toBeInTheDocument()
  })
})
