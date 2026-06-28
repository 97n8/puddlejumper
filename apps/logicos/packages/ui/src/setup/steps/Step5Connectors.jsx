import { useState } from 'react';
import { apiFetch } from '../../api/client';

export default function Step5Connectors({ onComplete }) {
  const [token, setToken] = useState('');

  async function finish() {
    await apiFetch('/api/v1/org-manager/connectors', { method: 'POST', body: JSON.stringify({ connector_token: token }) });
    onComplete();
  }

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">PuddleJumper Connector</h2>
      <p className="text-sm text-gray-600">Paste your PuddleJumper connector token below, or leave blank to skip.</p>
      <input className="w-full border rounded px-3 py-2 text-sm font-mono" placeholder="Connector token (optional)" value={token} onChange={e => setToken(e.target.value)} />
      <button onClick={finish} className="w-full bg-blue-600 text-white py-2 rounded text-sm font-medium">Next</button>
    </div>
  );
}
