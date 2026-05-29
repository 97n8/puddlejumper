import { useState } from 'react'
import {
  User, FolderOpen, ArrowsDownUp, Clock,
  Envelope, Phone, Warning,
} from '@phosphor-icons/react'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { VAULT_MODULES } from '@/lib/vault-modules'
import type { MakerState, ConnectorStatus, ModuleSetup, StaffDirectoryContact } from '../types'
import {
  MODULE_EMOJI, DOMAIN_ACCENT, DOMAIN_BADGE,
  OFFICER_TITLE, defaultSetup,
} from '../utils/makerUtils'
import { ConnectorBadge } from './ConnectorBadge'
import { RoutingSlotRow } from './RoutingSlotRow'
import { WorkflowEditor } from './WorkflowEditor'

export function ConfigureStep({
  state, onUpdate, connectors, connecting, onConnect, staffDirectory, loadingStaffDirectory, staffDirectoryNotice,
}: {
  state: MakerState
  onUpdate: (s: MakerState) => void
  connectors: Record<string, ConnectorStatus>
  connecting: string | null
  onConnect: (p: 'microsoft' | 'google') => void
  staffDirectory: StaffDirectoryContact[]
  loadingStaffDirectory: boolean
  staffDirectoryNotice: string | null
}) {
  const [activeId, setActiveId] = useState(state.selectedIds[0] ?? '')
  const [section, setSection] = useState<'officer' | 'routing' | 'workflow' | 'records'>('officer')

  const m = VAULT_MODULES.find(v => v.id === activeId)
  const setup: ModuleSetup = state.setups[activeId] ?? (m ? defaultSetup(m, state.town) : null)

  function patchSetup(patch: Partial<ModuleSetup>) {
    if (!activeId) return
    onUpdate({
      ...state,
      setups: { ...state.setups, [activeId]: { ...setup!, ...patch } },
    })
  }

  function applyOfficer(contact: StaffDirectoryContact) {
    patchSetup({
      officerName: contact.name,
      officerTitle: contact.title,
      officerEmail: contact.email,
      officerPhone: contact.phone ?? setup.officerPhone,
    })
  }

  if (state.selectedIds.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
        No modules selected — go back and choose at least one.
      </div>
    )
  }

  const configured = (id: string) => !!(state.setups[id]?.officerName)

  const SECTIONS = [
    { id: 'officer' as const,  label: 'Officer',   icon: <User size={13} /> },
    { id: 'routing' as const,  label: 'Routing',   icon: <FolderOpen size={13} /> },
    { id: 'workflow' as const, label: 'Workflow',  icon: <ArrowsDownUp size={13} /> },
    { id: 'records' as const,  label: 'Records',   icon: <Clock size={13} /> },
  ]

  return (
    <div className="flex-1 overflow-hidden bg-background px-3 py-2">
      <div className="mx-auto flex h-full w-full max-w-[1520px] overflow-hidden rounded-[24px] border border-border/70 bg-card/95 shadow-sm">
      {/* Module nav */}
      <div className="w-40 shrink-0 border-r border-border/80 flex flex-col bg-muted/12">
        <div className="px-3 py-2.5 border-b border-border/80">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Modules</p>
          <p className="mt-1 text-[11px] text-muted-foreground">{state.selectedIds.length} active in this workspace</p>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto py-2 px-2">
          {state.selectedIds.map(id => {
            const vm = VAULT_MODULES.find(v => v.id === id)!
            const isActive = id === activeId
            return (
              <button
                key={id}
                onClick={() => { setActiveId(id); setSection('officer') }}
                className={`mb-1 flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left transition-all ${
                  isActive ? 'bg-background text-foreground shadow-sm ring-1 ring-primary/15' : 'text-muted-foreground hover:bg-background/80 hover:text-foreground'
                }`}
              >
                <span className="text-base shrink-0">{MODULE_EMOJI[id] ?? '⚙️'}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-semibold truncate">{vm.name}</div>
                  <div className={`text-[10px] ${configured(id) ? 'text-emerald-600' : 'text-muted-foreground'}`}>
                    {configured(id) ? '✓ Ready' : 'Needs setup'}
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* Config area */}
      {m && setup && (
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Module header */}
          <div className="shrink-0 border-b border-border/80 bg-background/90 px-4 py-2.5">
            <div className="flex flex-wrap items-center gap-3">
            <div
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-lg"
              style={{ background: `${DOMAIN_ACCENT[m.domain] ?? '#6b7280'}20` }}
            >
              {MODULE_EMOJI[m.id] ?? '⚙️'}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-base font-bold text-foreground">{m.name}</h2>
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${DOMAIN_BADGE[m.domain] ?? ''}`}>
                  {m.domain}
                </span>
                <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${configured(activeId) ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-amber-200 bg-amber-50 text-amber-700'}`}>
                  {configured(activeId) ? 'Ready' : 'Needs owner'}
                </span>
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                <span>{state.town || 'Municipality pending'}</span>
                <span className="font-mono">{m.mglCitation}</span>
                <span>{SECTIONS.find(item => item.id === section)?.label} setup</span>
              </div>
            </div>
            </div>
          </div>

          {/* Section tabs */}
          <div className="flex items-center gap-1 px-4 border-b border-border/80 bg-muted/[0.08] shrink-0">
            {SECTIONS.map(s => (
              <button
                key={s.id}
                onClick={() => setSection(s.id)}
                className={`flex items-center gap-1.5 rounded-t-xl px-3 py-2 text-xs font-medium border-b-2 -mb-px transition-colors ${
                  section === s.id
                    ? 'border-primary text-foreground'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                {s.icon}
                {s.label}
              </button>
            ))}
          </div>

          {/* Section content */}
          <div className="flex-1 min-h-0 overflow-y-auto bg-background px-4 py-4">

            {/* ── Officer ── */}
            {section === 'officer' && (
              <div className="max-w-4xl space-y-4">
                <div className="rounded-2xl border border-border bg-muted/[0.08] p-4">
                  <div className="text-sm font-medium">Give this module a clear owner.</div>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    Start with the person who should never lose the thread. If a public staff directory is available, use it to fill the basics instantly.
                  </p>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Town staff directory</p>
                    {loadingStaffDirectory && <span className="text-xs text-muted-foreground">Looking for CivicPlus / official staff pages…</span>}
                  </div>
                  {staffDirectory.length > 0 ? (
                    <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                      {staffDirectory.slice(0, 6).map(contact => (
                        <button
                          key={contact.id}
                          type="button"
                          onClick={() => applyOfficer(contact)}
                          className="rounded-xl border border-border bg-card px-3 py-3 text-left hover:border-primary/30 hover:bg-primary/5 transition"
                        >
                          <div className="text-sm font-medium">{contact.name}</div>
                          <div className="mt-0.5 text-xs text-muted-foreground">{contact.title}</div>
                          <div className="mt-2 text-xs text-muted-foreground truncate">{contact.email}</div>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-xl border border-dashed border-border bg-muted/10 px-3 py-3 text-xs text-muted-foreground">
                      {staffDirectoryNotice ?? 'No public staff directory was pulled for this town yet, so fill the module owner manually.'}
                    </div>
                  )}
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label className="text-xs flex items-center gap-1.5"><User size={12} />Officer Name</Label>
                    <Input
                      value={setup.officerName}
                      onChange={e => patchSetup({ officerName: e.target.value })}
                      placeholder="Full name"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Title</Label>
                    <Input
                      value={setup.officerTitle}
                      onChange={e => patchSetup({ officerTitle: e.target.value })}
                      placeholder={OFFICER_TITLE[m.id] ?? 'Title'}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs flex items-center gap-1.5"><Envelope size={12} />Email</Label>
                    <Input
                      type="email"
                      value={setup.officerEmail}
                      onChange={e => patchSetup({ officerEmail: e.target.value })}
                      placeholder="officer@organization.com"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs flex items-center gap-1.5"><Phone size={12} />Phone</Label>
                    <Input
                      type="tel"
                      value={setup.officerPhone}
                      onChange={e => patchSetup({ officerPhone: e.target.value })}
                      placeholder="(508) 555-0100"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs">Implementation Notes</Label>
                  <Textarea
                    value={setup.notes}
                    onChange={e => patchSetup({ notes: e.target.value })}
                    placeholder="Local policies, exceptions, or anything specific to this module for this organization…"
                    rows={3}
                    className="resize-none text-sm"
                  />
                </div>

                {!setup.officerName && (
                  <div className="flex items-center gap-2 text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                    <Warning size={13} />
                    Officer name is required before this module can be activated.
                  </div>
                )}
              </div>
            )}

            {/* ── Routing ── */}
            {section === 'routing' && (
              <div className="max-w-4xl space-y-4">
                {/* Connection status header */}
                <div className="flex items-center gap-3 flex-wrap rounded-2xl border border-border bg-muted/[0.08] px-4 py-3">
                  <p className="text-xs font-semibold text-muted-foreground">Active connections:</p>
                  <ConnectorBadge
                    provider="microsoft"
                    status={connectors['microsoft']}
                    connecting={connecting}
                    onConnect={onConnect}
                  />
                  <ConnectorBadge
                    provider="google"
                    status={connectors['google']}
                    connecting={connecting}
                    onConnect={onConnect}
                  />
                </div>

                {m.routingSlots.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground text-sm bg-muted/20 rounded-xl border border-border">
                    <FolderOpen size={28} className="mx-auto mb-2 opacity-30" />
                    This module has no configurable routing slots.
                  </div>
                ) : (
                  m.routingSlots.map(slot => (
                    <RoutingSlotRow
                      key={slot.key}
                      slotKey={slot.key}
                      slotLabel={slot.label}
                      slotDesc={slot.description}
                      provider={setup.routing[slot.key] ?? 'none'}
                      folder={setup.folders?.[slot.key] ?? ''}
                      town={state.town}
                      moduleName={m.name}
                      connectors={connectors}
                      connecting={connecting}
                      onProviderChange={p => patchSetup({ routing: { ...setup.routing, [slot.key]: p } })}
                      onFolderChange={f => patchSetup({ folders: { ...(setup.folders ?? {}), [slot.key]: f } })}
                      onConnect={onConnect}
                    />
                  ))
                )}
              </div>
            )}

            {/* ── Workflow ── */}
            {section === 'workflow' && (
              <div className="max-w-4xl space-y-3">
                <p className="max-w-2xl text-xs text-muted-foreground">
                  Customize the workflow steps for this module. Drag to reorder, add your own steps, and give each step a person so the handoff is obvious.
                </p>
                <WorkflowEditor
                  steps={setup.workflowSteps}
                  onChange={steps => {
                    const nextAssignments = Object.fromEntries(
                      steps.map(stepName => [stepName, setup.workflowAssignments?.[stepName] ?? '']),
                    )
                    patchSetup({ workflowSteps: steps, workflowAssignments: nextAssignments })
                  }}
                />
                <div className="rounded-2xl border border-border bg-muted/[0.08] p-4 space-y-3">
                  <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Step owners</div>
                  {setup.workflowSteps.map(stepName => (
                    <div key={stepName} className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_220px] sm:items-center">
                      <div className="text-sm font-medium">{stepName}</div>
                      <select
                        value={setup.workflowAssignments?.[stepName] ?? ''}
                        onChange={event => patchSetup({
                          workflowAssignments: {
                            ...setup.workflowAssignments,
                            [stepName]: event.target.value,
                          },
                        })}
                        className="h-9 rounded-lg border border-border bg-background px-3 text-sm"
                      >
                        <option value="">Choose owner…</option>
                        {staffDirectory.map(contact => (
                          <option key={contact.id} value={contact.id}>
                            {contact.name} — {contact.title}
                          </option>
                        ))}
                        {setup.officerName && (
                          <option value="__module_owner__">
                            {setup.officerName} — module owner
                          </option>
                        )}
                      </select>
                    </div>
                  ))}
                  {staffDirectoryNotice && (
                    <p className="text-xs leading-5 text-muted-foreground">{staffDirectoryNotice}</p>
                  )}
                </div>
                {setup.workflowSteps.length === 0 && (
                  <button
                    className="text-xs text-primary font-medium hover:underline"
                    onClick={() => patchSetup({ workflowSteps: [...m.defaultWorkflowSteps] })}
                  >
                    ↩ Reset to defaults
                  </button>
                )}
              </div>
            )}

            {/* ── Records ── */}
            {section === 'records' && (
              <div className="max-w-2xl space-y-5">
                <div className="space-y-1.5">
                  <Label className="text-xs flex items-center gap-1.5"><Clock size={12} />Retention Period (years)</Label>
                  <div className="flex items-center gap-3">
                    <Input
                      type="number"
                      value={setup.retentionYears}
                      onChange={e => patchSetup({ retentionYears: parseInt(e.target.value) || m.defaultRetentionYears })}
                      min={1}
                      max={99}
                      className="w-28"
                    />
                    <span className="text-xs text-muted-foreground">
                      Default: {m.defaultRetentionYears} yr · M.G.L. {m.mglCitation}
                    </span>
                  </div>
                </div>

                <div className="bg-muted/30 rounded-xl border border-border p-4 space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Statutory Basis</p>
                  <p className="text-sm text-foreground font-mono">{m.mglCitation}</p>
                  <p className="text-xs text-muted-foreground">{m.description}</p>
                </div>
              </div>
            )}

          </div>
        </div>
      )}
      </div>
    </div>
  )
}
