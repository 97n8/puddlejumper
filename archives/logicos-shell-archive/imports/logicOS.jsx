import { useState, useEffect, useRef, useMemo } from 'react';
import { Plus, Search, Settings, ChevronRight, ChevronLeft, Check, Circle, Inbox, FileText, Briefcase, Bot, Code, BookOpen, Cloud, Zap, Send, X, Edit2, Trash2, Save, Cog, Link2, Wifi, WifiOff, ArrowUpRight, MessageSquare, Folder, Pin, MoreVertical, Calendar, MapPin, User, Tag, Filter, RefreshCw, ExternalLink, Database, GitBranch, Hammer, Eye, Lock, Unlock, AlertCircle, CheckCircle2, Clock, Star, Archive, Home, Layers, Command, Sparkles, ArrowUp, ChevronUp, Activity, Mic, Paperclip } from 'lucide-react';

// ─── persistent storage ────────────────────────────────────────────
const Store = {
  async get(key, fallback = null) {
    try {
      if (window.storage) {
        const r = await window.storage.get(key);
        return r ? JSON.parse(r.value) : fallback;
      }
    } catch (e) {}
    try {
      const v = localStorage.getItem(key);
      return v ? JSON.parse(v) : fallback;
    } catch (e) { return fallback; }
  },
  async set(key, value) {
    const s = JSON.stringify(value);
    try { if (window.storage) await window.storage.set(key, s); } catch (e) {}
    try { localStorage.setItem(key, s); } catch (e) {}
  }
};

// ─── haptic helper ─────────────────────────────────────────────────
const haptic = (kind = 'tick') => {
  try {
    if (navigator.vibrate) {
      const map = { tick: 8, soft: 12, success: [10, 30, 10], warn: [20, 40, 20] };
      navigator.vibrate(map[kind] || 8);
    }
  } catch (e) {}
};

// ─── default config ────────────────────────────────────────────────
const DEFAULT_ENDPOINTS = {
  puddleJumper: 'https://pj.publiclogic.org',
  logicOS: 'https://os.publiclogic.org',
  logicCommons: 'https://commons.publiclogic.org',
  vaultIntake: 'https://pj.publiclogic.org/api/vault/intake',
  policyAPI: 'https://malegislature.gov/api',
  aiEnabled: true
};

const TOOL_CATALOG = [
  { id: 'capture',  name: 'Capture',  icon: Inbox,    desc: 'One-tap into 0_INBOX' },
  { id: 'docket',   name: 'Docket',   icon: Check,    desc: 'Tasks for this case' },
  { id: 'notes',    name: 'Notes',    icon: FileText, desc: 'Long-form drafting' },
  { id: 'ai',       name: 'AI',       icon: Bot,      desc: 'Claude-powered chat' },
  { id: 'code',     name: 'Code',     icon: Code,     desc: 'JS scratchpad' },
  { id: 'policy',   name: 'Policy',   icon: BookOpen, desc: 'MGL, regs, bylaws' },
  { id: 'files',    name: 'Files',    icon: Folder,   desc: 'Case attachments' },
  { id: 'timeline', name: 'Timeline', icon: Clock,    desc: 'Event log' },
  { id: 'people',   name: 'People',   icon: User,     desc: 'Contacts' }
];

const CONNECTION_CATALOG = [
  { id: 'pj',      name: 'PuddleJumper',  icon: Database,  desc: 'Backend' },
  { id: 'vault',   name: 'VAULT',         icon: Lock,      desc: 'Governance' },
  { id: 'commons', name: 'Logic Commons', icon: GitBranch, desc: 'Library' },
  { id: 'gdrive',  name: 'Google Drive',  icon: Cloud,     desc: 'Docs' },
  { id: 'gmail',   name: 'Gmail',         icon: Send,      desc: 'Email' },
  { id: 'm365',    name: 'M365',          icon: Briefcase, desc: 'Business' },
  { id: 'cal',     name: 'Calendar',      icon: Calendar,  desc: 'Scheduling' },
  { id: 'icloud',  name: 'iCloud',        icon: Cloud,     desc: 'Personal' }
];

const AI_INTEGRATIONS = [
  { id: 'claude',   name: 'Claude (Sonnet)', desc: 'General reasoning' },
  { id: 'claude-h', name: 'Claude (Haiku)',  desc: 'Fast lookups' },
  { id: 'web',      name: 'Web Search',      desc: 'Live research' }
];

const SEED_CASES = [
  { id: 'c-2nd-worcester', name: '2nd Worcester \u00b7 Field Ops', kicker: 'Campaign', color: '#7a3329', pinned: true, tools: ['capture','docket','notes','people','timeline'], connections: ['gdrive','gmail','cal'], ai: ['claude','web'], lastOpened: Date.now() - 3600000 },
  { id: 'c-permit-bridge', name: 'Permit&Bridge', kicker: 'PL Service', color: '#4a6741', pinned: true, tools: ['capture','notes','code','policy','files'], connections: ['pj','vault','commons','m365'], ai: ['claude'], lastOpened: Date.now() - 7200000 },
  { id: 'c-phillipston', name: 'Phillipston \u00b7 Web Central', kicker: 'Client', color: '#1f4e6b', pinned: false, tools: ['capture','docket','notes','files','timeline'], connections: ['m365','gmail','commons'], ai: ['claude'], lastOpened: Date.now() - 86400000 },
  { id: 'c-kendall', name: 'Kendall Pond STR', kicker: 'Personal', color: '#7d6228', pinned: false, tools: ['capture','docket','files'], connections: ['icloud','cal'], ai: ['claude-h'], lastOpened: Date.now() - 172800000 },
  { id: 'c-pl-ops', name: 'PublicLogic \u00b7 Ops', kicker: 'PL Internal', color: '#3a4350', pinned: false, tools: ['capture','docket','notes','code','files'], connections: ['pj','vault','commons','gdrive','m365'], ai: ['claude','web'], lastOpened: Date.now() - 259200000 }
];

const SEED_DOCKET = [
  { id: 't1', text: 'Walk lists \u00b7 Templeton precinct 2', caseId: 'c-2nd-worcester', done: false },
  { id: 't2', text: 'Permit&Bridge intake form review', caseId: 'c-permit-bridge', done: false },
  { id: 't3', text: 'Phillipston site QA \u00b7 Web Central migration', caseId: 'c-phillipston', done: false },
  { id: 't4', text: 'STR linen vendor confirm', caseId: 'c-kendall', done: true },
  { id: 't5', text: 'OCPF Q2 reconciliation draft', caseId: 'c-2nd-worcester', done: false },
  { id: 't6', text: 'VAULT framework \u2014 encoding boundary memo', caseId: 'c-pl-ops', done: false }
];

// ═══════════════════════════════════════════════════════════════════
// MAIN APP
// ═══════════════════════════════════════════════════════════════════
export default function App() {
  const [tab, setTab] = useState('today');
  const [activeCaseId, setActiveCaseId] = useState(null);
  const [endpoints, setEndpoints] = useState(DEFAULT_ENDPOINTS);
  const [cases, setCases] = useState(SEED_CASES);
  const [docket, setDocket] = useState(SEED_DOCKET);
  const [inbox, setInbox] = useState([]);
  const [pjStatus, setPjStatus] = useState('unknown');
  const [loaded, setLoaded] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => {
    (async () => {
      const e = await Store.get('logicos:endpoints', DEFAULT_ENDPOINTS);
      const c = await Store.get('logicos:cases', SEED_CASES);
      const d = await Store.get('logicos:docket', SEED_DOCKET);
      const i = await Store.get('logicos:inbox', []);
      setEndpoints(e); setCases(c); setDocket(d); setInbox(i);
      setLoaded(true);
    })();
  }, []);

  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setPaletteOpen(o => !o);
        haptic('soft');
      }
      if (e.key === 'Escape') {
        setPaletteOpen(false);
        setSettingsOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const persistEndpoints = (e) => { setEndpoints(e); Store.set('logicos:endpoints', e); };
  const persistCases = (c) => { setCases(c); Store.set('logicos:cases', c); };
  const persistDocket = (d) => { setDocket(d); Store.set('logicos:docket', d); };
  const persistInbox = (i) => { setInbox(i); Store.set('logicos:inbox', i); };

  const openCase = (id) => {
    persistCases(cases.map(c => c.id === id ? { ...c, lastOpened: Date.now() } : c));
    setActiveCaseId(id);
    haptic('tick');
  };

  useEffect(() => {
    if (!loaded) return;
    const probe = async () => {
      try {
        const ctrl = new AbortController();
        setTimeout(() => ctrl.abort(), 3000);
        await fetch(endpoints.puddleJumper, { mode: 'no-cors', signal: ctrl.signal });
        setPjStatus('online');
      } catch (e) { setPjStatus('offline'); }
    };
    probe();
    const t = setInterval(probe, 30000);
    return () => clearInterval(t);
  }, [endpoints.puddleJumper, loaded]);

  const activeCase = cases.find(c => c.id === activeCaseId);

  if (!loaded) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-100" style={{fontFamily: '"Source Serif 4", Georgia, serif'}}>
        <div className="text-stone-500 italic">loading\u2026</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-stone-100" style={{
      fontFamily: '"Source Sans 3", -apple-system, sans-serif',
      backgroundImage: 'radial-gradient(ellipse at top, rgba(255,250,240,0.6), transparent 70%), radial-gradient(ellipse at bottom, rgba(122,51,41,0.04), transparent 60%)'
    }}>
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Source+Serif+4:opsz,wght@8..60,400;8..60,500;8..60,600;8..60,700&family=Source+Sans+3:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap" />

      <div className="lg:flex lg:items-center lg:justify-center lg:min-h-screen lg:p-6 lg:bg-stone-300">
        <div className="lg:w-[412px] lg:h-[892px] lg:rounded-[44px] lg:overflow-hidden lg:shadow-2xl lg:ring-1 lg:ring-black/10 lg:border-[12px] lg:border-stone-800 bg-stone-100 flex flex-col min-h-screen lg:min-h-0 relative">

          <StatusBar pjStatus={pjStatus} />

          {activeCase ? (
            <CaseWorkspace
              caseData={activeCase}
              cases={cases} setCases={persistCases}
              docket={docket} setDocket={persistDocket}
              inbox={inbox} setInbox={persistInbox}
              endpoints={endpoints}
              onBack={() => { setActiveCaseId(null); haptic('tick'); }}
            />
          ) : (
            <>
              {tab === 'today' && (
                <TodayView
                  docket={docket} setDocket={persistDocket}
                  cases={cases} setCases={persistCases}
                  inbox={inbox} setInbox={persistInbox}
                  endpoints={endpoints}
                  onOpenCase={openCase}
                  onOpenPalette={() => setPaletteOpen(true)}
                />
              )}
              {tab === 'cases' && (
                <CasesView
                  cases={cases} setCases={persistCases}
                  docket={docket}
                  onOpen={openCase}
                />
              )}
              {tab === 'search' && (
                <SearchView
                  cases={cases} docket={docket} inbox={inbox}
                  onOpenCase={openCase}
                  setDocket={persistDocket}
                />
              )}
              {tab === 'ai' && (
                <QuickAIView endpoints={endpoints} cases={cases} />
              )}
            </>
          )}

          {!activeCase && (
            <BottomNav
              tab={tab}
              onTab={(t) => { setTab(t); haptic('tick'); }}
              onSettings={() => setSettingsOpen(true)}
            />
          )}

          {paletteOpen && (
            <CommandPalette
              cases={cases} docket={docket} inbox={inbox}
              onClose={() => setPaletteOpen(false)}
              onOpenCase={(id) => { setPaletteOpen(false); openCase(id); }}
              onSwitchTab={(t) => { setPaletteOpen(false); setTab(t); }}
              onAddTask={(text, caseId) => {
                persistDocket([...docket, { id: 't'+Date.now(), text, caseId, done: false }]);
                setPaletteOpen(false);
                haptic('success');
              }}
              onAddCapture={async (text, caseId) => {
                const item = { id: 'i'+Date.now(), ts: Date.now(), text, caseId: caseId || null, sentToVault: false };
                const next = [item, ...inbox];
                persistInbox(next);
                setPaletteOpen(false);
                haptic('success');
                try {
                  await fetch(endpoints.vaultIntake, {
                    method: 'POST', mode: 'no-cors',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ source: 'logicOS', ...item })
                  });
                  persistInbox(next.map(i => i.id === item.id ? { ...i, sentToVault: true } : i));
                } catch (e) {}
              }}
              onOpenSettings={() => { setPaletteOpen(false); setSettingsOpen(true); }}
            />
          )}

          {settingsOpen && (
            <SettingsDrawer
              endpoints={endpoints} setEndpoints={persistEndpoints}
              pjStatus={pjStatus}
              onClose={() => setSettingsOpen(false)}
            />
          )}

          {!activeCase && tab !== 'ai' && (
            <button
              onClick={() => { setTab('ai'); haptic('tick'); }}
              className="absolute bottom-24 right-5 w-14 h-14 rounded-full bg-stone-900 text-stone-50 shadow-2xl flex items-center justify-center active:scale-95 transition-transform z-30"
              style={{boxShadow: '0 12px 32px rgba(0,0,0,0.3), 0 0 0 4px rgba(122,51,41,0.15)'}}
              aria-label="Quick AI"
            >
              <Sparkles size={22} />
            </button>
          )}

        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// STATUS BAR
