'use strict';

require('dotenv').config();
const crypto = require('crypto');

const isProd = process.env.NODE_ENV === 'production';

/**
 * Secrets must be supplied via the environment in production. In development we
 * generate an ephemeral value so the server still boots, but tokens/keys then
 * become invalid on every restart — which is the intended nudge to set them.
 */
function secret(name, { minLength = 32, announce = false } = {}) {
  const value = process.env[name];
  if (value && value.length >= minLength) return value;

  if (isProd) {
    throw new Error(
      `${name} is required in production and must be at least ${minLength} characters. ` +
      `Generate one with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
    );
  }

  const generated = crypto.randomBytes(32).toString('hex');
  if (value) {
    console.warn(`⚠️  ${name} is shorter than ${minLength} chars — using an ephemeral dev value instead.`);
  } else {
    console.warn(`⚠️  ${name} is not set — generated an ephemeral dev value (resets on restart).`);
  }
  if (announce) console.warn(`   ${name}=${generated}`);
  return generated;
}

const config = {
  isProd,
  port: Number(process.env.PORT) || 3000,
  mongoUri: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/atlaswatch',

  jwtSecret: secret('JWT_SECRET'),
  jwtTtl: process.env.JWT_TTL || '30d',

  // Guards the /admin/* endpoints the operations dashboard reads.
  adminApiKey: secret('ADMIN_API_KEY', { announce: true }),

  // Comma-separated allowlist. Defaults to local dev origins only.
  corsOrigins: (process.env.CORS_ORIGINS || 'http://localhost:5173,http://localhost:4173,http://localhost:3000')
    .split(',')
    .map(o => o.trim())
    .filter(Boolean),

  // Requests per 15 minutes per IP against /register and /login.
  authRateLimit: Number(process.env.AUTH_RATE_LIMIT) || 10,

  uploads: {
    maxBytes: Number(process.env.UPLOAD_MAX_BYTES) || 10 * 1024 * 1024, // 10 MB
    allowedMimeTypes: [
      'image/jpeg', 'image/png', 'image/heic', 'image/webp',
      'application/pdf',
    ],
  },

  // How long raw GPS breadcrumbs are retained. They exist to power anomaly
  // detection, not to build a permanent movement history.
  locationRetentionDays: Number(process.env.LOCATION_RETENTION_DAYS) || 7,

  // Optional outbound SMS for SOS alerts. Without these the backend records the
  // alert and logs the intended recipients instead of silently doing nothing.
  twilio: {
    accountSid: process.env.TWILIO_ACCOUNT_SID || null,
    authToken: process.env.TWILIO_AUTH_TOKEN || null,
    fromNumber: process.env.TWILIO_FROM_NUMBER || null,
    get enabled() {
      return Boolean(this.accountSid && this.authToken && this.fromNumber);
    },
  },
};

module.exports = config;
