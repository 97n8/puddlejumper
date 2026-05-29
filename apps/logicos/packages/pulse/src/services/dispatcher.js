'use strict';
require('dotenv').config();

const { v4: uuidv4 } = require('uuid');

const CASE_API_URL  = process.env.CASE_API_URL || 'http://localhost:3003';
const MAX_ATTEMPTS  = 3;
const RETRY_DELAYS  = [60000, 300000, 900000];

const pendingTasks  = new Map(); // in-memory task store (dev)
const deadLetterLog = [];        // in-memory dead-letter (dev — table is in case-api DB)

async function sendToChannel(task) {
  if (task.channel === 'in_app') {
    await fetch(`${CASE_API_URL}/api/v1/notifications`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', 'x-logicos-request': '1' },
      body:    JSON.stringify({ task }),
    }).catch(() => {});
    console.log(`[pulse] in_app notification queued for ${task.recipient}`);
  } else if (task.channel === 'email') {
    console.log(`[pulse] email → ${task.recipient}: task ${task.id} (${task.task_type})`);
  } else if (task.channel === 'sms') {
    console.log(`[pulse] sms → ${task.recipient}: task ${task.id} (${task.task_type})`);
  }
}

async function markSent(task) {
  task.status  = 'sent';
  task.sent_at = new Date().toISOString();
  await fetch(`${CASE_API_URL}/api/v1/pulse-tasks/${task.id}/sent`, {
    method:  'PATCH',
    headers: { 'Content-Type': 'application/json', 'x-logicos-request': '1' },
    body:    JSON.stringify({ sent_at: task.sent_at }),
  }).catch(() => {});
}

async function markFailed(task) {
  task.status = 'failed';
  await fetch(`${CASE_API_URL}/api/v1/pulse-tasks/${task.id}/failed`, {
    method:  'PATCH',
    headers: { 'Content-Type': 'application/json', 'x-logicos-request': '1' },
    body:    JSON.stringify({ status: 'failed' }),
  }).catch(() => {});
}

function writeDeadLetter(task, err) {
  const now = new Date().toISOString();
  const record = {
    id:              uuidv4(),
    task_id:         task.id,
    case_id:         task.case_id,
    payload:         JSON.stringify(task),
    failure_reason:  err?.message || 'Unknown failure',
    attempt_count:   task.attempt_count || MAX_ATTEMPTS,
    first_failed_at: task.first_failed_at || now,
    last_failed_at:  now,
    resolved_at:     null,
  };
  deadLetterLog.push(record);

  // Write to pulse_dead_letter table via case-api if possible
  fetch(`${CASE_API_URL}/api/v1/pulse-dead-letter`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', 'x-logicos-request': '1' },
    body:    JSON.stringify(record),
  }).catch(() => {});

  console.error(`[pulse] DEAD LETTER: task ${task.id} failed after ${MAX_ATTEMPTS} attempts.`);
}

async function dispatch(task) {
  const attempt = task.attempt_count || 1;
  try {
    await sendToChannel(task);
    await markSent(task);
  } catch (err) {
    if (attempt < MAX_ATTEMPTS) {
      const delay = RETRY_DELAYS[attempt - 1] || 60000;
      console.warn(`[pulse] task ${task.id} failed, retrying in ${delay}ms (attempt ${attempt}/${MAX_ATTEMPTS})`);
      task.attempt_count = attempt + 1;
      task.first_failed_at = task.first_failed_at || new Date().toISOString();
      setTimeout(() => dispatch(task), delay);
    } else {
      await markFailed(task);
      writeDeadLetter(task, err);
    }
  }
}

function getDeadLetterLog() { return deadLetterLog; }
function getPendingTasks()   { return pendingTasks; }

module.exports = { dispatch, writeDeadLetter, getDeadLetterLog, getPendingTasks };
