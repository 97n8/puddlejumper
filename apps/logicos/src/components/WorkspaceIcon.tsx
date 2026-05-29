import { useState } from 'react'
import { cn } from '@/lib/utils'

const ICON_MAP: Record<string, string> = {
  Buildings: '🏛️', Globe: '🌐', FolderOpen: '📂', Folder: '📁',
  Shield: '🛡️', FileText: '📄', Star: '⭐', Map: '🗺️', Tree: '🌲',
}

function resolveEmoji(icon?: string | null): string {
  if (!icon || icon.startsWith('http')) return '🏛️'
  if (/^[A-Za-z]+$/.test(icon)) return ICON_MAP[icon] ?? '🏛️'
  return icon
}

interface WorkspaceIconProps {
  /** Emoji character, ICON_MAP key, or full https:// URL to a town seal */
  icon?: string | null
  name?: string
  className?: string
  imgClassName?: string
}

/**
 * Renders a workspace icon — either an emoji or a remote image (town seal).
 * Falls back to 🏛️ if the image fails to load.
 */
export function WorkspaceIcon({ icon, name, className, imgClassName }: WorkspaceIconProps) {
  const [imgFailed, setImgFailed] = useState(false)
  const isUrl = icon?.startsWith('http')

  if (isUrl && !imgFailed) {
    return (
      <img
        src={icon!}
        alt={name ?? 'workspace'}
        className={cn('object-contain w-full h-full', imgClassName)}
        onError={() => setImgFailed(true)}
        loading="lazy"
      />
    )
  }

  const emoji = imgFailed ? '🏛️' : resolveEmoji(icon)
  return (
    <span
      className={cn('leading-none select-none flex items-center justify-center', className)}
      role="img"
      aria-label={name ?? 'workspace'}
      style={{ fontFamily: 'Apple Color Emoji, Segoe UI Emoji, Noto Color Emoji, sans-serif' }}
    >
      {emoji}
    </span>
  )
}

/** Standalone helper — returns the display emoji for non-URL icons */
export { resolveEmoji }
