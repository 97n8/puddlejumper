// Stub implementations for each output channel.
// Replace with real integrations (CMS API, email service, social platform) per municipality config.

export interface ChannelResult {
  channel: string;
  success: boolean;
  externalId?: string;
  error?: string;
}

export async function websitePost(_payload: unknown): Promise<ChannelResult> {
  return { channel: 'website_post', success: true };
}

export async function activityFeedEntry(_payload: unknown): Promise<ChannelResult> {
  return { channel: 'activity_feed', success: true };
}

export async function weeklyDigest(_payload: unknown): Promise<ChannelResult> {
  return { channel: 'weekly_digest', success: true };
}

export async function emailSummary(_payload: unknown): Promise<ChannelResult> {
  return { channel: 'email_summary', success: true };
}

export async function socialDraft(_payload: unknown): Promise<ChannelResult> {
  return { channel: 'social_draft', success: true };
}

export async function quarterlyReport(_payload: unknown): Promise<ChannelResult> {
  return { channel: 'quarterly_report', success: true };
}
