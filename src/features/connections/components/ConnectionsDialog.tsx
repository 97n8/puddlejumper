import { useState, useEffect, useCallback } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { pjApi } from '@/services/pjApi'
import { useKV } from '@/hooks/useKV'
import {
  WindowsLogo, GoogleLogo, GithubLogo, ArrowClockwise, MagnifyingGlass, Check,
  CreditCard, DropboxLogo, Users, PlugsConnected, Envelope, HardDrives,
  X, Plus, CaretDown, Sliders, Globe,
} from '@phosphor-icons/react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

// ── Types ─────────────────────────────────────────────────────────────────────

interface ConnectorStatus {
  provider: string
  connected: boolean
  account?: string
  scopes?: string[]
}

interface Resource {
  id: string
  name: string
  type: string
  url: string | null
  provider: string
}

interface WorkspaceMember {
  id: string
  userId: string
  role: string
  toolAccess: string[] | null
  name: string
  email?: string
  username?: string
  joinedAt: string
  accountType?: 'local' | 'oauth'
}

interface PendingInvite {
  id: string
  email: string
  role: string
  expires_at?: string
}

interface ConnectionsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onManageConnection?: (provider: 'microsoft365' | 'google') => void
}

// ── Constants ─────────────────────────────────────────────────────────────────

const PROVIDERS = [
  {
    key: 'github' as const,
    label: 'GitHub',
    description: 'Repos, code, and file sync — commit documents back to your org.',
    icon: <GithubLogo size={18} weight="fill" />,
    pjKey: 'github',
    resourceLabel: 'repos',
    resourceQuery: '',
    hasResourcePicker: true,
    category: 'storage',
  },
  {
    key: 'microsoft' as const,
    label: 'Microsoft 365',
    description: 'OneDrive, SharePoint, Teams, and Outlook email.',
    icon: <WindowsLogo size={18} weight="fill" className="text-[#0078D4]" />,
    pjKey: 'microsoft',
    manageKey: 'microsoft365' as const,
    resourceLabel: 'sites',
    resourceQuery: '__sites__',
    hasResourcePicker: true,
    category: 'storage',
  },
  {
    key: 'google' as const,
    label: 'Google',
    description: 'Google Drive files, folders, and Gmail for sending.',
    icon: <GoogleLogo size={18} weight="fill" className="text-[#4285F4]" />,
    pjKey: 'google',
    manageKey: 'google' as const,
    resourceLabel: 'folders',
    resourceQuery: '',
    hasResourcePicker: false,
    category: 'storage',
  },
]

const COMING_SOON = [
  {
    key: 'civicplus',
    label: 'CivicPlus',
    description: 'Sync from CivicEngage CMS, 311 service requests, and permitting — available for towns using CivicPlus platforms.',
    icon: <Globe size={18} className="text-[#0065C2]" />,
  },
  {
    key: 'dropbox',
    label: 'Dropbox',
    description: 'Sync and share files via Dropbox.',
    icon: <DropboxLogo size={18} weight="fill" className="text-[#0061FF]" />,
  },
  {
    key: 'payment',
    label: 'Payment Gateway',
    description: 'Accept payments for permits, licenses, and services.',
    icon: <CreditCard size={18} weight="duotone" />,
  },
]

const TOOLS: { key: string; label: string }[] = [
  { key: 'logicdash',   label: 'LogicDASH' },
  { key: 'casespaces',  label: 'Case Spaces' },
  { key: 'vault',       label: 'Vault' },
  { key: 'automations', label: 'Flows' },
  { key: 'logicbridge', label: 'LogicBridge' },
  { key: 'civicpulse',  label: 'CivicPulse' },
  { key: 'syncronate',  label: 'Syncronate' },
  { key: 'intake',      label: 'Intake' },
  { key: 'evidence',    label: 'Evidence' },
  { key: 'govai',       label: 'GovAI' },
  { key: 'orgmanager',  label: 'Org Manager' },
  { key: 'audit',       label: 'Audit Log' },
]

