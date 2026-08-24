'use strict';

const express = require('express');
const axios = require('axios');
const rateLimit = require('express-rate-limit');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// Nominatim's usage policy caps request rates; this also stops the proxy from
// being used as an open relay.
const geocodeLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 30,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { success: false, message: 'Too many geocoding requests' },
});

/** Proxy for OpenStreetMap search — works around emulator DNS limitations. */
router.get('/geocode', requireAuth, geocodeLimiter, async (req, res) => {
  const q = String(req.query.q || '').trim();
  if (!q) return res.status(400).json({ error: 'Query required' });

  try {
    const response = await axios.get('https://nominatim.openstreetmap.org/search', {
      params: { q, format: 'json', limit: 1 },
      headers: { 'User-Agent': 'AtlasWatchProxy/1.0' },
      timeout: 8000,
    });
    return res.json(response.data);
  } catch (err) {
    console.error('Geocode proxy error:', err.message);
    return res.status(502).json({ error: 'Geocoding service unavailable' });
  }
});

module.exports = router;
