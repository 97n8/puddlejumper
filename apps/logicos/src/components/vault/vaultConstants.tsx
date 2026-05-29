import type { ReactNode } from 'react'
import { Clock, Warning, CheckCircle, Archive } from '@phosphor-icons/react'
import type { VaultStatus, VaultClassification } from '@/services/pjApi'

// ── Types ─────────────────────────────────────────────────────────────────────

export type PageSizeKey = 'free' | 'letter' | 'a4' | 'legal' | 'slide' | 'square'
export type GovTab = 'status' | 'audit' | 'versions'

export interface Template {
  id: string
  emoji: string
  name: string
  description: string
  pageSize: PageSizeKey
  html: string
  css: string
}

// ── Page sizes ────────────────────────────────────────────────────────────────

export const PAGE_SIZES: Record<PageSizeKey, { label: string; width: number | null; height: number | null; print?: string }> = {
  free:   { label: 'Free size',       width: null, height: null },
  letter: { label: 'Letter (8.5×11)', width: 816,  height: 1056, print: '8.5in 11in' },
  a4:     { label: 'A4',              width: 794,  height: 1123, print: 'A4' },
  legal:  { label: 'Legal (8.5×14)',  width: 816,  height: 1344, print: '8.5in 14in' },
  slide:  { label: 'Slide 16:9',      width: 1280, height: 720,  print: '1280px 720px' },
  square: { label: 'Square',          width: 800,  height: 800,  print: '800px 800px' },
}

// ── Templates ─────────────────────────────────────────────────────────────────

export const BASE_CSS = `* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: Georgia, serif; background: #fff; color: #1a1a1a; }
.doc { max-width: 660px; margin: 0 auto; padding: 4rem 2rem; }
h1 { font-size: 2rem; margin-bottom: 1.5rem; font-weight: 600; }
h2 { font-size: 1.25rem; margin: 2rem 0 .75rem; font-weight: 600; }
p { line-height: 1.75; margin-bottom: 1rem; font-size: 1.05rem; }
ul, ol { margin: .5rem 0 1rem 1.5rem; line-height: 1.75; }
table { width: 100%; border-collapse: collapse; margin: 1rem 0; font-size: .95rem; }
th, td { border: 1px solid #ddd; padding: .5rem .75rem; text-align: left; }
th { background: #f5f5f5; }`

