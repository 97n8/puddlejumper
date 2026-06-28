import { LockKey, ArrowLeft, EnvelopeOpen } from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/services/auth/AuthContext'
import { getTool } from '@/lib/tools-registry'

interface AccessGateProps {
  toolKey: string
  onBack: () => void
}

export function AccessGate({ toolKey, onBack }: AccessGateProps) {
  const { user } = useAuth()
  const tool = getTool(toolKey)
  const role = user?.role ?? 'member'

  return (
    <div className="flex-1 flex items-center justify-center bg-background p-8">
      <div className="max-w-md w-full text-center space-y-6">
        {/* Icon */}
        <div className="flex justify-center">
          <div className="w-20 h-20 rounded-2xl bg-muted flex items-center justify-center">
            <LockKey size={40} weight="duotone" className="text-muted-foreground" />
          </div>
        </div>

        {/* Heading */}
        <div className="space-y-2">
          <h2 className="text-2xl font-semibold tracking-tight">{tool.label}</h2>
          {tool.description && (
            <p className="text-muted-foreground text-sm">{tool.description}</p>
          )}
        </div>

        {/* Message */}
        <div className="p-4 rounded-xl border border-border bg-card text-left space-y-3">
          <p className="text-sm font-medium">Access not configured for your account</p>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Your current role (<span className="font-medium text-foreground capitalize">{role}</span>) doesn't
            include access to <span className="font-medium text-foreground">{tool.label}</span>.
            If you believe this is an error, please reach out to your workspace administrator.
          </p>
        </div>

        {/* Role clarity */}
        <RoleExplainer role={role} />

        {/* Actions */}
        <div className="flex flex-col gap-2">
          <Button variant="outline" className="gap-2 w-full" onClick={onBack}>
            <ArrowLeft size={16} />
            Back to Dashboard
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="gap-2 text-muted-foreground text-xs"
            onClick={() => window.open('mailto:admin@publiclogic.org?subject=Access%20Request&body=I%20need%20access%20to%20' + encodeURIComponent(tool.label), '_blank')}
          >
            <EnvelopeOpen size={14} />
            Request access from admin
          </Button>
        </div>
      </div>
    </div>
  )
}

function RoleExplainer({ role }: { role: string }) {
  const TIERS = [
    {
      name: 'Public',
      roles: ['public'],
      color: 'text-slate-500',
      dot: 'bg-slate-400',
      access: 'View public content only. No workspace tools.',
    },
    {
      name: 'Member',
      roles: ['member', 'viewer'],
      color: 'text-blue-600 dark:text-blue-400',
      dot: 'bg-blue-500',
      access: 'Access to tools and environments assigned by an admin.',
    },
    {
      name: 'Admin / Owner',
      roles: ['admin', 'owner'],
      color: 'text-primary',
      dot: 'bg-primary',
      access: 'Full access to all tools, workspaces, and user management.',
    },
  ]

  const currentTier = TIERS.find(t => t.roles.includes(role)) ?? TIERS[1]

  return (
    <div className="text-left border border-border rounded-xl overflow-hidden">
      <div className="px-3 py-2 bg-muted text-xs font-semibold text-muted-foreground uppercase tracking-wider">
        Access Levels
      </div>
      {TIERS.map(tier => (
        <div
          key={tier.name}
          className={`flex items-start gap-3 px-4 py-3 border-t border-border transition-colors
            ${tier === currentTier ? 'bg-primary/5' : ''}`}
        >
          <span className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${tier.dot}`} />
          <div className="flex-1 min-w-0">
            <div className={`text-sm font-medium flex items-center gap-2 ${tier.color}`}>
              {tier.name}
              {tier === currentTier && (
                <span className="text-[10px] font-normal bg-primary/10 text-primary px-1.5 py-0.5 rounded-full">
                  You
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">{tier.access}</p>
          </div>
        </div>
      ))}
    </div>
  )
}
