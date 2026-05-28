/**
 * VaultModuleTemplateGallery
 *
 * Massachusetts VAULT module template browser. One-click deploy pre-configures
 * a module with statutory deadlines, email templates, and workflow settings —
 * fully compliant out of the box.
 */

import { useState } from 'react'
import { CheckCircle, Sparkle, Clock, FileText, ArrowRight } from '@phosphor-icons/react'
import { useKV } from '@github/spark/hooks'
import { toast } from 'sonner'
import { updateCaseSpace } from '@/services/casespaceApi'
import type { CaseSpace } from '@/lib/types'
import type { VaultModuleSettings } from '../types'
import {
  MA_MODULE_TEMPLATES,
  TEMPLATE_CATEGORIES,
  getTemplatesByCategory,
  type MAModuleTemplate,
  type TemplateCategory,
} from '../data/maModuleTemplates'

interface VaultModuleTemplateGalleryProps {
  envId: string
  currentModuleIds: string[]
  municipalityName?: string
  onDeployed: (moduleId: string, updatedEnvironment: CaseSpace) => void
}

export function VaultModuleTemplateGallery({
  envId,
  currentModuleIds,
  municipalityName,
  onDeployed,
}: VaultModuleTemplateGalleryProps) {
  const [activeCategory, setActiveCategory] = useState<TemplateCategory | 'all'>('all')
  const [deploying, setDeploying] = useState<string | null>(null)
  const [justDeployed, setJustDeployed] = useState<string[]>([])
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const [allSettings, setAllSettings] = useKV<Record<string, VaultModuleSettings>>(
    `vault-settings-${envId}`,
    {},
  )

  const templates = getTemplatesByCategory(activeCategory)
  const deployed = new Set([...currentModuleIds, ...justDeployed])

  async function deployTemplate(template: MAModuleTemplate) {
    if (deployed.has(template.moduleId) || deploying) return
    setDeploying(template.id)
    try {
      // 1. Add module to environment
      const newIds = [...currentModuleIds, ...justDeployed, template.moduleId]
      const updatedEnvironment = await updateCaseSpace(envId, { vaultModuleIds: Array.from(new Set(newIds)) }).catch(() => null)
      if (!updatedEnvironment) {
        toast.error('Could not add that module to the environment. Please try again.')
        return
      }

      // 2. Persist preset workflow/email settings
      if (template.presetSettings && Object.keys(template.presetSettings).length > 0) {
        const current = allSettings ?? {}
        const existing = current[template.moduleId] ?? ({} as Partial<VaultModuleSettings>)
        const defaults: VaultModuleSettings = {
          moduleId: template.moduleId,
          envId,
          raos: [],
          escalation: [],
          emailNotificationsEnabled: true,
          notificationEmail: '',
          trainingLinks: [],
          updatedAt: Date.now(),
        }
        const merged: VaultModuleSettings = {
          ...defaults,
          ...existing,
          ...template.presetSettings,
          moduleId: template.moduleId,
          envId,
          updatedAt: Date.now(),
          workflow: existing.workflow
            ? existing.workflow
            : template.presetSettings.workflow ?? undefined,
          municipalityName: municipalityName ?? existing.municipalityName,
        }
        setAllSettings({ ...current, [template.moduleId]: merged })
      }

      setJustDeployed(prev => [...prev, template.moduleId])
      toast.success(`${template.name} added to ${municipalityName ?? 'this environment'}.`)
      onDeployed(template.moduleId, updatedEnvironment)
    } finally {
      setDeploying(null)
    }
  }

  return (
    <div className="flex flex-col h-full min-h-0 bg-background">
      {/* Header */}
      <div className="shrink-0 px-4 pt-4 pb-3 border-b border-border">
        <div className="flex items-start gap-2">
          <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center shrink-0">
            <Sparkle size={16} className="text-white" weight="fill" />
          </div>
          <div>
            <h2 className="text-sm font-semibold">Massachusetts Module Templates</h2>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Pre-configured for MA law — statutory deadlines, exemptions, and email templates built in.
              Deploy in one click.
            </p>
          </div>
        </div>

        {/* Category filter */}
        <div className="flex gap-1 mt-3 overflow-x-auto pb-1 -mx-1 px-1">
          {TEMPLATE_CATEGORIES.map(cat => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={`shrink-0 px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors ${
                activeCategory === cat.id
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Template grid */}
      <div className="flex-1 min-h-0 overflow-y-auto p-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
          {templates.map(template => (
            <TemplateCard
              key={template.id}
              template={template}
              isDeployed={deployed.has(template.moduleId)}
              isDeploying={deploying === template.id}
              isExpanded={expandedId === template.id}
              onExpand={() => setExpandedId(expandedId === template.id ? null : template.id)}
              onDeploy={() => deployTemplate(template)}
            />
          ))}
        </div>

        {templates.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <Sparkle size={32} weight="duotone" className="mb-2 opacity-40" />
            <p className="text-sm">No templates in this category yet.</p>
          </div>
        )}
      </div>

      {/* Footer stat */}
      <div className="shrink-0 border-t border-border px-4 py-2 flex items-center gap-3">
        <span className="text-[11px] text-muted-foreground">
          {MA_MODULE_TEMPLATES.length} templates · {justDeployed.length > 0 ? `${justDeployed.length} deployed this session` : 'MA-law compliant'}
        </span>
      </div>
    </div>
  )
}

// ── Template card ──────────────────────────────────────────────────────────────

interface TemplateCardProps {
  template: MAModuleTemplate
  isDeployed: boolean
  isDeploying: boolean
  isExpanded: boolean
  onExpand: () => void
  onDeploy: () => void
}

function TemplateCard({ template, isDeployed, isDeploying, isExpanded, onExpand, onDeploy }: TemplateCardProps) {
  return (
    <div className={`rounded-xl border bg-card overflow-hidden flex flex-col transition-shadow ${
      isDeployed ? 'opacity-80' : 'hover:shadow-md'
    }`}>
      {/* Colored header */}
      <div className={`${template.color} px-3 py-2.5 flex items-start justify-between gap-2`}>
        <div>
          <div className="text-white font-semibold text-[13px] leading-tight">{template.name}</div>
          <div className="text-white/70 text-[10px] mt-0.5 font-mono">{template.subtitle}</div>
        </div>
        {isDeployed && (
          <CheckCircle size={18} className="text-white/90 shrink-0 mt-0.5" weight="fill" />
        )}
      </div>

      {/* Body */}
      <div className="flex-1 flex flex-col p-3 gap-2">
        <p className="text-[11px] text-muted-foreground leading-relaxed line-clamp-2">
          {template.description}
        </p>

        {/* SLA + stages row */}
        <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1">
            <Clock size={11} />
            {template.slaBusinessDays}bd SLA
          </span>
          <span className="flex items-center gap-1">
            <FileText size={11} />
            {template.stages.length} stages
          </span>
        </div>

        {/* Stages chips */}
        <div className="flex flex-wrap gap-1">
          {template.stages.slice(0, isExpanded ? undefined : 3).map(s => (
            <span key={s} className="px-1.5 py-0.5 rounded text-[10px] bg-muted text-muted-foreground font-medium">
              {s}
            </span>
          ))}
          {!isExpanded && template.stages.length > 3 && (
            <span className="px-1.5 py-0.5 rounded text-[10px] bg-muted text-muted-foreground">
              +{template.stages.length - 3}
            </span>
          )}
        </div>

        {/* Expanded: features */}
        {isExpanded && (
          <ul className="mt-1 space-y-0.5">
            {template.features.map(f => (
              <li key={f} className="flex items-start gap-1.5 text-[11px] text-muted-foreground">
                <span className={`${template.textColor} mt-0.5 shrink-0`}>✓</span>
                {f}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Footer actions */}
      <div className="px-3 pb-3 flex items-center gap-2">
        <button
          onClick={onExpand}
          className="text-[11px] text-muted-foreground hover:text-foreground transition-colors"
        >
          {isExpanded ? 'Less' : 'Details'}
        </button>
        <div className="flex-1" />
        {isDeployed ? (
          <span className="flex items-center gap-1 text-[11px] text-emerald-600 font-medium">
            <CheckCircle size={12} weight="fill" /> Deployed
          </span>
        ) : (
          <button
            onClick={onDeploy}
            disabled={isDeploying}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-colors ${
              isDeploying
                ? 'bg-muted text-muted-foreground cursor-wait'
                : `${template.color} text-white hover:opacity-90`
            }`}
          >
            {isDeploying ? 'Deploying…' : (
              <>Deploy <ArrowRight size={11} weight="bold" /></>
            )}
          </button>
        )}
      </div>
    </div>
  )
}
