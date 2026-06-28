import { Badge } from '@/components/ui/badge'
import { Calendar, Buildings, ArrowSquareOut } from '@phosphor-icons/react'
import type { FeedEntry as FeedEntryType } from '../../types/civicpulse.types'
import { formatDistanceToNow } from 'date-fns'

const ACTION_TYPE_LABELS: Record<string, string> = {
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

const ACTION_TYPE_COLORS: Record<string, string> = {
  board_vote: 'bg-blue-500/15 text-blue-400',
  contract_award: 'bg-purple-500/15 text-purple-400',
  budget_transfer: 'bg-amber-500/15 text-amber-400',
  emergency_declaration: 'bg-red-500/15 text-red-400',
  debt_issuance: 'bg-red-500/15 text-red-400',
}

interface FeedEntryProps {
  entry: FeedEntryType
}

export function FeedEntry({ entry }: FeedEntryProps) {
  const colorClass = ACTION_TYPE_COLORS[entry.actionType] ?? 'bg-muted text-muted-foreground'

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-3 hover:border-border/80 transition-colors">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge className={`text-[10px] px-1.5 py-0 h-4 border-0 ${colorClass}`}>
              {ACTION_TYPE_LABELS[entry.actionType] ?? entry.actionType}
            </Badge>
          </div>
          <h3 className="text-sm font-semibold text-foreground leading-snug">{entry.headline}</h3>
          <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
            <span className="flex items-center gap-1"><Buildings size={11} />{entry.governingBody}</span>
            <span className="flex items-center gap-1"><Calendar size={11} />{entry.actionDate}</span>
          </div>
        </div>
        {entry.vaultRecordUrl && (
          <a
            href={entry.vaultRecordUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 text-muted-foreground hover:text-primary transition-colors"
            title="View VAULT record"
          >
            <ArrowSquareOut size={14} />
          </a>
        )}
      </div>

      <p className="text-sm text-muted-foreground leading-relaxed">{entry.summaryText}</p>

      <div className="flex items-center justify-between text-[11px] text-muted-foreground/60">
        <span>Published {formatDistanceToNow(new Date(entry.publishedAt), { addSuffix: true })}</span>
        <div className="flex items-center gap-1 flex-wrap">
          {entry.channels.map(ch => (
            <span key={ch} className="px-1.5 py-0.5 rounded bg-muted text-muted-foreground text-[10px]">
              {ch.replace('_', ' ')}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}
