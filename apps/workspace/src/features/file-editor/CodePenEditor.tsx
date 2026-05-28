import { useState, useRef, useEffect, useCallback } from 'react'
import { Play, CaretDown } from '@phosphor-icons/react'

interface CodePenEditorProps {
  value: string
  onChange: (combined: string) => void
  disabled?: boolean
}

interface PenState { html: string; css: string; js: string }

const TEMPLATES: { label: string; html: string; css: string; js: string }[] = [
  {
    label: 'Blank',
    html: '<h1>Hello World</h1>\n<p>Start building something amazing.</p>',
    css: 'body {\n  font-family: system-ui, sans-serif;\n  padding: 2rem;\n  background: #f9fafb;\n  color: #111;\n}',
    js: '// Your JavaScript here\n',
  },
  {
    label: 'Tailwind',
    html: '<div class="min-h-screen bg-gradient-to-br from-indigo-50 to-sky-100 flex items-center justify-center">\n  <div class="bg-white rounded-2xl shadow-lg p-10 max-w-md w-full">\n    <h1 class="text-3xl font-bold text-indigo-700 mb-3">Tailwind Starter</h1>\n    <p class="text-gray-500">Edit the panels below to build your UI.</p>\n    <button id="btn" class="mt-6 px-5 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition">Click me</button>\n  </div>\n</div>',
    css: '/* Tailwind handles most styling via CDN */',
    js: 'document.getElementById("btn").addEventListener("click", () => {\n  alert("Hello from Tailwind!");\n});',
  },
  {
    label: 'Bootstrap',
    html: '<div class="container py-5">\n  <div class="card shadow">\n    <div class="card-body">\n      <h2 class="card-title">Bootstrap Starter</h2>\n      <p class="card-text text-muted">Edit the panels below to get started.</p>\n      <button class="btn btn-primary" id="btn">Click me</button>\n    </div>\n  </div>\n</div>',
    css: '/* Bootstrap handles most styling via CDN */',
    js: 'document.getElementById("btn").addEventListener("click", () => {\n  alert("Hello from Bootstrap!");\n});',
  },
  {
    label: 'Chart.js',
    html: '<div style="max-width:520px;margin:2rem auto;">\n  <canvas id="chart"></canvas>\n</div>',
    css: 'body { font-family: system-ui, sans-serif; background:#f9fafb; }',
    js: `const ctx = document.getElementById('chart');
new Chart(ctx, {
  type: 'bar',
  data: {
    labels: ['Jan','Feb','Mar','Apr','May','Jun'],
    datasets: [{ label: 'Revenue', data: [4200,5800,3900,7100,6300,8900], backgroundColor: '#6366f1', borderRadius: 6 }]
  },
  options: { responsive: true, plugins: { legend: { position: 'top' } } }
});`,
  },
  {
    label: 'Animate.css',
    html: '<div class="wrapper">\n  <div class="box animate__animated animate__bounceIn" id="box">✨</div>\n  <button id="replay">Replay</button>\n</div>',
    css: `.wrapper { display:flex; flex-direction:column; align-items:center; justify-content:center; min-height:100vh; gap:1.5rem; font-family:system-ui,sans-serif; }
.box { font-size:5rem; cursor:default; }
button { padding:.5rem 1.5rem; border:none; background:#6366f1; color:#fff; border-radius:.5rem; cursor:pointer; font-size:1rem; }`,
    js: `document.getElementById('replay').addEventListener('click', () => {
  const box = document.getElementById('box');
  box.classList.remove('animate__bounceIn');
  void box.offsetWidth;
  box.classList.add('animate__bounceIn');
});`,
  },
]

const CDN_MAP: Record<string, string> = {
  Tailwind:    '<script src="https://cdn.tailwindcss.com"></script>',
  Bootstrap:   '<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap@5/dist/css/bootstrap.min.css">\n<script src="https://cdn.jsdelivr.net/npm/bootstrap@5/dist/js/bootstrap.bundle.min.js"></script>',
  'Chart.js':  '<script src="https://cdn.jsdelivr.net/npm/chart.js"></script>',
  'Animate.css': '<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/animate.css/4.1.1/animate.min.css">',
}

