import { useState, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { MagnifyingGlass, UploadSimple, SquaresFour, Rows, X } from '@phosphor-icons/react'
import { MarketplaceTemplate, TemplateCategory, DocumentFormat } from '@/lib/types'
import { TemplateCard } from './TemplateCard'
import { TemplateDetailDialog } from './TemplateDetailDialog'
import { PublishTemplateDialog } from './PublishTemplateDialog'

type SortOption = 'downloads' | 'rating' | 'updated'

interface TemplateMarketplaceProps {
  marketplaceTemplates: MarketplaceTemplate[]
  onDownloadTemplate: (template: MarketplaceTemplate) => void
  onPublishTemplate: (template: Omit<MarketplaceTemplate, 'id' | 'createdAt' | 'updatedAt' | 'downloads' | 'rating'>) => void
}

const CATEGORIES: { value: TemplateCategory | 'all'; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'business', label: 'Business' },
  { value: 'education', label: 'Education' },
  { value: 'personal', label: 'Personal' },
  { value: 'code', label: 'Code' },
  { value: 'data', label: 'Data' },
  { value: 'creative', label: 'Creative' },
]

const ALL_FORMATS: DocumentFormat[] = ['pdf', 'docx', 'xlsx', 'csv', 'md', 'html', 'png', 'svg']

const FORMAT_ACCENT: Record<string, string> = {
  pdf:  '#dc2626',
  docx: '#2563eb',
  xlsx: '#16a34a',
  csv:  '#d97706',
  md:   '#7c3aed',
  html: '#ea580c',
  png:  '#db2777',
  svg:  '#0d9488',
}

const CATEGORY_STYLE: Record<string, string> = {
  all:       'bg-amber-900/20 text-amber-300 border-amber-800/30',
  business:  'bg-amber-900/30 text-amber-200 border-amber-800/40',
  education: 'bg-green-900/30 text-green-300 border-green-800/40',
  personal:  'bg-orange-900/30 text-orange-300 border-orange-800/40',
  code:      'bg-slate-800 text-slate-300 border-slate-700',
  data:      'bg-yellow-900/30 text-yellow-300 border-yellow-800/40',
  creative:  'bg-rose-900/30 text-rose-300 border-rose-800/40',
}



