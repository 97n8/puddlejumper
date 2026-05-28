interface Props {
  status?: 'pending' | 'confirmed' | 'failed' | 'misplaced'
}

export function PlacementStatusBadge({ status }: Props) {
  const config: Record<string, { bg: string; label: string }> = {
    confirmed: { bg: 'bg-green-100 text-green-800', label: 'Confirmed' },
    pending:   { bg: 'bg-amber-100 text-amber-800', label: 'Pending' },
    failed:    { bg: 'bg-red-100 text-red-800',     label: 'Failed' },
    misplaced: { bg: 'bg-orange-100 text-orange-800', label: 'Misplaced' },
  }
  const { bg, label } = config[status ?? ''] ?? { bg: 'bg-slate-100 text-slate-600', label: 'Not placed' }
  return (
    <span className={`inline-block text-xs font-semibold rounded-md px-2 py-0.5 ${bg}`}>
      {label}
    </span>
  )
}
