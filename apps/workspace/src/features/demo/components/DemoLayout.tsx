import { useState, type ReactNode } from 'react';
import { Scale, BarChart3, BookOpen, Eye, Menu, X, Bell, FileCode, Workflow, ChevronDown } from 'lucide-react';
import { MOCK_WATCH_FLAGS, CURRENT_USER } from '../data/mockData';
import { WatchPanel } from './WatchPanel';
import { useTown } from '../data/townContext';

type DemoPage = 'logicdash' | 'desk' | 'case' | 'governance' | 'processes' | 'forms';

interface DemoLayoutProps {
  page: DemoPage;
  navigate: (p: DemoPage, id?: string) => void;
  children: ReactNode;
}

export function DemoLayout({ page, navigate, children }: DemoLayoutProps) {
  const { currentTown, setCurrentTown, allTowns } = useTown();
  const [showWatch, setShowWatch] = useState(false);
  const [mobileNav, setMobileNav] = useState(false);
  const [showTownPicker, setShowTownPicker] = useState(false);

  const activeFlags = MOCK_WATCH_FLAGS.filter(f => !f.resolvedAt);

  const navItems: { page: DemoPage; label: string; icon: React.FC<{ className?: string }> }[] = [
    { page: 'logicdash', label: 'LogicDash', icon: BarChart3 },
    { page: 'desk', label: 'Case Desk', icon: BookOpen },
    { page: 'governance', label: 'Governance Engine', icon: Scale },
    { page: 'processes', label: 'Processes', icon: FileCode },
    { page: 'forms', label: 'Public Forms', icon: Workflow },
  ];

  const handleFlagAction = (flag: typeof MOCK_WATCH_FLAGS[0]) => {
    if (flag.caseId) {
      navigate('case', flag.caseId);
    }
    setShowWatch(false);
  };

  const healthDot = { healthy: 'bg-[#97BC62]', degraded: 'bg-[#B8911E]', down: 'bg-[#B84020]' }[currentTown.health.pjStatus];
  const activePage = page === 'case' ? 'desk' : page;

  return (
    <div className="min-h-screen bg-[#F5F1E8]">
      {/* Top bar */}
      <header className="bg-[#2C5F2D] text-white sticky top-0 z-30">
        <div className="flex items-center justify-between px-4 lg:px-6 h-14">
          <div className="flex items-center gap-3">
            <button onClick={() => setMobileNav(!mobileNav)} className="lg:hidden">
              {mobileNav ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
            <button onClick={() => navigate('logicdash')} className="flex items-center gap-2">
              <div className="w-7 h-7 rounded bg-white/20 flex items-center justify-center">
                <Scale className="w-4 h-4" />
              </div>
              <span className="text-lg tracking-tight">Work<span className="opacity-70">space</span></span>
            </button>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/15 text-white/80 font-mono">DEMO</span>

            {/* Town Selector */}
            <span className="hidden md:inline text-xs opacity-40 mx-1">|</span>
            <div className="relative hidden md:block">
              <button
                onClick={() => setShowTownPicker(!showTownPicker)}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg hover:bg-white/10 transition-colors"
              >
                <div className={`w-2 h-2 rounded-full ${healthDot}`} />
                <span className="text-xs">{currentTown.name}</span>
                <ChevronDown className="w-3 h-3 opacity-60" />
              </button>
              {showTownPicker && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowTownPicker(false)} />
                  <div className="absolute top-full left-0 mt-1 w-72 bg-white rounded-lg shadow-xl border border-[#DDD8CE] z-50 overflow-hidden">
                    <div className="p-2 border-b border-[#DDD8CE] bg-[#F5F2EC]">
                      <p className="text-[10px] text-[#7A7870] uppercase tracking-wider">Switch Environment</p>
                    </div>
                    <div className="max-h-64 overflow-y-auto">
                      {allTowns.map(town => {
                        const hd = { healthy: 'bg-[#97BC62]', degraded: 'bg-[#B8911E]', down: 'bg-gray-300' }[town.health.pjStatus];
                        const isCurrent = town.id === currentTown.id;
                        return (
                          <button
                            key={town.id}
                            onClick={() => { setCurrentTown(town); setShowTownPicker(false); }}
                            className={`w-full text-left px-3 py-2.5 flex items-center gap-3 hover:bg-[#F5F2EC] transition-colors ${isCurrent ? 'bg-[#E8F2EB]' : ''}`}
                          >
                            <div className={`w-2.5 h-2.5 rounded-full ${hd} shrink-0`} />
                            <div className="min-w-0 flex-1">
                              <p className={`text-sm ${isCurrent ? 'text-[#2C5F2D]' : 'text-[#1A1D16]'}`}>{town.name}</p>
                              <p className="text-[10px] text-[#7A7870]">{town.county} · {town.modules.length} modules · {town.plan}</p>
                            </div>
                            {!town.active && <span className="text-[8px] px-1 py-0.5 bg-gray-100 text-[#7A7870] rounded">OFFLINE</span>}
                            {isCurrent && <span className="text-[8px] px-1 py-0.5 bg-[#2C5F2D] text-white rounded">ACTIVE</span>}
                          </button>
                        );
                      })}
                    </div>
                    <div className="p-2 border-t border-[#DDD8CE] text-center">
                      <p className="text-[10px] text-[#7A7870]">VAULT Framework-as-a-Standard™ · {allTowns.length} environments</p>
                    </div>
                  </div>
                </>
              )}
            </div>
            <span className="hidden lg:inline text-[10px] opacity-40 px-1.5 py-0.5 rounded bg-white/10">{currentTown.plan}</span>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => setShowWatch(!showWatch)}
              className={`relative flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors ${showWatch ? 'bg-white/20' : 'hover:bg-white/10'}`}
            >
              <Eye className="w-4 h-4" />
              <span className="hidden sm:inline">Watch</span>
              {activeFlags.length > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-[#B84020] text-white text-[10px] rounded-full flex items-center justify-center">
                  {activeFlags.length}
                </span>
              )}
            </button>

            <div className="flex items-center gap-2 pl-3 ml-2 border-l border-white/20">
              <div className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center text-[10px]">
                {CURRENT_USER.name.split(' ').map(n => n[0]).join('')}
              </div>
              <div className="hidden sm:block">
                <p className="text-xs leading-tight">{CURRENT_USER.name}</p>
                <p className="text-[10px] opacity-60">{CURRENT_USER.roleDisplay}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className={`${mobileNav ? 'block' : 'hidden'} lg:block border-t border-white/10`}>
          <div className="flex items-center gap-0.5 px-4 lg:px-6 overflow-x-auto">
            {navItems.map(item => {
              const isActive = activePage === item.page;
              return (
                <button
                  key={item.page}
                  onClick={() => { navigate(item.page); setMobileNav(false); }}
                  className={`flex items-center gap-1.5 px-3 py-2.5 text-sm transition-colors border-b-2 whitespace-nowrap ${
                    isActive ? 'border-[#97BC62] text-white' : 'border-transparent text-white/50 hover:text-white/80'
                  }`}
                >
                  <item.icon className="w-3.5 h-3.5" />
                  {item.label}
                </button>
              );
            })}
          </div>
        </nav>
      </header>

      <div className="flex relative">
        {/* Main content */}
        <main className={`flex-1 p-4 lg:p-6 max-w-[1400px] mx-auto w-full transition-all duration-300 ${showWatch ? 'lg:mr-[380px]' : ''}`}>
          {children}
        </main>

        {/* Watch Layer sidebar */}
        {showWatch && (
          <>
            <div className="fixed inset-0 bg-black/30 z-40 lg:hidden" onClick={() => setShowWatch(false)} />
            <aside className="fixed right-0 top-0 h-full w-[380px] max-w-[90vw] bg-white border-l border-[#DDD8CE] shadow-xl z-40 flex flex-col">
              <div className="flex items-center justify-between p-4 border-b border-[#DDD8CE] bg-[#F5F2EC]">
                <div className="flex items-center gap-2">
                  <Bell className="w-4 h-4 text-[#2C5F2D]" />
                  <h3 className="text-[#1A1D16]">What Needs Attention</h3>
                  {activeFlags.length > 0 && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[#B84020] text-white">{activeFlags.length}</span>
                  )}
                </div>
                <button onClick={() => setShowWatch(false)} className="text-[#7A7870] hover:text-[#1A1D16]">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-3">
                <WatchPanel flags={MOCK_WATCH_FLAGS} onFlagAction={handleFlagAction} />
              </div>
              <div className="p-3 border-t border-[#DDD8CE] text-[10px] text-[#7A7870] text-center">
                Watch Layer · {currentTown.name} · Runs every 15 min · Last run: {new Date().toLocaleTimeString()}
              </div>
            </aside>
          </>
        )}
      </div>
    </div>
  );
}
