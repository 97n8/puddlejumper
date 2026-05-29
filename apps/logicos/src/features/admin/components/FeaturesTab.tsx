import { useKV } from '@/hooks/useKV'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Megaphone, Warning } from '@phosphor-icons/react'

type CivicPulseConfig = {
  enabled: boolean
  outputChannels: {
    websitePost: boolean
    activityFeed: boolean
    weeklyDigest: boolean
    emailSummary: boolean
    socialDraft: boolean
    quarterlyReport: boolean
  }
  municipalityConfigPath: string
  ruleSetPath: string
  vaultBaseUrl: string
}

const DEFAULT_CONFIG: CivicPulseConfig = {
  enabled: false,
  outputChannels: { websitePost: true, activityFeed: true, weeklyDigest: false, emailSummary: false, socialDraft: false, quarterlyReport: false },
  municipalityConfigPath: '',
  ruleSetPath: '',
  vaultBaseUrl: '',
}

export function FeaturesTab() {
  const [civicPulseConfig, setCivicPulseConfig] = useKV<CivicPulseConfig>('civicpulse-admin-config', DEFAULT_CONFIG)
  const cpConfig = civicPulseConfig || DEFAULT_CONFIG
  const updateCp = (patch: Partial<CivicPulseConfig>) =>
    setCivicPulseConfig(cur => ({ ...cur!, ...patch }))

  return (
    <>
      {/* CivicPulse master toggle */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Megaphone size={18} weight="duotone" className="text-emerald-600" />
            CivicPulse™ — Automated Civic Transparency Engine
          </CardTitle>
          <CardDescription>
            Detects qualifying municipal actions in VAULT, generates structured civic summaries,
            routes for approval, and publishes to configured output channels with a full audit chain.
            All gates must be met before enabling.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-base">Enable CivicPulse</Label>
              <p className="text-sm text-muted-foreground">
                ARCHIEVE begins monitoring VAULT records immediately on activation
              </p>
            </div>
            <Switch
              checked={cpConfig.enabled}
              onCheckedChange={v => updateCp({ enabled: v })}
            />
          </div>

          {cpConfig.enabled && (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800 flex items-start gap-2">
              <Megaphone size={14} weight="duotone" className="mt-0.5 shrink-0" />
              CivicPulse is active. ARCHIEVE is monitoring VAULT records against the configured rule set.
            </div>
          )}
        </CardContent>
      </Card>

      {/* Configuration paths */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Configuration</CardTitle>
          <CardDescription>Paths and endpoints wired to PuddleJumper environment variables</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="cp-vault-url">VAULT Base URL</Label>
            <input
              id="cp-vault-url"
              className="w-full h-9 px-3 text-sm rounded-md border border-border bg-background focus:outline-none focus:ring-1 focus:ring-primary font-mono"
              placeholder="https://vault.municipality.gov"
              value={cpConfig.vaultBaseUrl}
              onChange={e => updateCp({ vaultBaseUrl: e.target.value })}
            />
            <p className="text-xs text-muted-foreground">Maps to <code className="font-mono bg-muted px-1 rounded">CIVICPULSE_VAULT_BASE_URL</code></p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cp-config-path">Municipality Config Path</Label>
            <input
              id="cp-config-path"
              className="w-full h-9 px-3 text-sm rounded-md border border-border bg-background focus:outline-none focus:ring-1 focus:ring-primary font-mono"
              placeholder="./config/municipalityConfig.json"
              value={cpConfig.municipalityConfigPath}
              onChange={e => updateCp({ municipalityConfigPath: e.target.value })}
            />
            <p className="text-xs text-muted-foreground">Maps to <code className="font-mono bg-muted px-1 rounded">CIVICPULSE_MUNICIPALITY_CONFIG_PATH</code></p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cp-ruleset-path">Active Rule Set Path</Label>
            <input
              id="cp-ruleset-path"
              className="w-full h-9 px-3 text-sm rounded-md border border-border bg-background focus:outline-none focus:ring-1 focus:ring-primary font-mono"
              placeholder="./ruleSets/municipality-v1.0.0.json"
              value={cpConfig.ruleSetPath}
              onChange={e => updateCp({ ruleSetPath: e.target.value })}
            />
            <p className="text-xs text-muted-foreground">Maps to <code className="font-mono bg-muted px-1 rounded">CIVICPULSE_RULE_SET_PATH</code></p>
          </div>
        </CardContent>
      </Card>

      {/* Output channels */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Output Channels</CardTitle>
          <CardDescription>Enable the channels that will receive published civic summaries</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {([
            { key: 'websitePost',    label: 'Website Post',     desc: 'Publishes to municipal CMS via configured endpoint' },
            { key: 'activityFeed',   label: 'Town Activity Feed', desc: 'Public in-app feed — always recommended' },
            { key: 'weeklyDigest',   label: 'Weekly Digest',    desc: 'Batched email digest to configured recipient list' },
            { key: 'emailSummary',   label: 'Email Summary',    desc: 'Per-action-type email alerts to specific recipients' },
            { key: 'socialDraft',    label: 'Social Draft',     desc: 'Drafts for operator review before posting' },
            { key: 'quarterlyReport', label: 'Quarterly Report', desc: 'Aggregated report generated at quarter close' },
          ] as const).map(ch => (
            <div key={ch.key} className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>{ch.label}</Label>
                <p className="text-xs text-muted-foreground">{ch.desc}</p>
              </div>
              <Switch
                checked={cpConfig.outputChannels[ch.key]}
                onCheckedChange={v =>
                  updateCp({ outputChannels: { ...cpConfig.outputChannels, [ch.key]: v } })
                }
              />
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Installation gates reminder */}
      <Card className="border-amber-200 bg-amber-50">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-amber-800 flex items-center gap-2">
            <Warning size={16} weight="duotone" />
            Installation Gates
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="text-xs text-amber-700 space-y-1">
            {[
              'VAULT Foundations complete and accepted',
              'VAULT Workspaces (Board Compliance + Fiscal) active',
              'ARCHIEVE rule set drafted and signed off',
              'SEAL initialized and validated on a test record',
              'Output channels configured and credentialed',
              'Operator trained and certified',
            ].map(g => (
              <li key={g} className="flex items-start gap-1.5">
                <span className="mt-0.5 shrink-0">·</span>
                {g}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </>
  )
}
