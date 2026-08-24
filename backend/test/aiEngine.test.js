'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const engine = require('../ai_danger_engine');
const crimeData = require('../lib/crimeData');

test('resolves the hour from the client, not the server clock', () => {
  const now = new Date('2026-01-01T20:00:00Z'); // 20:00 UTC
  const ist = engine.resolveLocalTime({ now, tzOffsetMinutes: 330 }); // UTC+5:30

  assert.equal(ist.hour, 1);
  assert.equal(ist.timeSource, 'client_offset');

  const explicit = engine.resolveLocalTime({ now, localHour: 23 });
  assert.equal(explicit.hour, 23);
  assert.equal(explicit.timeSource, 'client_hour');

  const fallback = engine.resolveLocalTime({ now });
  assert.equal(fallback.timeSource, 'server_clock');
});

test('zone risk is counted once, not twice', () => {
  const both = engine.behaviouralScore({ geofenceBreach: true, geofenceBoost: 80 });
  const boostOnly = engine.behaviouralScore({ geofenceBoost: 80 });

  assert.equal(both, boostOnly);
  assert.equal(both, 80);
});

test('a safe zone lowers the behavioural score', () => {
  assert.equal(engine.behaviouralScore({ geofenceBoost: -20 }), 0);
  assert.equal(engine.behaviouralScore({ prolongedInactivity: true, geofenceBoost: -20 }), 15);
});

test('a high baseline score alone does not auto-trigger SOS', () => {
  const cityAtNight = engine.assess({
    locationName: 'New Delhi Railway Station, Delhi, India',
    localHour: 2,
    transportMode: 'Walk',
  });

  assert.equal(cityAtNight.severity, 'critical');
  assert.equal(cityAtNight.shouldTriggerSos, false, 'geography plus a late hour is not an emergency');
  assert.equal(cityAtNight.sosSuppressed, true);
});

test('a situational signal does trigger SOS at a critical score', () => {
  const inZone = engine.assess({
    locationName: 'New Delhi Railway Station, Delhi, India',
    localHour: 2,
    transportMode: 'Walk',
    flags: { geofenceBreach: true, geofenceBoost: 80 },
  });

  assert.equal(inZone.shouldTriggerSos, true);

  const stationary = engine.assess({
    locationName: 'Chennai',
    localHour: 1,
    flags: { prolongedInactivity: true },
  });

  assert.equal(stationary.shouldTriggerSos, true);
});

test('city lookup handles addresses, aliases and unknown places', () => {
  assert.equal(crimeData.lookup('New Delhi Railway Station, Delhi, India').city, 'New Delhi');
  assert.equal(crimeData.lookup('bangalore').city, 'Bengaluru');
  assert.equal(crimeData.lookup('BOMBAY').city, 'Mumbai');
  assert.equal(crimeData.lookup('Atlantis'), null);
});

test('every city in the dataset carries coordinates for proximity search', () => {
  const missing = crimeData.allCities().filter(c => c.lat == null || c.lng == null);
  assert.deepEqual(missing.map(c => c.city), []);
});

test('scores rise at night and fall for safer transport', () => {
  const base = { locationName: 'Pune', transportMode: 'Walk' };
  const night = engine.assess({ ...base, localHour: 2 }).score;
  const midday = engine.assess({ ...base, localHour: 13 }).score;
  const byCar = engine.assess({ locationName: 'Pune', transportMode: 'Car', localHour: 2 }).score;

  assert.ok(night > midday, `expected night (${night}) > midday (${midday})`);
  assert.ok(byCar < night, `expected car (${byCar}) < walking (${night})`);
});
