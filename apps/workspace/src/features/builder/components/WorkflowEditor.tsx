import { useState } from 'react'
import { DotsSixVertical, CaretUp, CaretDown, X, Plus } from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export function WorkflowEditor({
  steps,
  onChange,
}: {
  steps: string[]
  onChange: (s: string[]) => void
}) {
  const [newStep, setNewStep] = useState('')

  function addStep() {
    const val = newStep.trim()
    if (!val || steps.includes(val)) return
    onChange([...steps, val])
    setNewStep('')
  }

  function removeStep(i: number) {
    onChange(steps.filter((_, idx) => idx !== i))
  }

  function moveStep(i: number, dir: -1 | 1) {
    const arr = [...steps]
    const j = i + dir
    if (j < 0 || j >= arr.length) return
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
    onChange(arr)
  }

  return (
    <div className="space-y-2">
      {steps.map((s, i) => (
        <div key={i} className="flex items-center gap-2 bg-card border border-border rounded-lg px-3 py-2 group">
          <DotsSixVertical size={14} className="text-muted-foreground/40 shrink-0" />
          <span className="text-xs font-medium flex-1">{s}</span>
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button onClick={() => moveStep(i, -1)} disabled={i === 0} className="p-0.5 rounded hover:bg-muted disabled:opacity-30">
              <CaretUp size={12} className="text-muted-foreground" />
            </button>
            <button onClick={() => moveStep(i, 1)} disabled={i === steps.length - 1} className="p-0.5 rounded hover:bg-muted disabled:opacity-30">
              <CaretDown size={12} className="text-muted-foreground" />
            </button>
            <button onClick={() => removeStep(i)} className="p-0.5 rounded hover:bg-destructive/10 text-destructive">
              <X size={12} />
            </button>
          </div>
        </div>
      ))}
      <div className="flex gap-2">
        <Input
          value={newStep}
          onChange={e => setNewStep(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && addStep()}
          placeholder="Add workflow step…"
          className="text-xs h-8"
        />
        <Button size="sm" variant="outline" onClick={addStep} className="h-8 px-3 text-xs">
          <Plus size={12} className="mr-1" /> Add
        </Button>
      </div>
    </div>
  )
}
