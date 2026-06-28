/**
 * ModuleConfigureRow — per-module accordion for the OrgManager configure step.
 *
 * Renders the header button + expanded body (process flow, owner fields,
 * automation toggles, filing routing, retention) for one VaultModule.
 */
import { useState, useRef, useCallback } from 'react'
import {
  User, Envelope, Phone, Warning, CaretDown, CaretUp,
  Lightning, Robot, CheckSquare, Square,
  WindowsLogo, GoogleLogo, PlugsConnected, CheckCircle,
} from '@phosphor-icons/react'
import type { VaultModule } from '@/lib/vault-modules'
import { DOMAIN_BADGE, DOMAIN_ACCENT, MODULE_EMOJI } from '../constants/design'

const OFFICER_TITLE: Record<string, string> = {
  VAULTPRR:     'Records Access Officer',
  VAULTCLERK:   'Town Clerk',
  VAULTFISCAL:  'Finance Director',
  VAULTTIME:    'Town Accountant',
  VAULTFIX:     'Director of Public Works',
  VAULTONBOARD: 'HR Director',
  VAULTPERMIT:  'Building Commissioner',
  VAULTHR:      'HR Director',
  VAULTPROCURE: 'Procurement Officer',
  VAULTRECS:    'Records Manager',
  VAULTMEET:    'Town Clerk',
}

// ── Types ─────────────────────────────────────────────────────────────────────

type Provider = 'sharepoint' | 'google' | 'none'

export interface ModuleSetup {
  moduleId: string
  officerName: string
  officerTitle: string
  officerEmail: string
  officerPhone: string
  routing: Record<string, Provider>
  folders: Record<string, string>
  retentionYears: number
}

export interface ProcessStep {
  label: string
  role: string
  system?: boolean
  isOfficer?: boolean
}

export interface AutoItem {
  key: string
  label: string
  detail: string
  defaultOn: boolean
}

interface Props {
  module: VaultModule
  setup: ModuleSetup
  isOpen: boolean
  flow: ProcessStep[]
  automations: AutoItem[]
  townName: string
  msConnected: boolean
  gConnected: boolean
  onToggleOpen: () => void
  onUpdateSetup: (patch: Partial<ModuleSetup>) => void
  isAutoOn: (key: string) => boolean
  onToggleAuto: (key: string) => void
}

/** Folder path input with 300ms debounce to avoid flooding parent state on every keystroke. */
function DebouncedFolderInput({
  value,
  placeholder,
  onChange,
}: {
  value: string
  placeholder: string
  onChange: (v: string) => void
}) {
  const [local, setLocal] = useState(value)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const next = e.target.value
    setLocal(next)
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => onChange(next), 300)
  }, [onChange])

  // Sync if parent value changes externally (e.g. "Suggest" button click)
  const prevValue = useRef(value)
  if (prevValue.current !== value && local !== value) {
    prevValue.current = value
    setLocal(value)
  }

  return (
    <input
      value={local}
      onChange={handleChange}
      placeholder={placeholder}
      className="flex-1 px-2.5 py-1.5 bg-muted border border-border rounded-lg text-foreground text-xs focus:outline-none focus:border-red-700/60"
    />
  )
}

function suggestFolder(provider: Provider, town: string, moduleName: string, slotLabel: string): string {
  if (provider === 'none') return ''
  const clean = (s: string) => s.replace(/[^a-zA-Z0-9 ]/g, '').trim()
  if (provider === 'sharepoint') return `/VAULT/${clean(town)}/${clean(moduleName)}/${clean(slotLabel)}`
  return `VAULT > ${clean(town)} > ${clean(moduleName)} > ${clean(slotLabel)}`
}

