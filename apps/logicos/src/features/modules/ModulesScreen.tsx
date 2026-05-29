import { useState } from 'react'
import { type ToolKey } from '@/lib/types'
import {
  Gavel, Heartbeat, Nut, Tree, Bed, ArrowRight, CloudArrowUp,
} from '@phosphor-icons/react'
import { ProvisionDialog } from '@/components/ProvisionDialog'

const ENVIRONMENTS = [
  {
    id: 'civic' as ToolKey,
    label: 'Civic',
    tagline: 'MGL-compliant municipal governance',
    description: 'Records requests, OML meetings, procurement, budget, grants — the full operating environment for a Massachusetts town.',
    icon: <Gavel size={32} weight="duotone" />,
    gradient: 'from-red-900/70 via-red-950/80 to-red-950/90',
    border: 'border-red-700/50 hover:border-red-600/70',
    iconBg: 'bg-red-800/60',
    badge: 'Live',
    badgeColor: 'bg-emerald-500 text-white',
    modules: ['Records & OML', 'Procurement', 'Budget', 'Grants', 'Permits'],
    live: true,
  },
  {
    id: 'health' as ToolKey,
    label: 'Health',
    tagline: 'Public health & clinical operations',
    description: 'Case management, compliance tracking, outbreak response, and community health programs — built for health departments and boards.',
    icon: <Heartbeat size={32} weight="duotone" />,
    gradient: 'from-blue-900/50 via-blue-950/60 to-blue-950/70',
    border: 'border-blue-800/30 hover:border-blue-600/60',
    iconBg: 'bg-blue-800/50',
    badge: 'Preview',
    badgeColor: 'bg-blue-700/70 text-blue-200',
    modules: ['Case Management', 'Inspections', 'Vitals Registry', 'Reporting'],
    live: true,
  },
  {
    id: 'ops' as ToolKey,
    label: 'Operations',
    tagline: 'Infrastructure, facilities & field services',
    description: 'Work orders, asset management, fleet tracking, and service requests — keeping the lights on and the roads paved.',
    icon: <Nut size={32} weight="duotone" />,
    gradient: 'from-amber-900/50 via-amber-950/60 to-amber-950/70',
    border: 'border-amber-800/30 hover:border-amber-600/60',
    iconBg: 'bg-amber-800/50',
    badge: 'Preview',
    badgeColor: 'bg-amber-700/70 text-amber-200',
    modules: ['Work Orders', 'Assets', 'Fleet', 'Service Requests'],
    live: true,
  },
  {
    id: 'grants' as ToolKey,
    label: 'Grants & Utilities',
    tagline: 'Grant lifecycle & utility management',
    description: 'From application to closeout — plus utility billing, rate setting, and compliance for water, sewer, and solid waste.',
    icon: <Tree size={32} weight="duotone" />,
    gradient: 'from-emerald-900/50 via-emerald-950/60 to-emerald-950/70',
    border: 'border-emerald-800/30 hover:border-emerald-600/60',
    iconBg: 'bg-emerald-800/50',
    badge: 'Preview',
    badgeColor: 'bg-emerald-700/70 text-emerald-200',
    modules: ['Grant Tracking', 'Closeout', 'Utility Billing', 'Rate Analysis'],
    live: true,
  },
  {
    id: 'stay' as ToolKey,
    label: 'StayOS',
    tagline: 'Short-term rental operator platform',
    description: 'Manage properties, reservations, and guest messaging from one place. Automate pre-arrival door codes, mid-stay check-ins, and post-checkout tasks.',
    icon: <Bed size={32} weight="duotone" />,
    gradient: 'from-teal-900/50 via-teal-950/60 to-teal-950/70',
    border: 'border-teal-700/30',
    iconBg: 'bg-teal-800/50',
    badge: 'Preview',
    badgeColor: 'bg-teal-700/70 text-teal-200',
    modules: ['Dashboard', 'Properties', 'Reservations', 'Tasks', 'Automations', 'Messaging'],
    live: true,
  },
]

interface ModulesScreenProps {
  onSelectTool: (tool: ToolKey) => void
  canUseTool?: (key: string) => boolean
}

export function ModulesScreen({ onSelectTool }: ModulesScreenProps) {
  const [provisionEnv, setProvisionEnv] = useState<string | null>(null)

  return (
    <div className="h-full overflow-auto bg-background">
      <div className="w-full max-w-3xl mx-auto px-5 sm:px-8 py-10 flex flex-col gap-6">

        <div className="mb-2">
          <h1 className="text-xl font-semibold text-foreground tracking-tight">Modules</h1>
          <p className="text-xs text-muted-foreground mt-1">Operating environments — each is a full governed system for its domain.</p>
        </div>

        {ENVIRONMENTS.map(env => {
          const card = (
            <div className={`relative flex gap-5 p-6 rounded-2xl border bg-gradient-to-br ${env.gradient} ${env.border} ${
              env.live
                ? 'cursor-pointer hover:scale-[1.005] hover:shadow-xl hover:shadow-black/25 transition-all duration-200'
                : 'opacity-50 cursor-default'
            }`}>
              <div className={`shrink-0 w-14 h-14 rounded-2xl ${env.iconBg} flex items-center justify-center text-white/90`}>
                {env.icon}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2.5 mb-1">
                  <span className="text-base font-bold text-white/95">{env.label}</span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${env.badgeColor}`}>
                    {env.badge}
                  </span>
                </div>
                <p className="text-[11px] text-white/55 mb-2">{env.tagline}</p>
                <p className="text-xs text-white/65 leading-relaxed line-clamp-2">{env.description}</p>
                <div className="flex flex-wrap gap-1.5 mt-3">
                  {env.modules.map(m => (
                    <span key={m} className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-white/10 text-white/60">{m}</span>
                  ))}
                </div>
              </div>
              {env.live && (
                <div className="shrink-0 self-center flex flex-col items-center gap-2">
                  <ArrowRight size={18} weight="bold" className="text-white/50" />
                  <button
                    onClick={e => { e.stopPropagation(); setProvisionEnv(env.id) }}
                    title="Provision cloud environment"
                    className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white/50 hover:text-white/80 transition-colors"
                  >
                    <CloudArrowUp size={14} weight="bold" />
                  </button>
                </div>
              )}
            </div>
          )

          return env.live
            ? (
              <button key={env.id} onClick={() => onSelectTool(env.id)} className="w-full text-left">
                {card}
              </button>
            )
            : <div key={env.id}>{card}</div>
        })}
      </div>

      {provisionEnv && (
        <ProvisionDialog
          environment={provisionEnv}
          onClose={() => setProvisionEnv(null)}
        />
      )}
    </div>
  )
}
