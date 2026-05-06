import type { Case, Task } from './types';

export const SEED_CASES: Case[] = [
  {
    id: 'c-2nd-worcester',
    name: '2nd Worcester · Field Ops',
    kicker: 'Campaign',
    color: '#7a3329',
    pinned: true,
    tools: ['capture', 'docket', 'notes', 'people', 'timeline'],
    connections: ['gdrive', 'gmail', 'cal'],
    ai: ['claude', 'web'],
    lastOpened: Date.now() - 3600000
  },
  {
    id: 'c-permit-bridge',
    name: 'Permit&Bridge',
    kicker: 'PL Service',
    color: '#4a6741',
    pinned: true,
    tools: ['capture', 'notes', 'code', 'policy', 'files'],
    connections: ['pj', 'vault', 'commons', 'm365'],
    ai: ['claude'],
    lastOpened: Date.now() - 7200000
  },
  {
    id: 'c-phillipston',
    name: 'Phillipston · Web Central',
    kicker: 'Client',
    color: '#1f4e6b',
    pinned: false,
    tools: ['capture', 'docket', 'notes', 'files', 'timeline'],
    connections: ['m365', 'gmail', 'commons'],
    ai: ['claude'],
    lastOpened: Date.now() - 86400000
  },
  {
    id: 'c-kendall',
    name: 'Kendall Pond STR',
    kicker: 'Personal',
    color: '#7d6228',
    pinned: false,
    tools: ['capture', 'docket', 'files'],
    connections: ['icloud', 'cal'],
    ai: ['claude-h'],
    lastOpened: Date.now() - 172800000
  },
  {
    id: 'c-pl-ops',
    name: 'PublicLogic · Ops',
    kicker: 'PL Internal',
    color: '#3a4350',
    pinned: false,
    tools: ['capture', 'docket', 'notes', 'code', 'files'],
    connections: ['pj', 'vault', 'commons', 'gdrive', 'm365'],
    ai: ['claude', 'web'],
    lastOpened: Date.now() - 259200000
  }
];

export const SEED_DOCKET: Task[] = [
  {
    id: crypto.randomUUID(),
    text: 'Walk lists · Templeton precinct 2',
    caseId: 'c-2nd-worcester',
    done: false
  },
  {
    id: crypto.randomUUID(),
    text: 'Permit&Bridge intake form review',
    caseId: 'c-permit-bridge',
    done: false
  },
  {
    id: crypto.randomUUID(),
    text: 'Phillipston site QA · Web Central migration',
    caseId: 'c-phillipston',
    done: false
  },
  {
    id: crypto.randomUUID(),
    text: 'STR linen vendor confirm',
    caseId: 'c-kendall',
    done: true,
    completedAt: Date.now() - 86400000
  },
  {
    id: crypto.randomUUID(),
    text: 'OCPF Q2 reconciliation draft',
    caseId: 'c-2nd-worcester',
    done: false
  },
  {
    id: crypto.randomUUID(),
    text: 'VAULT framework — encoding boundary memo',
    caseId: 'c-pl-ops',
    done: false
  }
];
