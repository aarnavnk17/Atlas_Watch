'use strict';

const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const config = require('../config');
const { normalizeEmail } = require('../lib/text');

const ISSUER = 'atlaswatch';

function signToken(email) {
  return jwt.sign({ sub: normalizeEmail(email) }, config.jwtSecret, {
    expiresIn: config.jwtTtl,
    issuer: ISSUER,
  });
}

/**
 * Establishes who the caller is from a signed token. Every user-scoped route
 * reads `req.userEmail` from here — an email supplied in a query string or body
 * identifies nobody and must never be used to select records.
 */
function requireAuth(req, res, next) {
  const header = req.get('authorization') || '';
  const [scheme, token] = header.split(' ');

  if (!token || scheme.toLowerCase() !== 'bearer') {
    return res.status(401).json({ success: false, code: 'no_token', message: 'Authentication required' });
  }

  try {
    const payload = jwt.verify(token, config.jwtSecret, { issuer: ISSUER });
    req.userEmail = normalizeEmail(payload.sub);
    if (!req.userEmail) throw new Error('Token carries no subject');
    return next();
  } catch (err) {
    const expired = err.name === 'TokenExpiredError';
    return res.status(401).json({
      success: false,
      code: expired ? 'token_expired' : 'invalid_token',
      message: expired ? 'Session expired, please sign in again' : 'Invalid session',
    });
  }
}

function timingSafeEqual(a, b) {
  const bufA = Buffer.from(String(a));
  const bufB = Buffer.from(String(b));
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

/** Guards operator-facing endpoints that read across all users. */
function requireAdmin(req, res, next) {
  const key = req.get('x-admin-key') || '';
  if (!key || !timingSafeEqual(key, config.adminApiKey)) {
    return res.status(401).json({ success: false, code: 'invalid_admin_key', message: 'Valid admin key required' });
  }
  return next();
}

module.exports = { signToken, requireAuth, requireAdmin, ISSUER };
