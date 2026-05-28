import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { X, CheckCircle } from '@phosphor-icons/react'
import { MarketplaceTemplate, DocumentFormat, TemplateCategory } from '@/lib/types'
import { toast } from 'sonner'
import { TemplateCard } from './TemplateCard'

interface PublishTemplateDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onPublish: (template: Omit<MarketplaceTemplate, 'id' | 'createdAt' | 'updatedAt' | 'downloads' | 'rating'>) => void
}

const CATEGORIES: { value: TemplateCategory; label: string }[] = [
  { value: 'business', label: 'Business' },
  { value: 'education', label: 'Education' },
  { value: 'personal', label: 'Personal' },
  { value: 'code', label: 'Code' },
  { value: 'data', label: 'Data' },
  { value: 'creative', label: 'Creative' },
]

const FORMAT_COLOR: Record<string, string> = {
  pdf:  '#dc2626', docx: '#2563eb', xlsx: '#16a34a',
  csv:  '#d97706', md:   '#7c3aed', html: '#ea580c',
  png:  '#db2777', svg:  '#0d9488',
}

const FORMATS: { value: DocumentFormat; label: string }[] = [
  { value: 'docx', label: 'Word Document (.docx)' },
  { value: 'pdf',  label: 'PDF Document (.pdf)' },
  { value: 'xlsx', label: 'Excel Spreadsheet (.xlsx)' },
  { value: 'csv',  label: 'CSV File (.csv)' },
  { value: 'md',   label: 'Markdown (.md)' },
  { value: 'html', label: 'HTML (.html)' },
  { value: 'png',  label: 'PNG Image (.png)' },
  { value: 'svg',  label: 'SVG Image (.svg)' },
]

