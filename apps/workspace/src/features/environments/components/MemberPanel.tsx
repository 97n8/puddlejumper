import { Button } from '@/components/ui/button'
import { UserPlus } from '@phosphor-icons/react'
import type { EnvironmentMember, UserRole } from '../types/environment'

const ROLE_LABELS: Record<UserRole, string> = {
  superadmin: 'Super Admin',
  implementer: 'Implementer',
  'tenant-admin': 'Admin',
  'tenant-operator': 'Operator',
  viewer: 'Viewer',
}

function canInvite(role?: UserRole): boolean {
  return role === 'superadmin' || role === 'implementer' || role === 'tenant-admin'
}

interface MemberPanelProps {
  members: EnvironmentMember[]
  currentUserRole?: UserRole
  onInvite?: () => void
}

export function MemberPanel({ members, currentUserRole, onInvite }: MemberPanelProps) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          Members
        </p>
        {canInvite(currentUserRole) && (
          <Button size="sm" variant="ghost" className="h-7 gap-1 text-xs" onClick={onInvite}>
            <UserPlus size={14} />
            Invite
          </Button>
        )}
      </div>
      {members.length === 0 ? (
        <p className="text-sm text-muted-foreground italic">No members yet</p>
      ) : (
        <ul className="space-y-2">
          {members.map(m => (
            <li key={m.id} className="flex items-center gap-2 text-sm">
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-semibold shrink-0"
                style={{ backgroundColor: '#627DBD' }}
              >
                {m.name.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{m.name}</p>
                <p className="text-xs text-muted-foreground truncate">{m.email}</p>
              </div>
              <span className="text-xs text-muted-foreground shrink-0">
                {ROLE_LABELS[m.role] ?? m.role}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
