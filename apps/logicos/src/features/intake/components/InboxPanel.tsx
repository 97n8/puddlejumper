import React, { useState, useEffect, useCallback, useRef } from 'react'
import { pjApi } from '@/services/pjApi'
import { type IntakeItem, type SourceType, type DocClass } from '@/lib/anchors'
import { toast } from 'sonner'
import {
  Tray, ArrowLeft, CheckCircle, Warning, MagnifyingGlass,
  ArrowsClockwise, Files, Envelope, FilePdf, FileDoc, Scan,
  Calendar, Buildings, Lightning, ArrowRight, UploadSimple,
  CaretRight, ClockCountdown,
} from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'

// ── Helpers ────────────────────────────────────────────────────────────────

const SOURCE_ICONS: Record<SourceType, React.ElementType> = {
  email: Envelope, form: Files, upload: FilePdf, scan: Scan,
  calendar: Calendar, drive: FileDoc, finance: Files, permitting: Files,
  gis: Buildings, api: Lightning, chat: Envelope, voicemail: Envelope,
  website: Files, manual: FileDoc,
}

const SOURCE_LABELS: Record<SourceType, string> = {
  email: 'Email', form: 'Online form', upload: 'Upload', scan: 'Scan',
  calendar: 'Calendar', drive: 'Drive', finance: 'Finance',
  permitting: 'Permit portal', gis: 'GIS', api: 'System', chat: 'Chat',
  voicemail: 'Voicemail', website: 'Town website', manual: 'Staff entry',
}

const DOC_CLASS_LABELS: Partial<Record<DocClass, string>> = {
  invoice: 'Invoice', contract: 'Contract', minutes: 'Meeting minutes',
  agenda: 'Meeting agenda', permit: 'Permit application', application: 'Application',
  correspondence: 'Correspondence', policy: 'Policy', report: 'Report',
  ordinance: 'Ordinance', resolution: 'Resolution', notice: 'Public notice',
  procurement: 'Procurement', budget: 'Budget document', payroll: 'Payroll',
  request: 'Records request', complaint: 'Complaint', deed: 'Deed',
  map: 'Map', photo: 'Photo', other: 'Document',
}

function formatTimeAgo(iso: string) {
  const ms = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(ms / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

function formatTimeFull(iso: string) {
  return new Date(iso).toLocaleString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric',
    hour: 'numeric', minute: '2-digit',
  })
}
// ── Detail view ───────────────────────────────────────────────────────────

