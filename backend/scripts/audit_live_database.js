require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');

async function runAudit() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('ERROR: MONGODB_URI not found in backend/.env');
    process.exit(1);
  }

  console.log('Connecting to MongoDB Atlas...');
  try {
    await mongoose.connect(uri);
  } catch (err) {
    console.error('Failed to connect to MongoDB Atlas:', err.message);
    process.exit(1);
  }

  const db = mongoose.connection.db;
  const dbName = db.databaseName;
  console.log(`Successfully connected to database: "${dbName}"\n`);

  const collections = await db.listCollections().toArray();
  console.log(`Found ${collections.length} collections:`);
  collections.forEach((c) => console.log(` - ${c.name} (type: ${c.type || 'collection'})`));
  console.log('\n=======================================================\n');

  const auditReport = {
    database: dbName,
    auditedAt: new Date().toISOString(),
    collections: {},
  };

  for (const collInfo of collections) {
    const collName = collInfo.name;
    const coll = db.collection(collName);
    const count = await coll.countDocuments();

    // Inspect fields from up to 20 documents
    const sampleDocs = await coll.find().limit(20).toArray();
    const fieldTypes = {};
    sampleDocs.forEach((doc) => {
      Object.keys(doc).forEach((k) => {
        const val = doc[k];
        let type = typeof val;
        if (val === null) type = 'null';
        else if (Array.isArray(val)) type = 'array';
        else if (val instanceof Date) type = 'date';
        else if (val?._bsontype === 'ObjectID' || val?._bsontype === 'ObjectId') type = 'ObjectId';

        if (!fieldTypes[k]) fieldTypes[k] = new Set();
        fieldTypes[k].add(type);
      });
    });

    const fieldsSummary = {};
    Object.keys(fieldTypes).forEach((k) => {
      fieldsSummary[k] = Array.from(fieldTypes[k]).join('|');
    });

    // Check temporal bounds if timestamp or date fields exist
    const dateFields = Object.keys(fieldsSummary).filter((f) =>
      ['timestamp', 'reportedDate', 'date', 'createdAt', 'time', 'updatedAt'].includes(f)
    );

    let temporalInfo = null;
    if (dateFields.length > 0) {
      temporalInfo = {};
      for (const df of dateFields) {
        const earliest = await coll.find({ [df]: { $exists: true, $ne: null } }).sort({ [df]: 1 }).limit(1).toArray();
        const latest = await coll.find({ [df]: { $exists: true, $ne: null } }).sort({ [df]: -1 }).limit(3).toArray();
        temporalInfo[df] = {
          earliest: earliest[0]?.[df],
          latestSamples: latest.map((doc) => ({
            _id: doc._id?.toString(),
            [df]: doc[df],
            summary: doc.title || doc.name || doc.snapshotLabel || doc.status || doc.severity || doc.description || doc.type || undefined,
          })),
        };
      }
    }

    // Latest 2 documents for representative inspection
    const latestDocs = await coll.find().sort({ _id: -1 }).limit(3).toArray();

    // Specific audits per collection
    let specificData = null;
    if (collName === 'alerts') {
      const distinctSeverities = await coll.distinct('severity');
      const distinctStatuses = await coll.distinct('status');
      const distinctTypes = await coll.distinct('type');
      const countByStatus = await coll.aggregate([
        { $group: { _id: '$status', count: { $sum: 1 } } }
      ]).toArray();
      const countBySeverity = await coll.aggregate([
        { $group: { _id: '$severity', count: { $sum: 1 } } }
      ]).toArray();
      specificData = {
        distinctSeverities,
        distinctStatuses,
        distinctTypes,
        countByStatus,
        countBySeverity,
        allAlerts: await coll.find().sort({ timestamp: -1 }).toArray(),
      };
    } else if (collName === 'maintainence' || collName === 'maintenance') {
      const distinctStatuses = await coll.distinct('status');
      const distinctPriorities = await coll.distinct('priority');
      const countByStatus = await coll.aggregate([
        { $group: { _id: '$status', count: { $sum: 1 } } }
      ]).toArray();
      specificData = {
        distinctStatuses,
        distinctPriorities,
        countByStatus,
        recentDocs: await coll.find().sort({ reportedDate: -1 }).limit(10).toArray(),
      };
    } else if (collName === 'buildings') {
      specificData = {
        buildings: await coll.find().toArray(),
      };
    } else if (collName === 'rooms') {
      const roomTypes = await coll.distinct('type');
      const buildingsWithRooms = await coll.distinct('buildingId');
      const sampleRooms = await coll.find().limit(10).toArray();
      specificData = {
        roomTypes,
        buildingsWithRooms,
        sampleRooms,
      };
    } else if (collName === 'occupancy') {
      const latestSnapshotLabels = await coll.distinct('snapshotLabel');
      const latestDoc = await coll.find().sort({ timestamp: -1 }).limit(5).toArray();
      specificData = {
        snapshotLabels: latestSnapshotLabels,
        latestDoc,
      };
    } else if (collName === 'congestion') {
      const latestDoc = await coll.find().sort({ timestamp: -1 }).limit(5).toArray();
      specificData = {
        latestDoc,
      };
    } else if (collName === 'Waterusage' || collName === 'waterUsage') {
      const anomalyCount = await coll.countDocuments({ anomalyDetected: true });
      const latestDoc = await coll.find().sort({ timestamp: -1 }).limit(5).toArray();
      specificData = {
        anomalyCount,
        latestDoc,
      };
    }

    auditReport.collections[collName] = {
      count,
      fields: fieldsSummary,
      temporal: temporalInfo,
      sampleDoc: sampleDocs[0] || null,
      latestDocs,
      specificData,
    };

    console.log(`Collection: ${collName}`);
    console.log(`  Count: ${count}`);
    console.log(`  Fields: ${Object.keys(fieldsSummary).join(', ')}`);
    if (temporalInfo) {
      Object.keys(temporalInfo).forEach((df) => {
        console.log(`  Date Field [${df}]: Earliest: ${temporalInfo[df].earliest} | Latest: ${temporalInfo[df].latestSamples[0]?.[df]}`);
      });
    }
    console.log('-------------------------------------------------------');
  }

  const outPath = path.resolve(__dirname, 'database_audit_results.json');
  fs.writeFileSync(outPath, JSON.stringify(auditReport, null, 2));
  console.log(`\nAudit results written to: ${outPath}`);

  await mongoose.disconnect();
  console.log('Database disconnected.');
}

runAudit().catch((err) => {
  console.error('Audit failed:', err);
  process.exit(1);
});
