import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ClipboardText, DownloadSimple, Files } from '@phosphor-icons/react'
import type { TrialApp } from '../demo/townCaseDemoData'
import { TRIAL_APPS } from '../demo/townCaseDemoData'

interface DemoAppsSectionProps {
  selectedApp: TrialApp
  setSelectedAppId: (id: string) => void
  appPreviewDoc: string
  operatorEmail: string
  busyAction: string | null
  onProvisionAppPack: () => void
  onAddAppPackToWorkspace: () => void
  onSendAppSpecToSelf: () => void
}

export function DemoAppsSection({
  selectedApp,
  setSelectedAppId,
  appPreviewDoc,
  operatorEmail,
  busyAction,
  onProvisionAppPack,
  onAddAppPackToWorkspace,
  onSendAppSpecToSelf,
}: DemoAppsSectionProps) {
  return (
    <div className="h-full min-h-0 overflow-y-auto bg-muted/10 text-foreground">
      <div className="mx-auto flex max-w-7xl flex-col gap-6 px-6 py-6">
        <section className="rounded-3xl border border-border/80 bg-card/95 p-5">
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Apps</div>
          <div className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
            Drive front-door municipal app surfaces here. Each preview is enclosed inside the case-space and tied directly to the governed lane instead of sending users out to learn another tool.
          </div>
        </section>

        <section className="rounded-3xl border border-border/80 bg-card/95 p-5">
          <div className="grid gap-5 lg:grid-cols-[320px_minmax(0,1fr)]">
            <div className="space-y-3">
              {TRIAL_APPS.map(app => (
                <button
                  key={app.id}
                  type="button"
                  onClick={() => setSelectedAppId(app.id)}
                  className={`w-full rounded-2xl border p-4 text-left transition ${
                    selectedApp.id === app.id
                      ? 'border-amber-300/40 bg-amber-300/10 text-foreground'
                      : 'border-border/80 bg-muted/25 text-muted-foreground hover:border-border'
                  }`}
                >
                  <div className="text-sm font-medium">{app.name}</div>
                  <div className="mt-1 text-xs uppercase tracking-[0.16em] text-muted-foreground">{app.audience}</div>
                  <div className="mt-2 text-sm leading-6 text-muted-foreground">{app.summary}</div>
                </button>
              ))}
            </div>

            <div className="space-y-4">
              <div className="rounded-2xl border border-border/80 bg-muted/25 p-3">
                <iframe
                  srcDoc={appPreviewDoc}
                  title="Trial app preview"
                  className="h-[380px] w-full rounded-2xl border-0"
                  sandbox="allow-scripts"
                />
              </div>

              <div className="grid gap-4 md:grid-cols-[1fr_0.9fr]">
                <div className="rounded-2xl border border-border/80 bg-muted/25 p-4">
                  <div className="text-sm font-medium text-foreground">{selectedApp.name}</div>
                  <div className="mt-2 text-sm leading-6 text-muted-foreground">{selectedApp.outcome}</div>
                  <div className="mt-4 text-xs uppercase tracking-[0.16em] text-muted-foreground">Key fields</div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {selectedApp.keyFields.map(field => (
                      <Badge key={field} variant="secondary" className="bg-muted/40 text-foreground">{field}</Badge>
                    ))}
                  </div>
                </div>

                <div className="rounded-2xl border border-border/80 bg-muted/25 p-4">
                  <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">App actions</div>
                  <div className="mt-3 grid gap-2">
                    <Button className="justify-start gap-2" onClick={onProvisionAppPack} disabled={busyAction !== null}>
                      <Files size={16} />
                      {busyAction === 'provision-app' ? 'Provisioning app pack…' : 'Provision app pack'}
                    </Button>
                    <Button variant="secondary" className="justify-start gap-2" onClick={onAddAppPackToWorkspace} disabled={busyAction !== null}>
                      <DownloadSimple size={16} />
                      {busyAction === 'workspace-app' ? 'Saving app pack…' : 'Save + download app pack'}
                    </Button>
                    <Button variant="outline" className="justify-start gap-2 border-border/80 bg-transparent text-foreground hover:bg-muted/60 hover:text-foreground" onClick={onSendAppSpecToSelf} disabled={busyAction !== null}>
                      <ClipboardText size={16} />
                      {busyAction === 'send-app' ? 'Preparing app spec…' : `Send app spec to ${operatorEmail}`}
                    </Button>
                  </div>
                  <div className="mt-3 rounded-2xl border border-border/80 bg-background/70 px-3 py-3 text-xs leading-5 text-muted-foreground">
                    This public entry can act as the constituent front door. Demo updates stay visible on screen and can also draft to <span className="font-medium text-foreground">{operatorEmail}</span>.
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
