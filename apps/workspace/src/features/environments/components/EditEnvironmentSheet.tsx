import { useState, useEffect } from 'react'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { EnvironmentColorPicker } from './EnvironmentColorPicker'
import type { CaseSpace } from '@/lib/types'

interface EditEnvironmentSheetProps {
  environment: CaseSpace | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSave: (id: string, updates: Partial<CaseSpace>) => void
}

export function EditEnvironmentSheet({ environment, open, onOpenChange, onSave }: EditEnvironmentSheetProps) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [color, setColor] = useState('#627DBD')

  useEffect(() => {
    if (environment) {
      setName(environment.name)
      setDescription(environment.description ?? '')
      setColor(environment.color ?? '#627DBD')
    }
  }, [environment])

  function handleSave() {
    if (!environment || !name.trim()) return
    onSave(environment.id, {
      name: name.trim(),
      description: description.trim() || undefined,
      color,
    })
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit workspace</DialogTitle>
        </DialogHeader>

        <div className="py-4 space-y-5">
          <div className="space-y-1">
            <Label htmlFor="edit-env-name">Name <span className="text-destructive">*</span></Label>
            <Input
              id="edit-env-name"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Workspace name"
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="edit-env-desc">Description</Label>
            <Textarea
              id="edit-env-desc"
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Optional note about this workspace"
              rows={2}
            />
          </div>

          <EnvironmentColorPicker value={color} onChange={setColor} />
        </div>

        <DialogFooter className="gap-2 border-t pt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={!name.trim()}>Save changes</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
