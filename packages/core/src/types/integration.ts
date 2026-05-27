// Canon: integration intents — tool-agnostic dispatch.
// Source: Master Build Spec v1.1, Part 9 (Integration Layer).
//
// PJ emits intents. The user's stack handles them.
// The tool doesn't matter. The intent is canon.

// Closed canonical intent set (Part 9).
export type IntegrationIntent =
  | 'remind'
  | 'deadline'
  | 'prompt'
  | 'notify.external'
  | 'digest'
  | 'drive.link';

export type IntegrationStack =
  | 'google_workspace'
  | 'microsoft_365'
  | 'apple'
  | 'custom';

export interface IntegrationManifest {
  manifest_id: string;
  user_id: string;
  tenant_id: string;
  manifest_yaml: string;
  webhook_url: string | null;
  stack: IntegrationStack;
  created_at: string;
  updated_at: string;
}

export interface IntentPayload {
  intent: IntegrationIntent;
  process_id: string;
  process_title: string;
  step?: string;
  due?: string;
  domain?: string;
  urgency?: 'cool' | 'warm' | 'hot';
  user_id: string;
  tenant_id: string;
  // Intent-specific fields.
  extra?: Record<string, unknown>;
}

export type IntentQueueStatus = 'pending' | 'dispatched' | 'failed' | 'suppressed';

export interface IntentQueueRow {
  id: string;
  user_id: string;
  tenant_id: string;
  intent: IntegrationIntent;
  payload_json: string;
  status: IntentQueueStatus;
  queued_at: string;
  dispatched_at: string | null;
  error_detail: string | null;
}
