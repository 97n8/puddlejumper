import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../api/client';
import Sidebar from './Sidebar';
import DashboardPanel   from './panels/DashboardPanel';
import CaseQueuePanel   from './panels/CaseQueuePanel';
import ObligationsPanel from './panels/ObligationsPanel';
import WatchPanel       from './panels/WatchPanel';
import MobileDock       from '../dock/MobileDock';
import { Routes, Route } from 'react-router-dom';

export default function Workbench() {
  return (
    <div className="flex h-screen bg-gray-100">
      <Sidebar />
      <main className="flex-1 overflow-auto">
        <Routes>
          <Route index element={<DashboardPanel />} />
          <Route path="cases"       element={<CaseQueuePanel />} />
          <Route path="obligations" element={<ObligationsPanel />} />
          <Route path="watch"       element={<WatchPanel />} />
        </Routes>
      </main>
      <MobileDock />
    </div>
  );
}
