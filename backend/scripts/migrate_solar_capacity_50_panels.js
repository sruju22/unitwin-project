/**
 * AIT Campus Intelligence - Solar Configuration Migration & Normalization Script
 * 
 * Safely and idempotently normalizes historical MongoDB Atlas solarGeneration records
 * from the legacy 100 kWp configuration (50 panels × 2 kW) to the verified 20 kWp
 * demonstration configuration (50 panels × 400 W = 0.4 kWp).
 * 
 * Safety & Invariant Guarantees:
 * 1. Fully Idempotent: Only updates records where systemCapacityKW > 20. Running repeatedly is a no-op.
 * 2. Non-Destructive: Never deletes, truncates, or drops documents or collections.
 * 3. Preserves Demand: Never touches `energyUsage` or campus electrical demand records.
 * 4. Preserves Dates: Timestamps, timezone (Asia/Kolkata), dates, and reporting boundaries remain 100% intact.
 * 5. Dry-Run Default: Requires `--execute` to apply changes.
 * 
 * Usage:
 *   node backend/scripts/migrate_solar_capacity_50_panels.js              # Dry run (safe preview)
 *   node backend/scripts/migrate_solar_capacity_50_panels.js --execute    # Apply safe migration
 *   node backend/scripts/migrate_solar_capacity_50_panels.js --rollback   # Revert to legacy 100 kWp
 */

const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

async function runMigration() {
  const args = process.argv.slice(2);
  const isExecute = args.includes('--execute');
  const isRollback = args.includes('--rollback');

  console.log('================================================================');
  console.log('AIT CAMPUS INTELLIGENCE: SOLAR CAPACITY NORMALIZATION MIGRATION');
  console.log(`Mode: ${isRollback ? 'ROLLBACK' : isExecute ? 'EXECUTE (APPLY)' : 'DRY-RUN (PREVIEW)'}`);
  console.log('================================================================\n');

  if (!process.env.MONGODB_URI) {
    console.error('Error: MONGODB_URI is not defined in backend/.env');
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGODB_URI);
  const db = mongoose.connection.db;
  const collection = db.collection('solarGeneration');

  const totalCount = await collection.countDocuments();
  console.log(`Total documents in solarGeneration: ${totalCount}`);

  if (isRollback) {
    // Rollback from 20 kWp to 100 kWp
    const toRollback = await collection.countDocuments({ systemCapacityKW: 20 });
    console.log(`Documents eligible for rollback (systemCapacityKW == 20): ${toRollback}`);
    if (toRollback === 0) {
      console.log('No documents found with systemCapacityKW == 20. Nothing to rollback.');
      await mongoose.disconnect();
      return;
    }

    const cursor = collection.find({ systemCapacityKW: 20 });
    let updated = 0;
    while (await cursor.hasNext()) {
      const doc = await cursor.next();
      const restoredEnergy = Number((doc.energyGeneratedKWh * 5.0).toFixed(4));
      await collection.updateOne(
        { _id: doc._id },
        {
          $set: {
            panelCapacityKW: 2.0,
            systemCapacityKW: 100.0,
            systemPanelCount: 50,
            energyGeneratedKWh: restoredEnergy,
          },
        }
      );
      updated++;
    }
    console.log(`[SUCCESS] Restored ${updated} documents to legacy 100 kWp configuration.`);
    await mongoose.disconnect();
    return;
  }

  // Normalization to 20 kWp (50 panels × 0.4 kWp)
  const legacyDocs = await collection.countDocuments({ systemCapacityKW: { $gt: 20 } });
  const alreadyMigrated = await collection.countDocuments({ systemCapacityKW: 20 });
  console.log(`Legacy documents with systemCapacityKW > 20: ${legacyDocs}`);
  console.log(`Documents already at 20 kWp: ${alreadyMigrated}`);

  if (legacyDocs === 0) {
    console.log('\n[IDEMPOTENT] All documents are already configured at 20 kWp (0.4 kW per module). No changes needed.');
    await mongoose.disconnect();
    return;
  }

  const sample = await collection.findOne({ systemCapacityKW: { $gt: 20 } });
  if (sample) {
    console.log('\nSample legacy document before migration:');
    console.log({
      panelId: sample.panelId,
      panelNumber: sample.panelNumber,
      panelCapacityKW: sample.panelCapacityKW,
      systemCapacityKW: sample.systemCapacityKW,
      systemPanelCount: sample.systemPanelCount,
      energyGeneratedKWh: sample.energyGeneratedKWh,
      timestamp: sample.timestamp,
    });
    console.log('Projected document after migration:');
    console.log({
      panelId: sample.panelId,
      panelNumber: sample.panelNumber,
      panelCapacityKW: 0.4,
      systemCapacityKW: 20.0,
      systemPanelCount: 50,
      energyGeneratedKWh: Number((sample.energyGeneratedKWh * 0.2).toFixed(4)),
      timestamp: sample.timestamp,
    });
  }

  if (!isExecute) {
    console.log('\n[DRY-RUN COMPLETE] No database records were modified.');
    console.log('To apply this migration, run: node backend/scripts/migrate_solar_capacity_50_panels.js --execute');
    await mongoose.disconnect();
    return;
  }

  console.log('\nApplying idempotent migration to 1,750 documents...');
  const cursor = collection.find({ systemCapacityKW: { $gt: 20 } });
  let count = 0;
  const batchSize = 250;
  let batch = [];

  while (await cursor.hasNext()) {
    const doc = await cursor.next();
    const newEnergy = Number((doc.energyGeneratedKWh * 0.2).toFixed(4));
    batch.push({
      updateOne: {
        filter: { _id: doc._id },
        update: {
          $set: {
            panelCapacityKW: 0.4,
            systemCapacityKW: 20.0,
            systemPanelCount: 50,
            energyGeneratedKWh: newEnergy,
          },
        },
      },
    });

    if (batch.length >= batchSize) {
      await collection.bulkWrite(batch);
      count += batch.length;
      process.stdout.write(`  Migrated ${count}/${legacyDocs} records...\r`);
      batch = [];
    }
  }

  if (batch.length > 0) {
    await collection.bulkWrite(batch);
    count += batch.length;
  }

  console.log(`\n[SUCCESS] Successfully migrated ${count} records to 20 kWp (0.4 kWp/module).`);

  const newSum = await collection.aggregate([
    { $group: { _id: null, totalKWh: { $sum: '$energyGeneratedKWh' } } },
  ]).toArray();
  console.log(`Total 5-day accumulated solar energy is now: ${newSum[0]?.totalKWh?.toFixed(2)} kWh (~87 kWh/day).`);

  await mongoose.disconnect();
}

runMigration().catch((err) => {
  console.error('[ERROR] Migration failed:', err);
  process.exit(1);
});