const ROLE_META: Record<string, { label: string; color: string }> = {
  owner:  { label: 'Owner',  color: 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300' },
  admin:  { label: 'Admin',  color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300' },
  member: { label: 'Member', color: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300' },
  viewer: { label: 'Viewer', color: 'bg-muted text-muted-foreground' },
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function initials(name: string): string {
  return name.split(/\s+/).map(p => p[0] ?? '').join('').slice(0, 2).toUpperCase()
}

function RolePill({ role }: { role: string }) {
  const meta = ROLE_META[role] ?? { label: role, color: 'bg-muted text-muted-foreground' }
  return <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold', meta.color)}>{meta.label}</span>
}

// ── Main component ────────────────────────────────────────────────────────────

export function ConnectionsDialog({ open, onOpenChange, onManageConnection }: ConnectionsDialogProps) {
  const [tab, setTab] = useState<'connections' | 'members'>('connections')

  // ── Connections state ──
  const [connectors, setConnectors] = useState<Record<string, ConnectorStatus>>({})
  const [loading, setLoading] = useState(false)
  const [connecting, setConnecting] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [resources, setResources] = useState<Record<string, Resource[]>>({})
  const [resourceLoading, setResourceLoading] = useState<string | null>(null)
  const [searchQueries, setSearchQueries] = useState<Record<string, string>>({})
  const [confirmDisconnect, setConfirmDisconnect] = useState<string | null>(null)
  const [selectedRepos, setSelectedRepos] = useKV<Resource[]>('connector-selected-github-repos', [])
  const [selectedSites, setSelectedSites] = useKV<Resource[]>('connector-selected-ms-sites', [])

  // ── Members state ──
  const [members, setMembers] = useState<WorkspaceMember[]>([])
  const [invites, setInvites] = useState<PendingInvite[]>([])
  const [membersLoading, setMembersLoading] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<'admin' | 'member' | 'viewer'>('member')
  const [inviting, setInviting] = useState(false)
  const [updatingMember, setUpdatingMember] = useState<string | null>(null)
  const [toolPopover, setToolPopover] = useState<string | null>(null)
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null)

  // ── Load connectors ────────────────────────────────────────────────────────

  const loadConnectors = useCallback(() => {
    setLoading(true)
    pjApi.connectors.status()
      .then((d: unknown) => setConnectors(((d as Record<string, unknown>)?.connectors as Record<string, ConnectorStatus>) ?? {}))
      .catch(() => toast.error('Failed to load connections'))
      .finally(() => setLoading(false))
  }, [])

  // ── Load members ───────────────────────────────────────────────────────────

  const loadMembers = useCallback(() => {
    setMembersLoading(true)
    Promise.allSettled([
      pjApi.admin.listMembers(),
      pjApi.workspace.listInvitations(),
    ]).then(([membersRes, invitesRes]) => {
      if (membersRes.status === 'fulfilled') {
        setMembers((membersRes.value as { data?: WorkspaceMember[] }).data ?? [])
      }
      if (invitesRes.status === 'fulfilled') {
        setInvites((invitesRes.value as { data?: PendingInvite[] }).data ?? [])
      }
    }).finally(() => setMembersLoading(false))
  }, [])

  useEffect(() => {
    if (!open) return
    loadConnectors()
    loadMembers()
  }, [open, loadConnectors, loadMembers])

  // ── Connection actions ─────────────────────────────────────────────────────

  const fetchResources = (pjKey: string, query: string) => {
    setResourceLoading(pjKey)
    pjApi.connectors.resources(pjKey as 'github' | 'microsoft' | 'google', query)
      .then((d: unknown) => setResources(prev => ({ ...prev, [pjKey]: (d as Record<string, unknown>)?.results as Resource[] ?? [] })))
      .catch(() => toast.error('Failed to load resources'))
      .finally(() => setResourceLoading(null))
  }

  const handleConnect = (provider: 'github' | 'microsoft' | 'google') => {
    setConnecting(provider)
    pjApi.connectors.connect(provider).catch((e: unknown) => {
      toast.error((e as { message?: string })?.message ?? `Failed to connect ${provider}`)
      setConnecting(null)
    })
  }

  const handleDisconnect = (provider: 'github' | 'microsoft' | 'google') => {
    setConfirmDisconnect(null)
    pjApi.connectors.disconnect(provider)
      .then(() => { toast.success('Disconnected'); setExpanded(null); setResources(prev => { const n = { ...prev }; delete n[provider]; return n }); return pjApi.connectors.status() })
      .then((d: unknown) => setConnectors(((d as Record<string, unknown>)?.connectors as Record<string, ConnectorStatus>) ?? {}))
      .catch(() => toast.error('Failed to disconnect'))
  }

  const toggleExpanded = (pjKey: string, resourceQuery: string) => {
    if (expanded === pjKey) { setExpanded(null); return }
    setExpanded(pjKey)
    if (!resources[pjKey]) fetchResources(pjKey, resourceQuery)
  }

  const toggleSelection = (provider: string, resource: Resource) => {
    if (provider === 'github') {
      setSelectedRepos(prev => { const cur = prev ?? []; return cur.some(r => r.id === resource.id) ? cur.filter(r => r.id !== resource.id) : [...cur, resource] })
    } else if (provider === 'microsoft') {
      setSelectedSites(prev => { const cur = prev ?? []; return cur.some(s => s.id === resource.id) ? cur.filter(s => s.id !== resource.id) : [...cur, resource] })
    }
  }

  const isSelected = (provider: string, id: string) =>
    provider === 'github' ? (selectedRepos ?? []).some(r => r.id === id)
    : provider === 'microsoft' ? (selectedSites ?? []).some(s => s.id === id)
    : false

  const selCount = (pjKey: string) =>
    pjKey === 'github' ? (selectedRepos ?? []).length
    : pjKey === 'microsoft' ? (selectedSites ?? []).length
    : 0

  // ── Member actions ─────────────────────────────────────────────────────────

  const handleInvite = async () => {
    if (!inviteEmail.trim()) return
    setInviting(true)
    try {
      await pjApi.workspace.invite(inviteEmail.trim(), inviteRole)
      toast.success(`Invite sent to ${inviteEmail.trim()}`)
      setInviteEmail('')
      loadMembers()
    } catch {
      toast.error('Failed to send invite')
    } finally {
      setInviting(false)
    }
  }

  const handleRoleChange = async (userId: string, role: 'admin' | 'member' | 'viewer') => {
    setUpdatingMember(userId)
    try {
      await pjApi.admin.updateMemberRole(userId, role)
      setMembers(prev => prev.map(m => m.userId === userId ? { ...m, role } : m))
    } catch {
      toast.error('Failed to update role')
    } finally {
      setUpdatingMember(null)
    }
  }

  const handleToolAccessChange = async (userId: string, toolKey: string, checked: boolean) => {
    const member = members.find(m => m.userId === userId)
    if (!member) return
    const current = member.toolAccess ?? []
    const next = checked ? [...current, toolKey] : current.filter(t => t !== toolKey)
    const nextOrNull = next.length === 0 ? null : next
    setMembers(prev => prev.map(m => m.userId === userId ? { ...m, toolAccess: nextOrNull } : m))
    try {
      await pjApi.admin.updateMemberTools(userId, nextOrNull)
    } catch {
      toast.error('Failed to update tool access')
      loadMembers()
    }
  }

  const handleRemoveMember = async (userId: string) => {
    setConfirmRemove(null)
    try {
      await pjApi.admin.removeMember(userId)
      setMembers(prev => prev.filter(m => m.userId !== userId))
      toast.success('Member removed')
    } catch {
      toast.error('Failed to remove member')
    }
  }

  const handleRevokeInvite = async (id: string) => {
    try {
      await pjApi.workspace.revokeInvitation(id)
      setInvites(prev => prev.filter(i => i.id !== id))
      toast.success('Invite revoked')
    } catch {
      toast.error('Failed to revoke invite')
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[600px] p-0 gap-0 overflow-hidden max-h-[90vh] flex flex-col">

        {/* Header */}
        <DialogHeader className="px-5 pt-5 pb-0 shrink-0">
          <DialogTitle className="flex items-center justify-between text-base font-semibold">
            <span>Workspace</span>
            <button onClick={() => { loadConnectors(); loadMembers() }} aria-label="Refresh" className="text-muted-foreground hover:text-foreground transition-colors">
              <ArrowClockwise size={14} className={loading || membersLoading ? 'animate-spin' : ''} />
            </button>
          </DialogTitle>

          {/* Tab bar */}
          <div className="flex gap-0 mt-4 border-b">
            {([
              { id: 'connections', label: 'Connections', icon: <PlugsConnected size={13} /> },
              { id: 'members',     label: 'Members',     icon: <Users size={13} /> },
            ] as const).map(t => (
              <button key={t.id} onClick={() => setTab(t.id)}
                className={cn(
                  'flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors',
                  tab === t.id
                    ? 'border-primary text-foreground'
                    : 'border-transparent text-muted-foreground hover:text-foreground',
                )}>
                {t.icon}{t.label}
              </button>
            ))}
          </div>
        </DialogHeader>

        {/* Body */}
        <div className="flex-1 min-h-0 overflow-y-auto">

          {/* ── Connections tab ─────────────────────────────────────────── */}
          {tab === 'connections' && (
            <div>
              <div className="px-5 py-3">
                <div className="flex items-center gap-2 text-xs text-muted-foreground mb-3">
                  <HardDrives size={13} />
                  <span className="font-medium uppercase tracking-wide">Drives &amp; Email</span>
                </div>
                <div className="space-y-px rounded-xl border overflow-hidden">
                  {PROVIDERS.map(p => {
                    const status = connectors[p.pjKey]
                    const isConnected = status?.connected ?? false
                    const isExpanded = expanded === p.pjKey
                    const isConfirming = confirmDisconnect === p.pjKey
                    const providerResources = resources[p.pjKey] ?? []
                    const isLoadingResources = resourceLoading === p.pjKey
                    const count = selCount(p.pjKey)
                    const q = searchQueries[p.pjKey] ?? ''

                    return (
                      <div key={p.key} className="bg-card">
                        <div className="flex items-center gap-3 px-4 py-3.5">
                          <span className={cn('w-2 h-2 rounded-full flex-shrink-0 transition-colors', isConnected ? 'bg-green-500' : 'bg-muted-foreground/25')} />
                          <span className="flex-shrink-0 text-muted-foreground">{p.icon}</span>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium leading-none">{p.label}</div>
                            <div className="text-[11px] text-muted-foreground mt-0.5 truncate">{isConnected && status?.account ? status.account : p.description}</div>
                          </div>

                          {/* Actions */}
                          {isConnected ? (
                            <div className="flex items-center gap-2 flex-shrink-0">
                              {p.hasResourcePicker && (
                                <button onClick={() => toggleExpanded(p.pjKey, p.resourceQuery)}
                                  className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1">
                                  {count > 0 ? `${count} ${p.resourceLabel}` : 'Choose'}
                                  <CaretDown size={10} className={cn('transition-transform', isExpanded && 'rotate-180')} />
                                </button>
                              )}
                              {!p.hasResourcePicker && p.manageKey && onManageConnection && (
                                <button onClick={() => onManageConnection(p.manageKey!)} className="text-xs text-muted-foreground hover:text-foreground transition-colors">Manage</button>
                              )}
                              {isConfirming ? (
                                <span className="flex items-center gap-1.5 text-xs">
                                  <button onClick={() => setConfirmDisconnect(null)} className="text-muted-foreground hover:text-foreground">Cancel</button>
                                  <button onClick={() => handleDisconnect(p.pjKey as 'github' | 'microsoft' | 'google')} className="text-destructive font-medium hover:underline">Remove</button>
                                </span>
                              ) : (
                                <button onClick={() => setConfirmDisconnect(p.pjKey)} aria-label="Disconnect" className="text-muted-foreground/40 hover:text-muted-foreground transition-colors">
                                  <X size={13} />
                                </button>
                              )}
                            </div>
                          ) : (
                            <Button size="sm" variant="outline" className="h-7 text-xs px-3 flex-shrink-0"
                              disabled={connecting === p.pjKey}
                              onClick={() => handleConnect(p.pjKey as 'github' | 'microsoft' | 'google')}>
                              {connecting === p.pjKey ? '…' : 'Connect'}
                            </Button>
                          )}
                        </div>

                        {/* Resource picker drawer */}
                        {isConnected && isExpanded && p.hasResourcePicker && (
                          <div className="border-t bg-muted/30 px-4 py-3 space-y-2">
                            {p.pjKey !== 'microsoft' && (
                              <div className="flex gap-1.5">
                                <Input placeholder={`Search ${p.resourceLabel}…`} value={q}
                                  onChange={e => setSearchQueries(prev => ({ ...prev, [p.pjKey]: e.target.value }))}
                                  onKeyDown={e => e.key === 'Enter' && fetchResources(p.pjKey, q)}
                                  className="h-7 text-xs" />
                                <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => fetchResources(p.pjKey, q)} disabled={isLoadingResources}>
                                  <MagnifyingGlass size={12} />
                                </Button>
                              </div>
                            )}
                            {isLoadingResources ? (
                              <p className="text-xs text-muted-foreground py-1">Loading…</p>
                            ) : providerResources.length === 0 ? (
                              <p className="text-xs text-muted-foreground py-1">No {p.resourceLabel} found</p>
                            ) : (
                              <div className="space-y-0.5 max-h-36 overflow-y-auto [scrollbar-width:thin]">
                                {providerResources.map(r => (
                                  <button key={r.id} onClick={() => toggleSelection(p.pjKey, r)}
                                    className={cn('w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs text-left transition-colors', isSelected(p.pjKey, r.id) ? 'bg-primary/10 text-primary' : 'hover:bg-muted')}>
                                    <span className={cn('w-3.5 h-3.5 rounded border flex-shrink-0 flex items-center justify-center', isSelected(p.pjKey, r.id) ? 'bg-primary border-primary' : 'border-muted-foreground/30')}>
                                      {isSelected(p.pjKey, r.id) && <Check size={8} weight="bold" className="text-primary-foreground" />}
                                    </span>
                                    <span className="truncate">{r.name}</span>
                                  </button>
                                ))}
                              </div>
                            )}
                            {count > 0 && (
                              <div className="flex justify-between text-[11px] text-muted-foreground">
                                <span>{count} selected</span>
                                <button className="hover:text-foreground" onClick={() => { if (p.pjKey === 'github') setSelectedRepos([]); else if (p.pjKey === 'microsoft') setSelectedSites([]) }}>Clear all</button>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>

                {/* Coming soon */}
                <div className="mt-4 space-y-px rounded-xl border overflow-hidden opacity-60">
                  {COMING_SOON.map(p => (
                    <div key={p.key} className="flex items-center gap-3 px-4 py-3.5 bg-card">
                      <span className="w-2 h-2 rounded-full flex-shrink-0 bg-muted-foreground/25" />
                      <span className="flex-shrink-0 text-muted-foreground">{p.icon}</span>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium leading-none">{p.label}</div>
                        <div className="text-[11px] text-muted-foreground mt-0.5">{p.description}</div>
                      </div>
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 flex-shrink-0">Soon</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Email routing note */}
              <div className="px-5 pb-4">
                <div className="flex items-start gap-2 rounded-lg bg-muted/40 border px-3 py-2.5">
                  <Envelope size={13} className="text-muted-foreground mt-0.5 flex-shrink-0" />
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    <strong className="text-foreground font-medium">Email routing:</strong> Connect Microsoft 365 or Google to send emails directly from your account when cases trigger notifications, approvals, or document delivery.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* ── Members tab ─────────────────────────────────────────────── */}
          {tab === 'members' && (
            <div className="px-5 py-4 space-y-4">

              {/* Invite row */}
              <div>
                <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-2 flex items-center gap-1.5">
                  <Plus size={11} />
                  Invite someone
                </div>
                <div className="flex gap-2">
                  <Input
                    type="email"
                    placeholder="email@example.com"
                    value={inviteEmail}
                    onChange={e => setInviteEmail(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && void handleInvite()}
                    className="h-8 text-sm flex-1"
                  />
                  <Select value={inviteRole} onValueChange={v => setInviteRole(v as typeof inviteRole)}>
                    <SelectTrigger className="h-8 w-[110px] text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="admin">Admin</SelectItem>
                      <SelectItem value="member">Member</SelectItem>
                      <SelectItem value="viewer">Viewer</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button size="sm" className="h-8 px-3 text-xs" onClick={() => void handleInvite()} disabled={inviting || !inviteEmail.trim()}>
                    {inviting ? '…' : 'Invite'}
                  </Button>
                </div>

                {/* Role legend */}
                <div className="grid grid-cols-3 gap-1.5 mt-2">
                  {[
                    { role: 'admin',  desc: 'All tools' },
                    { role: 'member', desc: 'All or scoped' },
                    { role: 'viewer', desc: 'Read-only, scoped' },
                  ].map(r => (
                    <div key={r.role} className="flex items-center gap-1.5 rounded-lg bg-muted/30 border px-2 py-1.5">
                      <RolePill role={r.role} />
                      <span className="text-[10px] text-muted-foreground">{r.desc}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Member list */}
              <div>
                <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-2">
                  {members.length} member{members.length !== 1 ? 's' : ''}
                </div>

                {membersLoading ? (
                  <div className="flex items-center justify-center h-20 text-sm text-muted-foreground">Loading…</div>
                ) : members.length === 0 ? (
                  <div className="text-sm text-muted-foreground text-center py-6">No members found — you may not have admin access.</div>
                ) : (
                  <div className="space-y-px rounded-xl border overflow-hidden">
                    {members.map(m => {
                      const displayName = m.name || m.username || m.email || 'Unknown'
                      const isOwner = m.role === 'owner'
                      const needsToolPicker = m.role === 'member' || m.role === 'viewer'
                      const isConfirmingRemove = confirmRemove === m.userId
                      const toolCount = m.toolAccess?.length ?? null

                      return (
                        <div key={m.id} className="flex items-center gap-3 px-4 py-3 bg-card">
                          {/* Avatar */}
                          <div className="w-7 h-7 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[10px] font-bold flex-shrink-0">
                            {initials(displayName)}
                          </div>

                          {/* Info */}
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium leading-none truncate">{displayName}</div>
                            {m.email && m.name && <div className="text-[11px] text-muted-foreground mt-0.5 truncate">{m.email}</div>}
                          </div>

                          {/* Role pill / select */}
                          {isOwner ? (
                            <RolePill role="owner" />
                          ) : (
                            <Select
                              value={m.role}
                              onValueChange={v => void handleRoleChange(m.userId, v as 'admin' | 'member' | 'viewer')}
                              disabled={updatingMember === m.userId}
                            >
                              <SelectTrigger className="h-6 w-[90px] text-[11px] border-0 bg-transparent p-0 focus:ring-0 [&>span]:flex [&>span]:items-center">
                                <SelectValue>
                                  <RolePill role={m.role} />
                                </SelectValue>
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="admin">Admin</SelectItem>
                                <SelectItem value="member">Member</SelectItem>
                                <SelectItem value="viewer">Viewer</SelectItem>
                              </SelectContent>
                            </Select>
                          )}

                          {/* Tool access picker (member/viewer only) */}
                          {needsToolPicker && !isOwner && (
                            <Popover open={toolPopover === m.userId} onOpenChange={o => setToolPopover(o ? m.userId : null)}>
                              <PopoverTrigger asChild>
                                <button className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors flex-shrink-0">
                                  <Sliders size={12} />
                                  {toolCount === null ? 'All tools' : `${toolCount} tool${toolCount !== 1 ? 's' : ''}`}
                                </button>
                              </PopoverTrigger>
                              <PopoverContent align="end" className="w-[220px] p-3">
                                <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">Tool Access</div>
                                <div className="mb-2 flex gap-2 text-[11px]">
                                  <button className="text-primary hover:underline"
                                    onClick={() => {
                                      setMembers(prev => prev.map(x => x.userId === m.userId ? { ...x, toolAccess: null } : x))
                                      pjApi.admin.updateMemberTools(m.userId, null).catch(() => toast.error('Failed to update tool access'))
                                    }}>All tools</button>
                                  <span className="text-muted-foreground">·</span>
                                  <button className="text-muted-foreground hover:text-foreground"
                                    onClick={() => {
                                      setMembers(prev => prev.map(x => x.userId === m.userId ? { ...x, toolAccess: [] } : x))
                                      pjApi.admin.updateMemberTools(m.userId, []).catch(() => toast.error('Failed to update tool access'))
                                    }}>None</button>
                                </div>
                                <div className="space-y-1 max-h-52 overflow-y-auto [scrollbar-width:thin]">
                                  {TOOLS.map(t => {
                                    const hasAccess = m.toolAccess === null || m.toolAccess.includes(t.key)
                                    return (
                                      <label key={t.key} className="flex items-center gap-2 py-0.5 cursor-pointer">
                                        <input type="checkbox" checked={hasAccess}
                                          onChange={e => void handleToolAccessChange(m.userId, t.key, e.target.checked)}
                                          className="accent-primary w-3 h-3 flex-shrink-0" />
                                        <span className="text-xs">{t.label}</span>
                                      </label>
                                    )
                                  })}
                                </div>
                              </PopoverContent>
                            </Popover>
                          )}

                          {/* Remove */}
                          {!isOwner && (
                            isConfirmingRemove ? (
                              <span className="flex items-center gap-1.5 text-xs flex-shrink-0">
                                <button onClick={() => setConfirmRemove(null)} className="text-muted-foreground hover:text-foreground">Cancel</button>
                                <button onClick={() => void handleRemoveMember(m.userId)} className="text-destructive font-medium hover:underline">Remove</button>
                              </span>
                            ) : (
                              <button onClick={() => setConfirmRemove(m.userId)} aria-label="Remove member" className="text-muted-foreground/30 hover:text-muted-foreground transition-colors flex-shrink-0">
                                <X size={13} />
                              </button>
                            )
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* Pending invites */}
              {invites.length > 0 && (
                <div>
                  <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-2">Pending invites</div>
                  <div className="space-y-px rounded-xl border overflow-hidden">
                    {invites.map(inv => (
                      <div key={inv.id} className="flex items-center gap-3 px-4 py-2.5 bg-card">
                        <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                          <Envelope size={12} className="text-muted-foreground" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm truncate">{inv.email}</div>
                          <div className="text-[11px] text-muted-foreground">Invite pending</div>
                        </div>
                        <RolePill role={inv.role} />
                        <button onClick={() => void handleRevokeInvite(inv.id)} className="text-muted-foreground/30 hover:text-muted-foreground transition-colors flex-shrink-0">
                          <X size={13} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t flex justify-end shrink-0">
          <button onClick={() => onOpenChange(false)} className="text-xs text-muted-foreground hover:text-foreground transition-colors">Done</button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

interface ConnectorStatus {
  provider: string
  connected: boolean
  account?: string
  scopes?: string[]
  expiresAt?: string
}

interface Resource {
  id: string
  name: string
  type: string
  url: string | null
  provider: string
}
