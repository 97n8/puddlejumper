import { useRef, useCallback } from 'react'
import { detectLanguage, LANGUAGE_META, isBinaryPath } from './utils'
import { FileX } from '@phosphor-icons/react'

interface HistoryEntry {
  content: string
  selStart: number
  selEnd: number
}

function useUndoRedo(initial: string) {
  const history = useRef<HistoryEntry[]>([{ content: initial, selStart: 0, selEnd: 0 }])
  const pointer = useRef(0)
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const push = useCallback((content: string, selStart: number, selEnd: number) => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current)
    debounceTimer.current = setTimeout(() => {
      const hist = history.current
      const curr = hist[pointer.current]
      if (curr?.content === content) return
      history.current = hist.slice(0, pointer.current + 1)
      if (history.current.length >= 200) history.current.shift()
      history.current.push({ content, selStart, selEnd })
      pointer.current = history.current.length - 1
    }, 500)
  }, [])

  const undo = useCallback((): HistoryEntry | null => {
    if (debounceTimer.current) { clearTimeout(debounceTimer.current); debounceTimer.current = null }
    if (pointer.current <= 0) return null
    pointer.current--
    return history.current[pointer.current]
  }, [])

  const redo = useCallback((): HistoryEntry | null => {
    if (debounceTimer.current) { clearTimeout(debounceTimer.current); debounceTimer.current = null }
    if (pointer.current >= history.current.length - 1) return null
    pointer.current++
    return history.current[pointer.current]
  }, [])

  const reset = useCallback((content: string) => {
    if (debounceTimer.current) { clearTimeout(debounceTimer.current); debounceTimer.current = null }
    history.current = [{ content, selStart: 0, selEnd: 0 }]
    pointer.current = 0
  }, [])

  const canUndo = useCallback(() => pointer.current > 0, [])
  const canRedo = useCallback(() => pointer.current < history.current.length - 1, [])

  return { push, undo, redo, reset, canUndo, canRedo }
}

interface CodeEditorProps {
  path: string
  value: string
  onChange: (value: string) => void
  onSaveShortcut?: () => void
  onCursorChange?: (pos: { line: number; col: number }) => void
  readOnly?: boolean
  minHeight?: number
  // legacy compat
  disabled?: boolean
  placeholder?: string
}

export function CodeEditor({ path, value, onChange, onSaveShortcut, onCursorChange, readOnly = false, minHeight = 400, disabled }: CodeEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const composing = useRef(false)
  const lang = detectLanguage(path)
  const meta = LANGUAGE_META[lang]
  const { push, undo, redo, reset } = useUndoRedo(value)

  // reset history on path change — use a ref to track last path
  const lastPath = useRef(path)
  if (lastPath.current !== path) {
    lastPath.current = path
    reset(value)
  }

  const isBinary = isBinaryPath(path)
  if (isBinary) {
    return (
      <div
        role="alert"
        className="flex flex-col items-center justify-center gap-3 py-16 text-muted-foreground"
        style={{ minHeight }}
      >
        <FileX size={32} weight="duotone" className="text-muted-foreground/50" />
        <p className="text-sm">Binary files cannot be edited in the code editor.</p>
        <p className="text-xs opacity-60">{path}</p>
      </div>
    )
  }

  const lines = value.split('\n')
  const isReadOnly = readOnly || disabled

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (composing.current) return

    const ta = e.currentTarget
    const isMac = navigator.platform.toUpperCase().includes('MAC')
    const mod = isMac ? e.metaKey : e.ctrlKey

    // Ctrl+S / Cmd+S
    if (mod && e.key === 's') {
      e.preventDefault()
      onSaveShortcut?.()
      return
    }

    // Undo
    if (mod && !e.shiftKey && e.key === 'z') {
      e.preventDefault()
      const entry = undo()
      if (entry) {
        onChange(entry.content)
        requestAnimationFrame(() => {
          if (textareaRef.current) {
            textareaRef.current.selectionStart = entry.selStart
            textareaRef.current.selectionEnd = entry.selEnd
          }
        })
      }
      return
    }

    // Redo
    if ((mod && e.key === 'y') || (mod && e.shiftKey && e.key === 'z')) {
      e.preventDefault()
      const entry = redo()
      if (entry) {
        onChange(entry.content)
        requestAnimationFrame(() => {
          if (textareaRef.current) {
            textareaRef.current.selectionStart = entry.selStart
            textareaRef.current.selectionEnd = entry.selEnd
          }
        })
      }
      return
    }

    // Tab → 2 spaces
    if (e.key === 'Tab') {
      e.preventDefault()
      const start = ta.selectionStart, end = ta.selectionEnd
      const next = value.slice(0, start) + '  ' + value.slice(end)
      onChange(next)
      requestAnimationFrame(() => {
        if (textareaRef.current) {
          textareaRef.current.selectionStart = textareaRef.current.selectionEnd = start + 2
        }
      })
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    if (composing.current) return
    const next = e.target.value
    onChange(next)
    push(next, e.target.selectionStart, e.target.selectionEnd)
  }

  const handleCompositionStart = () => { composing.current = true }
  const handleCompositionEnd = (e: React.CompositionEvent<HTMLTextAreaElement>) => {
    composing.current = false
    onChange((e.target as HTMLTextAreaElement).value)
  }

  const handleSelect = (e: React.SyntheticEvent<HTMLTextAreaElement>) => {
    if (!onCursorChange) return
    const ta = e.currentTarget
    const before = value.slice(0, ta.selectionStart)
    const line = (before.match(/\n/g) ?? []).length + 1
    const col = before.length - before.lastIndexOf('\n')
    onCursorChange({ line, col })
  }

  return (
    <div
      role="region"
      aria-label={`Code editor — ${meta.label}`}
      className="relative flex font-mono text-sm overflow-hidden rounded-lg border border-border bg-[#0d1117]"
      style={{ minHeight }}
    >
      {/* Line numbers */}
      <div
        aria-hidden="true"
        className="select-none text-right pr-3 pt-3 pb-3 text-muted-foreground/40 text-xs leading-6 border-r border-border bg-black/20 min-w-[3rem]"
      >
        {lines.map((_, i) => <div key={i}>{i + 1}</div>)}
      </div>

      {/* Textarea */}
      <textarea
        ref={textareaRef}
        role="textbox"
        aria-multiline="true"
        aria-label={`${meta.label} editor — ${path}`}
        aria-readonly={isReadOnly || undefined}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onCompositionStart={handleCompositionStart}
        onCompositionEnd={handleCompositionEnd}
        onSelect={handleSelect}
        readOnly={isReadOnly}
        spellCheck={false}
        className="flex-1 resize-none bg-transparent text-[#e6edf3] p-3 leading-6 outline-none w-full"
        style={{ minHeight, fontFamily: 'inherit' }}
      />

      {/* SR hint */}
      <span aria-live="polite" className="sr-only">
        Press Ctrl+Z to undo, Ctrl+Y to redo, Ctrl+S to save, Tab to indent
      </span>
    </div>
  )
}
