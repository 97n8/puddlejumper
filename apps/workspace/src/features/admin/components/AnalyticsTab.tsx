import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ArrowClockwise } from '@phosphor-icons/react'
import { toast } from 'sonner'
import { pjApi } from '@/services/pjApi'

export function AnalyticsTab() {
  const [adminStats, setAdminStats] = useState<Record<string, number> | null>(null)

  const loadAdminStats = () => {
    pjApi.admin.stats()
      .then((data: unknown) => setAdminStats(data as Record<string, number>))
      .catch(() => toast.error('Could not load stats from PuddleJumper'))
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          PuddleJumper Governance Stats
          <Button size="sm" variant="outline" onClick={loadAdminStats}>
            <ArrowClockwise size={14} />
            Load Stats
          </Button>
        </CardTitle>
        <CardDescription>Live approval and dispatch metrics from PuddleJumper</CardDescription>
      </CardHeader>
      <CardContent>
        {!adminStats ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            Click "Load Stats" to fetch live data from PuddleJumper.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            {[
              { label: 'Pending Approvals', value: adminStats.pending },
              { label: 'Total Created', value: adminStats.approvalsCreated },
              { label: 'Approved', value: adminStats.approvalsApproved },
              { label: 'Rejected', value: adminStats.approvalsRejected },
              { label: 'Expired', value: adminStats.approvalsExpired },
              { label: 'Dispatched OK', value: adminStats.dispatchSuccess },
              { label: 'Dispatch Failed', value: adminStats.dispatchFailure },
              { label: 'Retries', value: adminStats.dispatchRetry },
              { label: 'Avg Approval (s)', value: adminStats.avgApprovalTimeSec?.toFixed(1) },
              { label: 'Avg Dispatch (s)', value: adminStats.avgDispatchLatencySec?.toFixed(1) },
              { label: 'Active Chain Steps', value: adminStats.activeChainSteps },
              { label: 'Success Rate', value: (() => {
                  const total = (adminStats.dispatchSuccess || 0) + (adminStats.dispatchFailure || 0)
                  return total ? `${((adminStats.dispatchSuccess / total) * 100).toFixed(1)}%` : 'N/A'
                })()
              },
            ].map(({ label, value }) => (
              <div key={label} className="border border-border rounded-lg p-4">
                <p className="text-xs text-muted-foreground mb-1">{label}</p>
                <p className="text-2xl font-display font-semibold">{value ?? '—'}</p>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
