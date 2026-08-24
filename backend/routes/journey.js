'use strict';

const express = require('express');
const { User } = require('../models');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.post('/journey', requireAuth, async (req, res) => {
  const { startLocation, endLocation, mode, reference, riskLevel } = req.body;
  const journey = { startLocation, endLocation, mode, reference, riskLevel, startTime: new Date() };
  await User.updateOne({ email: req.userEmail }, { $set: { active_journey: journey } });
  return res.json({ success: true });
});

router.delete('/journey', requireAuth, async (req, res) => {
  await User.updateOne({ email: req.userEmail }, { $set: { active_journey: null } });
  return res.json({ success: true });
});

module.exports = router;
