import { resolveEnvironmentModules } from './environmentModuleIcons'

interface EnvironmentModuleIconStackProps {
  moduleIds?: string[]
  size?: 'sm' | 'md'
  max?: number
}

export function EnvironmentModuleIconStack({
  moduleIds,
  size = 'md',
  max = 4,
}: EnvironmentModuleIconStackProps) {
  const modules = resolveEnvironmentModules(moduleIds).slice(0, max)
  const tileClass = size === 'sm' ? 'h-4 w-4 rounded-[4px]' : 'h-5 w-5 rounded-md'
  const iconSize = size === 'sm' ? 10 : 12

  if (modules.length === 0) return null

  return (
    <div className="grid grid-cols-2 gap-1 shrink-0">
      {modules.map(module => (
        <span
          key={module.id}
          className={`${tileClass} flex items-center justify-center border border-background/60`}
          style={{ backgroundColor: `${module.color}22`, color: module.color }}
          title={module.label}
        >
          <module.Icon size={iconSize} weight="duotone" />
        </span>
      ))}
    </div>
  )
}
