'use strict';

const express = require('express');
const rateLimit = require('express-rate-limit');

const { CrimeStat, Incident } = require('../models');
const { requireAuth } = require('../middleware/auth');
const { isValidCoordinate } = require('../lib/geo');
const { exactInsensitive } = require('../lib/text');
const crimeData = require('../lib/crimeData');
const aiEngine = require('../ai_danger_engine');

const router = express.Router();

const reportLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { success: false, message: 'Too many incident reports' },
});

/**
 * Crime statistics for a named place.
 *
 * When there is no data for a place, this now says so. It used to hash the
 * search string into a pseudo-score and split it into theft/assault/fraud
 * counts, which presented invented numbers to users as recorded crime.
 */
router.get('/crime-stats', requireAuth, async (req, res) => {
  const area = String(req.query.area || '').trim();
  if (!area) return res.status(400).json({ success: false, message: 'area is required' });

  const cityEntry = crimeData.lookup(area);
  if (cityEntry) {
    return res.json({
      success: true,
      found: true,
      source: 'dataset',
      city: cityEntry.city,
      state: cityEntry.state,
      risk: cityEntry.risk,
      score: cityEntry.score,
      areas: cityEntry.areas,
    });
  }

  const areaEntry = crimeData.lookupArea(area);
  if (areaEntry) {
    return res.json({
      success: true,
      found: true,
      source: 'area',
      city: areaEntry.city,
      state: areaEntry.state,
      area: areaEntry.area,
      score: areaEntry.score,
    });
  }

  // Anything seeded into MongoDB but not present in the bundled dataset.
  const dbEntry = await CrimeStat.findOne({ city: exactInsensitive(area.split(',')[0].trim()) }).lean();
  if (dbEntry) {
    return res.json({
      success: true,
      found: true,
      source: 'database',
      city: dbEntry.city,
      state: dbEntry.state,
      risk: dbEntry.risk,
      score: dbEntry.score,
      areas: dbEntry.areas,
    });
  }

  return res.json({ success: true, found: false, score: 0, message: 'No crime data available for this area' });
});

router.get('/crime-stats/proximity', requireAuth, async (req, res) => {
  const lat = Number(req.query.lat);
  const lng = Number(req.query.lng);
  const distance = Math.min(Number(req.query.distance) || 5000, 100000);

  if (!isValidCoordinate(lat, lng)) {
    return res.status(400).json({ success: false, message: 'Valid lat and lng are required' });
  }

  const stats = await CrimeStat.find({
    location: {
      $near: {
        $geometry: { type: 'Point', coordinates: [lng, lat] },
        $maxDistance: distance,
      },
    },
  }).limit(10).lean();

  return res.json({ success: true, found: stats.length > 0, count: stats.length, data: stats });
});

router.post('/incident-report', requireAuth, reportLimiter, async (req, res) => {
  const { location, latitude, longitude, type, severity, description } = req.body;
  if (!location) return res.status(400).json({ success: false, message: 'location is required' });

  await Incident.create({
    location: String(location).toLowerCase(),
    latitude,
    longitude,
    type: type || 'other',
    severity: severity || 'medium',
    reportedBy: req.userEmail,
    description,
  });

  return res.json({ success: true, message: 'Incident reported. Thank you for keeping others safe.' });
});

router.get('/ai-danger-score', requireAuth, async (req, res) => {
  const {
    location, destination, lat, lng, mode,
    prolongedInactivity, geofenceBreach, geofenceZoneType, geofenceZoneName,
    localHour, tzOffsetMinutes,
  } = req.query;

  if (!location) return res.status(400).json({ success: false, message: 'location is required' });

  const now = new Date();
  const sixHoursAgo = new Date(now.getTime() - 6 * 60 * 60 * 1000);

  let geofenceBoost = 0;
  if (geofenceZoneType === 'high-risk') geofenceBoost = 80;
  else if (geofenceZoneType === 'restricted') geofenceBoost = 55;
  else if (geofenceZoneType === 'safe') geofenceBoost = -20;

  const flags = {
    prolongedInactivity: prolongedInactivity === 'true',
    geofenceBreach: geofenceBreach === 'true',
    geofenceBoost,
  };

  const timing = {
    localHour: localHour != null ? Number.parseInt(localHour, 10) : undefined,
    tzOffsetMinutes: tzOffsetMinutes != null ? Number(tzOffsetMinutes) : undefined,
  };

  async function scoreLocation(locName, locLat, locLng) {
    const cityKey = crimeData.extractCity(locName);
    const cityForQuery = cityKey || locName;

    const nearbyBounds = Number.isFinite(Number(locLat)) && Number.isFinite(Number(locLng))
      ? [{
          latitude: { $gte: Number(locLat) - 0.05, $lte: Number(locLat) + 0.05 },
          longitude: { $gte: Number(locLng) - 0.05, $lte: Number(locLng) + 0.05 },
        }]
      : [];

    const reportCount = await Incident.countDocuments({
      $or: [
        { location: { $regex: exactInsensitive(cityForQuery) } },
        ...nearbyBounds,
      ],
      createdAt: { $gte: sixHoursAgo },
    });

    return aiEngine.assess({
      crimeRawScore: crimeData.rawScoreFor(locName),
      locationName: locName,
      reportCount,
      transportMode: mode,
      flags,
      now,
      ...timing,
    });
  }

  const startResult = await scoreLocation(location, lat, lng);
  let finalResult = startResult;

  if (destination && destination.trim()) {
    const destResult = await scoreLocation(destination.trim(), null, null);
    const worse = destResult.score > startResult.score ? destResult : startResult;
    finalResult = {
      ...worse,
      reasoning: destResult.score > startResult.score
        ? `Destination (${destination}): ${destResult.reasoning}`
        : `Origin (${location}): ${startResult.reasoning}`,
      riskFactors: [
        ...startResult.riskFactors.map(f => `Start: ${f}`),
        ...destResult.riskFactors.map(f => `Dest: ${f}`),
      ],
    };
  }

  return res.json({
    success: true,
    aiSource: 'rule_engine',
    geofenceZoneName: geofenceZoneName || null,
    geofenceZoneType: geofenceZoneType || null,
    ...finalResult,
  });
});

router.get('/ai-config', requireAuth, (req, res) => {
  res.json({ success: true, mode: 'rule_engine', provider: 'built-in rule engine' });
});

module.exports = router;
