'use strict';

const express = require('express');
const rateLimit = require('express-rate-limit');

const { SosAlert, User, Contact, Profile, SOS_TRIGGERS } = require('../models');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { notifyEmergencyContacts } = require('../lib/notifier');

const router = express.Router();

// Generous — a panicking user may well tap twice — but not unbounded.
const sosLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 40,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { success: false, message: 'Too many SOS requests' },
});

/** Unknown trigger values are recorded as manual rather than rejected. */
function normalizeTrigger(value) {
  return SOS_TRIGGERS.includes(value) ? value : 'manual';
}

router.post('/sos', requireAuth, sosLimiter, async (req, res) => {
  const email = req.userEmail;
  const lat = req.body.lat != null ? Number(req.body.lat) : null;
  const lng = req.body.lng != null ? Number(req.body.lng) : null;
  const trigger = normalizeTrigger(req.body.trigger);
  const aiScore = req.body.aiScore != null ? Number(req.body.aiScore) : undefined;

  const alert = await SosAlert.create({
    email,
    lat: Number.isFinite(lat) ? lat : null,
    lng: Number.isFinite(lng) ? lng : null,
    trigger,
    aiScore,
    notes: req.body.notes || null,
  });

  if (Number.isFinite(lat) && Number.isFinite(lng)) {
    await User.updateOne({ email }, { $set: { lastLocation: { lat, lng, sos: true, timestamp: new Date() } } });
  }

  console.log(`🚨 SOS ALERT from ${email} at [${lat}, ${lng}] — trigger: ${trigger}`);

  // Notify from the server. The app also opens the SMS composer, but that needs
  // the user to press send, which is not a safe assumption during an SOS.
  const [contacts, profile] = await Promise.all([
    Contact.find({ user_email: email }).lean(),
    Profile.findOne({ email }).lean(),
  ]);

  const notifications = await notifyEmergencyContacts({
    contacts,
    location: { lat, lng },
    profile,
    aiScore,
    trigger,
  });

  if (notifications.length) {
    await SosAlert.updateOne({ _id: alert._id }, { $set: { notifications } });
  }

  return res.json({
    success: true,
    alert_id: alert._id,
    contactsNotified: notifications.filter(n => n.status === 'sent').length,
    contactsTotal: notifications.length,
  });
});

/** The caller's own active alerts. */
router.get('/sos/mine', requireAuth, async (req, res) => {
  const alerts = await SosAlert.find({ email: req.userEmail }).sort({ timestamp: -1 }).limit(20).lean();
  return res.json({ success: true, alerts });
});

/** Stand down the caller's own alerts — scoped to them, never to a pattern. */
router.post('/sos/resolve', requireAuth, async (req, res) => {
  const now = new Date();
  await SosAlert.updateMany(
    { email: req.userEmail, status: 'active' },
    { $set: { status: 'resolved', resolvedAt: now } }
  );
  await User.updateOne({ email: req.userEmail }, { $set: { 'lastLocation.sos': false } });
  console.log(`✅ SOS resolved by user: ${req.userEmail}`);
  return res.json({ success: true });
});

// ── Operator endpoints ────────────────────────────────────────────────────
router.get('/sos/alerts', requireAdmin, async (req, res) => {
  const alerts = await SosAlert.find({}).sort({ timestamp: -1 }).limit(100).lean();
  return res.json({ success: true, alerts });
});

router.post('/sos/:id/resolve', requireAdmin, async (req, res) => {
  const alert = await SosAlert.findOneAndUpdate(
    { _id: req.params.id },
    { $set: { status: 'resolved', resolvedAt: new Date() } },
    { new: true }
  ).lean();

  if (!alert) return res.status(404).json({ success: false, message: 'Alert not found' });

  const stillActive = await SosAlert.countDocuments({ email: alert.email, status: 'active' });
  if (stillActive === 0) {
    await User.updateOne({ email: alert.email }, { $set: { 'lastLocation.sos': false } });
  }
  return res.json({ success: true });
});

module.exports = router;
