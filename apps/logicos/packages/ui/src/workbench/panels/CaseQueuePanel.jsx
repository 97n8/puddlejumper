import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../../api/client';
import { useCaseStore } from '../../store/caseStore';
import ZeroState from './ZeroState';

export default function CaseQueuePanel() {
  const { data } = useQuery({ queryKey: ['cases'], queryFn: () => apiFetch('/api/v1/cases') });
  const cases = data?.data || [];
  const setActive = useCaseStore(s => s.setActiveCase);

  if (cases.length === 0) return <ZeroState message="No cases in queue." />;

  return (
    <div className="p-6">
      <h2 className="text-lg font-semibold mb-4">Case Queue</h2>
      <div className="space-y-2">
        {cases.map(c => (
          <button key={c.id} onClick={() => setActive(c.id)}
            className="w-full text-left p-3 bg-white rounded-lg border hover:border-blue-400 transition-colors">
            <span className="text-sm font-mono text-gray-500">{c.case_number}</span>
            <span className="ml-3 text-sm text-gray-900">{c.case_type}</span>
            <span className="ml-auto text-xs text-gray-400 float-right">{c.stage}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
