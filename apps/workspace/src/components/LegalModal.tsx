import { useState } from 'react'
import { X } from '@phosphor-icons/react'

type LegalTab = 'terms' | 'privacy' | 'acceptable' | 'data' | 'security' | 'howwework'

interface LegalModalProps {
  open: boolean
  onClose: () => void
  initialTab?: LegalTab
}

const TABS: { key: LegalTab; label: string }[] = [
  { key: 'terms',      label: 'Terms of Service'       },
  { key: 'privacy',    label: 'Privacy Policy'         },
  { key: 'acceptable', label: 'Acceptable Use'         },
  { key: 'data',       label: 'Data Processing'        },
  { key: 'security',   label: 'Security'               },
  { key: 'howwework',  label: 'How We Work'            },
]

const EFFECTIVE_DATE = 'March 3, 2026'
const COMPANY = 'PublicLogic, Inc.'
const PRODUCT = 'Workspace'
const EMAIL = 'info@publiclogic.org'

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-6">
      <h3 className="text-sm font-bold text-white/80 mb-2 tracking-wide">{title}</h3>
      <div className="text-sm text-white/40 leading-relaxed space-y-2">{children}</div>
    </div>
  )
}

function TermsContent() {
  return (
    <div>
      <p className="text-xs text-white/25 mb-6">Effective Date: {EFFECTIVE_DATE} &nbsp;·&nbsp; {COMPANY}</p>

      <Section title="1. Acceptance">
        <p>By accessing or using {PRODUCT} ("the Platform"), you agree to be bound by these Terms of Service ("Terms"). If you do not agree, you may not access the Platform. These Terms apply to all users, including individuals, municipalities, government agencies, and organizational accounts.</p>
      </Section>

      <Section title="2. Description of Service">
        <p>{PRODUCT} is a governance and productivity platform developed by {COMPANY}. It provides tools for document management, workflow automation, AI-assisted drafting, data integration, civic record-keeping, and related public administration functions. The Platform is purpose-built for public service teams and is not a general-purpose consumer product.</p>
        <p>Features include but are not limited to: VAULT (governed record storage and ARCHIEVE framework), ARCHIEVE (audit record and retention logic), SEAL (cryptographic integrity), CivicPulse™ (public surface audit and transparency), SYNCRONATE (federated data orchestration), FormKey (intake, consent, and rate-gate), and the PuddleJumper Governance Plane (core governance engine).</p>
      </Section>

      <Section title="3. Eligibility">
        <p>You must be at least 18 years old and legally authorized to enter into agreements on behalf of yourself or your organization. Government entities and municipalities represent that the individual signing up has the authority to bind the organization to these Terms.</p>
      </Section>

      <Section title="4. Account Responsibilities">
        <p>You are responsible for maintaining the confidentiality of your credentials and for all activity that occurs under your account. You must promptly notify {COMPANY} of any unauthorized use. {COMPANY} is not liable for any loss resulting from unauthorized account access that is not attributable to {COMPANY}'s own negligence.</p>
      </Section>

      <Section title="5. Acceptable Use">
        <p>You agree to use the Platform only for lawful purposes and in accordance with our Acceptable Use Policy (below). You may not use the Platform to store, transmit, or process data in violation of applicable law, or to circumvent any security controls.</p>
      </Section>

      <Section title="6. Intellectual Property">
        <p>{COMPANY} retains all rights, title, and interest in the Platform, including all software, design, trademarks, and trade secrets. These Terms do not grant you any rights to {COMPANY}'s intellectual property except the limited license to use the Platform as described herein.</p>
        <p>The following systems are proprietary technology of {COMPANY} and constitute trade secrets: the PuddleJumper Governance Plane (core governance engine); SYNCRONATE (federated data orchestration engine); VAULT (governed record storage and gate enforcement); SEAL (cryptographic output signing); ARCHIEVE (audit event log and logic layer); FormKey (intake, consent, and rate-gate system); and the ULAF (Unified Logic Abstraction Framework) underlying all subsystems. All component names, architectures, and workflow patterns are proprietary.</p>
        <p>You retain ownership of all content you upload or create on the Platform. By uploading content, you grant {COMPANY} a limited license to process, store, and display that content solely to provide the service.</p>
      </Section>

      <Section title="7. Fees and Payment">
        <p>Certain features of the Platform are offered under paid plans. Fees are described in your order form or subscription agreement. {COMPANY} reserves the right to change pricing with 30 days' notice. Failure to pay may result in service suspension.</p>
      </Section>

      <Section title="8. Confidentiality">
        <p>Both parties agree to keep confidential any non-public information disclosed in connection with these Terms. {COMPANY} will not disclose your data to third parties except as required by law, as necessary to provide the service, or as described in the Privacy Policy.</p>
      </Section>

      <Section title="9. Disclaimers">
        <p>THE PLATFORM IS PROVIDED "AS IS" WITHOUT WARRANTIES OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, OR NON-INFRINGEMENT. {COMPANY} DOES NOT WARRANT THAT THE PLATFORM WILL BE UNINTERRUPTED, ERROR-FREE, OR FREE OF HARMFUL COMPONENTS.</p>
      </Section>

      <Section title="10. Limitation of Liability">
        <p>TO THE MAXIMUM EXTENT PERMITTED BY LAW, {COMPANY}'S TOTAL LIABILITY FOR ANY CLAIMS ARISING UNDER THESE TERMS SHALL NOT EXCEED THE AMOUNTS PAID BY YOU IN THE TWELVE (12) MONTHS PRECEDING THE CLAIM. {COMPANY} IS NOT LIABLE FOR INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES.</p>
      </Section>

      <Section title="11. Governing Law">
        <p>These Terms are governed by the laws of the Commonwealth of Massachusetts, without regard to conflict of law provisions. Any disputes shall be resolved in the courts of Suffolk County, Massachusetts.</p>
      </Section>

      <Section title="12. Changes to Terms">
        <p>{COMPANY} may modify these Terms at any time. Material changes will be communicated via email or Platform notification. Continued use of the Platform after changes become effective constitutes acceptance.</p>
      </Section>

      <Section title="13. Contact">
        <p>Questions regarding these Terms should be directed to <span className="text-white/60">{EMAIL}</span>.</p>
      </Section>
    </div>
  )
}

