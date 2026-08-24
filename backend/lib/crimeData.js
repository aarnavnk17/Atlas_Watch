'use strict';

const fs = require('fs');
const path = require('path');

/**
 * Single source of truth for city crime statistics.
 *
 * `data/crime_data.json` is the canonical dataset: it is loaded here for the
 * rule engine, seeded into MongoDB by `scripts/seed-crime-data.js`, and bundled
 * into the Flutter client as an asset for its offline fallback. Do not
 * re-declare these numbers anywhere else — three copies is how the client and
 * server ended up disagreeing about how dangerous a city was.
 */
const DATA_PATH = path.join(__dirname, '..', 'data', 'crime_data.json');

/** Common alternate/older names mapped to the canonical dataset key. */
const ALIASES = {
  bangalore: 'bengaluru',
  bombay: 'mumbai',
  madras: 'chennai',
  calcutta: 'kolkata',
  delhi: 'new delhi',
  cochin: 'kochi',
  trivandrum: 'thiruvananthapuram',
  calicut: 'kozhikode',
  mysore: 'mysuru',
  hubli: 'hubballi',
  mangalore: 'mangaluru',
  belgaum: 'belagavi',
  gurgaon: 'gurugram',
  trichy: 'tiruchirappalli',
  kovai: 'coimbatore',
  vizag: 'visakhapatnam',
  pondicherry: 'puducherry',
};

function load() {
  const raw = JSON.parse(fs.readFileSync(DATA_PATH, 'utf8'));
  const cities = new Map();

  for (const [state, cityMap] of Object.entries(raw)) {
    for (const [city, stats] of Object.entries(cityMap)) {
      const key = city.trim().toLowerCase();
      // First definition wins so ambiguous names (two Udaipurs) stay deterministic.
      if (!cities.has(key)) {
        cities.set(key, {
          state,
          city,
          key,
          risk: stats.risk,
          score: Number(stats.score) || 0,
          areas: stats.areas || {},
          lat: typeof stats.lat === 'number' ? stats.lat : null,
          lng: typeof stats.lng === 'number' ? stats.lng : null,
        });
      }
    }
  }

  for (const [alias, canonical] of Object.entries(ALIASES)) {
    if (cities.has(canonical) && !cities.has(alias)) {
      cities.set(alias, cities.get(canonical));
    }
  }

  const maxRawScore = Math.max(...[...cities.values()].map(c => c.score), 1);
  // Longest-first so "new delhi" is preferred over "delhi".
  const sortedKeys = [...cities.keys()].sort((a, b) => b.length - a.length);

  return { raw, cities, maxRawScore, sortedKeys };
}

const { raw, cities, maxRawScore, sortedKeys } = load();

/**
 * Resolve a free-text location ("New Delhi Railway Station, Delhi, India") to a
 * dataset key. Comma-separated tokens are matched first so a long address does
 * not accidentally match on a substring of an unrelated word.
 */
function extractCity(locationName) {
  if (!locationName) return null;
  const loc = String(locationName).toLowerCase();
  const tokens = loc.split(',').map(t => t.trim()).filter(Boolean);

  for (const key of sortedKeys) {
    for (const token of tokens) {
      if (token === key) return key;
    }
  }
  for (const key of sortedKeys) {
    for (const token of tokens) {
      if (token.includes(key)) return key;
    }
  }
  for (const key of sortedKeys) {
    if (loc.includes(key)) return key;
  }
  return null;
}

/** Full dataset row for a free-text location, or null when unknown. */
function lookup(locationName) {
  const key = extractCity(locationName);
  return key ? cities.get(key) : null;
}

/** Raw recorded-incident count for a location, or 0 when unknown. */
function rawScoreFor(locationName) {
  const entry = lookup(locationName);
  return entry ? entry.score : 0;
}

/** Every city row, used for seeding and proximity lookups. */
function allCities() {
  // De-duplicate alias entries that point at the same row.
  return [...new Set(cities.values())];
}


/**
 * Sub-area lookup ("Gajuwaka" -> Visakhapatnam). The dataset carries per-area
 * incident counts inside each city entry.
 */
function lookupArea(locationName) {
  if (!locationName) return null;
  const loc = String(locationName).toLowerCase();
  const tokens = loc.split(',').map(t => t.trim()).filter(Boolean);

  for (const city of allCities()) {
    for (const [area, score] of Object.entries(city.areas || {})) {
      const areaKey = area.toLowerCase();
      if (tokens.includes(areaKey) || loc.includes(areaKey)) {
        return { city: city.city, state: city.state, area, score: Number(score) || 0, cityScore: city.score };
      }
    }
  }
  return null;
}

module.exports = { raw, extractCity, lookup, lookupArea, rawScoreFor, allCities, maxRawScore, ALIASES, DATA_PATH };
