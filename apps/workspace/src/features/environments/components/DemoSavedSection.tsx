import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ClipboardText, Sparkle, ArrowSquareIn, Database } from '@phosphor-icons/react'
import { getVaultModule, type BuilderSession } from '@/lib/vault-modules'
import type { DemoTownTab } from '../demo/townCaseDemoData'

interface DemoSavedSectionProps {
  demoSavedSessions: BuilderSession[]
  onResumeSavedSession?: (sessionId: string) => void
  onOpenTab?: (tab: DemoTownTab) => void
}

export function DemoSavedSection({
  demoSavedSessions,
  onResumeSavedSession,
  onOpenTab,
}: DemoSavedSectionProps) {
  return (
    <div className="h-full min-h-0 overflow-y-auto bg-muted/10 px-5 py-5 text-foreground">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-5">
        <section className="rounded-3xl border border-emerald-400/20 bg-card/95 p-6 shadow-[0_20px_60px_-30px_rgba(52,211,153,0.28)] backdrop-blur">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.24em] text-emerald-700 dark:text-emerald-300">
                <ClipboardText size={14} weight="fill" />
                My modules
              </div>
              <h2 className="mt-2 text-3xl font-semibold tracking-tight text-foreground">Your saved demo builds live here.</h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
                Builds are saved to this demo user only. Resume them in Module Maker without leaving the demo or opening the broader app.
              </p>
            </div>
            <Button className="gap-2" onClick={() => onOpenTab?.('maker')}>
              <Sparkle size={14} weight="fill" />
              Start a new module build
            </Button>
          </div>
        </section>

        {demoSavedSessions.length === 0 ? (
          <section className="rounded-3xl border border-border/80 bg-card/95 p-8 text-center shadow-[0_20px_60px_-30px_rgba(15,23,42,0.7)]">
            <div className="mx-auto max-w-xl">
              <div className="text-lg font-semibold text-foreground">No saved demo modules yet.</div>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Open Module Maker, build something for a town, and it will show up here the next time this demo user returns.
              </p>
            </div>
          </section>
        ) : (
          <section className="grid gap-4 xl:grid-cols-2">
            {demoSavedSessions.map(session => {
              const moduleLabels = session.selectedModuleIds
                .map(id => getVaultModule(id)?.name ?? id)
                .slice(0, 4)

              return (
                <article
                  key={session.id}
                  className="rounded-3xl border border-border/80 bg-card/95 p-5 shadow-[0_20px_60px_-30px_rgba(15,23,42,0.7)]"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="text-lg font-semibold text-foreground">{session.town || 'Municipal module build'}</div>
                      <div className="mt-1 text-sm text-muted-foreground">
                        {session.selectedModuleIds.length} module{session.selectedModuleIds.length !== 1 ? 's' : ''} · saved {new Date(session.updatedAt).toLocaleString()}
                      </div>
                    </div>
                    <Badge
                      variant="secondary"
                      className={`border px-2 py-1 text-[10px] uppercase tracking-[0.16em] ${
                        session.status === 'activated'
                          ? 'border-emerald-300/30 bg-emerald-400/10 text-emerald-700 dark:text-emerald-200'
                          : session.status === 'review'
                            ? 'border-amber-300/30 bg-amber-400/10 text-amber-700 dark:text-amber-100'
                            : 'border-border/80 bg-card/95 text-foreground'
                      }`}
                    >
                      {session.status}
                    </Badge>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    {moduleLabels.map(label => (
                      <span
                        key={label}
                        className="rounded-full border border-border/80 bg-card/95 px-3 py-1 text-xs text-foreground"
                      >
                        {label}
                      </span>
                    ))}
                  </div>

                  <div className="mt-5 flex flex-wrap gap-2">
                    <Button className="gap-2" onClick={() => onResumeSavedSession?.(session.id)}>
                      <ArrowSquareIn size={14} weight="fill" />
                      Resume in Module Maker
                    </Button>
                    <Button variant="secondary" className="gap-2" onClick={() => onOpenTab?.('dashboard')}>
                      <Database size={14} weight="fill" />
                      Open LogicDASH
                    </Button>
                  </div>
                </article>
              )
            })}
          </section>
        )}
      </div>
    </div>
  )
}
