import { pjApi } from '@/services/pjApi'
import { SearchPicker } from './SearchPicker'

export function OneDriveFilePicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <SearchPicker value={value} onChange={onChange} placeholder="Search your OneDrive…"
      emptyMsg="No files found. Try a different search."
      load={async (q) => {
        const endpoint = q ? `me/drive/root/search(q='${encodeURIComponent(q)}')?$top=20&$select=name,id,file,folder` : `me/drive/root/children?$top=20&$select=name,id,file,folder`
        const res = await pjApi.microsoft.get(endpoint) as { value?: { name: string; id: string; file?: object; folder?: object }[] }
        return (res.value ?? []).map(f => ({ label: f.name, value: f.name, icon: f.folder ? '📁' : '📄' }))
      }}
    />
  )
}
