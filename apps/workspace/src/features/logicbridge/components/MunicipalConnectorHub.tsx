/**
 * MunicipalConnectorHub
 *
 * Visualises Workspace as the compliance translation layer between a town's
 * existing systems (Tyler, CivicPlus, GIS) and their cloud storage / retention targets.
 *
 * Left column  — SOURCE SYSTEMS (what the town already has)
 * Center       — Workspace compliance engine (MA law, audit, retention)
 * Right column — OUTPUT TARGETS (where governed records land)
 */

import { ArrowRight, CheckCircle, Clock, Plugs } from '@phosphor-icons/react'

interface NodeDef {
  name: string
  sub: string
  color: string           // bg class
  textColor: string
  connected?: boolean
  coming?: boolean
}

const SOURCES: NodeDef[] = [
  { name: 'Tyler EnerGov',       sub: 'Permitting & Licensing',      color: 'bg-teal-500/10 border-teal-500/30',    textColor: 'text-teal-600' },
  { name: 'Tyler Munis',         sub: 'Finance & ERP',               color: 'bg-emerald-500/10 border-emerald-500/30', textColor: 'text-emerald-600' },
  { name: 'CivicPlus PADS',      sub: 'Forms & 311 CRM',             color: 'bg-orange-500/10 border-orange-500/30', textColor: 'text-orange-600' },
  { name: 'ArcGIS / MassGIS',    sub: 'Parcels & Zoning',            color: 'bg-sky-500/10 border-sky-500/30',      textColor: 'text-sky-600' },
  { name: 'Clerk Archive',       sub: 'Agendas, Minutes, Votes',     color: 'bg-violet-500/10 border-violet-500/30',textColor: 'text-violet-600' },
  { name: 'Payment Gateway',     sub: 'Tyler Pay · Stripe · CivicPlus', color: 'bg-yellow-500/10 border-yellow-500/30', textColor: 'text-yellow-600', coming: true },
]

const OUTPUTS: NodeDef[] = [
  { name: 'Microsoft 365',       sub: 'SharePoint · Teams · OneDrive', color: 'bg-blue-500/10 border-blue-500/30',  textColor: 'text-blue-600', connected: true },
  { name: 'Google Workspace',    sub: 'Drive · Gmail · Calendar',    color: 'bg-red-500/10 border-red-500/30',      textColor: 'text-red-600', connected: true },
  { name: 'GitHub',              sub: 'Docs, code & version history', color: 'bg-neutral-500/10 border-neutral-500/30', textColor: 'text-neutral-600', connected: true },
  { name: 'VAULT Records',       sub: 'MA-law retention & MART schedule', color: 'bg-indigo-500/10 border-indigo-500/30', textColor: 'text-indigo-600', connected: true },
  { name: 'Public Tracker',      sub: 'Citizen case status at /track', color: 'bg-purple-500/10 border-purple-500/30', textColor: 'text-purple-600', connected: true },
  { name: 'Audit Trail',         sub: 'Append-only compliance log',  color: 'bg-slate-500/10 border-slate-500/30',  textColor: 'text-slate-600', connected: true },
]

const CORE_CAPABILITIES = [
  'M.G.L. compliance enforcement',
  'T10 / T25 / c.30B deadlines',
  'MART retention scheduling',
  'Workflow & email automation',
  'Statutory exemption logging',
  'Records disposition auth',
  'Audit trail (append-only)',
  'AI routing & classification',
]

