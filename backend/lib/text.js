'use strict';

/**
 * Escapes regex metacharacters so caller-supplied text can never alter the
 * shape of a query. Without this, a body of `{"email": ".*"}` matches every
 * user in the collection.
 */
function escapeRegex(input) {
  return String(input).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Canonical form for an email: trimmed and lower-cased. */
function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function isValidEmail(email) {
  const normalized = normalizeEmail(email);
  return normalized.length <= 254 && EMAIL_PATTERN.test(normalized);
}

/** Case-insensitive exact-match filter that is safe against injected patterns. */
function exactInsensitive(value) {
  return new RegExp(`^${escapeRegex(value)}$`, 'i');
}

module.exports = { escapeRegex, normalizeEmail, isValidEmail, exactInsensitive };