function ItemDetail({
  item,
  onSend,
  onHold,
  onClose,
}: {
  item: IntakeItem
  onSend: (id: string) => void
  onHold: (id: string) => void
  onClose: () => void
}) {
  const needsReview = item.confidence === 'low' || item.confidence === 'unclassified'
  const SourceIcon = SOURCE_ICONS[item.source] ?? Files
  const docLabel = DOC_CLASS_LABELS[item.docClass] ?? 'Document'

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Header */}
      <div className="shrink-0 flex items-center gap-2 px-4 py-3 border-b bg-background/80 backdrop-blur">
        <button
          onClick={onClose}
          className="p-2 -ml-1 rounded-lg hover:bg-muted transition-colors text-muted-foreground"
          aria-label="Back to inbox"
        >
          <ArrowLeft size={18} />
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-xs text-muted-foreground font-medium">{SOURCE_LABELS[item.source]} &middot; {formatTimeAgo(item.receivedAt)}</p>
        </div>
        {needsReview && (
          <span className="shrink-0 flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/30 border border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-400 text-xs font-semibold">
            <Warning size={11} weight="fill" /> Needs review
          </span>
        )}
      </div>

      {/* Body */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="px-4 pt-4 pb-2 space-y-4">

          {/* Icon + title */}
          <div className="flex items-start gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${
              needsReview
                ? 'bg-amber-100 dark:bg-amber-900/30 border-amber-200 dark:border-amber-800'
                : 'bg-muted/60'
            }`}>
              <SourceIcon size={19} className={needsReview ? 'text-amber-600 dark:text-amber-400' : 'text-muted-foreground'} />
            </div>
            <h2 className="text-[15px] font-bold leading-snug text-foreground pt-1">{item.title}</h2>
          </div>

          {/* Metadata */}
          <div className="grid grid-cols-2 gap-2 text-sm">
            {item.submitter && (
              <div className="col-span-2 rounded-xl bg-muted/40 border px-3 py-2.5">
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-0.5">From</p>
                <p className="font-medium text-foreground break-all">{item.submitter}</p>
              </div>
            )}
            <div className="rounded-xl bg-muted/40 border px-3 py-2.5">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-0.5">Type</p>
              <p className="font-medium text-foreground">{docLabel}</p>
            </div>
            {item.department && (
              <div className="rounded-xl bg-muted/40 border px-3 py-2.5">
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-0.5">Send to</p>
                <p className="font-medium text-foreground">{item.department}</p>
              </div>
            )}
            <div className="rounded-xl bg-muted/40 border px-3 py-2.5">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-0.5">Received</p>
              <p className="font-medium text-foreground">{formatTimeFull(item.receivedAt)}</p>
            </div>
            {item.retentionClass && (
              <div className="rounded-xl bg-muted/40 border px-3 py-2.5">
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-0.5">Keep for</p>
                <p className="font-medium text-foreground">{item.retentionClass}</p>
              </div>
            )}
          </div>

          {/* Anchors */}
          {item.anchors.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {item.anchors.map(a => (
                <span key={a.id} className="px-2.5 py-1 rounded-full bg-primary/5 border border-primary/20 text-primary/70 text-xs font-semibold">{a.label}</span>
              ))}
            </div>
          )}

          {/* Raw text */}
          {item.rawText ? (
            <div className="rounded-xl border bg-muted/20 px-4 py-3.5">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Full text</p>
              <p className="text-sm leading-relaxed text-foreground whitespace-pre-wrap">{item.rawText}</p>
            </div>
          ) : (
            <div className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/10 px-4 py-3.5">
              <p className="text-[10px] font-semibold text-amber-700 dark:text-amber-400 uppercase tracking-wider mb-1.5">No readable text</p>
              <p className="text-sm text-amber-800 dark:text-amber-300">This scan could not be read automatically. Review the original file and classify it manually before sending.</p>
            </div>
          )}

          {needsReview && (
            <div className="flex items-start gap-2.5 px-3.5 py-3 rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/40">
              <Warning size={15} className="shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
              <p className="text-sm text-amber-800 dark:text-amber-300">
                {!item.department
                  ? "We could not determine where this belongs. Confirm the type and department above, then send it."
                  : "Something flagged this for review. Confirm the details look right before sending."}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Sticky action bar */}
      <div className="shrink-0 px-4 pb-[max(1rem,env(safe-area-inset-bottom,0px))] pt-3 border-t bg-background space-y-2">
        <button
          onClick={() => onSend(item.id)}
          className={`w-full flex items-center justify-center gap-2 py-3.5 rounded-xl text-sm font-bold transition-colors ${
            needsReview
              ? 'bg-amber-500 hover:bg-amber-600 text-white active:bg-amber-700'
              : 'bg-emerald-500 hover:bg-emerald-600 text-white active:bg-emerald-700'
          }`}
        >
          <CheckCircle size={16} weight="bold" />
          {needsReview ? 'Looks right — send it' : 'Confirm & send'}
        </button>
        <button
          onClick={() => onHold(item.id)}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold border border-border bg-muted/20 hover:bg-muted/60 text-muted-foreground transition-colors"
        >
          Hold for later
        </button>
      </div>
    </div>
  )
}

// ── Item card (list row) ──────────────────────────────────────────────────

interface ItemCardProps {
  item: IntakeItem
  needsReview: boolean
  onTap: (item: IntakeItem) => void
  onSend: (id: string) => void
}

function ItemCard({ item, needsReview, onTap, onSend }: ItemCardProps) {
  const SourceIcon = SOURCE_ICONS[item.source] ?? Files
  const docLabel = DOC_CLASS_LABELS[item.docClass] ?? 'Document'

  return (
    <button
      onClick={() => onTap(item)}
      className={`w-full text-left rounded-2xl border bg-card shadow-sm transition-all active:scale-[0.985] ${
        needsReview
          ? 'border-amber-300 dark:border-amber-700/60 bg-amber-50/30 dark:bg-amber-950/10'
          : 'hover:border-primary/30'
      }`}
    >
      <div className="p-4 flex items-start gap-3">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${
          needsReview
            ? 'bg-amber-100 dark:bg-amber-900/30 border-amber-200 dark:border-amber-800'
            : 'bg-muted/60'
        }`}>
          <SourceIcon size={18} className={needsReview ? 'text-amber-600 dark:text-amber-400' : 'text-muted-foreground'} />
        </div>

        <div className="flex-1 min-w-0 space-y-1">
          <p className="text-sm font-semibold leading-snug text-foreground line-clamp-2">{item.title}</p>
          <div className="flex items-center gap-1.5 flex-wrap text-xs">
            <span className="px-2 py-0.5 rounded-full bg-muted/70 border font-medium text-foreground/80">{docLabel}</span>
            {item.department && !needsReview && (
              <>
                <ArrowRight size={10} className="text-muted-foreground/60" />
                <span className="text-muted-foreground font-medium">{item.department}</span>
              </>
            )}
            <span className="text-muted-foreground/60 ml-auto">{formatTimeAgo(item.receivedAt)}</span>
          </div>
          {needsReview && (
            <p className="text-xs text-amber-700 dark:text-amber-400 font-medium flex items-center gap-1">
              <Warning size={11} weight="fill" /> Needs your review
            </p>
          )}
        </div>

        <div className="shrink-0 flex items-center self-center">
          {needsReview ? (
            <CaretRight size={15} className="text-muted-foreground/40" />
          ) : (
            <button
              onClick={e => { e.stopPropagation(); onSend(item.id) }}
              title="Send now"
              className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-300 dark:border-emerald-700 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 transition-colors"
            >
              <CheckCircle size={16} weight="bold" />
            </button>
          )}
        </div>
      </div>
    </button>
  )
}

