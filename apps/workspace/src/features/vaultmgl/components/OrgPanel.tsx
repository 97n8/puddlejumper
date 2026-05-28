import { useState } from 'react'
import {
  MagnifyingGlass, ArrowSquareOut, Phone, Envelope,
  UserCircle, Buildings, WarningCircle, CheckCircle, Info,
} from '@phosphor-icons/react'
import type { GeneratedTownData, OrgMember } from '../data/generator'

interface OrgPanelProps {
  townData: GeneratedTownData
}

// ─── Derived positions from real member data ──────────────────────────────────
const POSITION_PATTERNS: Array<{ title: string; matchTerms: string[]; term: string }> = [
  { title: 'Town Administrator / Manager', matchTerms: ['administrator', 'town manager', 'manager'], term: 'At-will' },
  { title: 'Town Clerk', matchTerms: ['town clerk', 'clerk'], term: '3 years' },
  { title: 'Finance Director / Treasurer', matchTerms: ['finance director', 'treasurer', 'accountant'], term: '3 years' },
  { title: 'Board of Health Chair', matchTerms: ['health', 'board of health'], term: '3 years' },
  { title: 'Planning Board Chair', matchTerms: ['planning board', 'planning chair'], term: '5 years' },
  { title: 'DPW Director / Highway Superintendent', matchTerms: ['dpw', 'highway', 'public works'], term: 'At-will' },
  { title: 'Police Chief', matchTerms: ['police chief', 'chief of police'], term: 'At-will' },
  { title: 'Fire Chief', matchTerms: ['fire chief', 'chief of fire'], term: 'At-will' },
  { title: 'Building Inspector', matchTerms: ['building inspector', 'building commissioner'], term: '1 year' },
  { title: 'Conservation Agent', matchTerms: ['conservation', 'natural resources'], term: '3 years' },
  { title: 'Library Director', matchTerms: ['library director', 'librarian', 'library'], term: 'At-will' },
  { title: 'Zoning Board Chair', matchTerms: ['zoning', 'zba', 'board of appeals'], term: '5 years' },
]

function derivePositions(members: OrgMember[]) {
  return POSITION_PATTERNS.map(p => {
    const match = members.find(m =>
      p.matchTerms.some(term => m.title.toLowerCase().includes(term))
    )
    return {
      title: p.title,
      term: p.term,
      filled: !!match,
      incumbent: match?.name ?? null,
      email: match?.email ?? null,
      phone: match?.phone ?? null,
    }
  })
}

// ─── Source banner ────────────────────────────────────────────────────────────
function DataSourceBanner({ meta }: { meta: GeneratedTownData['_meta'] }) {
  if (meta.staffSource === 'live') {
    return (
      <div className="flex items-start gap-3 rounded-xl px-4 py-3 mb-5"
        style={{ backgroundColor: '#E8F2EB', border: '1px solid #97BC62' }}>
        <CheckCircle size={18} style={{ color: '#2C5F2D', flexShrink: 0, marginTop: 1 }} />
        <div>
          <div className="text-sm font-semibold" style={{ color: '#2C5F2D' }}>Live Staff Data</div>
          <div className="text-xs mt-0.5" style={{ color: '#5A7A5B' }}>
            {meta.staffNotice ?? `Staff directory loaded from ${meta.staffWebsite ?? 'town website'}`}
          </div>
        </div>
        {meta.staffWebsite && (
          <a href={`https://${meta.staffWebsite}`} target="_blank" rel="noopener noreferrer"
            className="ml-auto shrink-0 flex items-center gap-1 text-xs underline" style={{ color: '#2C5F2D' }}>
            {meta.staffWebsite} <ArrowSquareOut size={12} />
          </a>
        )}
      </div>
    )
  }
  return (
    <div className="flex items-start gap-3 rounded-xl px-4 py-3 mb-5"
      style={{ backgroundColor: '#FBF5E6', border: '1px solid #D4AA3B' }}>
      <WarningCircle size={18} style={{ color: '#B8911E', flexShrink: 0, marginTop: 1 }} />
      <div>
        <div className="text-sm font-semibold" style={{ color: '#B8911E' }}>Estimated Baseline</div>
        <div className="text-xs mt-0.5" style={{ color: '#8A6D15' }}>
          Could not parse live staff directory. Showing seeded placeholder data — not real people.
          {meta.staffNotice && ` ${meta.staffNotice}`}
        </div>
      </div>
    </div>
  )
}