function PrivacyContent() {
  return (
    <div>
      <p className="text-xs text-white/25 mb-6">Effective Date: {EFFECTIVE_DATE} &nbsp;·&nbsp; {COMPANY}</p>

      <Section title="Overview">
        <p>{COMPANY} ("we", "us", "our") is committed to protecting the privacy of individuals who use {PRODUCT}. This Privacy Policy explains how we collect, use, store, and share information when you use our Platform. We are designed specifically for public sector and municipal contexts, and we take data governance seriously as a core product value — not an afterthought.</p>
      </Section>

      <Section title="1. Information We Collect">
        <p><strong className="text-white/60">Account Information:</strong> When you sign in via GitHub, Google, or Microsoft OAuth, we receive your name, email address, and profile picture from the provider. We do not store your OAuth provider password.</p>
        <p><strong className="text-white/60">Content You Create:</strong> Documents, forms, workflows, code sketches, records, and other content you create on the Platform are stored in our infrastructure.</p>
        <p><strong className="text-white/60">Usage Data:</strong> We collect information about how you interact with the Platform including feature usage, session duration, and error logs. This helps us improve the service.</p>
        <p><strong className="text-white/60">Third-Party Integrations:</strong> If you connect Microsoft 365, Google Drive, or GitHub, we access only the data you explicitly authorize and only to provide the integration features you request.</p>
      </Section>

      <Section title="2. How We Use Your Information">
        <p>We use your information to: provide and operate the Platform; improve features and reliability; respond to support requests; send service-related communications; enforce our Terms of Service; and comply with legal obligations. We do not use your data to train AI models without explicit consent.</p>
      </Section>

      <Section title="3. Data Storage and Security">
        <p>Data is stored on servers located in the United States. We use industry-standard encryption at rest (AES-256) and in transit (TLS 1.3). Access to production data is restricted to authorized personnel with need-to-know access, and all access is logged and auditable.</p>
      </Section>

      <Section title="4. AI Features">
        <p>The Platform includes AI-powered features (writing assistance, document analysis, drafting). When you use these features, your content may be sent to AI model providers (such as Anthropic or OpenAI) via our server-side proxy. We do not permit providers to use your data for model training, and we use provider contracts that enforce this restriction. AI processing happens server-side; no API keys are stored in your browser.</p>
        <p>All AI-generated output requires explicit human review and approval before becoming an official record. Every AI action is logged: prompt, model version, output content, and the identity of the approving user. No AI output becomes an official record without human sign-off.</p>
      </Section>

      <Section title="5. Data Sharing">
        <p>We do not sell your data. We do not share your data with advertisers. We may share data with: service providers who process data on our behalf (subject to confidentiality obligations); law enforcement when required by valid legal process; and with your consent. In the event of a merger or acquisition, data may be transferred as a business asset, with notice to users.</p>
      </Section>

      <Section title="6. Your Rights">
        <p>You have the right to access, correct, or delete your data. Organizational administrators may also manage data on behalf of their teams. To exercise these rights, contact <span className="text-white/60">{EMAIL}</span>. We will respond within 30 days. Certain data may be retained for legal compliance purposes.</p>
      </Section>

      <Section title="7. Cookies and Tracking">
        <p>We use session cookies required for authentication. We do not use third-party advertising cookies or cross-site tracking. We use minimal analytics (privacy-respecting, aggregated) to understand feature usage.</p>
      </Section>

      <Section title="8. Data Retention">
        <p>We retain your data for as long as your account is active or as needed to provide services. You may request deletion of your account and associated data at any time. Certain records may be retained for legal compliance, dispute resolution, or audit trail requirements (particularly for municipal accounts governed by public records law).</p>
      </Section>

      <Section title="9. Public Records Compliance">
        <p>Municipalities using {PRODUCT} remain the data controllers for records subject to their jurisdiction's public records laws. {COMPANY} acts as a data processor in these contexts. We support public records requests and open records compliance as a core product feature, not a workaround.</p>
      </Section>

      <Section title="10. Changes to This Policy">
        <p>We may update this policy. Material changes will be communicated with at least 14 days' notice. Contact: <span className="text-white/60">{EMAIL}</span>.</p>
      </Section>
    </div>
  )
}

