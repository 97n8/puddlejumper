'use strict';
require('dotenv').config();

const express   = require('express');
const cors      = require('cors');
const { v4: uuidv4 } = require('uuid');
const { dispatch }      = require('./services/dispatcher');
const { start: startMonitor } = require('./services/deadlineMonitor');

const app  = express();
const PORT = process.env.PORT || 3007;

app.use(cors());
app.use(express.json());

app.use((req, res, next) => {
  if (req.method !== 'GET' && req.headers['x-logicos-request'] !== '1') {
    return res.status(403).json({ error: 'CSRF_REJECTED' });
  }
  next();
});

app.post('/api/v1/tasks/schedule', (req, res) => {
  const { obligation_id, case_id, due_date, assigned_to, assigned_side, task_type } = req.body;
  if (!due_date) return res.status(400).json({ error: 'due_date required' });

  const task = {
    id:            uuidv4(),
    case_id:       case_id    || null,
    obligation_id: obligation_id || null,
    task_type:     task_type  || 'obligation_due',
    scheduled_at:  due_date,
    recipient:     assigned_to || 'system',
    recipient_type: assigned_side === 'A' ? 'actor' : 'entity',
    channel:       'in_app',
    status:        'pending',
    attempt_count: 1,
  };

  const delay = Math.max(0, new Date(due_date).getTime() - Date.now());
  setTimeout(() => dispatch(task), delay);

  res.status(202).json({ data: { task_id: task.id, scheduled_at: due_date } });
});

app.get('/api/v1/tasks/dead-letter', (req, res) => {
  const { getDeadLetterLog } = require('./services/dispatcher');
  res.json({ data: getDeadLetterLog() });
});

app.listen(PORT, () => {
  console.log(`[pulse] listening on :${PORT}`);
  startMonitor();
});
module.exports = app;