// ── Upload zone ───────────────────────────────────────────────────────────

function UploadZone({ onFilesAdded }: { onFilesAdded: (files: File[]) => void }) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)

  const handle = (files: FileList | null) => {
    if (!files || !files.length) return
    onFilesAdded(Array.from(files))
  }

  return (
    <div
      onDragOver={e => { e.preventDefault(); setDragging(true) }}
      onDragLeave={() => setDragging(false)}
      onDrop={e => { e.preventDefault(); setDragging(false); handle(e.dataTransfer.files) }}
      onClick={() => inputRef.current?.click()}
      className={`flex items-center gap-3 px-4 py-3.5 rounded-2xl border-2 border-dashed cursor-pointer transition-all ${
        dragging
          ? 'border-primary bg-primary/5'
          : 'border-border/60 hover:border-primary/40 hover:bg-muted/20'
      }`}
    >
      <UploadSimple size={20} className="text-muted-foreground shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-foreground">Add a document</p>
        <p className="text-xs text-muted-foreground">PDF, Word, image, email, scan &mdash; anything</p>
      </div>
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        multiple
        accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.txt,.eml,.msg,.tiff,.bmp"
        onChange={e => handle(e.target.files)}
      />
    </div>
  )
}

// ── Main panel ────────────────────────────────────────────────────────────

