import { useState, type FormEvent } from 'react';
import { Send, Check, AlertCircle, Clock } from 'lucide-react';
import type { Case, Capture } from '../types';
import { haptic } from '../lib/haptic';

interface CaptureViewProps {
  cases: Case[];
  onCapture: (text: string, caseId?: string) => void;
  recentCaptures: Capture[];
}

export function CaptureView({ cases, onCapture, recentCaptures }: CaptureViewProps) {
  const [text, setText] = useState('');
  const [selectedCaseId, setSelectedCaseId] = useState<string>('');

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;

    onCapture(text, selectedCaseId || undefined);
    setText('');
    setSelectedCaseId('');
    haptic('success');
  };

  return (
    <div className="flex flex-col h-full bg-gray-50">
      <form onSubmit={handleSubmit} className="p-4 bg-white border-b border-gray-200">
        <label htmlFor="capture-case" className="block text-sm font-medium text-gray-700 mb-2">
          Send to case
        </label>
        <select
          id="capture-case"
          value={selectedCaseId}
          onChange={(e) => setSelectedCaseId(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg mb-3 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">0_INBOX (no case)</option>
          {cases.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>

        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Capture thought, task, or note..."
          className="w-full px-3 py-2 border border-gray-300 rounded-lg resize-none text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
          rows={4}
          aria-label="Capture text"
        />

        <button
          type="submit"
          disabled={!text.trim()}
          className="mt-3 w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <Send className="w-4 h-4" aria-hidden="true" />
          <span>Send to VAULT</span>
        </button>
      </form>

      <div className="flex-1 overflow-y-auto p-4">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Recent Captures</h3>
        {recentCaptures.length === 0 ? (
          <p className="text-sm text-gray-500 text-center py-8">No captures yet</p>
        ) : (
          <div className="space-y-2">
            {recentCaptures.map((capture) => (
              <div
                key={capture.id}
                className="p-3 bg-white rounded-lg border border-gray-200"
              >
                <div className="flex items-start justify-between gap-2 mb-1">
                  <p className="text-sm text-gray-900 flex-1">{capture.text}</p>
                  {capture.sentToVault ? (
                    <Check className="w-4 h-4 text-green-600 shrink-0" aria-label="Sent to VAULT" />
                  ) : capture.failedToVault ? (
                    <AlertCircle className="w-4 h-4 text-red-600 shrink-0" aria-label="Failed to send" />
                  ) : (
                    <Clock className="w-4 h-4 text-amber-600 shrink-0" aria-label="Pending" />
                  )}
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <span>{new Date(capture.ts).toLocaleTimeString()}</span>
                  {capture.caseId && (
                    <>
                      <span>•</span>
                      <span className="text-blue-600">
                        {cases.find(c => c.id === capture.caseId)?.name || 'Unknown case'}
                      </span>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
