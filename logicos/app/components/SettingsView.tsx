import { Save } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import type { Endpoints } from '../types';
import { haptic } from '../lib/haptic';

interface SettingsViewProps {
  endpoints: Endpoints;
  onSave: (endpoints: Endpoints) => void;
}

export function SettingsView({ endpoints, onSave }: SettingsViewProps) {
  const [formData, setFormData] = useState(endpoints);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    onSave(formData);
    haptic('success');
  };

  return (
    <div className="flex flex-col h-full bg-gray-50 overflow-y-auto">
      <div className="p-4">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Settings</h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="puddleJumper" className="block text-sm font-medium text-gray-700 mb-1">
              PuddleJumper URL
            </label>
            <input
              id="puddleJumper"
              type="url"
              value={formData.puddleJumper}
              onChange={(e) => setFormData({ ...formData, puddleJumper: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label htmlFor="vaultIntake" className="block text-sm font-medium text-gray-700 mb-1">
              VAULT Intake URL
            </label>
            <input
              id="vaultIntake"
              type="url"
              value={formData.vaultIntake}
              onChange={(e) => setFormData({ ...formData, vaultIntake: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label htmlFor="publicLogic" className="block text-sm font-medium text-gray-700 mb-1">
              PublicLogic URL
            </label>
            <input
              id="publicLogic"
              type="url"
              value={formData.publicLogic}
              onChange={(e) => setFormData({ ...formData, publicLogic: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label htmlFor="aiModel" className="block text-sm font-medium text-gray-700 mb-1">
              AI Model
            </label>
            <select
              id="aiModel"
              value={formData.aiModel}
              onChange={(e) => setFormData({ ...formData, aiModel: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="claude-sonnet-4-6">Claude Sonnet 4.6</option>
              <option value="claude-opus-4-7">Claude Opus 4.7</option>
              <option value="claude-haiku-4-5">Claude Haiku 4.5</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <input
              id="aiEnabled"
              type="checkbox"
              checked={formData.aiEnabled}
              onChange={(e) => setFormData({ ...formData, aiEnabled: e.target.checked })}
              className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-2 focus:ring-blue-500"
            />
            <label htmlFor="aiEnabled" className="text-sm font-medium text-gray-700">
              Enable AI Features
            </label>
          </div>

          <button
            type="submit"
            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Save className="w-4 h-4" aria-hidden="true" />
            <span>Save Settings</span>
          </button>
        </form>

        <div className="mt-8 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <h3 className="text-sm font-semibold text-blue-900 mb-2">About logicOS</h3>
          <p className="text-xs text-blue-800">Version 1.0</p>
          <p className="text-xs text-blue-700 mt-2">
            A case management system for PublicLogic operations
          </p>
        </div>
      </div>
    </div>
  );
}
