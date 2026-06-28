/* =====================================================================
   PUDDLEJUMPER · HOME · content + white-label config
   ---------------------------------------------------------------------
   This module is the SWAP POINT for white-labels. MeNA is the invariant
   base every instance ships from; N8 is the source instance. On a client
   white-label, change `env.instance` and set `env.showBaseChip = false` —
   the runtime, gates, FormKey stamp, Recordstream and Retention Catalog
   are untouched. The placeholder lists below are static for this shell;
   wiring them to live PJ data (/approvals, audit ledger, CaseSpaces) is a
   later phase.
   ===================================================================== */

export type StateTag = 'need' | 'wait' | 'draft' | 'judg' | 'ready'

/** WHITE-LABEL SWAP POINT — instance name + base chip visibility. */
export const env = {
  instance: 'N8',
  base: 'MeNA',
  /** true only on source/internal instances; hide on client white-labels. */
  showBaseChip: true,
}

/** Spine: object flow, every case, in order. There is no "Flow" object. */
export const spine = [
  'Org Manager',
  'CaseSpace',
  'FormKey',
  'DocDump',
  'CloudSync',
  'Automations',
  'Vault',
]

export const surfaces: { label: string; badge?: string; active?: boolean }[] = [
  { label: 'Home', active: true },
  { label: 'Capture', badge: '+' },
  { label: 'Start' },
  { label: 'CaseSpaces', badge: '4' },
  { label: 'Recordstream' },
  { label: 'Retention Catalog' },
]

export const workspaceNav = [{ label: 'FormKey' }, { label: 'Connections' }, { label: 'Admin' }]

/** Governance Gates — approve-before-commit checkpoints. */
export const gates: { title: string; tag: StateTag; tagLabel: string; detail: string; stamp: string; cta: string }[] = [
  {
    title: 'Approve campaign media update',
    tag: 'judg',
    tagLabel: 'Human Judgment',
    detail: 'Campaign · Output is drafted. Publishing is a gated commit.',
    stamp: 'Commit writes to Recordstream · FormKey-stamped',
    cta: 'Review & Approve',
  },
  {
    title: 'Close PublicLogic V1 brief',
    tag: 'ready',
    tagLabel: 'Ready to Close',
    detail: 'PublicLogic · Final version stamp required before Retention Catalog entry.',
    stamp: 'Close → Vault seals → ARCHIEVE stamps',
    cta: 'Approve Close',
  },
  {
    title: 'Send missing-info request',
    tag: 'judg',
    tagLabel: 'Approve Before Send',
    detail: 'Kendall Pond · PJ drafted the request; the external message is gated.',
    stamp: 'Outbound action · authority checked',
    cta: 'Approve Send',
  },
]

export const needs: { title: string; tag: StateTag; tagLabel: string; detail: string }[] = [
  {
    title: 'Missing vendor quote — Kendall Pond',
    tag: 'need',
    tagLabel: 'Need Info',
    detail: 'Property · Repair thread exists; estimate not yet attached.',
  },
  {
    title: 'Package notes for Allie',
    tag: 'draft',
    tagLabel: 'Draft Needed',
    detail: 'PublicLogic · Assemble a readable V1 brief from today’s Recordstream.',
  },
  {
    title: 'Airbnb setup access',
    tag: 'wait',
    tagLabel: 'Waiting',
    detail: 'Kendall Pond · External account configuration pending.',
  },
]

type CaseSpace =
  | { name: string; blurb: string; pills: string[]; statechain?: never }
  | { name: string; blurb: string; statechain: { steps: string[]; active: string }; pills?: never }

export const caseSpaces: CaseSpace[] = [
  { name: 'PublicLogic', blurb: 'Frameworks, clients, stewardship, 97N8 Labs', pills: ['7 Needs', '2 Gates'] },
  { name: 'Campaign', blurb: 'Media, voters, events, compliance', pills: ['Human Gate', 'Media'] },
  {
    name: 'Records (PRR)',
    blurb: 'Statutory request lifecycle',
    statechain: {
      steps: ['received', 'logged', 'assigned', 'searching', 'reviewing', 'responded', 'closed'],
      active: 'assigned',
    },
  },
  { name: 'Personal', blurb: 'Life admin, family, finance, recover', pills: ['Recover', 'Links'] },
]

export const quickActions: { label: string; gated: boolean }[] = [
  { label: 'Summarize CaseSpace', gated: false },
  { label: 'Create Timeline', gated: false },
  { label: 'Find Missing Info', gated: false },
  { label: 'Send Request', gated: true },
  { label: 'Commit Record', gated: true },
  { label: 'Close CaseSpace', gated: true },
]

export const recover: { title: string; tag: StateTag; tagLabel: string; detail: string }[] = [
  {
    title: 'PL homepage canon',
    tag: 'draft',
    tagLabel: 'Draft Needed',
    detail: '4 versions saved; current version ready for review.',
  },
  { title: 'PJ launch page', tag: 'ready', tagLabel: 'Ready', detail: 'OAuth buttons and launch copy staged.' },
]

/** Recordstream — append-only proof, feeding the Retention Catalog. */
export const recordstream: { at: string; detail: string }[] = [
  { at: '09:31', detail: 'FORM clarified as DNA framework.' },
  { at: '09:44', detail: 'Environment confirmed: MeNA base / N8 instance.' },
  { at: '10:12', detail: 'Governance defined as gates + append-only proof.' },
]

export const formKeyStamp = [
  { label: 'Identity', value: 'Active' },
  { label: 'Authority', value: 'Checked' },
  { label: 'Version', value: 'Tracked' },
]

export const connections = [
  { label: 'Apple', value: 'Primary' },
  { label: 'Microsoft 365', value: 'Connected' },
  { label: 'Google', value: 'Connected' },
  { label: 'Dump Folders', value: '4 watched' },
]
