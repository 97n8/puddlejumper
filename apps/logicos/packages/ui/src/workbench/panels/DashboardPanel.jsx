import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../../api/client';
import ZeroState from './ZeroState';

export default function DashboardPanel() {
  const { data } = useQuery({ queryKey: ['cases'], queryFn: () => apiFetch('/api/v1/cases') });
  const cases = data?.data || [];
  if (cases.length === 0) return <ZeroState message="No cases yet." />;
  return (
    <div className="p-6">
      <h2 className="text-lg font-semibold mb-4">Dashboard</h2>
      <p className="text-sm text-gray-600">{cases.length} case(s) in this jurisdiction.</p>
    </div>
  );
}
