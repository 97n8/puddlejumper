/**
 * EnvironmentHub — main workspaces home screen.
 *
 * Shows:
 *  - Greeting header with fleet stats
 *  - Quick-create type cards (Vault/Municipal, Stay, Standard)
 *  - Demo environment pinned card
 *  - Recently opened section (top 3 by lastAccessed)
 *  - Full workspace grid/list
 */

import { useState, useMemo } from 'react'
import type { CaseSpace } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  MagnifyingGlass, Buildings, Plus, ArrowsClockwise, List,
  SquaresFour, Rows, Cube, PencilSimple, ShieldCheck,
  Clock, Bed, FolderOpen, ArrowRight, Sparkle, MapPin,
} from '@phosphor-icons/react'
import { EnvironmentHubSidebar } from './EnvironmentHubSidebar'
import { EnvironmentCard } from './EnvironmentCard'
import { CreateEnvironmentSheet } from './CreateEnvironmentSheet'
import { EditEnvironmentSheet } from './EditEnvironmentSheet'
import { LOGICVILLE_ENVIRONMENT_ID, LOGICVILLE_OPERATING_AREAS } from '../constants/logicville'
import { useEnvironments } from '../hooks/useEnvironments'
import { resolveEnvironmentModules } from './environmentModuleIcons'
import type { SuttonViewer } from '@/lib/environmentAccess'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/services/auth/AuthContext'
import { notifyEnvironmentCreated } from '../utils/notifyEnvironmentCreated'

interface EnvironmentHubProps {
  onSelectEnvironment: (id: string) => void
  viewer?: SuttonViewer | null
}

function formatRelative(ts?: number): string {
  if (!ts) return '—'
  const diff = Date.now() - ts
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

// ── Quick-create type card ─────────────────────────────────────────────────

interface QuickCreateCardProps {
  icon: React.ReactNode
  label: string
  description: string
  accent: string
  onClick: () => void
}

function QuickCreateCard({ icon, label, description, accent, onClick }: QuickCreateCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group flex flex-col gap-2 rounded-xl border p-4 text-left transition-all hover:shadow-md hover:scale-[1.01] ${accent}`}
    >
      <div className="flex items-center justify-between">
        <div className="w-9 h-9 rounded-lg bg-background/60 flex items-center justify-center">
          {icon}
        </div>
        <Plus size={14} className="text-muted-foreground group-hover:text-foreground transition-colors" />
      </div>
      <div>
        <p className="text-sm font-semibold">{label}</p>
        <p className="text-xs text-muted-foreground mt-0.5 leading-snug">{description}</p>
      </div>
    </button>
  )
}

// ── Demo card ─────────────────────────────────────────────────────────────────

function DemoCard({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      data-testid="demo-environment-card"
      className="w-full group text-left rounded-xl border border-primary/20 bg-gradient-to-r from-primary/5 via-background to-background overflow-hidden hover:border-primary/40 hover:shadow-md transition-all"
    >
      <div className="h-0.5 w-full bg-gradient-to-r from-primary via-blue-400 to-indigo-500" />
      <div className="flex items-center gap-4 p-4">
        <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 text-xl">🏛️</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-sm">Town of Logicville</span>
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-primary/10 text-primary uppercase tracking-wide">
              <Sparkle size={9} weight="fill" /> Demo
            </span>
            <span className="hidden sm:inline-flex items-center gap-1 text-[10px] text-muted-foreground">
              <MapPin size={10} /> Middlesex County, MA
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Fully-configured municipal environment — explore every module with real workflows and compliance scenarios.
          </p>
          <div className="flex flex-wrap gap-1 mt-2">
            {LOGICVILLE_OPERATING_AREAS.slice(0, 5).map(area => (
              <span key={area.id}
                className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium border ${area.bg} ${area.border} ${area.text}`}>
                {area.label}
              </span>
            ))}
          </div>
        </div>
        <div className="shrink-0 hidden md:flex flex-col items-end gap-1">
          <span className="flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
            <ShieldCheck size={11} weight="fill" /> VAULT enabled
          </span>
          <span className="flex items-center gap-1 text-xs font-semibold text-primary group-hover:gap-2 transition-all">
            Open demo <ArrowRight size={12} weight="bold" className="group-hover:translate-x-0.5 transition-transform" />
          </span>
        </div>
      </div>
    </button>
  )
}

// ── Recent environment strip item ─────────────────────────────────────────────

