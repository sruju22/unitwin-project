const mongoose = require('mongoose');
require('dotenv').config({ path: './backend/.env' });

async function check() {
  await mongoose.connect(process.env.MONGODB_URI);
  const db = mongoose.connection.db;
  const col = db.collection('energyUsage');

  // Distinct dates in Asia/Kolkata
  const dates = await col.aggregate([
    {
      $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$timestamp', timezone: 'Asia/Kolkata' } },
        count: { $sum: 1 },
        minTime: { $min: '$timestamp' },
        maxTime: { $max: '$timestamp' },
      }
    },
    { $sort: { _id: 1 } }
  ]).toArray();
  console.log('Energy Usage Dates in DB:');
  console.log(dates);

  // Distinct snapshots on 2026-10-15
  const oct15Snaps = await col.aggregate([
    {
      $match: {
        timestamp: {
          $gte: new Date('2026-10-15T00:00:00+05:30'),
          $lte: new Date('2026-10-15T23:59:59.999+05:30')
        }
      }
    },
    {
      $group: {
        _id: {
          timestamp: '$timestamp',
          snapshotLabel: '$snapshotLabel'
        },
        count: { $sum: 1 },
        totalWatts: { $sum: { $multiply: ['$powerRatingWatts', { $ifNull: ['$activeQuantity', 0] }] } },
        totalKWh: { $sum: '$energyKWh' }
      }
    },
    { $sort: { '_id.timestamp': 1 } }
  ]).toArray();
  console.log('\nOct 15 Snapshots:');
  oct15Snaps.forEach(s => {
    console.log({
      iso: s._id.timestamp.toISOString(),
      ist: new Date(s._id.timestamp).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }),
      label: s._id.snapshotLabel,
      kW: Math.round(s.totalWatts / 100) / 10,
      totalKWh: Math.round(s.totalKWh * 10) / 10,
      count: s.count
    });
  });

  // Also check sample document
  const sample = await col.findOne({
    timestamp: {
      $gte: new Date('2026-10-15T00:00:00+05:30'),
      $lte: new Date('2026-10-15T23:59:59.999+05:30')
    }
  });
  const occCol = db.collection('occupancy');
  const occSnaps = await occCol.aggregate([
    {
      $match: {
        timestamp: {
          $gte: new Date('2026-10-15T00:00:00+05:30'),
          $lte: new Date('2026-10-15T23:59:59.999+05:30')
        }
      }
    },
    {
      $group: {
        _id: { timestamp: '$timestamp', snapshotLabel: '$snapshotLabel' },
        count: { $sum: 1 },
        totalOcc: { $sum: '$occupancy' }
      }
    },
    { $sort: { '_id.timestamp': 1 } }
  ]).toArray();

  const solarCol = db.collection('solarGeneration');
  const solarSnaps = await solarCol.aggregate([
    {
      $match: {
        timestamp: {
          $gte: new Date('2026-10-15T00:00:00+05:30'),
          $lte: new Date('2026-10-15T23:59:59.999+05:30')
        }
      }
    },
    {
      $group: {
        _id: { timestamp: '$timestamp', label: '$timelineLabel' },
        count: { $sum: 1 },
        totalKWh: { $sum: '$energyGeneratedKWh' }
      }
    },
    { $sort: { '_id.timestamp': 1 } }
  ]).toArray();

  console.log('\nOct 15 Solar Snaps:');
  solarSnaps.forEach(s => console.log(s._id.timestamp.toISOString(), s._id.label, 'panels:', s.count, 'kWh:', s.totalKWh));

  await mongoose.disconnect();
}
check().catch(console.error);
