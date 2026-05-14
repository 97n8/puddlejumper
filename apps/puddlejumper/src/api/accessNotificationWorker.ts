// ── Access notification webhook worker ──────────────────────────────────────
import crypto from "node:crypto";
import type { PrrStore } from "./prrStore.js";
import { truncateText, logServerError } from "./serverMiddleware.js";

function computeAccessNotificationBackoffMs(retryCount: number): number {
  const baseMs = 30_000;
  const exponent = Math.max(0, retryCount - 1);
  return Math.min(60 * 60 * 1000, baseMs * 2 ** exponent);
}

type AccessNotificationWorkerOptions = {
  prrStore: PrrStore;
  webhookUrl: string;
  fetchImpl: typeof fetch;
  batchSize: number;
  maxRetries: number;
};

export async function processAccessNotificationQueueOnce(options: AccessNotificationWorkerOptions): Promise<void> {
  const claimed = options.prrStore.claimPendingAccessRequestNotifications(options.batchSize);
  if (claimed.length === 0) return;

  for (const notification of claimed) {
    const correlationId = crypto.randomUUID();
    try {
      let payload: Record<string, unknown> = {};
      try {
        payload =
          typeof notification.payload_json === "string" && notification.payload_json.trim()
            ? (JSON.parse(notification.payload_json) as Record<string, unknown>)
            : {};
      } catch {
        payload = { raw_payload: notification.payload_json };
      }

      const response = await options.fetchImpl(options.webhookUrl, {
        method: "POST",
        headers: { "content-type": "application/json", "x-correlation-id": correlationId },
        body: JSON.stringify({
          event: "access_request_notification",
          notification_id: notification.id,
          target: notification.target_email,
          tenant_id: notification.tenant_id,
          access_request_id: notification.access_request_id,
          correlation_id: correlationId,
          payload,
        }),
      });

      const responseBody = truncateText(await response.text(), 2_000);
      if (!response.ok) {
        throw new Error(`Webhook returned ${response.status}: ${responseBody || "empty response"}`);
      }

      options.prrStore.markAccessRequestNotificationDelivered({
        notificationId: notification.id,
        deliveredAt: new Date().toISOString(),
        responseSummary: JSON.stringify({ status: response.status, body: responseBody }),
      });
    } catch (error) {
      const retryCount = Number.isFinite(notification.retry_count) ? notification.retry_count : 1;
      const shouldFail = retryCount >= options.maxRetries;
      const nextAttemptAt = shouldFail
        ? null
        : new Date(Date.now() + computeAccessNotificationBackoffMs(retryCount)).toISOString();
      const message = truncateText(
        error instanceof Error ? error.message : "Unknown notification delivery error",
        1_000,
      );
      options.prrStore.markAccessRequestNotificationRetry({
        notificationId: notification.id,
        status: shouldFail ? "failed" : "retry",
        nextAttemptAt,
        errorMessage: message,
      });
      logServerError("access-notification-worker", correlationId, error);
    }
  }
}
