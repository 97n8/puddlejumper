'use strict';
const crypto = require('crypto');
const path   = require('path');
const fs     = require('fs');
const multer = require('multer');
const { scan } = require('../services/documentStore');

const CASE_API_URL = process.env.CASE_API_URL || 'http://localhost:3003';
const UPLOAD_DIR   = process.env.UPLOAD_DIR   || './uploads';

const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/tiff',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];
const MAX_FILE_BYTES = 25 * 1024 * 1024; // 25MB

if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename:    (req, file, cb) => {
    const safeExt = path.extname(file.originalname).replace(/[^a-z0-9.]/gi, '').slice(0, 10);
    cb(null, `${Date.now()}-${crypto.randomBytes(8).toString('hex')}${safeExt}`);
  },
});

const fileFilter = (req, file, cb) => {
  if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    cb(null, true);
  } else {
    const err = new multer.MulterError('LIMIT_UNEXPECTED_FILE');
    err.code = 'MIME_REJECTED';
    cb(err, false);
  }
};

const upload = multer({ storage, limits: { fileSize: MAX_FILE_BYTES }, fileFilter });

async function handleUpload(req, res) {
  if (!req.file) return res.status(400).json({ error: 'NO_FILE' });

  const filePath = req.file.path;
  const buf      = fs.readFileSync(filePath);
  const checksum = crypto.createHash('sha256').update(buf).digest('hex');

  const avResult = await scan(filePath);
  if (!avResult.clean) {
    fs.unlinkSync(filePath);
    return res.status(422).json({ error: 'FILE_REJECTED_AV', message: 'File failed security scan.' });
  }

  const case_id = req.params.caseId;
  const doc_id  = require('uuid').v4();
  const stored_at = new Date().toISOString();

  await fetch(`${CASE_API_URL}/api/v1/cases/${case_id}/documents`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', 'x-logicos-request': '1' },
    body:    JSON.stringify({
      doc_id, checksum, stored_at,
      doc_type:     req.body.doc_type || 'upload',
      vault_class:  req.body.vault_class || 'internal',
      submission_id: req.body.submission_id || null,
      uploader_type: 'entity',
    }),
  });

  res.json({ data: { doc_id, checksum, stored_at } });
}

function errorHandler(err, req, res, next) {
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ error: 'FILE_TOO_LARGE', message: 'File too large. Maximum 25MB.' });
  }
  if (err.code === 'MIME_REJECTED') {
    return res.status(415).json({ error: 'UNSUPPORTED_MEDIA', message: 'File type not allowed.' });
  }
  next(err);
}

module.exports = { upload, handleUpload, errorHandler };
