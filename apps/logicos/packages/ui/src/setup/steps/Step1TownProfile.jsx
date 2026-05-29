import { useState } from 'react';
import { apiFetch } from '../../api/client';

export default function Step1TownProfile({ onComplete }) {
  const [form, setForm] = useState({ name: '', state: 'MA', slug: '', timezone: 'America/New_York', fiscal_year_start: '07-01' });
  const [error, setError] = useState(null);

  async function submit(e) {
    e.preventDefault();
    try {
      await apiFetch('/api/v1/org-manager/town', { method: 'POST', body: JSON.stringify(form) });
      onComplete();
    } catch (err) { setError(err.message); }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <h2 className="text-xl font-semibold">Town Profile</h2>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <input className="w-full border rounded px-3 py-2 text-sm" placeholder="Municipality name" value={form.name} onChange={e => setForm(f => ({...f, name: e.target.value}))} required />
      <input className="w-full border rounded px-3 py-2 text-sm" placeholder="URL slug (e.g. springfield)" value={form.slug} onChange={e => setForm(f => ({...f, slug: e.target.value}))} required />
      <button type="submit" className="w-full bg-blue-600 text-white py-2 rounded text-sm font-medium">Next</button>
    </form>
  );
}
