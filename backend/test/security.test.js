'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');

const config = require('../config');
const { createApp } = require('../app');
const { escapeRegex, exactInsensitive, normalizeEmail, isValidEmail } = require('../lib/text');

/** Boots the app on an ephemeral port for the duration of the test file. */
async function withServer(fn) {
  const server = createApp().listen(0);
  await new Promise(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    return await fn(base);
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
}

// Every one of these used to identify the user from a caller-supplied `email`,
// so any of them would serve another person's data to an anonymous request.
const USER_SCOPED = [
  ['GET', '/profile?email=victim@example.com'],
  ['POST', '/profile'],
  ['GET', '/contacts?email=victim@example.com'],
  ['POST', '/contacts'],
  ['GET', '/documents?email=victim@example.com'],
  ['GET', '/location/latest?email=victim@example.com'],
  ['POST', '/location'],
  ['POST', '/analyze'],
  ['POST', '/journey'],
  ['DELETE', '/journey'],
  ['POST', '/sos'],
  ['POST', '/sos/resolve'],
  ['GET', '/geofences'],
  ['GET', '/crime-stats?area=pune'],
  ['GET', '/ai-danger-score?location=pune'],
  ['GET', '/geocode?q=pune'],
];

const ADMIN_SCOPED = [
  ['GET', '/admin/profiles'],
  ['GET', '/admin/anomaly-summary'],
  ['GET', '/anomaly-log'],
  ['GET', '/sos/alerts'],
  ['POST', '/geofences'],
];

test('user endpoints reject unauthenticated callers', async () => {
  await withServer(async base => {
    for (const [method, path] of USER_SCOPED) {
      const res = await fetch(base + path, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: method === 'GET' ? undefined : '{}',
      });
      assert.equal(res.status, 401, `${method} ${path} should require a token`);
    }
  });
});

test('admin endpoints reject callers without the admin key', async () => {
  await withServer(async base => {
    for (const [method, path] of ADMIN_SCOPED) {
      const res = await fetch(base + path, {
        method,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${jwt.sign({ sub: 'user@example.com' }, config.jwtSecret, { issuer: 'atlaswatch' })}` },
        body: method === 'GET' ? undefined : '{}',
      });
      assert.equal(res.status, 401, `${method} ${path} should require the admin key`);
    }

    const wrongKey = await fetch(`${base}/admin/profiles`, { headers: { 'x-admin-key': 'nope' } });
    assert.equal(wrongKey.status, 401);
  });
});

test('tokens signed with the wrong secret or issuer are rejected', async () => {
  await withServer(async base => {
    const forged = jwt.sign({ sub: 'victim@example.com' }, 'not-the-secret', { issuer: 'atlaswatch' });
    const wrongIssuer = jwt.sign({ sub: 'victim@example.com' }, config.jwtSecret, { issuer: 'somewhere-else' });
    const expired = jwt.sign({ sub: 'victim@example.com' }, config.jwtSecret, { issuer: 'atlaswatch', expiresIn: -10 });

    for (const token of [forged, wrongIssuer, expired]) {
      const res = await fetch(`${base}/profile`, { headers: { Authorization: `Bearer ${token}` } });
      assert.equal(res.status, 401);
    }
  });
});

test('regex metacharacters in user input cannot widen a query', () => {
  // `POST /sos/resolve {"email": ".*"}` used to resolve every active alert.
  assert.equal(exactInsensitive('.*').test('anyone@example.com'), false);
  assert.equal(exactInsensitive('a@b.com').test('A@B.COM'), true);
  assert.equal(escapeRegex('.*+?^${}()|[]\\'), '\\.\\*\\+\\?\\^\\$\\{\\}\\(\\)\\|\\[\\]\\\\');
});

test('emails are normalised and validated', () => {
  assert.equal(normalizeEmail('  User@Example.COM '), 'user@example.com');
  assert.equal(isValidEmail('user@example.com'), true);
  assert.equal(isValidEmail('not-an-email'), false);
  assert.equal(isValidEmail(''), false);
});
