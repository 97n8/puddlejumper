import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'

interface PlanTabProps {
  workspaceUsage: {
    plan: string
    limits: Record<string, number>
    usage: Record<string, number>
    at_limit: boolean
  } | null
  authUser: { workspaceName?: string | null; workspaceId?: string } | null
}

export function PlanTab({ workspaceUsage, authUser }: PlanTabProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Workspace</CardTitle>
        <CardDescription>
          {authUser?.workspaceName
            ? `Workspace: ${authUser.workspaceName}`
            : `Workspace ID: ${authUser?.workspaceId}`}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {workspaceUsage ? (
          <>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Plan</span>
              <Badge className="capitalize">{workspaceUsage.plan}</Badge>
            </div>
            <Separator />
            {(['members', 'templates', 'approvals'] as const).map((key) => {
              const used = workspaceUsage.usage?.[key] ?? 0
              const limit = workspaceUsage.limits?.[key] ?? -1
              const pct = limit > 0 ? Math.min(100, (used / limit) * 100) : 0
              return (
                <div key={key} className="space-y-1.5">
                  <div className="flex justify-between text-sm">
                    <span className="capitalize text-muted-foreground">{key}</span>
                    <span className="font-medium font-mono">
                      {used} / {limit === -1 ? '∞' : limit}
                      {limit > 0 && used >= limit && (
                        <Badge variant="destructive" className="ml-2 text-[10px]">AT LIMIT</Badge>
                      )}
                    </span>
                  </div>
                  {limit > 0 && (
                    <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${pct >= 90 ? 'bg-destructive' : pct >= 70 ? 'bg-yellow-500' : 'bg-primary'}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  )}
                </div>
              )
            })}
            <Separator />
            <p className="text-xs text-muted-foreground pt-1">
              Tier caps are currently disabled. Workspace usage is shown for visibility only.
            </p>
          </>
        ) : (
          <p className="text-sm text-muted-foreground py-4 text-center">
            Loading workspace usage from PuddleJumper…
          </p>
        )}
      </CardContent>
    </Card>
  )
}