function RecentCard({ env, onClick }: { env: CaseSpace; onClick: () => void }) {
  const color = env.color ?? '#627DBD'
  const modules = resolveEnvironmentModules(env.vaultModuleIds)
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex-1 min-w-[160px] max-w-[280px] flex flex-col gap-2 rounded-xl border bg-card hover:shadow-md hover:border-primary/30 transition-all p-3.5 text-left group"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: color + '25' }}>
          {env.type === 'vault'
            ? <Buildings size={16} style={{ color }} />
            : env.type === 'stay'
            ? <Bed size={16} style={{ color }} />
            : <FolderOpen size={16} style={{ color }} />}
        </div>
        <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
          <Clock size={9} /> {formatRelative(env.lastAccessed)}
        </span>
      </div>
      <div>
        <p className="text-sm font-semibold leading-tight line-clamp-1">{env.name}</p>
        {modules.length > 0 ? (
          <p className="text-[10px] text-muted-foreground mt-0.5">
            {modules.slice(0, 3).map(m => m.label).join(' · ')}
            {modules.length > 3 ? ` +${modules.length - 3}` : ''}
          </p>
        ) : (
          <p className="text-[10px] text-muted-foreground mt-0.5 capitalize">{env.type ?? 'workspace'}</p>
        )}
      </div>
      <ArrowRight size={11} className="text-muted-foreground/40 group-hover:text-primary group-hover:translate-x-0.5 transition-all mt-auto" />
    </button>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────

export function EnvironmentHub({ onSelectEnvironment, viewer }: EnvironmentHubProps) {
  const { environments, loading, refresh, createEnvironment, updateEnvironment, deleteEnvironment } = useEnvironments(viewer)
  const { user } = useAuth()
  const navigate = useNavigate()

  const [search, setSearch] = useState('')
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [activeId, setActiveId] = useState<string | null>(null)
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [editEnv, setEditEnv] = useState<CaseSpace | null>(null)

  // Environments excluding the logicville demo (handled separately)
  const userEnvs = useMemo(() =>
    environments.filter(e => e.id !== LOGICVILLE_ENVIRONMENT_ID),
    [environments]
  )

  const filtered = useMemo(() =>
    userEnvs.filter(e =>
      e.name.toLowerCase().includes(search.toLowerCase()) ||
      e.description?.toLowerCase().includes(search.toLowerCase())
    ),
    [userEnvs, search]
  )

  const recentEnvs = useMemo(() =>
    [...userEnvs]
      .filter(e => e.lastAccessed)
      .sort((a, b) => (b.lastAccessed ?? 0) - (a.lastAccessed ?? 0))
      .slice(0, 4),
    [userEnvs]
  )

  const totalModules = userEnvs.reduce((sum, e) => sum + (e.vaultModuleIds?.length ?? 0), 0)

  const handleSelect = (id: string) => {
    setActiveId(id)
    setMobileSidebarOpen(false)
    onSelectEnvironment(id)
  }

  const firstName = user?.name?.split(' ')[0] ?? user?.email?.split('@')[0] ?? 'there'

  return (
    <div className="h-full flex overflow-hidden bg-background relative">
      {/* Mobile overlay */}
      {mobileSidebarOpen && (
        <div className="md:hidden fixed inset-0 z-20 bg-black/40" onClick={() => setMobileSidebarOpen(false)} />
      )}

      {/* Left sidebar — environment switcher (desktop only) */}
      <EnvironmentHubSidebar
        environments={environments}
        activeId={activeId}
        onSelectEnvironment={handleSelect}
        onNewEnvironment={() => setCreateOpen(true)}
        mobileOpen={mobileSidebarOpen}
        onMobileClose={() => setMobileSidebarOpen(false)}
      />

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* Top toolbar */}
        <div className="flex items-center gap-2 px-4 py-3 border-b shrink-0">
          <button
            className="md:hidden w-8 h-8 flex items-center justify-center rounded-lg hover:bg-muted transition-colors shrink-0"
            onClick={() => setMobileSidebarOpen(v => !v)}
            aria-label="Browse environments"
          >
            <List size={16} />
          </button>
          <div className="relative flex-1 min-w-0">
            <MagnifyingGlass size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search workspaces…"
              className="pl-8 h-8 text-sm"
            />
          </div>
          <div className="flex items-center border rounded-md overflow-hidden shrink-0">
            <button
              className={`w-7 h-7 flex items-center justify-center transition-colors ${viewMode === 'grid' ? 'bg-accent text-accent-foreground' : 'hover:bg-muted text-muted-foreground'}`}
              onClick={() => setViewMode('grid')} title="Grid view">
              <SquaresFour size={14} />
            </button>
            <button
              className={`w-7 h-7 flex items-center justify-center transition-colors border-l ${viewMode === 'list' ? 'bg-accent text-accent-foreground' : 'hover:bg-muted text-muted-foreground'}`}
              onClick={() => setViewMode('list')} title="List view">
              <Rows size={14} />
            </button>
          </div>
          <Button size="sm" variant="ghost" className="px-2" onClick={() => refresh()} title="Refresh">
            <ArrowsClockwise size={14} />
          </Button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 min-h-0 overflow-y-auto">
          {!search ? (
            <div className="flex flex-col gap-6 p-5">

              {/* Header */}
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h1 className="text-lg font-semibold">
                    {loading ? 'Workspaces' : `${firstName}'s Workspaces`}
                  </h1>
                  {!loading && (
                    <p className="text-sm text-muted-foreground mt-0.5">
                      {userEnvs.length === 0
                        ? 'Create your first workspace to get started.'
                        : `${userEnvs.length} workspace${userEnvs.length !== 1 ? 's' : ''}${totalModules > 0 ? ` · ${totalModules} module${totalModules !== 1 ? 's' : ''}` : ''}`}
                    </p>
                  )}
                </div>
              </div>

              {/* Quick-create row */}
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2.5">Create workspace</p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <QuickCreateCard
                    icon={<Buildings size={18} className="text-primary" />}
                    label="Municipal Vault"
                    description="Compliance-governed workspace for permits, records, boards, and fiscal."
                    accent="border-primary/20 bg-primary/3 hover:bg-primary/6"
                    onClick={() => setCreateOpen(true)}
                  />
                  <QuickCreateCard
                    icon={<Bed size={18} className="text-violet-500" />}
                    label="Stay / Hospitality"
                    description="Short-term rental registration, inspections, and lodging excise tracking."
                    accent="border-violet-500/20 bg-violet-500/3 hover:bg-violet-500/6"
                    onClick={() => setCreateOpen(true)}
                  />
                  <QuickCreateCard
                    icon={<FolderOpen size={18} className="text-emerald-500" />}
                    label="Team Workspace"
                    description="Files, collaboration, and day-to-day team work without compliance overhead."
                    accent="border-emerald-500/20 bg-emerald-500/3 hover:bg-emerald-500/6"
                    onClick={() => setCreateOpen(true)}
                  />
                </div>
              </div>

              {/* Demo environment */}
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2.5">Demo environment</p>
                <DemoCard onClick={() => navigate('/demo')} />
              </div>

              {loading ? (
                <div className="flex items-center justify-center h-24 text-muted-foreground text-sm">
                  Loading workspaces…
                </div>
              ) : userEnvs.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 gap-3 text-center">
                  <Buildings size={36} className="text-muted-foreground/30" />
                  <div>
                    <p className="text-sm font-medium">No workspaces yet</p>
                    <p className="text-xs text-muted-foreground mt-1">Choose a workspace type above to get started.</p>
                  </div>
                </div>
              ) : (
                <>
                  {/* Recently opened */}
                  {recentEnvs.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                        <Clock size={11} /> Recently opened
                      </p>
                      <div className="flex gap-3 overflow-x-auto pb-1">
                        {recentEnvs.map(env => (
                          <RecentCard key={env.id} env={env} onClick={() => handleSelect(env.id)} />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* All workspaces */}
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2.5">
                      All workspaces
                    </p>
                    {viewMode === 'grid' ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                        {userEnvs.map(env => (
                          <EnvironmentCard
                            key={env.id}
                            environment={env}
                            onClick={() => handleSelect(env.id)}
                            onEdit={() => setEditEnv(env)}
                            onDelete={() => deleteEnvironment(env.id)}
                          />
                        ))}
                      </div>
                    ) : (
                      <EnvironmentListTable
                        environments={userEnvs}
                        onSelect={handleSelect}
                        onEdit={setEditEnv}
                        onDelete={id => deleteEnvironment(id)}
                      />
                    )}
                  </div>
                </>
              )}
            </div>
          ) : (
            /* Search results */
            <div className="p-5 flex flex-col gap-4">
              <p className="text-sm text-muted-foreground">
                {filtered.length === 0
                  ? `No workspaces match "${search}"`
                  : `${filtered.length} result${filtered.length !== 1 ? 's' : ''} for "${search}"`}
              </p>
              {viewMode === 'grid' ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {filtered.map(env => (
                    <EnvironmentCard
                      key={env.id}
                      environment={env}
                      onClick={() => handleSelect(env.id)}
                      onEdit={() => setEditEnv(env)}
                      onDelete={() => deleteEnvironment(env.id)}
                    />
                  ))}
                </div>
              ) : (
                <EnvironmentListTable
                  environments={filtered}
                  onSelect={handleSelect}
                  onEdit={setEditEnv}
                  onDelete={id => deleteEnvironment(id)}
                />
              )}
            </div>
          )}
        </div>
      </div>

      <CreateEnvironmentSheet
        open={createOpen}
        onOpenChange={setCreateOpen}
        onSubmit={async (env) => {
          await createEnvironment(env)
          notifyEnvironmentCreated({
            envName: env.name,
            envId: env.id,
            moduleIds: env.vaultModuleIds ?? [],
            userEmail: user?.email,
            userName: user?.name,
          })
          handleSelect(env.id)
        }}
      />

      <EditEnvironmentSheet
        environment={editEnv}
        open={editEnv !== null}
        onOpenChange={(open) => { if (!open) setEditEnv(null) }}
        onSave={updateEnvironment}
      />
    </div>
  )
}

