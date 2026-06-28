/**
 * generateFormTemplates — official government letter templates for PRR responses.
 * These are downloadable HTML documents with proper MA government formatting.
 *
 * SECURITY: every interpolated TemplateContext field is operator/requester
 * controlled and may contain HTML. Always pass through h() before embedding.
 */
import { escapeHtml } from '@/lib/htmlSafe'

interface TemplateContext {
  town: string
  caseNumber: string
  requesterName?: string
  requesterEmail?: string
  raoName?: string
  raoTitle?: string
  raoEmail?: string
  raoPhone?: string
  today: string
  exemptions?: string[]
  extensionDays?: number
  requestDescription?: string
}

const h = escapeHtml

const letterCSS = `
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: 'Times New Roman', Times, serif; font-size: 12pt; color: #000; background: white; padding: 1in; max-width: 8.5in; margin: 0 auto; line-height: 1.5; }
.letterhead { display: flex; align-items: flex-start; gap: 20px; margin-bottom: 32px; border-bottom: 2px solid #000; padding-bottom: 16px; }
.seal { width: 70px; height: 70px; border: 2px solid #000; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 28px; flex-shrink: 0; }
.letterhead-text h1 { font-size: 18pt; font-weight: bold; }
.letterhead-text h2 { font-size: 13pt; font-weight: normal; }
.letterhead-text p { font-size: 10pt; color: #444; }
.date { margin: 24px 0 16px; }
.address-block { margin-bottom: 24px; }
.salutation { margin-bottom: 16px; }
.body p { margin-bottom: 12px; text-indent: 0; }
.body .indent { padding-left: 32px; margin-bottom: 12px; }
.closing { margin-top: 32px; }
.signature-block { margin-top: 48px; }
.signature-block .name { font-weight: bold; border-top: 1px solid #000; display: inline-block; min-width: 200px; padding-top: 4px; margin-top: 8px; }
.citation { font-size: 10pt; margin-top: 24px; padding-top: 12px; border-top: 1px solid #ccc; color: #555; }
.ref-line { font-weight: bold; margin-bottom: 20px; }
@media print { body { padding: 0.75in; } }
`