function AcceptableUseContent() {
  return (
    <div>
      <p className="text-xs text-white/25 mb-6">Effective Date: {EFFECTIVE_DATE} &nbsp;·&nbsp; {COMPANY}</p>
      <p className="text-sm text-white/40 leading-relaxed mb-6">This Acceptable Use Policy ("AUP") governs what you may and may not do with {PRODUCT}. Violations may result in suspension or termination of your account.</p>

      <Section title="Permitted Uses">
        <p>You may use the Platform for lawful governance, municipal administration, civic engagement, document management, workflow automation, developer tooling, and related public administration functions. You may use the Platform for internal business productivity consistent with its purpose as a public-sector governance tool.</p>
      </Section>

      <Section title="Prohibited Uses">
        <p>You may not use the Platform to:</p>
        <ul className="list-disc list-inside space-y-1 mt-2">
          <li>Violate any applicable local, state, federal, or international law or regulation</li>
          <li>Store, transmit, or process content that is illegal, harmful, harassing, defamatory, or discriminatory</li>
          <li>Attempt to gain unauthorized access to any system, network, or account</li>
          <li>Reverse-engineer, decompile, or extract source code from any proprietary component of the Platform</li>
          <li>Use the Platform to develop a competing product or service</li>
          <li>Circumvent any technical or access controls built into the Platform</li>
          <li>Introduce malware, viruses, or any malicious code</li>
          <li>Violate the privacy of individuals or process personal data without a lawful basis</li>
          <li>Use AI features to generate content intended to mislead, deceive, or harm</li>
          <li>Overload or disrupt the infrastructure shared with other users</li>
          <li>Use automated scripts to access the Platform in a manner that is excessive or disruptive</li>
          <li>Misrepresent your identity or organization</li>
          <li>Facilitate corruption, bribery, or misuse of public resources</li>
        </ul>
      </Section>

      <Section title="Data Standards">
        <p>You are responsible for ensuring that any personal data you process through the Platform is handled in compliance with applicable privacy law. For municipal accounts, this includes compliance with FOIA, your state's public records laws, and any applicable data security regulations for government entities.</p>
      </Section>

      <Section title="AI Usage Standards">
        <p>AI-generated content produced by the Platform must be reviewed by a human before being used in official government communications, legal documents, or public-facing materials. {COMPANY} is not responsible for errors in AI-generated output. You remain accountable for all content published under your account.</p>
      </Section>

      <Section title="Reporting Violations">
        <p>To report abuse or a suspected violation of this policy, contact <span className="text-white/60">{EMAIL}</span>.</p>
      </Section>
    </div>
  )
}

