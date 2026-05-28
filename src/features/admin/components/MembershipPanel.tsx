import { useState } from 'react'
import { useKV } from '@/hooks/useKV'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { 
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger 
} from '@/components/ui/tabs'
import { 
  Crown,
  Sparkle,
  Check,
  X,
  TrendUp,
  Users as UsersIcon,
  Rocket,
  Star,
  CreditCard,
  ShieldCheck,
  ChartBar
} from '@phosphor-icons/react'
import { toast } from 'sonner'
import { 
  MembershipTier,
  UserSubscription,
  WorkspaceUser,
  MembershipFeatures
} from '@/lib/types'
import {
  MEMBERSHIP_PLANS,
  MEMBERSHIP_PLANS_ARRAY,
  getMembershipFeatures,
  getTierPriority,
  getTierBadgeColor,
} from '@/lib/membership'

export function MembershipPanel() {
  const [subscription, setSubscription] = useKV<UserSubscription>('logicworkspace-subscription', {
    tier: 'pj',
    startDate: Date.now(),
    status: 'active',
    billingCycle: 'monthly',
    autoRenew: false,
    enabledAutomations: [],
  })
  const [users, setUsers] = useKV<WorkspaceUser[]>('logicworkspace-users', [])
  const [upgradeTier, setUpgradeTier] = useState<MembershipTier>('pj_plus')
  const [upgradeDialogOpen, setUpgradeDialogOpen] = useState(false)
  const [customFeaturesDialogOpen, setCustomFeaturesDialogOpen] = useState(false)
  const [customFeatures, setCustomFeatures] = useState<Partial<MembershipFeatures>>({})

  const currentSubscription = subscription || {
    tier: 'pj' as const,
    startDate: Date.now(),
    status: 'active' as const,
    billingCycle: 'monthly' as const,
    autoRenew: false,
    enabledAutomations: [],
  }

  const currentUsers = users || []
  const currentFeatures = getMembershipFeatures(currentSubscription)
  const currentPlan = MEMBERSHIP_PLANS[currentSubscription.tier]

  const handleUpgradeToTier = (tier: MembershipTier) => {
    const newSubscription: UserSubscription = {
      ...currentSubscription,
      tier,
      startDate: Date.now(),
      status: 'active',
      billingCycle: 'monthly',
      autoRenew: true,
    }
    setSubscription(newSubscription)
    toast.success(`Successfully upgraded to ${tier}!`)
    setUpgradeDialogOpen(false)
  }

  const handleApplyCustomFeatures = () => {
    setSubscription((current) => ({
      ...current!,
      customFeatureOverrides: customFeatures,
    }))
    toast.success('Custom feature overrides applied')
    setCustomFeaturesDialogOpen(false)
  }

  const handleAssignTierToUser = (userId: string, tier: MembershipTier) => {
    setUsers((current) =>
      (current || []).map((u) =>
        u.id === userId
          ? { ...u, role: getTierPriority(tier) >= getTierPriority('pj_pro') ? 'admin' : u.role }
          : u
      )
    )
    toast.success('User tier updated')
  }

  const renderFeatureValue = (key: string, value: unknown) => {
    if (typeof value === 'boolean') {
      return value ? (
        <Check size={16} weight="bold" className="text-green-600" />
      ) : (
        <X size={16} weight="bold" className="text-red-600" />
      )
    }
    if (typeof value === 'number') {
      return value === -1 ? (
        <span className="text-primary font-semibold">Unlimited</span>
      ) : (
        <span className="font-mono font-semibold">{value}</span>
      )
    }
    return <span className="font-mono text-sm">{String(value)}</span>
  }

  const renderTierIcon = (tier: MembershipTier) => {
    switch (tier) {
      case 'pj':
        return <Star size={20} className="text-gray-500" />
      case 'pj_plus':
        return <Rocket size={20} className="text-blue-500" weight="fill" />
      case 'pj_pro':
        return <Crown size={20} className="text-amber-500" weight="fill" />
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-2xl font-semibold">Membership & Billing</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Manage subscription tiers and feature access
          </p>
        </div>
        <Dialog open={upgradeDialogOpen} onOpenChange={setUpgradeDialogOpen}>
          <DialogTrigger asChild>
            <Button size="lg">
              <TrendUp size={18} weight="bold" />
              Upgrade Plan
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle>Upgrade Your Plan</DialogTitle>
              <DialogDescription>
                Choose a plan that fits your team's needs
              </DialogDescription>
            </DialogHeader>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 py-4">
              {MEMBERSHIP_PLANS_ARRAY.filter(p => p.tier !== 'pj').map((plan) => (
                <Card
                  key={plan.tier}
                  className={`cursor-pointer transition-all ${
                    upgradeTier === plan.tier ? 'ring-2 ring-primary' : ''
                  }`}
                  onClick={() => setUpgradeTier(plan.tier)}
                >
                  <CardHeader>
                    <div className="flex items-center justify-between mb-2">
                      {renderTierIcon(plan.tier)}
                      <Badge className={getTierBadgeColor(plan.tier)}>
                        {plan.tier}
                      </Badge>
                    </div>
                    <CardTitle className="text-xl">{plan.name}</CardTitle>
                    <CardDescription className="text-xs line-clamp-2">
                      {plan.description}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="mb-4">
                      <span className="text-3xl font-display font-bold">
                        ${plan.price}
                      </span>
                      <span className="text-sm text-muted-foreground">/month</span>
                    </div>
                    <div className="space-y-2 text-xs">
                      <div className="flex items-center gap-2">
                        <Check size={14} className="text-green-600" />
                        <span>{plan.features.maxUsers === -1 ? 'Unlimited' : plan.features.maxUsers} users</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Check size={14} className="text-green-600" />
                        <span>{plan.features.maxFiles === -1 ? 'Unlimited' : plan.features.maxFiles} files</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Check size={14} className="text-green-600" />
                        <span>{plan.features.maxAutomations === -1 ? 'Unlimited' : plan.features.maxAutomations} automations</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setUpgradeDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={() => handleUpgradeToTier(upgradeTier)}>
                Upgrade to {upgradeTier}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {renderTierIcon(currentSubscription.tier)}
              <div>
                <CardTitle>Current Plan: {currentPlan?.name}</CardTitle>
                <CardDescription>{currentPlan?.description}</CardDescription>
              </div>
            </div>
            <Badge className={`${getTierBadgeColor(currentSubscription.tier)} text-sm px-3 py-1`}>
              {currentSubscription.tier}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div className="border border-border rounded-lg p-4">
              <CreditCard size={24} className="text-muted-foreground mb-2" />
              <p className="text-2xl font-display font-bold">
                ${currentPlan?.price}
              </p>
              <p className="text-xs text-muted-foreground">per {currentSubscription.billingCycle}</p>
            </div>
            <div className="border border-border rounded-lg p-4">
              <UsersIcon size={24} className="text-muted-foreground mb-2" />
              <p className="text-2xl font-display font-bold">
                {currentFeatures.maxUsers === -1 ? '∞' : currentFeatures.maxUsers}
              </p>
              <p className="text-xs text-muted-foreground">max users</p>
            </div>
            <div className="border border-border rounded-lg p-4">
              <ShieldCheck size={24} className="text-muted-foreground mb-2" />
              <p className="text-2xl font-display font-bold">
                {currentSubscription.status}
              </p>
              <p className="text-xs text-muted-foreground">status</p>
            </div>
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div>
              <Label>Auto-Renewal</Label>
              <p className="text-xs text-muted-foreground">
                Automatically renew subscription at end of billing cycle
              </p>
            </div>
            <Switch
              checked={currentSubscription.autoRenew}
              onCheckedChange={(checked) =>
                setSubscription((current) => ({ ...current!, autoRenew: checked }))
              }
            />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="flex-1">
              <Label>Billing Cycle</Label>
              <p className="text-xs text-muted-foreground">Change how often you're billed</p>
            </div>
            <Select
              value={currentSubscription.billingCycle}
              onValueChange={(value: 'monthly' | 'yearly') =>
                setSubscription((current) => ({ ...current!, billingCycle: value }))
              }
            >
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="monthly">Monthly</SelectItem>
                <SelectItem value="yearly">Yearly (Save 20%)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="features" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="features">Features</TabsTrigger>
          <TabsTrigger value="compare">Compare Plans</TabsTrigger>
          <TabsTrigger value="users">User Access</TabsTrigger>
        </TabsList>

        <TabsContent value="features" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Feature Access</CardTitle>
                <Dialog open={customFeaturesDialogOpen} onOpenChange={setCustomFeaturesDialogOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm">
                      <Sparkle size={16} />
                      Custom Overrides
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-2xl max-h-[80vh]">
                    <DialogHeader>
                      <DialogTitle>Custom Feature Overrides</DialogTitle>
                      <DialogDescription>
                        Override specific features for this workspace (Enterprise feature)
                      </DialogDescription>
                    </DialogHeader>
                    <ScrollArea className="h-[50vh] pr-4">
                      <div className="space-y-4 py-4">
                        {Object.entries(currentFeatures).map(([key, value]) => (
                          <div key={key} className="flex items-center justify-between p-3 border border-border rounded-lg">
                            <div className="flex-1">
                              <Label className="text-sm font-medium">
                                {key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
                              </Label>
                              <p className="text-xs text-muted-foreground">
                                Default: {renderFeatureValue(key, value)}
                              </p>
                            </div>
                            {typeof value === 'boolean' ? (
                              <Switch
                                checked={customFeatures[key as keyof MembershipFeatures] as boolean ?? value}
                                onCheckedChange={(checked) =>
                                  setCustomFeatures((prev) => ({ ...prev, [key]: checked }))
                                }
                              />
                            ) : typeof value === 'number' ? (
                              <Input
                                type="number"
                                className="w-24"
                                defaultValue={value === -1 ? 9999 : value}
                                onChange={(e) =>
                                  setCustomFeatures((prev) => ({
                                    ...prev,
                                    [key]: parseInt(e.target.value) || value,
                                  }))
                                }
                              />
                            ) : null}
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setCustomFeaturesDialogOpen(false)}>
                        Cancel
                      </Button>
                      <Button onClick={handleApplyCustomFeatures}>Apply Overrides</Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
              <CardDescription>
                Features included in your {currentSubscription.tier} plan
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-3">
                {Object.entries(currentFeatures).map(([key, value]) => (
                  <div
                    key={key}
                    className="flex items-center justify-between p-3 border border-border rounded-lg"
                  >
                    <span className="text-sm">
                      {key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
                    </span>
                    {renderFeatureValue(key, value)}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="compare" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Compare All Plans</CardTitle>
              <CardDescription>See what each tier includes</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left p-3 text-sm font-medium">Feature</th>
                      {MEMBERSHIP_PLANS_ARRAY.map((plan) => (
                        <th key={plan.tier} className="p-3 text-center">
                          <div className="flex flex-col items-center gap-1">
                            {renderTierIcon(plan.tier)}
                            <span className="text-sm font-semibold">{plan.name}</span>
                            <span className="text-xs text-muted-foreground">
                              ${plan.price}/mo
                            </span>
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {Object.keys(currentFeatures).map((key) => (
                      <tr key={key} className="border-b border-border/50">
                        <td className="p-3 text-sm">
                          {key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
                        </td>
                        {MEMBERSHIP_PLANS_ARRAY.map((plan) => (
                          <td key={plan.tier} className="p-3 text-center">
                            {renderFeatureValue(key, plan.features[key as keyof MembershipFeatures])}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="users" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>User Tier Assignment</CardTitle>
              <CardDescription>
                Assign different tiers to individual users (Enterprise feature)
              </CardDescription>
            </CardHeader>
            <CardContent>
              {currentUsers.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No users to manage
                </div>
              ) : (
                <div className="space-y-3">
                  {currentUsers.map((user) => (
                    <div
                      key={user.id}
                      className="flex items-center justify-between p-4 border border-border rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold">
                          {user.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-medium">{user.name}</p>
                          <p className="text-sm text-muted-foreground">{user.email}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge variant="outline">{user.role}</Badge>
                        <Select
                          defaultValue={currentSubscription.tier}
                          onValueChange={(value: MembershipTier) =>
                            handleAssignTierToUser(user.id, value)
                          }
                        >
                          <SelectTrigger className="w-32">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="pj">PJ</SelectItem>
                            <SelectItem value="pj_plus">PJ+</SelectItem>
                            <SelectItem value="pj_pro">PJ Pro</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Card>
        <CardHeader>
          <CardTitle>Usage Statistics</CardTitle>
          <CardDescription>Track your workspace usage against plan limits</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="border border-border rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <ChartBar size={20} className="text-muted-foreground" />
                <Badge variant="outline" className="text-xs">
                  {currentUsers.length} / {currentFeatures.maxUsers === -1 ? '∞' : currentFeatures.maxUsers}
                </Badge>
              </div>
              <p className="text-sm font-medium">Users</p>
              <div className="mt-2 h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary"
                  style={{
                    width: currentFeatures.maxUsers === -1 ? '10%' : `${(currentUsers.length / currentFeatures.maxUsers) * 100}%`,
                  }}
                />
              </div>
            </div>

            <div className="border border-border rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <ChartBar size={20} className="text-muted-foreground" />
                <Badge variant="outline" className="text-xs">
                  0 / {currentFeatures.maxFiles === -1 ? '∞' : currentFeatures.maxFiles}
                </Badge>
              </div>
              <p className="text-sm font-medium">Files</p>
              <div className="mt-2 h-2 bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-primary" style={{ width: '0%' }} />
              </div>
            </div>

            <div className="border border-border rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <ChartBar size={20} className="text-muted-foreground" />
                <Badge variant="outline" className="text-xs">
                  0 / {currentFeatures.maxAutomations === -1 ? '∞' : currentFeatures.maxAutomations}
                </Badge>
              </div>
              <p className="text-sm font-medium">Automations</p>
              <div className="mt-2 h-2 bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-primary" style={{ width: '0%' }} />
              </div>
            </div>

            <div className="border border-border rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <ChartBar size={20} className="text-muted-foreground" />
                <Badge variant="outline" className="text-xs">
                  0 / {currentFeatures.maxCaseSpaces === -1 ? '∞' : currentFeatures.maxCaseSpaces}
                </Badge>
              </div>
              <p className="text-sm font-medium">CaseSpaces</p>
              <div className="mt-2 h-2 bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-primary" style={{ width: '0%' }} />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
