'use strict';

const { haversineDistance } = require('../lib/geo');

// A segment shorter than this is treated as GPS jitter rather than movement.
const MIN_SEGMENT_METRES = 50;
// Walking pace ceiling and the vehicle-speed floor used by the acceleration rule.
const PEDESTRIAN_KPH = 8;
const VEHICLE_KPH = 25;
// Inactivity: less than this much movement over at least this long.
const INACTIVITY_RADIUS_METRES = 30;
const INACTIVITY_MINUTES = 8;

const RANK = { low: 0, medium: 1, high: 2 };
const raise = (current, next) => (RANK[next] > RANK[current] ? next : current);

/**
 * Rule-based movement analysis. Pure — it takes the geofences and the recent
 * location history and returns a verdict, so it can be tested without a
 * database and reasoned about without a running server.
 *
 * @param {object}   input
 * @param {number}   input.lat
 * @param {number}   input.lng
 * @param {Array}    input.geofences        Zones with { name, type, center:{lat,lng}, radius }
 * @param {Array}    input.recentLocations  Fixes ascending by timestamp: { lat, lng, timestamp }
 */
function evaluate({ lat, lng, geofences = [], recentLocations = [] }) {
  const result = {
    risk_level: 'low',
    anomaly_flag: false,
    reason: 'Normal movement detected',
    details: {},
  };

  // ── Rule 1: geofence containment ─────────────────────────────────────────
  for (const fence of geofences) {
    if (!fence || !fence.center) continue;
    const dist = haversineDistance(lat, lng, fence.center.lat, fence.center.lng);
    if (dist > fence.radius) continue;

    result.details.geofence = { name: fence.name, type: fence.type, distanceMeters: Math.round(dist) };
    if (fence.type === 'high-risk') {
      result.risk_level = 'high';
      result.anomaly_flag = true;
      result.reason = `Entered high-risk zone: ${fence.name}`;
      return result;
    }
    if (fence.type === 'restricted') {
      result.risk_level = raise(result.risk_level, 'medium');
      result.anomaly_flag = true;
      result.reason = `Entered restricted zone: ${fence.name}`;
    }
  }

  if (recentLocations.length < 2) {
    result.details.movement = { samples: recentLocations.length, note: 'Not enough history yet' };
    return result;
  }

  const oldest = recentLocations[0];
  const newest = recentLocations[recentLocations.length - 1];
  const totalMovement = haversineDistance(oldest.lat, oldest.lng, newest.lat, newest.lng);
  const elapsedMinutes = (new Date(newest.timestamp) - new Date(oldest.timestamp)) / 60000;

  result.details.movement = {
    totalDistanceMeters: Math.round(totalMovement),
    elapsedMinutes: Math.round(elapsedMinutes),
    samples: recentLocations.length,
  };

  // ── Rule 2: prolonged inactivity ─────────────────────────────────────────
  if (totalMovement < INACTIVITY_RADIUS_METRES && elapsedMinutes >= INACTIVITY_MINUTES) {
    result.anomaly_flag = true;
    result.reason = `Prolonged inactivity detected (no significant movement in ${Math.round(elapsedMinutes)} minutes)`;
    result.risk_level = raise(result.risk_level, 'medium');
  }

  // ── Rule 3: sudden acceleration to vehicle speed ─────────────────────────
  // The signal of interest is the *transition* — someone on foot who is
  // abruptly moving at vehicle speed. A steady 60 kph is just a commute, and
  // the old 10–80 kph window flagged every bus ride while ignoring anything
  // faster than a motorway.
  const speeds = [];
  for (let i = 1; i < recentLocations.length; i++) {
    const prev = recentLocations[i - 1];
    const curr = recentLocations[i];
    const metres = haversineDistance(prev.lat, prev.lng, curr.lat, curr.lng);
    const seconds = (new Date(curr.timestamp) - new Date(prev.timestamp)) / 1000;
    if (seconds <= 0 || metres < MIN_SEGMENT_METRES) continue;
    speeds.push({ kph: (metres / seconds) * 3.6, index: i });
  }

  if (speeds.length) {
    const maxSpeed = speeds.reduce((a, b) => (b.kph > a.kph ? b : a));
    result.details.maxSpeedKph = Math.round(maxSpeed.kph);

    const priorSpeeds = speeds.filter(s => s.index < maxSpeed.index);
    const priorAvgKph = priorSpeeds.length
      ? priorSpeeds.reduce((sum, s) => sum + s.kph, 0) / priorSpeeds.length
      : null;
    if (priorAvgKph !== null) result.details.precedingAvgKph = Math.round(priorAvgKph);

    if (maxSpeed.kph >= VEHICLE_KPH && priorAvgKph !== null && priorAvgKph <= PEDESTRIAN_KPH) {
      result.anomaly_flag = true;
      result.reason =
        `Sudden acceleration detected: walking pace (${Math.round(priorAvgKph)} kph) ` +
        `to vehicle speed (${Math.round(maxSpeed.kph)} kph)`;
      result.risk_level = raise(result.risk_level, 'medium');
    }
  }

  return result;
}

module.exports = {
  evaluate,
  MIN_SEGMENT_METRES,
  PEDESTRIAN_KPH,
  VEHICLE_KPH,
  INACTIVITY_RADIUS_METRES,
  INACTIVITY_MINUTES,
};
