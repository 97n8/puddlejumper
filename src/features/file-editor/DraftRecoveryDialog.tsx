import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import type { DraftConflict } from './providers/types'
import { formatDistanceToNow } from 'date-fns'
import { Warning, CloudArrowUp, Desktop } from '@phosphor-icons/react'

interface Props {
  conflict: DraftConflict
  onRestore: (content: string) => void
  onDiscard: () => void
}

export function DraftRecoveryDialog({ conflict, onRestore, onDiscard }: Props) {
  const primary = conflict.newerSource === 'local' ? conflict.localDraft : (conflict.serverDraft ?? conflict.localDraft)
  const age = formatDistanceToNow(new Date(primary.timestamp), { addSuffix: true })
  const sizeKB = (new TextEncoder().encode(primary.content).byteLength / 1024).toFixed(1)
  const lineCount = primary.content.split('\n').length

  return (
    <Dialog open>
      <DialogContent
        role="alertdialog"
        aria-labelledby="draft-dialog-title"
        aria-describedby="draft-dialog-desc"
        className="max-w-md"
      >
        <DialogHeader>
          <DialogTitle id="draft-dialog-title" className="flex items-center gap-2">
            <Warning size={18} weight="duotone" className="text-amber-500" />
            Unsaved Draft Found
          </DialogTitle>
        </DialogHeader>

        <div id="draft-dialog-desc" className="space-y-3 text-sm">
          <div className="flex items-center gap-2">
            {primary.source === 'server'
              ? <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/30"><CloudArrowUp size={12} /> Synced ☁</span>
              : <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground border border-border"><Desktop size={12} /> Local</span>
            }
            <span className="text-muted-foreground">{age}</span>
          </div>

          <div className="rounded-lg border border-border bg-muted/30 p-3 text-xs font-mono text-muted-foreground space-y-1">
            <div>{sizeKB} KB · {lineCount} lines</div>
            <div className="truncate opacity-70">{primary.path}</div>
          </div>

          {conflict.hasConflict && (
            <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-amber-400">
              <Warning size={14} weight="duotone" className="shrink-0 mt-0.5" />
              <span>Both local and cloud drafts exist with different content. Restoring this draft will discard the {conflict.newerSource === 'local' ? 'cloud' : 'local'} version.</span>
            </div>
          )}

          <p className="text-muted-foreground">Would you like to restore this draft or start fresh?</p>
        </div>

        <DialogFooter className="flex gap-2">
          <Button variant="outline" size="sm" onClick={onDiscard}>Discard Draft</Button>
          <Button size="sm" onClick={() => onRestore(primary.content)}>Restore Draft</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
