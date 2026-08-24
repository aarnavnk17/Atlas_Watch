'use strict';

const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const config = require('../config');
const { Document } = require('../models');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
const UPLOAD_DIR = path.join(__dirname, '..', 'uploads');

fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const MIME_EXTENSIONS = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/heic': '.heic',
  'image/webp': '.webp',
  'application/pdf': '.pdf',
};

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    // Unguessable name, and the extension comes from the allowlisted mime type
    // rather than from whatever the client called the file.
    const ext = MIME_EXTENSIONS[file.mimetype] || '';
    cb(null, `${crypto.randomBytes(24).toString('hex')}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: config.uploads.maxBytes, files: 1 },
  fileFilter: (req, file, cb) => {
    if (config.uploads.allowedMimeTypes.includes(file.mimetype)) return cb(null, true);
    cb(Object.assign(new Error(`Unsupported file type: ${file.mimetype}`), { status: 400 }));
  },
});


router.post('/documents/upload', requireAuth, upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded' });

  const doc = await Document.create({
    user_email: req.userEmail,
    originalName: req.file.originalname,
    fileName: req.file.filename,
    fileType: req.file.mimetype,
    sizeBytes: req.file.size,
    category: req.body.category || 'Other',
  });

  return res.json({ success: true, document: serialize(doc, req) });
});

router.get('/documents', requireAuth, async (req, res) => {
  const docs = await Document.find({ user_email: req.userEmail }).sort({ createdAt: -1 }).lean();
  return res.json({ success: true, documents: docs.map(d => serialize(d, req)) });
});

/**
 * Documents are streamed through an authenticated route. They used to sit in a
 * statically served directory, which made every passport scan in the "vault"
 * fetchable by anyone who had (or guessed) the URL.
 */
router.get('/documents/:id/file', requireAuth, async (req, res) => {
  const doc = await Document.findOne({ _id: req.params.id, user_email: req.userEmail }).lean();
  if (!doc) return res.status(404).json({ success: false, message: 'Document not found' });

  const filePath = path.join(UPLOAD_DIR, path.basename(doc.fileName));
  if (!fs.existsSync(filePath)) return res.status(404).json({ success: false, message: 'File missing from storage' });

  res.type(doc.fileType || 'application/octet-stream');
  res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(doc.originalName || 'document')}"`);
  return res.sendFile(filePath);
});

router.delete('/documents/:id', requireAuth, async (req, res) => {
  const doc = await Document.findOneAndDelete({ _id: req.params.id, user_email: req.userEmail });
  if (!doc) return res.status(404).json({ success: false, message: 'Document not found' });

  const filePath = path.join(UPLOAD_DIR, path.basename(doc.fileName));
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  return res.json({ success: true, message: 'Document deleted' });
});

function serialize(doc, req) {
  const id = doc._id.toString();
  return {
    _id: id,
    originalName: doc.originalName,
    fileType: doc.fileType,
    sizeBytes: doc.sizeBytes,
    category: doc.category,
    uploadDate: doc.uploadDate,
    createdAt: doc.createdAt,
    // Relative and absolute forms; both require the caller's bearer token.
    filePath: `/documents/${id}/file`,
    fileUrl: `${req.protocol}://${req.get('host')}/documents/${id}/file`,
  };
}

module.exports = router;
