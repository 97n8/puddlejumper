import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { discoveryFetch } from '../api/client';

function AnswerCard({ answer }) {
  if (!answer) return null;

  const { plain, citation, next_step, who_decides, common_catches, answer_source } = answer;

  return (
    <div className="mt-6 p-5 bg-white rounded-xl border shadow-sm space-y-3">
      {answer_source === 'rules_only' && (
        <div className="p-3 bg-yellow-50 border border-yellow-200 rounded text-sm text-yellow-800">
          This answer is based on published rules. An AI-assisted summary was unavailable.
          Contact your town hall to confirm.
        </div>
      )}
      {answer_source === 'rules_only_no_match' && (
        <div className="p-3 bg-red-50 border border-red-200 rounded text-sm text-red-800">
          We could not find specific rules for this request. Contact your municipality directly.
        </div>
      )}
      <p className="text-gray-900 text-sm leading-relaxed">{plain}</p>
      {citation && <p className="text-xs text-gray-500">Citation: {citation}</p>}
      {next_step && <p className="text-sm font-medium text-blue-700">Next step: {next_step}</p>}
      {who_decides && <p className="text-xs text-gray-500">Decided by: {who_decides}</p>}
      {Array.isArray(common_catches) && common_catches.length > 0 && (
        <div>
          <p className="text-xs font-medium text-gray-500 mb-1">Common considerations:</p>
          <ul className="list-disc list-inside space-y-0.5">
            {common_catches.map((c, i) => (
              <li key={i} className="text-xs text-gray-700">{c}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export default function Discover() {
  const [address, setAddress]   = useState('');
  const [query, setQuery]       = useState('');
  const [result, setResult]     = useState(null);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState(null);

  async function handleSearch(e) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await discoveryFetch('/api/v1/discover/query', {
        method: 'POST',
        body:   JSON.stringify({ raw_query: query, address }),
      });
      setResult(res.data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-xl mx-auto p-6">
      <h1 className="text-2xl font-semibold mb-2">Permit Finder</h1>
      <p className="text-sm text-gray-500 mb-6">Describe your project and we'll check what permits may be required.</p>
      <form onSubmit={handleSearch} className="space-y-3">
        <input
          type="text" value={address} onChange={e => setAddress(e.target.value)}
          placeholder="Property address (optional)"
          className="w-full border rounded-lg px-3 py-2 text-sm"
        />
        <textarea
          value={query} onChange={e => setQuery(e.target.value)}
          placeholder="Describe your project (e.g. 'I want to build a 10×12 shed in my backyard')"
          rows={3} required
          className="w-full border rounded-lg px-3 py-2 text-sm"
        />
        <button type="submit" disabled={loading}
          className="w-full bg-blue-600 text-white py-2 rounded-lg text-sm font-medium disabled:opacity-50">
          {loading ? 'Checking rules…' : 'Check Requirements'}
        </button>
      </form>
      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
      {result && <AnswerCard answer={result.answer} />}
    </div>
  );
}