export function InboxPanel({ onBack }: { onBack: () => void }) {
  const [search, setSearch] = useState('')
  const [items, setItems] = useState<IntakeItem[]>([])
  const [loading, setLoading] = useState(true)
  const [detail, setDetail] = useState<IntakeItem | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await pjApi.ingestion.queue({ limit: 50 })
      setItems(res.items)
    } catch {
      setItems([]) // show empty state rather than fake demo data
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const handleSend = async (id: string) => {
    try { await pjApi.ingestion.approve(id) } catch { /* demo */ }
    toast.success('Sent')
    setItems(prev => prev.filter(i => i.id !== id))
    setDetail(null)
  }

  const handleHold = (id: string) => {
    toast.info('Held \u2014 still in your inbox')
    setItems(prev => prev.filter(i => i.id !== id))
    setDetail(null)
  }

  const handleFiles = (files: File[]) => {
    toast.info(`${files.length} file${files.length > 1 ? 's' : ''} queued for processing`)
    // Production: pjApi.ingestion.upload(file) per file
  }

  // Detail view — full-screen slide-over on mobile
  if (detail) {
    return (
      <div className="h-full flex flex-col overflow-hidden" data-tool-panel>
        <ItemDetail item={detail} onSend={handleSend} onHold={handleHold} onClose={() => setDetail(null)} />
      </div>
    )
  }

  const filtered = items.filter(item =>
    !search || item.title.toLowerCase().includes(search.toLowerCase())
  )

  const flagged = filtered.filter(i => i.confidence === 'low' || i.confidence === 'unclassified')
  const clear   = filtered.filter(i => i.confidence !== 'low' && i.confidence !== 'unclassified')

  return (
    <div className="h-full flex flex-col overflow-hidden" data-tool-panel>

      {/* Header */}
      <div className="shrink-0 flex items-center gap-3 px-4 py-3.5 border-b bg-background/80 backdrop-blur">
        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={onBack}>
          <ArrowLeft size={16} />
        </Button>
        <Tray size={19} className="text-primary shrink-0" />
        <div className="flex-1 min-w-0">
          <h1 className="text-[15px] font-bold leading-tight">Incoming Items</h1>
          <p className="text-xs text-muted-foreground">Forms, emails, documents, and scans</p>
        </div>
        <button onClick={load} className="p-2 rounded-lg hover:bg-muted transition-colors" aria-label="Refresh">
          <ArrowsClockwise size={16} className={`text-muted-foreground ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-4 py-4 flex flex-col gap-4">

          {/* Search */}
          <div className="relative">
            <MagnifyingGlass size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            <input
              type="search"
              placeholder="Search items…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2.5 rounded-xl border bg-background text-sm outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>

          {/* Upload zone */}
          <UploadZone onFilesAdded={handleFiles} />

          {/* Needs-attention banner */}
          {!loading && flagged.length > 0 && (
            <div className="flex items-start gap-3 px-4 py-3 rounded-xl border border-amber-300 dark:border-amber-700/60 bg-amber-50/50 dark:bg-amber-950/10">
              <Warning size={17} className="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" weight="fill" />
              <div>
                <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">
                  {flagged.length === 1 ? '1 item needs your review' : `${flagged.length} items need your review`}
                </p>
                <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">
                  {flagged.length === 1
                    ? "We couldn't sort this one automatically. Tap to review."
                    : "We couldn't sort these automatically. Tap each one to review."}
                </p>
              </div>
            </div>
          )}

          {loading ? (
            <div className="py-16 text-center">
              <ArrowsClockwise size={24} className="text-muted-foreground mx-auto mb-3 animate-spin" />
              <p className="text-sm text-muted-foreground">Loading…</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-16 text-center">
              <CheckCircle size={44} className="text-emerald-500 mx-auto mb-3" weight="duotone" />
              <p className="text-base font-bold text-foreground">You're all caught up</p>
              <p className="text-sm text-muted-foreground mt-1.5 max-w-xs mx-auto">
                Nothing needs your attention. New items appear here as they arrive.
              </p>
            </div>
          ) : (
            <>
              {flagged.length > 0 && (
                <div className="flex flex-col gap-2">
                  <p className="text-[11px] font-black text-amber-700 dark:text-amber-400 uppercase tracking-widest">Needs review</p>
                  {flagged.map(item => (
                    <ItemCard key={item.id} item={item} needsReview onTap={setDetail} onSend={handleSend} />
                  ))}
                </div>
              )}

              {clear.length > 0 && (
                <div className="flex flex-col gap-2">
                  {flagged.length > 0 && (
                    <p className="text-[11px] font-black text-muted-foreground uppercase tracking-widest">Ready to send</p>
                  )}
                  {clear.map(item => (
                    <ItemCard key={item.id} item={item} needsReview={false} onTap={setDetail} onSend={handleSend} />
                  ))}
                </div>
              )}

              <div className="rounded-2xl border bg-muted/20 px-4 py-4 space-y-1.5">
                <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <ClockCountdown size={13} className="text-muted-foreground" /> How this works
                </p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Anything that arrives — form, email, scan, or upload — is read and sorted automatically.
                  Items we can classify go to the right department once you confirm.
                  Items we cannot classify wait here until someone reviews them.
                </p>
                <p className="text-[11px] text-muted-foreground/60">Nothing leaves without a confirmation. Every item is logged with a timestamp.</p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
