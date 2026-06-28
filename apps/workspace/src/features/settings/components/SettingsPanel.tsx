import { useState, useEffect } from 'react'
import { useKV } from '@/hooks/useKV'
import { pjApi } from '@/services/pjApi'
import { useAuth } from '@/services/auth/AuthContext'
import { useShellColor } from '@/lib/colorContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Switch } from '@/components/ui/switch'
import { Separator } from '@/components/ui/separator'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Palette,
  Database,
  Download,
  Trash,
  Key,
  UserGear,
  CloudArrowUp,
  ArrowSquareOut,
  CheckCircle,
  XCircle,
  Spinner,
  Megaphone,
  BookOpen,
  ShieldCheck,
  Lightning,
  Wrench,
  FileLock,
  Globe,
  Folders,
  Lock,
  User,
  ChartBar,
} from '@phosphor-icons/react'
import { toast } from 'sonner'

const PJ_URL = import.meta.env.VITE_PJ_API_URL || 'https://api.publiclogic.org'

interface AppearanceSettings {
  theme: 'light' | 'dark' | 'system'
  compactMode: boolean
}

interface CivicPulseUserPrefs {
  notifyOnQueueEntry: boolean
  notifyOnBackstop: boolean
  defaultView: 'queue' | 'feed'
}

interface SettingsPanelProps {
  onNavigateToAdmin?: () => void
}

