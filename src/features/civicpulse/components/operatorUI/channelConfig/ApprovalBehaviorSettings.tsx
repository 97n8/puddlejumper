import { useState, useEffect } from 'react'
import { civicpulseClient, getCivicPulseFailureMessage } from '../../../api/civicpulseClient'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import type { MunicipalityConfig, ActionType, ChannelConfig } from '../../../types/civicpulse.types'
import { CircleNotch } from '@phosphor-icons/react'
import { toast } from 'sonner'

const ACTION_LABELS: Record<ActionType, string> = {
  board_vote: 'Board Vote',
  contract_award: 'Contract Award',
  budget_transfer: 'Budget Transfer',
  public_hearing: 'Public Hearing',
  capital_milestone: 'Capital Milestone',
  debt_issuance: 'Debt Issuance',
  emergency_declaration: 'Emergency Declaration',
  policy_adoption: 'Policy Adoption',
  procurement_action: 'Procurement Action',
  zba_filing: 'ZBA Filing',
}

const ALL_ACTION_TYPES = Object.keys(ACTION_LABELS) as ActionType[]

export function ApprovalBehaviorSettings() {
  const [config, setConfig] = useState<MunicipalityConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    civicpulseClient.getMunicipalityConfig()
      .then(setConfig)
      .catch(err => setError(getCivicPulseFailureMessage(err, 'approval settings')))
      .finally(() => setLoading(false))
  }, [])

  const getChannelBehavior = (channel: ChannelConfig['channel']) =>
    config?.channels.find(c => c.channel === channel)?.approvalBehavior ?? 'staff_review'

  const updateActionBehavior = async (actionType: ActionType, behavior: 'auto_release' | 'staff_review') => {
    if (!config) return
    const updatedChannels = config.channels.map(c => ({
      ...c,
      approvalBehavior: behavior,
    }))
    setSaving(true)
    try {
      await civicpulseClient.updateChannelConfig(updatedChannels)
      setConfig(prev => prev ? { ...prev, channels: updatedChannels } : prev)
      toast.success(`Approval behavior updated for ${ACTION_LABELS[actionType]}.`)
    } catch {
      toast.error('Failed to update approval behavior.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground py-8 justify-center">
        <CircleNotch size={16} className="animate-spin" />
        <span className="text-sm">Loading approval settings…</span>
      </div>
    )
  }

  if (error) {
    return <p className="py-4 text-sm text-destructive">{error}</p>
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Set the default approval behavior per action type. Auto-release publishes immediately after SEAL validation. Staff review stages the summary for operator approval.
      </p>
      {ALL_ACTION_TYPES.map(type => (
        <div key={type} className="flex items-center gap-4 rounded-lg border border-border bg-card px-4 py-3">
          <Label className="flex-1 text-sm font-medium">{ACTION_LABELS[type]}</Label>
          <Select
            value={getChannelBehavior('website_post')}
            onValueChange={val => updateActionBehavior(type, val as 'auto_release' | 'staff_review')}
            disabled={saving}
          >
            <SelectTrigger className="w-36 h-7 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="auto_release">Auto-release</SelectItem>
              <SelectItem value="staff_review">Staff review</SelectItem>
            </SelectContent>
          </Select>
        </div>
      ))}
    </div>
  )
}
