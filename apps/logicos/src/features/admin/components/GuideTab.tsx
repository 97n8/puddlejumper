import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Globe, Key, Wrench, Eye, Crown, Plug, Info } from '@phosphor-icons/react'

export function GuideTab() {
  return (
    <>
      <div>
        <h2 className="text-xl font-semibold">User Guide & Platform Instructions</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Share this information with your members so they know how to get started.
        </p>
      </div>

      {/* Getting Started */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Globe size={18} className="text-primary" />
            Getting Started
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>
            <strong className="text-foreground">PublicLogic</strong> is a provider-agnostic platform. You can sign in with any supported identity provider — GitHub, Google, or Microsoft — and connect additional accounts afterward. You are not locked into any single ecosystem.
          </p>
          <ol className="list-decimal list-inside space-y-2 pl-1">
            <li>Go to <span className="font-mono text-xs bg-muted px-1 py-0.5 rounded">os.publiclogic.org</span> and click <strong className="text-foreground">Sign in</strong>.</li>
            <li>Choose whichever provider you already have — GitHub, Google, or Microsoft.</li>
            <li>Once signed in, open <strong className="text-foreground">Connections</strong> to link additional providers.</li>
            <li>Your admin has assigned tools to your account. Use the sidebar to navigate to what's available.</li>
          </ol>
        </CardContent>
      </Card>

      {/* Access & Permissions */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Key size={18} className="text-primary" />
            Access Levels
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="grid gap-3">
            <div className="flex items-start gap-3 p-3 rounded-lg border bg-card">
              <Globe size={16} className="mt-0.5 text-muted-foreground shrink-0" />
              <div>
                <p className="font-medium text-foreground">Public</p>
                <p className="text-muted-foreground text-xs mt-0.5">Anyone can view non-restricted content without an account.</p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-3 rounded-lg border bg-card">
              <Eye size={16} className="mt-0.5 text-primary shrink-0" />
              <div>
                <p className="font-medium text-foreground">Member — Viewer</p>
                <p className="text-muted-foreground text-xs mt-0.5">Invited users with read access to specific tools and environments assigned by your admin.</p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-3 rounded-lg border bg-card">
              <Wrench size={16} className="mt-0.5 text-amber-500 shrink-0" />
              <div>
                <p className="font-medium text-foreground">Member — Contributor</p>
                <p className="text-muted-foreground text-xs mt-0.5">Can create, edit, and run automations within their assigned environments.</p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-3 rounded-lg border bg-card">
              <Crown size={16} className="mt-0.5 text-yellow-500 shrink-0" />
              <div>
                <p className="font-medium text-foreground">Owner / Admin</p>
                <p className="text-muted-foreground text-xs mt-0.5">Full access to all tools, workspace settings, member management, and connectors.</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tools Reference */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Wrench size={18} className="text-primary" />
            Available Tools
          </CardTitle>
          <CardDescription>Members only see tools their admin has enabled for them.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2 text-sm">
            {[
              { key: 'vault', label: 'Vault', desc: 'Secure credential and secret storage.' },
              { key: 'builder', label: 'Builder', desc: 'API endpoint and integration builder.' },
              { key: 'automations', label: 'Automations', desc: 'Workflow automation and scheduling.' },
              { key: 'casespaces', label: 'CaseSpaces', desc: 'Case management and collaboration.' },
              { key: 'civicpulse', label: 'CivicPulse™', desc: 'Civic transparency engine — approval queue, publication log, backstop monitor.' },
              { key: 'settings', label: 'Settings', desc: 'Personal account settings.' },
            ].map(tool => (
              <div key={tool.key} className="flex items-start gap-3 py-2 border-b last:border-0">
                <span className="font-medium text-foreground w-32 shrink-0">{tool.label}</span>
                <span className="text-muted-foreground">{tool.desc}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Connecting Providers */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Plug size={18} className="text-primary" />
            Connecting Additional Accounts
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p>After signing in, you can link additional identity providers from the <strong className="text-foreground">Connections</strong> panel (plug icon in the toolbar).</p>
          <p>Each connected account extends what the platform can do on your behalf — for example, connecting Microsoft enables access to your OneDrive, Teams, and calendar data through PuddleJumper's secure proxy.</p>
          <p className="text-xs">Tokens are never stored in your browser. All provider credentials are held server-side by PuddleJumper.</p>
        </CardContent>
      </Card>

      {/* Support */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Info size={18} className="text-primary" />
            Support & Contact
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-1">
          <p>For access issues or questions, contact your workspace admin directly.</p>
          <p>Platform communications are sent from <span className="font-mono text-xs bg-muted px-1 py-0.5 rounded text-foreground">pj@publiclogic.org</span>.</p>
        </CardContent>
      </Card>
    </>
  )
}
