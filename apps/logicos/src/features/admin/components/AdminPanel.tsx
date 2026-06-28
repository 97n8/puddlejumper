import { useState, useEffect, useCallback } from 'react'
import { useKV } from '@/hooks/useKV'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { 
  Users,
  Shield,
  ChartBar,
  FileText,
  Envelope,
  Crown,
  Lock,
  Lightning,
  CloudArrowUp,
  ArrowClockwise,
  BookOpen,
  Megaphone,
  Heartbeat,
  Buildings,
} from '@phosphor-icons/react'
import { toast } from 'sonner'
import { WorkspaceUser, UserRole, UserStatus, WorkspaceInvite } from '@/lib/types'
import { AzureSetupPanel } from './AzureSetupPanel'
import { PJHealthPanel } from './PJHealthPanel'
import { SealPanel } from './SealPanel'
import { useAuth } from '@/services/auth/AuthContext'
import { pjApi, type DemoMemberTemplate } from '@/services/pjApi'

import { AuditTrailPanel } from '@/features/audit/components/AuditTrailPanel'
import { UsersTab } from './UsersTab'
import { AnalyticsTab } from './AnalyticsTab'
import { PlanTab } from './PlanTab'
import { GuideTab } from './GuideTab'
import { FeaturesTab } from './FeaturesTab'
import { TenantProvisioningPanel } from './TenantProvisioningPanel'
import { AddMemberDialog } from './AddMemberDialog'

import { ResetPasswordDialog } from './ResetPasswordDialog'

const FALLBACK_DEMO_MEMBER_PRESETS: DemoMemberTemplate[] = [
  {
    id: 'sutton-manager',
    label: 'Sutton Town Manager',
    description: 'AC3 / Sutton-restricted town demo user',
    name: 'Sutton Town Manager',
    username: 'AC3',
    email: 'town.manager@logicville.example.gov',
    role: 'member',
    toolAccess: ['casespaces', 'vault'],
    mustChangePassword: false,
  },
  {
    id: 'n8-demo',
    label: 'N8 Demo Operator',
    description: 'Fast internal demo/admin account',
    name: 'N8 Demo Operator',
    username: 'N8',
    email: 'nboudreauma@gmail.com',
    role: 'admin',
    toolAccess: null,
    mustChangePassword: false,
  },
]