// ═══════════════════════════════════════════════════════════════════
function StatusBar({ pjStatus }) {
  const [now, setNow] = useState(new Date());
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 30000); return () => clearInterval(t); }, []);
  const time = `${now.getHours()}:${String(now.getMinutes()).padStart(2,'0')}`;

  return (
    <div className="h-11 px-7 flex items-center justify-between text-stone-900 font-semibold text-sm flex-shrink-0">
      <span className="font-mono">{time}</span>
      <div className="flex items-center gap-2">
        {pjStatus === 'online'  && <Wifi size={14} className="text-green-700" />}
        {pjStatus === 'offline' && <WifiOff size={14} className="text-stone-400" />}
        {pjStatus === 'unknown' && <Wifi size={14} className="text-stone-300" />}
        <span className="text-xs font-bold">5G</span>
        <div className="w-6 h-3 border-[1.5px] border-stone-900 rounded-sm relative">
          <div className="absolute inset-0.5 bg-stone-900 rounded-[1px] w-[78%]" />
          <div className="absolute -right-[3px] top-[3px] w-[2px] h-[6px] bg-stone-900 rounded-r-sm" />
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// BOTTOM NAV
// ═══════════════════════════════════════════════════════════════════
function BottomNav({ tab, onTab, onSettings }) {
  const items = [
    { id: 'today',  icon: Home,   label: 'Today' },
    { id: 'cases',  icon: Layers, label: 'Cases' },
    { id: 'search', icon: Search, label: 'Search' },
    { id: 'ai',     icon: Bot,    label: 'AI' }
  ];
  return (
    <div className="border-t border-stone-300 bg-[#fdfbf6]/95 backdrop-blur-md flex-shrink-0 pb-safe">
      <div className="flex">
        {items.map(item => {
          const Icon = item.icon;
          const active = tab === item.id;
          return (
            <button key={item.id} onClick={() => onTab(item.id)}
              className={`flex-1 py-2.5 flex flex-col items-center gap-0.5 active:bg-stone-200 transition-colors ${active ? 'text-[#7a3329]' : 'text-stone-500'}`}>
              <Icon size={20} strokeWidth={active ? 2.4 : 1.8} />
              <span className={`text-[10px] tracking-wider uppercase ${active ? 'font-bold' : 'font-semibold'}`}>{item.label}</span>
            </button>
          );
        })}
        <button onClick={onSettings} className="flex-1 py-2.5 flex flex-col items-center gap-0.5 active:bg-stone-200 text-stone-500">
          <Cog size={20} strokeWidth={1.8} />
          <span className="text-[10px] tracking-wider uppercase font-semibold">Set</span>
        </button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// MASTHEAD
// ═══════════════════════════════════════════════════════════════════
function Masthead({ subtitle, right, onPalette }) {
  const today = new Date().toLocaleDateString('en-US', { weekday:'long', month:'long', day:'numeric' });
  return (
    <div className="px-6 pt-2 pb-4 border-b-2 border-stone-900 relative flex-shrink-0">
      <div className="absolute left-6 right-6 -bottom-[5px] h-px bg-stone-900" />
      <div className="flex items-baseline justify-between">
        <div>
          <div className="text-[10px] font-bold tracking-[0.22em] text-stone-500 uppercase">PublicLogic</div>
          <h1 className="text-3xl font-semibold tracking-tight leading-none mt-0.5" style={{fontFamily: '"Source Serif 4", Georgia, serif'}}>
            logic<em className="text-[#7a3329] font-medium">OS</em>
          </h1>
        </div>
        <div className="flex items-center gap-1">
          {onPalette && (
            <button onClick={onPalette} className="px-2 py-1 border border-stone-300 rounded text-stone-500 active:bg-stone-200 flex items-center gap-1" aria-label="Command palette">
              <Command size={12} />
              <span className="text-[10px] font-semibold uppercase tracking-wider">K</span>
            </button>
          )}
          {right}
        </div>
      </div>
      <div className="mt-2 flex items-center justify-between text-xs italic text-stone-500" style={{fontFamily: '"Source Serif 4", Georgia, serif'}}>
        <span>{today}</span>
        <span className="font-sans not-italic font-semibold tracking-wider uppercase text-[10px] text-stone-500">{subtitle}</span>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// SWIPEABLE ROW
// ═══════════════════════════════════════════════════════════════════
function SwipeRow({ children, onSwipeLeft, onSwipeRight, leftAction, rightAction }) {
  const [dx, setDx] = useState(0);
  const [animating, setAnimating] = useState(false);
  const startX = useRef(0);
  const startY = useRef(0);
  const moved = useRef(false);
  const isVertical = useRef(false);

  const onTouchStart = (e) => {
    startX.current = e.touches[0].clientX;
    startY.current = e.touches[0].clientY;
    moved.current = false;
    isVertical.current = false;
    setAnimating(false);
  };
  const onTouchMove = (e) => {
    const cx = e.touches[0].clientX - startX.current;
    const cy = e.touches[0].clientY - startY.current;
    if (!moved.current) {
      if (Math.abs(cy) > Math.abs(cx) + 4) isVertical.current = true;
      moved.current = true;
    }
    if (isVertical.current) return;
    setDx(Math.max(-160, Math.min(160, cx)));
  };
  const onTouchEnd = () => {
    setAnimating(true);
    if (dx > 80 && onSwipeRight) {
      setDx(400);
      setTimeout(() => { onSwipeRight(); setDx(0); haptic('success'); }, 180);
    } else if (dx < -80 && onSwipeLeft) {
      setDx(-400);
      setTimeout(() => { onSwipeLeft(); setDx(0); haptic('success'); }, 180);
    } else { setDx(0); }
  };

  return (
    <div className="relative overflow-hidden">
      {leftAction && dx > 0 && (
        <div className="absolute inset-y-0 left-0 flex items-center pl-4 bg-green-700 text-stone-50" style={{width: Math.abs(dx)}}>{leftAction}</div>
      )}
      {rightAction && dx < 0 && (
        <div className="absolute inset-y-0 right-0 flex items-center justify-end pr-4 bg-[#7a3329] text-stone-50" style={{width: Math.abs(dx)}}>{rightAction}</div>
      )}
      <div onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}
        style={{ transform: `translateX(${dx}px)`, transition: animating ? 'transform 180ms ease-out' : 'none' }}>
        {children}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// TODAY VIEW
// ═══════════════════════════════════════════════════════════════════
function TodayView({ docket, setDocket, cases, setCases, inbox, setInbox, endpoints, onOpenCase, onOpenPalette }) {
  const [captureText, setCaptureText] = useState('');
  const [captureCaseId, setCaptureCaseId] = useState('');

  const open = docket.filter(t => !t.done);
  const done = docket.filter(t => t.done);

  const smartCases = useMemo(() => {
    return [...cases].sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      return (b.lastOpened || 0) - (a.lastOpened || 0);
    });
  }, [cases]);

  const recentInbox = inbox.slice(0, 3);

  const toggleTask = (id) => { setDocket(docket.map(t => t.id === id ? { ...t, done: !t.done } : t)); haptic('success'); };
  const deleteTask = (id) => { setDocket(docket.filter(t => t.id !== id)); haptic('warn'); };

  const capture = async () => {
    if (!captureText.trim()) return;
    const item = { id: 'i'+Date.now(), ts: Date.now(), text: captureText.trim(), caseId: captureCaseId || null, sentToVault: false };
    const next = [item, ...inbox];
    setInbox(next); setCaptureText(''); setCaptureCaseId(''); haptic('success');
    try {
      await fetch(endpoints.vaultIntake, { method: 'POST', mode: 'no-cors', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ source: 'logicOS', ...item }) });
      setInbox(next.map(i => i.id === item.id ? { ...i, sentToVault: true } : i));
    } catch (e) {}
  };

  return (
    <>
      <Masthead subtitle={`${open.length} open \u00b7 ${inbox.length} inbox`} onPalette={onOpenPalette} />

      <div className="flex-1 overflow-y-auto pb-4" style={{scrollbarWidth: 'none'}}>
        {/* CAPTURE */}
        <div className="px-5 pt-4 pb-2">
          <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-stone-500 mb-2 px-1">Capture \u00b7 0_INBOX</div>
          <div className="bg-[#fdfbf6] border border-stone-300 rounded-xl p-3 shadow-sm">
            <textarea value={captureText} onChange={(e) => setCaptureText(e.target.value)}
              placeholder="Note, observation, decision\u2026"
              className="w-full bg-transparent border-0 resize-none text-base text-stone-900 placeholder-stone-400 placeholder:italic focus:outline-none min-h-[44px]"
              style={{fontFamily: '"Source Serif 4", Georgia, serif'}} rows={1} />
            <div className="mt-2 pt-2 border-t border-dashed border-stone-300 flex gap-2">
              <select value={captureCaseId} onChange={(e) => setCaptureCaseId(e.target.value)}
                className="flex-1 min-w-0 bg-transparent border border-stone-300 rounded px-2 py-1.5 text-xs font-semibold text-stone-700 focus:outline-none focus:border-[#7a3329]">
                <option value="">no case</option>
                {cases.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <button onClick={capture} disabled={!captureText.trim()}
                className="bg-[#7a3329] text-stone-50 px-3 py-1.5 rounded text-xs font-bold tracking-wide uppercase active:bg-[#5e271f] disabled:opacity-40 active:scale-95 transition-all flex items-center gap-1.5">
                <Send size={12} />Send
              </button>
            </div>
          </div>
        </div>

        {/* DOCKET */}
        <div className="px-5 pt-4">
          <div className="flex items-baseline justify-between mb-2 px-1">
            <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-stone-500">Today's Docket</div>
            <div className="text-[10px] font-semibold text-stone-500">{done.length}/{docket.length} \u00b7 swipe \u2194</div>
          </div>
          <div className="bg-[#fdfbf6] border border-stone-300 rounded-xl overflow-hidden">
            {open.length === 0 && done.length === 0 && (
              <div className="p-6 text-center italic text-stone-400 text-sm" style={{fontFamily: '"Source Serif 4", Georgia, serif'}}>\u2014 docket clear \u2014</div>
            )}
            {[...open, ...done].map((task, i, arr) => {
              const c = cases.find(x => x.id === task.caseId);
              return (
                <SwipeRow key={task.id}
                  onSwipeRight={() => toggleTask(task.id)}
                  onSwipeLeft={() => deleteTask(task.id)}
                  leftAction={<><Check size={16} /><span className="ml-2 text-xs font-bold uppercase tracking-wider">Done</span></>}
                  rightAction={<><span className="mr-2 text-xs font-bold uppercase tracking-wider">Delete</span><Trash2 size={16} /></>}>
                  <button onClick={() => toggleTask(task.id)}
                    className={`w-full flex items-start gap-3 px-4 py-3 bg-[#fdfbf6] active:bg-stone-50 text-left ${i < arr.length - 1 ? 'border-b border-stone-200' : ''}`}>
                    <div className={`w-4 h-4 mt-0.5 rounded border-[1.5px] flex-shrink-0 flex items-center justify-center ${task.done ? 'bg-green-700 border-green-700' : 'border-stone-400 bg-[#fdfbf6]'}`}>
                      {task.done && <Check size={10} className="text-stone-50" strokeWidth={3} />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className={`text-sm font-medium leading-snug ${task.done ? 'line-through text-stone-400' : 'text-stone-900'}`}>{task.text}</div>
                      {c && (
                        <div className="mt-1 inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-stone-500">
                          <span className="w-1.5 h-1.5 rounded-full" style={{background: c.color}} />
                          {c.name}
                        </div>
                      )}
                    </div>
                  </button>
                </SwipeRow>
              );
            })}
          </div>
        </div>

        {/* CASES GRID */}
        <div className="px-5 pt-5">
          <div className="flex items-baseline justify-between mb-2 px-1">
            <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-stone-500">Cases \u00b7 Recent</div>
            <div className="text-[10px] font-semibold text-stone-500">smart sort</div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {smartCases.slice(0, 4).map(c => {
              const taskCount = docket.filter(t => t.caseId === c.id && !t.done).length;
              const since = c.lastOpened ? formatRelative(c.lastOpened) : 'never';
              return (
                <button key={c.id} onClick={() => onOpenCase(c.id)}
                  className="bg-[#fdfbf6] border border-stone-300 rounded-xl p-3 text-left active:bg-stone-50 active:scale-[0.98] transition-all relative overflow-hidden">
                  <div className="absolute left-0 top-0 bottom-0 w-1" style={{background: c.color}} />
                  <div className="pl-2">
                    <div className="flex items-center gap-1 mb-1">
                      {c.pinned && <Pin size={9} className="text-[#7a3329] fill-[#7a3329]" />}
                      <div className="text-[10px] font-bold uppercase tracking-wider text-stone-500">{c.kicker}</div>
                    </div>
                    <div className="text-sm font-semibold leading-tight text-stone-900 mb-2" style={{fontFamily: '"Source Serif 4", Georgia, serif'}}>{c.name}</div>
                    <div className="flex items-center justify-between text-[10px] text-stone-500 font-semibold">
                      <span>{taskCount} open</span>
                      <span className="italic" style={{fontFamily: '"Source Serif 4", Georgia, serif'}}>{since}</span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* RECENT CAPTURES */}
        {recentInbox.length > 0 && (
          <div className="px-5 pt-5">
            <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-stone-500 mb-2 px-1">Recent Captures</div>
            <div className="bg-[#fdfbf6] border border-stone-300 rounded-xl overflow-hidden">
              {recentInbox.map((item, i) => {
                const c = cases.find(x => x.id === item.caseId);
                const t = new Date(item.ts);
                return (
                  <div key={item.id} className={`p-3 flex gap-3 ${i < recentInbox.length - 1 ? 'border-b border-stone-200' : ''}`}>
                    <div className="text-[10px] font-mono text-stone-400 pt-0.5 flex-shrink-0 w-12">
                      {`${t.getHours()}:${String(t.getMinutes()).padStart(2,'0')}`}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-stone-900 leading-snug" style={{fontFamily: '"Source Serif 4", Georgia, serif'}}>{item.text}</div>
                      <div className="mt-1 flex items-center gap-2 flex-wrap">
                        {c && (
                          <span className="inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider text-stone-600">
                            <span className="w-1.5 h-1.5 rounded-full" style={{background: c.color}} />
                            {c.name}
                          </span>
                        )}
                        <span className={`text-[9px] font-bold uppercase tracking-wider ${item.sentToVault ? 'text-green-700' : 'text-stone-400'}`}>
                          {item.sentToVault ? '\u2713 VAULT' : '\u23f3 Local'}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
        <div className="h-2" />
      </div>
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════
// CASES VIEW
// ═══════════════════════════════════════════════════════════════════
function CasesView({ cases, setCases, docket, onOpen }) {
  const [showNew, setShowNew] = useState(false);
  const [newName, setNewName] = useState('');
  const [newKicker, setNewKicker] = useState('');

  const togglePin = (id) => { setCases(cases.map(c => c.id === id ? { ...c, pinned: !c.pinned } : c)); haptic('tick'); };
  const removeCase = (id) => { setCases(cases.filter(c => c.id !== id)); haptic('warn'); };
  const addCase = () => {
    if (!newName.trim()) return;
    const c = { id: 'c-'+Date.now(), name: newName.trim(), kicker: newKicker.trim() || 'Case', color: '#3a4350', pinned: false, tools: ['capture','docket','notes'], connections: [], ai: ['claude'], lastOpened: Date.now() };
    setCases([c, ...cases]); setNewName(''); setNewKicker(''); setShowNew(false); haptic('success');
  };

  const sorted = [...cases].sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    return (b.lastOpened || 0) - (a.lastOpened || 0);
  });

  return (
    <>
      <Masthead subtitle={`${cases.length} cases \u00b7 ${cases.filter(c=>c.pinned).length} pinned`}
        right={
          <button onClick={() => { setShowNew(!showNew); haptic('tick'); }} className="p-2 -mr-2 active:bg-stone-200 rounded-lg">
            <Plus size={20} className="text-stone-700" />
          </button>
        } />

      <div className="flex-1 overflow-y-auto px-5 pt-4 pb-4" style={{scrollbarWidth: 'none'}}>
        {showNew && (
          <div className="bg-[#fdfbf6] border border-[#7a3329] rounded-xl p-4 mb-3">
            <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Case name"
              className="w-full bg-transparent border-b border-stone-300 pb-2 mb-2 text-base font-semibold focus:outline-none focus:border-[#7a3329]"
              style={{fontFamily: '"Source Serif 4", Georgia, serif'}} />
            <input value={newKicker} onChange={e => setNewKicker(e.target.value)} placeholder="Kicker (Campaign, Client, Personal\u2026)"
              className="w-full bg-transparent border-b border-stone-300 pb-2 mb-3 text-xs font-semibold uppercase tracking-wider focus:outline-none focus:border-[#7a3329]" />
            <div className="flex gap-2">
              <button onClick={() => setShowNew(false)} className="flex-1 py-2 border border-stone-300 rounded text-xs font-semibold uppercase tracking-wider text-stone-600">Cancel</button>
              <button onClick={addCase} className="flex-[1.5] py-2 bg-[#7a3329] text-stone-50 rounded text-xs font-bold uppercase tracking-wider active:scale-95 transition-transform">Create</button>
            </div>
          </div>
        )}

        {sorted.map(c => {
          const taskCount = docket.filter(t => t.caseId === c.id && !t.done).length;
          return (
            <SwipeRow key={c.id}
              onSwipeRight={() => togglePin(c.id)}
              onSwipeLeft={() => removeCase(c.id)}
              leftAction={<><Pin size={16} /><span className="ml-2 text-xs font-bold uppercase">{c.pinned ? 'Unpin' : 'Pin'}</span></>}
              rightAction={<><span className="mr-2 text-xs font-bold uppercase">Delete</span><Trash2 size={16} /></>}>
              <button onClick={() => onOpen(c.id)}
                className="w-full bg-[#fdfbf6] border border-stone-300 rounded-xl mb-2 overflow-hidden relative text-left active:bg-stone-50 active:scale-[0.99] transition-all">
                <div className="absolute left-0 top-0 bottom-0 w-1" style={{background: c.color}} />
                <div className="p-4 pl-5">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    {c.pinned && <Pin size={10} className="text-[#7a3329] fill-[#7a3329]" />}
                    <div className="text-[10px] font-bold uppercase tracking-wider text-stone-500">{c.kicker}</div>
                  </div>
                  <div className="text-base font-semibold text-stone-900 mb-1" style={{fontFamily: '"Source Serif 4", Georgia, serif'}}>{c.name}</div>
                  <div className="flex items-center gap-2 text-[10px] font-semibold text-stone-500">
                    <span>{taskCount} open</span><span>\u00b7</span>
                    <span>{c.tools.length} tools</span><span>\u00b7</span>
                    <span>{c.connections.length} connections</span>
                    <span className="ml-auto italic" style={{fontFamily: '"Source Serif 4", Georgia, serif'}}}>
                      {c.lastOpened ? formatRelative(c.lastOpened) : ''}
                    </span>
                  </div>
                </div>
              </button>
            </SwipeRow>
          );
        })}
      </div>
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════
// SEARCH VIEW
// ═══════════════════════════════════════════════════════════════════
function SearchView({ cases, docket, inbox, onOpenCase, setDocket }) {
  const [q, setQ] = useState('');
  const inputRef = useRef(null);
  useEffect(() => { inputRef.current?.focus(); }, []);

  const results = useMemo(() => {
    if (!q.trim()) return null;
    const term = q.toLowerCase();
    const m = (s) => s && s.toLowerCase().includes(term);
    return {
      cases: cases.filter(c => m(c.name) || m(c.kicker)),
      tasks: docket.filter(t => m(t.text)),
      inbox: inbox.filter(i => m(i.text))
    };
  }, [q, cases, docket, inbox]);

  return (
    <>
      <Masthead subtitle="Search \u00b7 cases \u00b7 tasks \u00b7 captures" />
      <div className="px-5 pt-4 pb-2 flex-shrink-0">
        <div className="bg-[#fdfbf6] border border-stone-300 rounded-xl flex items-center gap-2 px-3 py-2.5">
          <Search size={16} className="text-stone-400" />
          <input ref={inputRef} value={q} onChange={e => setQ(e.target.value)} placeholder="Search\u2026"
            className="flex-1 bg-transparent border-0 text-base focus:outline-none placeholder-stone-400"
            style={{fontFamily: '"Source Serif 4", Georgia, serif'}} />
          {q && <button onClick={() => setQ('')} className="p-1"><X size={14} className="text-stone-400" /></button>}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-5 pb-4" style={{scrollbarWidth: 'none'}}>
        {!q && (
          <div className="text-center py-12">
            <Search size={28} className="text-stone-300 mx-auto mb-3" />
            <div className="text-sm italic text-stone-400" style={{fontFamily: '"Source Serif 4", Georgia, serif'}}>Search across everything.</div>
          </div>
        )}

        {results && results.cases.length === 0 && results.tasks.length === 0 && results.inbox.length === 0 && (
          <div className="text-center py-8 text-stone-400 italic text-sm" style={{fontFamily: '"Source Serif 4", Georgia, serif'}}>no matches</div>
        )}

        {results?.cases.length > 0 && (
          <SectionHeader title={`Cases \u00b7 ${results.cases.length}`}>
            {results.cases.map(c => (
              <button key={c.id} onClick={() => onOpenCase(c.id)}
                className="w-full bg-[#fdfbf6] border border-stone-300 rounded-lg mb-1.5 p-3 flex items-center gap-3 active:bg-stone-50 text-left">
                <span className="w-2 h-8 rounded" style={{background: c.color}} />
                <div className="flex-1">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-stone-500">{c.kicker}</div>
                  <div className="text-sm font-semibold" style={{fontFamily: '"Source Serif 4", Georgia, serif'}}>{c.name}</div>
                </div>
                <ChevronRight size={16} className="text-stone-300" />
              </button>
            ))}
          </SectionHeader>
        )}

        {results?.tasks.length > 0 && (
          <SectionHeader title={`Tasks \u00b7 ${results.tasks.length}`}>
            {results.tasks.map(t => {
              const c = cases.find(x => x.id === t.caseId);
              return (
                <button key={t.id} onClick={() => { setDocket(docket.map(d => d.id === t.id ? { ...d, done: !d.done } : d)); haptic('success'); }}
                  className="w-full bg-[#fdfbf6] border border-stone-300 rounded-lg mb-1.5 p-3 flex items-start gap-3 active:bg-stone-50 text-left">
                  <div className={`w-4 h-4 mt-0.5 rounded border-[1.5px] flex-shrink-0 flex items-center justify-center ${t.done ? 'bg-green-700 border-green-700' : 'border-stone-400'}`}>
                    {t.done && <Check size={10} className="text-stone-50" strokeWidth={3} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className={`text-sm ${t.done ? 'line-through text-stone-400' : 'text-stone-900'}`}>{t.text}</div>
                    {c && <div className="text-[9px] font-bold uppercase tracking-wider text-stone-500 mt-0.5">{c.name}</div>}
                  </div>
                </button>
              );
            })}
          </SectionHeader>
        )}

        {results?.inbox.length > 0 && (
          <SectionHeader title={`Captures \u00b7 ${results.inbox.length}`}>
            {results.inbox.map(item => {
              const c = cases.find(x => x.id === item.caseId);
              const d = new Date(item.ts);
              return (
                <div key={item.id} className="bg-[#fdfbf6] border border-stone-300 rounded-lg mb-1.5 p-3">
                  <div className="text-[9px] font-mono text-stone-400 mb-1">{d.toLocaleString('en-US', {month:'short', day:'numeric', hour:'numeric', minute:'2-digit'})}</div>
                  <div className="text-sm text-stone-900" style={{fontFamily: '"Source Serif 4", Georgia, serif'}}>{item.text}</div>
                  {c && <div className="text-[9px] font-bold uppercase tracking-wider text-stone-500 mt-1">{c.name}</div>}
                </div>
              );
            })}
          </SectionHeader>
        )}
      </div>
    </>
  );
}

function SectionHeader({ title, children }) {
  return (
    <div className="mt-4">
      <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-stone-500 mb-2 px-1">{title}</div>
      {children}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// QUICK AI VIEW
// ═══════════════════════════════════════════════════════════════════
function QuickAIView({ endpoints, cases }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef(null);

  useEffect(() => { Store.get('logicos:ai:global', []).then(v => setMessages(v || [])); }, []);
  useEffect(() => { if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight; }, [messages]);

  const send = async () => {
    if (!input.trim() || loading) return;
    const userMsg = { role: 'user', content: input.trim() };
    const next = [...messages, userMsg];
    setMessages(next); setInput(''); setLoading(true); haptic('tick');

    const caseList = cases.map(c => `- ${c.name} (${c.kicker})`).join('\n');
    const systemPrompt = `You are an operator-grade assistant inside logicOS. The operator is a Massachusetts municipal/civic professional running multiple cases. Their active cases:\n${caseList}\n\nBe direct, brief, and useful. No throat-clearing. Match their professional register.`;

    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'claude-sonnet-4-20250514', max_tokens: 1000, system: systemPrompt, messages: next.map(m => ({ role: m.role, content: m.content })) })
      });
      const data = await res.json();
      const text = (data.content || []).filter(b => b.type === 'text').map(b => b.text).join('\n');
      const updated = [...next, { role: 'assistant', content: text || '(no response)' }];
      setMessages(updated);
      Store.set('logicos:ai:global', updated);
    } catch (e) {
      setMessages([...next, { role: 'assistant', content: `Error: ${e.message}` }]);
    } finally { setLoading(false); }
  };

  const clear = () => { setMessages([]); Store.set('logicos:ai:global', []); haptic('warn'); };

  return (
    <>
      <Masthead subtitle="AI \u00b7 ask anything" />
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3" style={{scrollbarWidth: 'none'}}>
        {messages.length === 0 && (
          <div className="text-center py-12">
            <Sparkles size={32} className="text-stone-300 mx-auto mb-3" />
            <div className="text-sm italic text-stone-400 max-w-xs mx-auto" style={{fontFamily: '"Source Serif 4", Georgia, serif'}}>Ask anything. Knows your cases. Persists across sessions.</div>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`max-w-[88%] rounded-xl p-3 ${m.role === 'user' ? 'ml-auto bg-stone-900 text-stone-50' : 'bg-[#fdfbf6] border border-stone-300'}`}>
            <div className={`text-[9px] font-bold uppercase tracking-wider mb-1 ${m.role === 'user' ? 'text-stone-400' : 'text-[#7a3329]'}`}>
              {m.role === 'user' ? 'You' : 'Claude'}
            </div>
            <div className="text-sm whitespace-pre-wrap leading-relaxed" style={{fontFamily: '"Source Serif 4", Georgia, serif'}}>{m.content}</div>
          </div>
        ))}
        {loading && (
          <div className="bg-[#fdfbf6] border border-stone-300 rounded-xl p-3 max-w-[88%]">
            <div className="text-[9px] font-bold uppercase tracking-wider mb-1 text-[#7a3329]">Claude</div>
            <div className="text-sm italic text-stone-400 flex items-center gap-2">
              thinking
              <span className="flex gap-0.5">
                <span className="w-1 h-1 rounded-full bg-stone-400 animate-bounce" style={{animationDelay:'0ms'}} />
                <span className="w-1 h-1 rounded-full bg-stone-400 animate-bounce" style={{animationDelay:'150ms'}} />
                <span className="w-1 h-1 rounded-full bg-stone-400 animate-bounce" style={{animationDelay:'300ms'}} />
              </span>
            </div>
          </div>
        )}
      </div>
      <div className="border-t border-stone-300 p-3 bg-[#fdfbf6]/60 flex gap-2 flex-shrink-0">
        <input value={input} onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); send(); } }}
          placeholder="Ask\u2026"
          className="flex-1 bg-[#fdfbf6] border border-stone-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#7a3329]"
          style={{fontFamily: '"Source Serif 4", Georgia, serif'}} />
        <button onClick={clear} className="p-2 text-stone-400 active:text-stone-700"><RefreshCw size={16} /></button>
        <button onClick={send} disabled={loading || !input.trim()}
          className="bg-[#7a3329] text-stone-50 px-3 rounded-xl disabled:opacity-40 active:scale-95 transition-transform">
          <ArrowUp size={16} strokeWidth={2.5} />
        </button>
      </div>
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════
// COMMAND PALETTE
// ═══════════════════════════════════════════════════════════════════
function CommandPalette({ cases, docket, inbox, onClose, onOpenCase, onSwitchTab, onAddTask, onAddCapture, onOpenSettings }) {
  const [q, setQ] = useState('');
  const [mode, setMode] = useState(null);
  const [selectedCaseId, setSelectedCaseId] = useState('');
  const inputRef = useRef(null);
  useEffect(() => { setTimeout(() => inputRef.current?.focus(), 50); }, []);

  const term = q.toLowerCase().trim();

  const baseCommands = [
    { id: 'go-today',  label: 'Go to Today',       icon: Home,   action: () => onSwitchTab('today') },
    { id: 'go-cases',  label: 'Go to Cases',       icon: Layers, action: () => onSwitchTab('cases') },
    { id: 'go-search', label: 'Go to Search',      icon: Search, action: () => onSwitchTab('search') },
    { id: 'go-ai',     label: 'Open AI Quick Ask', icon: Bot,    action: () => onSwitchTab('ai') },
    { id: 'new-task',  label: 'New Task\u2026',    icon: Plus,   action: () => setMode('task') },
    { id: 'capture',   label: 'New Capture\u2026',  icon: Inbox,  action: () => setMode('capture') },
    { id: 'settings',  label: 'Settings',          icon: Cog,    action: () => onOpenSettings() }
  ];

  const filteredCommands = term ? baseCommands.filter(c => c.label.toLowerCase().includes(term)) : baseCommands;
  const filteredCases = term ? cases.filter(c => c.name.toLowerCase().includes(term) || c.kicker.toLowerCase().includes(term)) : cases.slice(0, 5);
  const filteredTasks = term ? docket.filter(t => t.text.toLowerCase().includes(term) && !t.done).slice(0, 4) : [];

  if (mode === 'task' || mode === 'capture') {
    return (
      <div className="absolute inset-0 z-50 bg-stone-900/40 flex items-start pt-16 px-4" onClick={onClose}>
        <div className="bg-[#fdfbf6] w-full rounded-2xl shadow-2xl overflow-hidden border border-stone-300" onClick={e => e.stopPropagation()}>
          <div className="px-4 py-3 bg-stone-100 border-b border-stone-300 flex items-center gap-2">
            <button onClick={() => setMode(null)} className="text-stone-500"><ChevronLeft size={18} /></button>
            <div className="text-xs font-bold uppercase tracking-wider text-stone-700">{mode === 'task' ? 'New Task' : 'New Capture'}</div>
          </div>
          <div className="p-4">
            <input ref={inputRef} value={q} onChange={e => setQ(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && q.trim()) { if (mode === 'task') onAddTask(q.trim(), selectedCaseId || null); else onAddCapture(q.trim(), selectedCaseId || null); } }}
              placeholder={mode === 'task' ? "Task description\u2026" : "Capture text\u2026"}
              className="w-full bg-transparent border-b border-stone-300 pb-2 mb-3 text-base focus:outline-none focus:border-[#7a3329]"
              style={{fontFamily: '"Source Serif 4", Georgia, serif'}} />
            <select value={selectedCaseId} onChange={e => setSelectedCaseId(e.target.value)}
              className="w-full bg-transparent border border-stone-300 rounded px-3 py-2 text-xs font-semibold focus:outline-none mb-3">
              <option value="">no case</option>
              {cases.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <button disabled={!q.trim()} onClick={() => { if (mode === 'task') onAddTask(q.trim(), selectedCaseId || null); else onAddCapture(q.trim(), selectedCaseId || null); }}
              className="w-full py-2.5 bg-[#7a3329] text-stone-50 rounded text-xs font-bold uppercase tracking-wider disabled:opacity-40 active:scale-95 transition-transform">
              {mode === 'task' ? 'Create Task' : 'Send to VAULT'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="absolute inset-0 z-50 bg-stone-900/40 flex items-start pt-12 px-4" onClick={onClose}>
      <div className="bg-[#fdfbf6] w-full rounded-2xl shadow-2xl overflow-hidden border border-stone-300 max-h-[80%] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="px-4 py-3 border-b border-stone-300 flex items-center gap-2 flex-shrink-0">
          <Command size={16} className="text-stone-400" />
          <input ref={inputRef} value={q} onChange={e => setQ(e.target.value)}
            placeholder="Type a command, search anything\u2026"
            className="flex-1 bg-transparent border-0 text-base focus:outline-none placeholder-stone-400"
            style={{fontFamily: '"Source Serif 4", Georgia, serif'}} />
          <button onClick={onClose} className="p-1 text-stone-400"><X size={16} /></button>
        </div>

        <div className="overflow-y-auto" style={{scrollbarWidth: 'none'}}>
          {filteredCommands.length > 0 && (
            <PaletteSection title="Actions">
              {filteredCommands.map(cmd => {
                const Icon = cmd.icon;
                return (
                  <button key={cmd.id} onClick={cmd.action} className="w-full flex items-center gap-3 px-4 py-2.5 active:bg-stone-100 text-left">
                    <Icon size={15} className="text-stone-500" />
                    <span className="flex-1 text-sm text-stone-900">{cmd.label}</span>
                    <ChevronRight size={14} className="text-stone-300" />
                  </button>
                );
              })}
            </PaletteSection>
          )}

          {filteredCases.length > 0 && (
            <PaletteSection title="Cases">
              {filteredCases.map(c => (
                <button key={c.id} onClick={() => onOpenCase(c.id)} className="w-full flex items-center gap-3 px-4 py-2.5 active:bg-stone-100 text-left">
                  <span className="w-2 h-6 rounded" style={{background: c.color}} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-stone-900 truncate">{c.name}</div>
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-stone-500">{c.kicker}</div>
                  </div>
                  <ChevronRight size={14} className="text-stone-300" />
                </button>
              ))}
            </PaletteSection>
          )}

          {filteredTasks.length > 0 && (
            <PaletteSection title="Tasks">
              {filteredTasks.map(t => {
                const c = cases.find(x => x.id === t.caseId);
                return (
                  <div key={t.id} className="w-full flex items-center gap-3 px-4 py-2.5 text-left">
                    <Circle size={12} className="text-stone-400" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-stone-900 truncate">{t.text}</div>
                      {c && <div className="text-[10px] font-semibold uppercase tracking-wider text-stone-500">{c.name}</div>}
                    </div>
                  </div>
                );
              })}
            </PaletteSection>
          )}
        </div>

        <div className="px-4 py-2 border-t border-stone-300 bg-stone-50 flex justify-between text-[10px] text-stone-400 font-mono flex-shrink-0">
          <span>\u21b5 select</span>
          <span>esc close</span>
        </div>
      </div>
    </div>
  );
}

function PaletteSection({ title, children }) {
  return (
    <div>
      <div className="px-4 pt-3 pb-1 text-[9px] font-bold uppercase tracking-[0.18em] text-stone-400">{title}</div>
      {children}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// CASE WORKSPACE
// ═══════════════════════════════════════════════════════════════════
function CaseWorkspace({ caseData, cases, setCases, docket, setDocket, inbox, setInbox, endpoints, onBack }) {
  const [tab, setTab] = useState(caseData.tools[0] || 'notes');
  const [showConfig, setShowConfig] = useState(false);

  const updateCase = (patch) => { setCases(cases.map(c => c.id === caseData.id ? { ...c, ...patch } : c)); };

  return (
    <>
      <div className="px-4 pt-2 pb-3 border-b border-stone-300 flex items-center gap-2 flex-shrink-0 relative bg-[#fdfbf6]/40">
        <div className="absolute left-0 top-2 bottom-3 w-1 rounded-r" style={{background: caseData.color}} />
        <button onClick={onBack} className="p-2 active:bg-stone-200 rounded-lg ml-1"><ChevronLeft size={22} className="text-stone-700" /></button>
        <div className="flex-1 min-w-0">
          <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-stone-500 truncate">{caseData.kicker}</div>
          <div className="text-lg font-semibold leading-tight truncate" style={{fontFamily: '"Source Serif 4", Georgia, serif'}}>{caseData.name}</div>
        </div>
        <button onClick={() => { setShowConfig(true); haptic('tick'); }} className="p-2 -mr-2 active:bg-stone-200 rounded-lg"><Cog size={18} className="text-stone-600" /></button>
      </div>

      <div className="flex-1 overflow-y-auto" style={{scrollbarWidth: 'none'}}>
        {tab === 'capture'  && <CaptureTool caseData={caseData} inbox={inbox} setInbox={setInbox} endpoints={endpoints} />}
        {tab === 'docket'   && <DocketTool caseData={caseData} docket={docket} setDocket={setDocket} />}
        {tab === 'notes'    && <NotesTool caseData={caseData} />}
        {tab === 'ai'       && <AITool caseData={caseData} endpoints={endpoints} />}
        {tab === 'code'     && <CodeTool caseData={caseData} />}
        {tab === 'policy'   && <PolicyTool caseData={caseData} />}
        {tab === 'files'    && <FilesTool caseData={caseData} endpoints={endpoints} />}
        {tab === 'timeline' && <TimelineTool caseData={caseData} inbox={inbox} docket={docket} />}
        {tab === 'people'   && <PeopleTool caseData={caseData} />}
      </div>

      <div className="border-t border-stone-300 bg-[#fdfbf6]/95 backdrop-blur-md flex-shrink-0 overflow-x-auto" style={{scrollbarWidth: 'none'}}>
        <div className="flex min-w-min px-2">
          {caseData.tools.map(toolId => {
            const tool = TOOL_CATALOG.find(t => t.id === toolId);
            if (!tool) return null;
            const Icon = tool.icon;
            const active = tab === toolId;
            return (
              <button key={toolId} onClick={() => { setTab(toolId); haptic('tick'); }}
                className={`flex flex-col items-center gap-0.5 px-3 py-2.5 transition-all whitespace-nowrap min-w-[64px] ${active ? 'text-[#7a3329]' : 'text-stone-500 active:bg-stone-200'}`}>
                <Icon size={18} strokeWidth={active ? 2.4 : 1.8} />
                <span className={`text-[10px] tracking-wider uppercase ${active ? 'font-bold' : 'font-semibold'}`}>{tool.name}</span>
              </button>
            );
          })}
        </div>
      </div>

      {showConfig && <CaseConfigDrawer caseData={caseData} onClose={() => setShowConfig(false)} onUpdate={updateCase} />}
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════
// TOOLS
// ═══════════════════════════════════════════════════════════════════
function CaptureTool({ caseData, inbox, setInbox, endpoints }) {
  const [text, setText] = useState('');
  const caseInbox = inbox.filter(i => i.caseId === caseData.id).slice(0, 20);

  const send = async () => {
    if (!text.trim()) return;
    const item = { id: 'i'+Date.now(), ts: Date.now(), text: text.trim(), caseId: caseData.id, sentToVault: false };
    const next = [item, ...inbox];
    setInbox(next); setText(''); haptic('success');
    try {
      await fetch(endpoints.vaultIntake, { method: 'POST', mode: 'no-cors', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ source: 'logicOS', ...item }) });
      setInbox(next.map(i => i.id === item.id ? { ...i, sentToVault: true } : i));
    } catch (e) {}
  };

  return (
    <div className="p-5">
      <div className="bg-[#fdfbf6] border border-stone-300 rounded-xl p-4 mb-4">
        <textarea value={text} onChange={e => setText(e.target.value)}
          placeholder={`Capture for ${caseData.name}\u2026`}
          className="w-full bg-transparent border-0 resize-none text-base placeholder-stone-400 placeholder:italic focus:outline-none min-h-[80px]"
          style={{fontFamily: '"Source Serif 4", Georgia, serif'}} />
        <button onClick={send} disabled={!text.trim()}
          className="w-full mt-3 bg-[#7a3329] text-stone-50 py-2.5 rounded font-bold text-xs uppercase tracking-wider disabled:opacity-40 active:bg-[#5e271f] active:scale-95 transition-transform flex items-center justify-center gap-2">
          <Send size={13} />Send to VAULT \u00b7 0_INBOX
        </button>
      </div>
      <div className="text-[10px] font-bold uppercase tracking-wider text-stone-500 mb-2 px-1">Case Inbox \u00b7 {caseInbox.length}</div>
      {caseInbox.length === 0 && (
        <div className="bg-[#fdfbf6] border border-stone-300 rounded-xl p-6 text-center italic text-stone-400 text-sm" style={{fontFamily: '"Source Serif 4", Georgia, serif'}}>\u2014 empty \u2014</div>
      )}
      {caseInbox.map(item => {
        const t = new Date(item.ts);
        return (
          <div key={item.id} className="bg-[#fdfbf6] border border-stone-300 rounded-xl p-3 mb-2 flex gap-3">
            <div className="text-[10px] font-mono text-stone-400 w-12 flex-shrink-0">
              {t.toLocaleDateString('en-US', {month:'short', day:'numeric'})}<br/>
              {`${t.getHours()}:${String(t.getMinutes()).padStart(2,'0')}`}
            </div>
            <div className="flex-1 text-sm text-stone-900" style={{fontFamily: '"Source Serif 4", Georgia, serif'}}>
              {item.text}
              <div className={`mt-1 text-[9px] font-bold uppercase tracking-wider ${item.sentToVault ? 'text-green-700' : 'text-stone-400'}`}>
                {item.sentToVault ? '\u2713 VAULT' : '\u23f3 Local'}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function DocketTool({ caseData, docket, setDocket }) {
  const [newTask, setNewTask] = useState('');
  const caseTasks = docket.filter(t => t.caseId === caseData.id);

  const add = () => {
    if (!newTask.trim()) return;
    setDocket([...docket, { id: 't'+Date.now(), text: newTask.trim(), caseId: caseData.id, done: false }]);
    setNewTask(''); haptic('success');
  };
  const toggle = (id) => { setDocket(docket.map(t => t.id === id ? { ...t, done: !t.done } : t)); haptic('success'); };
  const remove = (id) => { setDocket(docket.filter(t => t.id !== id)); haptic('warn'); };

  return (
    <div className="p-5">
      <div className="bg-[#fdfbf6] border border-stone-300 rounded-xl p-3 mb-4 flex gap-2">
        <input value={newTask} onChange={e => setNewTask(e.target.value)} onKeyDown={e => e.key === 'Enter' && add()}
          placeholder="New task\u2026" className="flex-1 bg-transparent border-0 text-sm focus:outline-none placeholder-stone-400"
          style={{fontFamily: '"Source Serif 4", Georgia, serif'}} />
        <button onClick={add} className="px-3 bg-stone-900 text-stone-50 rounded text-xs font-semibold active:scale-95 transition-transform">Add</button>
      </div>
      <div className="bg-[#fdfbf6] border border-stone-300 rounded-xl overflow-hidden">
        {caseTasks.length === 0 && (
          <div className="p-6 text-center italic text-stone-400 text-sm" style={{fontFamily: '"Source Serif 4", Georgia, serif'}}>\u2014 no tasks \u00b7 swipe \u2194 to complete or delete \u2014</div>
        )}
        {caseTasks.map((task, i) => (
          <SwipeRow key={task.id} onSwipeRight={() => toggle(task.id)} onSwipeLeft={() => remove(task.id)}
            leftAction={<><Check size={16} /><span className="ml-2 text-xs font-bold uppercase">Done</span></>}
            rightAction={<><span className="mr-2 text-xs font-bold uppercase">Delete</span><Trash2 size={16} /></>}>
            <button onClick={() => toggle(task.id)}
              className={`w-full flex items-center gap-3 p-3 bg-[#fdfbf6] active:bg-stone-50 text-left ${i < caseTasks.length - 1 ? 'border-b border-stone-200' : ''}`}>
              <div className={`w-4 h-4 rounded border-[1.5px] flex items-center justify-center flex-shrink-0 ${task.done ? 'bg-green-700 border-green-700' : 'border-stone-400'}`}>
                {task.done && <Check size={10} className="text-stone-50" strokeWidth={3} />}
              </div>
              <span className={`flex-1 text-sm ${task.done ? 'line-through text-stone-400' : 'text-stone-900'}`}>{task.text}</span>
            </button>
          </SwipeRow>
        ))}
      </div>
    </div>
  );
}

function NotesTool({ caseData }) {
  const [notes, setNotes] = useState('');
  const key = `logicos:notes:${caseData.id}`;
  useEffect(() => { Store.get(key, '').then(v => setNotes(v || '')); }, [caseData.id]);
  const save = (v) => { setNotes(v); Store.set(key, v); };

  return (
    <div className="p-5 h-full flex flex-col">
      <textarea value={notes} onChange={e => save(e.target.value)}
        placeholder={`Notes for ${caseData.name}\u2026\n\nAuto-saves per case.`}
        className="w-full flex-1 min-h-[400px] bg-[#fdfbf6] border border-stone-300 rounded-xl p-4 text-base leading-relaxed text-stone-900 placeholder-stone-400 placeholder:italic focus:outline-none focus:border-[#7a3329] resize-none"
        style={{fontFamily: '"Source Serif 4", Georgia, serif'}} />
      <div className="mt-2 text-[10px] font-mono text-stone-400 text-right">{notes.length} chars \u00b7 auto-saved</div>
    </div>
  );
}

function AITool({ caseData, endpoints }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef(null);
  const key = `logicos:ai:${caseData.id}`;

  useEffect(() => { Store.get(key, []).then(v => setMessages(v || [])); }, [caseData.id]);
  useEffect(() => { if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight; }, [messages]);

  const send = async () => {
    if (!input.trim() || loading) return;
    const userMsg = { role: 'user', content: input.trim() };
    const next = [...messages, userMsg];
    setMessages(next); setInput(''); setLoading(true); haptic('tick');

    const systemPrompt = `You are an operator-grade assistant inside logicOS, working on the case "${caseData.name}" (${caseData.kicker}). The operator is a Massachusetts municipal/civic professional. Be direct, brief, and useful. No throat-clearing.`;

    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'claude-sonnet-4-20250514', max_tokens: 1000, system: systemPrompt, messages: next.map(m => ({ role: m.role, content: m.content })) })
      });
      const data = await res.json();
      const text = (data.content || []).filter(b => b.type === 'text').map(b => b.text).join('\n');
      const updated = [...next, { role: 'assistant', content: text || '(no response)' }];
      setMessages(updated);
      Store.set(key, updated);
    } catch (e) {
      setMessages([...next, { role: 'assistant', content: `Error: ${e.message}` }]);
    } finally { setLoading(false); }
  };

  const clear = () => { setMessages([]); Store.set(key, []); haptic('warn'); };

  return (
    <div className="flex flex-col h-full">
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3" style={{scrollbarWidth: 'none'}}>
        {messages.length === 0 && (
          <div className="text-center py-12">
            <Bot size={32} className="text-stone-300 mx-auto mb-3" />
            <div className="text-sm italic text-stone-400" style={{fontFamily: '"Source Serif 4", Georgia, serif'}}>Ask anything about {caseData.name}.</div>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`max-w-[88%] rounded-xl p-3 ${m.role === 'user' ? 'ml-auto bg-stone-900 text-stone-50' : 'bg-[#fdfbf6] border border-stone-300'}`}>
            <div className={`text-[9px] font-bold uppercase tracking-wider mb-1 ${m.role === 'user' ? 'text-stone-400' : 'text-[#7a3329]'}`}>
              {m.role === 'user' ? 'You' : 'Claude'}
            </div>
            <div className="text-sm whitespace-pre-wrap leading-relaxed" style={{fontFamily: '"Source Serif 4", Georgia, serif'}}>{m.content}</div>
          </div>
        ))}
        {loading && (
          <div className="bg-[#fdfbf6] border border-stone-300 rounded-xl p-3 max-w-[88%]">
            <div className="text-[9px] font-bold uppercase tracking-wider mb-1 text-[#7a3329]">Claude</div>
            <div className="text-sm italic text-stone-400">thinking\u2026</div>
          </div>
        )}
      </div>
      <div className="border-t border-stone-300 p-3 bg-[#fdfbf6]/60 flex gap-2">
        <input value={input} onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); send(); } }}
          placeholder="Ask\u2026"
          className="flex-1 bg-[#fdfbf6] border border-stone-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#7a3329]"
          style={{fontFamily: '"Source Serif 4", Georgia, serif'}} />
        <button onClick={clear} className="p-2 text-stone-400"><RefreshCw size={14} /></button>
        <button onClick={send} disabled={loading || !input.trim()}
          className="bg-[#7a3329] text-stone-50 px-3 rounded-xl disabled:opacity-40 active:scale-95 transition-transform">
          <ArrowUp size={14} strokeWidth={2.5} />
        </button>
      </div>
    </div>
  );
}

function CodeTool({ caseData }) {
  const [code, setCode] = useState('');
  const [output, setOutput] = useState('');
  const key = `logicos:code:${caseData.id}`;

  useEffect(() => {
    Store.get(key, '// JS scratchpad\nconst rows = 5;\nfor (let i = 1; i <= rows; i++) {\n  console.log(`row ${i}: ${i*i}`);\n}\n').then(v => setCode(v));
  }, [caseData.id]);

  const save = (v) => { setCode(v); Store.set(key, v); };

  const run = () => {
    haptic('tick');
    const logs = [];
    const customConsole = {
      log: (...args) => logs.push(args.map(a => typeof a === 'object' ? JSON.stringify(a, null, 2) : String(a)).join(' ')),
      error: (...args) => logs.push('ERROR: ' + args.map(a => String(a)).join(' '))
    };
    try {
      const fn = new Function('console', code);
      const result = fn(customConsole);
      if (result !== undefined) logs.push('\u2192 ' + (typeof result === 'object' ? JSON.stringify(result, null, 2) : String(result)));
      setOutput(logs.join('\n') || '(no output)');
    } catch (e) { setOutput('ERROR: ' + e.message); }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 p-3">
        <textarea value={code} onChange={e => save(e.target.value)} spellCheck={false}
          className="w-full h-64 bg-stone-900 text-stone-100 p-3 rounded text-xs leading-relaxed focus:outline-none resize-none"
          style={{fontFamily: '"JetBrains Mono", monospace'}} />
      </div>
      <div className="px-3 pb-2 flex gap-2">
        <button onClick={run} className="flex-1 bg-stone-900 text-stone-50 py-2 rounded text-xs font-bold uppercase tracking-wider active:bg-stone-700 active:scale-95 transition-all flex items-center justify-center gap-2">
          <Hammer size={12} /> Run
        </button>
        <button onClick={() => setOutput('')} className="px-4 border border-stone-300 rounded text-xs font-semibold uppercase">Clear</button>
      </div>
      <div className="mx-3 mb-3 bg-stone-50 border border-stone-300 rounded p-3 min-h-[120px] text-xs whitespace-pre-wrap" style={{fontFamily: '"JetBrains Mono", monospace'}}>
        {output || <span className="text-stone-400 italic">\u2014 output \u2014</span>}
      </div>
    </div>
  );
}

function PolicyTool() {
  const [query, setQuery] = useState('');
  const SEED = [
    { cite: 'M.G.L. c. 30B', title: 'Uniform Procurement Act', desc: 'Procurement of supplies, services, and real property by local governmental bodies.' },
    { cite: 'M.G.L. c. 30A \u00a7 18-25', title: 'Open Meeting Law', desc: 'Public meeting requirements for governmental bodies.' },
    { cite: 'M.G.L. c. 66 \u00a7 10', title: 'Public Records Law', desc: 'Right to inspect and copy public records.' },
    { cite: 'M.G.L. c. 40 \u00a7 4A', title: 'Inter-municipal Agreements', desc: 'Authority for joint contracts between municipalities.' },
    { cite: 'M.G.L. c. 41 \u00a7 23A-D', title: 'Town Administrator Authority', desc: 'Powers and duties of town administrators.' },
    { cite: 'M.G.L. c. 44 \u00a7 53E\u00bd', title: 'Revolving Funds', desc: 'Departmental revolving funds \u2014 annual authorization.' },
    { cite: 'M.G.L. c. 55', title: 'Campaign Finance', desc: 'Disclosure and regulation of political campaign contributions.' },
    { cite: '950 CMR 21', title: 'OCPF Regulations', desc: 'Office of Campaign and Political Finance reporting requirements.' },
    { cite: '780 CMR', title: 'MA Building Code', desc: 'State building code adoption.' },
    { cite: 'M.G.L. c. 40A', title: 'Zoning Act', desc: 'Zoning regulation authority for cities and towns.' }
  ];
  const q = query.toLowerCase().trim();
  const results = q ? SEED.filter(p => p.cite.toLowerCase().includes(q) || p.title.toLowerCase().includes(q) || p.desc.toLowerCase().includes(q)) : SEED;

  return (
    <div className="p-4">
      <div className="bg-[#fdfbf6] border border-stone-300 rounded-xl flex items-center gap-2 px-3 py-2.5 mb-3">
        <Search size={14} className="text-stone-400" />
        <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search MGL, regs, bylaws\u2026"
          className="flex-1 bg-transparent border-0 text-sm focus:outline-none placeholder-stone-400"
          style={{fontFamily: '"Source Serif 4", Georgia, serif'}} />
      </div>
      <div className="text-[10px] font-bold uppercase tracking-wider text-stone-500 mb-2">
        {q ? `${results.length} match${results.length === 1 ? '' : 'es'}` : 'Common citations'}
      </div>
      {results.map((p, i) => (
        <div key={i} className="bg-[#fdfbf6] border border-stone-300 rounded-xl p-3 mb-2">
          <div className="text-xs font-mono font-bold text-[#7a3329] mb-0.5">{p.cite}</div>
          <div className="text-sm font-semibold text-stone-900" style={{fontFamily: '"Source Serif 4", Georgia, serif'}}>{p.title}</div>
          <div className="text-xs text-stone-500 italic mt-1" style={{fontFamily: '"Source Serif 4", Georgia, serif'}}>{p.desc}</div>
          <a href={`https://malegislature.gov/Laws/GeneralLaws/Search?searchTerms=${encodeURIComponent(p.cite)}`}
            target="_blank" rel="noopener noreferrer"
            className="mt-2 inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-[#7a3329]">
            malegislature.gov <ExternalLink size={10} />
          </a>
        </div>
      ))}
    </div>
  );
}

function FilesTool({ caseData, endpoints }) {
  return (
    <div className="p-5">
      <div className="bg-[#fdfbf6] border border-stone-300 rounded-xl p-6 text-center">
        <Folder size={32} className="text-stone-300 mx-auto mb-3" />
        <div className="text-sm font-semibold text-stone-700 mb-1" style={{fontFamily: '"Source Serif 4", Georgia, serif'}}>File Drawer</div>
        <div className="text-xs text-stone-500 mb-4">Connected to {caseData.connections.length > 0 ? caseData.connections.join(', ') : 'no sources'}.</div>
        <a href={endpoints.puddleJumper} target="_blank" rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#7a3329] uppercase tracking-wider">
          Open in PuddleJumper <ExternalLink size={11} />
        </a>
      </div>
    </div>
  );
}

function TimelineTool({ caseData, inbox, docket }) {
  const events = [
    ...inbox.filter(i => i.caseId === caseData.id).map(i => ({ ts: i.ts, type: 'capture', text: i.text })),
    ...docket.filter(t => t.caseId === caseData.id && t.done).map(t => ({ ts: Date.now() - 3600000, type: 'task', text: t.text }))
  ].sort((a, b) => b.ts - a.ts);

  return (
    <div className="p-5">
      {events.length === 0 && (
        <div className="text-center py-12 text-stone-400 italic text-sm" style={{fontFamily: '"Source Serif 4", Georgia, serif'}}>\u2014 no events yet \u2014</div>
      )}
      {events.map((e, i) => {
        const d = new Date(e.ts);
        return (
          <div key={i} className="flex gap-3 pb-4">
            <div className="w-2 h-2 rounded-full bg-[#7a3329] mt-2 flex-shrink-0 relative">
              {i < events.length - 1 && <div className="absolute top-2 left-1/2 w-px h-full bg-stone-300 -translate-x-1/2" />}
            </div>
            <div className="flex-1 pb-2">
              <div className="text-[10px] font-bold uppercase tracking-wider text-stone-500">
                {e.type} \u00b7 {d.toLocaleString('en-US', {month:'short', day:'numeric', hour:'numeric', minute:'2-digit'})}
              </div>
              <div className="text-sm text-stone-900 mt-0.5" style={{fontFamily: '"Source Serif 4", Georgia, serif'}}>{e.text}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function PeopleTool({ caseData }) {
  const [people, setPeople] = useState([]);
  const [name, setName] = useState('');
  const [role, setRole] = useState('');
  const key = `logicos:people:${caseData.id}`;

  useEffect(() => { Store.get(key, []).then(v => setPeople(v || [])); }, [caseData.id]);

  const add = () => {
    if (!name.trim()) return;
    const next = [...people, { id: 'p'+Date.now(), name: name.trim(), role: role.trim() }];
    setPeople(next); Store.set(key, next); setName(''); setRole(''); haptic('success');
  };
  const remove = (id) => {
    const next = people.filter(p => p.id !== id);
    setPeople(next); Store.set(key, next); haptic('warn');
  };

  return (
    <div className="p-5">
      <div className="bg-[#fdfbf6] border border-stone-300 rounded-xl p-3 mb-3">
        <input value={name} onChange={e => setName(e.target.value)} placeholder="Name"
          className="w-full bg-transparent border-b border-stone-300 pb-2 mb-2 text-sm focus:outline-none"
          style={{fontFamily: '"Source Serif 4", Georgia, serif'}} />
        <input value={role} onChange={e => setRole(e.target.value)} placeholder="Role / context"
          className="w-full bg-transparent border-b border-stone-300 pb-2 mb-3 text-xs focus:outline-none" />
        <button onClick={add} className="w-full bg-stone-900 text-stone-50 py-2 rounded text-xs font-bold uppercase tracking-wider active:scale-95 transition-transform">Add Person</button>
      </div>
      {people.map(p => (
        <div key={p.id} className="bg-[#fdfbf6] border border-stone-300 rounded-xl p-3 mb-2 flex items-center">
          <User size={16} className="text-stone-400 mr-3" />
          <div className="flex-1">
            <div className="text-sm font-semibold" style={{fontFamily: '"Source Serif 4", Georgia, serif'}}>{p.name}</div>
            {p.role && <div className="text-xs text-stone-500 italic">{p.role}</div>}
          </div>
          <button onClick={() => remove(p.id)} className="text-stone-300"><Trash2 size={14} /></button>
        </div>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// CASE CONFIG DRAWER
// ═══════════════════════════════════════════════════════════════════
function CaseConfigDrawer({ caseData, onClose, onUpdate }) {
  const toggle = (field, id) => {
    const cur = caseData[field] || [];
    const next = cur.includes(id) ? cur.filter(x => x !== id) : [...cur, id];
    onUpdate({ [field]: next }); haptic('tick');
  };
  return (
    <div className="absolute inset-0 z-50 bg-stone-900/40 flex items-end" onClick={onClose}>
      <div className="bg-stone-100 w-full max-h-[85%] rounded-t-2xl overflow-y-auto" onClick={e => e.stopPropagation()} style={{scrollbarWidth: 'none'}}>
        <div className="sticky top-0 bg-stone-100 border-b border-stone-300 px-5 py-3 flex items-center justify-between">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-stone-500">Configuration</div>
            <div className="text-base font-semibold" style={{fontFamily: '"Source Serif 4", Georgia, serif'}}>{caseData.name}</div>
          </div>
          <button onClick={onClose} className="p-2"><X size={20} /></button>
        </div>
        <div className="p-5 space-y-5">
          <ConfigGroup title="Tools" desc="Pick the work surfaces in this case's tab bar." items={TOOL_CATALOG} active={caseData.tools} onToggle={(id) => toggle('tools', id)} />
          <ConfigGroup title="Connections" desc="External systems this case can pull from." items={CONNECTION_CATALOG} active={caseData.connections} onToggle={(id) => toggle('connections', id)} />
          <ConfigGroup title="AI" desc="Models and data sources available in this case." items={AI_INTEGRATIONS} active={caseData.ai} onToggle={(id) => toggle('ai', id)} />
        </div>
      </div>
    </div>
  );
}

function ConfigGroup({ title, desc, items, active, onToggle }) {
  return (
    <div>
      <div className="text-base font-semibold mb-1" style={{fontFamily: '"Source Serif 4", Georgia, serif'}}>{title}</div>
      <div className="text-xs italic text-stone-500 mb-3" style={{fontFamily: '"Source Serif 4", Georgia, serif'}}>{desc}</div>
      <div className="space-y-2">
        {items.map(item => {
          const Icon = item.icon || Bot;
          const isActive = active?.includes(item.id);
          return (
            <button key={item.id} onClick={() => onToggle(item.id)}
              className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all text-left ${isActive ? 'bg-[#fdfbf6] border-[#7a3329]' : 'bg-stone-50 border-stone-300'}`}>
              {item.icon && <Icon size={18} className={isActive ? 'text-[#7a3329]' : 'text-stone-400'} />}
              <div className="flex-1">
                <div className="text-sm font-semibold text-stone-900">{item.name}</div>
                <div className="text-xs text-stone-500">{item.desc}</div>
              </div>
              <div className={`w-5 h-5 rounded border-[1.5px] flex items-center justify-center flex-shrink-0 ${isActive ? 'bg-[#7a3329] border-[#7a3329]' : 'border-stone-400'}`}>
                {isActive && <Check size={12} className="text-stone-50" strokeWidth={3} />}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// SETTINGS DRAWER
// ═══════════════════════════════════════════════════════════════════
function SettingsDrawer({ endpoints, setEndpoints, pjStatus, onClose }) {
  const [draft, setDraft] = useState(endpoints);
  const [saved, setSaved] = useState(false);

  const update = (key, val) => setDraft({ ...draft, [key]: val });
  const save = () => { setEndpoints(draft); setSaved(true); haptic('success'); setTimeout(() => setSaved(false), 1500); };
  const reset = () => { setDraft(DEFAULT_ENDPOINTS); haptic('warn'); };

  const fields = [
    { key: 'puddleJumper', label: 'PuddleJumper', desc: 'Backend control plane' },
    { key: 'logicOS',      label: 'logicOS',       desc: 'Frontend host' },
    { key: 'logicCommons', label: 'Logic Commons', desc: 'Shared library' },
    { key: 'vaultIntake',  label: 'VAULT Intake',  desc: 'POST endpoint for captures' },
    { key: 'policyAPI',    label: 'Policy API',    desc: 'MGL / regulation lookup' }
  ];

  return (
    <div className="absolute inset-0 z-50 bg-stone-900/40 flex items-end" onClick={onClose}>
      <div className="bg-stone-100 w-full max-h-[88%] rounded-t-2xl overflow-y-auto" onClick={e => e.stopPropagation()} style={{scrollbarWidth: 'none'}}>
        <div className="sticky top-0 bg-stone-100 border-b border-stone-300 px-5 py-3 flex items-center justify-between z-10">
          <div className="text-base font-semibold" style={{fontFamily: '"Source Serif 4", Georgia, serif'}}>Settings</div>
          <button onClick={onClose} className="p-2"><X size={20} /></button>
        </div>
        <div className="p-5">
          <div className="bg-[#fdfbf6] border border-stone-300 rounded-xl p-3 mb-4">
            <div className="text-xs font-bold uppercase tracking-wider text-stone-500">PuddleJumper Status</div>
            <div className="text-sm font-semibold flex items-center gap-2 mt-0.5" style={{fontFamily: '"Source Serif 4", Georgia, serif'}}>
              {pjStatus === 'online' && <><Wifi size={14} className="text-green-700" /> Online</>}
              {pjStatus === 'offline' && <><WifiOff size={14} className="text-stone-400" /> Offline \u00b7 captures local</>}
              {pjStatus === 'unknown' && <><Wifi size={14} className="text-stone-300" /> Checking\u2026</>}
            </div>
          </div>

          <div className="text-base font-semibold mb-3" style={{fontFamily: '"Source Serif 4", Georgia, serif'}}>Endpoints</div>
          {fields.map(f => (
            <div key={f.key} className="bg-[#fdfbf6] border border-stone-300 rounded-xl p-3 mb-2">
              <div className="text-[10px] font-bold uppercase tracking-wider text-stone-500">{f.label}</div>
              <div className="text-[10px] italic text-stone-400 mb-2" style={{fontFamily: '"Source Serif 4", Georgia, serif'}}>{f.desc}</div>
              <input value={draft[f.key]} onChange={e => update(f.key, e.target.value)}
                className="w-full bg-transparent border-b border-stone-300 text-xs py-1 focus:outline-none focus:border-[#7a3329]"
                style={{fontFamily: '"JetBrains Mono", monospace'}} />
            </div>
          ))}

          <button onClick={() => update('aiEnabled', !draft.aiEnabled)}
            className={`w-full bg-[#fdfbf6] border rounded-xl p-3 mt-3 flex items-center justify-between text-left ${draft.aiEnabled ? 'border-[#7a3329]' : 'border-stone-300'}`}>
            <div>
              <div className="text-sm font-semibold" style={{fontFamily: '"Source Serif 4", Georgia, serif'}}>Enable AI Assistant</div>
              <div className="text-xs text-stone-500">Claude-powered chat per case</div>
            </div>
            <div className={`w-5 h-5 rounded border-[1.5px] flex items-center justify-center ${draft.aiEnabled ? 'bg-[#7a3329] border-[#7a3329]' : 'border-stone-400'}`}>
              {draft.aiEnabled && <Check size={12} className="text-stone-50" strokeWidth={3} />}
            </div>
          </button>

          <div className="flex gap-2 mt-6 mb-4">
            <button onClick={reset} className="flex-1 py-3 border border-stone-300 rounded text-xs font-semibold uppercase tracking-wider text-stone-600">Reset</button>
            <button onClick={save} className="flex-[2] py-3 bg-[#7a3329] text-stone-50 rounded text-xs font-bold uppercase tracking-wider active:bg-[#5e271f] active:scale-95 transition-transform">
              {saved ? '\u2713 Saved' : 'Save'}
            </button>
          </div>

          <div className="text-center pb-4">
            <div className="text-xs italic text-stone-400" style={{fontFamily: '"Source Serif 4", Georgia, serif'}}>logicOS \u00b7 PublicLogic</div>
            <div className="text-[10px] font-bold uppercase tracking-widest text-stone-400 mt-1">Structure is care</div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── helpers ──────────────────────────────────────────────────────
function formatRelative(ts) {
  if (!ts) return '\u2014';
  const diff = Date.now() - ts;
  if (diff < 60000) return 'just now';
  if (diff < 3600000) return Math.floor(diff/60000) + 'm';
  if (diff < 86400000) return Math.floor(diff/3600000) + 'h';
  if (diff < 604800000) return Math.floor(diff/86400000) + 'd';
  return Math.floor(diff/604800000) + 'w';
}
