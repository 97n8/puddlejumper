import { useRef, useEffect, useCallback } from 'react'
import {
  TextB, TextItalic, TextAUnderline, TextStrikethrough,
  ListBullets, ListNumbers, Quotes, Link, Minus,
  ArrowCounterClockwise, ArrowClockwise as Redo,
} from '@phosphor-icons/react'

interface DocEditorProps {
  value: string
  onChange: (html: string) => void
  disabled?: boolean
  placeholder?: string
}

const TOOLBAR_BUTTONS = [
  { group: 'history', items: [
    { cmd: 'undo',   icon: ArrowCounterClockwise, title: 'Undo (⌘Z)' },
    { cmd: 'redo',   icon: Redo,                  title: 'Redo (⌘⇧Z)' },
  ]},
  { group: 'headings', items: [
    { cmd: 'h1',  label: 'H1', title: 'Heading 1' },
    { cmd: 'h2',  label: 'H2', title: 'Heading 2' },
    { cmd: 'h3',  label: 'H3', title: 'Heading 3' },
  ]},
  { group: 'format', items: [
    { cmd: 'bold',          icon: TextB,            title: 'Bold (⌘B)' },
    { cmd: 'italic',        icon: TextItalic,       title: 'Italic (⌘I)' },
    { cmd: 'underline',     icon: TextAUnderline,   title: 'Underline (⌘U)' },
    { cmd: 'strikeThrough', icon: TextStrikethrough, title: 'Strikethrough' },
  ]},
  { group: 'lists', items: [
    { cmd: 'insertUnorderedList', icon: ListBullets,  title: 'Bullet list' },
    { cmd: 'insertOrderedList',   icon: ListNumbers,  title: 'Numbered list' },
  ]},
  { group: 'block', items: [
    { cmd: 'blockquote',        icon: Quotes, title: 'Blockquote' },
    { cmd: 'insertHorizontalRule', icon: Minus, title: 'Divider' },
  ]},
  { group: 'link', items: [
    { cmd: 'link', icon: Link, title: 'Insert link' },
  ]},
]

function execCmd(cmd: string) {
  if (cmd === 'undo') { document.execCommand('undo', false); return }
  if (cmd === 'redo') { document.execCommand('redo', false); return }
  if (cmd === 'h1' || cmd === 'h2' || cmd === 'h3') {
    document.execCommand('formatBlock', false, cmd)
    return
  }
  if (cmd === 'blockquote') {
    document.execCommand('formatBlock', false, 'blockquote')
    return
  }
  if (cmd === 'link') {
    const url = window.prompt('URL:')
    if (url) document.execCommand('createLink', false, url)
    return
  }
  document.execCommand(cmd, false)
}

export function DocEditor({ value, onChange, disabled, placeholder = 'Start writing…' }: DocEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null)
  const internalChange = useRef(false)

  // Sync external value → DOM only on mount or when externally changed
  useEffect(() => {
    const el = editorRef.current
    if (!el) return
    if (internalChange.current) { internalChange.current = false; return }
    if (el.innerHTML !== value) el.innerHTML = value
  }, [value])

  const handleInput = useCallback(() => {
    internalChange.current = true
    onChange(editorRef.current?.innerHTML ?? '')
  }, [onChange])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey)) {
      if (e.key === 'b') { e.preventDefault(); document.execCommand('bold', false) }
      if (e.key === 'i') { e.preventDefault(); document.execCommand('italic', false) }
      if (e.key === 'u') { e.preventDefault(); document.execCommand('underline', false) }
      if (e.key === 'z' && !e.shiftKey) { e.preventDefault(); document.execCommand('undo', false) }
      if (e.key === 'z' && e.shiftKey)  { e.preventDefault(); document.execCommand('redo', false) }
    }
  }, [])

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-0.5 px-3 py-1.5 border-b border-border bg-card flex-shrink-0 select-none">
        {TOOLBAR_BUTTONS.map((group, gi) => (
          <div key={gi} className="flex items-center gap-0.5 pr-2 mr-1.5 border-r border-border last:border-0 last:mr-0 last:pr-0">
            {group.items.map(btn => {
              const Icon = 'icon' in btn ? btn.icon : null
              return (
                <button
                  key={btn.cmd}
                  title={btn.title}
                  disabled={disabled}
                  onMouseDown={e => { e.preventDefault(); execCmd(btn.cmd) }}
                  className="flex items-center justify-center w-7 h-7 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40 text-xs font-semibold"
                >
                  {Icon ? <Icon size={14} weight="bold" /> : ('label' in btn ? btn.label : null)}
                </button>
              )
            })}
          </div>
        ))}
      </div>

      {/* Page */}
      <div className="flex-1 overflow-y-auto bg-muted/30 flex justify-center py-8 px-4">
        <div
          ref={editorRef}
          contentEditable={!disabled}
          suppressContentEditableWarning
          onInput={handleInput}
          onKeyDown={handleKeyDown}
          data-placeholder={placeholder}
          className="
            doc-editor-content
            w-full max-w-[680px] min-h-[600px]
            bg-white dark:bg-zinc-900 shadow-sm rounded-lg
            px-14 py-12
            text-foreground text-base leading-relaxed
            focus:outline-none
            [&_h1]:text-3xl [&_h1]:font-bold [&_h1]:mt-6 [&_h1]:mb-3
            [&_h2]:text-2xl [&_h2]:font-semibold [&_h2]:mt-5 [&_h2]:mb-2
            [&_h3]:text-xl [&_h3]:font-semibold [&_h3]:mt-4 [&_h3]:mb-2
            [&_p]:my-2
            [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:my-2
            [&_ol]:list-decimal [&_ol]:pl-6 [&_ol]:my-2
            [&_li]:my-1
            [&_blockquote]:border-l-4 [&_blockquote]:border-indigo-400 [&_blockquote]:pl-4 [&_blockquote]:italic [&_blockquote]:text-muted-foreground [&_blockquote]:my-3
            [&_hr]:border-border [&_hr]:my-4
            [&_a]:text-indigo-500 [&_a]:underline
            [&_strong]:font-bold
            [&_em]:italic
            [&_u]:underline
            [&_s]:line-through
            empty:before:content-[attr(data-placeholder)] empty:before:text-muted-foreground/40 empty:before:pointer-events-none
          "
        />
      </div>

      <style>{`
        .doc-editor-content:focus { outline: none; }
        .doc-editor-content b, .doc-editor-content strong { font-weight: bold; }
        .doc-editor-content i, .doc-editor-content em { font-style: italic; }
      `}</style>
    </div>
  )
}
