import { useState, useEffect } from 'react'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { civicpulseClient, getCivicPulseFailureMessage } from '../../../api/civicpulseClient'
import type { ChannelConfig, OutputChannel } from '../../../types/civicpulse.types'
import { toast } from 'sonner'
import { CircleNotch } from '@phosphor-icons/react'

const CHANNEL_META: { id: OutputChannel; label: string; description: string }[] = [
  { id: 'website_post',     label: 'Website Post',         description: 'HTML block published to municipal CMS' },
  { id: 'activity_feed',    label: 'Town Activity Feed',   description: 'Public-facing governance record surface' },
  { id: 'weekly_digest',    label: 'Weekly Digest',        description: 'Aggregated summary email, 7-day rolling window' },
  { id: 'email_summary',    label: 'Email Notification',   description: 'Single-action email for high-threshold events' },
  { id: 'social_draft',     label: 'Social Draft',         description: 'Character-constrained draft — operator-gated only' },
  { id: 'quarterly_report', label: 'Quarterly Report',     description: 'Input aggregation for quarterly transparency report' },
]

export function ChannelConfigPanel() {
  const [channels, setChannels] = useState<ChannelConfig[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    civicpulseClient.getMunicipalityConfig()
      .then(cfg => setChannels(cfg.channels))
      .catch(err => setError(getCivicPulseFailureMessage(err, 'channel configuration')))
      .finally(() => setLoading(false))
  }, [])

  const getChannel = (id: OutputChannel) =>
    channels.find(c => c.channel === id) ?? { channel: id, enabled: false, approvalBehavior: 'staff_review' as const }

  const update = async (id: OutputChannel, patch: Partial<ChannelConfig>) => {
    const next = channels.some(c => c.channel === id)
      ? channels.map(c => c.channel === id ? { ...c, ...patch } : c)
      : [...channels, { ...getChannel(id), ...patch }]
    setChannels(next)
    setSaving(true)
    try {
      await civicpulseClient.updateChannelConfig(next)
      toast.success('Channel settings saved.')
    } catch {
      toast.error('Failed to save channel settings.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground py-8 justify-center">
        <CircleNotch size={16} className="animate-spin" />
        <span className="text-sm">Loading channel configuration…</span>
      </div>
    )
  }

  if (error) {
    return <p className="py-4 text-sm text-destructive">{error}</p>
  }

  return (
    <div className="space-y-3">
      {CHANNEL_META.map(meta => {
        const cfg = getChannel(meta.id)
        return (
          <div key={meta.id} className="flex items-center gap-4 rounded-lg border border-border bg-card px-4 py-3">
            <div className="flex-1 min-w-0">
              <Label className="text-sm font-medium">{meta.label}</Label>
              <p className="text-xs text-muted-foreground mt-0.5">{meta.description}</p>
            </div>
            <Select
              value={cfg.approvalBehavior}
              onValueChange={val => update(meta.id, { approvalBehavior: val as ChannelConfig['approvalBehavior'] })}
              disabled={!cfg.enabled || saving}
            >
              <SelectTrigger className="w-36 h-7 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="auto_release">Auto-release</SelectItem>
                <SelectItem value="staff_review">Staff review</SelectItem>
              </SelectContent>
            </Select>
            <Switch
              checked={cfg.enabled}
              onCheckedChange={val => update(meta.id, { enabled: val })}
              disabled={saving}
            />
          </div>
        )
      })}
      {saving && (
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <CircleNotch size={11} className="animate-spin" /> Saving…
        </div>
      )}
    </div>
  )
}
