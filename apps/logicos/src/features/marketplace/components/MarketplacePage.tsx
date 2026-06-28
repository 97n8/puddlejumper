import { useState, useCallback } from 'react'
import { toast } from 'sonner'
import type { MarketplaceTemplate } from '@/lib/types'
import { TemplateMarketplace } from './TemplateMarketplace'

const SEED_TEMPLATES: MarketplaceTemplate[] = []

interface Props {
  onBack?: () => void
}

export function MarketplacePage({ onBack: _onBack }: Props) {
  const [templates, setTemplates] = useState<MarketplaceTemplate[]>(SEED_TEMPLATES)

  const handleDownload = useCallback((template: MarketplaceTemplate) => {
    setTemplates(prev => prev.map(t => t.id === template.id ? { ...t, downloads: t.downloads + 1 } : t))
    toast.success(`Downloaded "${template.name}"`)
  }, [])

  const handlePublish = useCallback((draft: Omit<MarketplaceTemplate, 'id' | 'createdAt' | 'updatedAt' | 'downloads' | 'rating'>) => {
    const now = Date.now()
    const newTemplate: MarketplaceTemplate = {
      ...draft,
      id: `tpl-${now}`,
      createdAt: now,
      updatedAt: now,
      downloads: 0,
      rating: 0,
    }
    setTemplates(prev => [newTemplate, ...prev])
    toast.success(`Published "${newTemplate.name}"`)
  }, [])

  return (
    <TemplateMarketplace
      marketplaceTemplates={templates}
      onDownloadTemplate={handleDownload}
      onPublishTemplate={handlePublish}
    />
  )
}