function DataProcessingContent() {
  return (
    <div>
      <p className="text-xs text-white/25 mb-6">Effective Date: {EFFECTIVE_DATE} &nbsp;·&nbsp; {COMPANY}</p>
      <p className="text-sm text-white/40 leading-relaxed mb-6">This Data Processing Addendum ("DPA") applies to organizational and municipal accounts and supplements the Terms of Service. It governs how {COMPANY} processes personal data on behalf of customers ("Controllers") who use {PRODUCT}.</p>

      <Section title="1. Definitions">
        <p><strong className="text-white/60">Controller:</strong> The organization or municipality that determines the purposes and means of processing personal data.</p>
        <p><strong className="text-white/60">Processor:</strong> {COMPANY}, acting on instructions from the Controller to process data.</p>
        <p><strong className="text-white/60">Personal Data:</strong> Any information that identifies or could identify a natural person.</p>
        <p><strong className="text-white/60">Processing:</strong> Any operation performed on personal data, including storage, retrieval, alteration, and deletion.</p>
      </Section>

      <Section title="2. Scope and Instructions">
        <p>{COMPANY} processes personal data only on documented instructions from the Controller. Processing occurs exclusively to provide the Platform services as described in the Terms of Service and Privacy Policy. {COMPANY} will notify the Controller if it believes an instruction violates applicable data protection law.</p>
      </Section>

      <Section title="3. Sub-processors">
        <p>{COMPANY} uses sub-processors to provide the Platform. These include cloud infrastructure providers, AI model API providers (for AI features), and authentication providers. A current list of sub-processors is available upon request. {COMPANY} maintains Data Processing Agreements with all sub-processors that impose equivalent data protection obligations.</p>
      </Section>

      <Section title="4. Security Measures">
        <p>{COMPANY} implements and maintains the following technical and organizational measures to protect personal data:</p>
        <ul className="list-disc list-inside space-y-1 mt-2">
          <li>AES-256 encryption at rest; TLS 1.3 in transit</li>
          <li>V8 isolated sandbox execution (isolated-vm) for all user-supplied code — no host runtime access</li>
          <li>Role-based access controls with per-workspace permission scoping</li>
          <li>ARCHIEVE immutable audit log: all data access events are cryptographically chained and independently verifiable</li>
          <li>SEAL cryptographic output signing: all governance outputs carry a verifiable signature</li>
          <li>CSRF protection on all state-mutating endpoints</li>
          <li>HTTP security headers: HSTS (2-year), X-Content-Type-Options, X-Frame-Options, Content-Security-Policy, Referrer-Policy, Permissions-Policy</li>
          <li>SQLite-backed rate limiting on all public-facing intake endpoints</li>
          <li>No API keys or credentials stored client-side; all provider tokens scoped per-tenant server-side</li>
          <li>Regular security assessments and incident response procedures</li>
        </ul>
      </Section>

      <Section title="5. Data Subject Rights">
        <p>{COMPANY} will assist Controllers in responding to data subject requests (access, correction, deletion, portability) within timeframes required by applicable law. Controllers remain responsible for verifying data subject identity and making final determinations on requests.</p>
      </Section>

      <Section title="6. Breach Notification">
        <p>In the event of a confirmed personal data breach, {COMPANY} will notify the Controller within 72 hours of becoming aware, providing available information about the nature, scope, and likely consequences of the breach, and the measures taken or proposed.</p>
      </Section>

      <Section title="7. Data Transfers">
        <p>Data is stored in the United States. For Controllers subject to EU/UK GDPR, data transfers outside the EEA are governed by Standard Contractual Clauses (SCCs) as adopted by the European Commission. Contact <span className="text-white/60">{EMAIL}</span> for transfer mechanism documentation.</p>
      </Section>

      <Section title="8. Audit Rights">
        <p>Controllers may request audit documentation or conduct audits (with reasonable notice) to verify {COMPANY}'s compliance with this DPA. {COMPANY} will cooperate with such audits and provide relevant documentation.</p>
      </Section>

      <Section title="9. Return and Deletion">
        <p>Upon termination of services, {COMPANY} will return or delete personal data per the Controller's instruction, except where retention is required by law. Deletion will be confirmed in writing within 30 days.</p>
      </Section>

      <Section title="10. Governing Law">
        <p>This DPA is governed by the same law as the Terms of Service unless required otherwise by applicable data protection law. Contact for DPA matters: <span className="text-white/60">{EMAIL}</span>.</p>
      </Section>
    </div>
  )
}

