import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ShieldCheck, Tag, Signature, CheckCircle, ArrowClockwise } from '@phosphor-icons/react'
import type { VaultDocFull, VaultEvent, VaultSignature, VaultVersion, VaultStatus, VaultClassification } from '@/services/pjApi'
import { STATUS_META, CLASS_META, EVENT_ICONS } from './vaultConstants'
import type { GovTab } from './vaultConstants'
import { fmtTime } from './vaultHelpers'
import { createLogger } from '@/lib/logger'

const logger = createLogger('GovernanceSidebar')

export function GovernanceSidebar({
  doc, userName, onStatusChange, onClassify, onSign, onRefreshAudit,
  events, signatures, versions, auditLoading,
}: {
  doc: VaultDocFull
  userName: string
  onStatusChange: (s: VaultStatus) => void
  onClassify: (c: VaultClassification) => void
  onSign: (comment: string) => void
  onRefreshAudit: () => void
  events: VaultEvent[]
  signatures: VaultSignature[]
  versions: VaultVersion[]
  auditLoading: boolean
}) {
  const [govTab, setGovTab] = useState<GovTab>('status')
  const [signComment, setSignComment] = useState('')
  const [signing, setSigning] = useState(false)
  const [showSignForm, setShowSignForm] = useState(false)

  const status = doc.status as VaultStatus
  const classification = doc.classification as VaultClassification
  const sm = STATUS_META[status]
  const cm = CLASS_META[classification]
  const hasSigned = signatures.some(s => s.user_id === userName || s.user_name === userName)

  const handleSign = async () => {
    setSigning(true)
    try { await onSign(signComment); setSignComment(''); setShowSignForm(false) }
    finally { setSigning(false) }
  }

  return (
    <div className="flex flex-col h-full border-l border-border bg-background text-xs">
      {/* Governance branded header */}
      <div className="px-3 py-2 border-b border-border bg-gradient-to-r from-sky-950/20 to-transparent flex items-center gap-2 shrink-0">
        <ShieldCheck size={13} className="text-sky-400" />
        <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-sky-400/80">Governance</span>
      </div>
      {/* Tabs */}
      <div className="flex border-b border-border">
        {(['status', 'audit', 'versions'] as GovTab[]).map(t => (
          <button key={t} onClick={() => setGovTab(t)}
            className={`flex-1 py-2 text-[11px] font-medium capitalize transition-colors ${govTab === t ? 'bg-muted text-foreground border-b-2 border-primary' : 'text-muted-foreground hover:text-foreground'}`}>
            {t === 'status' ? 'Governance' : t === 'audit' ? 'Audit Trail' : 'Versions'}
          </button>
        ))}
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-4">
        {govTab === 'status' && (
          <>
            {/* Status */}
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2 font-semibold">Lifecycle Status</p>
              <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold ${sm.color} ${sm.bg} mb-3`}>
                {sm.icon}{sm.label}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {sm.next.map(next => (
                  <button key={next} onClick={() => onStatusChange(next)}
                    className={`px-2.5 py-1 rounded-full text-[10px] font-medium border transition-colors hover:opacity-80 ${STATUS_META[next].color} ${STATUS_META[next].bg}`}>
                    {STATUS_META[next].action}
                  </button>
                ))}
              </div>
            </div>

            {/* Classification */}
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2 font-semibold">Classification</p>
              <div className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold mb-3 ${cm.color} ${cm.bg}`}>
                <Tag size={11} />{cm.label}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {(Object.keys(CLASS_META) as VaultClassification[]).filter(c => c !== classification).map(c => (
                  <button key={c} onClick={() => onClassify(c)}
                    className={`px-2.5 py-1 rounded-full text-[10px] font-medium border transition-colors hover:opacity-80 ${CLASS_META[c].color} ${CLASS_META[c].bg}`}>
                    {CLASS_META[c].label}
                  </button>
                ))}
              </div>
            </div>

            {/* Sign-off */}
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2 font-semibold">Signatures ({signatures.length})</p>
              {signatures.length === 0 && <p className="text-muted-foreground text-[11px]">No signatures yet</p>}
              <div className="space-y-2 mb-3">
                {signatures.map(sig => (
                  <div key={sig.id} className="flex items-start gap-2 p-2.5 rounded-lg bg-emerald-950/20 border border-emerald-500/20">
                    <Signature size={14} className="text-emerald-600 mt-0.5 shrink-0" />
                    <div>
                      <p className="font-semibold text-emerald-300">{sig.user_name}</p>
                      {sig.comment && <p className="text-muted-foreground">{sig.comment}</p>}
                      <p className="text-[10px] text-muted-foreground">{fmtTime(sig.created_at)}</p>
                    </div>
                  </div>
                ))}
              </div>
              {!hasSigned && !showSignForm && (
                <button onClick={() => setShowSignForm(true)}
                  className="w-full text-[11px] py-1.5 rounded border border-dashed border-border hover:border-emerald-400 hover:text-emerald-700 transition-colors">
                  + Sign this document
                </button>
              )}
              {showSignForm && (
                <div className="space-y-2">
                  <Input placeholder="Optional comment…" value={signComment} onChange={e => setSignComment(e.target.value)} className="h-7 text-xs" />
                  <div className="flex gap-2">
                    <Button size="sm" className="h-7 text-xs flex-1" onClick={handleSign} disabled={signing}>
                      {signing ? 'Signing…' : 'Sign'}
                    </Button>
                    <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setShowSignForm(false)}>Cancel</Button>
                  </div>
                </div>
              )}
              {hasSigned && <p className="text-emerald-700 text-[11px] flex items-center gap-1"><CheckCircle size={12} />You have signed this document</p>}
            </div>

            {/* Metadata */}
            <div className="pt-2 border-t border-border">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2 font-semibold">Document Info</p>
              <div className="space-y-1 text-[11px] text-muted-foreground">
                <p>Created: {fmtTime(doc.created_at)}</p>
                <p>Updated: {fmtTime(doc.updated_at)}</p>
                <p>Versions: {versions.length}</p>
              </div>
            </div>
          </>
        )}

        {govTab === 'audit' && (
          <>
            <div className="flex items-center justify-between">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Activity Timeline</p>
              <button onClick={onRefreshAudit} aria-label="Refresh" className="text-muted-foreground hover:text-foreground"><ArrowClockwise size={12} /></button>
            </div>
            {auditLoading && <p className="text-muted-foreground">Loading…</p>}
            {!auditLoading && events.length === 0 && <p className="text-muted-foreground text-[11px]">No activity recorded yet</p>}
            <div className="space-y-0">
              {events.map((ev, i) => {
                let detail = ''
                try {
                  const d = JSON.parse(ev.details)
                  if (ev.event_type === 'status_changed') detail = `${d.from} → ${d.to}`
                  else if (ev.event_type === 'classified') detail = `${d.from} → ${d.to}`
                  else if (d.name) detail = d.name
                  else if (d.comment) detail = d.comment
                } catch (error) {
                  logger.error('Failed to parse audit event details.', error, { eventId: ev.id, eventType: ev.event_type })
                }
                return (
                  <div key={ev.id} className="flex gap-2.5 relative">
                    {i < events.length - 1 && <div className="absolute left-[11px] top-6 bottom-0 w-px bg-border" />}
                    <div className="w-6 h-6 rounded-full bg-sky-950/40 border border-sky-500/20 flex items-center justify-center text-[11px] shrink-0 z-10 text-sky-300">
                      {EVENT_ICONS[ev.event_type] ?? '·'}
                    </div>
                    <div className="pb-4 min-w-0">
                      <p className="font-medium text-foreground leading-snug">{ev.user_name || ev.user_id}</p>
                      <p className="text-muted-foreground leading-snug capitalize">{ev.event_type.replace('_', ' ')}{detail ? ` — ${detail}` : ''}</p>
                      <p className="text-[10px] text-muted-foreground">{fmtTime(ev.created_at)}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          </>
        )}

        {govTab === 'versions' && (
          <>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Version History ({versions.length})</p>
            {versions.length === 0 && <p className="text-muted-foreground text-[11px]">No versions saved yet</p>}
            <div className="space-y-2">
              {versions.map((v, i) => (
                <div key={v.id} className={`p-2 rounded border text-[11px] ${i === 0 ? 'border-primary bg-primary/5' : 'border-border'}`}>
                  <div className="flex items-center justify-between">
                    <span className="font-semibold">v{v.version_num}</span>
                    {i === 0 && <span className="text-[10px] text-primary">current</span>}
                  </div>
                  <p className="text-muted-foreground">{v.saved_by || 'System'}</p>
                  <p className="text-muted-foreground">{fmtTime(v.created_at)}</p>
                  <p className="font-mono text-[10px] text-muted-foreground mt-1">#{v.content_hash}</p>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
