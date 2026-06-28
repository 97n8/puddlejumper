import { useState } from 'react'
import {
  Shield,
  Bell,
  ChartBar,
  FolderOpen,
  FileText,
  Gavel,
  Buildings,
  ClipboardText,
  ArrowLeft,
  List,
  X,
  CaretLeft,
  Package,
  Table,
} from '@phosphor-icons/react'
import type { Icon } from '@phosphor-icons/react'
import type { Municipality } from '@/data/maMunicipalities'
import type { GeneratedTownData } from '../data/generator'
import { Dashboard } from './Dashboard'
import { CaseDesk } from './CaseDesk'
import { RecordsPanel } from './RecordsPanel'
import { OrgPanel } from './OrgPanel'
import { WatchPanel } from './WatchPanel'
import { TemplatesPanel } from './TemplatesPanel'
import { FormsPanel } from './FormsPanel'
import { WorkbookPanel } from './WorkbookPanel'
import { GovernanceEngine } from '@/features/demo/components/GovernanceEngine'

type PageKey = 'dashboard' | 'cases' | 'records' | 'compliance' | 'org' | 'forms' | 'watch' | 'templates' | 'workbook'

interface NavItem {
  key: PageKey
  label: string
  icon: Icon
}

const NAV_ITEMS: NavItem[] = [
  { key: 'dashboard', label: 'Dashboard', icon: ChartBar },
  { key: 'cases', label: 'Cases', icon: FolderOpen },
  { key: 'records', label: 'Records', icon: FileText },
  { key: 'compliance', label: 'Compliance', icon: Gavel },
  { key: 'org', label: 'Organization', icon: Buildings },
  { key: 'forms', label: 'Forms', icon: ClipboardText },
  { key: 'templates', label: 'Templates', icon: Package },
  { key: 'workbook', label: 'Registry', icon: Table },
]

interface VaultLayoutProps {
  town: Municipality
  townData: GeneratedTownData
  onChangeTown: () => void
}

