'use strict';

const config = require('../config');

function notFound(req, res) {
  res.status(404).json({ success: false, message: 'Not found' });
}

/**
 * Central error handler. Driver and validation messages can name collections,
 * fields, and hostnames, so the text is logged server-side and only echoed to
 * the client outside production.
 */
function errorHandler(err, req, res, _next) {
  const status = err.status || (err.name === 'ValidationError' ? 400 : 500);

  if (status >= 500) {
    console.error(`💥 ${req.method} ${req.originalUrl} —`, err);
  } else {
    console.warn(`⚠️  ${req.method} ${req.originalUrl} — ${err.message}`);
  }

  res.status(status).json({
    success: false,
    message: status >= 500 ? 'Internal server error' : err.message,
    ...(config.isProd ? {} : { detail: err.message }),
  });
}

/** Throwable HTTP error for route handlers. */
class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

module.exports = { notFound, errorHandler, HttpError };
