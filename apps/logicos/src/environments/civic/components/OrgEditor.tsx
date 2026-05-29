import { useState, useEffect } from 'react'
import { useCivicTown } from '../context/CivicTownContext'
import { civicApi } from '@/features/civic/api/civicApi'
import { Plus, Trash } from '@phosphor-icons/react'

interface Props {
  onBack: () => void
}

interface StaffRow {
  display_name: string
  email: string
  title: string
  role: string
}

interface Body {
  subtype: string
  data: { name: string; member_count: number }
}

const ROLES = ['town_administrator', 'clerk', 'staff', 'board_member', 'officer']
const BODY_TYPES = ['select_board', 'planning_board', 'conservation', 'zoning_board', 'finance_committee', 'school_committee', 'other']

function formatRole(r: string) {
  return r.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

const GOVERNANCE_FORMS = [
  { value: 'open_town_meeting', label: 'Open Town Meeting' },
  { value: 'representative_town_meeting', label: 'Representative Town Meeting' },
  { value: 'city_council', label: 'City Council' },
  { value: 'mayor_council', label: 'Mayor-Council' },
  { value: 'town_council', label: 'Town Council' },
]

const FISCAL_YEAR_ENDS = [
  { value: 'June 30', label: 'June 30 (standard)' },
  { value: 'December 31', label: 'December 31' },
]

export function OrgEditor({ onBack }: Props) {
  const { townName, governanceForm, fiscalYearEnd, dlsCode, population, townProfile, setTownProfile } = useCivicTown()
  const [tab, setTab] = useState<'profile' | 'staff' | 'bodies'>('profile')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  // Staff state
  const [staff, setStaff] = useState<StaffRow[]>([])
  const [staffLoading, setStaffLoading] = useState(false)

  // Bodies state
  const [bodies, setBodies] = useState<Body[]>([])
  const [bodiesLoading, setBodiesLoading] = useState(false)

  const [fields, setFields] = useState({
    town_name: townName,
    governance_form: governanceForm,
    fiscal_year_end: fiscalYearEnd,
    dls_muni_code: dlsCode,
    records_access_officer: (townProfile?.records_access_officer as string | undefined) ?? '',
    procurement_officer: (townProfile?.procurement_officer as string | undefined) ?? '',
    oml_coordinator: (townProfile?.oml_coordinator as string | undefined) ?? '',
  })

  // Load staff when tab opens
  useEffect(() => {
    if (tab !== 'staff' || staff.length > 0) return
    setStaffLoading(true)
    civicApi.get<{ prefill?: { staff?: StaffRow[] } }>('/org-manager/status')
      .then(s => setStaff(s?.prefill?.staff ?? []))
      .catch(() => {})
      .finally(() => setStaffLoading(false))
  }, [tab, staff.length])

  // Load bodies when tab opens
  useEffect(() => {
    if (tab !== 'bodies' || bodies.length > 0) return
    setBodiesLoading(true)
    civicApi.get<{ prefill?: { bodies?: Body[] } }>('/org-manager/status')
      .then(s => setBodies(s?.prefill?.bodies ?? []))
      .catch(() => {})
      .finally(() => setBodiesLoading(false))
  }, [tab, bodies.length])

  const handleSave = async () => {
    setSaving(true)
    try {
      await civicApi.post('/org-manager/town', { ...fields, population })
      setTownProfile({ ...townProfile, ...fields, population })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (e) {
      console.error('Save failed', e)
    } finally {
      setSaving(false)
    }
  }

  const handleSaveStaff = async () => {
    setSaving(true)
    try {
      await civicApi.post('/org-manager/staff', { staff })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (e) {
      console.error('Save staff failed', e)
    } finally {
      setSaving(false)
    }
  }

  const handleSaveBodies = async () => {
    setSaving(true)
    try {
      await civicApi.post('/org-manager/bodies', { bodies })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (e) {
      console.error('Save bodies failed', e)
    } finally {
      setSaving(false)
    }
  }

  const addStaff = () => setStaff(s => [...s, { display_name: '', email: '', title: '', role: 'staff' }])
  const removeStaff = (i: number) => setStaff(s => s.filter((_, idx) => idx !== i))
  const updateStaff = (i: number, field: keyof StaffRow, val: string) =>
    setStaff(s => s.map((row, idx) => idx === i ? { ...row, [field]: val } : row))

  const addBody = () => setBodies(b => [...b, { subtype: 'other', data: { name: '', member_count: 5 } }])
  const removeBody = (i: number) => setBodies(b => b.filter((_, idx) => idx !== i))
  const updateBody = (i: number, field: 'subtype' | 'name' | 'member_count', val: string | number) =>
    setBodies(b => b.map((row, idx) => {
      if (idx !== i) return row
      if (field === 'subtype') return { ...row, subtype: val as string }
      return { ...row, data: { ...row.data, [field]: val } }
    }))

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-background text-foreground">
      <div className="flex items-center gap-3 px-6 py-4 border-b border-border">
        <button onClick={onBack} className="text-muted-foreground hover:text-foreground text-sm transition">← Workbench</button>
        <span className="text-muted-foreground/40">/</span>
        <span className="text-foreground font-bold text-sm">Org Editor — {townName}</span>
        <div className="ml-auto flex gap-2">
          <div className="flex gap-1">
            {(['profile', 'staff', 'bodies'] as const).map(t => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg capitalize transition ${
                  tab === t ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
          {tab === 'profile' && (
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-1.5 bg-red-700 hover:bg-red-600 text-white text-xs font-bold rounded-lg transition disabled:opacity-50"
            >
              {saved ? '✓ Saved' : saving ? 'Saving…' : 'Save'}
            </button>
          )}
          {tab === 'staff' && (
            <button
              onClick={handleSaveStaff}
              disabled={saving}
              className="px-4 py-1.5 bg-red-700 hover:bg-red-600 text-white text-xs font-bold rounded-lg transition disabled:opacity-50"
            >
              {saved ? '✓ Saved' : saving ? 'Saving…' : 'Save'}
            </button>
          )}
          {tab === 'bodies' && (
            <button
              onClick={handleSaveBodies}
              disabled={saving}
              className="px-4 py-1.5 bg-red-700 hover:bg-red-600 text-white text-xs font-bold rounded-lg transition disabled:opacity-50"
            >
              {saved ? '✓ Saved' : saving ? 'Saving…' : 'Save'}
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        {tab === 'profile' && (
          <div className="max-w-xl mx-auto p-6 space-y-4">
            <div className="bg-card border border-border rounded-2xl p-5">
              <h3 className="text-sm font-bold text-foreground/80 mb-4">Town Profile</h3>
              <div className="space-y-3">
                <div>
                  <label className="text-muted-foreground text-xs block mb-1">Town Name</label>
                  <input
                    value={fields.town_name}
                    onChange={e => setFields(f => ({ ...f, town_name: e.target.value }))}
                    className="w-full bg-muted border border-border text-foreground text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-primary"
                  />
                </div>
                <div>
                  <label className="text-muted-foreground text-xs block mb-1">Governance Form</label>
                  <select
                    value={fields.governance_form}
                    onChange={e => setFields(f => ({ ...f, governance_form: e.target.value }))}
                    className="w-full bg-muted border border-border text-foreground text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-primary"
                  >
                    {GOVERNANCE_FORMS.map(g => (
                      <option key={g.value} value={g.value}>{g.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-muted-foreground text-xs block mb-1">Fiscal Year End</label>
                  <select
                    value={fields.fiscal_year_end}
                    onChange={e => setFields(f => ({ ...f, fiscal_year_end: e.target.value }))}
                    className="w-full bg-muted border border-border text-foreground text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-primary"
                  >
                    {FISCAL_YEAR_ENDS.map(fy => (
                      <option key={fy.value} value={fy.value}>{fy.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-muted-foreground text-xs block mb-1">DLS Municipal Code</label>
                  <input
                    value={fields.dls_muni_code}
                    onChange={e => setFields(f => ({ ...f, dls_muni_code: e.target.value }))}
                    className="w-full bg-muted border border-border text-foreground text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-primary"
                  />
                </div>
              </div>
            </div>

            <div className="bg-card border border-border rounded-2xl p-5">
              <h3 className="text-sm font-bold text-foreground/80 mb-4">Key Officers</h3>
              <div className="space-y-3">
                {[
                  { key: 'records_access_officer', label: 'Records Access Officer (RAO)' },
                  { key: 'procurement_officer', label: 'Procurement Officer' },
                  { key: 'oml_coordinator', label: 'OML Coordinator' },
                ].map(({ key, label }) => (
                  <div key={key}>
                    <label className="text-muted-foreground text-xs block mb-1">{label}</label>
                    <input
                      value={fields[key as keyof typeof fields]}
                      onChange={e => setFields(f => ({ ...f, [key]: e.target.value }))}
                      placeholder="Name or email…"
                      className="w-full bg-muted border border-border text-foreground text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-primary placeholder:text-muted-foreground/40"
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {tab === 'staff' && (
          <div className="max-w-2xl mx-auto p-6 space-y-4">
            {staffLoading ? (
              <div className="text-center py-12 text-muted-foreground text-sm">Loading staff…</div>
            ) : (
              <>
                <div className="bg-card border border-border rounded-2xl overflow-hidden">
                  <div className="px-5 py-3 border-b border-border flex items-center justify-between">
                    <h3 className="text-sm font-bold text-foreground/80">Staff Directory</h3>
                    <button
                      onClick={addStaff}
                      className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition"
                    >
                      <Plus size={13} /> Add person
                    </button>
                  </div>
                  {staff.length === 0 ? (
                    <div className="px-5 py-8 text-center text-muted-foreground text-sm">
                      No staff added yet. Click "Add person" to start building your directory.
                    </div>
                  ) : (
                    <div className="divide-y divide-border">
                      {staff.map((row, i) => (
                        <div key={i} className="px-5 py-3 grid grid-cols-[1fr_1fr_auto] gap-3 items-start">
                          <div className="space-y-2">
                            <input
                              value={row.display_name}
                              onChange={e => updateStaff(i, 'display_name', e.target.value)}
                              placeholder="Full name"
                              className="w-full bg-muted border border-border text-foreground text-xs rounded-lg px-3 py-2 focus:outline-none focus:border-primary placeholder:text-muted-foreground/40"
                            />
                            <input
                              value={row.email}
                              onChange={e => updateStaff(i, 'email', e.target.value)}
                              placeholder="Email address"
                              type="email"
                              className="w-full bg-muted border border-border text-foreground text-xs rounded-lg px-3 py-2 focus:outline-none focus:border-primary placeholder:text-muted-foreground/40"
                            />
                          </div>
                          <div className="space-y-2">
                            <input
                              value={row.title}
                              onChange={e => updateStaff(i, 'title', e.target.value)}
                              placeholder="Job title"
                              className="w-full bg-muted border border-border text-foreground text-xs rounded-lg px-3 py-2 focus:outline-none focus:border-primary placeholder:text-muted-foreground/40"
                            />
                            <select
                              value={row.role}
                              onChange={e => updateStaff(i, 'role', e.target.value)}
                              className="w-full bg-muted border border-border text-foreground text-xs rounded-lg px-3 py-2 focus:outline-none focus:border-primary"
                            >
                              {ROLES.map(r => <option key={r} value={r}>{formatRole(r)}</option>)}
                            </select>
                          </div>
                          <button
                            onClick={() => removeStaff(i)}
                            className="p-1.5 text-muted-foreground hover:text-red-400 transition mt-1"
                          >
                            <Trash size={14} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <p className="text-muted-foreground/50 text-xs">
                  Staff records are used to auto-assign ownership of records, deadlines, and module actions.
                </p>
              </>
            )}
          </div>
        )}

        {tab === 'bodies' && (
          <div className="max-w-2xl mx-auto p-6 space-y-4">
            {bodiesLoading ? (
              <div className="text-center py-12 text-muted-foreground text-sm">Loading governing bodies…</div>
            ) : (
              <>
                <div className="bg-card border border-border rounded-2xl overflow-hidden">
                  <div className="px-5 py-3 border-b border-border flex items-center justify-between">
                    <h3 className="text-sm font-bold text-foreground/80">Governing Bodies & Boards</h3>
                    <button
                      onClick={addBody}
                      className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition"
                    >
                      <Plus size={13} /> Add body
                    </button>
                  </div>
                  {bodies.length === 0 ? (
                    <div className="px-5 py-8 text-center text-muted-foreground text-sm">
                      No governing bodies added yet. Click "Add body" to define your boards and committees.
                    </div>
                  ) : (
                    <div className="divide-y divide-border">
                      {bodies.map((row, i) => (
                        <div key={i} className="px-5 py-3 grid grid-cols-[1fr_1fr_80px_auto] gap-3 items-center">
                          <input
                            value={row.data.name}
                            onChange={e => updateBody(i, 'name', e.target.value)}
                            placeholder="Body name"
                            className="bg-muted border border-border text-foreground text-xs rounded-lg px-3 py-2 focus:outline-none focus:border-primary placeholder:text-muted-foreground/40"
                          />
                          <select
                            value={row.subtype}
                            onChange={e => updateBody(i, 'subtype', e.target.value)}
                            className="bg-muted border border-border text-foreground text-xs rounded-lg px-3 py-2 focus:outline-none focus:border-primary"
                          >
                            {BODY_TYPES.map(t => (
                              <option key={t} value={t}>{t.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</option>
                            ))}
                          </select>
                          <div className="flex items-center gap-1.5">
                            <input
                              type="number"
                              min={1}
                              value={row.data.member_count}
                              onChange={e => updateBody(i, 'member_count', parseInt(e.target.value) || 1)}
                              className="w-full bg-muted border border-border text-foreground text-xs rounded-lg px-3 py-2 focus:outline-none focus:border-primary text-center"
                            />
                            <span className="text-muted-foreground text-xs whitespace-nowrap">members</span>
                          </div>
                          <button
                            onClick={() => removeBody(i)}
                            className="p-1.5 text-muted-foreground hover:text-red-400 transition"
                          >
                            <Trash size={14} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <p className="text-muted-foreground/50 text-xs">
                  Governing bodies are used to auto-populate meeting notices, agendas, and OML compliance tracking.
                </p>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
