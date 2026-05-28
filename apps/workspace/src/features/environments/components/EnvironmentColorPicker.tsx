import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ENVIRONMENT_COLORS, DEFAULT_COLOR } from '../constants/environment-colors'

interface EnvironmentColorPickerProps {
  value: string
  onChange: (color: string) => void
}

export function EnvironmentColorPicker({ value, onChange }: EnvironmentColorPickerProps) {
  const [custom, setCustom] = useState('')

  return (
    <div className="space-y-2">
      <Label className="text-xs text-muted-foreground">Color</Label>
      <div className="flex flex-wrap gap-2">
        {ENVIRONMENT_COLORS.map(c => (
          <button
            key={c.value}
            type="button"
            title={c.name}
            onClick={() => onChange(c.value)}
            className="w-6 h-6 rounded-full border-2 transition-transform hover:scale-110"
            style={{
              backgroundColor: c.value,
              borderColor: value === c.value ? '#fff' : 'transparent',
              outline: value === c.value ? `2px solid ${c.value}` : 'none',
            }}
          />
        ))}
      </div>
      <div className="flex items-center gap-2 mt-1">
        <div className="w-6 h-6 rounded-full border border-border" style={{ backgroundColor: value || DEFAULT_COLOR }} />
        <Input
          type="text"
          placeholder="#hex or css color"
          value={custom}
          onChange={e => {
            setCustom(e.target.value)
            if (/^#[0-9A-Fa-f]{6}$/.test(e.target.value)) onChange(e.target.value)
          }}
          className="h-7 text-xs w-36"
        />
      </div>
    </div>
  )
}
