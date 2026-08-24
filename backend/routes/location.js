'use strict';

const express = require('express');
const { Location, User, Geofence, AnomalyLog } = require('../models');
const { requireAuth } = require('../middleware/auth');
const { isValidCoordinate } = require('../lib/geo');
const riskAnalysis = require('../services/riskAnalysis');

const router = express.Router();

const HISTORY_WINDOW_MINUTES = 10;

router.post('/location', requireAuth, async (req, res) => {
  const { address, accuracy, timestamp, riskLevel } = req.body;
  const lat = Number(req.body.lat);
  const lng = Number(req.body.lng);

  if (!isValidCoordinate(lat, lng)) {
    return res.status(400).json({ success: false, message: 'Valid lat and lng are required' });
  }

  // Each fix is appended, not overwritten. The anomaly rules compare
  // consecutive fixes, so a single upserted row per user left them permanently
  // unable to fire. A TTL index on the collection bounds the history.
  const loc = await Location.create({
    email: req.userEmail,
    lat,
    lng,
    address,
    accuracy,
    riskLevel,
    timestamp: timestamp ? new Date(timestamp) : new Date(),
  });

  await User.updateOne(
    { email: req.userEmail },
    { $set: { lastLocation: { lat, lng, address, accuracy, riskLevel, timestamp: loc.timestamp } } }
  );

  return res.json({ success: true, id: loc._id });
});

router.get('/location/latest', requireAuth, async (req, res) => {
  const loc = await Location.findOne({ email: req.userEmail }).sort({ timestamp: -1 }).lean();
  if (!loc) return res.json({ success: false, location: null });
  return res.json({ success: true, location: loc });
});

/** Movement/anomaly analysis for the caller's current position. */
router.post('/analyze', requireAuth, async (req, res) => {
  const lat = Number(req.body.lat);
  const lng = Number(req.body.lng);
  if (!isValidCoordinate(lat, lng)) {
    return res.status(400).json({ success: false, message: 'Valid lat and lng are required' });
  }

  const since = new Date(Date.now() - HISTORY_WINDOW_MINUTES * 60 * 1000);
  const [geofences, recentLocations] = await Promise.all([
    Geofence.find({}).lean(),
    Location.find({ email: req.userEmail, timestamp: { $gte: since } }).sort({ timestamp: 1 }).lean(),
  ]);

  const analysis = riskAnalysis.evaluate({ lat, lng, geofences, recentLocations });

  await Promise.all([
    AnomalyLog.create({
      email: req.userEmail,
      lat, lng,
      risk_level: analysis.risk_level,
      anomaly_flag: analysis.anomaly_flag,
      reason: analysis.reason,
      details: analysis.details,
    }),
    User.updateOne({ email: req.userEmail }, {
      $set: {
        'lastLocation.riskLevel': analysis.risk_level,
        'lastLocation.anomalyFlag': analysis.anomaly_flag,
        'lastLocation.anomalyReason': analysis.reason,
        'lastLocation.lat': lat,
        'lastLocation.lng': lng,
        'lastLocation.timestamp': new Date(),
      },
    }),
  ]);

  return res.json({ success: true, ...analysis });
});

module.exports = router;