function SecurityContent() {
  return (
    <div>
      <p className="text-xs text-white/25 mb-6">Effective Date: {EFFECTIVE_DATE} &nbsp;·&nbsp; {COMPANY}</p>
      <p className="text-sm text-white/40 leading-relaxed mb-6">This page describes how {COMPANY} secures {PRODUCT} and how to report vulnerabilities responsibly.</p>

      <Section title="Architecture Security">
        <ul className="list-disc list-inside space-y-1">
          <li><strong className="text-white/60">Sandboxed execution:</strong> All user-supplied code runs inside a V8 isolated VM (isolated-vm). The sandbox has no access to the host filesystem, network, or Node.js runtime. If isolated-vm fails to load at startup, the server refuses to start — there is no fallback to a less-secure runtime.</li>
          <li><strong className="text-white/60">Zero client-side secrets:</strong> No API keys, provider tokens, or credentials are stored in the browser. All provider integrations (Microsoft, Google, GitHub) are brokered server-side, scoped per tenant.</li>
          <li><strong className="text-white/60">Tenant isolation:</strong> All database records, ARCHIEVE audit events, VAULT files, and FormKey definitions are partitioned by tenant ID. Cross-tenant access triggers an ARCHIEVE isolation violation event.</li>
          <li><strong className="text-white/60">Immutable audit trail:</strong> ARCHIEVE events are cryptographically chained. Every governance action — file access, code execution, form submission, workspace change — is logged with actor, timestamp, and hash chain position.</li>
          <li><strong className="text-white/60">Cryptographic output signing:</strong> SEAL signs governance outputs (contracts, permits, decisions) with a per-tenant asymmetric keypair. Signatures are verifiable without trusting the platform.</li>
        </ul>
      </Section>

      <Section title="Transport and Storage">
        <ul className="list-disc list-inside space-y-1">
          <li>TLS 1.3 enforced in transit; HSTS preload with 2-year max-age including subdomains</li>
          <li>AES-256 encryption at rest for all stored data</li>
          <li>HTTP security headers on all responses: Content-Security-Policy, X-Frame-Options (SAMEORIGIN), X-Content-Type-Options (nosniff), Referrer-Policy (strict-origin-when-cross-origin), Permissions-Policy (camera/mic/geo/payment disabled)</li>
          <li>CSRF protection on all state-mutating API endpoints</li>
          <li>SQLite-backed rate limiting on all public intake endpoints (FormKey, PRR, access requests)</li>
        </ul>
      </Section>

      <Section title="Authentication and Authorization">
        <ul className="list-disc list-inside space-y-1">
          <li>JWT-based authentication with configurable expiry; refresh token rotation on use</li>
          <li>Role-based access control: admin, member, and tool-level permission scoping</li>
          <li>Per-workspace tool access gating — members see only tools their administrator has enabled</li>
          <li>First-login password reset enforced: administrators set an initial password; users must change it on first login</li>
          <li>ALLOWED_EMAILS allowlist support: restrict platform access to a known set of addresses</li>
        </ul>
      </Section>

      <Section title="Open Source Dependency Licensing">
        <p>All production dependencies of {PRODUCT} and PuddleJumper are MIT or ISC licensed. No GPL, AGPL, or SSPL dependencies are present in production builds. Proprietary components (PuddleJumper Governance Plane, SYNCRONATE, ARCHIEVE, SEAL, VAULT, FormKey) are not open source.</p>
      </Section>

      <Section title="Vulnerability Disclosure">
        <p>We operate a responsible disclosure program. If you believe you have found a security vulnerability in {PRODUCT} or PuddleJumper:</p>
        <ul className="list-disc list-inside space-y-1 mt-2">
          <li>Email <span className="text-white/60">info@publiclogic.org</span> with a description of the vulnerability, steps to reproduce, and potential impact</li>
          <li>Do not publicly disclose until we have had a reasonable opportunity to investigate and remediate (90 days)</li>
          <li>Do not access, modify, or delete data belonging to other accounts during research</li>
          <li>We will acknowledge receipt within 72 hours and provide a resolution timeline</li>
        </ul>
        <p className="mt-2">We follow GitHub's Safe Harbor policy for good-faith security research. We do not pursue legal action against researchers who comply with these guidelines.</p>
      </Section>

      <Section title="Incident Response">
        <p>In the event of a confirmed security incident affecting customer data, {COMPANY} will: notify affected customers within 72 hours of confirmation; provide details on the nature, scope, and likely consequences of the incident; describe remediation steps taken; and cooperate with any regulatory notification requirements.</p>
      </Section>

      <Section title="Contact">
        <p>Security reports: <span className="text-white/60">info@publiclogic.org</span></p>
        <p>Legal / compliance: <span className="text-white/60">{EMAIL}</span></p>
      </Section>
    </div>
  )
}


