import { useState } from 'react'
import type { DiffResult, DiffHunk } from './providers/types'
import { computeDiff } from './utils'
import { Warning, Lightning } from '@phosphor-icons/react'

interface DiffViewerProps {
  oldText?: string
  newText?: string
  contextLines?: number
  // legacy compat
  initialContent?: string
  currentContent?: string
  path?: string
}

function StrategyBadge({ strategy }: { strategy: DiffResult['strategy'] }) {
  if (strategy === 'full') return null
  const label = strategy === 'hirschberg' ? '⚡ fast diff' : '⚡ contextual'
  const tip = strategy === 'hirschberg'
    ? 'Hirschberg divide-and-conquer diff (space-efficient LCS for large files)'
    : 'Linear contextual diff (approximate — used for files > 5,000 lines)'
  return (
    <span title={tip}
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/30 ml-2 cursor-help">
      <Lightning size={10} /> {label}
    </span>
  )
}

function WordTokens({ tokens }: { tokens: Array<{ text: string; type: 'same' | 'added' | 'removed' }> }) {
  return (
    <>
      {tokens.map((t, i) => (
        <span key={i} className={
          t.type === 'added'   ? 'bg-green-500/30 rounded' :
          t.type === 'removed' ? 'bg-red-500/30 rounded' : ''
        }>{t.text}</span>
      ))}
    </>
  )
}

function CollapsedHunkRow({ hunk, onExpand }: { hunk: DiffHunk; onExpand: () => void }) {
  return (
    <button
      onClick={onExpand}
      aria-label={`Expand ${hunk.collapsedCount} collapsed lines`}
      className="w-full flex items-center justify-center gap-2 py-1.5 text-xs text-muted-foreground border-y border-dashed border-border hover:bg-muted/30 transition-colors"
    >
      <span className="border-t border-border/50 flex-1" />
      <span>{hunk.header}</span>
      <span className="border-t border-border/50 flex-1" />
    </button>
  )
}

export function DiffViewer({ oldText, newText, initialContent, currentContent }: DiffViewerProps) {
  const effectiveOld = oldText ?? initialContent ?? ''
  const effectiveNew = newText ?? currentContent ?? ''
  const result = computeDiff(effectiveOld, effectiveNew)
  const [expanded, setExpanded] = useState<Set<number>>(new Set())

  const expand = (idx: number) => setExpanded(prev => new Set([...prev, idx]))

  return (
    <div role="region" aria-label="File diff viewer" className="flex flex-col h-full font-mono text-xs">
      {/* Header */}
      <div role="toolbar" aria-label="Diff toolbar"
        className="flex items-center gap-3 px-4 py-2 border-b border-border bg-muted/20 flex-wrap">
        <span className="text-green-400">+{result.added}</span>
        <span className="text-red-400">-{result.removed}</span>
        <span className="text-muted-foreground">{result.unchanged} unchanged</span>
        <StrategyBadge strategy={result.strategy} />
        {result.truncated && (
          <span className="ml-auto flex items-center gap-1 text-amber-400 text-[10px]">
            <Warning size={11} /> Diff truncated — file too large to show in full
          </span>
        )}
      </div>

      {/* EOL Warning */}
      {result.eolWarning && (
        <div role="alert"
          className="flex items-center gap-2 px-4 py-2 text-xs bg-amber-500/10 text-amber-400 border-b border-amber-500/20">
          <Warning size={13} weight="duotone" />
          {result.eolWarning === 'mixed'
            ? 'Mixed line endings detected — file may have inconsistent EOL. Diff normalized to LF.'
            : `Original file uses ${result.eolWarning} line endings. Diff normalized to LF.`
          }
        </div>
      )}

      {/* No changes */}
      {result.added === 0 && result.removed === 0 && (
        <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm py-12">
          No changes
        </div>
      )}

      {/* Hunks */}
      <div className="flex-1 min-h-0 overflow-auto">
        {result.hunks.map((hunk, hi) => {
          if (hunk.collapsed && !expanded.has(hi)) {
            return <CollapsedHunkRow key={hi} hunk={hunk} onExpand={() => expand(hi)} />
          }
          return (
            <div key={hi} role="rowgroup" aria-label={hunk.header}>
              {!hunk.collapsed && (
                <div className="px-4 py-0.5 text-[10px] text-muted-foreground/60 bg-muted/10 border-b border-border/30">
                  {hunk.header}
                </div>
              )}
              {(hunk.collapsed ? [] : hunk.lines).map((line, li) => {
                const bg = line.type === 'added' ? 'bg-green-500/8 border-l-2 border-green-500' :
                           line.type === 'removed' ? 'bg-red-500/8 border-l-2 border-red-500' : ''
                const gutter = line.type === 'added' ? 'text-green-500' :
                               line.type === 'removed' ? 'text-red-500' : 'text-muted-foreground/30'
                const lineLabel = `${line.type === 'added' ? 'Added' : line.type === 'removed' ? 'Removed' : 'Unchanged'} line ${line.lineNew ?? line.lineOld ?? li + 1}: ${line.content}`
                return (
                  <div key={li} role="row" aria-label={lineLabel}
                    className={`flex items-start gap-0 text-[11px] leading-5 ${bg}`}>
                    <span className="w-10 shrink-0 text-right pr-2 text-muted-foreground/30 select-none border-r border-border/20 py-0.5 pl-2">
                      {line.lineOld ?? ''}
                    </span>
                    <span className="w-10 shrink-0 text-right pr-2 text-muted-foreground/30 select-none border-r border-border/20 py-0.5">
                      {line.lineNew ?? ''}
                    </span>
                    <span className={`w-5 shrink-0 text-center select-none py-0.5 ${gutter}`}>
                      {line.type === 'added' ? '+' : line.type === 'removed' ? '−' : ' '}
                    </span>
                    <span className="flex-1 py-0.5 px-2 whitespace-pre-wrap break-all text-[#e6edf3]">
                      {line.wordDiff
                        ? <WordTokens tokens={line.type === 'removed' ? line.wordDiff.old : line.wordDiff.new} />
                        : line.content
                      }
                    </span>
                  </div>
                )
              })}
            </div>
          )
        })}
      </div>
    </div>
  )
}
