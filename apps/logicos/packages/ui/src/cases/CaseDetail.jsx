import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../api/client';

export default function CaseDetail({ caseId }) {
  const { data, isLoading } = useQuery({
    queryKey: ['case', caseId],
    queryFn:  () => apiFetch(`/api/v1/cases/${caseId}`),
    enabled:  !!caseId,
  });

  if (isLoading) return <p className="text-sm text-gray-400">Loading…</p>;
  const c = data?.data;
  if (!c) return <p className="text-sm text-red-500">Case not found.</p>;

  return (
    <div className="p-4 space-y-2">
      <p className="font-mono text-sm text-gray-500">{c.case_number}</p>
      <p className="font-semibold">{c.case_type}</p>
      <p className="text-xs text-gray-400">Stage: {c.stage} · Status: {c.status}</p>
    </div>
  );
}