function letterWrap(title: string, body: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>${h(title)}</title>
<style>${letterCSS}</style>
</head>
<body>${body}
<script>if (window.location.search.includes('print=1')) window.print()</script>
</body>
</html>`
}

function letterhead(town: string): string {
  return `<div class="letterhead">
  <div class="seal">🏛️</div>
  <div class="letterhead-text">
    <h1>Town of ${h(town)}</h1>
    <h2>Records Access Officer</h2>
    <p>Commonwealth of Massachusetts</p>
  </div>
</div>`
}

function addressBlock(ctx: TemplateContext): string {
  return `<div class="address-block">
  ${ctx.requesterName ? `${h(ctx.requesterName)}<br>` : ''}
  ${ctx.requesterEmail ? h(ctx.requesterEmail) : '[Requester Address]'}
</div>`
}

function signatureBlock(ctx: TemplateContext): string {
  return `<div class="signature-block">
  <div>${ctx.raoName ? h(ctx.raoName) : '[RAO Name]'}</div>
  <div class="name">${ctx.raoName ? h(ctx.raoName) : '_____________________'}</div>
  <div>${ctx.raoTitle ? h(ctx.raoTitle) : 'Records Access Officer'}</div>
  <div>Town of ${h(ctx.town)}</div>
  ${ctx.raoEmail ? `<div>${h(ctx.raoEmail)}</div>` : ''}
  ${ctx.raoPhone ? `<div>${h(ctx.raoPhone)}</div>` : ''}
</div>`
}

export function generateFullDisclosureLetter(ctx: TemplateContext): string {
  return letterWrap(`PRR Full Disclosure — ${ctx.caseNumber}`, `
${letterhead(ctx.town)}

<div class="date">${h(ctx.today)}</div>

${addressBlock(ctx)}

<div class="ref-line">RE: Public Records Request — ${h(ctx.caseNumber)}</div>

<div class="salutation">Dear ${h(ctx.requesterName ?? 'Requester')},</div>

<div class="body">
  <p>I am writing in response to your public records request received by the Town of ${h(ctx.town)}. I have completed a diligent search of Town records and am pleased to inform you that we are able to fulfill your request in full.</p>

  <p>Pursuant to your request, the responsive records are enclosed/attached with this letter. Please review the enclosed materials.</p>

  ${ctx.requestDescription ? `<p>Your request sought: <em>"${h(ctx.requestDescription)}"</em></p>` : ''}

  <p>You have the right to appeal this response to the Supervisor of Public Records if you believe any records were improperly withheld. An appeal must be filed within 90 calendar days of this response.</p>
</div>

<div class="closing">Sincerely,</div>

${signatureBlock(ctx)}

<div class="citation">
  M.G.L. c. 66, §10 — Public Records Law<br>
  950 CMR 32.00 — Supervisor of Public Records Regulations<br>
  Case Reference: ${h(ctx.caseNumber)}
</div>`)
}

export function generatePartialDisclosureLetter(ctx: TemplateContext, exemptionDetails: string[]): string {
  const exemptionList = exemptionDetails.map(e => `<li>${h(e)}</li>`).join('')
  return letterWrap(`PRR Partial Disclosure — ${ctx.caseNumber}`, `
${letterhead(ctx.town)}

<div class="date">${h(ctx.today)}</div>

${addressBlock(ctx)}

<div class="ref-line">RE: Public Records Request — ${h(ctx.caseNumber)} (Partial Disclosure)</div>

<div class="salutation">Dear ${h(ctx.requesterName ?? 'Requester')},</div>

<div class="body">
  <p>I am writing in response to your public records request received by the Town of ${h(ctx.town)}. I have completed a diligent search and am able to provide the following response.</p>

  <p>We are able to produce the responsive records <strong>in part</strong>. Certain portions of the records have been withheld or redacted pursuant to the following statutory exemptions under M.G.L. c. 4, §7(26):</p>

  <div class="indent"><ul>${exemptionList}</ul></div>

  <p>The remainder of the responsive records are enclosed/attached. Redactions are clearly marked on the documents.</p>

  <p>You have the right to appeal this response to the Supervisor of Public Records within <strong>90 calendar days</strong> of this letter. An appeal may be filed at the Office of the Secretary of State, Public Records Division.</p>
</div>

<div class="closing">Sincerely,</div>

${signatureBlock(ctx)}

<div class="citation">
  M.G.L. c. 4, §7(26) — Exemptions from Public Records<br>
  M.G.L. c. 66, §10 — Public Records Request Requirements<br>
  Case Reference: ${h(ctx.caseNumber)}
</div>`)
}

export function generateDenialLetter(ctx: TemplateContext, exemptionDetails: string[]): string {
  const exemptionList = exemptionDetails.map(e => `<li>${h(e)}</li>`).join('')
  return letterWrap(`PRR Denial — ${ctx.caseNumber}`, `
${letterhead(ctx.town)}

<div class="date">${h(ctx.today)}</div>

${addressBlock(ctx)}

<div class="ref-line">RE: Public Records Request — ${h(ctx.caseNumber)} (Denial)</div>

<div class="salutation">Dear ${h(ctx.requesterName ?? 'Requester')},</div>

<div class="body">
  <p>I am writing in response to your public records request received by the Town of ${h(ctx.town)}. I have completed a diligent search of Town records and must inform you that we are unable to produce the requested records.</p>

  <p>The requested records are withheld in full pursuant to the following statutory exemptions under M.G.L. c. 4, §7(26):</p>

  <div class="indent"><ul>${exemptionList}</ul></div>

  <p>Disclosure of the requested records would ${exemptionDetails.length > 0 ? 'be prohibited under the cited exemptions' : 'constitute an unwarranted invasion of privacy and is otherwise exempt from disclosure'}.</p>

  <p><strong>Your Right to Appeal:</strong> You have the right to appeal this denial to the Supervisor of Public Records within <strong>90 calendar days</strong> of this letter. Appeals must be submitted to:</p>

  <div class="indent">
    Office of the Secretary of State<br>
    Public Records Division<br>
    One Ashburton Place, Room 1719<br>
    Boston, MA 02108<br>
    pubrecords@sec.state.ma.us
  </div>
</div>

<div class="closing">Sincerely,</div>

${signatureBlock(ctx)}

<div class="citation">
  M.G.L. c. 4, §7(26) — Exemptions from Public Records<br>
  M.G.L. c. 66, §10 — Public Records Law<br>
  Case Reference: ${h(ctx.caseNumber)}
</div>`)
}

export function generateExtensionLetter(ctx: TemplateContext): string {
  const extensionDays = typeof ctx.extensionDays === 'number' ? ctx.extensionDays : 10
  return letterWrap(`PRR Extension — ${ctx.caseNumber}`, `
${letterhead(ctx.town)}

<div class="date">${h(ctx.today)}</div>

${addressBlock(ctx)}

<div class="ref-line">RE: Public Records Request — ${h(ctx.caseNumber)} (Time Extension Notice)</div>

<div class="salutation">Dear ${h(ctx.requesterName ?? 'Requester')},</div>

<div class="body">
  <p>I am writing to acknowledge receipt of your public records request and to notify you that additional time is required to complete our response.</p>

  <p>Your request requires the retrieval and review of a large volume of records, and/or involves records requiring careful legal review. We will need an additional <strong>${extensionDays} business days</strong> to complete a thorough and accurate response.</p>

  <p>We anticipate providing a complete response to your request no later than the extended deadline. We appreciate your patience and understanding.</p>

  <p>If you have questions about the status of your request, please contact our office using the information below.</p>
</div>

<div class="closing">Sincerely,</div>

${signatureBlock(ctx)}

<div class="citation">
  M.G.L. c. 66, §10 — Public Records Law<br>
  Case Reference: ${h(ctx.caseNumber)}
</div>`)
}
