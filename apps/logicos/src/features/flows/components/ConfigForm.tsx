import { memo } from 'react'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import type { ConfigField } from '../types'
import { RepoSelect } from './pickers/RepoSelect'
import { OneDriveFilePicker } from './pickers/OneDriveFilePicker'
import { GoogleFilePicker } from './pickers/GoogleFilePicker'
import { ContactsPicker } from './pickers/ContactsPicker'
import { BranchPicker } from './pickers/BranchPicker'

export const ConfigForm = memo(function ConfigForm({ fields, values, onChange }: {
  fields: ConfigField[]; values: Record<string, string>; onChange: (k: string, v: string) => void
}) {
  return (
    <div className="space-y-3">
      {fields.map(f => (
        <div key={f.key}>
          <label className="text-xs font-medium mb-1 block">
            {f.label}{f.required && <span className="text-destructive ml-0.5">*</span>}
          </label>
          {f.type === 'repo' ? (
            <RepoSelect value={values[f.key] ?? ''} onChange={v => onChange(f.key, v)} />
          ) : f.type === 'onedrive-file' ? (
            <OneDriveFilePicker value={values[f.key] ?? ''} onChange={v => onChange(f.key, v)} />
          ) : f.type === 'google-file' ? (
            <GoogleFilePicker value={values[f.key] ?? ''} onChange={v => onChange(f.key, v)} />
          ) : f.type === 'contacts' ? (
            <ContactsPicker value={values[f.key] ?? ''} onChange={v => onChange(f.key, v)} />
          ) : f.type === 'github-branch' ? (
            <BranchPicker repo={values['repo'] ?? ''} value={values[f.key] ?? ''} onChange={v => onChange(f.key, v)} />
          ) : f.type === 'textarea' ? (
            <Textarea value={values[f.key] ?? ''} onChange={e => onChange(f.key, e.target.value)}
              placeholder={f.placeholder} className="text-sm min-h-16 resize-none" />
          ) : f.type === 'date' ? (
            <Input type="datetime-local" value={values[f.key] ?? ''} onChange={e => onChange(f.key, e.target.value)} className="text-sm" />
          ) : (
            <Input type={f.type === 'email' ? 'email' : f.type === 'number' ? 'number' : 'text'}
              value={values[f.key] ?? ''} onChange={e => onChange(f.key, e.target.value)}
              placeholder={f.placeholder} className="text-sm" />
          )}
          {f.hint && <p className="text-[10px] text-muted-foreground mt-1">{f.hint}</p>}
        </div>
      ))}
    </div>
  )
})