// ── List table (extracted) ─────────────────────────────────────────────────────

function EnvironmentListTable({
  environments,
  onSelect,
  onEdit,
  onDelete,
}: {
  environments: CaseSpace[]
  onSelect: (id: string) => void
  onEdit: (env: CaseSpace) => void
  onDelete: (id: string) => void
}) {
  return (
    <div className="rounded-xl border overflow-hidden">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="border-b bg-muted/40">
            <th className="text-left text-[11px] font-medium text-muted-foreground tracking-wide px-4 py-2.5">Name</th>
            <th className="text-left text-[11px] font-medium text-muted-foreground tracking-wide px-3 py-2.5 hidden sm:table-cell">Type</th>
            <th className="text-left text-[11px] font-medium text-muted-foreground tracking-wide px-3 py-2.5">Modules</th>
            <th className="text-left text-[11px] font-medium text-muted-foreground tracking-wide px-3 py-2.5 hidden md:table-cell">Last opened</th>
            <th className="px-3 py-2.5 w-16" />
          </tr>
        </thead>
        <tbody>
          {environments.map((env, i) => {
            const modules = resolveEnvironmentModules(env.vaultModuleIds)
            const color = env.color ?? '#627DBD'
            return (
              <tr key={env.id}
                className={`cursor-pointer hover:bg-muted/30 transition-colors ${i > 0 ? 'border-t' : ''}`}
                onClick={() => onSelect(env.id)}
              >
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2.5">
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
                    <span className="font-medium text-foreground">{env.name}</span>
                  </div>
                  {env.description && (
                    <p className="text-xs text-muted-foreground mt-0.5 ml-4.5 truncate max-w-xs">{env.description}</p>
                  )}
                </td>
                <td className="px-3 py-3 hidden sm:table-cell">
                  <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground capitalize">
                    {env.type === 'vault' ? 'Municipal' : env.type === 'stay' ? 'Hospitality' : env.type ?? 'workspace'}
                  </span>
                </td>
                <td className="px-3 py-3">
                  {modules.length > 0 ? (
                    <div className="flex items-center gap-1.5">
                      <Cube size={11} className="text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">{modules.length}</span>
                      <span className="text-[10px] text-muted-foreground/60 hidden lg:inline">
                        {modules.slice(0, 3).map(m => m.label).join(' · ')}
                        {modules.length > 3 ? ` +${modules.length - 3}` : ''}
                      </span>
                    </div>
                  ) : (
                    <span className="text-xs text-muted-foreground/40">—</span>
                  )}
                </td>
                <td className="px-3 py-3 hidden md:table-cell text-xs text-muted-foreground">
                  {env.lastAccessed ? formatRelative(env.lastAccessed) : '—'}
                </td>
                <td className="px-3 py-3 text-right">
                  <div className="flex items-center gap-1 justify-end" onClick={e => e.stopPropagation()}>
                    <button
                      className="w-6 h-6 rounded flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-all"
                      onClick={() => onEdit(env)}
                      title="Edit"
                    >
                      <PencilSimple size={12} />
                    </button>
                    <button
                      className="w-6 h-6 rounded flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all"
                      onClick={() => onDelete(env.id)}
                      title="Delete"
                    >
                      <span className="text-xs leading-none">×</span>
                    </button>
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
