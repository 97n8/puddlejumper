import { useState, useEffect } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { CheckCircle } from '@phosphor-icons/react'
import type { LogicCodeSaveTarget } from './types'

interface LogicCodeSavePanelProps {
  suggestedFileName?: string
  onChange: (target: LogicCodeSaveTarget | null) => void
}

function guessMime(name: string): string {
  const ext = name.split('.').pop()?.toLowerCase() ?? ''
  const map: Record<string, string> = {
    md: 'text/markdown', txt: 'text/plain', html: 'text/html',
    css: 'text/css', js: 'application/javascript', ts: 'text/plain',
    json: 'application/json', svg: 'image/svg+xml', py: 'text/plain',
  }
  return map[ext] ?? 'text/plain'
}

export function LogicCodeSavePanel({ suggestedFileName, onChange }: LogicCodeSavePanelProps) {
  const [fileName, setFileName] = useState(suggestedFileName || 'untitled.md')

  useEffect(() => {
    setFileName(suggestedFileName || 'untitled.md')
  }, [suggestedFileName])

  useEffect(() => {
    if (!fileName.trim()) { onChange(null); return }
    onChange({ provider: 'logiccode', fileName: fileName.trim(), mimeType: guessMime(fileName) })
  }, [fileName, onChange])

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2 text-xs text-emerald-500 bg-emerald-500/10 border border-emerald-500/20 rounded-md px-3 py-2">
        <CheckCircle size={14} weight="fill" />
        <span>Saved to your LogicOS workspace</span>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label className="text-xs text-muted-foreground">File Name</Label>
        <Input
          value={fileName}
          onChange={(e) => setFileName(e.target.value)}
          placeholder="my-file.md"
          className="bg-muted border-border text-sm font-mono"
        />
        <p className="text-xs text-muted-foreground/60">Stored in your vault — accessible anywhere in LogicOS.</p>
      </div>
    </div>
  )
}