export const TEMPLATES: Template[] = [
  {
    id: 'blank', emoji: '📄', name: 'Blank Document', description: 'Clean canvas',
    pageSize: 'letter',
    html: `<article class="doc">\n  <h1>Untitled</h1>\n  <p>Start writing here.</p>\n</article>`,
    css: BASE_CSS,
  },
  {
    id: 'memo', emoji: '📋', name: 'Business Memo', description: 'Internal communication',
    pageSize: 'letter',
    html: `<div class="memo"><div class="logo">MEMORANDUM</div><table class="meta"><tr><td class="label">TO</td><td>All Staff</td></tr><tr><td class="label">FROM</td><td>Management</td></tr><tr><td class="label">DATE</td><td>${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</td></tr><tr><td class="label">RE</td><td>Subject</td></tr></table><hr/><p>Body of the memo goes here.</p></div>`,
    css: `* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: Arial, sans-serif; background: #fff; color: #1a1a1a; }
.memo { max-width: 660px; margin: 0 auto; padding: 4rem 2rem; }
.logo { font-size: 1.5rem; font-weight: 700; letter-spacing: .2em; margin-bottom: 2rem; }
.meta { width: 100%; border-collapse: collapse; margin-bottom: 2rem; font-size: .95rem; }
.meta td { padding: .4rem .75rem; border: 1px solid #ddd; }
.label { font-weight: 700; width: 80px; background: #f5f5f5; }
hr { border: none; border-top: 2px solid #1a1a1a; margin-bottom: 2rem; }
p { line-height: 1.7; margin-bottom: 1rem; }`,
  },
  {
    id: 'policy', emoji: '🏛️', name: 'Policy Document', description: 'Formal governance policy',
    pageSize: 'letter',
    html: `<article class="doc"><div class="policy-header"><h1>Policy Title</h1><p class="meta">Policy Number: POL-001 &nbsp;|&nbsp; Effective: ${new Date().toLocaleDateString()} &nbsp;|&nbsp; Status: Draft</p></div><h2>1. Purpose</h2><p>State the purpose of this policy.</p><h2>2. Scope</h2><p>Define who and what this policy applies to.</p><h2>3. Policy Statement</h2><p>The core policy requirements.</p><h2>4. Responsibilities</h2><p>Who is responsible for compliance.</p><h2>5. Enforcement</h2><p>Consequences of non-compliance.</p><div class="approval-block"><p><strong>Approved by:</strong> _____________________ &nbsp;&nbsp; <strong>Date:</strong> ___________</p></div></article>`,
    css: `${BASE_CSS}
.policy-header { border-bottom: 3px solid #1a1a1a; margin-bottom: 2rem; padding-bottom: 1rem; }
.meta { font-size: .85rem; color: #666; margin-top: .5rem; }
.approval-block { margin-top: 3rem; padding-top: 1.5rem; border-top: 1px solid #ddd; }`,
  },
  {
    id: 'sop', emoji: '📐', name: 'Standard Operating Procedure', description: 'Step-by-step SOP',
    pageSize: 'letter',
    html: `<article class="doc"><h1>Standard Operating Procedure</h1><p class="subtitle">SOP-001 | Version 1.0</p><h2>Purpose</h2><p>Describe what this procedure accomplishes.</p><h2>Scope</h2><p>Who this SOP applies to.</p><h2>Procedure</h2><ol><li><strong>Step one.</strong> Describe the first action.</li><li><strong>Step two.</strong> Describe the second action.</li><li><strong>Step three.</strong> Describe the third action.</li></ol><h2>Roles & Responsibilities</h2><table><thead><tr><th>Role</th><th>Responsibility</th></tr></thead><tbody><tr><td>Owner</td><td>Maintains this document</td></tr><tr><td>User</td><td>Follows this procedure</td></tr></tbody></table></article>`,
    css: BASE_CSS + `\n.subtitle { color: #666; margin-bottom: 2rem; }`,
  },
  {
    id: 'letter', emoji: '✉️', name: 'Formal Letter', description: 'Professional correspondence',
    pageSize: 'letter',
    html: `<div class="letter"><p class="date">${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p><p>Dear [Recipient],</p><p>Body of the letter.</p><p>Sincerely,</p><p class="sig">[Your Name]<br/>[Title]</p></div>`,
    css: `* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: Georgia, serif; background: #fff; color: #1a1a1a; }
.letter { max-width: 580px; margin: 0 auto; padding: 5rem 2rem; }
p { line-height: 1.75; margin-bottom: 1.5rem; font-size: 1.05rem; }
.date { color: #555; }
.sig { margin-top: 2rem; }`,
  },
  {
    id: 'report', emoji: '📊', name: 'Executive Report', description: 'Formal business report',
    pageSize: 'letter',
    html: `<article class="doc"><div class="cover"><h1>Executive Report</h1><p class="subtitle">Q1 2026 Summary</p><p class="meta">Prepared by: [Author] &nbsp;|&nbsp; ${new Date().toLocaleDateString()}</p></div><h2>Executive Summary</h2><p>High-level summary of findings and recommendations.</p><h2>Key Findings</h2><ul><li>Finding one</li><li>Finding two</li><li>Finding three</li></ul><h2>Recommendations</h2><p>Recommended course of action.</p><h2>Conclusion</h2><p>Closing remarks.</p></article>`,
    css: `${BASE_CSS}
.cover { border-bottom: 2px solid #1a1a1a; padding-bottom: 2rem; margin-bottom: 2rem; }
.subtitle { font-size: 1.1rem; color: #555; margin-top: .5rem; }
.meta { font-size: .85rem; color: #888; margin-top: .75rem; }`,
  },
  {
    id: 'nda', emoji: '🔒', name: 'NDA / Agreement', description: 'Non-disclosure agreement shell',
    pageSize: 'letter',
    html: `<article class="doc"><h1>Non-Disclosure Agreement</h1><p>This Non-Disclosure Agreement ("Agreement") is entered into as of ${new Date().toLocaleDateString()} between <strong>[Party A]</strong> and <strong>[Party B]</strong>.</p><h2>1. Confidential Information</h2><p>For purposes of this Agreement, "Confidential Information" means any data or information that is proprietary to the Disclosing Party.</p><h2>2. Obligations</h2><p>Each party agrees to: (a) hold the other's Confidential Information in strict confidence; (b) not disclose such information to third parties without prior written consent.</p><h2>3. Term</h2><p>This Agreement shall remain in effect for two (2) years from the date first set forth above.</p><div class="sigs"><div class="sig-block"><p>________________________</p><p>[Party A] &nbsp; Date: ________</p></div><div class="sig-block"><p>________________________</p><p>[Party B] &nbsp; Date: ________</p></div></div></article>`,
    css: `${BASE_CSS}
.sigs { display: flex; gap: 3rem; margin-top: 3rem; padding-top: 2rem; border-top: 1px solid #ddd; }
.sig-block p { margin-bottom: .25rem; font-size: .95rem; }`,
  },
  {
    id: 'minutes', emoji: '🗒️', name: 'Meeting Minutes', description: 'Formal meeting record',
    pageSize: 'letter',
    html: `<article class="doc"><h1>Meeting Minutes</h1><table class="info"><tr><th>Date</th><td>${new Date().toLocaleDateString()}</td><th>Time</th><td>10:00 AM</td></tr><tr><th>Location</th><td>Conference Room</td><th>Facilitator</th><td>[Name]</td></tr></table><h2>Attendees</h2><ul><li>[Name, Title]</li></ul><h2>Agenda Items</h2><ol><li><strong>Item 1</strong> — Discussion. Decision: TBD. Owner: TBD.</li></ol><h2>Action Items</h2><table><thead><tr><th>Action</th><th>Owner</th><th>Due</th></tr></thead><tbody><tr><td></td><td></td><td></td></tr></tbody></table><p class="footer">Minutes recorded by: _______________</p></article>`,
    css: `${BASE_CSS}
.info { width: 100%; border-collapse: collapse; margin-bottom: 2rem; }
.info th, .info td { border: 1px solid #ddd; padding: .4rem .6rem; }
.info th { background: #f5f5f5; width: 100px; }
.footer { margin-top: 2rem; padding-top: 1rem; border-top: 1px solid #ddd; font-size: .9rem; color: #666; }`,
  },
]

