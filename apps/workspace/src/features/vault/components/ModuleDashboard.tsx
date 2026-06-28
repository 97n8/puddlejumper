import { memo, type ReactNode } from 'react'
import { Gear } from '@phosphor-icons/react'
import type { VaultCase, VaultModuleSettings } from '../types'
import { getVaultModule } from '@/lib/vault-modules'
import { calendarDaysUntil } from '../utils/deadlines'

export const ModuleDashboard = memo(function ModuleDashboard({ modules, cases, allSettings, onSelect, onSettings, onPublicForm, hero }: {
  modules: string[]
  cases: VaultCase[]
  allSettings: Record<string, VaultModuleSettings>
  onSelect: (id: string) => void
  onSettings: (id: string) => void
  onPublicForm: (id: string) => void
  hero?: ReactNode
}) {
  return (
    <div className="flex-1 min-h-0 overflow-y-auto bg-[linear-gradient(180deg,rgba(248,250,252,0.96),rgba(241,245,249,0.9))] p-4 sm:p-6">
      <div className="mx-auto max-w-6xl">
        {hero && <div className="mb-6">{hero}</div>}
        <div className="mb-6">
          <h2 className="text-xl font-bold text-foreground">Active Modules</h2>
          <p className="text-sm text-muted-foreground mt-1">Select a module to manage cases, intake, and records</p>
        </div>
        {modules.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-muted/20 p-10 text-center">
            <div className="text-4xl mb-4">📂</div>
            <h3 className="font-bold text-foreground text-lg mb-2">No modules set up yet</h3>
            <p className="text-sm text-muted-foreground max-w-sm mx-auto mb-6 leading-relaxed">
              A <strong>module</strong> is a type of work your department manages — for example, Public Records Requests, Permits, HR actions, or Contracts. Each module tracks cases, deadlines, and documents.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <button
                onClick={() => onSettings(modules[0] ?? '')}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors"
              >
                Set up your first module
              </button>
              <button
                onClick={() => onPublicForm(modules[0] ?? '')}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-border bg-background text-sm font-medium hover:bg-muted/60 transition-colors"
              >
                Browse module templates
              </button>
            </div>
            <p className="text-xs text-muted-foreground mt-6">
              Common modules: <span className="font-medium">Public Records (FOIA)</span> · <span className="font-medium">Building Permits</span> · <span className="font-medium">HR Actions</span> · <span className="font-medium">Contracts</span>
            </p>
          </div>
        ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {modules.map(mid => {
            const meta = getVaultModule(mid)
            const modSettings = allSettings[mid]
            const accentColor = modSettings?.accentColor ?? '#6366f1'
            const modCases = cases.filter(c => c.moduleId === mid)
            const open = modCases.filter(c => c.currentStage !== 'CLOSED').length
            const closed = modCases.filter(c => c.currentStage === 'CLOSED').length
            const urgent = modCases.filter(c => {
              if (c.currentStage === 'CLOSED') return false
              return Object.values(c.deadlines).some(d => {
                if (d.status === 'MET' || d.status === 'N/A' || !d.dueDate) return false
                return calendarDaysUntil(d.dueDate) <= 3
              })
            }).length
            return (
              <div key={mid} className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_18px_40px_rgba(15,23,42,0.08)] transition-all hover:-translate-y-0.5 hover:shadow-[0_24px_56px_rgba(15,23,42,0.12)] group"
                   style={{ borderLeftColor: accentColor, borderLeftWidth: 3 }}>
                <button className="w-full text-left p-5" onClick={() => onSelect(mid)}>
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <div className="text-xs font-bold uppercase tracking-wider mb-1" style={{ color: accentColor }}>{mid.replace('VAULT', '')}</div>
                      <div className="font-semibold text-foreground text-sm">{meta?.name ?? mid}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="text-muted-foreground text-xs font-mono">{meta?.mglCitation}</div>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground mb-4 line-clamp-2">{meta?.description}</p>
                  <div className="flex gap-4">
                    <div className="text-center">
                      <div className="text-xl font-bold text-foreground">{open}</div>
                      <div className="text-xs text-muted-foreground">Open</div>
                    </div>
                    <div className="text-center">
                      <div className="text-xl font-bold text-slate-300">{closed}</div>
                      <div className="text-xs text-muted-foreground">Closed</div>
                    </div>
                    {urgent > 0 && (
                      <div className="text-center ml-auto">
                        <div className="text-xl font-bold text-amber-500">{urgent}</div>
                        <div className="text-xs text-amber-500">Urgent</div>
                      </div>
                    )}
                  </div>
                </button>
                <div className="flex items-center justify-between border-t border-slate-200/80 bg-slate-50/90 px-5 py-2.5">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={(e) => { e.stopPropagation(); onSettings(mid) }}
                      className="text-xs text-muted-foreground hover:text-foreground/80 flex items-center gap-1 transition-colors"
                    >
                      <Gear size={12} /> Settings
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); onPublicForm(mid) }}
                      className="text-xs text-emerald-600 hover:text-emerald-700 transition-colors flex items-center gap-1"
                    >
                      ↓ Public Form
                    </button>
                  </div>
                  {allSettings[mid]?.trainingLinks?.length > 0 && (
                    <div className="text-xs text-muted-foreground">
                      📚 {allSettings[mid].trainingLinks.length} training {allSettings[mid].trainingLinks.length === 1 ? 'resource' : 'resources'}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
        )}
      </div>
    </div>
  )
}
)  // end memo
