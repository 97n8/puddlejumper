import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { ArrowRight, FileText, ShieldCheck, Vault as VaultIcon } from '@phosphor-icons/react'

import { VaultPanel } from '@/components/VaultPanel'

type VaultWorkspaceTab = 'docs' | 'vault'
const DEFAULT_TABS: VaultWorkspaceTab[] = ['docs', 'vault']

function normalizeTab(tab: VaultWorkspaceTab, availableTabs: VaultWorkspaceTab[]): VaultWorkspaceTab {
  return availableTabs.includes(tab) ? tab : availableTabs[0]
}

function resolveTab(pathname: string, search: string): VaultWorkspaceTab {
  const params = new URLSearchParams(search)
  const requested = params.get('tab')
  if (requested === 'vault' || requested === 'documents') return 'vault'
  return 'docs'
}

function DocsHome({ onOpenForms, onOpenVault }: { onOpenForms: () => void; onOpenVault: () => void }) {
  return (
    <div className="h-full overflow-auto bg-[radial-gradient(circle_at_top_left,rgba(14,165,233,0.08),transparent_24%),hsl(var(--background))]">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 p-6 lg:p-8">
        <div className="rounded-[28px] border border-border/80 bg-background/90 p-7 shadow-[0_24px_80px_rgba(15,23,42,0.05)]">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-3xl">
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-sky-600 dark:text-sky-300">Docs workspace</div>
              <h2 className="mt-2 text-3xl font-bold tracking-tight text-foreground">Forms create records. Vault keeps custody.</h2>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-muted-foreground">
                Use <span className="font-medium text-foreground">Forms</span> to publish governed intake and internal entry points. Use <span className="font-medium text-foreground">Vault</span> like the storage side of the suite to manage documents, supporting files, and audited exports.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <button
                onClick={onOpenForms}
                className="inline-flex items-center gap-2 rounded-2xl bg-sky-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-sky-700"
              >
                Open Forms
                <ArrowRight size={14} />
              </button>
              <button
                onClick={onOpenVault}
                className="inline-flex items-center gap-2 rounded-2xl border border-border bg-background px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted/40"
              >
                Open Vault
                <ArrowRight size={14} />
              </button>
            </div>
          </div>
        </div>

        <div className="grid gap-4 xl:grid-cols-2">
          <button
            onClick={onOpenForms}
            className="rounded-[28px] border border-border/80 bg-background/90 p-6 text-left shadow-[0_24px_80px_rgba(15,23,42,0.04)] transition-colors hover:bg-muted/10"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-sky-500/20 bg-sky-500/10">
                <FileText size={20} className="text-sky-500" />
              </div>
              <div>
                <div className="text-lg font-semibold text-foreground">Forms</div>
                <div className="text-xs text-muted-foreground">Build the intake and document-entry layer</div>
              </div>
            </div>
            <p className="mt-4 text-sm leading-6 text-muted-foreground">
              Create public or staff forms, set governance requirements, publish links, and route each submission into a governed record.
            </p>
            <div className="mt-5 inline-flex items-center gap-2 text-sm font-medium text-sky-600 dark:text-sky-300">
              Go to Forms
              <ArrowRight size={14} />
            </div>
          </button>

          <button
            onClick={onOpenVault}
            className="rounded-[28px] border border-border/80 bg-background/90 p-6 text-left shadow-[0_24px_80px_rgba(15,23,42,0.04)] transition-colors hover:bg-muted/10"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-emerald-500/20 bg-emerald-500/10">
                <VaultIcon size={20} className="text-emerald-600 dark:text-emerald-300" />
              </div>
              <div>
                <div className="text-lg font-semibold text-foreground">Vault</div>
                <div className="text-xs text-muted-foreground">Drive-like document custody with governance attached</div>
              </div>
            </div>
            <p className="mt-4 text-sm leading-6 text-muted-foreground">
              Open the record store for drafts, attachments, exports, and audited files. This is the storage side of the suite, not a separate app you have to hunt for.
            </p>
            <div className="mt-5 inline-flex items-center gap-2 text-sm font-medium text-emerald-700 dark:text-emerald-300">
              Go to Vault
              <ArrowRight size={14} />
            </div>
          </button>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          {[
            {
              title: 'Start in Docs',
              body: 'Land here first when someone needs a new intake surface or a place to store a governed document set.',
            },
            {
              title: 'Move into Forms',
              body: 'Build the collection layer: public intake, internal submission, approval rules, and publish/share controls.',
            },
            {
              title: 'Finish in Vault',
              body: 'Open the storage side to manage files, documents, exports, and permanent custody history.',
            },
          ].map(card => (
            <div key={card.title} className="rounded-3xl border border-border/70 bg-card/70 p-5">
              <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                <ShieldCheck size={13} />
                {card.title}
              </div>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">{card.body}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export function VaultWorkspacePanel() {
  const location = useLocation()
  const navigate = useNavigate()
  const enabledTabs = useMemo(() => DEFAULT_TABS, [])
  const requestedTab = useMemo(() => new URLSearchParams(location.search).get('tab'), [location.search])
  const derivedTab = useMemo(
    () => normalizeTab(resolveTab(location.pathname, location.search), enabledTabs),
    [enabledTabs, location.pathname, location.search]
  )
  const [tab, setTab] = useState<VaultWorkspaceTab>(derivedTab)

  useEffect(() => {
    if (location.pathname === '/vault' && requestedTab === 'forms') {
      navigate('/formkey', { replace: true })
    }
  }, [location.pathname, navigate, requestedTab])

  useEffect(() => {
    setTab(derivedTab)
  }, [derivedTab])

  const selectTab = (next: VaultWorkspaceTab) => {
    if (!enabledTabs.includes(next)) return
    setTab(next)
    const target = next === 'vault' ? '/vault?tab=vault' : '/vault'
    navigate(target)
  }

  if (location.pathname === '/vault' && requestedTab === 'forms') {
    return null
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-background">
      <div className="flex shrink-0 items-center gap-1 border-b border-border bg-muted/20 px-4 py-2.5">
        {enabledTabs.map((availableTab) => (
          <button
            key={availableTab}
            onClick={() => selectTab(availableTab)}
            className={`rounded-md px-3 py-1.5 text-xs font-medium capitalize transition-colors ${
              tab === availableTab
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {availableTab}
          </button>
        ))}
      </div>

      <div className="min-h-0 flex-1 overflow-hidden">
        {tab === 'docs' && <DocsHome onOpenForms={() => navigate('/formkey')} onOpenVault={() => selectTab('vault')} />}
        {tab === 'vault' && <VaultPanel />}
      </div>
    </div>
  )
}
