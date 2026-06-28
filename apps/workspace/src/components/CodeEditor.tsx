import { useRef, useEffect } from 'react'

interface CodeEditorProps {
  html: string
  css: string
  js: string
  onHtmlChange: (value: string) => void
  onCssChange: (value: string) => void
  onJsChange: (value: string) => void
}

export function CodeEditor({
  html,
  css,
  js,
  onHtmlChange,
  onCssChange,
  onJsChange,
}: CodeEditorProps) {
  const htmlRef = useRef<HTMLTextAreaElement>(null)
  const cssRef = useRef<HTMLTextAreaElement>(null)
  const jsRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    const textareas = [htmlRef.current, cssRef.current, jsRef.current]
    textareas.forEach((textarea) => {
      if (textarea) {
        textarea.style.height = 'auto'
        textarea.style.height = `${textarea.scrollHeight}px`
      }
    })
  }, [html, css, js])

  const handleTab = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Tab') {
      e.preventDefault()
      const target = e.target as HTMLTextAreaElement
      const start = target.selectionStart
      const end = target.selectionEnd
      const value = target.value

      target.value = value.substring(0, start) + '  ' + value.substring(end)
      target.selectionStart = target.selectionEnd = start + 2

      const event = new Event('input', { bubbles: true })
      target.dispatchEvent(event)
    }
  }

  const getLineCount = (text: string) => text.split('\n').length
  const getCharCount = (text: string) => text.length

  return (
    <div className="flex flex-col h-full bg-background">
      <div className="flex-1 grid grid-cols-2 grid-rows-2 gap-3 p-3">
        <div className="editor-pane flex flex-col">
          <div className="px-3 py-2 border-b border-border bg-secondary/30 flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground tracking-wide">HTML</span>
            <span className="text-[10px] text-muted-foreground font-mono">
              {getLineCount(html)} lines • {getCharCount(html)} chars
            </span>
          </div>
          <textarea
            ref={htmlRef}
            value={html}
            onChange={(e) => onHtmlChange(e.target.value)}
            onKeyDown={handleTab}
            className="flex-1 p-3 bg-transparent text-foreground outline-none resize-none font-mono text-sm leading-relaxed"
            placeholder="<!DOCTYPE html>&#10;<html>&#10;  <head>...</head>&#10;  <body>...</body>&#10;</html>"
            spellCheck={false}
          />
        </div>

        <div className="editor-pane flex flex-col">
          <div className="px-3 py-2 border-b border-border bg-secondary/30 flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground tracking-wide">CSS</span>
            <span className="text-[10px] text-muted-foreground font-mono">
              {getLineCount(css)} lines • {getCharCount(css)} chars
            </span>
          </div>
          <textarea
            ref={cssRef}
            value={css}
            onChange={(e) => onCssChange(e.target.value)}
            onKeyDown={handleTab}
            className="flex-1 p-3 bg-transparent text-foreground outline-none resize-none font-mono text-sm leading-relaxed"
            placeholder="body {&#10;  margin: 0;&#10;  font-family: sans-serif;&#10;}"
            spellCheck={false}
          />
        </div>

        <div className="editor-pane flex flex-col col-span-2">
          <div className="px-3 py-2 border-b border-border bg-secondary/30 flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground tracking-wide">JavaScript</span>
            <span className="text-[10px] text-muted-foreground font-mono">
              {getLineCount(js)} lines • {getCharCount(js)} chars
            </span>
          </div>
          <textarea
            ref={jsRef}
            value={js}
            onChange={(e) => onJsChange(e.target.value)}
            onKeyDown={handleTab}
            className="flex-1 p-3 bg-transparent text-foreground outline-none resize-none font-mono text-sm leading-relaxed"
            placeholder="// Write your JavaScript here…"
            spellCheck={false}
          />
        </div>
      </div>

      <div className="status-bar">
        <span>Total: {getLineCount(html) + getLineCount(css) + getLineCount(js)} lines</span>
        <span>•</span>
        <span>{getCharCount(html) + getCharCount(css) + getCharCount(js)} characters</span>
        <span>•</span>
        <span className="text-accent">● Saved</span>
      </div>
    </div>
  )
}