export function SettingsPanel({ onNavigateToAdmin }: SettingsPanelProps = {}) {
  const { user } = useAuth()
  const [appearanceSettings, setAppearanceSettings] = useKV<AppearanceSettings>(
    'logicworkspace-appearance',
    { theme: 'system', compactMode: false }
  )
  const current = appearanceSettings || { theme: 'system' as const, compactMode: false }
  const { shellColor, setShellColor } = useShellColor()

  const [civicPulsePrefs, setCivicPulsePrefs] = useKV<CivicPulseUserPrefs>(
    'civicpulse-user-prefs',
    { notifyOnQueueEntry: true, notifyOnBackstop: true, defaultView: 'queue' }
  )
  const prefs = civicPulsePrefs || { notifyOnQueueEntry: true, notifyOnBackstop: true, defaultView: 'queue' }
  const updatePref = (key: keyof CivicPulseUserPrefs, value: unknown) =>
    setCivicPulsePrefs(cur => ({ ...cur!, [key]: value }))


  const [connectorStatus, setConnectorStatus] = useState<Record<string, boolean>>({})
  const [connectorLoading, setConnectorLoading] = useState(true)

  // Load live connector status from PuddleJumper
  useEffect(() => {
    setConnectorLoading(true)
    pjApi.connectors.status()
      .then((data: unknown) => {
        const map: Record<string, boolean> = {}
        if (Array.isArray(data)) {
          (Array.isArray(data) ? data : []).forEach((c: Record<string,unknown>) => { map[c.provider as string] = !!c.connected })
        } else if (data && typeof data === 'object') {
          Object.entries(data).forEach(([k, v]: [string, any]) => { map[k] = !!v?.connected })
        }
        setConnectorStatus(map)
      })
      .catch((err: unknown) => { console.error('[settings] failed to load connector status:', err) })
      .finally(() => setConnectorLoading(false))
  }, [])

  const update = (key: keyof AppearanceSettings, value: unknown) => {
    setAppearanceSettings(cur => ({ ...cur!, [key]: value }))
  }

  const handleExportData = () => {
    const exportData: Record<string, any> = {}
    Object.keys(localStorage)
      .filter(k => k.startsWith('logicworkspace-') || k.startsWith('workspace-'))
      .forEach(k => {
        try { exportData[k] = JSON.parse(localStorage.getItem(k) ?? 'null') } catch { exportData[k] = null }
      })
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `workspace-export-${Date.now()}.json`
    a.click()
    URL.revokeObjectURL(url)
    toast.success('Data exported')
  }

  const handleClearAllData = () => {
    if (confirm('This will permanently delete all saved flows, apps, custom settings, and workspace data. This cannot be undone. Continue?')) {
      Object.keys(localStorage)
        .filter(k => k.startsWith('logicworkspace-') || k.startsWith('workspace-'))
        .forEach(k => localStorage.removeItem(k))
      toast.success('All data cleared')
      setTimeout(() => window.location.reload(), 1000)
    }
  }

  const storageKeys = Object.keys(localStorage).filter(k => k.startsWith('logicworkspace-') || k.startsWith('workspace-'))
  const storageBytes = storageKeys.reduce((acc, k) => acc + (localStorage.getItem(k)?.length ?? 0) * 2, 0)
  const storageFmt = storageBytes > 1024 ? `${(storageBytes / 1024).toFixed(1)} KB` : `${storageBytes} B`

  // Account / password change state (local accounts only)
  const [pwCurrent, setPwCurrent] = useState('')
  const [pwNew, setPwNew] = useState('')
  const [pwConfirm, setPwConfirm] = useState('')
  const [pwLoading, setPwLoading] = useState(false)

  const handleChangePassword = async () => {
    if (pwNew !== pwConfirm) { toast.error('New passwords do not match'); return }
    if (pwNew.length < 8) { toast.error('Password must be at least 8 characters'); return }
    setPwLoading(true)
    try {
      const res = await pjApi.auth.changePassword(pwCurrent, pwNew)
      if (res.ok) {
        toast.success('Password updated')
        setPwCurrent(''); setPwNew(''); setPwConfirm('')
      } else {
        toast.error(res.error ?? 'Failed to change password')
      }
    } catch {
      toast.error('Network error')
    } finally {
      setPwLoading(false)
    }
  }

  return (
    <div className="flex-1 flex overflow-hidden bg-background">
      <Tabs defaultValue="account" className="flex-1 flex flex-col overflow-hidden">
        <div className="border-b border-border px-6 py-4">
          <h1 className="font-display font-semibold text-2xl mb-1">Settings</h1>
          <p className="text-sm text-muted-foreground">Personal preferences, connected accounts, and help</p>
        </div>

        <div className="flex flex-col md:flex-row flex-1 overflow-hidden">
          <div className="w-full md:w-56 md:border-r border-b md:border-b-0 border-border bg-card shrink-0">
            <ScrollArea className="h-full">
              <TabsList className="flex flex-row overflow-x-auto md:flex-col md:items-stretch bg-transparent p-2 h-auto md:space-y-1 gap-0.5 md:gap-0">
                <TabsTrigger
                  value="account"
                  className="shrink-0 md:justify-start gap-2 md:gap-3 data-[state=active]:bg-primary/10 data-[state=active]:text-primary text-xs md:text-sm"
                >
                  <User size={16} />
                  Account
                </TabsTrigger>
                <TabsTrigger
                  value="appearance"
                  className="shrink-0 md:justify-start gap-2 md:gap-3 data-[state=active]:bg-primary/10 data-[state=active]:text-primary text-xs md:text-sm"
                >
                  <Palette size={16} />
                  Appearance
                </TabsTrigger>
                <TabsTrigger
                  value="connections"
                  className="shrink-0 md:justify-start gap-2 md:gap-3 data-[state=active]:bg-primary/10 data-[state=active]:text-primary text-xs md:text-sm"
                >
                  <CloudArrowUp size={16} />
                  <span className="hidden sm:inline">Connections</span>
                  <span className="sm:hidden">Connect</span>
                </TabsTrigger>
                <TabsTrigger
                  value="api"
                  className="shrink-0 md:justify-start gap-2 md:gap-3 data-[state=active]:bg-primary/10 data-[state=active]:text-primary text-xs md:text-sm"
                >
                  <Key size={16} />
                  <span className="hidden sm:inline">Developer API</span>
                  <span className="sm:hidden">API</span>
                </TabsTrigger>
                <TabsTrigger
                  value="data"
                  className="shrink-0 md:justify-start gap-2 md:gap-3 data-[state=active]:bg-primary/10 data-[state=active]:text-primary text-xs md:text-sm"
                >
                  <Database size={16} />
                  Data
                </TabsTrigger>
                <TabsTrigger
                  value="features"
                  className="shrink-0 md:justify-start gap-2 md:gap-3 data-[state=active]:bg-primary/10 data-[state=active]:text-primary text-xs md:text-sm"
                >
                  <Megaphone size={16} />
                  Features
                </TabsTrigger>
                <TabsTrigger
                  value="help"
                  className="shrink-0 md:justify-start gap-2 md:gap-3 data-[state=active]:bg-primary/10 data-[state=active]:text-primary text-xs md:text-sm"
                >
                  <BookOpen size={16} />
                  Guide
                </TabsTrigger>

                {onNavigateToAdmin && (
                  <>
                    <div className="hidden md:block h-px bg-border my-2" />
                    <button
                      onClick={onNavigateToAdmin}
                      className="shrink-0 flex items-center gap-2 md:gap-3 px-3 py-2 rounded-md text-xs md:text-sm hover:bg-muted transition-colors text-left group"
                    >
                      <UserGear size={16} className="text-rose-600" />
                      <span className="flex-1">Admin</span>
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0.5 opacity-60 group-hover:opacity-100 transition-opacity hidden md:inline-flex">
                        Admin
                      </Badge>
                    </button>
                  </>
                )}
              </TabsList>
            </ScrollArea>
          </div>

          <div className="flex-1 overflow-hidden">
            <ScrollArea className="h-full">
              <div className="p-6 max-w-2xl space-y-0">
                <div className="mb-6 rounded-2xl border bg-card/80 px-4 py-3">
                  <p className="text-sm font-semibold text-foreground">Most people only need three areas</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Use <span className="font-medium text-foreground">Account</span> for sign-in details,
                    <span className="font-medium text-foreground"> Connections</span> to link outside accounts,
                    and <span className="font-medium text-foreground">Guide</span> if you need a quick refresher.
                  </p>
                </div>

                {/* APPEARANCE */}
                {/* ACCOUNT */}
                <TabsContent value="account" className="mt-0 space-y-6">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <User size={18} weight="duotone" className="text-primary" />
                        Your account
                      </CardTitle>
                      <CardDescription>Identity and sign-in details</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Name</span>
                        <span className="font-medium">{user?.name ?? '—'}</span>
                      </div>
                      {user?.email && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Email</span>
                          <span className="font-medium">{user.email}</span>
                        </div>
                      )}
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Role</span>
                        <span className="font-medium capitalize">{user?.role ?? '—'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Sign-in method</span>
                        <span className="font-medium capitalize">{user?.provider ?? 'local account'}</span>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Password change — local accounts only */}
                  {(!user?.provider || user.provider === 'local') && (
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <Lock size={18} weight="duotone" className="text-primary" />
                          Change password
                        </CardTitle>
                        <CardDescription>Update your sign-in password</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="space-y-1.5">
                          <Label htmlFor="pw-current">Current password</Label>
                          <Input id="pw-current" type="password" value={pwCurrent} onChange={e => setPwCurrent(e.target.value)} />
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor="pw-new">New password</Label>
                          <Input id="pw-new" type="password" value={pwNew} onChange={e => setPwNew(e.target.value)} minLength={8} />
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor="pw-confirm">Confirm new password</Label>
                          <Input id="pw-confirm" type="password" value={pwConfirm} onChange={e => setPwConfirm(e.target.value)} minLength={8} />
                        </div>
                        <Button
                          onClick={handleChangePassword}
                          disabled={pwLoading || !pwCurrent || pwNew.length < 8 || pwNew !== pwConfirm}
                          className="w-full"
                        >
                          {pwLoading ? 'Saving…' : 'Update password'}
                        </Button>
                      </CardContent>
                    </Card>
                  )}

                  {user?.provider && user.provider !== 'local' && (
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base">Password</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-sm text-muted-foreground">
                          You signed in with <span className="font-medium capitalize">{user.provider}</span>. Manage your password through that provider.
                        </p>
                      </CardContent>
                    </Card>
                  )}
                </TabsContent>

                {/* APPEARANCE */}
                <TabsContent value="appearance" className="mt-0 space-y-6">
                  <Card>
                    <CardHeader>
                      <CardTitle>Appearance</CardTitle>
                      <CardDescription>Applied immediately — no save needed</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-5">
                      <div className="space-y-2">
                        <Label htmlFor="theme">Theme</Label>
                        <Select value={current.theme} onValueChange={(v) => update('theme', v)}>
                          <SelectTrigger id="theme">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="light">Light</SelectItem>
                            <SelectItem value="dark">Dark (Workspace Dark)</SelectItem>
                            <SelectItem value="system">System (follow OS)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <Separator />

                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <Label>Compact Mode</Label>
                          <p className="text-sm text-muted-foreground">
                            Reduce spacing and padding throughout the interface
                          </p>
                        </div>
                        <Switch
                          checked={current.compactMode}
                          onCheckedChange={(checked) => update('compactMode', checked)}
                        />
                      </div>

                      <Separator />

                      <div className="space-y-2">
                        <Label htmlFor="shell-color">Accent Color</Label>
                        <div className="flex items-center gap-3">
                          <input
                            id="shell-color"
                            type="color"
                            value={shellColor.startsWith('#') ? shellColor : '#10b981'}
                            onChange={(e) => setShellColor(e.target.value)}
                            className="h-9 w-16 rounded border border-border cursor-pointer p-1 bg-background"
                          />
                          <span className="text-sm text-muted-foreground font-mono truncate">{shellColor}</span>
                          <Button variant="outline" size="sm" onClick={() => setShellColor('oklch(0.65 0.18 155)')}>
                            Reset
                          </Button>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Primary accent color used throughout the shell
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* CONNECTIONS */}
                <TabsContent value="connections" className="mt-0 space-y-6">
                  <Card>
                    <CardHeader>
                      <CardTitle>Connected Providers</CardTitle>
                      <CardDescription>Link the outside accounts you want Workspace to use on your behalf</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {connectorLoading ? (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
                          <Spinner size={16} className="animate-spin" /> Loading connector status…
                        </div>
                      ) : (
                        <div className="space-y-4">
                          {(['microsoft', 'google', 'github'] as const).map((p) => (
                            <div key={p} className="flex items-center justify-between">
                              <span className="text-sm font-medium">
                                {p === 'microsoft' ? 'Microsoft 365' : p === 'github' ? 'GitHub' : 'Google'}
                              </span>
                              <div className="flex items-center gap-3">
                                {connectorStatus[p] ? (
                                  <>
                                    <span className="flex items-center gap-1.5 text-xs text-green-600 font-medium">
                                      <CheckCircle size={14} weight="fill" /> Connected
                                    </span>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="text-destructive hover:text-destructive"
                                      onClick={() =>
                                        pjApi.connectors.disconnect(p)
                                          .then(() => setConnectorStatus(prev => ({ ...prev, [p]: false })))
                                          .catch(() => toast.error('Failed to disconnect'))
                                      }
                                    >
                                      Disconnect
                                    </Button>
                                  </>
                                ) : (
                                  <>
                                    <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                      <XCircle size={14} /> Not connected
                                    </span>
                                    <Button size="sm" variant="outline" onClick={() => pjApi.connectors.connect(p)}>
                                      Connect
                                    </Button>
                                  </>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* API KEYS */}
                <TabsContent value="api" className="mt-0 space-y-6">
                  <Card>
                    <CardHeader>
                      <CardTitle>API Key Management</CardTitle>
                      <CardDescription>
                        Managed by PuddleJumper — keys are never stored in the browser
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <p className="text-sm text-muted-foreground">
                        API keys that authenticate against the PuddleJumper API are created and managed in the PJ Admin Panel.
                      </p>
                      <Button
                        className="w-full gap-2"
                        onClick={() => window.open(`${PJ_URL}/pj/admin`, '_blank', 'noopener,noreferrer')}
                      >
                        <Key size={16} weight="bold" />
                        Open PuddleJumper API Settings
                        <ArrowSquareOut size={14} />
                      </Button>
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* DATA */}
                <TabsContent value="data" className="mt-0 space-y-6">
                  <Card>
                    <CardHeader>
                      <CardTitle>Local Data</CardTitle>
                      <CardDescription>Export or clear browser-stored workspace data</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <Button onClick={handleExportData} className="w-full" variant="outline">
                        <Download size={16} weight="bold" />
                        Export All Data
                      </Button>
                      <Button onClick={handleClearAllData} className="w-full" variant="destructive">
                        <Trash size={16} weight="bold" />
                        Clear All Data
                      </Button>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>Storage</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Location</span>
                          <span className="font-medium">Browser localStorage</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Keys stored</span>
                          <span className="font-medium font-mono">{storageKeys.length}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Estimated size</span>
                          <span className="font-medium font-mono">{storageFmt}</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* FEATURES */}
                <TabsContent value="features" className="mt-0 space-y-6">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Megaphone size={18} weight="duotone" className="text-emerald-600" />
                        CivicPulse™
                      </CardTitle>
                      <CardDescription>Your notification and display preferences for the civic transparency engine</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-5">
                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <Label>Approval queue notifications</Label>
                          <p className="text-sm text-muted-foreground">Alert when a new summary enters the queue for your review</p>
                        </div>
                        <Switch
                          checked={prefs.notifyOnQueueEntry}
                          onCheckedChange={v => updatePref('notifyOnQueueEntry', v)}
                        />
                      </div>

                      <Separator />

                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <Label>Compliance backstop alerts</Label>
                          <p className="text-sm text-muted-foreground">Alert when an action is approaching or past its publication window</p>
                        </div>
                        <Switch
                          checked={prefs.notifyOnBackstop}
                          onCheckedChange={v => updatePref('notifyOnBackstop', v)}
                        />
                      </div>

                      <Separator />

                      <div className="space-y-2">
                        <Label>Default view when opening CivicPulse</Label>
                        <Select value={prefs.defaultView} onValueChange={v => updatePref('defaultView', v as 'queue' | 'feed')}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="queue">Approval Queue</SelectItem>
                            <SelectItem value="feed">Town Activity Feed</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* USER GUIDE */}
                <TabsContent value="help" className="mt-0 space-y-6">

                  {/* Getting Started */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <BookOpen size={18} weight="duotone" className="text-primary" />
                        Getting Started
                      </CardTitle>
                      <CardDescription>New to Workspace? Start here.</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <ol className="space-y-3 text-sm">
                        {[
                          { step: '1', text: <>If you were given a temporary password, <strong>you'll be asked to change it</strong> the first time you log in. Pick something you'll remember.</> },
                          { step: '2', text: <>Go to <strong>Settings → Connections</strong> to link your Google, Microsoft, or GitHub account. This lets the tools (like Flows and Vault) act on your behalf.</> },
                          { step: '3', text: <>Your admin controls which <strong>tools you can see and use</strong> — if something is missing, reach out to them.</> },
                          { step: '4', text: <>Use the <strong>left sidebar</strong> to switch between tools. Each one opens in its own panel — you can have multiple open at once.</> },
                        ].map(({ step, text }) => (
                          <li key={step} className="flex gap-3">
                            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center">{step}</span>
                            <span className="text-muted-foreground leading-relaxed">{text}</span>
                          </li>
                        ))}
                      </ol>
                    </CardContent>
                  </Card>

                  {/* Adding Members guide — visible to admins */}
                  {(user?.role === 'owner' || user?.role === 'admin') && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <UserGear size={18} weight="duotone" className="text-primary" />
                        Adding members
                      </CardTitle>
                      <CardDescription>How to set up access for your team</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <ol className="space-y-3 text-sm">
                        {[
                          { step: '1', text: <>Open <strong>Admin → Users</strong> and click <strong>Add Member</strong>.</> },
                          { step: '2', text: <>Enter the member's <strong>name</strong> and a <strong>username</strong> they'll use to log in.</> },
                          { step: '3', text: <>Set a <strong>temporary password</strong> — share it with them securely (in person or via a password manager). They'll change it on first login.</> },
                          { step: '4', text: <>Assign a <strong>role</strong>: Member (standard access), Admin (full control), or Viewer (read-only).</> },
                          { step: '5', text: <>Optionally restrict which <strong>tools</strong> they can see. Leave it open to grant access to everything.</> },
                          { step: '6', text: <>On first login they'll be prompted to set a <strong>permanent password</strong>. Then they connect their own third-party accounts (GitHub, Google, Microsoft) from <strong>Settings → Connections</strong>.</> },
                        ].map(({ step, text }) => (
                          <li key={step} className="flex gap-3">
                            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center">{step}</span>
                            <span className="text-muted-foreground leading-relaxed">{text}</span>
                          </li>
                        ))}
                      </ol>
                      {onNavigateToAdmin && (
                        <Button variant="outline" className="w-full mt-4 gap-2" onClick={onNavigateToAdmin}>
                          <UserGear size={16} />
                          Go to Admin Panel
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                  )}

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Tools at a Glance</CardTitle>
                      <CardDescription>Everything you can do in Workspace — click any tool in the sidebar to open it.</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4 text-sm">
                        {[
                          { icon: <Folders size={15} className="text-amber-500 shrink-0 mt-0.5" />, name: 'Environments', desc: 'Your home base. Every project, department, or org you manage lives here as its own environment — with its own apps, bots, modules, and settings.' },
                          { icon: <Wrench size={15} className="text-sky-500 shrink-0 mt-0.5" />, name: 'LogicDocs', desc: 'Write and design official documents — rich editor, templates, live canvas for HTML/CSS. Save to Vault, OneDrive, or Google Drive in one click.' },
                          { icon: <FileLock size={15} className="text-violet-500 shrink-0 mt-0.5" />, name: 'Vault', desc: 'Secure, governed file storage. Upload, categorize, and officially approve documents. Every version is saved — nothing is ever lost or overwritten without a record.' },
                          { icon: <ShieldCheck size={15} className="text-emerald-500 shrink-0 mt-0.5" />, name: 'SEAL', desc: 'Digitally sign and lock documents. Anyone can verify a SEAL-stamped document is authentic and untampered — even without a Workspace account.' },
                          { icon: <Lightning size={15} className="text-yellow-500 shrink-0 mt-0.5" />, name: 'Flows (Syncronate)', desc: 'Automate repetitive work without code. "When a file is approved in Vault, copy it to SharePoint and email the team." 100+ ready flows or build your own.' },
                          { icon: <Megaphone size={15} className="text-emerald-500 shrink-0 mt-0.5" />, name: 'Puddles', desc: 'Operator chat with live PuddleJumper tools. Ask about PRRs, governance, org status, procurement, or system health and get a tenant-scoped answer grounded in live platform data.' },
                          { icon: <FileLock size={15} className="text-rose-500 shrink-0 mt-0.5" />, name: 'FormKey', desc: 'Public-facing intake forms. Anyone can fill them out — no account needed. Submissions are automatically saved, time-stamped, and routed into Vault.' },
                          { icon: <Megaphone size={15} className="text-teal-500 shrink-0 mt-0.5" />, name: 'CivicPulse', desc: 'Turns approved records into plain-English summaries for the public. You review and approve every summary before it goes anywhere.' },
                          { icon: <Globe size={15} className="text-blue-500 shrink-0 mt-0.5" />, name: 'LogicBridge', desc: 'Connect Workspace to external software and APIs. Pull data in from legacy systems, push records out, or test live API calls. Built for IT and advanced users.' },
                          { icon: <Database size={15} className="text-orange-500 shrink-0 mt-0.5" />, name: 'Syncronate', desc: 'Keep records synchronized across connected systems automatically. Configure once, runs in the background.' },
                          { icon: <ChartBar size={15} className="text-emerald-500 shrink-0 mt-0.5" />, name: 'LogicDash', desc: 'Financial intelligence dashboard. Pull real data from authoritative sources, compare against peers, track trends, and get automatic risk flags.' },
                          { icon: <Wrench size={15} className="text-amber-500 shrink-0 mt-0.5" />, name: 'LogicBuilder', desc: 'Build custom apps, bots, and automated workflows by combining Workspace services. No code required for most things — code-friendly for the rest.' },
                          { icon: <ShieldCheck size={15} className="text-slate-500 shrink-0 mt-0.5" />, name: 'Module Builder', desc: 'Configure and publish governance modules for any industry or department — permitting, compliance, HR, grants. Each module defines the rules for that domain.' },
                          { icon: <Database size={15} className="text-rose-400 shrink-0 mt-0.5" />, name: 'Audit Trail', desc: 'A complete, independently verifiable log of every action in the system. See who did what, when, and from where.' },
                          { icon: <UserGear size={15} className="text-gray-500 shrink-0 mt-0.5" />, name: 'Admin', desc: 'Create users, reset passwords, assign tool access, and manage workspace settings. Visible to admins and owners only.' },
                        ].map(({ icon, name, desc }) => (
                          <div key={name} className="flex gap-3">
                            {icon}
                            <div>
                              <span className="font-medium">{name}</span>
                              <p className="text-muted-foreground mt-0.5 leading-relaxed">{desc}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Roles & Access</CardTitle>
                      <CardDescription>What each role can do — your admin assigns your role when they create your account.</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3 text-sm">
                        {[
                          { role: 'owner', color: 'text-rose-600', desc: 'Full control of everything — tools, users, settings. Cannot be removed from the workspace.' },
                          { role: 'admin', color: 'text-orange-600', desc: 'Can create and manage users, assign tools, and change settings. Same access as owner.' },
                          { role: 'member', color: 'text-green-600', desc: 'Standard user. Can use the tools your admin has assigned to you. Default role for most people.' },
                          { role: 'viewer', color: 'text-muted-foreground', desc: 'Can read and view content, but cannot upload, approve, or make changes.' },
                        ].map(({ role, color, desc }) => (
                          <div key={role} className="flex gap-3">
                            <span className={`font-mono font-semibold w-16 shrink-0 ${color}`}>{role}</span>
                            <span className="text-muted-foreground leading-relaxed">{desc}</span>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Connecting Your Accounts</CardTitle>
                      <CardDescription>Link Google, Microsoft, or GitHub so tools can act on your behalf.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3 text-sm text-muted-foreground">
                      <p>Go to <strong className="text-foreground">Settings → Connections</strong> to connect your accounts. Each tool only uses the accounts you've explicitly linked — nothing is shared automatically.</p>
                      <p>You can connect or disconnect any account at any time. Disconnecting doesn't delete any files — it just stops Workspace from acting on your behalf for that provider.</p>
                      <p>Your login account (the one you use to sign into Workspace) is separate from your connected accounts. You can sign in with Microsoft but still connect a different Google account for Flows.</p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Backend Modules</CardTitle>
                      <CardDescription>The services that power Workspace, listed in the order they start up. All must be healthy for the platform to work correctly.</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-1 text-sm font-mono">
                        {[
                          ['1', 'KMS Client',        'Manages encryption keys — keeps documents and signatures secure'],
                          ['2', 'ARCHIEVE',           'Records every action in a verifiable chain — the foundation of the audit trail'],
                          ['3', 'VAULT',              'Stores and governs documents and records'],
                          ['4', 'SEAL',               'Cryptographic document signing and verification'],
                          ['5', 'Template Library',   'Renders output templates for documents and exports'],
                          ['6', 'FormKey',            'Powers public intake forms, consent gates, and submission routing'],
                          ['7', 'LOGICBRIDGE',        'Handles external API connectors and integration runners'],
                          ['8', 'SYNCHRON8',          'Drives automation triggers and feed-based workflows'],
                          ['9', 'CaseSpace Factory',  'Provisions governed environments when new orgs are created'],
                          ['10', 'Syncronate',        'Orchestrates cross-system data sync in the background'],
                        ].map(([num, name, desc]) => (
                          <div key={num} className="flex gap-3">
                            <span className="text-muted-foreground w-5 shrink-0">{num}</span>
                            <span className="text-primary w-36 shrink-0">{name}</span>
                            <span className="text-muted-foreground font-sans">{desc}</span>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Common Questions</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4 text-sm">
                      <div>
                        <p className="font-medium mb-1">How do I sign in?</p>
                        <p className="text-muted-foreground">Use your username and password on the login screen, or click one of the OAuth buttons (Google, Microsoft, GitHub) if your admin set that up. First-time local accounts will ask you to set a new password immediately.</p>
                      </div>
                      <Separator />
                      <div>
                        <p className="font-medium mb-1">Where do I start?</p>
                        <p className="text-muted-foreground">Open <strong>Environments</strong> from the sidebar. Everything you create — modules, apps, bots — is organized there by org or project. Click <strong>+ New Environment</strong> to get started, or use <strong>Module Builder</strong> to set one up with a governance structure.</p>
                      </div>
                      <Separator />
                      <div>
                        <p className="font-medium mb-1">I created something but it's not showing up in Environments.</p>
                        <p className="text-muted-foreground">Click the <strong>↻</strong> refresh button in the Environments toolbar. If it still doesn't appear, make sure you're connected to the internet — newly created items are saved locally and sync to the server automatically.</p>
                      </div>
                      <Separator />
                      <div>
                        <p className="font-medium mb-1">I forgot my password.</p>
                        <p className="text-muted-foreground">Ask your admin to reset it from <strong>Admin → Users</strong>. They'll give you a new temporary password and you'll set a permanent one on next login.</p>
                      </div>
                      <Separator />
                      <div>
                        <p className="font-medium mb-1">I can't see a tool I need.</p>
                        <p className="text-muted-foreground">Your admin controls which tools are visible to you. Reach out and ask them to update your tool access in <strong>Admin → Users → your name</strong>.</p>
                      </div>
                      <Separator />
                      <div>
                        <p className="font-medium mb-1">Something seems broken.</p>
                        <p className="text-muted-foreground">Ask your admin to check system status under <strong>Admin → PJ Health</strong>. All backend modules and their current status are listed there.</p>
                      </div>
                      <Separator />
                      <div>
                        <p className="font-medium mb-1">Can I verify a signed document is authentic?</p>
                        <p className="text-muted-foreground">Yes. Documents signed with SEAL carry a cryptographic stamp that can be verified at any time — even years later, even without logging in. Ask your admin for the verification steps.</p>
                      </div>
                      <Separator />
                      <div>
                        <p className="font-medium mb-1">Can the public submit a form without an account?</p>
                        <p className="text-muted-foreground">Yes — FormKey forms are public-facing. Share the form link and anyone can submit. All submissions are automatically saved, stamped, and routed without requiring a Workspace account.</p>
                      </div>
                    </CardContent>
                  </Card>

                </TabsContent>



              </div>
            </ScrollArea>
          </div>
        </div>
      </Tabs>
    </div>
  )
}
