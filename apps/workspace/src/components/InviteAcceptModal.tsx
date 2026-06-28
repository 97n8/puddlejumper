// ── InviteAcceptModal ─────────────────────────────────────────────────────
//
// Shown when a logged-in user lands on the app with ?invite=TOKEN.
// Displays invite details and lets them accept or decline.
//
import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { pjApi } from '@/services/pjApi'
import { EnvelopeSimple, Buildings } from '@phosphor-icons/react'

interface InviteDetails {
  email: string
  role: string
  workspaceName: string
  expiresAt: string
}

interface InviteAcceptModalProps {
  token: string
  onAccepted: (workspaceName: string) => void
  onDeclined: () => void
}

const ROLE_LABELS: Record<string, string> = {
  admin: 'Admin',
  member: 'Member',
  viewer: 'Viewer',
}

export function InviteAcceptModal({ token, onAccepted, onDeclined }: InviteAcceptModalProps) {
  const [details, setDetails] = useState<InviteDetails | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [accepting, setAccepting] = useState(false)

  useEffect(() => {
    pjApi.workspace.peekInvitation(token).then(res => {
      if (res.success && res.data) {
        setDetails(res.data)
      } else {
        setError(res.error ?? 'This invite link is no longer valid.')
      }
    }).catch(() => setError('Could not load invite details.'))
  }, [token])

  const handleAccept = async () => {
    setAccepting(true)
    try {
      const res = await pjApi.workspace.acceptInvitation(token)
      if (res.success) {
        onAccepted(details?.workspaceName ?? 'Workspace')
      } else {
        setError('Failed to accept invite. It may have expired.')
        setAccepting(false)
      }
    } catch {
      setError('Something went wrong. Please try again.')
      setAccepting(false)
    }
  }

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onDeclined() }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <EnvelopeSimple size={20} weight="duotone" className="text-primary" />
            Workspace Invitation
          </DialogTitle>
          <DialogDescription>
            You've been invited to join a workspace on Workspace.
          </DialogDescription>
        </DialogHeader>

        {error ? (
          <div className="py-4 text-center">
            <p className="text-sm text-destructive">{error}</p>
            <Button variant="outline" className="mt-4" onClick={onDeclined}>Close</Button>
          </div>
        ) : !details ? (
          <div className="py-8 text-center text-muted-foreground text-sm">Loading invite details…</div>
        ) : (
          <>
            <div className="flex flex-col gap-3 py-2">
              <div className="flex items-center gap-3 p-4 rounded-xl bg-muted border border-border">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Buildings size={20} weight="duotone" className="text-primary" />
                </div>
                <div>
                  <p className="font-semibold">{details.workspaceName}</p>
                  <p className="text-xs text-muted-foreground">Role: {ROLE_LABELS[details.role] ?? details.role}</p>
                </div>
              </div>
              <p className="text-xs text-muted-foreground text-center">
                Invite sent to {details.email} · Expires {new Date(details.expiresAt).toLocaleDateString()}
              </p>
            </div>

            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={onDeclined} disabled={accepting}>
                Decline
              </Button>
              <Button onClick={handleAccept} disabled={accepting}>
                {accepting ? 'Joining…' : 'Accept & Join'}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
