/**
 * StayOSPanel — Operator hospitality environment for short-term rental management.
 * Accent: teal #0F6E6E
 */

import { useState, useEffect, useCallback } from 'react'
import {
  House, CalendarBlank, ListChecks, ChatCircle, Robot, Gear, ArrowsClockwise,
  Plus, PencilSimple, Trash, WarningCircle, CheckCircle, Clock, Door,
  WifiHigh, Phone, Envelope, Buildings, ArrowRight, X, ToggleLeft, ToggleRight,
  Package, Sparkle, CalendarCheck, ClipboardText, HardDrives, CaretLeft, CaretRight,
} from '@phosphor-icons/react'
import type { Icon } from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { toast } from 'sonner'
import { stayApi } from '../api'
import type {
  StayProperty, StayReservation, StayTask, StayMessage,
  StayAutomation, StayTemplate, StayDashboard, StayDevice, StayAuditEntry,
  ReservationStatus, TaskPriority, TaskStatus,
} from '../types'

// ── Constants ─────────────────────────────────────────────────────────────────

const TEAL = '#0F6E6E'

const STATUS_COLORS: Record<ReservationStatus, string> = {
  inquiry: 'bg-amber-100 text-amber-800',
  confirmed: 'bg-blue-100 text-blue-800',
  checked_in: 'bg-emerald-100 text-emerald-800',
  checked_out: 'bg-slate-100 text-slate-700',
  cancelled: 'bg-red-100 text-red-700',
}

const PRIORITY_COLORS: Record<TaskPriority, string> = {
  urgent: 'bg-red-100 text-red-800',
  high: 'bg-orange-100 text-orange-800',
  normal: 'bg-blue-100 text-blue-800',
  low: 'bg-slate-100 text-slate-600',
}

const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  open: 'Open',
  in_progress: 'In Progress',
  done: 'Done',
  cancelled: 'Cancelled',
}

const TOKEN_CHIPS = ['{{guest_name}}', '{{property_name}}', '{{check_in}}', '{{check_out}}', '{{door_code}}', '{{wifi_name}}', '{{wifi_password}}']

type StayOSView = 'dashboard' | 'properties' | 'reservations' | 'tasks' | 'messages' | 'automations' | 'calendar' | 'devices' | 'audit' | 'settings'

