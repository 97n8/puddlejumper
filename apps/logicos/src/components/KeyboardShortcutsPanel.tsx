import { X, Keyboard } from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

interface KeyboardShortcutsPanelProps {
  isOpen: boolean
  onClose: () => void
}

export function KeyboardShortcutsPanel({ isOpen, onClose }: KeyboardShortcutsPanelProps) {
  if (!isOpen) return null

  const isMac = /Mac|iPhone|iPad/.test(navigator.platform)
  const modKey = isMac ? '⌘' : 'Ctrl'

  const shortcuts = [
    {
      category: 'Global',
      items: [
        { keys: [modKey, 'K'], description: 'Open/close PuddleJumper' },
        { keys: ['Esc'], description: 'Close open panels' },
        { keys: ['?'], description: 'Show keyboard shortcuts' },
      ],
    },
    {
      category: 'Navigation',
      items: [
        { keys: ['1'], description: 'Switch to Automations' },
        { keys: ['2'], description: 'Switch to Vault' },
        { keys: ['3'], description: 'Switch to LogicDash' },
      ],
    },
  ]

  return (
    <div
      className="fixed inset-0 z-[9100] bg-background/40 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 p-5 border-b border-border bg-muted/30">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center">
              <Keyboard size={20} weight="duotone" className="text-white" />
            </div>
            <div>
              <h2 className="font-semibold text-base">Keyboard Shortcuts</h2>
              <p className="text-xs text-muted-foreground">Quick access to everything</p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={onClose}
            aria-label="Close shortcuts panel"
          >
            <X size={16} />
          </Button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto p-5">
          <div className="space-y-6">
            {shortcuts.map((section) => (
              <div key={section.category}>
                <div className="flex items-center gap-2 mb-3">
                  <h3 className="text-sm font-semibold text-foreground">
                    {section.category}
                  </h3>
                  <div className="flex-1 h-px bg-border" />
                </div>
                <div className="space-y-2">
                  {section.items.map((shortcut, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between gap-4 p-2.5 rounded-lg hover:bg-muted/50 transition-colors"
                    >
                      <span className="text-sm text-foreground">
                        {shortcut.description}
                      </span>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        {shortcut.keys.map((key, keyIndex) => (
                          <span key={keyIndex} className="flex items-center gap-1">
                            <Badge
                              variant="outline"
                              className="px-2 py-1 text-xs font-mono bg-background border-border"
                            >
                              {key}
                            </Badge>
                            {keyIndex < shortcut.keys.length - 1 && (
                              <span className="text-xs text-muted-foreground">+</span>
                            )}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between px-5 py-3 border-t border-border bg-muted/30">
          <div className="text-xs text-muted-foreground">
            Press <kbd className="px-1.5 py-0.5 text-[10px] font-mono bg-background border border-border rounded ml-1">?</kbd> anytime to view shortcuts
          </div>
          <Badge variant="secondary" className="text-[10px] px-2 py-0.5">
            {isMac ? 'macOS' : 'Windows/Linux'}
          </Badge>
        </div>
      </div>
    </div>
  )
}
