'use strict';

const express = require('express');
const { Geofence } = require('../models');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { isValidCoordinate } = require('../lib/geo');

const router = express.Router();

// Any signed-in client needs the zone list to evaluate its own position.
router.get('/geofences', requireAuth, async (req, res) => {
  const geofences = await Geofence.find({}).lean();
  return res.json({ success: true, geofences });
});

// Defining zones is an operator action.
router.post('/geofences', requireAdmin, async (req, res) => {
  const { name, type, center, radius } = req.body;
  if (!name || !center || !isValidCoordinate(Number(center.lat), Number(center.lng)) || !Number(radius)) {
    return res.status(400).json({ success: false, message: 'name, valid center (lat/lng), and radius are required' });
  }
  const geofence = await Geofence.create({ name, type: type || 'restricted', center, radius });
  return res.json({ success: true, geofence });
});

router.put('/geofences/:id', requireAdmin, async (req, res) => {
  const { name, type, center, radius } = req.body;
  const update = {};
  if (name !== undefined) update.name = name;
  if (type !== undefined) update.type = type;
  if (center !== undefined) update.center = center;
  if (radius !== undefined) update.radius = radius;

  const geofence = await Geofence.findByIdAndUpdate(req.params.id, { $set: update }, { new: true });
  if (!geofence) return res.status(404).json({ success: false, message: 'Zone not found' });
  return res.json({ success: true, geofence });
});

router.delete('/geofences/:id', requireAdmin, async (req, res) => {
  const result = await Geofence.deleteOne({ _id: req.params.id });
  if (result.deletedCount === 0) return res.status(404).json({ success: false, message: 'Zone not found' });
  return res.json({ success: true });
});

module.exports = router;
