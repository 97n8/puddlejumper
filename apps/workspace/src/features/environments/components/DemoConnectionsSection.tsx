import { Button } from '@/components/ui/button'
import { ClipboardText, DownloadSimple, Files } from '@phosphor-icons/react'
import type { DemoArtifact } from '../demo/townCaseDemoData'
import { DATA_SOURCES, CONNECTION_EXHIBITS } from '../demo/townCaseDemoData'

interface DemoConnectionsSectionProps {
  activeSourceIds: string[]
  onToggleSource: (sourceId: string) => void
  busyAction: string | null
  logicDashSourceMapArtifact: DemoArtifact | null
  onProvisionConnectionPreview: () => void
  onAddConnectionPreviewToWorkspace: () => void
  onSendConnectionPreview: () => void
  operatorEmail: string
}

export function DemoConnectionsSection({
  activeSourceIds,
  onToggleSource,
  busyAction,
  logicDashSourceMapArtifact,
  onProvisionConnectionPreview,
  onAddConnectionPreviewToWorkspace,
  onSendConnectionPreview,
  operatorEmail: _operatorEmail,
}: DemoConnectionsSectionProps) {
  return (
    <div className="h-full min-h-0 overflow-y-auto bg-muted/10 text-foreground">
      <div className="mx-auto flex max-w-7xl flex-col gap-6 px-6 py-6">
        <section className="rounded-3xl border border-border/80 bg-card/95 p-5">
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Connections</div>
          <div className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
            Town files come in, governed packets go out. Finance systems, websites, civic software, and other connectors sit on the edge instead of trapping the work.
          </div>
        </section>

        <section className="rounded-3xl border border-border/80 bg-card/95 p-5">
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Live-source picture</div>
          <div className="mt-3 grid gap-3 md:grid-cols-3">
            {CONNECTION_EXHIBITS.map(item => (
              <div key={item} className="rounded-2xl border border-border/80 bg-muted/25 px-4 py-3 text-sm leading-6 text-muted-foreground">
                {item}
              </div>
            ))}
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
          <div className="rounded-3xl border border-border/80 bg-card/95 p-5">
            <div className="space-y-2">
              {DATA_SOURCES.map(source => {
                const active = activeSourceIds.includes(source.id)
                return (
                  <button
                    key={source.id}
                    type="button"
                    onClick={() => onToggleSource(source.id)}
                    className={`w-full rounded-2xl border px-4 py-4 text-left transition ${
                      active
                        ? 'border-amber-300/30 bg-amber-300/10 text-foreground'
                        : 'border-border/80 bg-muted/25 text-muted-foreground hover:border-border'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <span className="mt-0.5 text-lg">{source.icon}</span>
                        <div>
                          <div className="text-sm font-medium">{source.label}</div>
                          <div className="mt-1 text-xs uppercase tracking-[0.16em] text-muted-foreground">
                            {source.category} · {source.status === 'demo-ready' ? 'shown in preview' : 'live on connect'}
                          </div>
                          <div className="mt-2 text-sm leading-6 text-muted-foreground">{source.summary}</div>
                          <div className="mt-2 text-xs leading-5 text-muted-foreground">{source.liveNote}</div>
                        </div>
                      </div>
                      <div className={`mt-1 h-2.5 w-2.5 rounded-full ${active ? 'bg-emerald-400' : 'bg-border'}`} />
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          <div className="rounded-3xl border border-border/80 bg-card/95 p-5">
            <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Connection actions</div>
            <div className="mt-3 grid gap-2">
              <Button className="justify-start gap-2" onClick={onProvisionConnectionPreview} disabled={busyAction !== null || !logicDashSourceMapArtifact}>
                <Files size={16} />
                {busyAction === 'provision-connections' ? 'Provisioning connection preview…' : 'Provision connection preview'}
              </Button>
              <Button variant="secondary" className="justify-start gap-2" onClick={onAddConnectionPreviewToWorkspace} disabled={busyAction !== null || !logicDashSourceMapArtifact}>
                <DownloadSimple size={16} />
                {busyAction === 'workspace-connections' ? 'Adding connection preview…' : 'Drop connection preview in Workspace'}
              </Button>
              <Button variant="outline" className="justify-start gap-2 border-border/80 bg-transparent text-foreground hover:bg-muted/60 hover:text-foreground" onClick={onSendConnectionPreview} disabled={busyAction !== null || !logicDashSourceMapArtifact}>
                <ClipboardText size={16} />
                {busyAction === 'send-connections' ? 'Preparing connection preview…' : 'Send connection preview to yourself'}
              </Button>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
