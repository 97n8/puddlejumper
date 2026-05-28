/**
 * generatePublicForm — creates a self-contained HTML intake form
 * that towns can host on their website for public records requests.
 *
 * SECURITY NOTE: every interpolated value here is operator-controlled (RAO name,
 * email, phone, town name, field labels/placeholders). All values must pass
 * through escapeHtml/escapeAttr/escapeJsString helpers — never insert raw `${x}`.
 */
import type { VaultModuleSettings } from '../types'
import { getModuleDef } from './moduleIntakeFields'
import { escapeHtml, escapeAttr, escapeJsString, safeMailtoEmail } from '@/lib/htmlSafe'

export function generatePublicForm(
  moduleId: string,
  settings: VaultModuleSettings,
  town: string,
): string {
  const mod = getModuleDef(moduleId)
  const primaryRAO = settings.raos.find(r => r.isPrimary) ?? settings.raos[0]
  const rawRaoEmail = primaryRAO?.email ?? settings.notificationEmail ?? ''
  const raoEmail = safeMailtoEmail(rawRaoEmail) // returns '' if not a clean email
  const raoName = primaryRAO?.name ?? 'Records Access Officer'
  const raoPhone = primaryRAO?.phone ?? ''
  const year = new Date().getFullYear()

  // Generate form field HTML — every field-derived value escaped.
  const fieldHTML = mod.intakeFields.map(f => {
    const req = f.required ? '<span style="color:#dc2626">*</span>' : ''
    const hintHTML = f.hint ? `<div class="hint">${escapeHtml(f.hint)}</div>` : ''
    const inputId = `field_${escapeAttr(f.key)}`
    const nameAttr = escapeAttr(f.key)
    const placeholderAttr = escapeAttr(f.placeholder ?? '')
    const requiredAttr = f.required ? 'required' : ''

    let input = ''
    if (f.type === 'textarea') {
      input = `<textarea id="${inputId}" name="${nameAttr}" rows="4" ${requiredAttr} placeholder="${placeholderAttr}"></textarea>`
    } else if (f.type === 'select') {
      const options = (f.options ?? [])
        .map(o => `<option value="${escapeAttr(o)}">${escapeHtml(o)}</option>`)
        .join('')
      input = `<select id="${inputId}" name="${nameAttr}" ${requiredAttr}><option value="">Select…</option>${options}</select>`
    } else if (f.type === 'radio' && f.options) {
      input = `<div class="radio-group">${f.options.map(o =>
        `<label class="radio-label"><input type="radio" name="${nameAttr}" value="${escapeAttr(o)}" ${requiredAttr}> ${escapeHtml(o)}</label>`
      ).join('')}</div>`
    } else {
      const inputType = f.type === 'phone' ? 'tel'
        : f.type === 'email' ? 'email'
        : f.type === 'date' ? 'date'
        : f.type === 'number' ? 'number'
        : 'text'
      input = `<input type="${inputType}" id="${inputId}" name="${nameAttr}" ${requiredAttr} placeholder="${placeholderAttr}">`
    }

    return `<div class="field"><label for="${inputId}">${escapeHtml(f.label)} ${req}</label>${input}${hintHTML}</div>`
  }).join('\n')

  const moduleLabel = moduleId === 'VAULTPRR' ? 'Public Records Request' : mod.moduleId
  const moduleLabelHtml = escapeHtml(moduleLabel)
  const townHtml = escapeHtml(town)
  const raoEmailHtml = escapeHtml(raoEmail)
  const raoEmailAttr = escapeAttr(raoEmail)
  const raoEmailJs = escapeJsString(raoEmail) // NOTE: includes surrounding quotes
  const raoNameHtml = escapeHtml(raoName)
  const raoPhoneHtml = escapeHtml(raoPhone)

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${moduleLabelHtml} — Town of ${townHtml}</title>
<style>
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
html { font-size: 16px; }
body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  background: #f8fafc;
  color: #1e293b;
  line-height: 1.6;
  padding: 0;
}
.site-header {
  background: #0f172a;
  color: white;
  padding: 16px 24px;
  display: flex;
  align-items: center;
  gap: 16px;
}
.site-header .seal {
  width: 48px; height: 48px;
  border-radius: 50%;
  background: linear-gradient(135deg, #1e40af, #1d4ed8);
  display: flex; align-items: center; justify-content: center;
  font-size: 22px; flex-shrink: 0;
}
.site-header .town-name { font-size: 18px; font-weight: 700; }
.site-header .town-sub { font-size: 12px; opacity: 0.7; }
.page { max-width: 760px; margin: 0 auto; padding: 32px 24px 64px; }
.page-header { margin-bottom: 32px; }
.page-header h1 { font-size: 28px; font-weight: 700; color: #0f172a; margin-bottom: 6px; }
.page-header .subtitle { color: #64748b; font-size: 15px; }
.statute-box {
  background: #eff6ff;
  border: 1px solid #bfdbfe;
  border-radius: 10px;
  padding: 16px 20px;
  margin-bottom: 28px;
  font-size: 13px;
  color: #1e40af;
}
.statute-box strong { display: block; margin-bottom: 4px; font-weight: 700; }
.card {
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  padding: 28px;
  margin-bottom: 24px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.06);
}
.card h2 { font-size: 15px; font-weight: 700; color: #0f172a; margin-bottom: 20px; padding-bottom: 12px; border-bottom: 1px solid #f1f5f9; }
.field { margin-bottom: 18px; }
.field label { display: block; font-size: 13px; font-weight: 600; color: #374151; margin-bottom: 6px; }
.field input, .field select, .field textarea {
  width: 100%; padding: 10px 14px;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  font-size: 14px;
  font-family: inherit;
  color: #1e293b;
  background: #fafafa;
  transition: border-color 0.15s;
  outline: none;
}
.field input:focus, .field select:focus, .field textarea:focus {
  border-color: #3b82f6;
  background: white;
  box-shadow: 0 0 0 3px rgba(59,130,246,0.08);
}
.field .hint { font-size: 12px; color: #6b7280; margin-top: 5px; }
.radio-group { display: flex; flex-direction: column; gap: 8px; margin-top: 4px; }
.radio-label { display: flex; align-items: center; gap: 8px; font-size: 14px; font-weight: 400; cursor: pointer; }
.radio-label input { width: auto; }
.ref-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px 18px; margin-bottom: 20px; font-size: 13px; }
.ref-box .ref-num { font-family: monospace; font-size: 16px; font-weight: 700; color: #1e40af; letter-spacing: 0.05em; }
.btn-submit {
  width: 100%;
  background: #1e40af;
  color: white;
  border: none;
  border-radius: 10px;
  padding: 14px;
  font-size: 15px;
  font-weight: 700;
  cursor: pointer;
  transition: background 0.15s;
  font-family: inherit;
}
.btn-submit:hover { background: #1d4ed8; }
.what-next { background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 10px; padding: 20px 24px; margin-top: 24px; }
.what-next h3 { font-size: 14px; font-weight: 700; color: #166534; margin-bottom: 10px; }
.what-next ul { padding-left: 18px; font-size: 13px; color: #166534; }
.what-next li { margin-bottom: 4px; }
.contact-box { background: #fafafa; border: 1px solid #e2e8f0; border-radius: 10px; padding: 18px 20px; margin-top: 20px; }
.contact-box h3 { font-size: 13px; font-weight: 700; color: #374151; margin-bottom: 10px; }
.contact-row { display: flex; gap: 8px; font-size: 13px; color: #4b5563; margin-bottom: 4px; }
.contact-row strong { min-width: 60px; }
.footer { text-align: center; font-size: 11px; color: #94a3b8; margin-top: 48px; padding-top: 24px; border-top: 1px solid #f1f5f9; }
.success-banner { display: none; background: #f0fdf4; border: 2px solid #16a34a; border-radius: 12px; padding: 24px; text-align: center; margin-bottom: 24px; }
.success-banner h2 { color: #15803d; font-size: 20px; margin-bottom: 8px; }
.success-banner p { color: #166534; font-size: 14px; }
@media print {
  .site-header { background: #0f172a !important; -webkit-print-color-adjust: exact; }
  .btn-submit { display: none; }
  body { background: white; }
}
@media (max-width: 600px) {
  .page { padding: 20px 16px 48px; }
  .card { padding: 20px; }
}
</style>
</head>
<body>

<header class="site-header">
  <div class="seal">🏛️</div>
  <div>
    <div class="town-name">Town of ${townHtml}</div>
    <div class="town-sub">Massachusetts · Official Government Portal</div>
  </div>
</header>

<div class="page">
  <div id="successBanner" class="success-banner">
    <h2>✓ Request Submitted</h2>
    <p>Your reference number is: <strong id="successRef"></strong><br>Please save this number. The RAO will contact you within 10 business days.</p>
  </div>

  <div id="formArea">
    <div class="page-header">
      <h1>${moduleLabelHtml}</h1>
      <div class="subtitle">Town of ${townHtml}, Massachusetts — Powered by PublicLogic VAULT</div>
    </div>

    <div class="statute-box">
      <strong>Your Rights Under Massachusetts Law</strong>
      Under M.G.L. c. 66, §10, you have the right to inspect and obtain copies of public records.
      The town must respond within <strong>10 business days</strong> of receiving your request.
      If fees are not assessed within that period, no fees may be charged for this request.
    </div>

    <form id="prrForm" onsubmit="handleSubmit(event)">
      <div class="ref-box">
        <div style="font-size:12px;color:#6b7280;margin-bottom:4px">Your Request Reference Number</div>
        <div class="ref-num" id="refNum"></div>
        <div style="font-size:11px;color:#9ca3af;margin-top:4px">Generated automatically — save this number for your records</div>
      </div>

      <div class="card">
        <h2>Your Information</h2>
        ${fieldHTML}
      </div>

      <div class="card">
        <h2>Certification</h2>
        <div class="field">
          <label><input type="checkbox" id="certify" required style="width:auto;margin-right:8px">
          I certify that the information I have provided is accurate and that I am submitting this request in good faith under M.G.L. c. 66, §10.</label>
        </div>
      </div>

      <button type="submit" class="btn-submit">Submit Public Records Request →</button>
    </form>

    <div class="what-next">
      <h3>📋 What Happens Next</h3>
      <ul>
        <li>Your reference number is generated immediately — save it.</li>
        <li>The Records Access Officer will contact you within <strong>10 business days</strong>.</li>
        <li>You may be asked to clarify your request or pay a fee (only if T10 was met).</li>
        <li>Records will be delivered by your preferred method.</li>
        <li>If the town fails to respond within 10 business days, fees are prohibited by law.</li>
      </ul>
    </div>

    <div class="contact-box">
      <h3>Contact the Records Access Officer</h3>
      ${raoNameHtml ? `<div class="contact-row"><strong>RAO:</strong> ${raoNameHtml}</div>` : ''}
      ${raoEmail ? `<div class="contact-row"><strong>Email:</strong> <a href="mailto:${raoEmailAttr}">${raoEmailHtml}</a></div>` : ''}
      ${raoPhoneHtml ? `<div class="contact-row"><strong>Phone:</strong> ${raoPhoneHtml}</div>` : ''}
      <div class="contact-row" style="margin-top:8px;font-size:12px;color:#9ca3af">
        Town of ${townHtml} · Massachusetts · ${year}
      </div>
    </div>
  </div>
</div>

<div class="footer">
  Town of ${townHtml} · ${moduleLabelHtml} · ${year}<br>
  Managed by PublicLogic VAULT · publiclogic.org<br>
  Questions? Contact the Records Access Officer at ${raoEmail ? raoEmailHtml : 'town hall'}
</div>

<script>
// RAO email is injected as a JSON-encoded string literal — safe against
// </script> breakouts and quote injection.
var RAO_EMAIL = ${raoEmailJs};

// Generate reference number
function genRef() {
  var y = new Date().getFullYear();
  var r = Math.random().toString(36).substr(2,6).toUpperCase();
  return 'PRR-' + y + '-' + r;
}
var ref = genRef();
document.getElementById('refNum').textContent = ref;

function handleSubmit(e) {
  e.preventDefault();
  var form = document.getElementById('prrForm');
  var data = new FormData(form);

  // Build mailto body
  var body = 'PUBLIC RECORDS REQUEST\\n';
  body += 'Reference: ' + ref + '\\n';
  body += 'Submitted: ' + new Date().toLocaleString() + '\\n\\n';
  for (var pair of data.entries()) {
    body += pair[0] + ': ' + pair[1] + '\\n';
  }

  var subject = encodeURIComponent('Public Records Request — ' + ref);
  var bodyEnc = encodeURIComponent(body);
  if (!RAO_EMAIL) {
    document.getElementById('successBanner').style.display = 'block';
    document.getElementById('successRef').textContent = ref;
    document.getElementById('prrForm').style.display = 'none';
    window.scrollTo(0, 0);
    return;
  }
  var mailto = 'mailto:' + encodeURIComponent(RAO_EMAIL) + '?subject=' + subject + '&body=' + bodyEnc;

  // Show success
  document.getElementById('successBanner').style.display = 'block';
  document.getElementById('successRef').textContent = ref;
  document.getElementById('prrForm').style.display = 'none';
  window.scrollTo(0, 0);

  // Open mailto
  window.location.href = mailto;
}
</script>
</body>
</html>`
}
