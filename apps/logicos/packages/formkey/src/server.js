'use strict';
require('dotenv').config();

const express   = require('express');
const helmet    = require('helmet');
const cors      = require('cors');
const rateLimit = require('express-rate-limit');
const { upload, handleUpload, errorHandler } = require('./routes/upload');

const app  = express();
const PORT = process.env.PORT || 3005;

app.use(helmet());
app.use(cors());
app.use(rateLimit({ windowMs: 60_000, max: 60 }));

app.use((req, res, next) => {
  if (req.method !== 'GET' && req.headers['x-logicos-request'] !== '1') {
    return res.status(403).json({ error: 'CSRF_REJECTED' });
  }
  next();
});

app.post('/api/v1/cases/:caseId/upload', upload.single('file'), handleUpload);
app.use(errorHandler);

app.listen(PORT, () => console.log(`[formkey] listening on :${PORT}`));
module.exports = app;
