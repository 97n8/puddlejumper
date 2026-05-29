import type { VaultCase } from '../types'
import type { CaseSpace } from '@/lib/types'

interface VaultEnvironmentSettingsPanelProps {
  town: string
  envId: string
  caseSpace: CaseSpace | undefined
  modules: string[]
  normalizedCases: VaultCase[]
  onModuleSettings: (moduleId: string) => void
}

export function VaultEnvironmentSettingsPanel({
  town,
  envId,
  caseSpace,
  modules,
  normalizedCases,
  onModuleSettings,
}: VaultEnvironmentSettingsPanelProps) {
  return (
    <div className="p-8 max-w-2xl mx-auto space-y-8">
      <div>
        <h2 className="text-lg font-semibold text-foreground mb-1">Environment Settings</h2>
        <p className="text-sm text-muted-foreground">
          Configure {caseSpace?.name ?? town} — top-level settings that apply across all modules in this environment.
        </p>
      </div>

      <div className="bg-slate-800/60 rounded-xl border border-border divide-y divide-slate-700">
        <div className="p-5">
          <h3 className="text-sm font-semibold text-foreground mb-1">Town Information</h3>
          <p className="text-xs text-muted-foreground mb-3">The name and identity shown on all public-facing documents and portals.</p>
          <div className="space-y-1 text-sm text-foreground/80">
            <div className="flex gap-2"><span className="text-muted-foreground w-28 shrink-0">Town name</span><span>{town}</span></div>
            <div className="flex gap-2"><span className="text-muted-foreground w-28 shrink-0">Environment ID</span><span className="font-mono text-xs text-muted-foreground">{envId}</span></div>
            {caseSpace?.visibility && <div className="flex gap-2"><span className="text-muted-foreground w-28 shrink-0">Access</span><span className="capitalize">{caseSpace.visibility}</span></div>}
            {(caseSpace?.members ?? []).length > 0 && (
              <div className="flex gap-2"><span className="text-muted-foreground w-28 shrink-0">Members</span><span>{(caseSpace?.members ?? []).join(', ')}</span></div>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-3">To edit name, color, or access — use the ✏ button on the Environments tab.</p>
        </div>

        <div className="p-5">
          <h3 className="text-sm font-semibold text-foreground mb-1">Active Modules</h3>
          <p className="text-xs text-muted-foreground mb-3">Each module has its own settings — officers, deadlines, retention, and more.</p>
          <div className="space-y-2">
            {modules.length === 0 && <p className="text-xs text-muted-foreground">No modules configured.</p>}
            {modules.map(modId => (
              <button key={modId} onClick={() => onModuleSettings(modId)}
                className="w-full flex items-center justify-between px-4 py-2.5 rounded-lg bg-muted hover:bg-muted border border-border text-left transition-colors">
                <div>
                  <span className="text-sm font-medium text-foreground">{modId}</span>
                  <span className="ml-2 text-xs text-muted-foreground">— tap to configure</span>
                </div>
                <span className="text-muted-foreground text-xs">⚙ →</span>
              </button>
            ))}
          </div>
        </div>

        <div className="p-5">
          <h3 className="text-sm font-semibold text-foreground mb-1">Case Statistics</h3>
          <div className="grid grid-cols-3 gap-4 mt-2">
            <div className="bg-slate-700/40 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-foreground">{normalizedCases.length}</div>
              <div className="text-[11px] text-muted-foreground mt-0.5">Total Cases</div>
            </div>
            <div className="bg-slate-700/40 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-emerald-400">{normalizedCases.filter(c => c.currentStage === 'CLOSED').length}</div>
              <div className="text-[11px] text-muted-foreground mt-0.5">Closed</div>
            </div>
            <div className="bg-slate-700/40 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-amber-400">{normalizedCases.filter(c => c.currentStage !== 'CLOSED').length}</div>
              <div className="text-[11px] text-muted-foreground mt-0.5">Open</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
