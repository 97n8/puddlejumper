import { cn } from '@/lib/utils'

type AEDTone = 'neutral' | 'amber' | 'red' | 'orange' | 'yellow' | 'emerald'

const panelToneClasses: Record<AEDTone, string> = {
  neutral: 'border-stone-200/90 bg-white/92 shadow-sm dark:border-zinc-700/40 dark:bg-zinc-900/20',
  amber: 'border-amber-200 bg-amber-50/92 shadow-sm dark:border-amber-700/30 dark:bg-amber-900/10',
  red: 'border-red-200 bg-red-50/92 shadow-sm dark:border-red-700/30 dark:bg-red-900/10',
  orange: 'border-orange-200 bg-orange-50/92 shadow-sm dark:border-orange-700/30 dark:bg-orange-900/10',
  yellow: 'border-yellow-200 bg-yellow-50/92 shadow-sm dark:border-yellow-700/30 dark:bg-yellow-900/10',
  emerald: 'border-emerald-200 bg-emerald-50/92 shadow-sm dark:border-emerald-700/30 dark:bg-emerald-900/10',
}

const interactiveToneClasses: Record<AEDTone, string> = {
  neutral: 'hover:border-stone-300 hover:shadow-md dark:hover:border-zinc-600/50',
  amber: 'hover:border-amber-300 hover:shadow-md dark:hover:border-amber-600/50',
  red: 'hover:border-red-300 hover:shadow-md dark:hover:border-red-600/50',
  orange: 'hover:border-orange-300 hover:shadow-md dark:hover:border-orange-600/50',
  yellow: 'hover:border-yellow-300 hover:shadow-md dark:hover:border-yellow-600/50',
  emerald: 'hover:border-emerald-300 hover:shadow-md dark:hover:border-emerald-600/50',
}

const badgeToneClasses: Record<AEDTone, string> = {
  neutral: 'border-stone-200 bg-stone-100 text-stone-700 dark:border-zinc-700/40 dark:bg-zinc-900/30 dark:text-zinc-300',
  amber: 'border-amber-200 bg-amber-100 text-amber-800 dark:border-amber-700/40 dark:bg-amber-900/30 dark:text-amber-300',
  red: 'border-red-200 bg-red-100 text-red-700 dark:border-red-700/40 dark:bg-red-900/30 dark:text-red-300',
  orange: 'border-orange-200 bg-orange-100 text-orange-700 dark:border-orange-700/40 dark:bg-orange-900/30 dark:text-orange-300',
  yellow: 'border-yellow-200 bg-yellow-100 text-yellow-800 dark:border-yellow-700/40 dark:bg-yellow-900/30 dark:text-yellow-300',
  emerald: 'border-emerald-200 bg-emerald-100 text-emerald-700 dark:border-emerald-700/40 dark:bg-emerald-900/30 dark:text-emerald-300',
}

export const aedPageClass = 'flex-1 overflow-y-auto bg-gradient-to-b from-background via-amber-50/20 to-background p-6'
export const aedSectionStackClass = 'space-y-6'
export const aedTitleClass = 'text-2xl font-semibold tracking-tight text-zinc-950 dark:text-white/95'
export const aedSubtitleClass = 'mt-1 max-w-3xl text-sm leading-6 text-zinc-600 dark:text-white/55'
export const aedSectionTitleClass = 'text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-white/50'
export const aedMetaTextClass = 'text-[11px] text-zinc-500 dark:text-white/40'
export const aedBodyTextClass = 'text-sm text-zinc-700 dark:text-white/80'
export const aedEmptyStateClass = 'py-12 text-center text-zinc-500 dark:text-white/40'
export const aedBackLinkClass = 'mb-2 inline-flex items-center gap-1 text-[11px] font-medium text-zinc-500 transition-colors hover:text-zinc-800 dark:text-white/40 dark:hover:text-white/65'
export const aedAccentLinkClass = 'text-[11px] font-medium text-amber-700 transition-colors hover:text-amber-800 dark:text-amber-400 dark:hover:text-amber-300'
export const aedPrimaryButtonClass = 'inline-flex items-center gap-1.5 rounded-lg border border-amber-300 bg-amber-100 px-3 py-1.5 text-xs font-semibold text-amber-900 transition-colors hover:bg-amber-200 dark:border-amber-600/50 dark:bg-amber-800/40 dark:text-amber-100 dark:hover:bg-amber-800/60'
export const aedSuccessButtonClass = 'inline-flex items-center gap-1.5 rounded-lg border border-emerald-300 bg-emerald-100 px-3 py-1.5 text-xs font-semibold text-emerald-800 transition-colors hover:bg-emerald-200 dark:border-emerald-700/40 dark:bg-emerald-800/30 dark:text-emerald-200 dark:hover:bg-emerald-800/50'

export function aedPanelClass(tone: AEDTone = 'neutral', className?: string) {
  return cn('rounded-2xl border', panelToneClasses[tone], className)
}

export function aedInteractivePanelClass(tone: AEDTone = 'neutral', className?: string) {
  return cn('rounded-2xl border transition-all', panelToneClasses[tone], interactiveToneClasses[tone], className)
}

export function aedBadgeClass(tone: AEDTone = 'neutral', className?: string) {
  return cn('inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold', badgeToneClasses[tone], className)
}
