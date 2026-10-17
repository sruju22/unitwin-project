require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const mongoose = require('mongoose');

async function check() {
  await mongoose.connect(process.env.MONGODB_URI);
  const db = mongoose.connection.db;

  const energyTimestamps = await db.collection('energyUsage').aggregate([
    {
      $group: {
        _id: '$timestamp',
        label: { $first: '$snapshotLabel' },
        count: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
  ]).toArray();

  const solarTimestamps = await db.collection('solarGeneration').aggregate([
    {
      $group: {
        _id: '$timestamp',
        label: { $first: '$timelineLabel' },
        count: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
  ]).toArray();

  console.log('Energy distinct timestamps count:', energyTimestamps.length);
  console.log('Solar distinct timestamps count:', solarTimestamps.length);

  console.log('\n--- ALL ENERGY TIMESTAMPS ---');
  energyTimestamps.forEach(e => {
    console.log(e._id.toISOString(), '|', e.label);
  });

  console.log('\n--- ALL SOLAR TIMESTAMPS ---');
  solarTimestamps.forEach(s => {
    console.log(s._id.toISOString(), '|', s.label);
  });

  // Check matching
  const energySet = new Set(energyTimestamps.map(e => e._id.toISOString()));
  const solarSet = new Set(solarTimestamps.map(s => s._id.toISOString()));

  const energyOnly = energyTimestamps.filter(e => !solarSet.has(e._id.toISOString()));
  const solarOnly = solarTimestamps.filter(s => !energySet.has(s._id.toISOString()));

  console.log('\nEnergy timestamps without matching Solar timestamp:', energyOnly.length);
  energyOnly.forEach(e => console.log(' ', e._id.toISOString(), e.label));

  console.log('\nSolar timestamps without matching Energy timestamp:', solarOnly.length);
  solarOnly.forEach(s => console.log(' ', s._id.toISOString(), s.label));

  await mongoose.disconnect();
}

check().catch(console.error);
