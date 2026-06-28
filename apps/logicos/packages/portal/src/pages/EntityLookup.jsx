import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { caseApiFetch } from '../api/client';

export default function EntityLookup() {
  const [email, setEmail]           = useState('');
  const [caseNumber, setCaseNumber] = useState('');
  const [error, setError]           = useState(null);
  const [loading, setLoading]       = useState(false);
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await caseApiFetch('/api/v1/entity/lookup', {
        method: 'POST',
        body:   JSON.stringify({ email, case_number: caseNumber }),
      });
      const { token, expires_at, case_id } = res.data;
      sessionStorage.setItem('logicos_entity_token', token);
      sessionStorage.setItem('logicos_entity_meta', JSON.stringify({ expires_at, case_id }));
      navigate(`/case/${caseNumber}`);
    } catch (err) {
      if (err.status === 403) {
        setError('This case is registered to a different email address.');
      } else if (err.status === 404) {
        setError('Case not found. Check your case number and try again.');
      } else {
        setError(err.message || 'Lookup failed.');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-sm mx-auto p-6">
      <h1 className="text-2xl font-semibold mb-6">Check Your Case</h1>
      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}
      <form onSubmit={handleSubmit} className="space-y-4">
        <input
          type="email" value={email} onChange={e => setEmail(e.target.value)}
          placeholder="Email address" required
          className="w-full border rounded-lg px-3 py-2 text-sm"
        />
        <input
          value={caseNumber} onChange={e => setCaseNumber(e.target.value.toUpperCase())}
          placeholder="Case number (e.g. DEMO-2026-00001)" required
          pattern="[A-Z]+-\d{4}-\d{5}"
          className="w-full border rounded-lg px-3 py-2 text-sm font-mono"
        />
        <button type="submit" disabled={loading}
          className="w-full bg-blue-600 text-white py-2 rounded-lg text-sm font-medium disabled:opacity-50">
          {loading ? 'Looking up…' : 'Access My Case'}
        </button>
      </form>
    </div>
  );
}
