import type Database from 'better-sqlite3';
import crypto from 'crypto';

function substituteTokens(template: string, ctx: Record<string, unknown>): string {
  return template
    .replace(/\{\{guest_name\}\}/g, String(ctx.guest_name ?? ''))
    .replace(/\{\{property_name\}\}/g, String(ctx.property_name ?? ''))
    .replace(/\{\{check_in\}\}/g, String(ctx.check_in ?? ''))
    .replace(/\{\{check_out\}\}/g, String(ctx.check_out ?? ''))
    .replace(/\{\{door_code\}\}/g, String(ctx.door_code ?? '[see app]'))
    .replace(/\{\{wifi_name\}\}/g, String(ctx.wifi_name ?? ''))
    .replace(/\{\{wifi_password\}\}/g, String(ctx.wifi_password ?? ''));
}

async function executeAutomationJob(db: Database.Database, job: Record<string, unknown>): Promise<void> {
  const config = JSON.parse(job.action_config as string) as Record<string, unknown>;
  if (job.action === 'send_message') {
    const body = substituteTokens(String(config.body ?? ''), job);
    db.prepare(`
      INSERT INTO stayos_messages (id, workspace_id, reservation_id, direction, channel, to_address, from_address, body, status, sent_at, created_at)
      VALUES (?, ?, ?, 'outbound', ?, ?, 'system', ?, 'sent', datetime('now'), datetime('now'))
    `).run(
      crypto.randomUUID(),
      job.workspace_id,
      job.reservation_id ?? null,
      config.channel ?? 'sms',
      (job.guest_phone ?? job.guest_email ?? '') as string,
      body,
    );
  } else if (job.action === 'lock_code_set' || job.action === 'lock_code_clear' || job.action === 'thermostat_set') {
    // Device action stub — would dispatch to device broker
    console.log(`[stayos:worker] Device action stub: ${job.action as string} for job ${job.id as string}`);
  }
}

async function runAutomationJobs(db: Database.Database): Promise<void> {
  const due = db.prepare(`
    SELECT q.*, a.action, a.action_config, r.guest_name, r.guest_email, r.guest_phone,
           p.name as property_name, p.door_code, p.wifi_name, p.wifi_password
    FROM stayos_automation_queue q
    JOIN stayos_automations a ON q.automation_id = a.id
    LEFT JOIN stayos_reservations r ON q.reservation_id = r.id
    LEFT JOIN stayos_properties p ON r.property_id = p.id
    WHERE q.status = 'pending' AND q.scheduled_at <= datetime('now')
    LIMIT 20
  `).all() as Record<string, unknown>[];

  for (const job of due) {
    db.prepare(`UPDATE stayos_automation_queue SET status = 'running' WHERE id = ?`).run(job.id);
    try {
      await executeAutomationJob(db, job);
      db.prepare(`UPDATE stayos_automation_queue SET status = 'done', ran_at = datetime('now') WHERE id = ?`).run(job.id);
    } catch (e) {
      db.prepare(`UPDATE stayos_automation_queue SET status = 'failed', error = ?, ran_at = datetime('now') WHERE id = ?`).run(String(e), job.id);
    }
  }
}

export function startAutomationWorker(db: Database.Database): void {
  setInterval(() => {
    runAutomationJobs(db).catch(err => console.error('[stayos:worker] Error:', err));
  }, 60_000);
}
