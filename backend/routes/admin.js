'use strict';

const express = require('express');
const { User, Profile, AnomalyLog } = require('../models');
const { requireAdmin } = require('../middleware/auth');

const router = express.Router();

// Everything here reads across all users: medical details, passport numbers and
// live positions. It is operator-only — the guard is attached per route because
// this router is mounted at the application root.

router.get('/admin/profiles', requireAdmin, async (req, res) => {
  const [users, profiles] = await Promise.all([
    User.find({}).sort({ createdAt: -1 }).lean(),
    Profile.find({}).lean(),
  ]);

  const byEmail = new Map(profiles.map(p => [p.email, p]));
  const merged = users.map(user => {
    const profile = byEmail.get(user.email) || {};
    return {
      email: user.email,
      fullName: profile.fullName || 'New Shield Member',
      phoneNumber: profile.phoneNumber || 'Pending profile setup',
      passport: profile.passport || '',
      documentType: profile.documentType || '',
      nationality: profile.nationality || '',
      bloodGroup: profile.bloodGroup || '',
      medicalConditions: profile.medicalConditions || '',
      allergies: profile.allergies || '',
      isStudent: profile.isStudent || false,
      universityName: profile.universityName || '',
      isWorking: profile.isWorking || false,
      organizationName: profile.organizationName || '',
      profileCompleted: user.profile_completed || false,
      lastLocation: user.lastLocation || null,
      activeJourney: user.active_journey || null,
      createdAt: user.createdAt,
    };
  });

  return res.json({ success: true, profiles: merged });
});

router.get('/admin/anomaly-summary', requireAdmin, async (req, res) => {
  const summary = await AnomalyLog.aggregate([
    {
      $group: {
        _id: '$email',
        totalEvents: { $sum: 1 },
        anomalyCount: { $sum: { $cond: ['$anomaly_flag', 1, 0] } },
        highRiskCount: { $sum: { $cond: [{ $eq: ['$risk_level', 'high'] }, 1, 0] } },
        lastEvent: { $max: '$timestamp' },
        lastReason: { $last: '$reason' },
        lastRiskLevel: { $last: '$risk_level' },
      },
    },
    { $sort: { anomalyCount: -1 } },
  ]);
  return res.json({ success: true, summary });
});

router.get('/anomaly-log', requireAdmin, async (req, res) => {
  const filter = req.query.email ? { email: String(req.query.email).trim().toLowerCase() } : {};
  const logs = await AnomalyLog.find(filter).sort({ timestamp: -1 }).limit(200).lean();
  return res.json({ success: true, logs });
});

module.exports = router;
