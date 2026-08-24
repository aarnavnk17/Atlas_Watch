'use strict';

/**
 * One-time migration: lower-cases stored emails so every lookup can use an
 * exact match. Records written before the schema normalised emails may contain
 * mixed case, which is what the old case-insensitive regex queries were working
 * around — and those queries were injectable.
 *
 * Run once after deploying: `npm run normalize-emails`
 */
const { connect, disconnect } = require('../lib/mongo');
const { User, Profile, Contact, Document, Location, SosAlert, AnomalyLog } = require('../models');

const TARGETS = [
  { model: User, field: 'email' },
  { model: Profile, field: 'email' },
  { model: Contact, field: 'user_email' },
  { model: Document, field: 'user_email' },
  { model: Location, field: 'email' },
  { model: SosAlert, field: 'email' },
  { model: AnomalyLog, field: 'email' },
];

async function run() {
  await connect();

  for (const { model, field } of TARGETS) {
    const collection = model.collection;
    const cursor = collection.find({ [field]: { $type: 'string' } });
    let changed = 0;
    let conflicts = 0;

    for await (const doc of cursor) {
      const current = doc[field];
      const normalized = String(current).trim().toLowerCase();
      if (current === normalized) continue;

      try {
        await collection.updateOne({ _id: doc._id }, { $set: { [field]: normalized } });
        changed++;
      } catch (err) {
        // A unique index (User.email, Profile.email) can already hold the
        // lower-cased value — that means a duplicate account exists and a human
        // needs to decide which one survives.
        conflicts++;
        console.warn(`  ⚠️  ${model.modelName} ${doc._id}: ${current} -> ${normalized} conflicts with an existing record`);
      }
    }
    console.log(`${model.modelName}.${field}: ${changed} normalised${conflicts ? `, ${conflicts} conflicts need manual review` : ''}`);
  }

  await disconnect();
}

run().catch(err => {
  console.error('Normalisation failed:', err);
  process.exit(1);
});
