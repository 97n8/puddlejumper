import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { DownloadSimple, Star, Eye } from '@phosphor-icons/react'
import { MarketplaceTemplate } from '@/lib/types'
import { formatDistanceToNow } from 'date-fns'

interface TemplateCardProps {
  template: MarketplaceTemplate
  onClick: () => void
  onQuickDownload?: (e: React.MouseEvent) => void
  viewMode?: 'grid' | 'list'
}

const FORMAT_COLOR: Record<string, { accent: string; bgClass: string; textClass: string }> = {
  pdf:  { accent: '#dc2626', bgClass: 'bg-red-950/40',    textClass: 'text-red-400' },
  docx: { accent: '#2563eb', bgClass: 'bg-blue-950/40',   textClass: 'text-blue-400' },
  xlsx: { accent: '#16a34a', bgClass: 'bg-green-950/40',  textClass: 'text-green-400' },
  csv:  { accent: '#d97706', bgClass: 'bg-amber-950/40',  textClass: 'text-amber-400' },
  md:   { accent: '#7c3aed', bgClass: 'bg-violet-950/40', textClass: 'text-violet-400' },
  html: { accent: '#ea580c', bgClass: 'bg-orange-950/40', textClass: 'text-orange-400' },
  png:  { accent: '#db2777', bgClass: 'bg-pink-950/40',   textClass: 'text-pink-400' },
  svg:  { accent: '#0d9488', bgClass: 'bg-teal-950/40',   textClass: 'text-teal-400' },
}

const CATEGORY_CLASS: Record<string, string> = {
  business:  'bg-blue-900/40 text-blue-300',
  education: 'bg-green-900/40 text-green-300',
  personal:  'bg-violet-900/40 text-violet-300',
  code:      'bg-slate-800 text-slate-300',
  data:      'bg-amber-900/40 text-amber-300',
  creative:  'bg-pink-900/40 text-pink-300',
}

function formatCount(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`
  return String(n)
}

function StarRating({ rating }: { rating: number }) {
  const full = Math.round(rating)
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: 5 }, (_, i) => (
        <Star key={i} size={11} weight={i < full ? 'fill' : 'regular'} className={i < full ? 'text-amber-400' : 'text-zinc-600'} />
      ))}
      <span className="text-[10px] text-zinc-500 ml-1">{rating.toFixed(1)}</span>
    </div>
  )
}

export function TemplateCard({ template, onClick, onQuickDownload, viewMode = 'grid' }: TemplateCardProps) {
  const fmt = FORMAT_COLOR[template.format] ?? FORMAT_COLOR.md
  const catClass = CATEGORY_CLASS[template.category] ?? 'bg-zinc-800 text-zinc-300'

  if (viewMode === 'list') {
    return (
      <div
        onClick={onClick}
        className="flex items-center gap-3 px-4 py-3 border border-zinc-800 rounded-lg hover:border-zinc-600 hover:bg-zinc-900/50 cursor-pointer transition-all group"
      >
        {/* Format icon */}
        <div className={`w-9 h-10 rounded-md flex items-center justify-center flex-shrink-0 ${fmt.bgClass}`}>
          <span className={`text-[10px] font-bold uppercase ${fmt.textClass}`}>{template.format}</span>
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-sm text-zinc-200 truncate">{template.name}</span>
            <Badge className={`text-[10px] px-1.5 py-0 flex-shrink-0 ${catClass}`}>{template.category}</Badge>
          </div>
          <p className="text-xs text-zinc-500 truncate">{template.description}</p>
        </div>

        {/* Stats + actions */}
        <div className="flex items-center gap-3 flex-shrink-0 opacity-60 group-hover:opacity-100 transition-opacity">
          <StarRating rating={template.rating} />
          <span className="text-xs text-zinc-500">{formatCount(template.downloads)}</span>
          {onQuickDownload && (
            <button
              onClick={onQuickDownload}
              className="p-1 rounded hover:bg-zinc-700 transition-colors"
              title="Quick download"
            >
              <DownloadSimple size={14} className="text-zinc-400" />
            </button>
          )}
        </div>
      </div>
    )
  }

  // Grid mode
  return (
    <Card
      onClick={onClick}
      className="relative overflow-hidden border-zinc-800 bg-zinc-950 hover:border-zinc-600 cursor-pointer transition-all group flex flex-col p-0"
    >
      {/* Format top stripe */}
      <div
        className="h-[3px] w-full transition-opacity"
        style={{ backgroundColor: fmt.accent, opacity: 0.5 }}
      />
      <div
        className="absolute top-0 left-0 right-0 h-[3px] opacity-0 group-hover:opacity-100 transition-opacity"
        style={{ backgroundColor: fmt.accent }}
      />

      <div className="p-4 flex flex-col gap-3 flex-1">
        {/* Format badge + icon row */}
        <div className="flex items-start justify-between">
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${fmt.bgClass}`}>
            <span className={`text-[11px] font-bold uppercase ${fmt.textClass}`}>{template.format}</span>
          </div>
          <Badge className={`text-[10px] px-1.5 py-0 ${catClass}`}>{template.category}</Badge>
        </div>

        {/* Name + description */}
        <div>
          <h3 className="font-semibold text-sm text-zinc-100 line-clamp-1 group-hover:text-white transition-colors">
            {template.name}
          </h3>
          <p className="text-xs text-zinc-500 mt-0.5 line-clamp-2">{template.description}</p>
        </div>

        {/* Tags */}
        <div className="flex flex-wrap gap-1">
          {template.tags.slice(0, 2).map(tag => (
            <Badge key={tag} variant="outline" className="text-[10px] px-1.5 py-0 border-zinc-700 text-zinc-400">
              {tag}
            </Badge>
          ))}
          {template.tags.length > 2 && (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-zinc-700 text-zinc-500">
              +{template.tags.length - 2}
            </Badge>
          )}
        </div>

        {/* Footer */}
        <div className="mt-auto pt-2 border-t border-zinc-800 flex items-center justify-between">
          <StarRating rating={template.rating} />
          <div className="flex items-center gap-2 text-[10px] text-zinc-500">
            <DownloadSimple size={11} />
            {formatCount(template.downloads)}
          </div>
        </div>
        <div className="flex items-center justify-between text-[10px] text-zinc-600">
          <span>by {template.author}</span>
          <span>{formatDistanceToNow(template.updatedAt, { addSuffix: true })}</span>
        </div>
      </div>

      {/* Hover overlay */}
      <div className="absolute inset-0 flex flex-col justify-end opacity-0 group-hover:opacity-100 transition-all translate-y-2 group-hover:translate-y-0 pointer-events-none group-hover:pointer-events-auto">
        <div className="bg-gradient-to-t from-zinc-900/95 via-zinc-900/70 to-transparent p-4 pt-8 flex items-center gap-2">
          <Button size="sm" className="flex-1 gap-1.5 text-xs h-8 bg-zinc-100 text-zinc-900 hover:bg-zinc-200">
            <Eye size={13} />
            Preview
          </Button>
          {onQuickDownload && (
            <button
              onClick={onQuickDownload}
              className="h-8 w-8 flex items-center justify-center rounded-md border border-zinc-700 hover:bg-zinc-800 transition-colors"
              title="Quick download"
            >
              <DownloadSimple size={13} className="text-zinc-300" />
            </button>
          )}
        </div>
      </div>
    </Card>
  )
}