export function PublishTemplateDialog({ open, onOpenChange, onPublish }: PublishTemplateDialogProps) {
  const [name, setName] = useState('')
  const [author, setAuthor] = useState('')
  const [description, setDescription] = useState('')
  const [format, setFormat] = useState<DocumentFormat>('md')
  const [category, setCategory] = useState<TemplateCategory>('business')
  const [tagInput, setTagInput] = useState('')
  const [tags, setTags] = useState<string[]>([])
  const [content, setContent] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})

  const checklist = [
    { key: 'name',    label: 'Template name',     pass: name.trim().length > 0 },
    { key: 'desc',    label: 'Description',        pass: description.trim().length > 0 },
    { key: 'author',  label: 'Author',             pass: author.trim().length > 0 },
    { key: 'tags',    label: 'At least one tag',   pass: tags.length > 0 },
    { key: 'content', label: 'Template content',   pass: content.trim().length > 0 },
  ]
  const allPass = checklist.every(c => c.pass)

  const addTag = () => {
    const t = tagInput.trim()
    if (t && !tags.includes(t)) { setTags([...tags, t]); setTagInput('') }
    setErrors(prev => ({ ...prev, tags: '' }))
  }

  const preview: MarketplaceTemplate = {
    id: 'preview', name: name || 'Template Name', title: name || 'Template Name',
    description: description || 'Template description will appear here.',
    content, format, category, author: author || 'Your Name',
    authorId: 'local', downloads: 0, rating: 5.0, tags,
    createdAt: Date.now(), updatedAt: Date.now(),
  }

  const handlePublish = () => {
    const errs: Record<string, string> = {}
    if (!name.trim()) errs.name = 'Name is required'
    if (!description.trim()) errs.description = 'Description is required'
    if (!author.trim()) errs.author = 'Author is required'
    if (tags.length === 0) errs.tags = 'At least one tag required'
    if (!content.trim()) errs.content = 'Content is required'
    if (Object.keys(errs).length > 0) { setErrors(errs); return }

    onPublish({ name: name.trim(), title: name.trim(), description: description.trim(), content: content.trim(), format, category, author: author.trim(), authorId: 'local-user', tags })
    toast.success('Template published!')
    setName(''); setAuthor(''); setDescription(''); setFormat('md'); setCategory('business')
    setTags([]); setTagInput(''); setContent(''); setErrors({})
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-auto">
        <DialogHeader>
          <DialogTitle>Publish Template to Marketplace</DialogTitle>
          <DialogDescription>Share your template with the community.</DialogDescription>
        </DialogHeader>

        <div className="flex gap-6 py-2">
          {/* Left: form */}
          <div className="flex-1 min-w-0 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>Template Name *</Label>
                <Input value={name} onChange={(e) => { setName(e.target.value); setErrors(p => ({ ...p, name: '' })) }} placeholder="Business Proposal" />
                {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
              </div>
              <div className="space-y-1">
                <Label>Author *</Label>
                <Input value={author} onChange={(e) => { setAuthor(e.target.value); setErrors(p => ({ ...p, author: '' })) }} placeholder="Your name" />
                {errors.author && <p className="text-xs text-destructive">{errors.author}</p>}
              </div>
            </div>

            <div className="space-y-1">
              <Label>Description * <span className="text-muted-foreground text-xs">({description.length}/200)</span></Label>
              <Textarea value={description} onChange={(e) => { if (e.target.value.length <= 200) { setDescription(e.target.value); setErrors(p => ({ ...p, description: '' })) } }} placeholder="Describe what this template is for..." rows={3} />
              {errors.description && <p className="text-xs text-destructive">{errors.description}</p>}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>Format *</Label>
                <Select value={format} onValueChange={(v) => setFormat(v as DocumentFormat)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FORMATS.map(f => (
                      <SelectItem key={f.value} value={f.value}>
                        <span className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: FORMAT_COLOR[f.value] }} />
                          {f.label}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Category *</Label>
                <div className="flex flex-wrap gap-1.5">
                  {CATEGORIES.map(cat => (
                    <button
                      key={cat.value}
                      type="button"
                      onClick={() => setCategory(cat.value)}
                      className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                        category === cat.value ? 'bg-primary text-primary-foreground border-primary' : 'border-border text-muted-foreground hover:border-foreground'
                      }`}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="space-y-1">
              <Label>Tags * (Press Enter to add)</Label>
              <div className="flex gap-2">
                <Input
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTag() } }}
                  placeholder="business, proposal..."
                />
                <Button type="button" variant="outline" size="sm" onClick={addTag}>Add</Button>
              </div>
              {tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {tags.map(tag => (
                    <Badge key={tag} variant="secondary" className="gap-1 pl-2 pr-1">
                      {tag}
                      <button onClick={() => setTags(tags.filter(t => t !== tag))} className="hover:bg-muted-foreground/20 rounded-full p-0.5"><X size={10} /></button>
                    </Badge>
                  ))}
                </div>
              )}
              {errors.tags && <p className="text-xs text-destructive">{errors.tags}</p>}
            </div>

            <div className="space-y-1">
              <Label>Content *</Label>
              <Textarea value={content} onChange={(e) => { setContent(e.target.value); setErrors(p => ({ ...p, content: '' })) }} placeholder="Paste your template content..." rows={8} className="font-mono text-sm" />
              {errors.content && <p className="text-xs text-destructive">{errors.content}</p>}
            </div>
          </div>

          {/* Right: preview + checklist */}
          <div className="w-72 flex-shrink-0 flex flex-col gap-4">
            {/* Live card preview */}
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">Preview</p>
              <div className="scale-90 origin-top-left" style={{ width: '111%' }}>
                <TemplateCard template={preview} onClick={() => {}} viewMode="grid" />
              </div>
            </div>

            {/* Readiness checklist */}
            <div className="border border-border rounded-lg p-4 space-y-2">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-3">Publish Readiness</p>
              {checklist.map(item => (
                <div key={item.key} className="flex items-center gap-2 text-xs">
                  <CheckCircle size={14} weight={item.pass ? 'fill' : 'regular'} className={item.pass ? 'text-emerald-500' : 'text-zinc-600'} />
                  <span className={item.pass ? 'text-foreground' : 'text-muted-foreground'}>{item.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handlePublish} disabled={!allPass}>Publish Template</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
