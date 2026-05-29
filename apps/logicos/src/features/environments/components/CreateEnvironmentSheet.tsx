import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Buildings, FolderOpen } from '@phosphor-icons/react'
import { EnvironmentColorPicker } from './EnvironmentColorPicker'
import { DEFAULT_COLOR } from '../constants/environment-colors'
import type { CaseSpace } from '@/lib/types'

interface CreateEnvironmentSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (env: CaseSpace) => void
}

export function CreateEnvironmentSheet({ open, onOpenChange, onSubmit }: CreateEnvironmentSheetProps) {
  const [envType, setEnvType] = useState<'vault' | 'standard'>('standard')
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [color, setColor] = useState(DEFAULT_COLOR)
  const [visibility, setVisibility] = useState<'private' | 'organization' | 'public'>('organization')

  function reset() {
    setEnvType('standard')
    setName('')
    setDescription('')
    setColor(DEFAULT_COLOR)
    setVisibility('organization')
  }

  function handleClose(open: boolean) {
    if (!open) reset()
    onOpenChange(open)
  }

  function handleCreate() {
    const env: CaseSpace = {
      id: `env-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      name: name.trim(),
      description: description.trim() || undefined,
      color,
      type: envType === 'vault' ? 'vault' : 'custom',
      visibility,
      vaultModuleIds: undefined,
      members: [],
      createdAt: Date.now(),
      fileCount: 0,
      folderCount: 0,
      templateCount: 0,
      connectionIds: [],
    }
    onSubmit(env)
    handleClose(false)
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md flex flex-col max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>Create workspace</DialogTitle>
          <DialogDescription>
            Start with the workspace itself. You can add modules and invite people after it opens.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-y-auto py-4 space-y-5">
          <div className="grid grid-cols-2 gap-3">
            {(['vault', 'standard'] as const).map(t => (
              <button
                key={t}
                type="button"
                onClick={() => setEnvType(t)}
                className={`
                  flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-colors
                  ${envType === t ? 'border-primary bg-primary/5' : 'border-border hover:border-muted-foreground/40'}
                `}
              >
                {t === 'vault'
                  ? <Buildings size={28} className="text-primary" />
                  : <FolderOpen size={28} className="text-muted-foreground" />
                }
                <span className="text-sm font-semibold">{t === 'vault' ? 'Case management workspace' : 'Team workspace'}</span>
                <span className="text-[10px] text-muted-foreground text-center leading-tight">
                  {t === 'vault'
                    ? 'Best for permits, requests, reviews, and other governed municipal work.'
                    : 'Best for general files, collaboration, and day-to-day team work.'}
                </span>
              </button>
            ))}
          </div>

          <div className="rounded-xl border bg-muted/20 px-4 py-3 text-xs leading-5 text-muted-foreground">
            Create the workspace first.
            <br />
            <span className="text-foreground font-medium">Next steps:</span> open it, then add modules, invite staff, and connect outside systems when you are ready.
          </div>

          <div className="space-y-1">
            <Label htmlFor="env-name">Name <span className="text-destructive">*</span></Label>
            <Input
              id="env-name"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Town of Phillipston"
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="env-desc">Description</Label>
            <Textarea
              id="env-desc"
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Optional note about the team, department, or purpose"
              rows={2}
            />
          </div>

          <EnvironmentColorPicker value={color} onChange={setColor} />

          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Visibility</Label>
            <div className="flex gap-2">
              {(['private', 'organization', 'public'] as const).map(v => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setVisibility(v)}
                  className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors capitalize
                    ${visibility === v ? 'border-primary bg-primary/10 text-primary' : 'border-border hover:border-muted-foreground/40'}`}
                >
                  {v}
                </button>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter className="flex gap-2 pt-4 border-t">
          <Button onClick={handleCreate} disabled={!name.trim()} className="flex-1">
            Create workspace
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
