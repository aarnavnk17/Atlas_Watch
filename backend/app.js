'use strict';

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const config = require('./config');
const { notFound, errorHandler } = require('./middleware/error');

function createApp() {
  const app = express();

  app.set('trust proxy', 1); // rate limiting behind a proxy needs the real client IP
  app.use(helmet());
  app.use(express.json({ limit: '256kb' }));

  // Only known origins may call the API from a browser; the previous `cors()`
  // allowed every site on the internet to make credentialed requests.
  app.use(cors({
    origin(origin, callback) {
      // Non-browser clients (the mobile app, curl) send no Origin header.
      if (!origin || config.corsOrigins.includes(origin)) return callback(null, true);
      return callback(new Error(`Origin not allowed: ${origin}`));
    },
    allowedHeaders: ['Content-Type', 'Authorization', 'x-admin-key'],
  }));

  app.use(rateLimit({
    windowMs: 60 * 1000,
    limit: 300,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { success: false, message: 'Rate limit exceeded' },
  }));

  app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
    next();
  });

  app.get('/', (req, res) => res.send('AtlasWatch Backend Active'));
  app.get('/health', (req, res) => res.json({ success: true, status: 'ok' }));

  app.use(require('./routes/auth'));
  app.use(require('./routes/profile'));
  app.use(require('./routes/contacts'));
  app.use(require('./routes/documents'));
  app.use(require('./routes/location'));
  app.use(require('./routes/journey'));
  app.use(require('./routes/sos'));
  app.use(require('./routes/geofences'));
  app.use(require('./routes/crime'));
  app.use(require('./routes/geocode'));
  app.use(require('./routes/admin'));

  app.use(notFound);
  app.use(errorHandler);

  return app;
}

module.exports = { createApp };
