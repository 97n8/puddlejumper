import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Switch } from '@/components/ui/switch'
import { toast } from 'sonner'
import { pjApi } from '@/services/pjApi'

interface ResetPasswordDialogProps {
  userId: string | null
  onClose: () => void
}

export function ResetPasswordDialog({ userId, onClose }: ResetPasswordDialogProps) {
  const [password, setPassword] = useState('')
  const [requireChange, setRequireChange] = useState(true)

  const handleReset = async () => {
    if (!userId || password.length < 8) {
      toast.error('Password must be at least 8 characters')
      return
    }
    try {
      const res = await pjApi.admin.resetMemberPassword(userId, password, requireChange)
      if ((res as Record<string, unknown>)?.success) {
        toast.success(requireChange ? 'Password reset — user must change it on next login' : 'Password reset and set live')
        setPassword('')
        setRequireChange(true)
        onClose()
      } else {
        toast.error('Failed to reset password')
      }
    } catch {
      toast.error('Could not reach PuddleJumper')
    }
  }

  return (
    <Dialog
      open={!!userId}
      onOpenChange={(open) => {
        if (!open) {
          setPassword('')
          setRequireChange(true)
          onClose()
        }
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reset Password</DialogTitle>
          <DialogDescription>Set a new password and choose whether the user has to rotate it on next login.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="reset-password">New temporary password</Label>
            <Input
              id="reset-password"
              type="text"
              placeholder="Min. 8 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="off"
            />
          </div>
          <div className="flex items-center justify-between rounded-lg border border-border/70 bg-muted/30 px-3 py-2">
            <div className="space-y-0.5">
              <Label htmlFor="reset-require-change">Require password change on next login</Label>
              <p className="text-xs text-muted-foreground">Turn this off to make the password immediately usable.</p>
            </div>
            <Switch
              id="reset-require-change"
              checked={requireChange}
              onCheckedChange={setRequireChange}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => { setPassword(''); setRequireChange(true); onClose() }}>Cancel</Button>
          <Button onClick={handleReset} disabled={password.length < 8}>Reset Password</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
