import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../../api/client';
import { useCaseStore } from '../../store/caseStore';
import ZeroState from './ZeroState';

export default function ObligationsPanel() {
  const activeCaseId = useCaseStore(s => s.activeCaseId);
  const { data } = useQuery({
    queryKey: ['obligations', activeCaseId],
    queryFn:  () => activeCaseId ? apiFetch(`/api/v1/cases/${activeCaseId}/obligations`) : null,
    enabled:  !!activeCaseId,
  });
  const obls = data?.data || [];

  if (!activeCaseId) return <ZeroState message="Select a case to view obligations." />;
  if (obls.length === 0) return <ZeroState message="No obligations for this case." />;

  return (
    <div className="p-6">
      <h2 className="text-lg font-semibold mb-4">Obligations</h2>
      <div className="space-y-2">
        {obls.map(o => (
          <div key={o.id} className="p-3 bg-white rounded-lg border">
            <p className="text-sm font-medium">{o.description}</p>
            <p className="text-xs text-gray-500 mt-1">Side {o.assigned_side} · {o.status}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
