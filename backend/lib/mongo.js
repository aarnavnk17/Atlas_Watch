'use strict';

const mongoose = require('mongoose');
const config = require('../config');

/**
 * Connects to MongoDB. The promise rejects on failure so the caller can refuse
 * to start: a server that is listening but has no database only serves 500s,
 * which for a safety app looks identical to "everything is fine" from the app.
 */
async function connect(uri = config.mongoUri) {
  try {
    await mongoose.connect(uri, { family: 4, serverSelectionTimeoutMS: 10000 });
    console.log('✅ Connected to MongoDB');
    return mongoose.connection;
  } catch (err) {
    console.error('❌ MongoDB connection error:', err.message);
    if (err.name === 'MongooseServerSelectionError') {
      console.error('\n🛠️  Troubleshooting:');
      console.error('  1. Is mongod running, or is the Atlas cluster reachable?');
      console.error('  2. Is this host allowed in the Atlas IP access list?');
      console.error('  3. Are the credentials in MONGODB_URI current?');
    }
    throw err;
  }
}

async function disconnect() {
  await mongoose.disconnect();
}

module.exports = { connect, disconnect, mongoose };
