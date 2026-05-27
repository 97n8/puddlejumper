'use client';

// TemplateModal — "+ Process" picker.
// On submit, calls the parent's onCreate with the full payload required by
// POST /api/prr: { template_id, domain, title, notes, due, automation, steps }.

import { useState } from 'react';
import {
  AUTOMATIONS,
  TEMPLATES,
  type AutomationOption,
  type ProcessTemplate,
} from '../../lib/templates';

export interface CreatePayload {
  template_id: string;
  domain: ProcessTemplate['domain'];
  title: string;
  notes: string;
  due: string | null;
  automation: AutomationOption;
  steps: string[];
}

interface Props {
  open: boolean;
  submitting: boolean;
  error: string | null;
  onClose: () => void;
  onCreate: (payload: CreatePayload) => void;
}

export default function TemplateModal({ open, submitting, error, onClose, onCreate }: Props) {
  const [pickedId, setPickedId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [due, setDue] = useState('');
  const [automation, setAutomation] = useState<AutomationOption>('none');

  if (!open) return null;

  const picked = TEMPLATES.find((t) => t.id === pickedId) ?? null;

  function reset(): void {
    setPickedId(null);
    setTitle('');
    setNotes('');
    setDue('');
    setAutomation('none');
  }

  function submit(): void {
    if (!picked || !title.trim()) return;
    onCreate({
      template_id: picked.id,
      domain: picked.domain,
      title: title.trim(),
      notes: notes.trim(),
      due: due.trim() ? new Date(due).toISOString() : null,
      automation,
      steps: [...picked.steps],
    });
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(26, 25, 22, 0.4)' }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl rounded shadow-lg max-h-[85vh] overflow-y-auto"
        style={{ background: 'var(--s0)', border: '1px solid var(--bd)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <header
          className="px-5 py-3 flex items-center justify-between"
          style={{ borderBottom: '1px solid var(--bd)' }}
        >
          <h2 className="text-[18px]" style={{ fontFamily: 'var(--display)' }}>
            New process
          </h2>
          <button
            type="button"
            onClick={() => { reset(); onClose(); }}
            aria-label="Close"
            className="text-[18px]"
            style={{ color: 'var(--ink3)' }}
          >
            ×
          </button>
        </header>

        {/* Step 1 — pick a template */}
        <section className="px-5 py-4" style={{ borderBottom: '1px solid var(--bd)' }}>
          <h3
            className="text-[10px] uppercase tracking-wider mb-3"
            style={{ color: 'var(--ink3)', fontFamily: 'var(--mono)' }}
          >
            Choose a template
          </h3>
          <ul className="grid grid-cols-3 gap-2">
            {TEMPLATES.map((t) => {
              const isActive = t.id === pickedId;
              return (
                <li key={t.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setPickedId(t.id);
                      if (t.default_automation) setAutomation(t.default_automation);
                    }}
                    className="w-full text-left p-3 rounded border"
                    style={{
                      borderColor: isActive ? 'var(--g-bd)' : 'var(--bd)',
                      background: isActive ? 'var(--g-lt)' : 'var(--s0)',
                    }}
                  >
                    <p
                      className="text-[10px] uppercase tracking-wider"
                      style={{ color: 'var(--ink3)', fontFamily: 'var(--mono)' }}
                    >
                      {t.domain}
                    </p>
                    <p className="text-[13px] mt-1" style={{ color: 'var(--ink)' }}>
                      {t.label}
                    </p>
                    <p
                      className="text-[10px] mt-1"
                      style={{ color: 'var(--ink3)', fontFamily: 'var(--mono)' }}
                    >
                      {t.steps.length} steps
                    </p>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>

        {/* Step 2 — fill */}
        {picked && (
          <section className="px-5 py-4" style={{ borderBottom: '1px solid var(--bd)' }}>
            <div className="grid grid-cols-2 gap-3">
              <label className="block col-span-2">
                <span className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--ink3)', fontFamily: 'var(--mono)' }}>
                  Title
                </span>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={picked.label}
                  className="mt-1 w-full px-2 py-1.5 rounded border text-[13px]"
                  style={{ borderColor: 'var(--bd)', background: 'var(--s0)' }}
                />
              </label>
              <label className="block">
                <span className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--ink3)', fontFamily: 'var(--mono)' }}>
                  Due
                </span>
                <input
                  type="date"
                  value={due}
                  onChange={(e) => setDue(e.target.value)}
                  className="mt-1 w-full px-2 py-1.5 rounded border text-[13px]"
                  style={{ borderColor: 'var(--bd)', background: 'var(--s0)' }}
                />
              </label>
              <label className="block">
                <span className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--ink3)', fontFamily: 'var(--mono)' }}>
                  Automation
                </span>
                <select
                  value={automation}
                  onChange={(e) => setAutomation(e.target.value as AutomationOption)}
                  className="mt-1 w-full px-2 py-1.5 rounded border text-[13px]"
                  style={{ borderColor: 'var(--bd)', background: 'var(--s0)' }}
                >
                  {AUTOMATIONS.map((a) => (
                    <option key={a.id} value={a.id}>{a.label}</option>
                  ))}
                </select>
              </label>
              <label className="block col-span-2">
                <span className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--ink3)', fontFamily: 'var(--mono)' }}>
                  Notes
                </span>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  className="mt-1 w-full px-2 py-1.5 rounded border text-[13px]"
                  style={{ borderColor: 'var(--bd)', background: 'var(--s0)' }}
                />
              </label>
            </div>
            <p className="mt-3 text-[11px]" style={{ color: 'var(--ink3)', fontFamily: 'var(--mono)' }}>
              Steps will be materialized by the API: {picked.steps.join(' → ')}
            </p>
          </section>
        )}

        {error && (
          <p
            className="px-5 py-3 text-[12px]"
            style={{ color: 'var(--red)', fontFamily: 'var(--mono)' }}
          >
            {error}
          </p>
        )}

        <footer className="px-5 py-3 flex justify-end gap-2">
          <button
            type="button"
            onClick={() => { reset(); onClose(); }}
            className="text-[12px] px-3 py-1.5 rounded"
            style={{ color: 'var(--ink3)', fontFamily: 'var(--mono)' }}
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!picked || !title.trim() || submitting}
            onClick={submit}
            className="text-[12px] px-3 py-1.5 rounded"
            style={{
              background: !picked || !title.trim() ? 'var(--s2)' : 'var(--g)',
              color: !picked || !title.trim() ? 'var(--ink3)' : 'white',
              fontFamily: 'var(--mono)',
              opacity: submitting ? 0.6 : 1,
            }}
          >
            {submitting ? 'Creating…' : 'Create'}
          </button>
        </footer>
      </div>
    </div>
  );
}
