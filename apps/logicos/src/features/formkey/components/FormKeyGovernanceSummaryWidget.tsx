import { useCallback, useEffect, useState } from 'react'
import { ArrowSquareOut, ArrowsClockwise, ClipboardText, Gavel, Tray } from '@phosphor-icons/react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { pjApi } from '@/services/pjApi'

type SummaryState = {
  intakeCount: number | null
  reviewCount: number | null
  partial: boolean
}

export function FormKeyGovernanceSummaryWidget({ hasFormKeyAccess = true }: { hasFormKeyAccess?: boolean }) {
  const [summary, setSummary] = useState<SummaryState>({ intakeCount: null, reviewCount: null, partial: false })
  const [loading, setLoading] = useState(true)

  const loadSummary = useCallback(async () => {
    setLoading(true)
    try {
      let intakeCount: number | null = null
      let reviewCount: number | null = null
      let partial = false

      const [formsResponse, reviewsResponse] = await Promise.allSettled([
        pjApi.formkey.list(),
        pjApi.formkey.listReviews('pending'),
      ])

      if (formsResponse.status === 'fulfilled') {
        const forms = (formsResponse.value.forms ?? []).filter((form) => typeof form?.formId === 'string')
        const submissionResults = await Promise.allSettled(
          forms.map(async (form) => {
            const submissionsRes = await pjApi.formkey.listSubmissions(form.formId)
            return (submissionsRes.submissions ?? []).filter((submission) => !['responded', 'closed'].includes(submission.status ?? 'received')).length
          }),
        )
        const fulfilledCounts = submissionResults
          .filter((result): result is PromiseFulfilledResult<number> => result.status === 'fulfilled')
          .map((result) => result.value)

        if (submissionResults.some((result) => result.status === 'rejected')) {
          partial = true
        }

        if (forms.length === 0) {
          intakeCount = 0
        } else if (submissionResults.some((result) => result.status === 'rejected')) {
          intakeCount = null
        } else if (fulfilledCounts.length > 0) {
          intakeCount = fulfilledCounts.reduce<number>((total, count) => total + count, 0)
        } else if (submissionResults.length > 0) {
          intakeCount = null
        }
      } else {
        partial = true
      }

      if (reviewsResponse.status === 'fulfilled') {
        reviewCount = reviewsResponse.value.reviews?.length ?? reviewsResponse.value.total ?? 0
      } else {
        partial = true
      }

      setSummary({
        intakeCount,
        reviewCount,
        partial,
      })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadSummary()
  }, [loadSummary])

  const cards = [
    {
      key: 'intake',
      label: 'Intake',
      href: '/formkey?tab=intake',
      icon: <Tray size={12} />,
      count: summary.intakeCount,
      description: 'Open submissions that still need operator action.',
    },
    {
      key: 'review',
      label: 'Review',
      href: '/formkey?tab=review',
      icon: <Gavel size={12} />,
      count: summary.reviewCount,
      description: 'Pending approval gates waiting for a decision.',
    },
  ] as const

  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <div className="text-sm font-semibold">FormKey lifecycle</div>
            {summary.partial && !loading && (
              <Badge variant="outline" className="h-5 px-1.5 py-0 text-[10px] uppercase tracking-[0.14em]">
                Partial
              </Badge>
            )}
          </div>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            Governance keeps the read-only pulse here. Intake triage and approval now live in FormKey.
          </p>
        </div>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => void loadSummary()} aria-label="Refresh FormKey summary">
          <ArrowsClockwise size={13} className={loading ? 'animate-spin' : ''} />
        </Button>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        {cards.map((card) => {
          const content = (
            <>
              <div className="flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  {card.icon}
                  {card.label}
                </span>
                <ArrowSquareOut size={13} className={cn('text-muted-foreground', !hasFormKeyAccess && 'opacity-40')} />
              </div>
              <div className="mt-3 text-2xl font-bold">{loading || card.count === null ? '—' : card.count}</div>
              <p className="mt-1 text-xs text-muted-foreground">{card.description}</p>
              {!hasFormKeyAccess && (
                <p className="mt-3 text-[11px] font-medium text-muted-foreground">FormKey access required</p>
              )}
            </>
          )

          if (!hasFormKeyAccess) {
            return (
              <div
                key={card.key}
                aria-disabled="true"
                className="rounded-xl border bg-muted/20 p-3 opacity-80"
              >
                {content}
              </div>
            )
          }

          return (
            <a
              key={card.key}
              href={card.href}
              className="rounded-xl border bg-muted/20 p-3 transition-colors hover:bg-muted/35"
            >
              {content}
            </a>
          )
        })}
      </div>

      <div className="mt-4 rounded-xl border border-dashed bg-background/70 px-3 py-2.5 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5 font-medium text-foreground">
          <ClipboardText size={12} />
          Read-only handoff
        </span>
        <span className="ml-2">
          Build, go live, intake, and review now anchor in FormKey instead of splitting across Governance and Vault.
        </span>
      </div>
    </div>
  )
}