export function ModuleConfigureRow({
  module: m, setup, isOpen, flow, automations, townName,
  msConnected, gConnected, onToggleOpen, onUpdateSetup, isAutoOn, onToggleAuto,
}: Props) {
  const accent = DOMAIN_ACCENT[m.domain] ?? '#6b7280'
  const badge  = DOMAIN_BADGE[m.domain]  ?? 'bg-muted text-muted-foreground border-muted'
  const totalOfficerSteps = flow.filter(s => s.isOfficer).length

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      {/* Accordion header */}
      <button
        onClick={onToggleOpen}
        className="w-full flex items-center gap-3 p-4 hover:bg-muted/20 transition text-left"
      >
        <div
          className="w-9 h-9 rounded-lg flex items-center justify-center text-lg shrink-0"
          style={{ background: `${accent}20`, border: `1px solid ${accent}30` }}
        >
          {MODULE_EMOJI[m.id] ?? '⚙️'}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-foreground font-semibold text-sm">{m.name}</span>
            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${badge}`}>
              {m.domain}
            </span>
            {setup.officerName && (
              <span className="flex items-center gap-1 text-[10px] text-emerald-400">
                <CheckCircle size={10} weight="fill" /> Configured
              </span>
            )}
          </div>
          {setup.officerName ? (
            <p className="text-muted-foreground text-xs mt-0.5">
              {setup.officerName} · {setup.officerTitle || OFFICER_TITLE[m.id]}
            </p>
          ) : (
            <p className="text-muted-foreground/50 text-xs mt-0.5">Who owns this function?</p>
          )}
        </div>
        <div className="shrink-0 text-muted-foreground">
          {isOpen ? <CaretUp size={14} /> : <CaretDown size={14} />}
        </div>
      </button>

      {/* Accordion body */}
      {isOpen && (
        <div className="border-t border-border divide-y divide-border/60">

          {/* 1. Process flow */}
          {flow.length > 0 && (
            <div className="p-4">
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-3">
                How Work Moves Through This Function
              </p>
              <div className="relative pl-5">
                <div className="absolute left-[7px] top-3 bottom-3 w-px bg-border" />
                {flow.map((s, i) => (
                  <div key={i} className="relative flex items-start gap-3 mb-3 last:mb-0">
                    <div
                      className={`absolute -left-5 mt-[3px] w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                        s.system
                          ? 'bg-muted border-muted-foreground/30'
                          : s.isOfficer
                            ? 'border-2 bg-card'
                            : 'bg-muted/60 border-border'
                      }`}
                      style={s.isOfficer ? { borderColor: accent } : {}}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-xs ${s.system ? 'text-muted-foreground' : 'text-foreground'}`}>
                          {s.label}
                        </span>
                        {s.system ? (
                          <span className="flex items-center gap-0.5 text-[9px] font-semibold text-muted-foreground/60 bg-muted px-1.5 py-0.5 rounded-full">
                            <Lightning size={8} weight="fill" /> Automatic
                          </span>
                        ) : (
                          <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full ${
                            s.isOfficer
                              ? 'bg-foreground/5 text-foreground/60'
                              : 'bg-muted text-muted-foreground/60'
                          }`}>
                            {s.isOfficer && setup.officerName ? setup.officerName.split(' ')[0] : s.role}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 2. Who owns this function */}
          <div className="p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                Who Owns This Function
              </p>
              {totalOfficerSteps > 0 && (
                <span className="text-[10px] text-muted-foreground/50">
                  Handles {totalOfficerSteps} step{totalOfficerSteps !== 1 ? 's' : ''} in this workflow
                </span>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Name</label>
                <div className="relative">
                  <User size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground/50" />
                  <input
                    value={setup.officerName}
                    onChange={e => onUpdateSetup({ officerName: e.target.value })}
                    placeholder="Full name"
                    className="w-full pl-7 pr-3 py-2 bg-muted border border-border rounded-lg text-foreground text-sm focus:outline-none focus:border-red-700/60"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Title</label>
                <input
                  value={setup.officerTitle}
                  onChange={e => onUpdateSetup({ officerTitle: e.target.value })}
                  placeholder={OFFICER_TITLE[m.id] ?? 'Title'}
                  className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-foreground text-sm focus:outline-none focus:border-red-700/60"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Email</label>
                <div className="relative">
                  <Envelope size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground/50" />
                  <input
                    value={setup.officerEmail}
                    onChange={e => onUpdateSetup({ officerEmail: e.target.value })}
                    placeholder="officer@town.gov"
                    type="email"
                    className="w-full pl-7 pr-3 py-2 bg-muted border border-border rounded-lg text-foreground text-sm focus:outline-none focus:border-red-700/60"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Phone</label>
                <div className="relative">
                  <Phone size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground/50" />
                  <input
                    value={setup.officerPhone}
                    onChange={e => onUpdateSetup({ officerPhone: e.target.value })}
                    placeholder="(508) 555-0100"
                    className="w-full pl-7 pr-3 py-2 bg-muted border border-border rounded-lg text-foreground text-sm focus:outline-none focus:border-red-700/60"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* 3. Automations */}
          <div className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <Robot size={12} className="text-muted-foreground" />
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                What Runs Automatically
              </p>
            </div>
            <div className="flex flex-col gap-2">
              {automations.map(a => {
                const on = isAutoOn(a.key)
                return (
                  <button
                    key={a.key}
                    onClick={() => onToggleAuto(a.key)}
                    className={`flex items-start gap-3 px-3 py-2.5 rounded-lg border text-left transition ${
                      on
                        ? 'bg-emerald-500/5 border-emerald-500/20 hover:border-emerald-500/40'
                        : 'bg-muted/30 border-border hover:border-muted-foreground/30'
                    }`}
                  >
                    <div className="mt-0.5 shrink-0">
                      {on
                        ? <CheckSquare size={14} weight="fill" className="text-emerald-500" />
                        : <Square size={14} className="text-muted-foreground/40" />
                      }
                    </div>
                    <div className="min-w-0">
                      <div className={`text-xs font-medium leading-snug ${on ? 'text-foreground' : 'text-muted-foreground'}`}>
                        {a.label}
                      </div>
                      <div className="text-[11px] text-muted-foreground/60 mt-0.5">{a.detail}</div>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          {/* 4. Where work is filed */}
          {m.routingSlots.length > 0 && (
            <div className="p-4">
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-3">
                Where Work Is Filed
              </p>
              <div className="flex flex-col gap-3">
                {m.routingSlots.map(slot => {
                  const provider = setup.routing[slot.key] ?? 'none'
                  const folder   = setup.folders[slot.key]  ?? ''
                  const supportsSharePoint = slot.supports.includes('sharepoint')
                  const supportsGoogle     = slot.supports.includes('google')

                  function setProvider(p: Provider) {
                    const newFolder = provider !== p && p !== 'none'
                      ? suggestFolder(p, townName, m.name, slot.label)
                      : provider !== p ? '' : folder
                    onUpdateSetup({
                      routing: { ...setup.routing, [slot.key]: p },
                      folders: { ...setup.folders, [slot.key]: newFolder },
                    })
                  }

                  return (
                    <div key={slot.key} className="bg-muted/40 rounded-lg p-3">
                      <p className="text-xs font-medium text-foreground mb-0.5">{slot.label}</p>
                      <p className="text-[11px] text-muted-foreground mb-2">{slot.description}</p>

                      <div className="flex gap-2 flex-wrap mb-2">
                        {supportsSharePoint && (
                          <button
                            onClick={() => setProvider('sharepoint')}
                            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition ${
                              provider === 'sharepoint'
                                ? 'bg-blue-900/40 border-blue-700/60 text-blue-300'
                                : 'bg-muted border-border text-muted-foreground hover:text-foreground'
                            }`}
                          >
                            <WindowsLogo size={13} weight="fill" />
                            SharePoint
                            {provider === 'sharepoint' && (msConnected
                              ? <PlugsConnected size={11} className="text-emerald-400" />
                              : <Warning        size={11} className="text-amber-400" />
                            )}
                          </button>
                        )}
                        {supportsGoogle && (
                          <button
                            onClick={() => setProvider('google')}
                            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition ${
                              provider === 'google'
                                ? 'bg-red-900/30 border-red-700/50 text-red-300'
                                : 'bg-muted border-border text-muted-foreground hover:text-foreground'
                            }`}
                          >
                            <GoogleLogo size={13} weight="fill" />
                            Google Drive
                            {provider === 'google' && (gConnected
                              ? <PlugsConnected size={11} className="text-emerald-400" />
                              : <Warning        size={11} className="text-amber-400" />
                            )}
                          </button>
                        )}
                        <button
                          onClick={() => setProvider('none')}
                          className={`px-2.5 py-1.5 rounded-lg text-xs font-medium border transition ${
                            provider === 'none'
                              ? 'bg-muted/80 border-muted-foreground/30 text-foreground'
                              : 'bg-muted border-border text-muted-foreground hover:text-foreground'
                          }`}
                        >
                          None
                        </button>
                      </div>

                      {provider === 'sharepoint' && !msConnected && (
                        <p className="text-[11px] text-amber-600/80 mb-2 flex items-center gap-1">
                          <Warning size={11} /> Microsoft 365 not connected — routing activates once connected in Settings.
                        </p>
                      )}
                      {provider === 'google' && !gConnected && (
                        <p className="text-[11px] text-amber-600/80 mb-2 flex items-center gap-1">
                          <Warning size={11} /> Google Workspace not connected — routing activates once connected in Settings.
                        </p>
                      )}

                      {provider !== 'none' && (
                        <div className="flex items-center gap-2">
                          <DebouncedFolderInput
                            value={folder}
                            onChange={v => onUpdateSetup({ folders: { ...setup.folders, [slot.key]: v } })}
                            placeholder={suggestFolder(provider, townName, m.name, slot.label)}
                          />
                          {!folder && (
                            <button
                              onClick={() => onUpdateSetup({ folders: { ...setup.folders, [slot.key]: suggestFolder(provider, townName, m.name, slot.label) } })}
                              className="text-[11px] text-muted-foreground hover:text-foreground px-2 py-1.5 border border-border rounded-lg hover:bg-muted transition whitespace-nowrap"
                            >
                              Suggest
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* 5. Retention */}
          <div className="px-4 py-3 flex items-center gap-3 bg-muted/20">
            <label className="text-xs text-muted-foreground whitespace-nowrap">Retention period</label>
            <input
              value={setup.retentionYears}
              onChange={e => onUpdateSetup({ retentionYears: parseInt(e.target.value) || 1 })}
              type="number" min={1} max={99}
              className="w-20 px-2.5 py-1.5 bg-muted border border-border rounded-lg text-foreground text-xs focus:outline-none focus:border-red-700/60"
            />
            <span className="text-xs text-muted-foreground">years (per MGL)</span>
          </div>

        </div>
      )}
    </div>
  )
}
