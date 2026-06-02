// PublicLogic site content — source of truth.
// Mirrors the FINAL_LOCKED workbook (Public Site Copy FINAL + Builder
// Clarifications + Developer Spec Summary). One export = one locked value or
// section. Do not edit copy here without a workbook change — the workbook is
// the source of truth and this file is its in-repo projection.

// ── Brand lock (FINAL Control / Developer Spec Summary) ──────────────────────
export const BRAND = {
  wordmark: 'PUBLICLOGIC',
  subheading: 'Systems for Continuity', // logo/nav subheading — the stake
  heroHeadline: 'Make the work hold together.', // homepage H1
  bodyPhrase: 'Systems that stick.', // prose/resources/method only, not lockup
  proofBar: ['Policy', 'Data', 'Training', 'Leadership', 'Continuity'],
  primaryCta: { label: 'Start a CaseSpace', href: '/contact?topic=casespace' },
  productCta: { label: 'Log in to PuddleJumper', href: 'https://pj.publiclogic.org' },
  noHeroLine: 'A system should not require heroics to function.',
} as const;

// ── Primary navigation (Site Build Map order) ────────────────────────────────
export const NAV = [
  { label: 'Solutions', href: '/solutions' },
  { label: 'Products', href: '/products' },
  { label: 'Resources', href: '/resources' },
  { label: 'Method', href: '/method' },
  { label: 'About', href: '/about' },
  { label: 'Contact', href: '/contact' },
] as const;

// ── Home (Public Site Copy FINAL + Boom Previews) ────────────────────────────
export const HOME = {
  hero: {
    headline: BRAND.heroHeadline,
    body:
      'PublicLogic builds systems for continuity — connecting policy, data, ' +
      'training, leadership, and records into structures people can actually run.',
  },
  proofBarBody:
    'The five things that keep work from collapsing back into memory, ' +
    'workarounds, and heroics.',
  boom: {
    headline:
      'Forms become workflows. Records become memory. Training lives where ' +
      'the work happens.',
    body:
      'Decisions stop disappearing. The system carries what one person used to.',
  },
  beforeAfter: {
    headline: 'Before: scattered. After: held together.',
    before:
      'Files everywhere, training in one person’s head, decisions in email.',
    after: 'One CaseSpace, one record trail, one next step.',
  },
} as const;

// Boom preview cards — show outputs, never FORM/VAULT internals.
export const BOOM_PREVIEWS = [
  {
    line: 'STAY',
    title: 'Kendall Pond Lodge',
    items: [
      '3 guest tasks',
      '1 vendor follow-up',
      'Turnover checklist',
      'Vendor list',
      'Issue history',
    ],
  },
  {
    line: 'MUNI',
    title: 'Town Clerk Office',
    items: [
      'Records request log',
      'Board posting checklist',
      'License renewal packet',
      'Deadline calendar',
      'Role guide',
    ],
  },
  {
    line: 'BIZ',
    title: 'Small Business Admin',
    items: [
      'Quarterly tax folder',
      'Vendor renewal',
      'Insurance certificate',
      'Staff onboarding',
      'Recurring reminders',
    ],
  },
] as const;

// ── Solutions routing (Solutions Routing sheet) ──────────────────────────────
export const SOLUTIONS = {
  hero: {
    headline: 'What needs to hold together?',
    body:
      'Choose the area closest to the work. We’ll use it to route the right ' +
      'conversation.',
  },
  cards: [
    {
      title: 'Policy & Governance',
      copy: 'Rules, approvals, accountability.',
      topic: 'policy_governance',
    },
    {
      title: 'Data & Records',
      copy: 'Files, information, evidence, reporting.',
      topic: 'data_records',
    },
    {
      title: 'Training & Knowledge',
      copy: 'Guides, onboarding, institutional know-how.',
      topic: 'training_knowledge',
    },
    {
      title: 'Leadership & Roles',
      copy: 'Ownership, handoffs, decision rights.',
      topic: 'leadership_roles',
    },
    {
      title: 'Workflows & Process',
      copy: 'Forms, tasks, routing, recurring work.',
      topic: 'workflows_process',
    },
    {
      title: 'Continuity & Transition',
      copy: 'Turnover, succession, system memory.',
      topic: 'continuity_transition',
    },
  ],
} as const;