function formatCount(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`
  return String(n)
}

export function TemplateMarketplace({
  marketplaceTemplates,
  onDownloadTemplate,
  onPublishTemplate,
}: TemplateMarketplaceProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<TemplateCategory | 'all'>('all')
  const [selectedFormats, setSelectedFormats] = useState<Set<DocumentFormat>>(new Set())
  const [activeTags, setActiveTags] = useState<string[]>([])
  const [sortBy, setSortBy] = useState<SortOption>('downloads')
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [selectedTemplate, setSelectedTemplate] = useState<MarketplaceTemplate | null>(null)
  const [publishDialogOpen, setPublishDialogOpen] = useState(false)

  // Stats
  const totalDownloads = useMemo(() => marketplaceTemplates.reduce((s, t) => s + t.downloads, 0), [marketplaceTemplates])
  const uniqueAuthors = useMemo(() => new Set(marketplaceTemplates.map(t => t.authorId)).size, [marketplaceTemplates])

  // Tag frequency
  const tagFreq = useMemo(() => {
    const freq: Record<string, number> = {}
    marketplaceTemplates.forEach(t => t.tags.forEach(tag => { freq[tag] = (freq[tag] ?? 0) + 1 }))
    return Object.entries(freq).sort((a, b) => b[1] - a[1])
  }, [marketplaceTemplates])

  const toggleFormat = (f: DocumentFormat) => {
    setSelectedFormats(prev => {
      const next = new Set(prev)
      if (next.has(f)) { next.delete(f) } else { next.add(f) }
      return next
    })
  }

  const toggleTag = (tag: string) => {
    setActiveTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag])
  }

  const clearAll = () => {
    setSearchQuery('')
    setSelectedCategory('all')
    setSelectedFormats(new Set())
    setActiveTags([])
  }

  const hasFilters = searchQuery || selectedCategory !== 'all' || selectedFormats.size > 0 || activeTags.length > 0

  const filteredTemplates = useMemo(() => {
    let list = marketplaceTemplates.filter(t => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase()
        if (!t.name.toLowerCase().includes(q) && !t.description.toLowerCase().includes(q) && !t.tags.some(tag => tag.toLowerCase().includes(q))) return false
      }
      if (selectedCategory !== 'all' && t.category !== selectedCategory) return false
      if (selectedFormats.size > 0 && !selectedFormats.has(t.format)) return false
      if (activeTags.length > 0 && !activeTags.every(tag => t.tags.includes(tag))) return false
      return true
    })

    list = [...list].sort((a, b) => {
      if (sortBy === 'downloads') return b.downloads - a.downloads
      if (sortBy === 'rating') return b.rating - a.rating
      if (sortBy === 'updated') return b.updatedAt - a.updatedAt
      if (sortBy === 'name') return a.name.localeCompare(b.name)
      return 0
    })
    return list
  }, [marketplaceTemplates, searchQuery, selectedCategory, selectedFormats, activeTags, sortBy])

  const handleDownload = (template: MarketplaceTemplate) => {
    onDownloadTemplate(template)
    setSelectedTemplate(null)
  }

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Hero Section */}
      <div className="relative px-8 py-10 border-b overflow-hidden flex-shrink-0" style={{
        background: 'linear-gradient(135deg, oklch(0.18 0.03 80) 0%, oklch(0.14 0.02 155) 100%)'
      }}>
        <div className="absolute inset-0 opacity-[0.03]" style={{
          backgroundImage: 'radial-gradient(circle, oklch(0.9 0.1 80) 1px, transparent 1px)',
          backgroundSize: '24px 24px'
        }} />
        <div className="relative flex items-end justify-between">
          <div className="max-w-xl">
            <p className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: 'oklch(0.65 0.12 80)' }}>
              The Commons
            </p>
            <h2 className="text-3xl font-bold text-foreground mb-2">
              Templates from the community
            </h2>
            <p className="text-muted-foreground text-sm leading-relaxed">
              Practical documents, code starters, and workflows — made by people who needed them, shared for anyone who does.
            </p>
          </div>
          <div className="flex items-center gap-6 shrink-0 ml-8">
            <div className="text-right">
              <div className="text-2xl font-semibold">{marketplaceTemplates.length}</div>
              <div className="text-xs text-muted-foreground">templates</div>
            </div>
            <div className="text-right">
              <div className="text-2xl font-semibold">{formatCount(totalDownloads)}</div>
              <div className="text-xs text-muted-foreground">downloads</div>
            </div>
            <div className="text-right">
              <div className="text-2xl font-semibold">{uniqueAuthors}</div>
              <div className="text-xs text-muted-foreground">contributors</div>
            </div>
            <Button onClick={() => setPublishDialogOpen(true)} className="gap-2">
              <UploadSimple size={18} />
              Share a Template
            </Button>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="border-b border-border bg-card px-6 py-4 flex-shrink-0">
        {/* Search + controls */}
        <div className="flex gap-3 mb-4">
          <div className="relative flex-1">
            <MagnifyingGlass size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search templates..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortOption)}>
            <SelectTrigger className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="downloads">Most Downloaded</SelectItem>
              <SelectItem value="rating">Highest Rated</SelectItem>
              <SelectItem value="updated">Recently Updated</SelectItem>
              <SelectItem value="name">Name A-Z</SelectItem>
            </SelectContent>
          </Select>
          <div className="flex rounded-md overflow-hidden border border-border">
            <button
              onClick={() => setViewMode('grid')}
              className={`px-2.5 py-2 transition-colors ${viewMode === 'grid' ? 'bg-muted' : 'hover:bg-muted/50'}`}
              title="Grid view"
            >
              <SquaresFour size={18} />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`px-2.5 py-2 transition-colors ${viewMode === 'list' ? 'bg-muted' : 'hover:bg-muted/50'}`}
              title="List view"
            >
              <Rows size={18} />
            </button>
          </div>
        </div>

        {/* Category pills */}
        <div className="flex flex-wrap gap-2 mb-3">
          {CATEGORIES.map(cat => (
            <button
              key={cat.value}
              onClick={() => setSelectedCategory(cat.value)}
              className={`text-xs px-3 py-1 rounded-full border transition-colors ${
                selectedCategory === cat.value
                  ? (CATEGORY_STYLE[cat.value] ?? 'bg-amber-900/20 text-amber-300 border-amber-800/30')
                  : 'border-border text-muted-foreground hover:border-foreground hover:text-foreground'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Format toggles */}
        <div className="flex flex-wrap gap-1.5">
          {ALL_FORMATS.map(fmt => (
            <button
              key={fmt}
              onClick={() => toggleFormat(fmt)}
              className="text-xs px-2.5 py-1 rounded border border-border transition-colors"
              style={selectedFormats.has(fmt) ? { backgroundColor: FORMAT_ACCENT[fmt] + '33', borderColor: FORMAT_ACCENT[fmt], color: FORMAT_ACCENT[fmt] } : {}}
            >
              {fmt.toUpperCase()}
            </button>
          ))}
        </div>

        {/* Active tag chips */}
        {activeTags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2">
            {activeTags.map(tag => (
              <Badge key={tag} variant="secondary" className="gap-1 pr-1">
                {tag}
                <button onClick={() => toggleTag(tag)} className="hover:bg-muted rounded-full p-0.5">
                  <X size={10} />
                </button>
              </Badge>
            ))}
          </div>
        )}

        {hasFilters && (
          <button onClick={clearAll} className="mt-2 text-xs text-muted-foreground hover:text-foreground transition-colors">
            Clear all filters
          </button>
        )}
      </div>

      {/* Body: sidebar + grid */}
      <div className="flex flex-1 min-h-0">
        {/* Tag sidebar */}
        <div className="w-44 flex-shrink-0 border-r border-border overflow-y-auto p-3">
          <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">Tags</p>
          <div className="flex flex-col gap-0.5">
            {tagFreq.map(([tag, count]) => (
              <button
                key={tag}
                onClick={() => toggleTag(tag)}
                className={`flex items-center justify-between text-xs px-2 py-1 rounded transition-colors text-left ${
                  activeTags.includes(tag) ? 'bg-primary/20 text-primary' : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                }`}
              >
                <span className="truncate">{tag}</span>
                <span className="text-[10px] opacity-60 ml-1 flex-shrink-0">{count}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Main content */}
        <div className="flex-1 min-h-0 overflow-auto p-4">
          {marketplaceTemplates.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-center">
              <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                <UploadSimple size={32} className="text-muted-foreground" />
              </div>
              <p className="text-lg font-medium mb-1">Nothing here yet</p>
              <p className="text-sm text-muted-foreground">Be the first to share something useful with your neighbors.</p>
            </div>
          ) : filteredTemplates.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-center">
              <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                <MagnifyingGlass size={32} className="text-muted-foreground" />
              </div>
              <p className="text-lg font-medium mb-1">No results</p>
              <p className="text-sm text-muted-foreground">Try adjusting your search or filters</p>
            </div>
          ) : viewMode === 'grid' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredTemplates.map((template) => (
                <TemplateCard
                  key={template.id}
                  template={template}
                  onClick={() => setSelectedTemplate(template)}
                  onQuickDownload={(e) => { e.stopPropagation(); onDownloadTemplate(template) }}
                  viewMode="grid"
                />
              ))}
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {filteredTemplates.map((template) => (
                <TemplateCard
                  key={template.id}
                  template={template}
                  onClick={() => setSelectedTemplate(template)}
                  onQuickDownload={(e) => { e.stopPropagation(); onDownloadTemplate(template) }}
                  viewMode="list"
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="border-t border-border px-6 py-3 bg-card flex-shrink-0">
        <div className="text-sm text-muted-foreground">
        Showing {filteredTemplates.length} of {marketplaceTemplates.length} templates from {uniqueAuthors} {uniqueAuthors === 1 ? 'contributor' : 'contributors'}
        </div>
      </div>

      <TemplateDetailDialog
        template={selectedTemplate}
        open={selectedTemplate !== null}
        onOpenChange={(open) => !open && setSelectedTemplate(null)}
        onDownload={handleDownload}
      />

      <PublishTemplateDialog
        open={publishDialogOpen}
        onOpenChange={setPublishDialogOpen}
        onPublish={onPublishTemplate}
      />
    </div>
  )
}
