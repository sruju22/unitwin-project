require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const mongoose = require('mongoose');

async function audit() {
  console.log('Connecting to MongoDB Atlas...');
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected successfully.\n');
  const db = mongoose.connection.db;

  console.log('====================================================');
  console.log('1. AUDITING energyUsage COLLECTION');
  console.log('====================================================');
  const energyCount = await db.collection('energyUsage').countDocuments();
  console.log('Total energyUsage documents:', energyCount);

  // Min and max timestamp overall
  const energyMin = await db.collection('energyUsage').find().sort({ timestamp: 1 }).limit(1).toArray();
  const energyMax = await db.collection('energyUsage').find().sort({ timestamp: -1 }).limit(1).toArray();
  console.log('Earliest energy timestamp:', energyMin[0]?.timestamp, 'Label:', energyMin[0]?.snapshotLabel);
  console.log('Latest energy timestamp:', energyMax[0]?.timestamp, 'Label:', energyMax[0]?.snapshotLabel);

  // Group by date (Asia/Kolkata)
  const energyByDate = await db.collection('energyUsage').aggregate([
    {
      $group: {
        _id: {
          date: { $dateToString: { format: '%Y-%m-%d', date: '$timestamp', timezone: 'Asia/Kolkata' } },
        },
        count: { $sum: 1 },
        minTime: { $min: '$timestamp' },
        maxTime: { $max: '$timestamp' },
        snapshots: { $addToSet: '$snapshotLabel' },
      },
    },
    { $sort: { '_id.date': 1 } },
  ]).toArray();

  console.log('\nenergyUsage by Day:');
  energyByDate.forEach((d) => {
    console.log(`  Date: ${d._id.date} | Count: ${d.count} | Min: ${d.minTime?.toISOString()} | Max: ${d.maxTime?.toISOString()} | Snapshots: [${d.snapshots.sort().join(', ')}]`);
  });

  // All distinct timestamps in energyUsage
  const energyTimestamps = await db.collection('energyUsage').aggregate([
    {
      $group: {
        _id: '$timestamp',
        snapshotLabel: { $first: '$snapshotLabel' },
        count: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
  ]).toArray();

  console.log(`\nTotal distinct energy timestamps: ${energyTimestamps.length}`);
  console.log('Sample energy timestamps:');
  energyTimestamps.slice(-10).forEach((t) => {
    const kolkataTime = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Kolkata',
      dateStyle: 'medium',
      timeStyle: 'medium',
    }).format(new Date(t._id));
    console.log(`  ISO: ${t._id?.toISOString()} | Kolkata: ${kolkataTime} | Label: ${t.snapshotLabel} | Count: ${t.count}`);
  });

  console.log('\n====================================================');
  console.log('2. AUDITING solarGeneration COLLECTION');
  console.log('====================================================');
  const solarCount = await db.collection('solarGeneration').countDocuments();
  console.log('Total solarGeneration documents:', solarCount);

  // Min and max timestamp overall
  const solarMin = await db.collection('solarGeneration').find().sort({ timestamp: 1 }).limit(1).toArray();
  const solarMax = await db.collection('solarGeneration').find().sort({ timestamp: -1 }).limit(1).toArray();
  console.log('Earliest solar timestamp:', solarMin[0]?.timestamp, 'Label:', solarMin[0]?.timelineLabel);
  console.log('Latest solar timestamp:', solarMax[0]?.timestamp, 'Label:', solarMax[0]?.timelineLabel);

  // Group by date (Asia/Kolkata)
  const solarByDate = await db.collection('solarGeneration').aggregate([
    {
      $group: {
        _id: {
          date: { $dateToString: { format: '%Y-%m-%d', date: '$timestamp', timezone: 'Asia/Kolkata' } },
        },
        count: { $sum: 1 },
        minTime: { $min: '$timestamp' },
        maxTime: { $max: '$timestamp' },
        labels: { $addToSet: '$timelineLabel' },
      },
    },
    { $sort: { '_id.date': 1 } },
  ]).toArray();

  console.log('\nsolarGeneration by Day:');
  solarByDate.forEach((d) => {
    console.log(`  Date: ${d._id.date} | Count: ${d.count} | Min: ${d.minTime?.toISOString()} | Max: ${d.maxTime?.toISOString()} | Labels: [${d.labels.sort().join(', ')}]`);
  });

  // All distinct timestamps in solarGeneration
  const solarTimestamps = await db.collection('solarGeneration').aggregate([
    {
      $group: {
        _id: '$timestamp',
        timelineLabel: { $first: '$timelineLabel' },
        count: { $sum: 1 },
        totalKWh: { $sum: '$energyGeneratedKWh' },
      },
    },
    { $sort: { _id: 1 } },
  ]).toArray();

  console.log(`\nTotal distinct solar timestamps: ${solarTimestamps.length}`);
  console.log('Latest solar timestamps:');
  solarTimestamps.slice(-10).forEach((t) => {
    const kolkataTime = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Kolkata',
      dateStyle: 'medium',
      timeStyle: 'medium',
    }).format(new Date(t._id));
    console.log(`  ISO: ${t._id?.toISOString()} | Kolkata: ${kolkataTime} | Label: ${t.timelineLabel} | Count: ${t.count} | TotalKWh: ${t.totalKWh}`);
  });

  await mongoose.disconnect();
}

audit().catch(console.error);