// ── Products / Login (Products Login sheet) ──────────────────────────────────
export const PRODUCTS = {
  hero: {
    headline: 'Access your PublicLogic systems.',
    body: 'Log in to PuddleJumper or check back soon for Permit&Bridge.',
  },
  doors: [
    {
      name: 'PuddleJumper',
      copy:
        'Log in to your workspace: CaseSpaces, records, workflows, tasks, ' +
        'and guided system tools.',
      status: 'Active',
      button: 'Log in to PuddleJumper',
      href: 'https://pj.publiclogic.org',
    },
    {
      name: 'Permit&Bridge',
      copy:
        'A public-facing permit and process bridge for municipalities, ' +
        'applicants, departments, and project partners.',
      status: 'Coming Soon',
      button: 'Notify Me',
      href: '/contact?topic=permitbridge',
    },
  ],
  help: {
    copy: 'Not sure where your workspace lives? Contact PublicLogic.',
    button: 'Contact Us',
    href: '/contact',
  },
} as const;

// ── Resources (Resources by Module sheet) — give away the lens, not the machine.
export const RESOURCES = {
  hero: {
    headline: 'Tools for work that has to hold together.',
    body:
      'Guides, checklists, briefs, and starter resources that help you see ' +
      'where the system is strained.',
  },
  items: [
    { lane: 'MUNI', resource: 'Public Office Continuity Checklist', format: 'PDF checklist' },
    { lane: 'BIZ', resource: 'Business Continuity Starter', format: 'Worksheet' },
    { lane: 'STAY', resource: 'Property Operations Starter', format: 'Checklist' },
    { lane: 'HOME', resource: 'Home Admin Reset Checklist', format: 'Checklist' },
    { lane: 'PROJECT', resource: 'Project Continuity Starter', format: 'Worksheet' },
    { lane: 'POLICY', resource: 'Policy-to-Practice Self-Test', format: 'Brief + checklist' },
    { lane: 'DATA', resource: 'Records Readiness Checklist', format: 'Checklist' },
    { lane: 'TRAINING', resource: 'No-Hero Training Check', format: 'Checklist' },
    { lane: 'LEADERSHIP', resource: 'Role Clarity Checklist', format: 'Checklist' },
    { lane: 'CONTINUITY', resource: 'Continuity Risk Checklist', format: 'Checklist' },
  ],
} as const;

// ── Method + Canon (Method and Canon sheet) — principles first, canon lower ───
export const METHOD = {
  hero: {
    headline: 'How PublicLogic builds systems that stick.',
    body:
      'Six principles that keep work usable, recordable, teachable, and ready ' +
      'to carry forward — even under pressure.',
  },
  principles: [
    { name: 'No-Hero Systems', copy: 'A system should not require heroics to function.' },
    {
      name: 'Visible Before Broken',
      copy:
        'People do not lose control all at once. They lose it through ' +
        'unmanaged backlog, scattered records, unclear roles, and work that ' +
        'depends on one person carrying too much.',
    },
    { name: 'Policy in Practice', copy: 'Rules only matter if people can use them where the work happens.' },
    { name: 'Data + Memory', copy: 'Information has to be findable, reliable, and carried forward.' },
    {
      name: 'Training in the Workflow',
      copy: 'Knowledge should live inside the system, not only in one person’s head.',
    },
    { name: 'Continuity by Design', copy: 'Work should survive turnover, transition, pressure, and growth.' },
  ],
  // Canon appears BELOW the principles. Never lead Method with canon/mascot.
  canon: [
    { term: 'PublicLogic', copy: 'The pond: the environment where people, rules, records, tools, and work meet.' },
    { term: 'PuddleJumper', copy: 'Helps people move through the system. The daily access layer.' },
    { term: 'FORM', copy: 'Builds the structure inside PuddleJumper.' },
    { term: 'VAULT', copy: 'Preserves the memory inside PuddleJumper.' },
  ],
} as const;

