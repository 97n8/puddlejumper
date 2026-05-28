import { createContext, useContext, useEffect, ReactNode } from 'react'
import { useKV } from '@/hooks/useKV'

interface ColorContextType {
  shellColor: string
  setShellColor: (color: string) => void
}

const ColorContext = createContext<ColorContextType | undefined>(undefined)

const DEFAULT_COLOR = 'oklch(0.65 0.18 155)'

export function ColorProvider({ children }: { children: ReactNode }) {
  const [shellColor, setShellColor] = useKV<string>('logicos-shell-color', DEFAULT_COLOR)

  useEffect(() => {
    const color = shellColor || DEFAULT_COLOR
    document.documentElement.style.setProperty('--shell-color', color)
    document.documentElement.style.setProperty('--shell-color-10', `${color}1a`)
    document.documentElement.style.setProperty('--shell-color-20', `${color}33`)
    // Wire accent to --primary and --ring so the color picker affects both themes
    document.documentElement.style.setProperty('--primary', color)
    document.documentElement.style.setProperty('--ring', color)
  }, [shellColor])

  return (
    <ColorContext.Provider value={{ shellColor: shellColor || DEFAULT_COLOR, setShellColor }}>
      {children}
    </ColorContext.Provider>
  )
}

export function useShellColor() {
  const context = useContext(ColorContext)
  if (context === undefined) {
    throw new Error('useShellColor must be used within a ColorProvider')
  }
  return context
}
