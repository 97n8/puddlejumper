import {
  Warning, CheckCircle, SealCheck, Rocket,
  Spinner, WindowsLogo, GoogleLogo,
} from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import { VAULT_MODULES } from '@/lib/vault-modules'
import type { MakerState, ConnectorStatus } from '../types'
import { MODULE_EMOJI, DOMAIN_BADGE, DOMAIN_ACCENT } from '../utils/makerUtils'

export function ReviewStep({
  state, connectors, onActivate, activating,
}: {
  state: MakerState
  connectors: Record<string, ConnectorStatus>
  onActivate: () => void
  activating: boolean
}) {
  const unconfigured = state.selectedIds.filter(id => !state.setups[id]?.officerName)
  const ready = unconfigured.length === 0

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="px-10 pt-10 pb-6 border-b border-border">
        <div className="flex items-center gap-3 mb-2">
          <SealCheck size={28} className="text-primary" weight="duotone" />
          <h1 className="text-2xl font-bold">Review & Activate</h1>
        </div>
        <p className="text-muted-foreground text-sm">
          <strong>{state.selectedIds.length} compliance module{state.selectedIds.length !== 1 ? 's' : ''}</strong> for <strong>{state.town}</strong>
        </p>
      </div>

      <div className="mx-auto flex-1 w-full max-w-[1480px] overflow-y-auto px-10 py-8">
        {!ready && (
          <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mb-6 text-amber-800 text-sm">
            <Warning size={16} className="shrink-0" />
            <span>
              <strong>{unconfigured.length} module{unconfigured.length !== 1 ? 's' : ''}</strong> need an officer name:{' '}
              {unconfigured.map(id => VAULT_MODULES.find(v => v.id === id)?.name).join(', ')}
            </span>
          </div>
        )}

        <div className="space-y-4 max-w-3xl">
          {state.selectedIds.map(id => {
            const m = VAULT_MODULES.find(v => v.id === id)!
            const s = state.setups[id]
            const badge = DOMAIN_BADGE[m.domain] ?? ''
            const accent = DOMAIN_ACCENT[m.domain] ?? '#6b7280'
            const routedSlots = m.routingSlots.filter(slot => (s?.routing[slot.key] ?? 'none') !== 'none')

            return (
              <div key={id} className="bg-card border border-border rounded-xl overflow-hidden">
                <div className="flex items-center gap-4 p-5 border-b border-border">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center text-xl shrink-0" style={{ background: `${accent}15` }}>
                    {MODULE_EMOJI[id] ?? '⚙️'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="font-semibold text-sm">{m.name}</span>
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${badge}`}>{m.domain}</span>
                    </div>
                    <p className="text-xs text-muted-foreground font-mono">{m.mglCitation}</p>
                  </div>
                  {s?.officerName
                    ? <CheckCircle size={18} className="text-emerald-500 shrink-0" weight="fill" />
                    : <Warning size={18} className="text-amber-500 shrink-0" weight="fill" />
                  }
                </div>

                <div className="px-5 py-4 grid grid-cols-4 gap-4 text-xs">
                  <div>
                    <p className="text-muted-foreground font-medium mb-1">Officer</p>
                    <p className="font-semibold">{s?.officerName || <span className="text-amber-600">Not set</span>}</p>
                    {s?.officerTitle && <p className="text-muted-foreground">{s.officerTitle}</p>}
                    {s?.officerEmail && <p className="text-muted-foreground truncate">{s.officerEmail}</p>}
                  </div>
                  <div>
                    <p className="text-muted-foreground font-medium mb-1">Retention</p>
                    <p className="font-semibold">{s?.retentionYears ?? m.defaultRetentionYears} years</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground font-medium mb-1">Routing</p>
                    {routedSlots.length === 0
                      ? <p className="text-muted-foreground italic">No routing</p>
                      : routedSlots.map(slot => (
                          <p key={slot.key} className="capitalize">
                            {slot.key}: <span className="font-medium">{s?.routing[slot.key]}</span>
                          </p>
                        ))
                    }
                  </div>
                  <div>
                    <p className="text-muted-foreground font-medium mb-1">Workflow</p>
                    <p className="font-semibold">{s?.workflowSteps?.length ?? m.defaultWorkflowSteps.length} steps</p>
                  </div>
                </div>

                {/* Folder paths */}
                {routedSlots.length > 0 && (
                  <div className="px-5 pb-4 space-y-1 border-t border-border pt-3">
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Folder Paths</p>
                    {routedSlots.map(slot => {
                      const folder = s?.folders?.[slot.key]
                      const prov = s?.routing[slot.key]
                      const connected = prov === 'sharepoint' ? connectors['microsoft']?.connected : connectors['google']?.connected
                      return (
                        <div key={slot.key} className="flex items-center gap-2 text-xs">
                          {prov === 'sharepoint' ? <WindowsLogo size={11} className="text-[#0078D4]" weight="fill" /> : <GoogleLogo size={11} className="text-[#4285F4]" weight="fill" />}
                          <span className="text-muted-foreground">{slot.label}:</span>
                          <span className="font-mono text-foreground">{folder || <span className="italic text-muted-foreground">no path set</span>}</span>
                          {!connected && <span className="text-amber-600">⚠ not connected</span>}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        <div className="mt-10 max-w-3xl">
          <div className="bg-card border-2 border-primary/20 rounded-2xl p-8 text-center">
            <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <Rocket size={24} className="text-primary" weight="duotone" />
            </div>
            <h3 className="text-lg font-bold mb-2">Ready to Activate?</h3>
            <p className="text-sm text-muted-foreground mb-6 max-w-sm mx-auto">
              This will configure all {state.selectedIds.length} compliance module{state.selectedIds.length !== 1 ? 's' : ''} for {state.town} and save to VAULT.
            </p>
            <Button size="lg" onClick={onActivate} disabled={!ready || activating} className="px-10 font-semibold">
              {activating
                ? <><Spinner size={16} className="animate-spin mr-2" />Activating…</>
                : <><Rocket size={16} className="mr-2" weight="fill" />Activate for {state.town}</>
              }
            </Button>
            {!ready && <p className="text-xs text-amber-600 mt-3">Complete all officer names above to activate.</p>}
          </div>
        </div>
      </div>
    </div>
  )
}

export function DoneStep({ state, onReset, onViewEnvironments }: { state: MakerState; onReset: () => void; onViewEnvironments?: () => void }) {
  return (
    <div className="flex-1 flex items-center justify-center">
      <div className="text-center max-w-md">
        <div className="text-6xl mb-4">🏛️</div>
        <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-6">
          <CheckCircle size={32} className="text-emerald-600" weight="fill" />
        </div>
        <h2 className="text-2xl font-bold mb-3">{state.town} is live on VAULT</h2>
        <p className="text-muted-foreground text-sm mb-2">
          {state.selectedIds.length} compliance module{state.selectedIds.length !== 1 ? 's' : ''} activated and ready.
        </p>
        <div className="flex justify-center gap-2 mb-8 flex-wrap">
          {state.selectedIds.map(id => (
            <span key={id} className="text-xs bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full px-3 py-1 font-medium">
              {MODULE_EMOJI[id]} {VAULT_MODULES.find(v => v.id === id)?.name}
            </span>
          ))}
        </div>
        <div className="flex justify-center gap-2">
          {onViewEnvironments && (
            <Button onClick={() => { onReset(); onViewEnvironments() }}>View in Environments</Button>
          )}
          <Button variant="outline" onClick={onReset}>Configure Another Municipality</Button>
        </div>
      </div>
    </div>
  )
}
