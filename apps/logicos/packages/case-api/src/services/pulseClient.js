'use strict';
require('dotenv').config();

const PULSE_URL = process.env.PULSE_URL || 'http://localhost:3007';
const RETRY_DELAYS = [0, 1000, 5000];

async function postWithRetry(url, body) {
  for (let i = 0; i < RETRY_DELAYS.length; i++) {
    if (RETRY_DELAYS[i] > 0) {
      await new Promise(r => setTimeout(r, RETRY_DELAYS[i]));
    }
    try {
      const res = await fetch(url, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', 'x-logicos-request': '1' },
        body:    JSON.stringify(body),
      });
      if (res.ok) return true;
    } catch (err) {
      if (i === RETRY_DELAYS.length - 1) {
        console.warn(`[pulseClient] All retries failed for ${url}:`, err.message);
      }
    }
  }
  return false;
}

async function scheduleObligationTask({ obligation_id, case_id, due_date, assigned_to, assigned_side }) {
  if (!due_date) return;

  await postWithRetry(`${PULSE_URL}/api/v1/tasks/schedule`, {
    obligation_id, case_id, due_date, assigned_to, assigned_side,
    task_type: 'obligation_due',
  });

  const reminderDate = new Date(new Date(due_date).getTime() - 48 * 60 * 60 * 1000).toISOString();
  await postWithRetry(`${PULSE_URL}/api/v1/tasks/schedule`, {
    obligation_id, case_id, due_date: reminderDate, assigned_to, assigned_side,
    task_type: 'obligation_reminder',
  });
}

async function scheduleEscalation({ obligation_id, case_id, overdue_at, side_a_owner }) {
  const escalateAt = new Date(new Date(overdue_at).getTime() + 24 * 60 * 60 * 1000).toISOString();
  await postWithRetry(`${PULSE_URL}/api/v1/tasks/schedule`, {
    obligation_id, case_id,
    due_date:   escalateAt,
    assigned_to: side_a_owner,
    assigned_side: 'A',
    task_type:  'escalation',
  });
}

module.exports = { scheduleObligationTask, scheduleEscalation };
