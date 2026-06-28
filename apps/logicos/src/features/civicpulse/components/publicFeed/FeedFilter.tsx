import { Badge } from '@/components/ui/badge'
import type { ActionType } from '../../types/civicpulse.types'

const ACTION_TYPE_OPTIONS: { id: ActionType; label: string }[] = [
  { id: 'board_vote',           label: 'Board Vote' },
  { id: 'contract_award',       label: 'Contract Award' },
  { id: 'budget_transfer',      label: 'Budget Transfer' },
  { id: 'public_hearing',       label: 'Public Hearing' },
  { id: 'capital_milestone',    label: 'Capital Milestone' },
  { id: 'debt_issuance',        label: 'Debt Issuance' },
  { id: 'emergency_declaration',label: 'Emergency Declaration' },
  { id: 'policy_adoption',      label: 'Policy Adoption' },
  { id: 'procurement_action',   label: 'Procurement Action' },
  { id: 'zba_filing',           label: 'ZBA Filing' },
]

interface FeedFilterProps {
  selected: ActionType[]
  onChange: (types: ActionType[]) => void
}

export function FeedFilter({ selected, onChange }: FeedFilterProps) {
  const toggle = (type: ActionType) => {
    onChange(
      selected.includes(type)
        ? selected.filter(t => t !== type)
        : [...selected, type]
    )
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {ACTION_TYPE_OPTIONS.map(opt => {
        const active = selected.includes(opt.id)
        return (
          <button key={opt.id} onClick={() => toggle(opt.id)}>
            <Badge
              className={`text-[11px] cursor-pointer transition-colors ${
                active
                  ? 'bg-primary/20 text-primary border-primary/30'
                  : 'bg-muted text-muted-foreground border-transparent hover:bg-muted/80'
              }`}
            >
              {opt.label}
            </Badge>
          </button>
        )
      })}
      {selected.length > 0 && (
        <button onClick={() => onChange([])} className="text-[11px] text-muted-foreground hover:text-foreground transition-colors">
          Clear
        </button>
      )}
    </div>
  )
}
