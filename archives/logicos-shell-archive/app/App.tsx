import { useState, useEffect, useCallback } from 'react';
import { Masthead } from './components/Masthead';
import { BottomNav } from './components/BottomNav';
import { TodayView } from './components/TodayView';
import { CasesView } from './components/CasesView';
import { CaptureView } from './components/CaptureView';
import { SettingsView } from './components/SettingsView';
import { Store } from './lib/store';
import { api } from './lib/api';
import { DEFAULT_ENDPOINTS } from './constants';
import { SEED_CASES, SEED_DOCKET } from './seed';
import type { Case, Task, Capture, Endpoints } from './types';

export default function App() {
  const [tab, setTab] = useState('today');
  const [showCapture, setShowCapture] = useState(false);
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [online, setOnline] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const [endpoints, setEndpoints] = useState<Endpoints>(DEFAULT_ENDPOINTS);
  const [cases, setCases] = useState<Case[]>([]);
  const [docket, setDocket] = useState<Task[]>([]);
  const [inbox, setInbox] = useState<Capture[]>([]);

  // Load persisted state
  useEffect(() => {
    const loadState = async () => {
      const [savedEndpoints, savedCases, savedDocket, savedInbox] = await Promise.all([
        Store.get<Endpoints>('endpoints'),
        Store.get<Case[]>('cases'),
        Store.get<Task[]>('docket'),
        Store.get<Capture[]>('inbox')
      ]);

      if (savedEndpoints) setEndpoints(savedEndpoints);
      if (savedCases) setCases(savedCases);
      else setCases(SEED_CASES);

      if (savedDocket) setDocket(savedDocket);
      else setDocket(SEED_DOCKET);

      if (savedInbox) setInbox(savedInbox);

      setLoaded(true);
    };

    loadState();
  }, []);

  // Probe backend connection
  useEffect(() => {
    if (!loaded || !endpoints.puddleJumper) return;

    const probe = async () => {
      const isOnline = await api.probe(endpoints.puddleJumper);
      setOnline(isOnline);
    };

    probe();
    const interval = setInterval(probe, 30000); // Every 30s

    return () => clearInterval(interval);
  }, [endpoints.puddleJumper, loaded]);

  // Persist state changes
  useEffect(() => {
    if (!loaded) return;
    Store.set('endpoints', endpoints);
  }, [endpoints, loaded]);

  useEffect(() => {
    if (!loaded) return;
    Store.set('cases', cases);
  }, [cases, loaded]);

  useEffect(() => {
    if (!loaded) return;
    Store.set('docket', docket);
  }, [docket, loaded]);

  useEffect(() => {
    if (!loaded) return;
    Store.set('inbox', inbox);
  }, [inbox, loaded]);

  const handleCapture = useCallback(async (text: string, caseId?: string) => {
    const capture: Capture = {
      id: crypto.randomUUID(),
      source: 'logicOS',
      ts: Date.now(),
      text,
      caseId,
      sentToVault: false
    };

    setInbox(prev => [capture, ...prev]);

    // Send to VAULT
    try {
      await api.captureToVault(capture, endpoints.vaultIntake);
      setInbox(prev =>
        prev.map(item =>
          item.id === capture.id ? { ...item, sentToVault: true } : item
        )
      );
    } catch (error) {
      console.error('Failed to send to VAULT:', error);
      setInbox(prev =>
        prev.map(item =>
          item.id === capture.id
            ? { ...item, sentToVault: false, failedToVault: true }
            : item
        )
      );
    }
  }, [endpoints.vaultIntake]);

  const handleToggleTask = useCallback((taskId: string) => {
    setDocket(prev =>
      prev.map(task =>
        task.id === taskId
          ? {
              ...task,
              done: !task.done,
              completedAt: !task.done ? Date.now() : undefined
            }
          : task
      )
    );
  }, []);

  const handleOpenCase = useCallback((caseId: string) => {
    setCases(prev =>
      prev.map(c =>
        c.id === caseId ? { ...c, lastOpened: Date.now() } : c
      )
    );
    // TODO: Navigate to case workspace
    console.log('Opening case:', caseId);
  }, []);

  const handleSaveSettings = useCallback((newEndpoints: Endpoints) => {
    setEndpoints(newEndpoints);
  }, []);

  if (!loaded) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-gray-900 text-white">
        <div className="text-center">
          <div className="animate-pulse mb-2">Loading...</div>
          <div className="text-xs text-gray-400">logicOS v1.0</div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen flex flex-col bg-gray-900 text-white">
      {/* Device frame simulation */}
      <div className="max-w-md mx-auto w-full h-full flex flex-col bg-white shadow-2xl">
        <Masthead
          online={online}
          onCommandClick={() => setShowCommandPalette(true)}
        />

        <div className="flex-1 overflow-hidden">
          {showCapture ? (
            <CaptureView
              cases={cases}
              onCapture={handleCapture}
              recentCaptures={inbox.slice(0, 20)}
            />
          ) : tab === 'today' ? (
            <TodayView
              tasks={docket}
              cases={cases}
              captureCount={inbox.length}
              online={online}
              endpoints={endpoints}
              onToggleTask={handleToggleTask}
              onOpenCase={handleOpenCase}
              onShowCapture={() => setShowCapture(true)}
            />
          ) : tab === 'cases' ? (
            <CasesView cases={cases} onOpenCase={handleOpenCase} />
          ) : (
            <SettingsView
              endpoints={endpoints}
              onSave={handleSaveSettings}
            />
          )}
        </div>

        <BottomNav
          activeTab={showCapture ? 'capture' : tab}
          onTabChange={(newTab) => {
            setShowCapture(false);
            setTab(newTab);
          }}
        />
      </div>

      {/* Command palette placeholder */}
      {showCommandPalette && (
        <div
          className="fixed inset-0 bg-black/50 flex items-start justify-center pt-20 z-50"
          onClick={() => setShowCommandPalette(false)}
        >
          <div
            className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-gray-900 text-sm">
              Quick actions for the mobile entrance are the fastest way into Dashboard, Intake, LogicOS, and Guide.
            </p>
            <div className="mt-3 grid gap-2">
              <a
                href={`${endpoints.puddleJumper.replace(/\/+$/, '')}/pj/admin#dashboard`}
                className="px-4 py-2 bg-emerald-100 text-emerald-900 rounded hover:bg-emerald-200 text-sm font-medium"
              >
                Open Dashboard
              </a>
              <a
                href={`${endpoints.puddleJumper.replace(/\/+$/, '')}/prr.html`}
                className="px-4 py-2 bg-sky-100 text-sky-900 rounded hover:bg-sky-200 text-sm font-medium"
              >
                Open Intake
              </a>
              <a
                href={endpoints.logicOS}
                className="px-4 py-2 bg-gray-100 text-gray-800 rounded hover:bg-gray-200 text-sm font-medium"
              >
                Open LogicOS
              </a>
              <a
                href={`${endpoints.puddleJumper.replace(/\/+$/, '')}/pj/guide`}
                className="px-4 py-2 bg-gray-100 text-gray-800 rounded hover:bg-gray-200 text-sm font-medium"
              >
                Open Guide
              </a>
              <button
                onClick={() => setShowCommandPalette(false)}
                className="mt-1 px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300 text-sm"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
