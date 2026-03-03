# Syncron8 — Plain-Language Guide

> **Syncron8** is the data-sync engine built into PuddleJumper. It connects external services to your destinations, cleans up the data along the way, and keeps everything up to date automatically.

---

## What does Syncron8 actually do?

Think of Syncron8 like a postal service for your data:

1. **Pick up** — it reads records from a source (like Monday.com, Salesforce, or a webhook).
2. **Sort** — it checks each record against your rules: should this record be included? Does it contain sensitive information that needs to be hidden?
3. **Deliver** — it sends the cleaned-up records to your destinations (like Power BI dashboards or Kahana bundles).
4. **Remember where it left off** — it keeps a bookmark (called a *cursor*) so the next run only fetches new or changed records.

Syncron8 runs on a schedule, on-demand, or in response to incoming webhook events — you choose.

---

## Key Concepts

| Term | What it means in plain language |
|------|---------------------------------|
| **Feed** | A named pipeline that connects one source to one or more destinations. Think of it as a "sync recipe". |
| **Sync Job / Run** | One execution of a feed — Syncron8 runs through the whole pick-up → sort → deliver cycle once. |
| **Records** | Individual data items that travel through the pipeline (e.g. a Monday.com board item, a Salesforce contact). |
| **Cursor** | A bookmark that tracks where the last sync left off, so the next run only fetches what's new. |
| **Field Map** | A mapping that renames or transforms fields as they pass through (e.g. rename `first_name` → `FirstName`). |
| **DLP** | *Data Loss Prevention* — automatic scanning that detects sensitive data (like email addresses or phone numbers) and can mask, redact, or block it before it leaves your system. |
| **Archieve / Audit Log** | A tamper-evident record of everything that happened: every sync, every record change, every blocked item. |

---

## What happens during a sync?

Here is the step-by-step lifecycle of a single sync run:

```
1. queued       → Job created and waiting to start
2. running      → Fetching records from the source
3. transforming → Applying field maps, DLP checks, and filter rules
4. delivering   → Sending records to destinations (sinks)
5. completed    → All done ✓
   partial      → Done, but some destinations had delivery errors
   failed       → Something went wrong before delivery
```

---

## What does "partial" mean?

A **partial** sync means records were successfully fetched and processed, but at least one destination (sink) had trouble receiving them. For example:

- Power BI returned an error for one batch of rows.
- The Kahana endpoint was temporarily unavailable.

Your source records are still safely stored. You can use the **retry-sinks** endpoint to attempt delivery again without re-fetching from the source.

---

## Feed Lifecycle

A feed moves through these states:

```
draft → active → paused → active (again)
                         → retired
```

- **draft**: Being set up. You can edit it freely.
- **active**: Running on its schedule (or manually triggered).
- **paused**: Temporarily stopped. No new runs will start.
- **retired**: Permanently stopped. Cannot be reactivated.

---

## API Quick Reference

All endpoints live under `/api/syncronate`. Most require an authenticated session (JWT).

### System Health

```bash
GET /api/syncronate/health
```

Returns whether Syncron8 is running normally, how many feeds are active, and how many jobs are currently running.

**Example response:**
```json
{
  "success": true,
  "correlationId": "a1b2c3d4-...",
  "data": {
    "status": "ok",
    "message": "Syncron8 is running normally.",
    "activeFeeds": 3,
    "jobsRunning": 0,
    "timestamp": "2025-01-01T12:00:00.000Z"
  }
}
```

---

### Feed Status

```bash
GET /api/syncronate/feeds/:feedId/status
Authorization: Bearer <token>
```

Returns a human-readable summary of a feed: when it last ran, whether a sync is currently in progress, and the result of the most recent job.

**Example response:**
```json
{
  "success": true,
  "correlationId": "a1b2c3d4-...",
  "data": {
    "feedId": "feed_abc123",
    "displayName": "Monday.com → Power BI",
    "status": "active",
    "lastSyncAt": "2025-01-01T11:30:00.000Z",
    "syncRunning": false,
    "lastJobResult": {
      "jobId": "job_xyz789",
      "status": "completed",
      "completedAt": "2025-01-01T11:31:05.000Z",
      "stats": {
        "ingested": 42,
        "updated": 5,
        "skipped": 3,
        "blocked": 0,
        "transformErrors": 0,
        "delivered": 47,
        "deliveryFailed": 0
      }
    }
  }
}
```

