import { useState } from 'react';
import { apiFetch } from '../api/client';

export default function DeficiencyForm({ caseId, onDone }) {
  const [description, setDescription] = useState('');

  async function submit(e) {
    e.preventDefault();
    await apiFetch(`/api/v1/cases/${caseId}/actions`, {
      method: 'POST',
      body: JSON.stringify({ action_type: 'deficiency_request', side: 'A', description }),
    });
    onDone?.();
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <textarea
        className="w-full border rounded p-2 text-sm" rows={4}
        placeholder="Describe the deficiency…"
        value={description} onChange={e => setDescription(e.target.value)} required
      />
      <button type="submit" className="bg-yellow-500 text-white px-4 py-2 rounded text-sm">
        Send Deficiency Notice
      </button>
    </form>
  );
}
