import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { DownloadSimple, Star, User, CalendarBlank, Tag, Eye, Code, Hash } from '@phosphor-icons/react'
import { MarketplaceTemplate } from '@/lib/types'
import { format } from 'date-fns'

interface TemplateDetailDialogProps {
  template: MarketplaceTemplate | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onDownload: (template: MarketplaceTemplate) => void
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

const CATEGORY_LABELS: Record<string, string> = {
  business: 'Business', education: 'Education', personal: 'Personal',
  code: 'Code', data: 'Data', creative: 'Creative',
}

function TemplatePreview({ template }: { template: MarketplaceTemplate }) {
  if (template.format === 'html') {
    return (
      <div className="border border-border rounded-lg overflow-hidden">
        <iframe srcDoc={template.content} title="Preview" className="w-full h-96 bg-white" sandbox="allow-same-origin" />
      </div>
    )
  }
  if (template.format === 'md') {
    const lines = template.content.split('\n')
    let html = '<div style="font-family: Georgia, serif; line-height: 1.7; padding: 1.5rem; color: #1a1a1a;">'
    lines.forEach(line => {
      if (line.startsWith('# ')) html += `<h1 style="font-size: 2em; font-weight: bold; margin: 0.5em 0;">${line.slice(2)}</h1>`
      else if (line.startsWith('## ')) html += `<h2 style="font-size: 1.5em; font-weight: bold; margin: 0.5em 0;">${line.slice(3)}</h2>`
      else if (line.startsWith('### ')) html += `<h3 style="font-size: 1.2em; font-weight: bold; margin: 0.5em 0;">${line.slice(4)}</h3>`
      else if (line.trim() === '') html += '<br/>'
      else html += `<p style="margin: 0.4em 0;">${line}</p>`
    })
    html += '</div>'
    return (
      <div className="border border-border rounded-lg overflow-hidden">
        <iframe srcDoc={html} title="Preview" className="w-full h-96 bg-white" sandbox="allow-same-origin" />
      </div>
    )
  }
  if (template.format === 'xlsx' || template.format === 'csv') {
    const lines = template.content.split('\n').slice(0, 10)
    const rows = lines.map(line => line.split(/[\t,]/).slice(0, 6))
    return (
      <div className="border border-border rounded-lg overflow-auto">
        <table className="w-full text-sm">
          <tbody>
            {rows.map((row, idx) => (
              <tr key={idx} className={idx === 0 ? 'bg-muted font-medium' : ''}>
                {row.map((cell, cellIdx) => (
                  <td key={cellIdx} className="border border-border px-3 py-2">
                    {cell || <span className="text-muted-foreground">—</span>}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }
  return (
    <pre className="bg-muted rounded-lg p-4 text-xs whitespace-pre-wrap break-words max-h-96 overflow-auto font-mono">
      {template.content.slice(0, 2000)}{template.content.length > 2000 && '\n\n... (truncated)'}
    </pre>
  )
}

export function TemplateDetailDialog({ template, open, onOpenChange, onDownload }: TemplateDetailDialogProps) {
  const [tab, setTab] = useState('preview')
  if (!template) return null

  const fmt = FORMAT_COLOR[template.format] ?? FORMAT_COLOR.md
  const fullRating = Math.round(template.rating)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-0 overflow-hidden">
        {/* Format-colored top border */}
        <div className="h-[3px] w-full flex-shrink-0" style={{ backgroundColor: fmt.accent }} />

        {/* Header */}
        <div className="px-6 pt-5 pb-4 border-b border-border flex-shrink-0">
          <div className="flex items-start gap-4">
            <div className={`w-14 h-14 rounded-xl flex items-center justify-center flex-shrink-0 ${fmt.bgClass}`}>
              <span className={`text-xs font-bold uppercase ${fmt.textClass}`}>{template.format}</span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <h2 className="text-xl font-semibold">{template.name}</h2>
                <Badge className={fmt.bgClass + ' ' + fmt.textClass}>{template.format.toUpperCase()}</Badge>
                <Badge variant="outline">{CATEGORY_LABELS[template.category] ?? template.category}</Badge>
              </div>
              <p className="text-sm text-muted-foreground">{template.description}</p>
            </div>
          </div>

          {/* Stats row */}
          <div className="flex items-center gap-6 mt-4 text-sm text-muted-foreground flex-wrap">
            <div className="flex items-center gap-1.5">
              <User size={14} />
              <span>{template.author}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <DownloadSimple size={14} />
              <span>{template.downloads.toLocaleString()} downloads</span>
            </div>
            <div className="flex items-center gap-1.5">
              <CalendarBlank size={14} />
              <span>Updated {format(template.updatedAt, 'MMM d, yyyy')}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Tag size={14} />
              <span>{template.tags.length} tags</span>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={tab} onValueChange={setTab} className="flex flex-col flex-1 overflow-hidden">
          <TabsList className="rounded-none border-b border-border bg-transparent h-auto px-6 py-0 flex-shrink-0 justify-start gap-1">
            <TabsTrigger value="preview" className="gap-2 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent pb-2 pt-2">
              <Eye size={15} />Preview
            </TabsTrigger>
            <TabsTrigger value="details" className="gap-2 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent pb-2 pt-2">
              <Tag size={15} />Details
            </TabsTrigger>
            <TabsTrigger value="source" className="gap-2 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent pb-2 pt-2">
              <Code size={15} />Source
            </TabsTrigger>
          </TabsList>

          <TabsContent value="preview" className="flex-1 min-h-0 overflow-auto p-6 mt-0">
            <TemplatePreview template={template} />
          </TabsContent>

          <TabsContent value="details" className="flex-1 min-h-0 overflow-auto p-6 mt-0 space-y-6">
            {/* Star rating */}
            <div className="flex items-center gap-2">
              {Array.from({ length: 5 }, (_, i) => (
                <Star key={i} size={20} weight={i < fullRating ? 'fill' : 'regular'} className={i < fullRating ? 'text-amber-400' : 'text-zinc-600'} />
              ))}
              <span className="text-xl font-semibold">{template.rating.toFixed(1)}</span>
              <span className="text-sm text-muted-foreground">/ 5.0</span>
            </div>

            {/* Tag pills */}
            <div>
              <h4 className="text-sm font-medium mb-2">Tags</h4>
              <div className="flex flex-wrap gap-2">
                {template.tags.map(tag => (
                  <Badge key={tag} variant="secondary" className="gap-1">
                    <Hash size={10} />{tag}
                  </Badge>
                ))}
              </div>
            </div>

            {/* Metadata grid */}
            <div className="grid grid-cols-2 gap-4 text-sm">
              {[
                { label: 'Author', value: template.author },
                { label: 'Category', value: CATEGORY_LABELS[template.category] ?? template.category },
                { label: 'Format', value: template.format.toUpperCase() },
                { label: 'Downloads', value: template.downloads.toLocaleString() },
                { label: 'Created', value: format(template.createdAt, 'MMM d, yyyy') },
                { label: 'Updated', value: format(template.updatedAt, 'MMM d, yyyy') },
              ].map(item => (
                <div key={item.label}>
                  <div className="text-xs text-muted-foreground">{item.label}</div>
                  <div className="font-medium">{item.value}</div>
                </div>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="source" className="flex-1 overflow-hidden p-0 mt-0 flex flex-col">
            <div className="sticky top-0 z-10 px-6 py-2 border-b border-border bg-muted/30 text-xs text-muted-foreground flex-shrink-0">
              {template.content.length} characters · {template.content.split('\n').length} lines
            </div>
            <div className="flex-1 min-h-0 overflow-auto p-6">
              <pre className="font-mono text-xs whitespace-pre-wrap break-words">{template.content}</pre>
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter className="px-6 py-3 border-t border-border flex-shrink-0">
          <div className="flex items-center gap-2 flex-1 flex-wrap">
            {template.tags.slice(0, 4).map(tag => (
              <Badge key={tag} variant="outline" className="text-xs">#{tag}</Badge>
            ))}
          </div>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
          <Button onClick={() => onDownload(template)} className="gap-2">
            <DownloadSimple size={16} />
            Download Template
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
