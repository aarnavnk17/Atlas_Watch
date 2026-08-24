'use strict';

// The credential limiter would otherwise cut the suite off after ten sign-ups.
process.env.AUTH_RATE_LIMIT = '1000';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const fs = require('fs');

const { MongoMemoryServer } = require('mongodb-memory-server');

const { createApp } = require('../app');
const { connect, disconnect } = require('../lib/mongo');
const { SosAlert, Location } = require('../models');

let mongo;
let server;
let base;

test.before(async () => {
  mongo = await MongoMemoryServer.create();
  await connect(mongo.getUri('atlaswatch-test'));
  server = createApp().listen(0);
  await new Promise(resolve => server.once('listening', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});

test.after(async () => {
  await new Promise(resolve => server.close(resolve));
  await disconnect();
  await mongo.stop();
});

const api = (path, { method = 'GET', token, adminKey, body } = {}) =>
  fetch(base + path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(adminKey ? { 'x-admin-key': adminKey } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

async function signUp(email) {
  const res = await api('/register', { method: 'POST', body: { email, password: 'Str0ng!Pass' } });
  const data = await res.json();
  assert.equal(res.status, 200, `register ${email}: ${JSON.stringify(data)}`);
  return data.token;
}

test('registration issues a token and login returns the same identity', async () => {
  const token = await signUp('alice@example.com');
  assert.ok(token);

  const login = await api('/login', { method: 'POST', body: { email: 'ALICE@example.com', password: 'Str0ng!Pass' } });
  const data = await login.json();
  assert.equal(login.status, 200);
  assert.equal(data.email, 'alice@example.com', 'email lookup is case-insensitive via normalisation');

  const wrong = await api('/login', { method: 'POST', body: { email: 'alice@example.com', password: 'wrong' } });
  assert.equal(wrong.status, 401);
});

test('one user cannot read or delete another user data', async () => {
  const bob = await signUp('bob@example.com');
  const mallory = await signUp('mallory@example.com');

  await api('/profile', { method: 'POST', token: bob, body: { fullName: 'Bob Secret', bloodGroup: 'O-', passport: 'X1234567' } });
  const added = await api('/contacts', { method: 'POST', token: bob, body: { name: 'Bob Mum', phone: '+15550001' } });
  const contactId = (await added.json()).id;

  // Mallory sees only her own (empty) data, even naming Bob explicitly.
  const profile = await (await api('/profile?email=bob@example.com', { token: mallory })).json();
  assert.equal(profile.profile, null);

  const contacts = await (await api('/contacts?email=bob@example.com', { token: mallory })).json();
  assert.deepEqual(contacts.contacts, []);

  // And cannot touch Bob's records by id.
  const del = await api(`/contacts/${contactId}`, { method: 'DELETE', token: mallory });
  assert.equal(del.status, 404);

  const stillThere = await (await api('/contacts', { token: bob })).json();
  assert.equal(stillThere.contacts.length, 1);
});

test('location fixes accumulate so the movement rules have history', async () => {
  const token = await signUp('carol@example.com');

  for (let i = 3; i >= 0; i--) {
    const res = await api('/location', {
      method: 'POST',
      token,
      body: {
        lat: 12.9716 + i * 0.00002, // ~2 m apart: stationary, inside the 30 m radius
        lng: 77.5946,
        timestamp: new Date(Date.now() - i * 3 * 60 * 1000).toISOString(),
      },
    });
    assert.equal(res.status, 200);
  }

  const stored = await Location.countDocuments({ email: 'carol@example.com' });
  assert.equal(stored, 4, 'each fix is its own document, not an upsert over one row');

  const analysis = await (await api('/analyze', { method: 'POST', token, body: { lat: 12.9716, lng: 77.5946 } })).json();
  assert.equal(analysis.success, true);
  assert.equal(analysis.details.movement.samples, 4);
  assert.match(analysis.reason, /inactivity/i, 'stationary user over 9 minutes is flagged');
});

test('an AI-triggered SOS is recorded and notifications are tracked', async () => {
  const token = await signUp('dave@example.com');
  await api('/contacts', { method: 'POST', token, body: { name: 'Dave Sister', phone: '+15550002' } });

  const res = await api('/sos', { method: 'POST', token, body: { lat: 12.9, lng: 77.6, trigger: 'ai_auto', aiScore: 88 } });
  const data = await res.json();

  assert.equal(res.status, 200, JSON.stringify(data));
  assert.ok(data.alert_id, 'the ai_auto trigger no longer fails schema validation');
  assert.equal(data.contactsTotal, 1);

  const alert = await SosAlert.findById(data.alert_id).lean();
  assert.equal(alert.trigger, 'ai_auto');
  assert.equal(alert.aiScore, 88);
  assert.equal(alert.notifications[0].status, 'skipped', 'no SMS provider configured in tests');

  // An unrecognised trigger is stored as manual instead of 500-ing.
  const odd = await api('/sos', { method: 'POST', token, body: { trigger: 'something-new' } });
  assert.equal(odd.status, 200);
});

test('resolving an SOS only affects the caller own alerts', async () => {
  const erin = await signUp('erin@example.com');
  const frank = await signUp('frank@example.com');

  await api('/sos', { method: 'POST', token: erin, body: { lat: 1, lng: 1 } });
  await api('/sos', { method: 'POST', token: frank, body: { lat: 2, lng: 2 } });

  // The old endpoint took an email and built a regex from it: {"email": ".*"}
  // resolved every active alert in the system.
  const res = await api('/sos/resolve', { method: 'POST', token: frank, body: { email: '.*' } });
  assert.equal(res.status, 200);

  assert.equal(await SosAlert.countDocuments({ email: 'erin@example.com', status: 'active' }), 1);
  assert.equal(await SosAlert.countDocuments({ email: 'frank@example.com', status: 'active' }), 0);
});

test('documents are private to their owner', async () => {
  const gina = await signUp('gina@example.com');
  const intruder = await signUp('intruder@example.com');

  const form = new FormData();
  form.append('file', new Blob([Buffer.from('%PDF-1.4 test')], { type: 'application/pdf' }), 'passport.pdf');
  form.append('category', 'Passport');

  const upload = await fetch(`${base}/documents/upload`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${gina}` },
    body: form,
  });
  const uploaded = await upload.json();
  assert.equal(upload.status, 200, JSON.stringify(uploaded));

  const docId = uploaded.document._id;
  assert.match(uploaded.document.filePath, /^\/documents\/.+\/file$/);

  const owner = await fetch(`${base}/documents/${docId}/file`, { headers: { Authorization: `Bearer ${gina}` } });
  assert.equal(owner.status, 200);

  const anonymous = await fetch(`${base}/documents/${docId}/file`);
  assert.equal(anonymous.status, 401, 'documents are no longer statically served');

  const otherUser = await fetch(`${base}/documents/${docId}/file`, { headers: { Authorization: `Bearer ${intruder}` } });
  assert.equal(otherUser.status, 404);

  // Clean up the file this test wrote.
  const stored = path.join(__dirname, '..', 'uploads');
  for (const name of fs.readdirSync(stored)) {
    if (name.endsWith('.pdf')) fs.unlinkSync(path.join(stored, name));
  }
});

test('rejects uploads of unsupported types', async () => {
  const token = await signUp('heidi@example.com');
  const form = new FormData();
  form.append('file', new Blob([Buffer.from('#!/bin/sh\necho hi')], { type: 'application/x-sh' }), 'run.sh');

  const res = await fetch(`${base}/documents/upload`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  assert.equal(res.status, 400);
});

test('crime stats report unknown places instead of inventing a score', async () => {
  const token = await signUp('ivan@example.com');

  const known = await (await api('/crime-stats?area=Pune', { token })).json();
  assert.equal(known.found, true);
  assert.equal(known.city, 'Pune');
  assert.ok(known.score > 0);

  const unknown = await (await api('/crime-stats?area=Zzyzx%20Springs', { token })).json();
  assert.equal(unknown.found, false);
  assert.equal(unknown.score, 0);

  // The same input twice used to produce a stable but fabricated hash score.
  const repeat = await (await api('/crime-stats?area=Zzyzx%20Springs', { token })).json();
  assert.deepEqual(repeat, unknown);
});

test('admin endpoints work with the key and expose no data without it', async () => {
  const { adminApiKey } = require('../config');

  const denied = await api('/admin/profiles');
  assert.equal(denied.status, 401);

  const allowed = await api('/admin/profiles', { adminKey: adminApiKey });
  const data = await allowed.json();
  assert.equal(allowed.status, 200);
  assert.ok(data.profiles.length > 0);
});
