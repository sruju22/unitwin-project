require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const mongoose = require('mongoose');

async function verifyReportingDateContract() {
  console.log('Connecting to MongoDB Atlas...');
  await mongoose.connect(process.env.MONGODB_URI);
  const db = mongoose.connection.db;

  console.log('\n======================================================');
  console.log('1. TESTING ENERGY USAGE DATE FILTERING');
  console.log('======================================================');

  async function testEnergyDate(dateStr) {
    const start = new Date(`${dateStr}T00:00:00+05:30`);
    const end = new Date(`${dateStr}T23:59:59.999+05:30`);
    const filter = { timestamp: { $gte: start, $lte: end } };

    const [docCount, timelineAgg] = await Promise.all([
      db.collection('energyUsage').countDocuments(filter),
      db.collection('energyUsage').aggregate([
        { $match: filter },
        {
          $group: {
            _id: { timestamp: '$timestamp', snapshotLabel: '$snapshotLabel' },
            totalWatts: {
              $sum: { $multiply: ['$powerRatingWatts', { $ifNull: ['$activeQuantity', 0] }] },
            },
            totalEnergyKWh: { $sum: '$energyKWh' },
            recordCount: { $sum: 1 },
          },
        },
        { $sort: { '_id.timestamp': 1 } },
      ]).toArray(),
    ]);

    console.log(`\n--- Results for date: ${dateStr} ---`);
    console.log(`Doc count: ${docCount}`);
    console.log(`Snapshot count: ${timelineAgg.length}`);
    if (timelineAgg.length > 0) {
      const first = timelineAgg[0];
      const last = timelineAgg[timelineAgg.length - 1];
      console.log(`First snapshot: ${first._id.snapshotLabel} (${first._id.timestamp.toISOString()}) - ${(first.totalWatts / 1000).toFixed(1)} kW`);
      console.log(`Latest snapshot: ${last._id.snapshotLabel} (${last._id.timestamp.toISOString()}) - ${(last.totalWatts / 1000).toFixed(1)} kW`);
    } else {
      console.log(`Explicit no-data state confirmed: 0 records found for ${dateStr}.`);
    }
  }

  await testEnergyDate('2026-10-14');
  await testEnergyDate('2026-10-17');
  await testEnergyDate('2026-10-18');

  console.log('\n======================================================');
  console.log('2. TESTING OCCUPANCY DATE FILTERING');
  console.log('======================================================');

  async function testOccupancyDate(dateStr) {
    const start = new Date(`${dateStr}T00:00:00+05:30`);
    const end = new Date(`${dateStr}T23:59:59.999+05:30`);
    const filter = { timestamp: { $gte: start, $lte: end } };

    const [docCount, timelineAgg] = await Promise.all([
      db.collection('occupancy').countDocuments(filter),
      db.collection('occupancy').aggregate([
        { $match: filter },
        {
          $group: {
            _id: { timestamp: '$timestamp', snapshotLabel: '$snapshotLabel' },
            totalOccupancy: { $sum: '$occupancy' },
            totalCapacity: { $sum: '$capacity' },
            roomCount: { $sum: 1 },
          },
        },
        { $sort: { '_id.timestamp': 1 } },
      ]).toArray(),
    ]);

    console.log(`\n--- Occupancy results for date: ${dateStr} ---`);
    console.log(`Doc count: ${docCount}`);
    console.log(`Snapshot count: ${timelineAgg.length}`);
    if (timelineAgg.length > 0) {
      const comp = timelineAgg.filter(t => t.roomCount >= 10);
      const target = comp.length > 0 ? comp[comp.length - 1] : timelineAgg[timelineAgg.length - 1];
      const util = ((target.totalOccupancy / target.totalCapacity) * 100).toFixed(1);
      console.log(`Peak daytime snapshot: ${target._id.snapshotLabel} (${target._id.timestamp.toISOString()})`);
      console.log(`Total present: ${target.totalOccupancy} / ${target.totalCapacity} (${util}% util) across ${target.roomCount} rooms`);
    } else {
      console.log(`Explicit no-data state confirmed: 0 records found for ${dateStr}.`);
    }
  }

  await testOccupancyDate('2026-10-14');
  await testOccupancyDate('2026-10-17');
  await testOccupancyDate('2026-10-18');

  console.log('\n======================================================');
  console.log('3. TESTING ALERTS AS-OF CUTOFF FILTERING');
  console.log('======================================================');

  async function testAlertsAsOf(asOfStr) {
    const parsed = new Date(asOfStr);
    const filter = { timestamp: { $lte: parsed } };
    const count = await db.collection('alerts').countDocuments(filter);
    console.log(`Active alerts as of ${asOfStr}: ${count}`);
  }

  await testAlertsAsOf('2026-10-14T23:59:59.999+05:30');
  await testAlertsAsOf('2026-10-17T23:59:59.999+05:30');

  await mongoose.disconnect();
  console.log('\nVerification complete!');
}

verifyReportingDateContract().catch((err) => {
  console.error('Verification failed:', err);
  process.exit(1);
});