---

### Create a Feed

```bash
POST /api/syncronate/feeds
Authorization: Bearer <token>
Content-Type: application/json

{
  "displayName": "Monday.com → Power BI",
  "source": {
    "connectorId": "my-monday-connector",
    "type": "monday",
    "config": { "boardId": "12345678" }
  },
  "sinks": [
    {
      "connectorId": "my-powerbi-sink",
      "type": "powerbi",
      "config": { "datasetId": "ds-abc", "tableId": "tbl-xyz" }
    }
  ],
  "fieldMap": [
    { "sourceField": "name", "targetField": "Name" },
    { "sourceField": "status", "targetField": "Status" }
  ],
  "syncConfig": {
    "scheduleExpression": "*/15 * * * *",
    "dlpInboundAction": "mask"
  }
}
```

**Example response:**
```json
{
  "success": true,
  "correlationId": "a1b2c3d4-...",
  "data": { "feedId": "feed_abc123", "status": "draft", ... }
}
```

---

### Trigger a Manual Sync

```bash
POST /api/syncronate/feeds/:feedId/sync
Authorization: Bearer <token>
```

Starts a sync immediately. Returns right away with a job ID — the sync runs in the background.

**Example response:**
```json
{
  "success": true,
  "correlationId": "a1b2c3d4-...",
  "data": {
    "jobId": "job_xyz789",
    "status": "queued",
    "message": "Sync started. You can track progress via the job status endpoint."
  }
}
```

---

### Check a Job's Progress

```bash
GET /api/syncronate/feeds/:feedId/jobs/:jobId
Authorization: Bearer <token>
```

---

### List Available Connectors

```bash
GET /api/syncronate/connectors
Authorization: Bearer <token>
```

---

## Response Format

Every API response follows the same envelope:

**Success:**
```json
{
  "success": true,
  "correlationId": "<uuid>",
  "data": { ... }
}
```

**Error:**
```json
{
  "success": false,
  "correlationId": "<uuid>",
  "error": {
    "message": "Human-readable explanation of what went wrong.",
    "code": "MACHINE_READABLE_CODE"
  }
}
```

The `correlationId` appears in server logs under the same ID, so your support team can trace exactly what happened.

---

## Troubleshooting

### "Your account is not linked to a workspace"
Your user account doesn't have a `tenantId`. Contact your administrator to make sure your account is correctly provisioned.

### "Only feeds in 'draft' status can be edited"
To make changes to an active or paused feed, you need to retire it and create a new one (or contact support if your workflow requires in-place editing).

### "This feed is not active. Please activate it before starting a sync."
Activate the feed first via `POST /api/syncronate/feeds/:feedId/activate`, then trigger the sync.

### A sync shows status "partial"
One or more destinations had delivery errors. Check the job's `stats.deliveryFailed` count and the audit log for details. Use the `retry-sinks` endpoint to retry delivery without re-fetching source data.

### DLP is blocking records unexpectedly
Check the **data protection report** at `GET /api/syncronate/feeds/:feedId/dlp-report`. If legitimate data is being flagged, review your `dlpInboundAction` setting in the feed's `syncConfig`.

---

## Glossary

| Internal term | Plain-language meaning |
|---------------|------------------------|
| **Syncronate / Syncron8** | The data-sync engine. "Syncronate" is the internal module name; "Syncron8" is the product name. |
| **Archieve** | The audit log system — a tamper-evident chain of events that records everything that happens in the system. |
| **DLP** | *Data Loss Prevention* — automatic detection and handling of sensitive data fields (PII, credentials, etc.). |
| **SEAL** | A cryptographic signing layer that signs outbound payloads so recipients can verify authenticity. |
| **Polimorphic** | An external platform that can push events to Syncron8 via webhook. |
| **Kahana** | A destination (sink) that packages records into ZIP bundles for enterprise export. |
| **Tombstone** | Marking a record as deleted without physically removing it — the record stays in the audit trail. |
| **Cursor** | A bookmark used to track progress between sync runs, so only new/changed records are fetched. |
