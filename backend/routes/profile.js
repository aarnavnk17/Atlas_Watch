'use strict';

const express = require('express');
const { User, Profile } = require('../models');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

const PROFILE_FIELDS = [
  'fullName', 'phoneNumber', 'passport', 'documentType', 'nationality',
  'bloodGroup', 'medicalConditions', 'allergies',
  'isStudent', 'universityName', 'isWorking', 'organizationName',
];

function pickProfileFields(source) {
  const out = {};
  for (const field of PROFILE_FIELDS) {
    if (source[field] !== undefined) out[field] = source[field];
  }
  return out;
}

router.get('/profile', requireAuth, async (req, res) => {
  const row = await Profile.findOne({ email: req.userEmail }).lean();
  if (!row) return res.json({ success: false, profile: null });
  return res.json({ success: true, profile: pickProfileFields(row) });
});

router.post('/profile', requireAuth, async (req, res) => {
  const email = req.userEmail;
  const update = pickProfileFields(req.body);

  if (update.passport) {
    const existing = await Profile.findOne({ passport: update.passport }).lean();
    if (existing && existing.email !== email) {
      return res.status(400).json({ success: false, message: 'Passport already registered to another user' });
    }
  }

  await Profile.findOneAndUpdate({ email }, { $set: { email, ...update } }, { upsert: true });
  await User.updateOne({ email }, { $set: { profile_completed: true } });
  return res.json({ success: true });
});

module.exports = router;