// ── Governance metadata ───────────────────────────────────────────────────────

export const STATUS_META: Record<VaultStatus, { label: string; action: string; color: string; bg: string; icon: ReactNode; next: VaultStatus[] }> = {
  draft:    { label: 'Draft',     action: 'Move to Draft',   color: 'text-muted-foreground', bg: 'bg-muted',       icon: <Clock size={12} />,       next: ['review', 'archived'] },
  review:   { label: 'In Review', action: 'Send for Review', color: 'text-amber-700',         bg: 'bg-amber-100',   icon: <Warning size={12} />,     next: ['approved', 'draft', 'archived'] },
  approved: { label: 'Approved',  action: 'Approve',         color: 'text-emerald-700',       bg: 'bg-emerald-100', icon: <CheckCircle size={12} />, next: ['archived'] },
  archived: { label: 'Archived',  action: 'Archive',         color: 'text-red-700',           bg: 'bg-red-100',     icon: <Archive size={12} />,     next: ['draft'] },
}

export const CLASS_META: Record<VaultClassification, { label: string; color: string; bg: string }> = {
  public:       { label: 'Public',       color: 'text-sky-700',       bg: 'bg-sky-100' },
  internal:     { label: 'Internal',     color: 'text-foreground/80', bg: 'bg-muted' },
  confidential: { label: 'Confidential', color: 'text-amber-700',     bg: 'bg-amber-100' },
  restricted:   { label: 'Restricted',   color: 'text-red-700',       bg: 'bg-red-100' },
}

export const EVENT_ICONS: Record<string, string> = {
  created: '✦',
  edited: '✎',
  status_changed: '⇒',
  signed: '✍',
  classified: '⊙',
  comment: '💬',
}
