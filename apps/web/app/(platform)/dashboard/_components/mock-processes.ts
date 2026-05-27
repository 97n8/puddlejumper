// Mock data shaped to the canon @publiclogic/core `Process` type.
// Phase 5 is UI-only; live API wiring is a follow-up phase.

import type { Process } from '@publiclogic/core';

export const MOCK_PROCESSES: Process[] = [
  {
    process_id: '01HX1A4ZGKB1C2M5VN7QR3F8XY',
    process_type: 'PRR',
    canon_version: '1.0.0',
    tenant_id: 't-phillipston',
    deployment_id: 'phillipston',
    current_state: 'reviewing',
    created_at: '2026-05-24T14:31:00.000Z',
    created_by_ref: 'public-portal',
    assignee_ref: 'records-officer-1',
    closed_at: null,
    fields: {
      subject: 'Records of 2025 budget meeting minutes',
      requester_email: 'jcitizen@example.org',
    },
    links: [],
  },
  {
    process_id: '01HX1B5RG8T2D8K9MW0NPV6CQH',
    process_type: 'PRR',
    canon_version: '1.0.0',
    tenant_id: 't-phillipston',
    deployment_id: 'phillipston',
    current_state: 'assigned',
    created_at: '2026-05-25T09:12:00.000Z',
    created_by_ref: 'public-portal',
    assignee_ref: 'records-officer-1',
    closed_at: null,
    fields: {
      subject: 'Highway department expenditure ledger FY24',
      requester_email: 'reporter@local-news.example',
    },
    links: [],
  },
  {
    process_id: '01HX1C6F45Y3M9L0PX1RW7DAEZ',
    process_type: 'PRR',
    canon_version: '1.0.0',
    tenant_id: 't-phillipston',
    deployment_id: 'phillipston',
    current_state: 'logged',
    created_at: '2026-05-26T16:48:00.000Z',
    created_by_ref: 'public-portal',
    assignee_ref: null,
    closed_at: null,
    fields: {
      subject: 'Town clerk meeting attendance, March 2026',
    },
    links: [],
  },
  {
    process_id: '01HX1D7H89Z4N0M2QY5SV1JBKL',
    process_type: 'PRR',
    canon_version: '1.0.0',
    tenant_id: 't-phillipston',
    deployment_id: 'phillipston',
    current_state: 'responded',
    created_at: '2026-05-20T11:02:00.000Z',
    created_by_ref: 'public-portal',
    assignee_ref: 'records-officer-1',
    closed_at: null,
    fields: {
      subject: 'Conservation commission minutes Q1 2026',
    },
    links: [],
  },
];

export const MOCK_AUDIT = [
  {
    event_id: 'evt-1',
    event_family: 'process',
    event_subtype: 'process.created',
    actor_ref: 'public-portal',
    occurred_at: '2026-05-24T14:31:00.000Z',
  },
  {
    event_id: 'evt-2',
    event_family: 'transition',
    event_subtype: 'transition.fired',
    actor_ref: 'records-officer-1',
    occurred_at: '2026-05-24T14:42:00.000Z',
  },
  {
    event_id: 'evt-3',
    event_family: 'role',
    event_subtype: 'role.assigned',
    actor_ref: 'records-officer-1',
    occurred_at: '2026-05-24T14:43:00.000Z',
  },
  {
    event_id: 'evt-4',
    event_family: 'transition',
    event_subtype: 'transition.fired',
    actor_ref: 'records-officer-1',
    occurred_at: '2026-05-25T09:12:00.000Z',
  },
];