export function MunicipalConnectorHub() {
  return (
    <div className="flex flex-col gap-6 px-4 py-6 max-w-5xl mx-auto">
      {/* Title */}
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center shrink-0 mt-0.5">
          <Plugs size={18} className="text-white" weight="fill" />
        </div>
        <div>
          <h2 className="text-base font-bold">Municipal Connector Hub</h2>
          <p className="text-[12px] text-muted-foreground mt-0.5 max-w-xl">
            Workspace sits at the center of your municipal technology stack — ingesting from any existing
            system, applying Massachusetts law compliance, and routing governed records to your cloud
            storage and retention targets.
          </p>
        </div>
      </div>

      {/* Three-column diagram */}
      <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] gap-4 items-start">

        {/* Left: Source systems */}
        <div className="flex flex-col gap-2">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">
            Source Systems
          </p>
          {SOURCES.map(s => (
            <SystemNode key={s.name} node={s} side="source" />
          ))}
        </div>

        {/* Center: Workspace engine */}
        <div className="flex flex-col items-center gap-2 md:pt-6">
          {/* Arrow left */}
          <div className="hidden md:flex flex-col items-center gap-1 text-muted-foreground/40">
            <ArrowRight size={16} weight="bold" />
            <ArrowRight size={16} weight="bold" />
            <ArrowRight size={16} weight="bold" />
            <ArrowRight size={16} weight="bold" />
            <ArrowRight size={16} weight="bold" />
            <ArrowRight size={16} weight="bold" />
          </div>

          {/* Core engine box */}
          <div className="w-full md:w-48 rounded-2xl border-2 border-indigo-500 bg-indigo-600 text-white p-4 flex flex-col gap-3 shadow-lg">
            <div className="text-center">
              <div className="text-sm font-black tracking-tight">Workspace</div>
              <div className="text-[10px] text-indigo-200 mt-0.5">Compliance Translation Engine</div>
            </div>
            <div className="flex flex-col gap-1">
              {CORE_CAPABILITIES.map(c => (
                <div key={c} className="flex items-center gap-1.5 text-[10px] text-indigo-100">
                  <CheckCircle size={9} weight="fill" className="text-indigo-300 shrink-0" />
                  {c}
                </div>
              ))}
            </div>
          </div>

          {/* Arrow right */}
          <div className="hidden md:flex flex-col items-center gap-1 text-muted-foreground/40">
            <ArrowRight size={16} weight="bold" />
            <ArrowRight size={16} weight="bold" />
            <ArrowRight size={16} weight="bold" />
            <ArrowRight size={16} weight="bold" />
            <ArrowRight size={16} weight="bold" />
            <ArrowRight size={16} weight="bold" />
          </div>
        </div>

        {/* Right: Output targets */}
        <div className="flex flex-col gap-2">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">
            Output & Retention Targets
          </p>
          {OUTPUTS.map(o => (
            <SystemNode key={o.name} node={o} side="output" />
          ))}
        </div>
      </div>

      {/* Lifecycle strip */}
      <LifecycleStrip />
    </div>
  )
}

function SystemNode({ node, side }: { node: NodeDef; side: 'source' | 'output' }) {
  return (
    <div className={`flex items-start gap-2 rounded-lg border px-3 py-2 ${node.color} ${
      node.coming ? 'opacity-60' : ''
    }`}>
      <div className="flex-1 min-w-0">
        <div className={`text-[12px] font-semibold leading-tight ${node.textColor} flex items-center gap-1.5`}>
          {node.name}
          {node.coming && (
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-yellow-100 text-yellow-700 border border-yellow-200">
              COMING
            </span>
          )}
        </div>
        <div className="text-[10px] text-muted-foreground mt-0.5 truncate">{node.sub}</div>
      </div>
      {side === 'output' && (
        node.connected
          ? <CheckCircle size={13} className="text-emerald-500 shrink-0 mt-0.5" weight="fill" />
          : <Clock size={13} className="text-muted-foreground shrink-0 mt-0.5" weight="duotone" />
      )}
    </div>
  )
}

function LifecycleStrip() {
  const steps = [
    { label: 'Intake',      sub: 'Form, email, API, or scan',     color: 'bg-slate-600' },
    { label: 'Classify',    sub: 'AI routes to correct module',    color: 'bg-indigo-600' },
    { label: 'Process',     sub: 'Staged workflow + MA deadlines', color: 'bg-violet-600' },
    { label: 'Notify',      sub: 'Email via M365 or Gmail',        color: 'bg-blue-600' },
    { label: 'Decide',      sub: 'Approval, denial, or extension', color: 'bg-emerald-600' },
    { label: 'Archive',     sub: 'Cloud storage + audit seal',     color: 'bg-teal-600' },
    { label: 'Retain',      sub: 'MART schedule enforced',         color: 'bg-amber-600' },
    { label: 'Disposition', sub: 'Destruction authorized',         color: 'bg-rose-600' },
  ]

  return (
    <div className="rounded-xl border border-border p-4">
      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-3">
        Seamless Lifecycle — Creation to Retention
      </p>
      <div className="flex gap-1 overflow-x-auto pb-1">
        {steps.map((s, i) => (
          <div key={s.label} className="flex items-center gap-1 shrink-0">
            <div className={`${s.color} rounded-lg px-2.5 py-2 text-white`}>
              <div className="text-[11px] font-bold whitespace-nowrap">{s.label}</div>
              <div className="text-[9px] text-white/70 whitespace-nowrap mt-0.5">{s.sub}</div>
            </div>
            {i < steps.length - 1 && (
              <ArrowRight size={12} className="text-muted-foreground/40 shrink-0" weight="bold" />
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
