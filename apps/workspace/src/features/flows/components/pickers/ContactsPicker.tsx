import { pjApi } from '@/services/pjApi'
import { SearchPicker } from './SearchPicker'

export function ContactsPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <SearchPicker value={value} onChange={onChange} placeholder="Search your contacts…"
      emptyMsg="No contacts found."
      load={async (q) => {
        const endpoint = q
          ? `me/people?$search="${encodeURIComponent(q)}"&$top=15&$select=displayName,scoredEmailAddresses`
          : `me/people?$top=15&$select=displayName,scoredEmailAddresses`
        const res = await pjApi.microsoft.get(endpoint) as { value?: { displayName: string; scoredEmailAddresses?: { address: string }[] }[] }
        return (res.value ?? [])
          .filter(p => p.scoredEmailAddresses?.[0]?.address)
          .map(p => ({ label: p.displayName, value: p.scoredEmailAddresses![0].address, sub: p.scoredEmailAddresses![0].address, icon: '👤' }))
      }}
    />
  )
}
