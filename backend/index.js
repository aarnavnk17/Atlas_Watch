'use strict';

const config = require('./config');
const { connect } = require('./lib/mongo');
const { createApp } = require('./app');

async function start() {
  // Connect first. A listening server with no database answers every safety
  // request with a 500, which is worse than failing to start.
  await connect();

  const app = createApp();
  app.listen(config.port, '0.0.0.0', () => {
    console.log(`🚀 Backend running on http://0.0.0.0:${config.port}`);
    if (!config.twilio.enabled) {
      console.warn('⚠️  TWILIO_* not configured — SOS alerts are recorded but no SMS is sent.');
    }
  });
}

start().catch(err => {
  console.error('Failed to start AtlasWatch backend:', err.message);
  process.exit(1);
});