export function VaultLayout({ town, townData, onChangeTown }: VaultLayoutProps) {
  const [page, setPage] = useState<PageKey>('dashboard')
  const [showWatch, setShowWatch] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [watchFlags, setWatchFlags] = useState(townData.watchFlags)

  const activeCount = watchFlags.filter(f => !f.resolvedAt).length

  function handleResolveFlag(id: string) {
    setWatchFlags(prev =>
      prev.map(f => f.id === id ? { ...f, resolvedAt: new Date().toISOString() } : f)
    )
  }

  function renderPage() {
    switch (page) {
      case 'dashboard':
        return <Dashboard town={town} townData={{ ...townData, watchFlags }} />
      case 'cases':
        return <CaseDesk townData={townData} />
      case 'records':
        return <RecordsPanel townData={townData} />
      case 'compliance':
        return (
          <div className="flex-1 min-h-0 overflow-y-auto" style={{ backgroundColor: '#F5F1E8' }}>
            <div className="px-6 pt-6 pb-2">
              <h1 className="text-xl font-semibold" style={{ color: '#1A1D16' }}>Governance Engine</h1>
              <p className="text-sm mt-1" style={{ color: '#7A7870' }}>MGL process rules, hard stops, and compliance engine for {town.name}</p>
            </div>
            <GovernanceEngine />
          </div>
        )
      case 'org':
        return <OrgPanel townData={townData} />
      case 'forms':
        return <FormsPanel townData={townData} municipality={town} />
      case 'templates':
        return <TemplatesPanel town={town} />
      case 'workbook':
        return <WorkbookPanel />
      case 'watch':
        return (
          <div className="p-6">
            <WatchPanel flags={watchFlags} onResolve={handleResolveFlag} />
          </div>
        )
      default:
        return <Dashboard town={town} townData={{ ...townData, watchFlags }} />
    }
  }

  return (
    <div className="h-screen flex flex-col overflow-hidden" style={{ backgroundColor: '#F5F1E8' }}>
      {/* Top bar */}
      <header
        className="h-14 flex items-center justify-between px-4 shrink-0 z-30"
        style={{ backgroundColor: '#2C5F2D', color: '#fff' }}
      >
        {/* Left */}
        <div className="flex items-center gap-3">
          <button
            className="md:hidden text-white"
            onClick={() => setMobileOpen(v => !v)}
          >
            {mobileOpen ? <X size={22} /> : <List size={22} />}
          </button>
          <Shield size={22} weight="fill" />
          <span className="font-mono font-bold text-sm tracking-wider hidden sm:block">VAULT MGL-001</span>
          <span className="text-[10px] px-2 py-0.5 rounded-full font-bold" style={{ backgroundColor: '#97BC62', color: '#1A1D16' }}>
            LIVE DEMO
          </span>
        </div>

        {/* Middle */}
        <div className="hidden md:flex items-center gap-2">
          <span className="text-sm font-medium">{town.name}</span>
          <button
            onClick={onChangeTown}
            className="flex items-center gap-1 text-xs px-2 py-1 rounded opacity-70 hover:opacity-100 transition"
            style={{ backgroundColor: 'rgba(255,255,255,0.15)' }}
          >
            <CaretLeft size={12} />
            Switch
          </button>
        </div>

        {/* Right */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowWatch(v => !v)}
            className="relative"
          >
            <Bell size={20} color="#fff" />
            {activeCount > 0 && (
              <span
                className="absolute -top-1 -right-1 text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center"
                style={{ backgroundColor: '#B84020', color: '#fff' }}
              >
                {activeCount}
              </span>
            )}
          </button>
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold"
            style={{ backgroundColor: '#97BC62', color: '#1A1D16' }}
          >
            {town.name.charAt(0)}
          </div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden relative">
        {/* Mobile overlay */}
        {mobileOpen && (
          <div
            className="fixed inset-0 z-20 bg-black/40 md:hidden"
            onClick={() => setMobileOpen(false)}
          />
        )}

        {/* Sidebar */}
        <aside
          className={`
            fixed md:relative z-20 md:z-auto
            w-48 h-full flex flex-col
            transition-transform duration-200
            ${mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
          `}
          style={{ backgroundColor: '#1E4220', color: '#fff' }}
        >
          <nav className="flex-1 py-4 overflow-y-auto">
            {NAV_ITEMS.map(item => {
              const Icon = item.icon
              const active = page === item.key
              return (
                <button
                  key={item.key}
                  onClick={() => { setPage(item.key); setMobileOpen(false) }}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors ${active ? 'font-semibold' : 'opacity-70 hover:opacity-100'}`}
                  style={{ backgroundColor: active ? 'rgba(151,188,98,0.25)' : undefined, borderLeft: active ? '3px solid #97BC62' : '3px solid transparent' }}
                >
                  <Icon size={18} />
                  {item.label}
                  {item.key === 'watch' && activeCount > 0 && (
                    <span className="ml-auto text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center" style={{ backgroundColor: '#B84020' }}>
                      {activeCount}
                    </span>
                  )}
                </button>
              )
            })}

            {/* Watch in sidebar */}
            <button
              onClick={() => { setPage('watch'); setMobileOpen(false) }}
              className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors ${page === 'watch' ? 'font-semibold' : 'opacity-70 hover:opacity-100'}`}
              style={{ backgroundColor: page === 'watch' ? 'rgba(151,188,98,0.25)' : undefined, borderLeft: page === 'watch' ? '3px solid #97BC62' : '3px solid transparent' }}
            >
              <Bell size={18} />
              Watch
              {activeCount > 0 && (
                <span className="ml-auto text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center" style={{ backgroundColor: '#B84020' }}>
                  {activeCount}
                </span>
              )}
            </button>
          </nav>

          {/* Bottom: change town */}
          <div className="p-4 border-t" style={{ borderColor: 'rgba(255,255,255,0.1)' }}>
            <button
              onClick={onChangeTown}
              className="flex items-center gap-2 text-xs opacity-60 hover:opacity-100 transition"
            >
              <ArrowLeft size={14} />
              Change Town
            </button>
          </div>
        </aside>

        {/* Main content */}
        <main className="flex-1 overflow-y-auto">
          {renderPage()}
        </main>

        {/* Watch slide-out panel */}
        {showWatch && (
          <>
            <div
              className="fixed inset-0 z-30 bg-black/20"
              onClick={() => setShowWatch(false)}
            />
            <div
              className="fixed right-0 top-14 bottom-0 w-80 z-40 overflow-y-auto shadow-xl"
              style={{ backgroundColor: '#F5F1E8' }}
            >
              <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: '#DDD8CE' }}>
                <span className="font-semibold text-sm" style={{ color: '#1A1D16' }}>Watch Flags</span>
                <button onClick={() => setShowWatch(false)}>
                  <X size={18} style={{ color: '#7A7870' }} />
                </button>
              </div>
              <div className="p-4">
                <WatchPanel flags={watchFlags} onResolve={handleResolveFlag} />
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
