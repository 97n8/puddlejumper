import { type ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ArrowLeft, Users, Gear, SignOut, IdentificationCard } from '@phosphor-icons/react'
import type { CaseSpace } from '@/lib/types'
import type { UserRole } from '../types/environment'

const CAN_EDIT_ROLES: UserRole[] = ['superadmin', 'implementer', 'tenant-admin']

function canEdit(role?: UserRole): boolean {
  return !role || CAN_EDIT_ROLES.includes(role)
}

interface WorkspaceHeaderProps {
  environment: CaseSpace
  userRole?: UserRole
  onBack: () => void
  onMembers: () => void
  onSettings: () => void
  demoLocked?: boolean
  onSignOut?: () => void
  meta?: ReactNode
  minimal?: boolean
  onConstituents?: () => void
  constituentActive?: boolean
}

export function WorkspaceHeader({
  environment,
  userRole,
  onBack,
  onMembers,
  onSettings,
  demoLocked = false,
  onSignOut,
  meta,
  minimal = false,
  onConstituents,
  constituentActive = false,
}: WorkspaceHeaderProps) {
  return (
    <div className={`flex items-center gap-3 border-b bg-background shrink-0 ${minimal ? 'px-4 py-2' : 'px-4 py-3'}`}>
      {demoLocked ? (
        <Badge variant="secondary" className="shrink-0 text-[10px] px-2 py-1 uppercase tracking-[0.16em]">
          Demo only
        </Badge>
      ) : !minimal ? (
        <>
          <Button variant="ghost" size="sm" className="gap-1.5 text-sm" onClick={onBack}>
            <ArrowLeft size={16} />
            Environments
          </Button>
          <div className="h-4 w-px bg-border" />
        </>
      ) : (
        <Button variant="ghost" size="sm" className="h-8 w-8 px-0" onClick={onBack} aria-label="Back to environments">
          <ArrowLeft size={15} />
        </Button>
      )}
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <span
          className={`${minimal ? 'w-2.5 h-2.5' : 'w-3 h-3'} rounded-full shrink-0`}
          style={{ backgroundColor: environment.color ?? '#627DBD' }}
        />
        <span className={`${minimal ? 'text-sm font-semibold' : 'font-semibold'} truncate`}>{environment.name}</span>
        {environment.type === 'vault' && (
          <Badge variant="secondary" className="text-[10px] px-1.5 py-0 uppercase tracking-wide shrink-0">
            VAULT
          </Badge>
        )}
        {meta}
      </div>
      {demoLocked ? (
        onSignOut ? (
          <Button variant="ghost" size="sm" className="gap-1.5 text-xs" onClick={onSignOut}>
            <SignOut size={15} />
            Sign out
          </Button>
        ) : null
      ) : !minimal ? (
        <div className="flex items-center gap-1">
          {onConstituents && (
            <Button
              variant={constituentActive ? 'secondary' : 'ghost'}
              size="sm"
              className="gap-1.5 text-xs"
              onClick={onConstituents}
              title="Constituent Management"
            >
              <IdentificationCard size={15} />
              <span className="hidden sm:inline">Constituents</span>
            </Button>
          )}
          <Button variant="ghost" size="sm" className="gap-1.5 text-xs" onClick={onMembers}>
            <Users size={15} />
            Members
          </Button>
          {canEdit(userRole) && (
            <Button variant="ghost" size="sm" className="gap-1.5 text-xs" onClick={onSettings}>
              <Gear size={15} />
              Settings
            </Button>
          )}
        </div>
      ) : (
        <div className="flex items-center gap-1">
          {onConstituents && (
            <Button
              variant={constituentActive ? 'secondary' : 'ghost'}
              size="sm"
              className="h-8 px-2.5 text-[11px]"
              onClick={onConstituents}
              title="Constituent Management"
            >
              <IdentificationCard size={14} />
            </Button>
          )}
          <Button variant="ghost" size="sm" className="h-8 px-2.5 text-[11px]" onClick={onMembers}>
            <Users size={14} />
          </Button>
          {canEdit(userRole) && (
            <Button variant="ghost" size="sm" className="h-8 px-2.5 text-[11px]" onClick={onSettings}>
              <Gear size={14} />
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
