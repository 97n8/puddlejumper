import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'
import { Users, Shield, Trash, Clock, Crown, Eye, Lightning } from '@phosphor-icons/react'
import { WorkspaceUser, UserRole, UserStatus } from '@/lib/types'

function getRoleIcon(role: UserRole) {
  switch (role) {
    case 'owner':
      return <Crown size={16} weight="fill" className="text-yellow-500" />
    case 'admin':
      return <Shield size={16} weight="fill" className="text-blue-500" />
    case 'member':
      return <Users size={16} weight="fill" className="text-green-500" />
    case 'viewer':
      return <Eye size={16} weight="fill" className="text-gray-500" />
  }
}

function getStatusBadge(status: UserStatus) {
  const variants = {
    active: 'default',
    invited: 'secondary',
    suspended: 'destructive',
  } as const
  return <Badge variant={variants[status]}>{status}</Badge>
}

interface UsersTabProps {
  currentUsers: WorkspaceUser[]
  toolKeys: { key: string; label: string }[]
  onUpdateRole: (userId: string, role: UserRole) => void
  onSuspend: (userId: string) => void
  onRemove: (userId: string) => void
  onUpdateToolAccess: (userId: string, toolKey: string, enabled: boolean) => void
  onResetPassword: (userId: string) => void
}

export function UsersTab({
  currentUsers,
  toolKeys,
  onUpdateRole,
  onSuspend,
  onRemove,
  onUpdateToolAccess,
  onResetPassword,
}: UsersTabProps) {
  return (
    <>
      {/* How to Add Members info card */}
      <div className="rounded-lg bg-muted/50 px-4 py-3 text-sm text-muted-foreground">
        <p className="font-medium text-foreground mb-1.5">Adding members</p>
        <ol className="list-decimal list-inside space-y-1">
           <li>Click <strong className="text-foreground">Add Member</strong> above</li>
           <li>Enter their name, username, and email if the demo depends on route allowlists</li>
           <li>Set a temporary password — share it with them securely</li>
          <li>Assign a role and optionally restrict which tools they can access</li>
          <li>On first login they'll be prompted to set a permanent password</li>
          <li>They then connect their own third-party accounts (GitHub, Google, Microsoft) from Settings → Connections</li>
         </ol>
       </div>
      <div className="grid gap-3 md:grid-cols-3">
        {[
          { role: 'Owner', desc: 'Full workspace control. Keep this role limited.' },
          { role: 'Admin', desc: 'Can manage staff, settings, and system configuration.' },
          { role: 'Staff / Viewer', desc: 'Use for daily work or read-only access.' },
        ].map(item => (
          <div key={item.role} className="rounded-lg border bg-card px-4 py-3">
            <div className="text-sm font-semibold text-foreground">{item.role}</div>
            <p className="mt-1 text-xs text-muted-foreground">{item.desc}</p>
          </div>
        ))}
      </div>
      {currentUsers.length === 0 && (
        <Card>
          <CardContent className="py-10 text-center">
            <p className="text-sm font-semibold text-foreground">No team members yet</p>
            <p className="mt-1 text-sm text-muted-foreground">Add your first staff account to start sharing work across the workspace.</p>
          </CardContent>
        </Card>
      )}
      {currentUsers.map((user) => (
        <Card key={user.id}>
          <CardContent className="pt-6">
            <div className="flex items-start justify-between">
              <div className="flex gap-4 flex-1">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold text-lg">
                  {user.avatarUrl ? (
                    <img src={user.avatarUrl} alt={user.name} className="w-full h-full rounded-full" />
                  ) : (
                    user.name.charAt(0).toUpperCase()
                  )}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold">{user.name}</h3>
                    {getRoleIcon(user.role)}
                    {getStatusBadge(user.status)}
                  </div>
                  <p className="text-sm text-muted-foreground mb-2">{user.email}</p>
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Clock size={14} />
                      Added {new Date(user.addedAt).toLocaleDateString()}
                    </div>
                    {user.lastActive && (
                      <div className="flex items-center gap-1">
                        <Lightning size={14} />
                        Active {new Date(user.lastActive).toLocaleDateString()}
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {user.role !== 'owner' && (
                  <>
                    <Select
                      value={user.role}
                      onValueChange={(value) => onUpdateRole(user.id, value as UserRole)}
                    >
                      <SelectTrigger className="w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="admin">Admin</SelectItem>
                        <SelectItem value="member">Member</SelectItem>
                        <SelectItem value="viewer">Viewer</SelectItem>
                      </SelectContent>
                    </Select>
                    {user.status === 'active' ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onSuspend(user.id)}
                      >
                        Suspend
                      </Button>
                    ) : null}
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => onRemove(user.id)}
                    >
                      <Trash size={16} />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onResetPassword(user.id)}
                      title="Reset password (local accounts only)"
                    >
                      Reset PW
                    </Button>
                  </>
                )}
              </div>
            </div>
            <Separator className="my-4" />
            <div>
              <p className="text-sm font-medium mb-2">Permissions</p>
              <div className="grid grid-cols-3 gap-2">
                {Object.entries(user.permissions || {}).filter(([key]) => key !== 'toolAccess').map(([key, value]) => (
                  <div
                    key={key}
                    className={`flex items-center gap-2 text-xs px-2 py-1 rounded ${
                      value ? 'bg-green-500/10 text-green-600' : 'bg-red-500/10 text-red-600'
                    }`}
                  >
                    {value ? '✓' : '✗'}
                    <span className="capitalize">
                      {key.replace(/^can/, '').replace(/([A-Z])/g, ' $1').trim()}
                    </span>
                  </div>
                ))}
              </div>
            </div>
            {user.role !== 'owner' && user.role !== 'admin' && (
              <div className="mt-4">
                <p className="text-sm font-medium mb-2">Tool Access</p>
                <div className="grid grid-cols-2 gap-2">
                  {toolKeys.map(({ key, label }) => {
                    const allowedTools = user.permissions?.toolAccess ?? toolKeys.map(t => t.key)
                    const enabled = allowedTools.includes(key)
                    return (
                      <div key={key} className="flex items-center justify-between px-3 py-2 border rounded-md text-sm">
                        <span>{label}</span>
                        <Switch
                          checked={enabled}
                          onCheckedChange={(v) => onUpdateToolAccess(user.id, key, v)}
                        />
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </>
  )
}