function buildHtmlDoc(state: PenState, template: string): string {
  const cdn = CDN_MAP[template] ?? ''
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  ${cdn}
  <style>
${state.css}
  </style>
</head>
<body>
${state.html}
<script>
${state.js}
</script>
</body>
</html>`
}

function parsePen(raw: string): PenState {
  const htmlMatch = raw.match(/<!--PEN_HTML-->([\s\S]*?)<!--\/PEN_HTML-->/)
  const cssMatch  = raw.match(/<!--PEN_CSS-->([\s\S]*?)<!--\/PEN_CSS-->/)
  const jsMatch   = raw.match(/<!--PEN_JS-->([\s\S]*?)<!--\/PEN_JS-->/)
  if (htmlMatch || cssMatch || jsMatch) {
    return {
      html: htmlMatch?.[1] ?? '',
      css:  cssMatch?.[1]  ?? '',
      js:   jsMatch?.[1]   ?? '',
    }
  }
  // Treat raw string as empty pen
  return { html: '', css: '', js: '' }
}

function serializePen(state: PenState): string {
  return `<!--PEN_HTML-->${state.html}<!--/PEN_HTML--><!--PEN_CSS-->${state.css}<!--/PEN_CSS--><!--PEN_JS-->${state.js}<!--/PEN_JS-->`
}

type PanelKey = 'html' | 'css' | 'js'

interface PaneProps {
  label: string
  lang: string
  value: string
  onChange: (v: string) => void
  disabled?: boolean
}

function Pane({ label, lang, value, onChange, disabled }: PaneProps) {
  return (
    <div className="flex flex-col flex-1 min-w-0 border-r border-border last:border-0">
      <div className="flex items-center px-3 py-1.5 bg-zinc-900 border-b border-zinc-700 flex-shrink-0">
        <span className="text-xs font-mono font-bold text-zinc-400 uppercase tracking-wider">{label}</span>
        <span className="ml-2 text-[10px] text-zinc-600">.{lang}</span>
      </div>
      <textarea
        value={value}
        onChange={e => onChange(e.target.value)}
        disabled={disabled}
        spellCheck={false}
        className="
          flex-1 resize-none bg-zinc-950 text-zinc-100 font-mono text-sm
          px-4 py-3 focus:outline-none placeholder:text-zinc-700
          disabled:opacity-50 leading-relaxed
        "
      />
    </div>
  )
}

export function CodePenEditor({ value, onChange, disabled }: CodePenEditorProps) {
  const [pen, setPen] = useState<PenState>(() => parsePen(value))
  const [activePanel, setActivePanel] = useState<PanelKey | 'preview'>('html')
  const [autoRun, setAutoRun] = useState(true)
  const [selectedTemplate, setSelectedTemplate] = useState('Blank')
  const [showTemplates, setShowTemplates] = useState(false)
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const runTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const runPreview = useCallback((state: PenState, tmpl: string) => {
    const doc = buildHtmlDoc(state, tmpl)
    const iframe = iframeRef.current
    if (!iframe) return
    iframe.srcdoc = doc
  }, [])

  const updatePen = useCallback((update: Partial<PenState>) => {
    setPen(prev => {
      const next = { ...prev, ...update }
      onChange(serializePen(next))
      if (autoRun) {
        if (runTimer.current) clearTimeout(runTimer.current)
        runTimer.current = setTimeout(() => runPreview(next, selectedTemplate), 600)
      }
      return next
    })
  }, [onChange, autoRun, runPreview, selectedTemplate])

  const applyTemplate = useCallback((tmpl: typeof TEMPLATES[0]) => {
    const next: PenState = { html: tmpl.html, css: tmpl.css, js: tmpl.js }
    setPen(next)
    setSelectedTemplate(tmpl.label)
    setShowTemplates(false)
    onChange(serializePen(next))
    setTimeout(() => runPreview(next, tmpl.label), 100)
  }, [onChange, runPreview])

  // Initial render
  useEffect(() => { runPreview(pen, selectedTemplate) }, []) // eslint-disable-line

  const PANELS: { key: PanelKey; label: string; lang: string }[] = [
    { key: 'html', label: 'HTML', lang: 'html' },
    { key: 'css',  label: 'CSS',  lang: 'css'  },
    { key: 'js',   label: 'JS',   lang: 'javascript' },
  ]

  return (
    <div className="flex flex-col h-full bg-zinc-950 text-white overflow-hidden">
      {/* Top bar */}
      <div className="flex items-center gap-2 px-3 py-1.5 bg-zinc-900 border-b border-zinc-800 flex-shrink-0">
        {/* Template picker */}
        <div className="relative">
          <button
            onClick={() => setShowTemplates(v => !v)}
            className="flex items-center gap-1.5 px-3 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-xs text-zinc-300 border border-zinc-700"
          >
            Template: <span className="text-white font-medium">{selectedTemplate}</span>
            <CaretDown size={11} />
          </button>
          {showTemplates && (
            <div className="absolute top-full left-0 mt-1 bg-zinc-800 border border-zinc-700 rounded shadow-xl z-20 min-w-[140px]">
              {TEMPLATES.map(t => (
                <button
                  key={t.label}
                  onClick={() => applyTemplate(t)}
                  className="w-full text-left px-4 py-2 text-xs hover:bg-zinc-700 text-zinc-300 hover:text-white transition-colors"
                >
                  {t.label}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex-1" />

        {/* Auto-run toggle */}
        <label className="flex items-center gap-1.5 text-xs text-zinc-400 cursor-pointer">
          <input
            type="checkbox"
            checked={autoRun}
            onChange={e => setAutoRun(e.target.checked)}
            className="accent-indigo-500"
          />
          Auto-run
        </label>

        {/* Run button */}
        <button
          onClick={() => runPreview(pen, selectedTemplate)}
          className="flex items-center gap-1.5 px-3 py-1 rounded bg-indigo-600 hover:bg-indigo-500 text-xs font-medium transition-colors"
        >
          <Play size={12} weight="fill" /> Run
        </button>
      </div>

      {/* Mobile panel tabs */}
      <div className="flex md:hidden border-b border-zinc-800 flex-shrink-0">
        {([...PANELS, { key: 'preview' as const, label: 'Preview', lang: '' }]).map(p => (
          <button
            key={p.key}
            onClick={() => setActivePanel(p.key)}
            className={`flex-1 py-2 text-xs font-medium transition-colors ${activePanel === p.key ? 'text-white bg-zinc-800' : 'text-zinc-500 hover:text-zinc-300'}`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Main content */}
      <div className="flex flex-col flex-1 min-h-0">
        {/* Editors — row on desktop, single panel on mobile */}
        <div className="hidden md:flex flex-row h-1/2 border-b border-zinc-800 flex-shrink-0">
          {PANELS.map(p => (
            <Pane
              key={p.key}
              label={p.label}
              lang={p.lang}
              value={pen[p.key]}
              onChange={v => updatePen({ [p.key]: v })}
              disabled={disabled}
            />
          ))}
        </div>

        {/* Mobile single-pane view */}
        <div className="flex md:hidden flex-col flex-1 min-h-0">
          {activePanel !== 'preview' && (
            <Pane
              label={activePanel.toUpperCase()}
              lang={activePanel}
              value={pen[activePanel as PanelKey] ?? ''}
              onChange={v => updatePen({ [activePanel as PanelKey]: v })}
              disabled={disabled}
            />
          )}
        </div>

        {/* Preview iframe */}
        <div className={`flex flex-col flex-1 min-h-0 ${activePanel !== 'preview' ? 'hidden md:flex' : 'flex'}`}>
          <div className="flex items-center px-3 py-1 bg-zinc-900 border-b border-zinc-800 flex-shrink-0">
            <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Preview</span>
          </div>
          <iframe
            ref={iframeRef}
            sandbox="allow-scripts allow-same-origin"
            title="CodePen Preview"
            className="flex-1 bg-white border-0"
          />
        </div>
      </div>
    </div>
  )
}