export function AdminPanel({ defaultTab = 'users' }: { defaultTab?: string }) {
  const { user: authUser } = useAuth()
  const [users, setUsers] = useKV<WorkspaceUser[]>('logicworkspace-users', [])
  const [invites, setInvites] = useKV<WorkspaceInvite[]>('logicworkspace-invites', [])

  const currentUsers = users || []
  const currentInvites = invites || []

  // Live data from PuddleJumper
  const [pjSyncing, setPjSyncing] = useState(false)
  const [workspaceUsage, setWorkspaceUsage] = useState<{
    plan: string;
    limits: Record<string, number>;
    usage: Record<string, number>;
    at_limit: boolean;
  } | null>(null)
  const [memberTemplates, setMemberTemplates] = useState<DemoMemberTemplate[]>(FALLBACK_DEMO_MEMBER_PRESETS)
  const [resetPasswordUserId, setResetPasswordUserId] = useState<string | null>(null)

  // Load workspace members and invitations from PuddleJumper
  const syncFromPJ = useCallback(async () => {
    if (!authUser) return
    setPjSyncing(true)
    try {
      const canReadAdminMembers = authUser.role === 'admin' || authUser.role === 'owner'
      const [membersRes, invitesRes, templatesRes] = await Promise.allSettled([
        canReadAdminMembers ? pjApi.admin.listMembers() : pjApi.workspace.listMembers(),
        pjApi.workspace.listInvitations(),
        canReadAdminMembers ? pjApi.admin.listMemberTemplates() : Promise.resolve({ success: false, data: [] as DemoMemberTemplate[] }),
      ])

      if (membersRes.status === 'fulfilled' && membersRes.value?.success) {
        const pjMembers = membersRes.value.data
        setUsers((existing) => {
          const cache = existing || []
          return pjMembers.map((m) => {
            const memberId = 'userId' in m ? m.userId : m.user_id
            const cached = cache.find(u => u.id === memberId)
            const isOwner = memberId === authUser.sub
            const serverToolAccess: string[] | undefined =
              'toolAccess' in m
                ? (m.toolAccess ?? undefined)
                : (m.tool_access ? JSON.parse(m.tool_access) : undefined)
            const serverName =
              'name' in m && typeof m.name === 'string'
                ? m.name
                : undefined
            const serverEmail =
              'email' in m && typeof m.email === 'string'
                ? m.email
                : undefined

            return {
              id: memberId,
              name: isOwner
                ? (authUser.name || authUser.email || memberId)
                : (serverName || cached?.name || memberId),
              email: isOwner
                ? (authUser.email || '')
                : (serverEmail || cached?.email || ''),
              role: m.role as UserRole,
              status: 'active' as UserStatus,
              addedAt: cached?.addedAt || new Date(('joinedAt' in m ? m.joinedAt : m.joined_at)).getTime(),
              lastActive: isOwner ? Date.now() : cached?.lastActive,
              permissions: {
                ...(cached?.permissions || getRolePermissions(m.role as UserRole)),
                ...(serverToolAccess !== undefined ? { toolAccess: serverToolAccess } : {}),
              },
            }
          })
        })
      } else if (!users || (users || []).length === 0) {
        // Fallback: seed owner from auth session
        const ownerUser: WorkspaceUser = {
          id: authUser.sub,
          name: authUser.name || authUser.email || authUser.sub,
          email: authUser.email || '',
          role: 'owner',
          status: 'active',
          addedAt: Date.now(),
          lastActive: Date.now(),
          permissions: getRolePermissions('owner'),
        }
        setUsers([ownerUser])
      }

      if (invitesRes.status === 'fulfilled' && invitesRes.value?.success) {
        const pjInvites = invitesRes.value.data
        setInvites(pjInvites.map((inv) => ({
          id: inv.id,
          email: inv.email,
          role: inv.role as UserRole,
          invitedBy: inv.invited_by,
          invitedAt: new Date(inv.created_at).getTime(),
          expiresAt: new Date(inv.expires_at).getTime(),
          status: 'pending' as const,
        })))
      }
      if (templatesRes.status === 'fulfilled' && templatesRes.value?.success && templatesRes.value.data.length > 0) {
        setMemberTemplates(templatesRes.value.data)
      }
    } catch {
      // PJ unreachable — fall back to local cache silently
    } finally {
      setPjSyncing(false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authUser])

  useEffect(() => { syncFromPJ() }, [syncFromPJ])

  // Load workspace usage (plan + limits) from PJ
  useEffect(() => {
    if (!authUser) return
    pjApi.workspace.usage()
      .then((res) => { if (res.success) setWorkspaceUsage(res.data) })
      .catch((err: unknown) => { console.error('[admin] failed to load workspace usage:', err) })
  }, [authUser])

  // Load real audit events from PJ

  const isOwnerOrAdmin = authUser?.role === 'admin' || authUser?.role === 'owner' ||
    currentUsers.find(u => u.email === authUser?.email)?.role === 'admin' ||
    currentUsers.find(u => u.email === authUser?.email)?.role === 'owner'

  const getRolePermissions = (role: UserRole) => {
    switch (role) {
      case 'owner':
        return {
          canManageUsers: true,
          canManageSettings: true,
          canManageConnections: true,
          canDeleteFiles: true,
          canCreateAutomations: true,
          canAccessCaseSpaces: true,
        }
      case 'admin':
        return {
          canManageUsers: true,
          canManageSettings: true,
          canManageConnections: true,
          canDeleteFiles: true,
          canCreateAutomations: true,
          canAccessCaseSpaces: true,
        }
      case 'member':
        return {
          canManageUsers: false,
          canManageSettings: false,
          canManageConnections: true,
          canDeleteFiles: true,
          canCreateAutomations: true,
          canAccessCaseSpaces: true,
        }
      case 'viewer':
        return {
          canManageUsers: false,
          canManageSettings: false,
          canManageConnections: false,
          canDeleteFiles: false,
          canCreateAutomations: false,
          canAccessCaseSpaces: true,
        }
    }
  }

  const handleUpdateUserRole = async (userId: string, newRole: UserRole) => {
    // Update in PJ first, then reflect locally
    try {
      await pjApi.workspace.updateMemberRole(userId, newRole as 'admin' | 'member' | 'viewer')
    } catch {
      toast.error('Could not update role in PuddleJumper')
      return
    }
    setUsers((current) =>
      (current || []).map((u) =>
        u.id === userId
          ? { ...u, role: newRole, permissions: getRolePermissions(newRole) }
          : u
      )
    )


    toast.success('User role updated')
  }

  const handleSuspendUser = (userId: string) => {
    setUsers((current) =>
      (current || []).map((u) =>
        u.id === userId ? { ...u, status: 'suspended' as UserStatus } : u
      )
    )


    toast.success('User suspended')
  }

  const handleRemoveUser = async (userId: string) => {
    const user = currentUsers.find(u => u.id === userId)
    if (user?.role === 'owner') {
      toast.error('Cannot remove the workspace owner')
      return
    }

    if (confirm('Are you sure you want to remove this user?')) {
      try {
        await pjApi.workspace.removeMember(userId)
      } catch {
        toast.error('Could not remove member in PuddleJumper')
        return
      }
      setUsers((current) => (current || []).filter((u) => u.id !== userId))


      toast.success('User removed')
    }
  }

  const TOOL_KEYS = [
    { key: 'vault', label: 'Files & Docs' },
    { key: 'formkey', label: 'FormKey' },
    { key: 'automations', label: 'Flows' },
    { key: 'builder', label: 'Module Builder' },
    { key: 'civicpulse', label: 'CivicPulse™' },
    { key: 'casespaces', label: 'CaseSpaces' },
    { key: 'puddles', label: 'Puddles' },
  ]

  const handleUpdateToolAccess = async (userId: string, toolKey: string, enabled: boolean) => {
    // Compute new access list
    const user = (currentUsers || []).find(u => u.id === userId)
    const currentAccess = user?.permissions?.toolAccess ?? TOOL_KEYS.map(t => t.key)
    const newAccess = enabled
      ? [...new Set([...currentAccess, toolKey])]
      : currentAccess.filter(k => k !== toolKey)

    // Optimistic local update
    setUsers((current) =>
      (current || []).map((u) => {
        if (u.id !== userId) return u
        return { ...u, permissions: { ...u.permissions!, toolAccess: newAccess } }
      })
    )

    // Persist to PuddleJumper
    try {
      const res = await pjApi.workspace.updateMemberToolAccess(userId, newAccess)
      if (!res.success) throw new Error('PJ rejected update')
    } catch {
      toast.error('Failed to save tool access — changes may not persist')
      // Rollback local state
      setUsers((current) =>
        (current || []).map((u) => {
          if (u.id !== userId) return u
          return { ...u, permissions: { ...u.permissions!, toolAccess: currentAccess } }
        })
      )
    }
  }

  const stats = {
    totalUsers: workspaceUsage?.usage?.members ?? currentUsers.filter(u => u.status === 'active').length,
    pendingInvites: currentInvites.filter(i => i.status === 'pending').length,
    plan: workspaceUsage?.plan ?? 'free',
  }

  if (!isOwnerOrAdmin) {
    return (
      <div className="flex-1 flex items-center justify-center bg-background">
        <Card className="max-w-md">
          <CardHeader>
            <div className="flex items-center gap-3 mb-2">
              <Lock size={24} className="text-muted-foreground" />
              <CardTitle>Access Restricted</CardTitle>
            </div>
            <CardDescription>
              You don't have permission to access the admin panel. Only workspace owners and
              administrators can manage users and settings.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }

  return (
    <div className="flex-1 flex overflow-hidden bg-background">
      <Tabs defaultValue={defaultTab} className="flex-1 flex flex-col overflow-hidden">
        <div className="border-b border-border px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="font-display font-semibold text-2xl mb-1">Admin Panel</h1>
              <p className="text-sm text-muted-foreground">
                Team management, system settings, and workspace oversight
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={syncFromPJ} disabled={pjSyncing}>
                <ArrowClockwise size={16} className={pjSyncing ? 'animate-spin' : ''} />
                {pjSyncing ? 'Syncing…' : 'Sync PJ'}
              </Button>
              <AddMemberDialog memberTemplates={memberTemplates} onSuccess={syncFromPJ} />
              <ResetPasswordDialog userId={resetPasswordUserId} onClose={() => setResetPasswordUserId(null)} />
            </div>
          </div>

          <div className="flex gap-4 mt-4">
            <Card className="flex-1">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Total Users</p>
                    <p className="text-3xl font-display font-semibold">{stats.totalUsers}</p>
                  </div>
                  <Users size={32} className="text-primary" weight="duotone" />
                </div>
              </CardContent>
            </Card>
            <Card className="flex-1">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Pending Invites</p>
                    <p className="text-3xl font-display font-semibold">{stats.pendingInvites}</p>
                  </div>
                  <Envelope size={32} className="text-accent" weight="duotone" />
                </div>
              </CardContent>
            </Card>
            <Card className="flex-1">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Plan</p>
                    <p className="text-3xl font-display font-semibold capitalize">{stats.plan}</p>
                  </div>
                  <Lightning size={32} className="text-green-500" weight="duotone" />
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        <div className="flex flex-col md:flex-row flex-1 overflow-hidden">
          <div className="w-full md:w-64 md:border-r border-b md:border-b-0 border-border bg-card shrink-0">
            <ScrollArea className="h-full">
              <TabsList className="flex flex-row overflow-x-auto md:flex-col md:items-stretch bg-transparent p-2 h-auto md:space-y-1 gap-0.5 md:gap-0">
                <TabsTrigger
                  value="users"
                  className="shrink-0 md:justify-start gap-2 md:gap-3 data-[state=active]:bg-primary/10 data-[state=active]:text-primary text-xs md:text-sm"
                >
                  <Users size={16} />
                  <span>Team</span>
                </TabsTrigger>
                <TabsTrigger
                  value="audit"
                  className="shrink-0 md:justify-start gap-2 md:gap-3 data-[state=active]:bg-primary/10 data-[state=active]:text-primary text-xs md:text-sm"
                >
                  <FileText size={16} />
                  <span>Audit</span>
                </TabsTrigger>
                <TabsTrigger
                  value="analytics"
                  className="shrink-0 md:justify-start gap-2 md:gap-3 data-[state=active]:bg-primary/10 data-[state=active]:text-primary text-xs md:text-sm"
                >
                  <ChartBar size={16} />
                  <span className="hidden sm:inline">Analytics</span>
                  <span className="sm:hidden">Stats</span>
                </TabsTrigger>
                <TabsTrigger
                  value="azure"
                  className="shrink-0 md:justify-start gap-2 md:gap-3 data-[state=active]:bg-primary/10 data-[state=active]:text-primary text-xs md:text-sm"
                >
                  <CloudArrowUp size={16} />
                  <span>Microsoft setup</span>
                </TabsTrigger>
                <TabsTrigger
                  value="plan"
                  className="shrink-0 md:justify-start gap-2 md:gap-3 data-[state=active]:bg-primary/10 data-[state=active]:text-primary text-xs md:text-sm"
                >
                  <Crown size={16} />
                  <span>Workspace</span>
                </TabsTrigger>
                <TabsTrigger
                  value="guide"
                  className="shrink-0 md:justify-start gap-2 md:gap-3 data-[state=active]:bg-primary/10 data-[state=active]:text-primary text-xs md:text-sm"
                >
                  <BookOpen size={16} />
                  <span>Admin guide</span>
                </TabsTrigger>
                <div className="hidden md:block h-px bg-border my-1" />
                <TabsTrigger
                  value="features"
                  className="shrink-0 md:justify-start gap-2 md:gap-3 data-[state=active]:bg-primary/10 data-[state=active]:text-primary text-xs md:text-sm"
                >
                  <Megaphone size={16} />
                  <span>Feature flags</span>
                </TabsTrigger>
                <TabsTrigger
                  value="health"
                  className="shrink-0 md:justify-start gap-2 md:gap-3 data-[state=active]:bg-primary/10 data-[state=active]:text-primary text-xs md:text-sm"
                >
                  <Heartbeat size={16} />
                  <span>System health</span>
                </TabsTrigger>
                <TabsTrigger
                  value="tenants"
                  className="shrink-0 md:justify-start gap-2 md:gap-3 data-[state=active]:bg-primary/10 data-[state=active]:text-primary text-xs md:text-sm"
                >
                  <Buildings size={16} />
                  <span>Tenants</span>
                </TabsTrigger>
                <TabsTrigger
                  value="seal"
                  className="shrink-0 md:justify-start gap-2 md:gap-3 data-[state=active]:bg-primary/10 data-[state=active]:text-primary text-xs md:text-sm"
                >
                  <Shield size={16} />
                  <span>SEAL</span>
                </TabsTrigger>
              </TabsList>
            </ScrollArea>
          </div>

          <div className="flex-1 overflow-hidden">
            <ScrollArea className="h-full">
              <div className="p-6">
                <div className="mb-6 rounded-2xl border bg-card/80 px-4 py-3">
                  <p className="text-sm font-semibold text-foreground">Start here</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Most admins mainly use <span className="font-medium text-foreground">Team</span> to manage people,
                    <span className="font-medium text-foreground"> Workspace</span> to review limits,
                    and <span className="font-medium text-foreground"> System health</span> when something looks wrong.
                  </p>
                </div>

                <TabsContent value="users" className="mt-0 space-y-4">
                  <UsersTab
                    currentUsers={currentUsers}
                    toolKeys={TOOL_KEYS}
                    onUpdateRole={handleUpdateUserRole}
                    onSuspend={handleSuspendUser}
                    onRemove={handleRemoveUser}
                    onUpdateToolAccess={handleUpdateToolAccess}
                    onResetPassword={(userId) => { setResetPasswordUserId(userId) }}
                  />
                </TabsContent>

                <TabsContent value="audit" className="mt-0">
                  <AuditTrailPanel />
                </TabsContent>

                <TabsContent value="analytics" className="mt-0 space-y-4">
                  <AnalyticsTab />
                </TabsContent>

                <TabsContent value="azure" className="mt-0">
                  <AzureSetupPanel />
                </TabsContent>

                <TabsContent value="plan" className="mt-0 space-y-4">
                  <PlanTab workspaceUsage={workspaceUsage} authUser={authUser} />
                </TabsContent>

                <TabsContent value="guide" className="mt-0 space-y-6">
                  <GuideTab />
                </TabsContent>

                {/* ── FEATURES ─────────────────────────────────── */}
                <TabsContent value="features" className="mt-0 space-y-6">
                  <FeaturesTab />
                </TabsContent>

                <TabsContent value="health" className="mt-0">
                  <PJHealthPanel />
                </TabsContent>

                <TabsContent value="tenants" className="mt-0">
                  <TenantProvisioningPanel />
                </TabsContent>

                <TabsContent value="seal" className="mt-0">
                  <SealPanel />
                </TabsContent>
              </div>
            </ScrollArea>
          </div>
        </div>
      </Tabs>
    </div>
  )
}
