import { useState } from 'react';
import { useCaseStore } from '../store/caseStore';

const TABS = ['Ask', 'Now', 'Flows', 'Connect'];

export default function MobileDock() {
  const [open, setOpen]        = useState(false);
  const [activeTab, setTab]    = useState('Ask');
  const activeCaseId = useCaseStore(s => s.activeCaseId);

  return (
    <div className="fixed bottom-4 right-4 z-50">
      {open && (
        <div className="mb-2 w-72 bg-white rounded-xl shadow-lg border overflow-hidden">
          <div className="flex border-b">
            {TABS.map(t => (
              <button key={t} onClick={() => setTab(t)}
                className={`flex-1 py-2 text-xs font-medium transition-colors
                  ${activeTab === t ? 'bg-blue-50 text-blue-700' : 'text-gray-500 hover:bg-gray-50'}`}>
                {t}
              </button>
            ))}
          </div>
          <div className="p-4 text-sm text-gray-600 min-h-[80px]">
            {activeTab === 'Ask'     && <p>Ask PuddleJumper about {activeCaseId ? 'this case' : 'any topic'}…</p>}
            {activeTab === 'Now'     && <p>Live activity feed for this session.</p>}
            {activeTab === 'Flows'   && <p>Active workflow flows.</p>}
            {activeTab === 'Connect' && <p>PuddleJumper connection status.</p>}
          </div>
        </div>
      )}
      <button
        onClick={() => setOpen(o => !o)}
        className="w-12 h-12 bg-blue-600 text-white rounded-full shadow-lg
                   flex items-center justify-center text-lg font-bold hover:bg-blue-700">
        {open ? '×' : 'PJ'}
      </button>
    </div>
  );
}
