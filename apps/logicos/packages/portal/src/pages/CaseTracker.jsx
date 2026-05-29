import { useQuery } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import { caseApiFetch } from '../api/client';

const STAGES = ['RECEIVES','OPENS','WORKS','DECIDES','RECORDS','NOTIFIES','ARCHIVES','LEARNS'];

function CaseTimeline({ currentStage }) {
  const idx = STAGES.indexOf(currentStage);
  return (
    <div className="flex gap-1 mb-6">
      {STAGES.map((s, i) => (
        <div key={s} className="flex-1 text-center">
          <div className={`h-2 rounded ${i < idx ? 'bg-green-400' : i === idx ? 'bg-blue-500' : 'bg-gray-200'}`} />
          <p className="text-[9px] mt-1 text-gray-400 truncate">{s}</p>
        </div>
      ))}
    </div>
  );
}

function SealAuditLink({ caseId }) {
  const { data } = useQuery({
    queryKey: ['seal', caseId],
    queryFn:  () => caseApiFetch(`/api/v1/seal/chain?object_id=${caseId}`),
  });
  const entries = data?.data || [];
  if (entries.length === 0) return null;

  return (
    <div className="mt-6">
      <p className="text-xs font-medium text-gray-500 mb-2">Audit Trail</p>
      <div className="space-y-1">
        {entries.slice(-5).map(e => (
          <p key={e.id} className="text-[10px] font-mono text-gray-400 truncate">
            #{e.sequence} {e.entry_type} — {e.entry_hash.slice(0, 12)}…
          </p>
        ))}
      </div>
    </div>
  );
}

export default function CaseTracker() {
  const { caseNumber } = useParams();

  const { data: caseData, isLoading } = useQuery({
    queryKey: ['case', caseNumber],
    queryFn:  () => caseApiFetch(`/api/v1/cases?case_number=${caseNumber}`),
  });

  const caseRow = caseData?.data?.[0];

  const { data: oblData } = useQuery({
    queryKey: ['obligations', caseRow?.id],
    queryFn:  () => caseRow ? caseApiFetch(`/api/v1/cases/${caseRow.id}/obligations`) : null,
    enabled:  !!caseRow,
  });
  const obligations = oblData?.data || [];

  if (isLoading) return <p className="p-6 text-sm text-gray-400">Loading…</p>;
  if (!caseRow)  return <p className="p-6 text-sm text-red-500">Case not found.</p>;

  const sideB = obligations.filter(o => o.assigned_side === 'B');

  return (
    <div className="max-w-xl mx-auto p-6">
      <p className="text-xs text-gray-400 font-mono mb-1">{caseRow.case_number}</p>
      <h1 className="text-xl font-semibold mb-4">{caseRow.case_type}</h1>

      <CaseTimeline currentStage={caseRow.stage} />

      {sideB.length > 0 && (
        <div className="mb-6">
          <h2 className="text-sm font-medium text-gray-700 mb-2">Your Obligations</h2>
          <div className="space-y-2">
            {sideB.map(o => (
              <div key={o.id} className="p-3 bg-white border rounded-lg">
                <p className="text-sm">{o.description}</p>
                <p className="text-xs text-gray-400 mt-1">{o.status}{o.due_date ? ` · Due ${o.due_date.split('T')[0]}` : ''}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <SealAuditLink caseId={caseRow.id} />
    </div>
  );
}
