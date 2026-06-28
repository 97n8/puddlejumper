import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../api/client';
import { Link, useLocation } from 'react-router-dom';

export default function Sidebar() {
  const { data } = useQuery({
    queryKey: ['org-status'],
    queryFn:  () => apiFetch('/api/v1/org-manager/status'),
  });

  // Town name comes from org_config — never hardcoded
  const jurisdictionName = data?.data?.jurisdiction?.name || 'Loading…';

  const { pathname } = useLocation();
  const links = [
    { to: '/workbench',             label: 'Dashboard' },
    { to: '/workbench/cases',       label: 'Case Queue' },
    { to: '/workbench/obligations', label: 'Obligations' },
    { to: '/workbench/watch',       label: 'Watch' },
  ];

  return (
    <aside className="w-56 bg-white border-r flex flex-col">
      <div className="px-4 py-5 border-b">
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">LogicOS</p>
        <p className="text-sm font-semibold text-gray-900 mt-0.5 truncate">{jurisdictionName}</p>
      </div>
      <nav className="flex-1 p-3 space-y-1">
        {links.map(l => (
          <Link key={l.to} to={l.to}
            className={`block px-3 py-2 rounded-lg text-sm font-medium transition-colors
              ${pathname === l.to ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-50'}`}>
            {l.label}
          </Link>
        ))}
      </nav>
    </aside>
  );
}
