import { useEffect, useState } from 'react'
import { useKV } from './useKV'

export type ViewMode = 'auto' | 'mobile' | 'desktop'

/**
 * Detects whether mobile layout should be active.
 * - 'auto': follows the viewport (< 768 px = mobile)
 * - 'mobile': user forced mobile view
 * - 'desktop': user forced desktop view (persists across sessions)
 */
export function useMobileMode(): {
  isMobile: boolean
  viewOverride: ViewMode
  setViewOverride: (v: ViewMode) => void
  isSmallScreen: boolean
} {
  const [viewOverride, setViewOverride] = useKV<ViewMode>('logicos-view-mode', 'auto')
  const [isSmallScreen, setIsSmallScreen] = useState(
    () => typeof window !== 'undefined' ? window.innerWidth < 768 : false
  )

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)')
    setIsSmallScreen(mq.matches)
    const handler = (e: MediaQueryListEvent) => setIsSmallScreen(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  const mode = viewOverride ?? 'auto'
  const isMobile = mode === 'mobile' || (mode === 'auto' && isSmallScreen)

  return {
    isMobile,
    viewOverride: mode,
    setViewOverride,
    isSmallScreen,
  }
}