// ── About (About Positioning sheet) — Nate + Allie co-equal ──────────────────
export const ABOUT = {
  hero: {
    headline: 'Built by people who have lived inside the work.',
    body:
      'PublicLogic combines governance, policy, records, implementation, ' +
      'behavioral systems, training design, and continuity work.',
  },
  founderPair: {
    headline: 'Two disciplines. One operating test.',
    body:
      'Nate brings the governance, public administration, records, ' +
      'procurement, grant, and implementation spine. Allie brings the ' +
      'behavioral systems, training, adoption, leadership, and no-hero ' +
      'systems spine.',
  },
  founders: [
    {
      name: 'Nathan R. Boudreau, MPA, MCPPO',
      role: 'Founder & Principal',
      copy: 'Governance, policy, public administration, systems design, records, grants, implementation.',
    },
    {
      name: 'Dr. Allison Weiss Rothschild, PsyD, LICSW, BCBA, LABA',
      role: 'Partner, Behavioral Systems & Research',
      copy: 'Behavioral systems, training design, adoption, leadership, organizational learning, no-hero systems.',
    },
  ],
  thesis: {
    headline: 'The goal is not dependency.',
    body:
      'The goal is a system people can run: recordable, teachable, usable, ' +
      'and ready to carry forward.',
  },
} as const;

// ── Contact (Contact Form sheet) ─────────────────────────────────────────────
export const CONTACT = {
  hero: {
    headline: 'Tell us what needs to hold together.',
    body:
      'You do not need to know the right product. Tell us what is active, ' +
      'stuck, scattered, or being carried by one person.',
  },
  orgOptions: [
    'Municipality/Public Agency',
    'Business',
    'Property/STAY',
    'Home',
    'Project/Grant',
    'Not Sure',
  ],
  needs: [
    'Policy & Governance',
    'Data & Records',
    'Training & Knowledge',
    'Leadership & Roles',
    'Workflows & Process',
    'Continuity & Transition',
  ],
  urgencyOptions: [
    'Just exploring',
    'Need a CaseSpace',
    'Need help soon',
    'Active deadline/problem',
  ],
  startingPoints: [
    'Start a CaseSpace',
    'Request Diagnostic',
    'Request Build',
    'Need Login Help',
    'Not Sure',
  ],
} as const;

// ── Public pricing (Public Pricing sheet) — CaseSpaces public; builds by request.
export const PRICING = {
  publicTiers: [
    {
      name: 'CaseSpace Basic',
      price: '$19/month',
      bestFor: 'One personal, home, property, or project CaseSpace',
      includes: '1 active CaseSpace; starter records/tasks/checklists; basic PJ access; self-serve resources',
      cta: 'Start a CaseSpace',
    },
    {
      name: 'CaseSpace Plus',
      price: '$49/month',
      bestFor: 'Airbnb, small business, household reset, admin lane',
      includes: 'Up to 3 CaseSpaces; enhanced templates; recurring task/checklist setup; light continuity tools',
      cta: 'Start Plus',
    },
    {
      name: 'CaseSpace Pro',
      price: '$149/month',
      bestFor: 'Shared small-team or project CaseSpaces',
      includes: 'Up to 10 CaseSpaces; shared access; role/task structure; basic training prompts',
      cta: 'Start Pro',
    },
  ],
  // Bigger work is request-based — keep serious work protected.
  bridge:
    'Project CaseSpaces add multi-user roles and handoff structure. Full ' +
    'system builds start with a diagnostic.',
  requestTiers: [
    { name: 'Project CaseSpace', price: '$1,500–$3,500', cta: 'Request Project CaseSpace' },
    { name: 'PublicLogic Diagnostic', price: 'By request', cta: 'Request Diagnostic' },
    { name: 'FORM / VAULT Build', price: 'By request', cta: 'Request Build' },
    { name: 'Governance Retainer', price: 'By request', cta: 'Request Retainer' },
  ],
} as const;