function HowWeWorkContent() {
  return (
    <div>
      <p className="text-xs text-white/25 mb-6">{COMPANY} · {PRODUCT}</p>

      <Section title="How Workspace governs municipal work">
        <p>Workspace is built on three interlocking frameworks. Every module, every record, every automated action operates within their constraints. This page explains what they are and why they matter to operators and elected officials.</p>
      </Section>

      <Section title="VAULT — The governing framework">
        <p>Workspace runs on VAULT governance doctrine. Every module, every record, every automated action operates within a defined authority structure. VAULT answers four questions before anything proceeds: What must happen? In what order? By whose authority? With what evidence? Staff see guidance in their browser. The server enforces hard stops that cannot be bypassed.</p>
      </Section>

      <Section title="ARCHIEVE — The record of proof">
        <p>When a governed process completes, ARCHIEVE closes the case into a transfer-ready bundle. Two distinct pieces: the Rail (retention schedules, closure criteria, bundle structure — server-side logic) and the Store (the sealed, timestamped artifact that proves the process ran correctly). ARCHIEVE bundles are town-owned. If the town transitions to a new system or provider, the bundle travels with them.</p>
      </Section>

      <Section title="SEAL — The proof it hasn't changed">
        <p>Every record receives a SHA-256 hash at creation, stored separately from the record itself. On every subsequent read, the hash is recomputed. A mismatch means something changed. Staff cannot read or write hashes. Auditors, courts, and transition teams can verify record integrity without asking anyone anything.</p>
      </Section>

      <Section title="The governance proof chain">
        <p>VAULT defined what had to happen → ARCHIEVE recorded that it happened → SEAL proves the record hasn't changed since.</p>
        <p>Any auditor can follow this chain backward from the ARCHIEVE bundle to the original governing rule without asking anyone for anything.</p>
      </Section>

      <Section title="What stays with the town">
        <p>Workspace is not a data hostage model. Your records, your cases, your ARCHIEVE bundles — those belong to the town. PublicLogic retains the methodology, the frameworks (VAULT, ARCHIEVE, SEAL), and the intellectual property that makes the system work. At transition, the town takes a complete, portable package. Nothing is lost.</p>
      </Section>

      <Section title="AI in Workspace">
        <p>AI assists at every stage but decides at none. Every AI action is logged: the prompt, the model version, the output, and the identity of the user who triggered it. No AI output becomes an official record without explicit human review and approval. This is not a toggle — it is a hard architectural constraint.</p>
      </Section>
    </div>
  )
}

export function LegalModal({ open, onClose, initialTab = 'terms' }: LegalModalProps) {
  const [tab, setTab] = useState<LegalTab>(initialTab)

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[999] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)' }}
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-3xl max-h-[85vh] flex flex-col rounded-2xl border border-white/10 overflow-hidden"
        style={{ background: '#0d1117' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-6 py-4 border-b border-white/10 flex-shrink-0">
          <div>
            <div className="text-sm font-bold text-white/80">Legal Documents</div>
            <div className="text-[10px] text-white/25">PublicLogic, Inc. · {PRODUCT}</div>
          </div>
          <div className="flex-1" />
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-white/10 text-white/40 hover:text-white/80 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Tab bar */}
        <div className="flex border-b border-white/10 px-6 flex-shrink-0 overflow-x-auto">
          {TABS.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-3 py-2.5 text-xs font-medium border-b-2 whitespace-nowrap transition-colors ${
                tab === t.key
                  ? 'border-emerald-500 text-emerald-400'
                  : 'border-transparent text-white/30 hover:text-white/60'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 min-h-0 overflow-y-auto px-6 py-6">
          {tab === 'terms'      && <TermsContent />}
          {tab === 'privacy'    && <PrivacyContent />}
          {tab === 'acceptable' && <AcceptableUseContent />}
          {tab === 'data'       && <DataProcessingContent />}
          {tab === 'security'   && <SecurityContent />}
          {tab === 'howwework'  && <HowWeWorkContent />}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-3 border-t border-white/10 flex-shrink-0">
          <p className="text-[10px] text-white/20">© {new Date().getFullYear()} {COMPANY} · All rights reserved</p>
          <p className="text-[10px] text-white/20">{EMAIL}</p>
        </div>
      </div>
    </div>
  )
}