// ─── Department group ─────────────────────────────────────────────────────────
function DeptGroup({ dept, members, isReal }: { dept: string; members: OrgMember[]; isReal: boolean }) {
  return (
    <div className="rounded-xl border overflow-hidden" style={{ borderColor: '#DDD8CE' }}>
      <div className="flex items-center justify-between px-4 py-2.5" style={{ backgroundColor: '#F5F1E8', borderBottom: '1px solid #DDD8CE' }}>
        <div className="flex items-center gap-2">
          <Buildings size={14} style={{ color: '#7A7870' }} />
          <span className="text-sm font-semibold" style={{ color: '#1A1D16' }}>{dept}</span>
        </div>
        <span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: '#E8F2EB', color: '#2C5F2D' }}>
          {members.length}
        </span>
      </div>
      <div className="divide-y" style={{ backgroundColor: '#fff' }}>
        {members.map(m => (
          <div key={m.id} className="flex items-start gap-3 px-4 py-3">
            <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-xs font-bold mt-0.5"
              style={{ backgroundColor: '#E8F2EB', color: '#2C5F2D' }}>
              {m.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-medium text-sm" style={{ color: '#1A1D16' }}>{m.name}</span>
                {!isReal && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded font-mono" style={{ backgroundColor: '#F5F1E8', color: '#B8911E' }}>estimated</span>
                )}
              </div>
              <div className="text-xs mt-0.5" style={{ color: '#7A7870' }}>{m.title}</div>
              <div className="flex flex-wrap gap-3 mt-1.5">
                {m.email && (
                  <a href={`mailto:${m.email}`} className="flex items-center gap-1 text-xs hover:underline" style={{ color: '#2C5F2D' }}>
                    <Envelope size={11} />{m.email}
                  </a>
                )}
                {m.phone && (
                  <a href={`tel:${m.phone}`} className="flex items-center gap-1 text-xs hover:underline" style={{ color: '#2C5F2D' }}>
                    <Phone size={11} />{m.phone}
                  </a>
                )}
              </div>
            </div>
            {m.sourceUrl && (
              <a href={m.sourceUrl} target="_blank" rel="noopener noreferrer" className="shrink-0 mt-1" title="Source page">
                <ArrowSquareOut size={13} style={{ color: '#97BC62' }} />
              </a>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────
type Tab = 'directory' | 'positions' | 'roles'

export function OrgPanel({ townData }: OrgPanelProps) {
  const [tab, setTab] = useState<Tab>('directory')
  const [search, setSearch] = useState('')

  const { members, roles, _meta } = townData
  const isReal = _meta.staffSource === 'live'

  const filtered = search
    ? members.filter(m =>
        m.name.toLowerCase().includes(search.toLowerCase()) ||
        m.title.toLowerCase().includes(search.toLowerCase()) ||
        m.department.toLowerCase().includes(search.toLowerCase())
      )
    : members

  // Group by department
  const deptMap = new Map<string, OrgMember[]>()
  for (const m of filtered) {
    const list = deptMap.get(m.department) ?? []
    list.push(m)
    deptMap.set(m.department, list)
  }
  const depts = Array.from(deptMap.entries()).sort((a, b) => b[1].length - a[1].length)

  const positions = derivePositions(members)
  const filledCount = positions.filter(p => p.filled).length
  const vacantCount = positions.filter(p => !p.filled).length

  const TabBtn = ({ id, label, count }: { id: Tab; label: string; count?: number }) => (
    <button onClick={() => setTab(id)}
      className="flex items-center gap-1.5 px-4 py-2.5 text-sm transition"
      style={{
        fontWeight: tab === id ? 600 : 400,
        borderBottom: tab === id ? '2px solid #2C5F2D' : '2px solid transparent',
        color: tab === id ? '#2C5F2D' : '#7A7870',
      }}>
      {label}
      {count !== undefined && (
        <span className="text-xs px-1.5 py-0.5 rounded-full" style={{ backgroundColor: tab === id ? '#E8F2EB' : '#F5F1E8', color: tab === id ? '#2C5F2D' : '#7A7870' }}>
          {count}
        </span>
      )}
    </button>
  )

  return (
    <div className="p-6">
      <DataSourceBanner meta={_meta} />

      {/* Tab bar */}
      <div className="flex gap-0 mb-6 border-b" style={{ borderColor: '#DDD8CE' }}>
        <TabBtn id="directory" label="Staff Directory" count={members.length} />
        <TabBtn id="positions" label="Key Positions" count={filledCount} />
        <TabBtn id="roles" label="Roles & Permissions" />
      </div>

      {/* ── Directory ─────────────────────────────────────────────────────── */}
      {tab === 'directory' && (
        <div className="space-y-4">
          <div className="relative">
            <MagnifyingGlass size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#7A7870' }} />
            <input
              type="text"
              placeholder="Search by name, title, or department…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 rounded-xl border text-sm outline-none"
              style={{ borderColor: '#DDD8CE', backgroundColor: '#fff', color: '#1A1D16' }}
            />
          </div>
          {filtered.length === 0 ? (
            <div className="py-10 text-center text-sm" style={{ color: '#7A7870' }}>No staff found</div>
          ) : (
            <div className="space-y-3">
              {depts.map(([dept, deptMembers]) => (
                <DeptGroup key={dept} dept={dept} members={deptMembers} isReal={isReal} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Positions ─────────────────────────────────────────────────────── */}
      {tab === 'positions' && (
        <div className="space-y-4">
          <div className="flex gap-3 flex-wrap text-sm">
            <span className="px-3 py-1 rounded-full" style={{ backgroundColor: '#E8F2EB', color: '#2C5F2D' }}>{filledCount} filled</span>
            {vacantCount > 0 && <span className="px-3 py-1 rounded-full" style={{ backgroundColor: '#FBF5E6', color: '#B8911E' }}>{vacantCount} vacant</span>}
          </div>
          {!isReal && (
            <div className="flex items-center gap-2 text-xs rounded-lg px-3 py-2" style={{ backgroundColor: '#FBF5E6', color: '#8A6D15', border: '1px solid #D4AA3B' }}>
              <Info size={14} />
              Positions are inferred from estimated staff data. Import real staff data to see actual incumbents.
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {positions.map(pos => (
              <div key={pos.title} className="rounded-xl border p-4"
                style={{ borderColor: pos.filled ? '#DDD8CE' : '#D4AA3B', backgroundColor: '#fff' }}>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="font-semibold text-sm" style={{ color: '#1A1D16' }}>{pos.title}</div>
                  <span className="text-xs px-2 py-0.5 rounded-full font-medium shrink-0"
                    style={{ backgroundColor: pos.filled ? '#E8F2EB' : '#FBF5E6', color: pos.filled ? '#2C5F2D' : '#B8911E' }}>
                    {pos.filled ? 'Filled' : 'Vacant'}
                  </span>
                </div>
                {pos.filled ? (
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5 text-sm" style={{ color: '#1A1D16' }}>
                      <UserCircle size={14} style={{ color: '#7A7870' }} />
                      {pos.incumbent}
                    </div>
                    {pos.email && (
                      <a href={`mailto:${pos.email}`} className="flex items-center gap-1.5 text-xs hover:underline" style={{ color: '#2C5F2D' }}>
                        <Envelope size={12} />{pos.email}
                      </a>
                    )}
                    {pos.phone && (
                      <a href={`tel:${pos.phone}`} className="flex items-center gap-1.5 text-xs hover:underline" style={{ color: '#2C5F2D' }}>
                        <Phone size={12} />{pos.phone}
                      </a>
                    )}
                    <div className="text-xs mt-1" style={{ color: '#7A7870' }}>Term: {pos.term}</div>
                  </div>
                ) : (
                  <div className="text-xs" style={{ color: '#B8911E' }}>
                    <div>Term: {pos.term}</div>
                    <div className="mt-1">⚠ Appointment process should begin</div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Roles ─────────────────────────────────────────────────────────── */}
      {tab === 'roles' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {roles.map(role => (
            <div key={role.id} className="rounded-xl border p-4" style={{ borderColor: '#DDD8CE', backgroundColor: '#fff' }}>
              <div className="font-semibold text-sm mb-0.5" style={{ color: '#1A1D16' }}>{role.display}</div>
              <div className="text-xs font-mono mb-3" style={{ color: '#7A7870' }}>role:{role.name}</div>
              <div className="mb-3">
                <div className="text-xs font-medium mb-1.5" style={{ color: '#7A7870' }}>Permissions</div>
                <div className="flex flex-wrap gap-1.5">
                  {role.permissions.map(p => (
                    <span key={p} className="text-[11px] px-2 py-0.5 rounded font-mono" style={{ backgroundColor: '#F5F1E8', color: '#1A1D16' }}>{p}</span>
                  ))}
                </div>
              </div>
              {role.canApprove.length > 0 && (
                <div>
                  <div className="text-xs font-medium mb-1.5" style={{ color: '#7A7870' }}>Can Approve</div>
                  <div className="flex flex-wrap gap-1.5">
                    {role.canApprove.map(p => (
                      <span key={p} className="text-[11px] px-2 py-0.5 rounded font-mono" style={{ backgroundColor: '#E8F2EB', color: '#2C5F2D' }}>{p}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
