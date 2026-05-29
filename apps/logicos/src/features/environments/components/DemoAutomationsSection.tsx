import { Button } from '@/components/ui/button'
import { ClipboardText, DownloadSimple, Files } from '@phosphor-icons/react'
import type { DemoModule, DemoArtifact } from '../demo/townCaseDemoData'
import { AUTOMATION_EXHIBITS } from '../demo/townCaseDemoData'

interface DemoAutomationsSectionProps {
  selectedModule: DemoModule
  busyAction: string | null
  automationRunbookArtifact: DemoArtifact | null
  onProvisionAutomationPreview: () => void
  onAddAutomationPreviewToWorkspace: () => void
  onSendAutomationPreview: () => void
  operatorEmail: string
}

export function DemoAutomationsSection({
  selectedModule,
  busyAction,
  automationRunbookArtifact,
  onProvisionAutomationPreview,
  onAddAutomationPreviewToWorkspace,
  onSendAutomationPreview,
  operatorEmail,
}: DemoAutomationsSectionProps) {
  return (
    <div className="h-full min-h-0 overflow-y-auto bg-muted/10 text-foreground">
      <div className="mx-auto flex max-w-7xl flex-col gap-6 px-6 py-6">
        <section className="rounded-3xl border border-border/80 bg-card/95 p-5">
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Automations</div>
          <div className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
            Quiet handoffs from the governed work queue into the places work actually needs to go: leadership views, shared files, archives, downstream systems, and public-facing outputs.
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          {AUTOMATION_EXHIBITS.map(item => (
            <div key={item.title} className="rounded-3xl border border-border/80 bg-card/95 p-4">
              <div className="text-sm font-medium text-foreground">{item.title}</div>
              <div className="mt-2 text-sm leading-6 text-muted-foreground">{item.summary}</div>
              <div className="mt-3 rounded-2xl border border-border/80 bg-muted/25 px-3 py-2 text-xs text-muted-foreground">
                {item.output}
              </div>
            </div>
          ))}
        </section>

        <section className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-3xl border border-border/80 bg-card/95 p-5">
            <div className="mb-3 text-sm font-medium text-foreground">Automation preview stack</div>
            <div className="space-y-3">
              {selectedModule.suggestedAutomations.map(item => (
                <div key={item} className="rounded-2xl border border-border/80 bg-muted/25 p-4">
                  <div className="text-sm text-foreground">{item}</div>
                  <div className="mt-1 text-xs text-muted-foreground">Contained preview for {selectedModule.label.toLowerCase()} in the current trial.</div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-3xl border border-border/80 bg-card/95 p-5">
            <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Automation actions</div>
            <div className="mt-3 grid gap-2">
              <Button className="justify-start gap-2" onClick={onProvisionAutomationPreview} disabled={busyAction !== null || !automationRunbookArtifact}>
                <Files size={16} />
                {busyAction === 'provision-automation' ? 'Provisioning automation preview…' : 'Provision automation preview'}
              </Button>
              <Button variant="secondary" className="justify-start gap-2" onClick={onAddAutomationPreviewToWorkspace} disabled={busyAction !== null || !automationRunbookArtifact}>
                <DownloadSimple size={16} />
                {busyAction === 'workspace-automation' ? 'Saving automation preview…' : 'Save + download automation preview'}
              </Button>
              <Button variant="outline" className="justify-start gap-2 border-border/80 bg-transparent text-foreground hover:bg-muted/60 hover:text-foreground" onClick={onSendAutomationPreview} disabled={busyAction !== null || !automationRunbookArtifact}>
                <ClipboardText size={16} />
                {busyAction === 'send-automation' ? 'Preparing automation preview…' : `Send automation preview to ${operatorEmail}`}
              </Button>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
