import { useState } from 'react';
import { apiFetch } from '../../api/client';

export default function Step3Staff({ onComplete }) {
  const [form, setForm] = useState({ email: '', password: '', name: '' });
  const [error, setError] = useState(null);

  async function submit(e) {
    e.preventDefault();
    try {
      await apiFetch('/api/v1/org-manager/staff', { method: 'POST', body: JSON.stringify(form) });
      onComplete();
    } catch (err) { setError(err.message); }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <h2 className="text-xl font-semibold">Add First Staff Member</h2>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <input className="w-full border rounded px-3 py-2 text-sm" placeholder="Full name" value={form.name} onChange={e => setForm(f => ({...f, name: e.target.value}))} required />
      <input className="w-full border rounded px-3 py-2 text-sm" type="email" placeholder="Email" value={form.email} onChange={e => setForm(f => ({...f, email: e.target.value}))} required />
      <input className="w-full border rounded px-3 py-2 text-sm" type="password" placeholder="Password" value={form.password} onChange={e => setForm(f => ({...f, password: e.target.value}))} required />
      <button type="submit" className="w-full bg-blue-600 text-white py-2 rounded text-sm font-medium">Next</button>
    </form>
  );
}
