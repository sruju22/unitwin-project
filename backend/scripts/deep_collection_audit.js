require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const mongoose = require('mongoose');

async function deepAudit() {
  await mongoose.connect(process.env.MONGODB_URI);
  const db = mongoose.connection.db;

  console.log('Connected to DB:', db.databaseName);

  // 1. ALERTS
  console.log('\n======================================================');
  console.log('1. ALERTS COLLECTION');
  console.log('======================================================');
  const alertColl = db.collection('alerts');
  const alertCount = await alertColl.countDocuments();
  const alertTypes = await alertColl.distinct('alertType');
  const alertSeverities = await alertColl.distinct('severity');
  const alertStatuses = await alertColl.distinct('status');
  console.log('Total alerts:', alertCount);
  console.log('alertType distinct:', alertTypes);
  console.log('severity distinct:', alertSeverities);
  console.log('status distinct:', alertStatuses);

  // Group by alertType
  const alertByType = await alertColl.aggregate([
    { $group: { _id: '$alertType', count: { $sum: 1 }, latest: { $max: '$timestamp' } } },
    { $sort: { latest: -1 } }
  ]).toArray();
  console.log('Alerts by alertType:');
  alertByType.forEach(t => console.log(`  ${t._id}: count=${t.count}, latest=${t.latest?.toISOString()}`));

  // Group by date (Asia/Kolkata)
  const alertByDate = await alertColl.aggregate([
    {
      $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$timestamp', timezone: 'Asia/Kolkata' } },
        count: { $sum: 1 },
        severities: { $addToSet: '$severity' }
      }
    },
    { $sort: { '_id': -1 } }
  ]).toArray();
  console.log('Alerts by Date (Kolkata):');
  alertByDate.forEach(d => console.log(`  ${d._id}: count=${d.count}, severities=[${d.severities.join(',')}]`));

  console.log('Sample alert document:');
  const sampleAlert = await alertColl.findOne();
  console.log(JSON.stringify(sampleAlert, null, 2));

  // 2. MAINTENANCE
  console.log('\n======================================================');
  console.log('2. MAINTAINENCE COLLECTION');
  console.log('======================================================');
  const maintColl = db.collection('maintainence');
  const maintCount = await maintColl.countDocuments();
  const maintStatuses = await maintColl.distinct('status');
  const maintPriorities = await maintColl.distinct('priority');
  const maintAssets = await maintColl.distinct('assetType');
  console.log('Total maintenance:', maintCount);
  console.log('Statuses:', maintStatuses);
  console.log('Priorities:', maintPriorities);
  console.log('Assets:', maintAssets);

  const maintByStatus = await maintColl.aggregate([
    { $group: { _id: '$status', count: { $sum: 1 } } }
  ]).toArray();
  console.log('By Status:', maintByStatus);

  const maintDates = await maintColl.aggregate([
    {
      $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$reportedDate', timezone: 'Asia/Kolkata' } },
        count: { $sum: 1 }
      }
    },
    { $sort: { '_id': -1 } }
  ]).toArray();
  console.log('By Date (Kolkata):', maintDates);

  const sampleMaint = await maintColl.findOne();
  console.log('Sample Maintenance:', JSON.stringify(sampleMaint, null, 2));

  // 3. OCCUPANCY
  console.log('\n======================================================');
  console.log('3. OCCUPANCY COLLECTION');
  console.log('======================================================');
  const occColl = db.collection('occupancy');
  const occCount = await occColl.countDocuments();
  const occDates = await occColl.aggregate([
    {
      $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$timestamp', timezone: 'Asia/Kolkata' } },
        count: { $sum: 1 },
        minTime: { $min: '$timestamp' },
        maxTime: { $max: '$timestamp' },
        snapshots: { $addToSet: '$snapshotLabel' }
      }
    },
    { $sort: { '_id': -1 } }
  ]).toArray();
  console.log('Total occupancy:', occCount);
  console.log('Occupancy by Date (Kolkata):');
  occDates.forEach(d => console.log(`  ${d._id}: count=${d.count}, min=${d.minTime?.toISOString()}, max=${d.maxTime?.toISOString()}, snapshots=${d.snapshots.length}`));

  // Check Oct 17 occupancy
  const oct17Occ = await occColl.find({
    timestamp: {
      $gte: new Date('2026-10-16T18:30:00.000Z'),
      $lte: new Date('2026-10-17T18:29:59.999Z')
    }
  }).toArray();
  console.log(`Oct 17 Occupancy records count: ${oct17Occ.length}`);
  if (oct17Occ.length > 0) {
    const oct17Snaps = await occColl.aggregate([
      {
        $match: {
          timestamp: {
            $gte: new Date('2026-10-16T18:30:00.000Z'),
            $lte: new Date('2026-10-17T18:29:59.999Z')
          }
        }
      },
      {
        $group: {
          _id: { time: '$timestamp', label: '$snapshotLabel' },
          roomCount: { $sum: 1 },
          totalOccupancy: { $sum: '$occupancy' },
          totalCapacity: { $sum: '$capacity' }
        }
      },
      { $sort: { '_id.time': 1 } }
    ]).toArray();
    console.log('Oct 17 Occupancy snapshots:');
    oct17Snaps.forEach(s => console.log(`  Time: ${s._id.time?.toISOString()} | Label: ${s._id.label} | Rooms: ${s.roomCount} | TotalOcc: ${s.totalOccupancy}/${s.totalCapacity}`));
  }

  // 4. CONGESTION
  console.log('\n======================================================');
  console.log('4. CONGESTION COLLECTION');
  console.log('======================================================');
  const congColl = db.collection('congestion');
  const congCount = await congColl.countDocuments();
  const congDates = await congColl.aggregate([
    {
      $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$timestamp', timezone: 'Asia/Kolkata' } },
        count: { $sum: 1 },
        maxTime: { $max: '$timestamp' },
        snapshots: { $addToSet: '$snapshotLabel' }
      }
    },
    { $sort: { '_id': -1 } }
  ]).toArray();
  console.log('Total congestion docs:', congCount);
  console.log('Congestion by Date:');
  congDates.forEach(d => console.log(`  ${d._id}: count=${d.count}, max=${d.maxTime?.toISOString()}, snaps=${d.snapshots.join(', ')}`));

  // 5. WATER USAGE
  console.log('\n======================================================');
  console.log('5. WATERUSAGE COLLECTION');
  console.log('======================================================');
  const waterColl = db.collection('Waterusage');
  const waterCount = await waterColl.countDocuments();
  const waterDates = await waterColl.aggregate([
    {
      $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$timestamp', timezone: 'Asia/Kolkata' } },
        count: { $sum: 1 },
        maxTime: { $max: '$timestamp' },
        anomalies: { $sum: { $cond: ['$anomalyDetected', 1, 0] } }
      }
    },
    { $sort: { '_id': -1 } }
  ]).toArray();
  console.log('Total water docs:', waterCount);
  console.log('Water by Date:');
  waterDates.forEach(d => console.log(`  ${d._id}: count=${d.count}, max=${d.maxTime?.toISOString()}, anomalies=${d.anomalies}`));

  // 6. BUILDINGS & ROOMS
  console.log('\n======================================================');
  console.log('6. BUILDINGS & ROOMS');
  console.log('======================================================');
  const bldColl = db.collection('buildings');
  const blds = await bldColl.find().toArray();
  console.log(`Buildings (${blds.length}):`);
  blds.forEach(b => console.log(`  ${b.buildingId}: ${b.buildingName} (${b.buildingType}) - floors: ${b.floors}, status: ${b.status}`));

  const roomColl = db.collection('rooms');
  const namedRoomsCount = await roomColl.countDocuments({ roomName: { $exists: true, $ne: '' } });
  console.log(`Rooms total: ${await roomColl.countDocuments()}, with roomName: ${namedRoomsCount}`);
  const sampleNamedRooms = await roomColl.find({ roomName: { $exists: true, $ne: '' } }).limit(5).toArray();
  console.log('Sample named rooms:');
  sampleNamedRooms.forEach(r => console.log(`  ${r.buildingId} ${r.roomNumber}: "${r.roomName}" (${r.roomType})`));

  // 7. CAMPUS AREAS
  console.log('\n======================================================');
  console.log('7. CAMPUS AREAS');
  console.log('======================================================');
  const areaColl = db.collection('campusAreas');
  const areas = await areaColl.find().toArray();
  areas.forEach(a => console.log(`  ${a.areaId}: ${a.areaName} (${a.areaType}) - cap: ${a.capacity}, occ: ${a.currentOccupancy}, status: ${a.status}`));

  await mongoose.disconnect();
}

deepAudit().catch(err => {
  console.error(err);
  process.exit(1);
});
