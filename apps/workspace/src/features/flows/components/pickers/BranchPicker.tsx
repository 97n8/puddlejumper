import { pjApi } from '@/services/pjApi'
import { SearchPicker } from './SearchPicker'

export function BranchPicker({ repo, value, onChange }: { repo: string; value: string; onChange: (v: string) => void }) {
  return (
    <SearchPicker value={value} onChange={onChange}
      placeholder={repo ? `Branches in ${repo}…` : 'Select a repo first'}
      emptyMsg="No branches found."
      load={async (q) => {
        if (!repo) return []
        const res = await pjApi.github.get(`repos/${repo}/branches?per_page=50`) as { name: string }[]
        return (Array.isArray(res) ? res : [])
          .filter(b => !q || b.name.includes(q))
          .map(b => ({ label: b.name, value: b.name, icon: b.name === 'main' || b.name === 'master' ? '⭐' : '🌿' }))
      }}
    />
  )
}
