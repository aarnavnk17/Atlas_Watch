'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { evaluate } = require('../services/riskAnalysis');

const BASE = { lat: 12.9716, lng: 77.5946 };
const minutesAgo = m => new Date(Date.now() - m * 60 * 1000);

/** Builds a fix `minutes` in the past, offset `metres` north of BASE. */
function fix(minutes, metresNorth) {
  return {
    lat: BASE.lat + metresNorth / 111320,
    lng: BASE.lng,
    timestamp: minutesAgo(minutes),
  };
}

test('flags prolonged inactivity when the user barely moves', () => {
  const result = evaluate({
    ...BASE,
    recentLocations: [fix(10, 0), fix(5, 5), fix(0, 8)],
  });

  assert.equal(result.anomaly_flag, true);
  assert.equal(result.risk_level, 'medium');
  assert.match(result.reason, /inactivity/i);
});

test('does not flag inactivity when the user is moving', () => {
  const result = evaluate({
    ...BASE,
    recentLocations: [fix(10, 0), fix(5, 400), fix(0, 800)],
  });

  assert.match(result.reason, /Normal movement/);
});

test('flags a walking-to-vehicle acceleration', () => {
  // ~60 m/min (3.6 kph) for two segments, then ~1.5 km in a minute (90 kph).
  const result = evaluate({
    ...BASE,
    recentLocations: [fix(4, 0), fix(3, 60), fix(2, 120), fix(1, 1620)],
  });

  assert.equal(result.anomaly_flag, true);
  assert.match(result.reason, /Sudden acceleration/);
});

test('does not flag a steady drive as an anomaly', () => {
  // A constant ~60 kph the whole way — a commute, not an abduction.
  const result = evaluate({
    ...BASE,
    recentLocations: [fix(3, 0), fix(2, 1000), fix(1, 2000), fix(0, 3000)],
  });

  assert.equal(result.anomaly_flag, false);
  assert.equal(result.risk_level, 'low');
});

test('ignores sub-50 m jitter when computing speed', () => {
  const result = evaluate({
    ...BASE,
    recentLocations: [
      { ...BASE, timestamp: minutesAgo(2) },
      { lat: BASE.lat + 0.0002, lng: BASE.lng, timestamp: new Date(Date.now() - 119000) },
    ],
  });

  assert.equal(result.details.maxSpeedKph, undefined);
});

test('a single fix cannot trigger movement rules', () => {
  const result = evaluate({ ...BASE, recentLocations: [fix(0, 0)] });

  assert.equal(result.anomaly_flag, false);
  assert.equal(result.details.movement.note, 'Not enough history yet');
});

test('high-risk geofence containment returns high risk immediately', () => {
  const result = evaluate({
    ...BASE,
    geofences: [{ name: 'Test Zone', type: 'high-risk', center: BASE, radius: 500 }],
    recentLocations: [],
  });

  assert.equal(result.risk_level, 'high');
  assert.equal(result.anomaly_flag, true);
  assert.equal(result.details.geofence.name, 'Test Zone');
});

test('a restricted zone does not mask a later inactivity finding', () => {
  const result = evaluate({
    ...BASE,
    geofences: [{ name: 'Restricted', type: 'restricted', center: BASE, radius: 500 }],
    recentLocations: [fix(10, 0), fix(0, 5)],
  });

  assert.equal(result.risk_level, 'medium');
  assert.match(result.reason, /inactivity/i);
});

test('zones the user is outside of are ignored', () => {
  const result = evaluate({
    ...BASE,
    geofences: [{ name: 'Far Zone', type: 'high-risk', center: { lat: 0, lng: 0 }, radius: 1000 }],
    recentLocations: [],
  });

  assert.equal(result.risk_level, 'low');
  assert.equal(result.details.geofence, undefined);
});
