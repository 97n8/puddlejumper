import { pjApi } from '@/services/pjApi'
import { SearchPicker } from './SearchPicker'

export function GoogleFilePicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <SearchPicker value={value} onChange={onChange} placeholder="Search your Google Drive…"
      emptyMsg="No files found."
      load={async (q) => {
        const query = q ? `name contains '${q}' and trashed=false` : 'trashed=false'
        const res = await pjApi.google.get(`drive/v3/files?q=${encodeURIComponent(query)}&pageSize=20&fields=files(id,name,mimeType)`) as { files?: { id: string; name: string; mimeType: string }[] }
        return (res.files ?? []).map(f => {
          const isFolder = f.mimeType === 'application/vnd.google-apps.folder'
          return { label: f.name, value: f.id, icon: isFolder ? '📁' : '📄', sub: f.id }
        })
      }}
    />
  )
}
