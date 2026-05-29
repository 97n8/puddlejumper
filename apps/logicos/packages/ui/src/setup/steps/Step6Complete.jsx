import { apiFetch } from '../../api/client';
import { useNavigate } from 'react-router-dom';

export default function Step6Complete() {
  const navigate = useNavigate();

  async function finish() {
    await apiFetch('/api/v1/org-manager/complete', { method: 'POST', body: JSON.stringify({}) });
    navigate('/workbench');
  }

  return (
    <div className="space-y-4 text-center">
      <h2 className="text-xl font-semibold">Setup Complete</h2>
      <p className="text-sm text-gray-600">Your organization is configured. Click below to open the workbench.</p>
      <button onClick={finish} className="w-full bg-green-600 text-white py-2 rounded text-sm font-medium">Open Workbench</button>
    </div>
  );
}
