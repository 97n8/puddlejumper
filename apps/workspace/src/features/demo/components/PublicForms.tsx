import { useState } from 'react';
import { MOCK_PUBLIC_FORMS, type PublicForm } from '../data/mockData';
import { Globe, FileCode, ArrowUpRight, Copy, Check, AlertCircle, Shield } from 'lucide-react';

export function PublicForms() {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [previewForm, setPreviewForm] = useState<PublicForm | null>(null);

  const handleCopy = (form: PublicForm) => {
    navigator.clipboard.writeText(`<body data-town="Phillipston" data-org="org_phillipston">`);
    setCopiedId(form.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[#1A1D16]">Public HTML Intake Forms</h1>
        <p className="text-sm text-[#7A7870] mt-1">8 self-contained HTML files · No npm · No React · One file each · The town owns these</p>
      </div>

      <div className="bg-[#FBF5E6] border border-[#B8911E]/20 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <Shield className="w-5 h-5 text-[#B8911E] mt-0.5 shrink-0" />
          <div>
            <h4 className="text-sm text-[#1A1D16]">Rule 1: The town owns the HTML</h4>
            <p className="text-xs text-[#7A7870] mt-1 leading-relaxed">
              Public intake forms are self-contained HTML files. No npm. No React. No build step. One file.
              Works in any browser. Works on any CMS. The file must work if dropped into a CivicPlus, Municode, or plain webserver.
            </p>
          </div>
        </div>
      </div>

      <div className="bg-white border border-[#DDD8CE] rounded-lg p-4">
        <h3 className="text-[#1A1D16] mb-2">Town Customization</h3>
        <p className="text-xs text-[#7A7870] mb-3">The town sets these two data attributes on the body tag. Everything else is automatic.</p>
        <div className="bg-[#1A1D16] rounded-lg p-4 font-mono text-xs text-[#E8F2EB] overflow-x-auto">
          <span className="text-[#7A7870]">{'<!-- The town edits these two lines only -->'}</span><br />
          <span className="text-[#B8911E]">{'<body'}</span>{' '}
          <span className="text-[#2C5F2D]">data-town</span>=<span className="text-amber-300">"Phillipston"</span>{' '}
          <span className="text-[#2C5F2D]">data-org</span>=<span className="text-amber-300">"org_phillipston"</span>
          <span className="text-[#B8911E]">{'>'}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {MOCK_PUBLIC_FORMS.map(form => (
          <div key={form.id} className="bg-white border border-[#DDD8CE] rounded-lg overflow-hidden hover:border-[#2C5F2D]/30 transition-colors">
            <div className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2">
                  {form.method === 'POST' ? (
                    <div className="w-8 h-8 rounded-lg bg-[#E8F2EB] flex items-center justify-center">
                      <FileCode className="w-4 h-4 text-[#2C5F2D]" />
                    </div>
                  ) : (
                    <div className="w-8 h-8 rounded-lg bg-[#FBF5E6] flex items-center justify-center">
                      <Globe className="w-4 h-4 text-[#B8911E]" />
                    </div>
                  )}
                  <div>
                    <h4 className="text-sm text-[#1A1D16]">{form.title}</h4>
                    <p className="text-[10px] font-mono text-[#7A7870]">{form.filename}</p>
                  </div>
                </div>
                <span className={`text-[10px] px-2 py-0.5 rounded font-mono ${form.method === 'POST' ? 'bg-[#E8F2EB] text-[#2C5F2D]' : 'bg-[#FBF5E6] text-[#B8911E]'}`}>
                  {form.method}
                </span>
              </div>

              <p className="text-xs text-[#7A7870] mt-3 leading-relaxed">{form.description}</p>

              <div className="mt-3 text-[10px] font-mono text-[#7A7870]">
                <span className="text-[#7A7870]">Endpoint:</span> <span className="text-[#2C5F2D]">{form.endpoint}</span>
              </div>

              {form.fields.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1">
                  {form.fields.map(f => (
                    <span
                      key={f}
                      className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${f.endsWith('*') ? 'bg-[#FDEFEA] text-[#B84020]' : 'bg-gray-100 text-[#7A7870]'}`}
                    >
                      {f}
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div className="border-t border-[#DDD8CE] px-4 py-2.5 bg-[#F5F2EC] flex items-center gap-2">
              <button
                onClick={() => setPreviewForm(form)}
                className="text-xs text-[#2C5F2D] hover:underline flex items-center gap-1"
              >
                Preview <ArrowUpRight className="w-3 h-3" />
              </button>
              <span className="text-[#DDD8CE]">·</span>
              <button
                onClick={() => handleCopy(form)}
                className="text-xs text-[#7A7870] hover:text-[#2C5F2D] flex items-center gap-1"
              >
                {copiedId === form.id ? <><Check className="w-3 h-3" /> Copied</> : <><Copy className="w-3 h-3" /> Copy embed</>}
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-white border border-[#DDD8CE] rounded-lg p-5">
        <h3 className="text-[#1A1D16] mb-4">Form Behavior Requirements</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-[#7A7870]">
          {[
            { icon: Check, text: 'Client-side validation: required fields, email/phone format, inline errors' },
            { icon: Check, text: 'Posts to PJ as JSON with X-PuddleJumper-Request header' },
            { icon: Check, text: 'Success: shows confirmation panel with reference number' },
            { icon: Check, text: 'Error: shows banner above form without clearing fields' },
            { icon: Check, text: 'Accessibility: all labels associated, correct tab order' },
            { icon: AlertCircle, text: 'No cookies. No localStorage. No tracking of any kind.' },
            { icon: AlertCircle, text: 'No spinner libraries — simple "Submitting..." text state' },
            { icon: AlertCircle, text: 'No external dependencies — zero network requests except PJ POST' },
          ].map((item, i) => (
            <div key={i} className="flex items-start gap-2">
              <item.icon className="w-3.5 h-3.5 mt-0.5 shrink-0 text-[#2C5F2D]" />
              <span>{item.text}</span>
            </div>
          ))}
        </div>
      </div>

      {previewForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setPreviewForm(null)}>
          <div className="bg-[#F5F2EC] rounded-xl shadow-2xl w-full max-w-lg max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="bg-[#2C5F2D] text-white p-4 rounded-t-xl">
              <p className="text-xs opacity-60">Town of Phillipston</p>
              <h2 className="text-white mt-1">{previewForm.title}</h2>
            </div>
            <div className="p-5 space-y-4">
              {previewForm.fields.length > 0 ? (
                <>
                  {previewForm.fields.map(f => {
                    const name = f.replace('*', '');
                    const required = f.endsWith('*');
                    return (
                      <div key={f}>
                        <label className="text-sm text-[#1A1D16]">
                          {name.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                          {required && <span className="text-[#B84020] ml-1">*</span>}
                        </label>
                        {name.includes('description') || name.includes('qualifications') || name.includes('why_serve') ? (
                          <textarea className="w-full border border-[#DDD8CE] rounded-md px-3 py-2 text-sm mt-1 bg-white" rows={3} readOnly placeholder={`Enter ${name.replace(/_/g, ' ')}...`} />
                        ) : name.includes('type') || name.includes('format') || name.includes('choice') || name.includes('sex') ? (
                          <select className="w-full border border-[#DDD8CE] rounded-md px-3 py-2 text-sm mt-1 bg-white">
                            <option>Select...</option>
                          </select>
                        ) : name.includes('disclosure') || name.includes('spayed') ? (
                          <div className="flex gap-4 mt-1">
                            <label className="text-sm text-[#7A7870] flex items-center gap-1"><input type="radio" name={name} /> Yes</label>
                            <label className="text-sm text-[#7A7870] flex items-center gap-1"><input type="radio" name={name} /> No</label>
                          </div>
                        ) : name.includes('fee_waiver') ? (
                          <label className="flex items-center gap-2 mt-1 text-sm text-[#7A7870]"><input type="checkbox" /> Request fee waiver</label>
                        ) : (
                          <input type={name.includes('email') ? 'email' : name.includes('phone') ? 'tel' : 'text'} className="w-full border border-[#DDD8CE] rounded-md px-3 py-2 text-sm mt-1 bg-white" readOnly placeholder={`Enter ${name.replace(/_/g, ' ')}...`} />
                        )}
                      </div>
                    );
                  })}
                  <button className="w-full py-3 bg-[#2C5F2D] text-white rounded-lg text-sm hover:bg-[#234d24] transition-colors">
                    Submit
                  </button>
                </>
              ) : (
                <div className="text-center text-sm text-[#7A7870] py-8">
                  {previewForm.method === 'GET' ? 'This is a read-only form. Data loads automatically from PuddleJumper.' : 'No fields defined.'}
                </div>
              )}
            </div>
            <div className="border-t border-[#DDD8CE] p-3 text-center text-[10px] text-[#7A7870]">
              Powered by PublicLogic · This is a preview — actual form is self-contained HTML
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
