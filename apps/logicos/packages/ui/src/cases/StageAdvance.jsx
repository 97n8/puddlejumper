import { useState } from 'react';
import { apiFetch } from '../api/client';

const STAGE_ORDER = ['RECEIVES','OPENS','WORKS','DECIDES','RECORDS','NOTIFIES','ARCHIVES','LEARNS'];

export default function StageAdvance({ caseRow, onAdvanced }) {
  const [authorityBasis, setAuthorityBasis] = useState('');
  const [error, setError] = useState(null);

  const currentIdx = STAGE_ORDER.indexOf(caseRow?.stage);
  const nextStage  = STAGE_ORDER[currentIdx + 1];

  async function advance() {
    if (!authorityBasis.trim()) {
      return setError('Authority basis is required before advancing stage.');
    }
    setError(null);
    try {
      await apiFetch(`/api/v1/cases/${caseRow.id}/actions`, {
        method: 'POST',
        body:   JSON.stringify({
          action_type: 'stage_advance',
          side: 'A',
          description: authorityBasis,
          metadata: { from_stage: caseRow.stage, to_stage: nextStage },
        }),
      });
      onAdvanced?.();
    } catch (err) {
      setError(err.message);
    }
  }

  if (!nextStage) return <p className="text-sm text-gray-400">Final stage reached.</p>;

  return (
    <div className="space-y-2 mt-4">
      {error && <p className="text-sm text-red-500">{error}</p>}
      <textarea
        className="w-full border rounded p-2 text-sm" rows={2}
        placeholder="Authority basis for advancing stage (required)"
        value={authorityBasis} onChange={e => setAuthorityBasis(e.target.value)}
      />
      <button onClick={advance}
        className="bg-blue-600 text-white px-4 py-2 rounded text-sm">
        Advance to {nextStage}
      </button>
    </div>
  );
}
