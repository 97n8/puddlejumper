/**
 * HelpTip — Lightweight staff tooltip component
 * Shows an ⓘ icon that reveals contextual help on hover.
 * Uses pure CSS via Tailwind group/group-hover — no JS state needed.
 *
 * Usage:
 *   <HelpTip content="This is what this field means." />
 *   <HelpTip content="..." side="left" size="lg" />
 */
import React from 'react'

interface HelpTipProps {
  /** The help text to show in the tooltip */
  content: React.ReactNode
  /** Which side of the icon the tooltip opens toward (default: top) */
  side?: 'top' | 'bottom' | 'left' | 'right'
  /** Width of the tooltip bubble */
  size?: 'sm' | 'md' | 'lg'
  /** Custom class on the wrapper span */
  className?: string
}

const sizeClass = {
  sm: 'w-48',
  md: 'w-64',
  lg: 'w-80',
}

// Positioning for the bubble relative to the icon
const bubblePos: Record<string, string> = {
  top:    'bottom-full left-1/2 -translate-x-1/2 mb-2',
  bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
  left:   'right-full top-1/2 -translate-y-1/2 mr-2',
  right:  'left-full top-1/2 -translate-y-1/2 ml-2',
}

// Triangle arrow
const arrowPos: Record<string, string> = {
  top:    'absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-800',
  bottom: 'absolute bottom-full left-1/2 -translate-x-1/2 border-4 border-transparent border-b-slate-800',
  left:   'absolute left-full top-1/2 -translate-y-1/2 border-4 border-transparent border-l-slate-800',
  right:  'absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-slate-800',
}

export function HelpTip({ content, side = 'top', size = 'md', className = '' }: HelpTipProps) {
  return (
    <span className={`relative group inline-flex items-center ${className}`}>
      {/* Icon */}
      <span
        className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-slate-100 text-slate-400 text-[10px] font-bold cursor-help hover:bg-indigo-100 hover:text-indigo-600 transition-colors select-none flex-shrink-0"
        aria-label="Help"
      >
        i
      </span>

      {/* Tooltip bubble */}
      <span
        className={`
          absolute ${bubblePos[side]} ${sizeClass[size]}
          bg-slate-800 text-slate-100 text-xs rounded-lg px-3 py-2.5 shadow-xl
          opacity-0 group-hover:opacity-100 pointer-events-none
          transition-opacity duration-150
          z-[9999] leading-relaxed
        `}
        role="tooltip"
      >
        {content}
        <span className={arrowPos[side]} />
      </span>
    </span>
  )
}

export default HelpTip
