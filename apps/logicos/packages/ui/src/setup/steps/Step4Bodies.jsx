import { apiFetch } from '../../api/client';

export default function Step4Bodies({ onComplete }) {
  async function finish() {
    await apiFetch('/api/v1/org-manager/bodies', { method: 'POST', body: JSON.stringify({}) });
    onComplete();
  }
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">Governing Bodies</h2>
      <p className="text-sm text-gray-600">Bodies can be added after setup. Continue to proceed.</p>
      <button onClick={finish} className="w-full bg-blue-600 text-white py-2 rounded text-sm font-medium">Next</button>
    </div>
  );
}