const NAV_ITEMS: { key: StayOSView; label: string; icon: Icon }[] = [
  { key: 'dashboard', label: 'Dashboard', icon: House },
  { key: 'properties', label: 'Properties', icon: Buildings },
  { key: 'reservations', label: 'Reservations', icon: CalendarBlank },
  { key: 'tasks', label: 'Tasks', icon: ListChecks },
  { key: 'messages', label: 'Messages', icon: ChatCircle },
  { key: 'calendar', label: 'Calendar', icon: CalendarCheck },
  { key: 'automations', label: 'Automations', icon: Robot },
  { key: 'devices', label: 'Devices', icon: HardDrives },
  { key: 'audit', label: 'Audit', icon: ClipboardText },
  { key: 'settings', label: 'Settings', icon: Gear },
]

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(d: string) {
  if (!d) return ''
  return new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function nights(checkIn: string, checkOut: string) {
  const a = new Date(checkIn).getTime(), b = new Date(checkOut).getTime()
  return Math.round((b - a) / 86400000)
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StatCard({ label, value, sub, color }: { label: string; value: number | string; sub?: string; color?: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
      <div className="text-sm text-gray-500 mb-1">{label}</div>
      <div className="text-3xl font-bold" style={{ color: color ?? TEAL }}>{value}</div>
      {sub && <div className="text-xs text-gray-400 mt-1">{sub}</div>}
    </div>
  )
}

function Badge({ className, children }: { className?: string; children: React.ReactNode }) {
  return <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium', className)}>{children}</span>
}

function EmptyState({ icon: Icon, title, message, cta, onCta }: {
  icon: Icon
  title: string
  message: string
  cta?: string
  onCta?: () => void
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <Icon size={48} className="text-gray-300 mb-4" />
      <h3 className="text-lg font-semibold text-gray-700 mb-2">{title}</h3>
      <p className="text-sm text-gray-500 mb-6 max-w-xs">{message}</p>
      {cta && onCta && (
        <Button onClick={onCta} style={{ background: TEAL }}>
          <Plus size={16} className="mr-1" /> {cta}
        </Button>
      )}
    </div>
  )
}

function ErrorBanner({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
      <WarningCircle size={20} className="flex-shrink-0" />
      <span className="flex-1">{message}</span>
      {onRetry && <Button variant="outline" size="sm" onClick={onRetry}>Retry</Button>}
    </div>
  )
}

function Spinner() {
  return (
    <div className="flex items-center justify-center py-12">
      <ArrowsClockwise size={32} className="animate-spin text-gray-300" />
    </div>
  )
}

// ── Dashboard View ────────────────────────────────────────────────────────────

function DashboardView({ onNavigate }: { onNavigate: (v: StayOSView) => void }) {
  const [data, setData] = useState<StayDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try { setData(await stayApi.getDashboard()) }
    catch (e) { setError(e instanceof Error ? e.message : 'Failed to load dashboard') }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { void load() }, [load])

  if (loading) return <Spinner />
  if (error) return <ErrorBanner message={error} onRetry={load} />
  if (!data) return null

  return (
    <div className="space-y-6">
      {data.failed_automations > 0 && (
        <div className="flex items-center gap-3 p-4 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-sm">
          <WarningCircle size={20} className="flex-shrink-0" />
          <span>{data.failed_automations} automation{data.failed_automations > 1 ? 's' : ''} failed recently.</span>
          <Button variant="outline" size="sm" className="ml-auto" onClick={() => onNavigate('automations')}>View Automations</Button>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Active Reservations" value={data.active_reservations} />
        <StatCard label="Arriving Today" value={data.today_arrivals.length} color="#0369a1" />
        <StatCard label="Departing Today" value={data.today_departures.length} color="#0891b2" />
        <StatCard label="Open Tasks" value={data.open_tasks} sub={data.urgent_tasks > 0 ? `${data.urgent_tasks} urgent` : undefined} color={data.urgent_tasks > 0 ? '#dc2626' : undefined} />
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-gray-800">Arriving Today</h3>
            <Button variant="ghost" size="sm" onClick={() => onNavigate('reservations')}>View all <ArrowRight size={14} className="ml-1" /></Button>
          </div>
          {data.today_arrivals.length === 0 ? (
            <p className="text-sm text-gray-400 py-4 text-center">No arrivals today</p>
          ) : (
            <div className="space-y-2">
              {data.today_arrivals.map(r => (
                <div key={r.id} className="flex items-center gap-3 p-3 bg-white rounded-lg border border-gray-100 shadow-sm">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold" style={{ background: TEAL }}>
                    {r.guest_name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm truncate">{r.guest_name}</div>
                    <div className="text-xs text-gray-500 truncate">{r.property_name ?? r.property_id}</div>
                  </div>
                  <Badge className={STATUS_COLORS.checked_in}>Check-in</Badge>
                </div>
              ))}
            </div>
          )}
        </div>

        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-gray-800">Departing Today</h3>
          </div>
          {data.today_departures.length === 0 ? (
            <p className="text-sm text-gray-400 py-4 text-center">No departures today</p>
          ) : (
            <div className="space-y-2">
              {data.today_departures.map(r => (
                <div key={r.id} className="flex items-center gap-3 p-3 bg-white rounded-lg border border-gray-100 shadow-sm">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold" style={{ background: '#64748b' }}>
                    {r.guest_name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm truncate">{r.guest_name}</div>
                    <div className="text-xs text-gray-500 truncate">{r.property_name ?? r.property_id}</div>
                  </div>
                  <Badge className={STATUS_COLORS.checked_out}>Check-out</Badge>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Properties View ───────────────────────────────────────────────────────────

function PropertiesView() {
  const [items, setItems] = useState<StayProperty[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<StayProperty | null>(null)
  const [form, setForm] = useState({ name: '', address: '', city: '', state: 'MA', zip: '', unit_count: '1', check_in_time: '15:00', check_out_time: '11:00', wifi_name: '', wifi_password: '', door_code: '', notes: '' })
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try { setItems(await stayApi.getProperties()) }
    catch (e) { setError(e instanceof Error ? e.message : 'Failed to load properties') }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { void load() }, [load])

  function openAdd() {
    setEditing(null)
    setForm({ name: '', address: '', city: '', state: 'MA', zip: '', unit_count: '1', check_in_time: '15:00', check_out_time: '11:00', wifi_name: '', wifi_password: '', door_code: '', notes: '' })
    setShowForm(true)
  }

  function openEdit(p: StayProperty) {
    setEditing(p)
    setForm({ name: p.name, address: p.address, city: p.city, state: p.state, zip: p.zip, unit_count: String(p.unit_count), check_in_time: p.check_in_time, check_out_time: p.check_out_time, wifi_name: p.wifi_name ?? '', wifi_password: p.wifi_password ?? '', door_code: p.door_code ?? '', notes: p.notes ?? '' })
    setShowForm(true)
  }

  async function handleSave() {
    if (!form.name || !form.address || !form.city || !form.zip) {
      toast.error('Name, address, city, and zip are required'); return
    }
    setSaving(true)
    try {
      const data = { ...form, unit_count: parseInt(form.unit_count) || 1 }
      if (editing) {
        await stayApi.updateProperty(editing.id, data)
        toast.success('Property updated')
      } else {
        await stayApi.createProperty(data)
        toast.success('Property created')
      }
      setShowForm(false)
      await load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Save failed')
    } finally { setSaving(false) }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this property and all its data?')) return
    try { await stayApi.deleteProperty(id); toast.success('Deleted'); await load() }
    catch (e) { toast.error(e instanceof Error ? e.message : 'Delete failed') }
  }

  if (loading) return <Spinner />
  if (error) return <ErrorBanner message={error} onRetry={load} />

  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-gray-800">Properties</h2>
        <Button onClick={openAdd} style={{ background: TEAL }}>
          <Plus size={16} className="mr-1" /> Add Property
        </Button>
      </div>

      {items.length === 0 ? (
        <EmptyState icon={Buildings} title="No properties yet" message="Add your first rental property to get started." cta="Add Property" onCta={openAdd} />
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map(p => (
            <div key={p.id} className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 flex flex-col gap-3">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold text-gray-900">{p.name}</h3>
                  <p className="text-sm text-gray-500 mt-0.5">{p.address}, {p.city}, {p.state} {p.zip}</p>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => openEdit(p)} className="p-1.5 rounded hover:bg-gray-100"><PencilSimple size={15} className="text-gray-500" /></button>
                  <button onClick={() => handleDelete(p.id)} className="p-1.5 rounded hover:bg-red-50"><Trash size={15} className="text-red-400" /></button>
                </div>
              </div>
              <div className="flex gap-4 text-xs text-gray-500">
                <span className="flex items-center gap-1"><Buildings size={13} /> {p.unit_count} unit{p.unit_count > 1 ? 's' : ''}</span>
                <span className="flex items-center gap-1"><Door size={13} /> {p.check_in_time} / {p.check_out_time}</span>
              </div>
              {p.door_code && (
                <div className="flex items-center gap-1.5 text-xs text-gray-600 bg-gray-50 px-2 py-1.5 rounded">
                  <Door size={12} /> Code: <span className="font-mono font-semibold">{p.door_code}</span>
                </div>
              )}
              {p.wifi_name && (
                <div className="flex items-center gap-1.5 text-xs text-gray-600 bg-gray-50 px-2 py-1.5 rounded">
                  <WifiHigh size={12} /> {p.wifi_name} / {p.wifi_password}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? 'Edit Property' : 'Add Property'}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div><Label>Property Name *</Label><Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Beach House" /></div>
            <div><Label>Address *</Label><Input value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} placeholder="123 Ocean Ave" /></div>
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2"><Label>City *</Label><Input value={form.city} onChange={e => setForm(f => ({ ...f, city: e.target.value }))} placeholder="Provincetown" /></div>
              <div><Label>State</Label><Input value={form.state} onChange={e => setForm(f => ({ ...f, state: e.target.value }))} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>ZIP *</Label><Input value={form.zip} onChange={e => setForm(f => ({ ...f, zip: e.target.value }))} placeholder="02657" /></div>
              <div><Label>Units</Label><Input type="number" min={1} value={form.unit_count} onChange={e => setForm(f => ({ ...f, unit_count: e.target.value }))} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Check-in Time</Label><Input value={form.check_in_time} onChange={e => setForm(f => ({ ...f, check_in_time: e.target.value }))} placeholder="15:00" /></div>
              <div><Label>Check-out Time</Label><Input value={form.check_out_time} onChange={e => setForm(f => ({ ...f, check_out_time: e.target.value }))} placeholder="11:00" /></div>
            </div>
            <div><Label>Door Code</Label><Input value={form.door_code} onChange={e => setForm(f => ({ ...f, door_code: e.target.value }))} placeholder="1234" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>WiFi Name</Label><Input value={form.wifi_name} onChange={e => setForm(f => ({ ...f, wifi_name: e.target.value }))} /></div>
              <div><Label>WiFi Password</Label><Input value={form.wifi_password} onChange={e => setForm(f => ({ ...f, wifi_password: e.target.value }))} /></div>
            </div>
            <div><Label>Notes</Label><Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={3} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving} style={{ background: TEAL }}>{saving ? 'Saving…' : 'Save'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

// ── Reservations View ─────────────────────────────────────────────────────────

type ResFilter = 'all' | 'today' | 'upcoming' | 'checked_in' | 'past' | 'cancelled'

function ReservationsView() {
  const [items, setItems] = useState<StayReservation[]>([])
  const [properties, setProperties] = useState<StayProperty[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<ResFilter>('all')
  const [showForm, setShowForm] = useState(false)
  const [selected, setSelected] = useState<StayReservation | null>(null)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ property_id: '', guest_name: '', guest_email: '', guest_phone: '', check_in: '', check_out: '', guests_count: '1', source: 'direct', status: 'confirmed', total_amount: '', notes: '' })

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const [res, props] = await Promise.all([stayApi.getReservations(), stayApi.getProperties()])
      setItems(res); setProperties(props)
    } catch (e) { setError(e instanceof Error ? e.message : 'Failed to load') }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { void load() }, [load])

  const today = new Date().toISOString().slice(0, 10)

  const filtered = items.filter(r => {
    if (filter === 'all') return r.status !== 'cancelled'
    if (filter === 'today') return r.check_in === today || r.check_out === today
    if (filter === 'upcoming') return r.check_in > today && r.status !== 'cancelled'
    if (filter === 'checked_in') return r.status === 'checked_in'
    if (filter === 'past') return r.check_out < today && r.status !== 'cancelled'
    if (filter === 'cancelled') return r.status === 'cancelled'
    return true
  })

  async function handleCreate() {
    if (!form.property_id || !form.guest_name || !form.guest_email || !form.check_in || !form.check_out) {
      toast.error('Property, guest name, email, and dates are required'); return
    }
    setSaving(true)
    try {
      await stayApi.createReservation({ ...form, guests_count: parseInt(form.guests_count) || 1, total_amount: form.total_amount ? parseFloat(form.total_amount) : undefined, source: form.source as import('../types').ReservationSource, status: form.status as ReservationStatus })
      toast.success('Reservation created'); setShowForm(false); await load()
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Save failed'
      toast.error(msg.includes('overlap') ? 'Date conflict with existing reservation' : msg)
    } finally { setSaving(false) }
  }

  async function updateStatus(id: string, status: ReservationStatus) {
    try { await stayApi.updateReservation(id, { status }); await load() }
    catch (e) { toast.error(e instanceof Error ? e.message : 'Update failed') }
  }

  function propName(pid: string) { return properties.find(p => p.id === pid)?.name ?? pid }

  if (loading) return <Spinner />
  if (error) return <ErrorBanner message={error} onRetry={load} />

  const FILTERS: { key: ResFilter; label: string }[] = [
    { key: 'all', label: 'All Active' },
    { key: 'today', label: 'Today' },
    { key: 'upcoming', label: 'Upcoming' },
    { key: 'checked_in', label: 'Checked In' },
    { key: 'past', label: 'Past' },
    { key: 'cancelled', label: 'Cancelled' },
  ]

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-gray-800">Reservations</h2>
        <Button onClick={() => setShowForm(true)} style={{ background: TEAL }} disabled={properties.length === 0}>
          <Plus size={16} className="mr-1" /> New Reservation
        </Button>
      </div>

      <div className="flex gap-2 mb-5 flex-wrap">
        {FILTERS.map(f => (
          <button key={f.key} onClick={() => setFilter(f.key)}
            className={cn('px-3 py-1.5 rounded-full text-sm font-medium transition-colors', filter === f.key ? 'text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200')}
            style={filter === f.key ? { background: TEAL } : undefined}>{f.label}</button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={CalendarBlank} title="No reservations found" message="No reservations match the current filter." cta={properties.length > 0 ? 'New Reservation' : undefined} onCta={() => setShowForm(true)} />
      ) : (
        <div className="space-y-2">
          {filtered.map(r => (
            <div key={r.id} onClick={() => setSelected(r)} className="flex items-center gap-4 p-4 bg-white rounded-xl border border-gray-200 shadow-sm cursor-pointer hover:border-teal-300 transition-colors">
              <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold flex-shrink-0" style={{ background: TEAL }}>
                {r.guest_name.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-gray-900">{r.guest_name}</span>
                  <Badge className={STATUS_COLORS[r.status]}>{r.status.replace('_', ' ')}</Badge>
                  <Badge className="bg-gray-100 text-gray-600">{r.source}</Badge>
                </div>
                <div className="text-sm text-gray-500 mt-0.5">{propName(r.property_id)} · {fmt(r.check_in)} → {fmt(r.check_out)} ({nights(r.check_in, r.check_out)}n)</div>
              </div>
              {r.total_amount && <div className="text-sm font-semibold text-gray-700">${r.total_amount.toFixed(0)}</div>}
            </div>
          ))}
        </div>
      )}

      {/* Create form */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>New Reservation</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Property *</Label>
              <select className="w-full border rounded-md px-3 py-2 text-sm mt-1" value={form.property_id} onChange={e => setForm(f => ({ ...f, property_id: e.target.value }))}>
                <option value="">Select property…</option>
                {properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Guest Name *</Label><Input value={form.guest_name} onChange={e => setForm(f => ({ ...f, guest_name: e.target.value }))} /></div>
              <div><Label>Guests</Label><Input type="number" min={1} value={form.guests_count} onChange={e => setForm(f => ({ ...f, guests_count: e.target.value }))} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Email *</Label><Input type="email" value={form.guest_email} onChange={e => setForm(f => ({ ...f, guest_email: e.target.value }))} /></div>
              <div><Label>Phone</Label><Input value={form.guest_phone} onChange={e => setForm(f => ({ ...f, guest_phone: e.target.value }))} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Check-in *</Label><Input type="date" value={form.check_in} onChange={e => setForm(f => ({ ...f, check_in: e.target.value }))} /></div>
              <div><Label>Check-out *</Label><Input type="date" value={form.check_out} onChange={e => setForm(f => ({ ...f, check_out: e.target.value }))} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Source</Label>
                <select className="w-full border rounded-md px-3 py-2 text-sm mt-1" value={form.source} onChange={e => setForm(f => ({ ...f, source: e.target.value }))}>
                  {['direct', 'airbnb', 'vrbo', 'booking.com', 'other'].map(s => <option key={s}>{s}</option>)}
                </select>
              </div>
              <div><Label>Total ($)</Label><Input type="number" value={form.total_amount} onChange={e => setForm(f => ({ ...f, total_amount: e.target.value }))} /></div>
            </div>
            <div><Label>Notes</Label><Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={saving} style={{ background: TEAL }}>{saving ? 'Saving…' : 'Create'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detail panel */}
      <Dialog open={!!selected} onOpenChange={v => !v && setSelected(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle>{selected.guest_name}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div className="flex flex-wrap gap-2">
                  <Badge className={STATUS_COLORS[selected.status]}>{selected.status.replace('_', ' ')}</Badge>
                  <Badge className="bg-gray-100 text-gray-600">{selected.source}</Badge>
                  <Badge className="bg-gray-100 text-gray-600">{selected.guests_count} guest{selected.guests_count > 1 ? 's' : ''}</Badge>
                </div>
                <div className="text-sm space-y-1 text-gray-700">
                  <div><span className="font-medium">Property:</span> {propName(selected.property_id)}</div>
                  <div><span className="font-medium">Dates:</span> {fmt(selected.check_in)} → {fmt(selected.check_out)} ({nights(selected.check_in, selected.check_out)} nights)</div>
                  {selected.total_amount && <div><span className="font-medium">Total:</span> ${selected.total_amount.toFixed(2)}</div>}
                  <div className="flex items-center gap-2"><Envelope size={13} />{selected.guest_email}</div>
                  {selected.guest_phone && <div className="flex items-center gap-2"><Phone size={13} />{selected.guest_phone}</div>}
                  {selected.notes && <div className="text-gray-500 italic">{selected.notes}</div>}
                </div>
                <div>
                  <Label className="text-xs text-gray-500 mb-2">Update Status</Label>
                  <div className="flex flex-wrap gap-2">
                    {(['confirmed', 'checked_in', 'checked_out', 'cancelled'] as ReservationStatus[]).map(s => (
                      <button key={s} onClick={() => { void updateStatus(selected.id, s); setSelected({ ...selected, status: s }) }}
                        className={cn('px-3 py-1 rounded-full text-xs font-medium border transition-colors', selected.status === s ? STATUS_COLORS[s] + ' border-transparent' : 'border-gray-200 text-gray-600 hover:bg-gray-50')}>
                        {s.replace('_', ' ')}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}

// ── Tasks View ────────────────────────────────────────────────────────────────

function TasksView() {
  const [items, setItems] = useState<StayTask[]>([])
  const [properties, setProperties] = useState<StayProperty[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [editingTask, setEditingTask] = useState<StayTask | null>(null)
  const [form, setForm] = useState({ title: '', notes: '', assigned_to: '', property_id: '', priority: 'normal', due_date: '' })
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const [tasks, props] = await Promise.all([stayApi.getTasks(), stayApi.getProperties()])
      setItems(tasks); setProperties(props)
    } catch (e) { setError(e instanceof Error ? e.message : 'Failed to load') }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { void load() }, [load])

  async function handleSave() {
    if (!form.title) { toast.error('Title is required'); return }
    setSaving(true)
    const typedForm = { ...form, priority: form.priority as import('../types').TaskPriority }
    try {
      if (editingTask) {
        await stayApi.updateTask(editingTask.id, typedForm)
        toast.success('Task updated')
      } else {
        await stayApi.createTask(typedForm)
        toast.success('Task created')
      }
      setShowForm(false); setEditingTask(null); await load()
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Save failed') }
    finally { setSaving(false) }
  }

  async function moveTask(task: StayTask, status: TaskStatus) {
    try { await stayApi.updateTask(task.id, { status }); await load() }
    catch (e) { toast.error(e instanceof Error ? e.message : 'Update failed') }
  }

  async function deleteTask(id: string) {
    try { await stayApi.deleteTask(id); await load() }
    catch (e) { toast.error(e instanceof Error ? e.message : 'Delete failed') }
  }

  function openAdd() { setEditingTask(null); setForm({ title: '', notes: '', assigned_to: '', property_id: '', priority: 'normal', due_date: '' }); setShowForm(true) }
  function openEdit(t: StayTask) { setEditingTask(t); setForm({ title: t.title, notes: t.notes ?? '', assigned_to: t.assigned_to ?? '', property_id: t.property_id ?? '', priority: t.priority, due_date: t.due_date ?? '' }); setShowForm(true) }

  function propName(pid?: string) { return pid ? (properties.find(p => p.id === pid)?.name ?? '') : '' }

  const COLS: { status: TaskStatus; label: string }[] = [
    { status: 'open', label: 'Open' },
    { status: 'in_progress', label: 'In Progress' },
    { status: 'done', label: 'Done' },
  ]

  if (loading) return <Spinner />
  if (error) return <ErrorBanner message={error} onRetry={load} />

  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-gray-800">Tasks</h2>
        <Button onClick={openAdd} style={{ background: TEAL }}><Plus size={16} className="mr-1" /> New Task</Button>
      </div>

      {items.length === 0 ? (
        <EmptyState icon={ListChecks} title="No tasks" message="Create tasks for cleaners, maintenance, and more." cta="New Task" onCta={openAdd} />
      ) : (
        <div className="grid md:grid-cols-3 gap-4">
          {COLS.map(col => {
            const colItems = items.filter(t => t.status === col.status)
            return (
              <div key={col.status} className="bg-gray-50 rounded-xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-sm text-gray-700">{col.label}</h3>
                  <span className="text-xs bg-gray-200 text-gray-600 rounded-full px-2 py-0.5">{colItems.length}</span>
                </div>
                <div className="space-y-2">
                  {colItems.map(t => (
                    <div key={t.id} className="bg-white rounded-lg border border-gray-200 p-3 shadow-sm">
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-sm font-medium text-gray-800 flex-1">{t.title}</span>
                        <div className="flex gap-1 flex-shrink-0">
                          <button onClick={() => openEdit(t)} className="p-1 rounded hover:bg-gray-100"><PencilSimple size={12} className="text-gray-400" /></button>
                          <button onClick={() => deleteTask(t.id)} className="p-1 rounded hover:bg-red-50"><Trash size={12} className="text-red-300" /></button>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        <Badge className={PRIORITY_COLORS[t.priority]}>{t.priority}</Badge>
                        {t.property_id && <Badge className="bg-gray-100 text-gray-600">{propName(t.property_id)}</Badge>}
                        {t.due_date && <Badge className="bg-gray-100 text-gray-600"><Clock size={10} className="mr-0.5" />{fmt(t.due_date)}</Badge>}
                      </div>
                      {t.assigned_to && <div className="text-xs text-gray-500 mt-1.5">→ {t.assigned_to}</div>}
                      <div className="flex gap-1.5 mt-2.5">
                        {col.status !== 'open' && <button onClick={() => moveTask(t, 'open')} className="text-xs text-gray-500 hover:text-gray-700 underline">open</button>}
                        {col.status !== 'in_progress' && <button onClick={() => moveTask(t, 'in_progress')} className="text-xs text-gray-500 hover:text-gray-700 underline">in progress</button>}
                        {col.status !== 'done' && <button onClick={() => moveTask(t, 'done')} className="text-xs text-gray-500 hover:text-gray-700 underline">done</button>}
                      </div>
                    </div>
                  ))}
                  {colItems.length === 0 && <p className="text-xs text-gray-400 text-center py-4">Empty</p>}
                </div>
              </div>
            )
          })}
        </div>
      )}

      <Dialog open={showForm} onOpenChange={v => { if (!v) { setShowForm(false); setEditingTask(null) } }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editingTask ? 'Edit Task' : 'New Task'}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div><Label>Title *</Label><Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} /></div>
            <div>
              <Label>Property</Label>
              <select className="w-full border rounded-md px-3 py-2 text-sm mt-1" value={form.property_id} onChange={e => setForm(f => ({ ...f, property_id: e.target.value }))}>
                <option value="">All / None</option>
                {properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Priority</Label>
                <select className="w-full border rounded-md px-3 py-2 text-sm mt-1" value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))}>
                  {['low', 'normal', 'high', 'urgent'].map(p => <option key={p}>{p}</option>)}
                </select>
              </div>
              <div><Label>Due Date</Label><Input type="date" value={form.due_date} onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))} /></div>
            </div>
            <div><Label>Assigned To</Label><Input value={form.assigned_to} onChange={e => setForm(f => ({ ...f, assigned_to: e.target.value }))} placeholder="Name or email" /></div>
            <div><Label>Notes</Label><Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowForm(false); setEditingTask(null) }}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving} style={{ background: TEAL }}>{saving ? 'Saving…' : 'Save'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

// ── Messages View ─────────────────────────────────────────────────────────────

function MessagesView() {
  const [messages, setMessages] = useState<StayMessage[]>([])
  const [reservations, setReservations] = useState<StayReservation[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [sendForm, setSendForm] = useState({ reservation_id: '', channel: 'sms', to_address: '', body: '' })
  const [sending, setSending] = useState(false)
  const [showSend, setShowSend] = useState(false)

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const [msgs, res] = await Promise.all([stayApi.getMessages(), stayApi.getReservations()])
      setMessages(msgs); setReservations(res)
    } catch (e) { setError(e instanceof Error ? e.message : 'Failed to load') }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { void load() }, [load])

  async function handleSend() {
    if (!sendForm.to_address || !sendForm.body) { toast.error('To address and message body are required'); return }
    setSending(true)
    try {
      await stayApi.sendMessage(sendForm)
      toast.success('Message sent'); setShowSend(false); await load()
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Send failed') }
    finally { setSending(false) }
  }

  function guestName(resId?: string) {
    if (!resId) return 'N/A'
    return reservations.find(r => r.id === resId)?.guest_name ?? resId.slice(0, 8)
  }

  if (loading) return <Spinner />
  if (error) return <ErrorBanner message={error} onRetry={load} />

  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-gray-800">Messages</h2>
        <Button onClick={() => setShowSend(true)} style={{ background: TEAL }}><Plus size={16} className="mr-1" /> Send Message</Button>
      </div>

      {messages.length === 0 ? (
        <EmptyState icon={ChatCircle} title="No messages" message="Send guest messages or they'll appear here from automations." cta="Send Message" onCta={() => setShowSend(true)} />
      ) : (
        <div className="space-y-2">
          {messages.map(m => (
            <div key={m.id} className={cn('flex gap-3 p-4 rounded-xl border shadow-sm', m.direction === 'inbound' ? 'bg-teal-50 border-teal-100 flex-row-reverse' : 'bg-white border-gray-200')}>
              <div className={cn('w-8 h-8 rounded-full flex items-center justify-center text-xs text-white flex-shrink-0', m.direction === 'inbound' ? 'bg-teal-600' : 'bg-gray-400')}>
                {m.direction === 'inbound' ? 'G' : 'H'}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-medium text-gray-700">{m.direction === 'inbound' ? guestName(m.reservation_id) : 'You'}</span>
                  <Badge className="bg-gray-100 text-gray-500">{m.channel}</Badge>
                  <span className="text-xs text-gray-400">{m.sent_at ? new Date(m.sent_at).toLocaleString() : new Date(m.created_at).toLocaleString()}</span>
                </div>
                <p className="text-sm text-gray-800">{m.body}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={showSend} onOpenChange={setShowSend}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Send Message</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Reservation (optional)</Label>
              <select className="w-full border rounded-md px-3 py-2 text-sm mt-1" value={sendForm.reservation_id} onChange={e => {
                const r = reservations.find(x => x.id === e.target.value)
                setSendForm(f => ({ ...f, reservation_id: e.target.value, to_address: r?.guest_phone ?? r?.guest_email ?? f.to_address }))
              }}>
                <option value="">No reservation</option>
                {reservations.map(r => <option key={r.id} value={r.id}>{r.guest_name} ({r.check_in})</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Channel</Label>
                <select className="w-full border rounded-md px-3 py-2 text-sm mt-1" value={sendForm.channel} onChange={e => setSendForm(f => ({ ...f, channel: e.target.value }))}>
                  <option value="sms">SMS</option>
                  <option value="email">Email</option>
                </select>
              </div>
              <div><Label>To *</Label><Input value={sendForm.to_address} onChange={e => setSendForm(f => ({ ...f, to_address: e.target.value }))} placeholder="Phone or email" /></div>
            </div>
            <div><Label>Message *</Label><Textarea value={sendForm.body} onChange={e => setSendForm(f => ({ ...f, body: e.target.value }))} rows={4} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSend(false)}>Cancel</Button>
            <Button onClick={handleSend} disabled={sending} style={{ background: TEAL }}>{sending ? 'Sending…' : 'Send'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

// ── Automations View ──────────────────────────────────────────────────────────

function AutomationsView() {
  const [items, setItems] = useState<StayAutomation[]>([])
  const [properties, setProperties] = useState<StayProperty[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ name: '', property_id: '', trigger: 'pre_checkin', trigger_offset_hours: '24', action: 'send_message', action_body: '', action_channel: 'sms', enabled: true })

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const [autos, props] = await Promise.all([stayApi.getAutomations(), stayApi.getProperties()])
      setItems(autos); setProperties(props)
    } catch (e) { setError(e instanceof Error ? e.message : 'Failed to load') }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { void load() }, [load])

  async function toggle(a: StayAutomation) {
    try { await stayApi.updateAutomation(a.id, { enabled: a.enabled ? 0 : 1 }); await load() }
    catch (e) { toast.error(e instanceof Error ? e.message : 'Update failed') }
  }

  async function deleteAuto(id: string) {
    try { await stayApi.deleteAutomation(id); await load() }
    catch (e) { toast.error(e instanceof Error ? e.message : 'Delete failed') }
  }

  async function handleSave() {
    if (!form.name || !form.action_body) { toast.error('Name and message body are required'); return }
    setSaving(true)
    try {
      const action_config = JSON.stringify({ body: form.action_body, channel: form.action_channel })
      await stayApi.createAutomation({ name: form.name, property_id: form.property_id || undefined, trigger: form.trigger as StayAutomation['trigger'], trigger_offset_hours: parseInt(form.trigger_offset_hours) || 0, action: form.action as StayAutomation['action'], action_config, enabled: form.enabled })
      toast.success('Automation created'); setShowForm(false); await load()
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Save failed') }
    finally { setSaving(false) }
  }

  function insertToken(token: string) {
    setForm(f => ({ ...f, action_body: f.action_body + token }))
  }

  function propName(pid?: string) { return pid ? (properties.find(p => p.id === pid)?.name ?? 'Unknown') : 'All Properties' }

  if (loading) return <Spinner />
  if (error) return <ErrorBanner message={error} onRetry={load} />

  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-gray-800">Automations</h2>
        <Button onClick={() => setShowForm(true)} style={{ background: TEAL }}><Plus size={16} className="mr-1" /> Add Automation</Button>
      </div>

      {items.length === 0 ? (
        <EmptyState icon={Robot} title="No automations" message="Set up automated messages and actions triggered by reservation events." cta="Add Automation" onCta={() => setShowForm(true)} />
      ) : (
        <div className="space-y-3">
          {items.map(a => {
            const isEnabled = a.enabled === 1 || a.enabled === true
            return (
              <div key={a.id} className={cn('flex items-center gap-4 p-4 bg-white rounded-xl border shadow-sm', !isEnabled && 'opacity-60')}>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-gray-900">{a.name}</span>
                    {isEnabled ? <CheckCircle size={14} className="text-emerald-500" /> : <X size={14} className="text-gray-400" />}
                  </div>
                  <div className="text-sm text-gray-500 mt-0.5">
                    {a.trigger.replace('_', ' ')} {a.trigger_offset_hours ? `(${a.trigger_offset_hours}h)` : ''} → {a.action.replace(/_/g, ' ')} · {propName(a.property_id)}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => toggle(a)} className="text-gray-400 hover:text-gray-700">
                    {isEnabled ? <ToggleRight size={24} style={{ color: TEAL }} /> : <ToggleLeft size={24} />}
                  </button>
                  <button onClick={() => deleteAuto(a.id)} className="p-1.5 rounded hover:bg-red-50"><Trash size={15} className="text-red-400" /></button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>New Automation</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div><Label>Name *</Label><Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Pre-arrival message" /></div>
            <div>
              <Label>Applies To</Label>
              <select className="w-full border rounded-md px-3 py-2 text-sm mt-1" value={form.property_id} onChange={e => setForm(f => ({ ...f, property_id: e.target.value }))}>
                <option value="">All Properties</option>
                {properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Trigger</Label>
                <select className="w-full border rounded-md px-3 py-2 text-sm mt-1" value={form.trigger} onChange={e => setForm(f => ({ ...f, trigger: e.target.value }))}>
                  <option value="booking_confirmed">Booking Confirmed</option>
                  <option value="pre_checkin">Pre Check-in</option>
                  <option value="post_checkout">Post Checkout</option>
                  <option value="mid_stay">Mid Stay</option>
                  <option value="scheduled">Scheduled</option>
                </select>
              </div>
              <div><Label>Offset Hours</Label><Input type="number" value={form.trigger_offset_hours} onChange={e => setForm(f => ({ ...f, trigger_offset_hours: e.target.value }))} placeholder="24" /></div>
            </div>
            <div>
              <Label>Action</Label>
              <select className="w-full border rounded-md px-3 py-2 text-sm mt-1" value={form.action} onChange={e => setForm(f => ({ ...f, action: e.target.value }))}>
                <option value="send_message">Send Message</option>
                <option value="lock_code_set">Set Door Code</option>
                <option value="lock_code_clear">Clear Door Code</option>
                <option value="thermostat_set">Set Thermostat</option>
              </select>
            </div>
            {form.action === 'send_message' && (
              <>
                <div>
                  <Label>Channel</Label>
                  <select className="w-full border rounded-md px-3 py-2 text-sm mt-1" value={form.action_channel} onChange={e => setForm(f => ({ ...f, action_channel: e.target.value }))}>
                    <option value="sms">SMS</option>
                    <option value="email">Email</option>
                  </select>
                </div>
                <div>
                  <Label>Message Body *</Label>
                  <Textarea value={form.action_body} onChange={e => setForm(f => ({ ...f, action_body: e.target.value }))} rows={4} placeholder="Hi {{guest_name}}…" />
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {TOKEN_CHIPS.map(t => (
                      <button key={t} onClick={() => insertToken(t)} className="px-2 py-0.5 bg-teal-50 text-teal-700 rounded text-xs font-mono hover:bg-teal-100 border border-teal-200">{t}</button>
                    ))}
                  </div>
                </div>
              </>
            )}
            <div className="flex items-center gap-2">
              <input type="checkbox" id="enabled" checked={form.enabled} onChange={e => setForm(f => ({ ...f, enabled: e.target.checked }))} className="w-4 h-4" />
              <Label htmlFor="enabled">Enabled</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving} style={{ background: TEAL }}>{saving ? 'Saving…' : 'Create'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

// ── Calendar View ─────────────────────────────────────────────────────────────

function CalendarView() {
  const [reservations, setReservations] = useState<StayReservation[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [month, setMonth] = useState(() => {
    const now = new Date()
    return { year: now.getFullYear(), month: now.getMonth() }
  })

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try { setReservations(await stayApi.getReservations()) }
    catch (e) { setError(e instanceof Error ? e.message : 'Failed to load reservations') }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { void load() }, [load])

  const prevMonth = () => setMonth(m => {
    if (m.month === 0) return { year: m.year - 1, month: 11 }
    return { year: m.year, month: m.month - 1 }
  })
  const nextMonth = () => setMonth(m => {
    if (m.month === 11) return { year: m.year + 1, month: 0 }
    return { year: m.year, month: m.month + 1 }
  })
  const goToday = () => {
    const now = new Date()
    setMonth({ year: now.getFullYear(), month: now.getMonth() })
  }

  const monthLabel = new Date(month.year, month.month, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  const daysInMonth = new Date(month.year, month.month + 1, 0).getDate()
  const firstDow = new Date(month.year, month.month, 1).getDay()
  const today = new Date()
  const isCurrentMonth = today.getFullYear() === month.year && today.getMonth() === month.month
  const todayDay = isCurrentMonth ? today.getDate() : -1

  // Build day → reservation info map
  type DayInfo = { label: string; color: string; border: string; textColor: string }
  const dayMap = new Map<number, DayInfo>()

  for (const r of reservations) {
    if (r.status === 'cancelled') continue
    const checkIn = new Date(r.check_in + 'T00:00:00')
    const checkOut = new Date(r.check_out + 'T00:00:00')

    for (let d = new Date(checkIn); d <= checkOut; d.setDate(d.getDate() + 1)) {
      if (d.getFullYear() !== month.year || d.getMonth() !== month.month) continue
      const day = d.getDate()
      const isCheckOut = d.getTime() === checkOut.getTime()
      const isCheckIn = d.getTime() === checkIn.getTime()
      if (isCheckOut && dayMap.has(day)) {
        dayMap.set(day, { label: 'Turnover', color: '#FBF5E4', border: '#C9A84C', textColor: '#8A6820' })
      } else if (!dayMap.has(day)) {
        const label = isCheckIn ? `${r.guest_name.split(' ')[1] ?? r.guest_name} check-in` : r.guest_name.split(' ')[1] ?? r.guest_name
        const isInquiry = r.status === 'inquiry'
        dayMap.set(day, {
          label,
          color: isInquiry ? '#FBF5E4' : '#E0F4F4',
          border: isInquiry ? '#C9A84C' : '#4AACAC',
          textColor: isInquiry ? '#8A6820' : '#0A4F4F',
        })
      }
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-800">Calendar</h2>
        <div className="flex items-center gap-2">
          <button onClick={prevMonth} className="p-1.5 rounded hover:bg-gray-100 text-gray-600"><CaretLeft size={16} /></button>
          <span className="text-sm font-semibold text-gray-700 min-w-[140px] text-center">{monthLabel}</span>
          <button onClick={nextMonth} className="p-1.5 rounded hover:bg-gray-100 text-gray-600"><CaretRight size={16} /></button>
          <Button variant="outline" size="sm" onClick={goToday}>Today</Button>
        </div>
      </div>

      <div className="flex items-center gap-4 text-xs text-gray-500">
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm border" style={{ background: '#E0F4F4', borderColor: '#4AACAC' }} /> Reservation</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm border" style={{ background: '#FBF5E4', borderColor: '#C9A84C' }} /> Turnover / Inquiry</span>
      </div>

      {loading ? <Spinner /> : error ? <ErrorBanner message={error} onRetry={load} /> : (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="grid grid-cols-7 border-b border-gray-100">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
              <div key={d} className="text-center text-xs font-medium text-gray-400 py-3 font-mono tracking-widest uppercase">{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {Array.from({ length: firstDow }, (_, i) => (
              <div key={`blank-${i}`} className="min-h-[80px] border-r border-b border-gray-50" />
            ))}
            {Array.from({ length: daysInMonth }, (_, i) => {
              const day = i + 1
              const info = dayMap.get(day)
              const isToday = day === todayDay
              return (
                <div key={day} className="min-h-[80px] border-r border-b border-gray-50 p-2 cursor-pointer transition-colors hover:bg-gray-50"
                  style={info ? { background: info.color, borderColor: info.border + '40' } : undefined}>
                  <div className={cn('text-xs font-mono font-medium mb-1', isToday ? 'text-teal-700' : 'text-gray-700')}
                    style={isToday ? { boxShadow: `0 0 0 2px #0F6E6E`, borderRadius: '50%', width: 20, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center' } : undefined}>
                    {day}
                  </div>
                  {info && (
                    <div className="text-[10px] font-semibold leading-tight truncate" style={{ color: info.textColor }}>{info.label}</div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Devices View ──────────────────────────────────────────────────────────────

function DevicesView() {
  const [devices, setDevices] = useState<StayDevice[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try { setDevices(await stayApi.getDevices()) }
    catch (e) { setError(e instanceof Error ? e.message : 'Failed to load devices') }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { void load() }, [load])

  async function handleDelete(id: string) {
    if (!confirm('Remove this device?')) return
    try { await stayApi.deleteDevice(id); await load() }
    catch (e) { toast.error(e instanceof Error ? e.message : 'Delete failed') }
  }

  const statusColor = (s: string) => s === 'active' ? 'text-emerald-600' : s === 'error' ? 'text-red-600' : 'text-gray-500'
  const statusDot = (s: string) => s === 'active' ? 'bg-emerald-400' : s === 'error' ? 'bg-red-400' : 'bg-gray-400'

  if (loading) return <Spinner />
  if (error) return <ErrorBanner message={error} onRetry={load} />

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-800">Devices</h2>
        <Button variant="outline" size="sm" onClick={() => toast.info('Device registration coming soon')}>
          <Plus size={14} className="mr-1" /> Add Device
        </Button>
      </div>

      {devices.length === 0 ? (
        <EmptyState icon={HardDrives} title="No devices registered" message="Smart locks, thermostats, and noise sensors will appear here once connected." cta="Add Device" onCta={() => toast.info('Device registration coming soon')} />
      ) : (
        <div className="grid sm:grid-cols-2 gap-4">
          {devices.map(d => (
            <div key={d.id} className={cn('bg-white rounded-xl border shadow-sm overflow-hidden', d.status === 'error' ? 'border-red-200' : 'border-gray-200')}>
              <div className={cn('flex items-center justify-between px-4 py-3 border-b', d.status === 'error' ? 'bg-red-50 border-red-100' : 'bg-gray-50 border-gray-100')}>
                <div className="flex items-center gap-2">
                  <div className={cn('w-2 h-2 rounded-full', statusDot(d.status))} />
                  <span className={cn('font-semibold text-sm', d.status === 'error' ? 'text-red-700' : 'text-gray-800')}>{d.display_name}</span>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => load()} className="p-1.5 rounded hover:bg-white/60 text-gray-400" title="Refresh"><ArrowsClockwise size={13} /></button>
                  <button onClick={() => handleDelete(d.id)} className="p-1.5 rounded hover:bg-red-50 text-red-300"><Trash size={13} /></button>
                </div>
              </div>
              <div className="p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Type</span>
                  <span className="font-medium text-gray-800 capitalize">{d.device_type.replace(/_/g, ' ')}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Provider</span>
                  <span className="font-medium text-gray-800 capitalize">{d.provider}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Status</span>
                  <span className={cn('font-semibold', statusColor(d.status))}>{d.status}</span>
                </div>
                {d.last_seen_at && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Last seen</span>
                    <span className="text-gray-600 font-mono text-xs">{new Date(d.last_seen_at).toLocaleString()}</span>
                  </div>
                )}
                {d.status === 'error' && (
                  <Button size="sm" variant="outline" className="w-full mt-2 border-red-200 text-red-600 hover:bg-red-50"
                    onClick={() => toast.info('Re-authentication flow coming soon')}>
                    Re-authenticate →
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="mt-6">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Supported Integrations</h3>
        <div className="grid sm:grid-cols-2 gap-3">
          {[
            { name: 'Schlage Encode', type: 'Smart Lock' },
            { name: 'August Smart Lock', type: 'Smart Lock' },
            { name: 'Ecobee', type: 'Thermostat' },
            { name: 'Minut', type: 'Noise Sensor' },
          ].map(d => (
            <div key={d.name} className="flex items-center justify-between p-3 bg-white rounded-lg border border-gray-200">
              <div>
                <div className="font-medium text-sm text-gray-800">{d.name}</div>
                <div className="text-xs text-gray-400">{d.type} · OAuth via PJ</div>
              </div>
              <Button variant="outline" size="sm" onClick={() => toast.info('OAuth integration coming soon')}>Connect</Button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Audit View ────────────────────────────────────────────────────────────────

function AuditView() {
  const [entries, setEntries] = useState<StayAuditEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try { setEntries(await stayApi.getAudit(200)) }
    catch (e) { setError(e instanceof Error ? e.message : 'Failed to load audit log') }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { void load() }, [load])

  function actionIcon(action: string) {
    if (action.includes('sent') || action.includes('send') || action.includes('message')) return '◻'
    if (action.includes('auto') || action.includes('trigger')) return '⟳'
    if (action.includes('lock') || action.includes('device')) return '🔒'
    if (action.includes('status') || action.includes('change')) return '◈'
    if (action.includes('intake') || action.includes('inquiry')) return '◐'
    if (action.includes('create') || action.includes('new')) return '◎'
    if (action.includes('delete')) return '✕'
    return '◦'
  }

  function fmtTime(ts: string) {
    const d = new Date(ts)
    return d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
  }

  function parseChanges(raw: string | null): Record<string, unknown> | null {
    if (!raw) return null
    try { return JSON.parse(raw) as Record<string, unknown> } catch { return null }
  }

  if (loading) return <Spinner />
  if (error) return <ErrorBanner message={error} onRetry={load} />

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-800">Audit Log</h2>
          <p className="text-sm text-gray-500 mt-0.5">Append-only · {entries.length} records</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={load}><ArrowsClockwise size={14} className="mr-1" /> Refresh</Button>
        </div>
      </div>

      <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-700 font-medium w-fit">
        <CheckCircle size={13} /> VAULT · APPEND-ONLY
      </div>

      {entries.length === 0 ? (
        <EmptyState icon={ClipboardText} title="No audit records" message="Actions taken in StayOS will appear here — reservation changes, messages sent, automations triggered." />
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm divide-y divide-gray-100">
          {entries.map(e => {
            const changes = parseChanges(e.changes)
            return (
              <div key={e.id} className="flex items-start gap-3 px-4 py-3 hover:bg-gray-50">
                <div className="text-xs font-mono text-gray-400 min-w-[110px] mt-0.5 shrink-0">{fmtTime(e.created_at)}</div>
                <div className="text-base w-6 shrink-0 mt-0.5">{actionIcon(e.action)}</div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-gray-800">{e.action} · {e.entity_type} #{e.entity_id.slice(0, 8)}</div>
                  {changes && (
                    <div className="text-xs text-gray-500 mt-0.5 truncate">
                      {Object.entries(changes).map(([k, v]) => `${k}: ${String(v)}`).join(' · ')}
                    </div>
                  )}
                  <div className="mt-1">
                    <span className="inline-block text-xs font-mono bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">{e.actor_id}</span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Launch Package Card ───────────────────────────────────────────────────────

function LaunchPackageCard() {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{ property: string; automations: number; tasks: number; skipped: number } | null>(null)

  async function handleImport() {
    if (!confirm('Import the Kendall Pond launch package? This creates the property, 6 automations, and 30 launch timeline tasks. Already-existing items are skipped.')) return
    setLoading(true)
    try {
      const r = await stayApi.seedKendallPond()
      setResult({ property: r.property, automations: r.automations, tasks: r.tasks, skipped: r.skipped })
      toast.success(`Kendall Pond imported — ${r.automations} automations, ${r.tasks} tasks`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Import failed')
    } finally { setLoading(false) }
  }

  return (
    <div>
      <h3 className="text-lg font-semibold text-gray-800 mb-4">Launch Packages</h3>
      <div className="bg-gradient-to-br from-teal-50 to-cyan-50 border border-teal-200 rounded-xl p-5">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: TEAL }}>
            <Package size={20} className="text-white" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <h4 className="font-semibold text-gray-900">Kendall Pond Launch Package</h4>
              <span className="text-xs px-2 py-0.5 bg-teal-100 text-teal-700 rounded-full font-medium">110 Kendall Pond Rd W · Gardner, MA</span>
            </div>
            <p className="text-sm text-gray-600 mb-3">
              Imports the full launch package — property details, 6 guest message automations (booking confirmation through review request), and 30 launch timeline tasks covering Weeks 1–6.
            </p>
            <div className="flex flex-wrap gap-2 mb-4 text-xs text-teal-700">
              {['Property setup', '6 automations', '30 launch tasks', 'Week 1-6 timeline', 'June 1 launch target'].map(tag => (
                <span key={tag} className="flex items-center gap-1 bg-white/70 px-2 py-0.5 rounded border border-teal-200">
                  <Sparkle size={10} /> {tag}
                </span>
              ))}
            </div>
            {result ? (
              <div className="flex items-center gap-2 text-sm text-emerald-700 bg-white/80 rounded-lg px-3 py-2 border border-emerald-200">
                <CheckCircle size={16} className="text-emerald-500" />
                <span>
                  {result.property === 'created' ? 'Property created' : 'Property already exists'} · {result.automations} automations added · {result.tasks} tasks added
                  {result.skipped > 0 && ` · ${result.skipped} skipped (already exist)`}
                </span>
              </div>
            ) : (
              <Button onClick={handleImport} disabled={loading} style={{ background: TEAL }} size="sm">
                {loading ? <><ArrowsClockwise size={14} className="mr-1.5 animate-spin" /> Importing…</> : <><Package size={14} className="mr-1.5" /> Import to StayOS</>}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Settings View ─────────────────────────────────────────────────────────────

function SettingsView() {
  const [templates, setTemplates] = useState<StayTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [editingTpl, setEditingTpl] = useState<StayTemplate | null>(null)
  const [form, setForm] = useState({ name: '', trigger: '', channel: 'sms', subject: '', body: '' })
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try { setTemplates(await stayApi.getTemplates()) }
    catch (e) { setError(e instanceof Error ? e.message : 'Failed to load') }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { void load() }, [load])

  function openAdd() { setEditingTpl(null); setForm({ name: '', trigger: '', channel: 'sms', subject: '', body: '' }); setShowForm(true) }
  function openEdit(t: StayTemplate) { setEditingTpl(t); setForm({ name: t.name, trigger: t.trigger ?? '', channel: t.channel, subject: t.subject ?? '', body: t.body }); setShowForm(true) }

  async function handleSave() {
    if (!form.name || !form.body) { toast.error('Name and body are required'); return }
    setSaving(true)
    try {
      if (editingTpl) { await stayApi.updateTemplate(editingTpl.id, form); toast.success('Template updated') }
      else { await stayApi.createTemplate(form); toast.success('Template created') }
      setShowForm(false); setEditingTpl(null); await load()
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Save failed') }
    finally { setSaving(false) }
  }

  async function deleteTpl(id: string) {
    try { await stayApi.deleteTemplate(id); await load() }
    catch (e) { toast.error(e instanceof Error ? e.message : 'Delete failed') }
  }

  function insertToken(token: string) { setForm(f => ({ ...f, body: f.body + token })) }

  if (loading) return <Spinner />
  if (error) return <ErrorBanner message={error} onRetry={load} />

  return (
    <>
      <div className="space-y-8">
        {/* Templates */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-800">Message Templates</h3>
            <Button onClick={openAdd} variant="outline" size="sm"><Plus size={14} className="mr-1" /> Add Template</Button>
          </div>
          {templates.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-6">No templates. Add one or create a property to seed defaults.</p>
          ) : (
            <div className="space-y-2">
              {templates.map(t => (
                <div key={t.id} className="flex items-center gap-3 p-3 bg-white rounded-lg border border-gray-200 shadow-sm">
                  <div className="flex-1">
                    <div className="font-medium text-sm text-gray-800">{t.name}</div>
                    <div className="text-xs text-gray-500 mt-0.5 truncate">{t.body.slice(0, 80)}{t.body.length > 80 ? '…' : ''}</div>
                  </div>
                  <div className="flex gap-1.5">
                    <Badge className="bg-gray-100 text-gray-600">{t.channel}</Badge>
                    {t.trigger && <Badge className="bg-teal-50 text-teal-700">{t.trigger}</Badge>}
                    <button onClick={() => openEdit(t)} className="p-1.5 rounded hover:bg-gray-100"><PencilSimple size={14} className="text-gray-400" /></button>
                    <button onClick={() => deleteTpl(t.id)} className="p-1.5 rounded hover:bg-red-50"><Trash size={14} className="text-red-300" /></button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Launch Package */}
        <LaunchPackageCard />

        {/* Device integrations stubs */}
        <div>
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Device Integrations</h3>
          <div className="grid sm:grid-cols-2 gap-3">
            {['Schlage Encode', 'August Smart Lock', 'Ecobee Thermostat', 'Minut Noise Monitor'].map(d => (
              <div key={d} className="flex items-center justify-between p-4 bg-white rounded-lg border border-gray-200">
                <div>
                  <div className="font-medium text-sm text-gray-800">{d}</div>
                  <div className="text-xs text-gray-400">Not connected</div>
                </div>
                <Button variant="outline" size="sm" onClick={() => toast.info('Device integrations coming soon')}>Connect</Button>
              </div>
            ))}
          </div>
        </div>
      </div>

      <Dialog open={showForm} onOpenChange={v => { if (!v) { setShowForm(false); setEditingTpl(null) } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editingTpl ? 'Edit Template' : 'New Template'}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div><Label>Name *</Label><Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Channel</Label>
                <select className="w-full border rounded-md px-3 py-2 text-sm mt-1" value={form.channel} onChange={e => setForm(f => ({ ...f, channel: e.target.value }))}>
                  <option value="sms">SMS</option>
                  <option value="email">Email</option>
                </select>
              </div>
              <div>
                <Label>Trigger (optional)</Label>
                <select className="w-full border rounded-md px-3 py-2 text-sm mt-1" value={form.trigger} onChange={e => setForm(f => ({ ...f, trigger: e.target.value }))}>
                  <option value="">None</option>
                  <option value="booking_confirmed">Booking Confirmed</option>
                  <option value="pre_checkin">Pre Check-in</option>
                  <option value="post_checkout">Post Checkout</option>
                  <option value="mid_stay">Mid Stay</option>
                </select>
              </div>
            </div>
            {form.channel === 'email' && <div><Label>Subject</Label><Input value={form.subject} onChange={e => setForm(f => ({ ...f, subject: e.target.value }))} /></div>}
            <div>
              <Label>Body *</Label>
              <Textarea value={form.body} onChange={e => setForm(f => ({ ...f, body: e.target.value }))} rows={5} />
              <div className="flex flex-wrap gap-1.5 mt-2">
                {TOKEN_CHIPS.map(t => (
                  <button key={t} onClick={() => insertToken(t)} className="px-2 py-0.5 bg-teal-50 text-teal-700 rounded text-xs font-mono hover:bg-teal-100 border border-teal-200">{t}</button>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowForm(false); setEditingTpl(null) }}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving} style={{ background: TEAL }}>{saving ? 'Saving…' : 'Save'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

// ── Main Panel ────────────────────────────────────────────────────────────────

export function StayOSPanel({ onBack }: { onBack?: () => void }) {
  const [view, setView] = useState<StayOSView>('dashboard')

  // Auto-seed Kendall Pond on first load if no properties exist yet
  useEffect(() => {
    stayApi.getProperties().then(props => {
      if (props.length === 0) {
        stayApi.seedKendallPond().catch(() => { /* silent — user can import manually */ })
      }
    }).catch(() => { /* not logged in yet */ })
  }, [])

  return (
    <div className="flex flex-col h-full bg-gray-50">
      {/* Top nav bar */}
      <header className="flex-shrink-0 bg-white border-b border-gray-200 shadow-sm">
        <div className="flex items-center px-4 h-14">
          {onBack && (
            <button onClick={onBack} className="mr-3 p-1.5 rounded hover:bg-gray-100 text-gray-500">
              <ArrowRight size={18} className="rotate-180" />
            </button>
          )}
          <div className="flex items-center gap-2 mr-6">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center text-white" style={{ background: TEAL }}>
              <House size={16} weight="fill" />
            </div>
            <span className="font-bold text-gray-900 text-sm">StayOS</span>
          </div>
          <nav className="flex gap-1 overflow-x-auto">
            {NAV_ITEMS.map(({ key, label, icon: Icon }) => (
              <button key={key} onClick={() => setView(key)}
                className={cn('flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors', view === key ? 'text-white' : 'text-gray-600 hover:bg-gray-100')}
                style={view === key ? { background: TEAL } : undefined}>
                <Icon size={15} />
                <span className="hidden sm:inline">{label}</span>
              </button>
            ))}
          </nav>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 overflow-y-auto p-6">
        {view === 'dashboard' && <DashboardView onNavigate={setView} />}
        {view === 'properties' && <PropertiesView />}
        {view === 'reservations' && <ReservationsView />}
        {view === 'tasks' && <TasksView />}
        {view === 'messages' && <MessagesView />}
        {view === 'calendar' && <CalendarView />}
        {view === 'automations' && <AutomationsView />}
        {view === 'devices' && <DevicesView />}
        {view === 'audit' && <AuditView />}
        {view === 'settings' && <SettingsView />}
      </main>
    </div>
  )
}
