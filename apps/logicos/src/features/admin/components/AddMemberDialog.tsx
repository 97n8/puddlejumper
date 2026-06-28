import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Switch } from '@/components/ui/switch'
import { UserPlus } from '@phosphor-icons/react'
import { toast } from 'sonner'
import type { UserRole } from '@/lib/types'
import { pjApi, type DemoMemberTemplate } from '@/services/pjApi'

const TOOL_KEYS = [
  { key: 'vault', label: 'Files & Docs' },
  { key: 'formkey', label: 'FormKey' },
  { key: 'automations', label: 'Flows' },
  { key: 'builder', label: 'Module Builder' },
  { key: 'civicpulse', label: 'CivicPulse™' },
  { key: 'casespaces', label: 'CaseSpaces' },
  { key: 'puddles', label: 'Puddles' },
]

interface AddMemberDialogProps {
  memberTemplates: DemoMemberTemplate[]
  onSuccess: () => void
}

export function AddMemberDialog({ memberTemplates, onSuccess }: AddMemberDialogProps) {
  const [open, setOpen] = useState(false)
  const [pendingDirectUser, setPendingDirectUser] = useState<{ name: string; username: string; temporaryPassword: string } | null>(null)

  const [newUserName, setNewUserName] = useState('')
  const [newUserUsername, setNewUserUsername] = useState('')
  const [newUserEmail, setNewUserEmail] = useState('')
  const [newUserTempPassword, setNewUserTempPassword] = useState('')
  const [newUserRequirePasswordChange, setNewUserRequirePasswordChange] = useState(true)
  const [selectedMemberTemplateId, setSelectedMemberTemplateId] = useState<string | null>(null)
  const [newUserRole, setNewUserRole] = useState<UserRole>('member')
  const [newUserToolAccess, setNewUserToolAccess] = useState<string[] | null>(null)
  const [, setNewUserPermissions] = useState({
    canManageUsers: false,
    canManageSettings: false,
    canManageConnections: true,
    canDeleteFiles: true,
    canCreateAutomations: true,
    canAccessCaseSpaces: true,
  })

  const applyRoleDefaults = (role: UserRole) => {
    setNewUserRole(role)
    if (role === 'admin') {
      setNewUserPermissions({ canManageUsers: true, canManageSettings: true, canManageConnections: true, canDeleteFiles: true, canCreateAutomations: true, canAccessCaseSpaces: true })
    } else if (role === 'member') {
      setNewUserPermissions({ canManageUsers: false, canManageSettings: false, canManageConnections: true, canDeleteFiles: true, canCreateAutomations: true, canAccessCaseSpaces: true })
    } else {
      setNewUserPermissions({ canManageUsers: false, canManageSettings: false, canManageConnections: false, canDeleteFiles: false, canCreateAutomations: false, canAccessCaseSpaces: true })
    }
  }

  const applyDemoPreset = (presetId: string) => {
    const preset = memberTemplates.find((entry) => entry.id === presetId)
    if (!preset) return
    setSelectedMemberTemplateId(preset.id)
    setNewUserName(preset.name)
    setNewUserUsername(preset.username)
    setNewUserEmail(preset.email)
    setNewUserToolAccess(preset.toolAccess)
    setNewUserRequirePasswordChange(preset.mustChangePassword)
    applyRoleDefaults(preset.role)
  }

  const resetForm = () => {
    setSelectedMemberTemplateId(null)
    setNewUserName('')
    setNewUserUsername('')
    setNewUserEmail('')
    setNewUserTempPassword('')
    setNewUserRequirePasswordChange(true)
    applyRoleDefaults('member')
    setNewUserToolAccess(null)
  }

  const handleCreateDirectMember = async () => {
    if (!newUserName || !newUserUsername || !newUserTempPassword) {
      toast.error('Please provide name, username, and temporary password')
      return
    }
    if (newUserTempPassword.length < 8) {
      toast.error('Temporary password must be at least 8 characters')
      return
    }
    try {
      const res = selectedMemberTemplateId
        ? await pjApi.admin.provisionMemberTemplate(selectedMemberTemplateId, newUserTempPassword, newUserRequirePasswordChange)
        : await pjApi.admin.createMember({
            username: newUserUsername,
            temporaryPassword: newUserTempPassword,
            name: newUserName,
            email: newUserEmail.trim() || undefined,
            role: newUserRole,
            toolAccess: newUserToolAccess ?? undefined,
            mustChangePassword: newUserRequirePasswordChange,
          })
      if (!res.success) {
        toast.error((res as Record<string, unknown>)?.error as string || 'Failed to create member')
        return
      }
      setOpen(false)
      setPendingDirectUser({ name: newUserName, username: newUserUsername, temporaryPassword: newUserTempPassword })
      resetForm()
      onSuccess()
    } catch {
      toast.error('Could not reach PuddleJumper. Check connection.')
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button>
            <UserPlus size={18} weight="bold" />
            Add Member
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add Member</DialogTitle>
            <DialogDescription>
              Create a local account or provision a backend demo template. You control whether the password must be changed on first login.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-5 py-2">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Demo presets</Label>
                <span className="text-xs text-muted-foreground">Passwords are still chosen at creation time</span>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                {memberTemplates.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => applyDemoPreset(preset.id)}
                    className="rounded-lg border border-border bg-muted/30 px-3 py-3 text-left transition-colors hover:bg-muted"
                  >
                    <div className="text-sm font-semibold text-foreground">{preset.label}</div>
                    <div className="mt-1 text-xs leading-relaxed text-muted-foreground">{preset.description}</div>
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="user-name">Name</Label>
                <Input id="user-name" placeholder="Jane Smith" value={newUserName} onChange={(e) => setNewUserName(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="user-username">Username</Label>
                <Input id="user-username" placeholder="janesmith" value={newUserUsername} onChange={(e) => setNewUserUsername(e.target.value.toLowerCase().replace(/\s+/g, ''))} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="user-email">Email</Label>
              <Input
                id="user-email"
                type="email"
                placeholder="name@publiclogic.org"
                value={newUserEmail}
                onChange={(e) => setNewUserEmail(e.target.value.trim())}
              />
              <p className="text-xs text-muted-foreground">Use an allowlisted email for route-specific demos like `os.publiclogic.org/town`.</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="user-temp-password">Temporary Password</Label>
              <Input
                id="user-temp-password"
                type="text"
                placeholder="Min. 8 characters"
                value={newUserTempPassword}
                onChange={(e) => setNewUserTempPassword(e.target.value)}
                autoComplete="off"
              />
              <p className="text-xs text-muted-foreground">Set the initial demo password here.</p>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border/70 bg-muted/30 px-3 py-2">
              <div className="space-y-0.5">
                <Label htmlFor="require-password-change">Require password change on first login</Label>
                <p className="text-xs text-muted-foreground">Turn this off for stable demo credentials.</p>
              </div>
              <Switch
                id="require-password-change"
                checked={newUserRequirePasswordChange}
                onCheckedChange={setNewUserRequirePasswordChange}
              />
            </div>

            <div className="space-y-1.5">
              <Label>Role</Label>
              <Select value={newUserRole} onValueChange={(value) => { applyRoleDefaults(value as UserRole) }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin — full workspace control</SelectItem>
                  <SelectItem value="member">Member — standard access</SelectItem>
                  <SelectItem value="viewer">Viewer — read-only</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Tool Access</Label>
                <button
                  type="button"
                  className="text-xs text-primary hover:underline"
                  onClick={() => setNewUserToolAccess(newUserToolAccess === null ? [] : null)}
                >
                  {newUserToolAccess === null ? 'Restrict tools' : 'Grant all tools'}
                </button>
              </div>
              {newUserToolAccess !== null && (
                <div className="grid grid-cols-2 gap-1.5 p-3 bg-muted rounded-lg">
                  {TOOL_KEYS.map(({ key, label }) => (
                    <label key={key} className="flex items-center gap-2 text-sm cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={newUserToolAccess.includes(key)}
                        onChange={(e) => {
                          if (e.target.checked) setNewUserToolAccess(prev => [...(prev ?? []), key])
                          else setNewUserToolAccess(prev => (prev ?? []).filter(k => k !== key))
                        }}
                        className="rounded"
                      />
                      {label}
                    </label>
                  ))}
                </div>
              )}
              {newUserToolAccess === null && <p className="text-xs text-muted-foreground">User will have access to all tools.</p>}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setOpen(false); resetForm() }}>Cancel</Button>
            <Button onClick={handleCreateDirectMember} disabled={!newUserName || !newUserUsername || newUserTempPassword.length < 8}>
              <UserPlus size={16} />
              {selectedMemberTemplateId ? 'Add from Template' : 'Add Member'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Credentials dialog shown after member is created */}
      <Dialog open={!!pendingDirectUser} onOpenChange={() => setPendingDirectUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Member Created</DialogTitle>
            <DialogDescription>
              Share these credentials with <strong>{pendingDirectUser?.name}</strong> securely.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="p-3 bg-muted rounded-lg space-y-2 font-mono text-sm">
              <div><span className="text-muted-foreground">Username: </span><strong>{pendingDirectUser?.username}</strong></div>
              <div><span className="text-muted-foreground">Temp password: </span><strong>{pendingDirectUser?.temporaryPassword}</strong></div>
            </div>
            <p className="text-xs text-muted-foreground">⚠️ This is the only time this password is shown. Copy it now.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              navigator.clipboard.writeText(`Username: ${pendingDirectUser?.username}\nPassword: ${pendingDirectUser?.temporaryPassword}`)
              toast.success('Copied to clipboard')
            }}>Copy credentials</Button>
            <Button onClick={() => setPendingDirectUser(null)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
