import { useState, useEffect } from 'react'
import { ArrowClockwise, Buildings, Plus } from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { pjApi, type TenantRecord } from '@/services/pjApi'

const STATUS_COLORS: Record<TenantRecord['status'], string> = {
  active: 'bg-emerald-500/10 text-emerald-600',
  suspended: 'bg-red-500/10 text-red-600',
  trial: 'bg-amber-500/10 text-amber-600',
}

const PLAN_COLORS: Record<TenantRecord['plan'], string> = {
  trial: 'bg-muted text-muted-foreground',
  standard: 'bg-indigo-500/10 text-indigo-600',
  enterprise: 'bg-purple-500/10 text-purple-600',
}

const DEFAULT_FORM = {
  slug: '', name: '', jurisdictionType: 'municipality' as TenantRecord['jurisdiction_type'],
  jurisdictionId: '', state: '', contactEmail: '', plan: 'trial' as TenantRecord['plan'],
}

export function TenantProvisioningPanel() {
  const [tenants, setTenants] = useState<TenantRecord[]>([])
  const [loading, setLoading] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [provisionOpen, setProvisionOpen] = useState(false)
  const [form, setForm] = useState(DEFAULT_FORM)
  const [provisioning, setProvisioning] = useState(false)

  async function load() {
    setLoading(true)
    try {
      const r = await pjApi.admin.listTenants()
      setTenants(r.tenants ?? [])
      setLoaded(true)
    } catch { toast.error('Failed to load tenants') }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  async function provision() {
    if (!form.slug.trim() || !form.name.trim()) return
    setProvisioning(true)
    try {
      const r = await pjApi.admin.provisionTenant({
        slug: form.slug.trim(),
        name: form.name.trim(),
        jurisdictionType: form.jurisdictionType,
        jurisdictionId: form.jurisdictionId.trim() || undefined,
        state: form.state.trim() || undefined,
        contactEmail: form.contactEmail.trim() || undefined,
        plan: form.plan,
      })
      setTenants(prev => [r.tenant, ...prev])
      setForm(DEFAULT_FORM)
      setProvisionOpen(false)
      toast.success(`Tenant "${r.tenant.name}" provisioned`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Provisioning failed')
    } finally { setProvisioning(false) }
  }

  async function toggleStatus(tenant: TenantRecord) {
    const next = tenant.status === 'active' ? 'suspended' : 'active'
    try {
      const r = await pjApi.admin.updateTenantStatus(tenant.id, next)
      setTenants(prev => prev.map(t => t.id === tenant.id ? r.tenant : t))
    } catch { toast.error('Failed to update status') }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-lg flex items-center gap-2"><Buildings size={18} /> Tenant Registry</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Provision and manage platform tenants. Each tenant gets an isolated SEAL key chain.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={load} disabled={loading} className="gap-1.5 h-8 text-xs">
            <ArrowClockwise size={13} className={loading ? 'animate-spin' : ''} /> Refresh
          </Button>
          <Button size="sm" onClick={() => setProvisionOpen(p => !p)} className="gap-1.5 h-8 text-xs">
            <Plus size={13} /> New Tenant
          </Button>
        </div>
      </div>

      {provisionOpen && (
        <div className="rounded-lg border bg-card p-4 space-y-3">
          <div className="text-sm font-semibold">Provision Tenant</div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Slug *</label>
              <input type="text" placeholder="sutton-ma" value={form.slug}
                onChange={e => setForm(p => ({ ...p, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') }))}
                className="w-full h-9 rounded-md border bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring" />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Name *</label>
              <input type="text" placeholder="Town of Sutton" value={form.name}
                onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                className="w-full h-9 rounded-md border bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring" />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Type</label>
              <select value={form.jurisdictionType} onChange={e => setForm(p => ({ ...p, jurisdictionType: e.target.value as TenantRecord['jurisdiction_type'] }))}
                className="w-full h-9 rounded-md border bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring">
                <option value="municipality">Municipality</option>
                <option value="county">County</option>
                <option value="state">State</option>
                <option value="utility">Utility</option>
                <option value="nonprofit">Nonprofit</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Plan</label>
              <select value={form.plan} onChange={e => setForm(p => ({ ...p, plan: e.target.value as TenantRecord['plan'] }))}
                className="w-full h-9 rounded-md border bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring">
                <option value="trial">Trial</option>
                <option value="standard">Standard</option>
                <option value="enterprise">Enterprise</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">State</label>
              <input type="text" placeholder="MA" value={form.state}
                onChange={e => setForm(p => ({ ...p, state: e.target.value.toUpperCase().slice(0, 2) }))}
                className="w-full h-9 rounded-md border bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring" />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Contact Email</label>
              <input type="email" placeholder="admin@town.gov" value={form.contactEmail}
                onChange={e => setForm(p => ({ ...p, contactEmail: e.target.value }))}
                className="w-full h-9 rounded-md border bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring" />
            </div>
          </div>
          <div className="flex gap-2">
            <Button size="sm" disabled={provisioning || !form.slug.trim() || !form.name.trim()} onClick={provision} className="gap-1.5">
              {provisioning ? 'Provisioning…' : 'Provision Tenant'}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setProvisionOpen(false)}>Cancel</Button>
          </div>
        </div>
      )}

      {!loaded ? (
        <div className="py-10 text-center text-muted-foreground text-sm">Loading tenants…</div>
      ) : tenants.length === 0 ? (
        <div className="py-10 text-center text-muted-foreground text-sm">No tenants provisioned yet.</div>
      ) : (
        <div className="rounded-md border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/40 border-b">
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Name</th>
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Slug</th>
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Type</th>
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Plan</th>
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">SEAL</th>
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Status</th>
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Created</th>
              </tr>
            </thead>
            <tbody>
              {tenants.map((t, i) => (
                <tr key={t.id} className={cn('border-b last:border-0', i % 2 === 0 ? '' : 'bg-muted/20')}>
                  <td className="px-4 py-3 font-medium">{t.name}</td>
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{t.slug}</td>
                  <td className="px-4 py-3 text-xs">{t.jurisdiction_type}</td>
                  <td className="px-4 py-3">
                    <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', PLAN_COLORS[t.plan])}>{t.plan}</span>
                  </td>
                  <td className="px-4 py-3">
                    {t.seal_provisioned
                      ? <span className="text-xs text-emerald-600">✓ ESK</span>
                      : <span className="text-xs text-muted-foreground">—</span>}
                  </td>
                  <td className="px-4 py-3">
                    <button onClick={() => toggleStatus(t)}
                      className={cn('text-xs px-2 py-0.5 rounded-full font-medium transition-colors', STATUS_COLORS[t.status])}>
                      {t.status}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {new Date(t.created_at).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
