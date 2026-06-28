'use strict';
require('dotenv').config();

const CASE_API_URL    = process.env.CASE_API_URL || 'http://localhost:3003';
const POLL_INTERVAL   = parseInt(process.env.POLL_INTERVAL_MS || '300000', 10);
const { dispatch }    = require('./dispatcher');

async function poll() {
  try {
    const res = await fetch(`${CASE_API_URL}/api/v1/obligations/overdue`, {
      headers: { 'x-logicos-request': '1' },
    });
    if (!res.ok) return;

    const { data: obligations } = await res.json();
    if (!Array.isArray(obligations)) return;

    for (const obl of obligations) {
      // Mark overdue
      await fetch(`${CASE_API_URL}/api/v1/cases/${obl.case_id}/actions`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', 'x-logicos-request': '1' },
        body:    JSON.stringify({
          action_type: 'system_flag',
          side:        'system',
          description: `Obligation ${obl.id} overdue`,
          metadata:    { obligation_id: obl.id },
        }),
      }).catch(() => {});

      // Schedule escalation 24h from now
      const escalateAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      const { v4: uuidv4 } = require('uuid');
      await dispatch({
        id:            uuidv4(),
        case_id:       obl.case_id,
        obligation_id: obl.id,
        task_type:     'escalation',
        scheduled_at:  escalateAt,
        recipient:     obl.assigned_to || 'staff',
        recipient_type: 'actor',
        channel:       'in_app',
        status:        'pending',
        attempt_count: 1,
      });
    }
  } catch (err) {
    console.warn('[deadlineMonitor] poll error:', err.message);
  }
}

function start() {
  console.log(`[pulse] deadline monitor started (interval: ${POLL_INTERVAL}ms)`);
  poll();
  setInterval(poll, POLL_INTERVAL);
}

module.exports = { start };
