import { Button } from '@/components/ui/button'
import { ClipboardText, DownloadSimple, Files } from '@phosphor-icons/react'
import type { DemoArtifact } from '../demo/townCaseDemoData'
import { LOGICDOC_EXHIBITS } from '../demo/townCaseDemoData'

interface DemoLogicDocsSectionProps {
  logicDocsPreviewDoc: string
  busyAction: string | null
  implementationPacketArtifact: DemoArtifact | null
  logicDocsArtifacts: DemoArtifact[]
  onDownloadLogicDocsPreview: () => void
  onAddLogicDocsPreviewToWorkspace: () => void
  onSendLogicDocsPreview: () => void
  operatorEmail: string
}

export function DemoLogicDocsSection({
  logicDocsPreviewDoc,
  busyAction,
  implementationPacketArtifact,
  logicDocsArtifacts,
  onDownloadLogicDocsPreview,
  onAddLogicDocsPreviewToWorkspace,
  onSendLogicDocsPreview,
  operatorEmail,
}: DemoLogicDocsSectionProps) {
  return (
    <div className="h-full min-h-0 overflow-y-auto bg-muted/10 text-foreground">
      <div className="mx-auto flex max-w-7xl flex-col gap-6 px-6 py-6">
        <section className="rounded-3xl border border-border/80 bg-card/95 p-5">
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">LogicDocs</div>
          <div className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
            Preview limited document surfaces inside the case-space: executive briefs, build sheets, and implementation packets that feel ready to use right now.
          </div>
        </section>

        <section className="rounded-3xl border border-border/80 bg-card/95 p-5">
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Document set in this trial</div>
          <div className="mt-3 grid gap-3 md:grid-cols-3">
            {LOGICDOC_EXHIBITS.map(item => (
              <div key={item} className="rounded-2xl border border-border/80 bg-muted/25 px-4 py-3 text-sm leading-6 text-muted-foreground">
                {item}
              </div>
            ))}
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-[1.25fr_0.75fr]">
          <div className="rounded-3xl border border-border/80 bg-card/95 p-3">
            <iframe
              srcDoc={logicDocsPreviewDoc}
              title="LogicDocs preview"
              className="h-[520px] w-full rounded-3xl border-0 bg-white"
              sandbox="allow-scripts"
            />
          </div>

          <div className="rounded-3xl border border-border/80 bg-card/95 p-5">
            <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">LogicDocs actions</div>
            <div className="mt-3 grid gap-2">
              <Button className="justify-start gap-2" onClick={onDownloadLogicDocsPreview} disabled={busyAction !== null || !implementationPacketArtifact}>
                <DownloadSimple size={16} />
                {busyAction === 'download-logicdocs' ? 'Downloading LogicDocs preview…' : 'Download LogicDocs preview'}
              </Button>
              <Button variant="secondary" className="justify-start gap-2" onClick={onAddLogicDocsPreviewToWorkspace} disabled={busyAction !== null || logicDocsArtifacts.length === 0}>
                <Files size={16} />
                {busyAction === 'workspace-logicdocs' ? 'Saving LogicDocs preview…' : 'Save + download LogicDocs preview'}
              </Button>
              <Button variant="outline" className="justify-start gap-2 border-border/80 bg-transparent text-foreground hover:bg-muted/60 hover:text-foreground" onClick={onSendLogicDocsPreview} disabled={busyAction !== null || !implementationPacketArtifact}>
                <ClipboardText size={16} />
                {busyAction === 'send-logicdocs' ? 'Preparing LogicDocs preview…' : `Send LogicDocs preview to ${operatorEmail}`}
              </Button>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
