import { useState } from 'react'
import { getTemplatesByCategory, type MAModuleTemplate, type TemplateCategory } from '@/features/vault/data/maModuleTemplates'
import { CheckCircle, Package, Gavel, FileText, Buildings, Clock, Shield } from '@phosphor-icons/react'
import type { Municipality } from '@/data/maMunicipalities'
import { toast } from 'sonner'

const CATEGORIES: { id: TemplateCategory | 'all'; label: string }[] = [
  { id: 'all', label: 'All Templates' },
  { id: 'public-records', label: 'Public Records' },
  { id: 'permitting', label: 'Permitting' },
  { id: 'licensing', label: 'Licensing' },
  { id: 'compliance', label: 'Compliance' },
  { id: 'governance', label: 'Governance' },
  { id: 'administration', label: 'Administration' },
]

const CAT_ICON: Record<string, React.FC<{ size?: number; className?: string }>> = {
  'public-records': FileText,
  'permitting': Buildings,
  'licensing': Gavel,
  'compliance': Shield,
  'governance': Gavel,
  'administration': Clock,
}

interface TemplatesPanelProps {
  town: Municipality
}

export function TemplatesPanel({ town }: TemplatesPanelProps) {
  const [activeCategory, setActiveCategory] = useState<TemplateCategory | 'all'>('all')
  const [deployed, setDeployed] = useState<Set<string>>(new Set())
  const [deploying, setDeploying] = useState<string | null>(null)

  const templates = getTemplatesByCategory(activeCategory)

  function handleDeploy(template: MAModuleTemplate) {
    if (deployed.has(template.id) || deploying) return
    setDeploying(template.id)
    setTimeout(() => {
      setDeployed(prev => new Set([...prev, template.id]))
      setDeploying(null)
      toast.success(`${template.name} deployed to ${town.name}`)
    }, 1200)
  }

  return (
    <div className="flex-1 min-h-0 flex flex-col" style={{ backgroundColor: '#F5F1E8' }}>
      {/* Header */}
      <div className="px-6 pt-6 pb-4">
        <h1 className="text-xl font-semibold" style={{ color: '#1A1D16' }}>Module Templates</h1>
        <p className="text-sm mt-1" style={{ color: '#7A7870' }}>
          Massachusetts-compliant process templates — pre-configured with MGL citations, deadlines, and stage rules.
        </p>
      </div>

      {/* Category filter */}
      <div className="px-6 flex gap-2 flex-wrap pb-4">
        {CATEGORIES.map(c => (
          <button
            key={c.id}
            onClick={() => setActiveCategory(c.id)}
            className="px-3 py-1.5 rounded-full text-xs font-medium border transition-all"
            style={activeCategory === c.id
              ? { backgroundColor: '#2C5F2D', color: 'white', borderColor: '#2C5F2D' }
              : { backgroundColor: 'white', color: '#7A7870', borderColor: '#DDD8CE' }
            }
          >
            {c.label}
          </button>
        ))}
      </div>

      {/* Grid */}
      <div className="flex-1 min-h-0 overflow-y-auto px-6 pb-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {templates.map(template => {
            const isDeployed = deployed.has(template.id)
            const isDeploying = deploying === template.id
            const Icon = CAT_ICON[template.category] ?? Package
            return (
              <div
                key={template.id}
                className="rounded-xl border p-4 flex flex-col gap-3 transition-all"
                style={{
                  backgroundColor: isDeployed ? '#E8F2EB' : 'white',
                  borderColor: isDeployed ? '#97BC62' : '#DDD8CE',
                }}
              >
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                    style={{ backgroundColor: '#E8F2EB' }}>
                    <Icon size={18} className="text-[#2C5F2D]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold" style={{ color: '#1A1D16' }}>{template.name}</div>
                    <div className="text-[11px] mt-0.5" style={{ color: '#7A7870' }}>{template.subtitle}</div>
                  </div>
                  {isDeployed && <CheckCircle size={18} className="text-[#2C5F2D] shrink-0" />}
                </div>
                <p className="text-xs leading-relaxed" style={{ color: '#7A7870' }}>{template.description}</p>
                {template.features && template.features.length > 0 && (
                  <div className="flex flex-col gap-1">
                    {template.features.slice(0, 3).map(f => (
                      <span key={f} className="text-[10px] px-1.5 py-0.5 rounded"
                        style={{ backgroundColor: '#F5F1E8', color: '#2C5F2D', border: '1px solid #DDD8CE' }}>
                        {f}
                      </span>
                    ))}
                  </div>
                )}
                <button
                  onClick={() => handleDeploy(template)}
                  disabled={isDeployed || !!deploying}
                  className="mt-auto px-3 py-1.5 rounded-lg text-xs font-medium transition-all disabled:opacity-60"
                  style={isDeployed
                    ? { backgroundColor: '#97BC62', color: 'white' }
                    : { backgroundColor: '#2C5F2D', color: 'white' }
                  }
                >
                  {isDeploying ? 'Deploying…' : isDeployed ? 'Deployed ✓' : 'Deploy to Environment'}
                </button>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
