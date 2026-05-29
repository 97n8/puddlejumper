import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { apiFetch } from '../api/client';

export default function Login() {
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [error, setError]       = useState(null);
  const [loading, setLoading]   = useState(false);
  const setAuth = useAuthStore(s => s.setAuth);
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch('/api/v1/auth/token', {
        method: 'POST',
        body:   JSON.stringify({ email, password }),
      });
      setAuth({ token: res.data.token, actor: { email }, jurisdiction: null });
      navigate('/workbench');
    } catch (err) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  function handleSSO(provider) {
    window.location.href = `${import.meta.env.VITE_CASE_API_URL}/api/v1/auth/sso?provider=${provider}`;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-full max-w-sm p-8 bg-white rounded-xl shadow-sm">
        <h1 className="text-2xl font-semibold mb-6 text-gray-900">Staff Sign In</h1>
        {error && <p className="mb-4 text-sm text-red-600">{error}</p>}
        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="email" value={email} onChange={e => setEmail(e.target.value)}
            placeholder="Email" required
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <input
            type="password" value={password} onChange={e => setPassword(e.target.value)}
            placeholder="Password" required
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            type="submit" disabled={loading}
            className="w-full bg-blue-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
        <div className="mt-4 space-y-2">
          <button onClick={() => handleSSO('m365')}
            className="w-full border py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-50">
            Sign in with Microsoft
          </button>
          <button onClick={() => handleSSO('google')}
            className="w-full border py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-50">
            Sign in with Google
          </button>
        </div>
      </div>
    </div>
  );
}
