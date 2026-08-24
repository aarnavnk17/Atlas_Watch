'use strict';

/**
 * Seeds the CrimeStat collection from the canonical dataset
 * (`backend/data/crime_data.json`) and ensures the 2dsphere index exists.
 *
 * The previous version wrote `[stats.lng || 0, stats.lat || 0]` for every city
 * — the dataset carried no coordinates, so every row landed at [0, 0] and the
 * "nearest city" proximity search ranked everything by distance from the Gulf
 * of Guinea. The dataset now carries real coordinates.
 */
const { connect, disconnect, mongoose } = require('../lib/mongo');
const { CrimeStat } = require('../models');
const crimeData = require('../lib/crimeData');

async function run() {
  await connect();

  const cities = crimeData.allCities();
  const missingCoords = cities.filter(c => c.lat == null || c.lng == null);
  if (missingCoords.length) {
    console.warn(`⚠️  ${missingCoords.length} cities have no coordinates: ${missingCoords.map(c => c.city).join(', ')}`);
  }

  await CrimeStat.deleteMany({});
  console.log('Cleared existing CrimeStat documents.');

  await CrimeStat.insertMany(cities.map(city => ({
    state: city.state,
    city: city.city,
    risk: city.risk,
    score: city.score,
    areas: city.areas,
    location: city.lat != null && city.lng != null
      ? { type: 'Point', coordinates: [city.lng, city.lat] }
      : undefined,
    radius: 1000,
    lastUpdated: new Date(),
  })));

  await mongoose.connection.collection('crimestats').createIndex({ location: '2dsphere' });

  console.log(`✅ Seeded ${cities.length} cities and ensured the 2dsphere index.`);
  await disconnect();
}

run().catch(err => {
  console.error('Seeding failed:', err);
  process.exit(1);
});
