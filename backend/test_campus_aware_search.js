require('dotenv').config({ path: require('path').resolve(__dirname, '.env') });
const http = require('http');
const mongoose = require('mongoose');
const express = require('express');
const searchRouter = require('./routes/search');

function makeRequest(server, path) {
  return new Promise((resolve, reject) => {
    const port = server.address().port;
    http.get(`http://127.0.0.1:${port}${path}`, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          const body = JSON.parse(data);
          resolve({ status: res.statusCode, body });
        } catch {
          resolve({ status: res.statusCode, body: data });
        }
      });
    }).on('error', reject);
  });
}

async function runSearchVerification() {
  console.log('================================================================');
  console.log('AIT CAMPUS INTELLIGENCE CAMPUS-AWARE SEARCH VERIFICATION SUITE');
  console.log('================================================================\n');

  const app = express();
  app.use(express.json());
  app.use('/api/search', searchRouter);

  // Check MongoDB connection
  if (process.env.MONGODB_URI) {
    try {
      await mongoose.connect(process.env.MONGODB_URI);
      console.log('Connected to MongoDB Atlas\n');
    } catch (err) {
      console.warn('MongoDB connection warning (running in standalone mode):', err.message);
    }
  }

  const server = app.listen(0);

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  [PASS] ${message}`);
      passed++;
    } else {
      console.error(`  [FAIL] ${message}`);
      failed++;
    }
  }

  try {
    // TEST 1: Empty and Short Query Handling
    console.log('--- TEST GROUP 1: Empty & Short Query Handling ---');
    {
      const resEmpty = await makeRequest(server, '/api/search?q=');
      assert(resEmpty.status === 200, 'Returns 200 for empty query');
      assert(resEmpty.body.count === 0, 'Returns 0 results for empty query');

      const resSingle = await makeRequest(server, '/api/search?q=a');
      assert(resSingle.status === 200, 'Returns 200 for 1-char query');
      assert(resSingle.body.count === 0, 'Returns 0 results for 1-char query without hitting database');
    }

    // TEST 2: Input Sanitization & Regex Safety
    console.log('\n--- TEST GROUP 2: Security & Regex Escaping ---');
    {
      const resSpecial = await makeRequest(server, '/api/search?q=' + encodeURIComponent('C(101)*?.*['));
      assert(resSpecial.status === 200, 'Handles regex special characters without crashing');
      assert(resSpecial.body.success === true, 'Returns success: true for regex characters');

      const longStr = 'a'.repeat(120);
      const resLong = await makeRequest(server, `/api/search?q=${longStr}`);
      assert(resLong.status === 200, 'Handles query exceeding 80 characters safely');
      assert(resLong.body.query.length <= 80, 'Query is truncated to maximum allowed length');
    }

    // TEST 3: Campus Buildings Search
    console.log('\n--- TEST GROUP 3: Buildings & Campus Locations ---');
    {
      // Search "C Block"
      const resCBlock = await makeRequest(server, '/api/search?q=C%20Block');
      assert(resCBlock.status === 200, 'Search for "C Block" returns 200');
      const bldMatches = resCBlock.body.results?.buildings || [];
      assert(
        bldMatches.some((b) => /c-?block|main building|BLD001|B02/i.test(b.title + b.subtitle + b.id)),
        'Finds C-Block / Main Building in buildings category'
      );

      // Search "Library"
      const resLib = await makeRequest(server, '/api/search?q=Library');
      const libMatches = resLib.body.results?.buildings || [];
      assert(
        libMatches.some((b) => /library/i.test(b.title)),
        'Finds Library Building (BLD003 / B06)'
      );

      // Search "Girls Hostel"
      const resHostel = await makeRequest(server, '/api/search?q=Girls%20Hostel');
      const hostelMatches = resHostel.body.results?.buildings || [];
      assert(
        hostelMatches.some((b) => /girls hostel/i.test(b.title)),
        'Finds Girls Hostel Building (BLD007 / B07)'
      );
    }

    // TEST 4: Rooms & Facilities Search
    console.log('\n--- TEST GROUP 4: Rooms & Laboratory Facilities ---');
    {
      // Search "C101"
      const resC101 = await makeRequest(server, '/api/search?q=C101');
      const roomMatches = resC101.body.results?.rooms || [];
      assert(
        roomMatches.some((r) => /C-?101/i.test(r.title + r.id)),
        'Finds Room C101 (or C-101)'
      );

      // Search "CV Raman Lab"
      const resRaman = await makeRequest(server, '/api/search?q=CV%20Raman%20Lab');
      const ramanMatches = resRaman.body.results?.rooms || [];
      assert(
        ramanMatches.some((r) => /raman/i.test(r.title + r.subtitle + r.description)),
        'Finds Sir CV Raman Lab (C-108 in BLD001)'
      );

      // Search "CAED Lab"
      const resCAED = await makeRequest(server, '/api/search?q=CAED%20Lab');
      const caedMatches = resCAED.body.results?.rooms || [];
      assert(
        caedMatches.some((r) => /caed/i.test(r.title + r.subtitle + r.description)),
        'Finds CAED Lab (C-311 in BLD001)'
      );

      // Search "classrooms"
      const resClass = await makeRequest(server, '/api/search?q=classrooms');
      const classMatches = resClass.body.results?.rooms || [];
      assert(
        classMatches.length > 0 && classMatches.some((r) => /classroom/i.test(r.title + r.subtitle)),
        'Finds academic classrooms by roomType'
      );
    }

    // TEST 5: Alerts & Incidents
    console.log('\n--- TEST GROUP 5: Operational Alerts & Incidents ---');
    {
      // Search "critical alerts"
      const resCrit = await makeRequest(server, '/api/search?q=critical%20alerts');
      const critAlerts = resCrit.body.results?.alerts || [];
      assert(critAlerts.length > 0, 'Returns alerts for "critical alerts" query');

      // Search "high priority"
      const resHigh = await makeRequest(server, '/api/search?q=high%20priority');
      const highAlerts = resHigh.body.results?.alerts || [];
      assert(highAlerts.length > 0, 'Returns alerts matching high severity');
    }

    // TEST 6: Maintenance Records
    console.log('\n--- TEST GROUP 6: Maintenance Work Orders ---');
    {
      // Search "pending maintenance"
      const resPending = await makeRequest(server, '/api/search?q=pending%20maintenance');
      const pendingMaint = resPending.body.results?.maintenance || [];
      assert(pendingMaint.length > 0, 'Finds open/pending maintenance orders in maintainence collection');

      // Search "electrical issue"
      const resElec = await makeRequest(server, '/api/search?q=electrical%20issue');
      assert(resElec.status === 200, 'Search for electrical issues responds successfully');
    }

    // TEST 7: Occupancy Information
    console.log('\n--- TEST GROUP 7: Occupancy & Space Density ---');
    {
      // Search "occupancy"
      const resOcc = await makeRequest(server, '/api/search?q=occupancy');
      const occItems = resOcc.body.results?.occupancy || [];
      assert(occItems.length > 0, 'Finds occupancy records for "occupancy" query');
      if (occItems.length > 0) {
        assert(occItems[0].metadata?.isPilotData === true, 'Properly discloses pilot telemetry baseline');
        assert(typeof occItems[0].metadata?.utilization === 'number', 'Contains numeric utilization');
      }

      // Search "high occupancy"
      const resHighOcc = await makeRequest(server, '/api/search?q=high%20occupancy');
      const highOccItems = resHighOcc.body.results?.occupancy || [];
      assert(
        highOccItems.every((item) => item.metadata?.utilization >= 70),
        'Filters strictly for high utilization (>= 70%) when requested'
      );
    }

    // TEST 8: Energy & Solar Performance
    console.log('\n--- TEST GROUP 8: Energy & Solar Telemetry ---');
    {
      // Search "solar generation"
      const resSolar = await makeRequest(server, '/api/search?q=solar%20generation');
      const solarItems = resSolar.body.results?.energy || [];
      assert(solarItems.length > 0, 'Finds solar generation records');
      assert(
        solarItems.some((s) => s.metadata?.isSimulated === true && /simulated/i.test(s.title)),
        'Explicitly labels simulated rooftop solar telemetry as SIMULATED'
      );

      // Search "energy"
      const resEnergy = await makeRequest(server, '/api/search?q=energy');
      const energyItems = resEnergy.body.results?.energy || [];
      assert(
        energyItems.some((e) => /active power demand/i.test(e.title)),
        'Presents Active Power Demand telemetry'
      );
    }

    // TEST 9: Non-existent Query Handling
    console.log('\n--- TEST GROUP 9: No Matches Handling ---');
    {
      const resNone = await makeRequest(server, '/api/search?q=XYZ9999NONEXISTENT');
      assert(resNone.status === 200, 'Returns 200 status for zero matches');
      assert(resNone.body.count === 0, 'Reports count: 0 for non-existent term');
      assert(Object.keys(resNone.body.results).length === 0, 'Results object is empty without crashing');
    }
  } finally {
    server.close();
  }

  console.log('\n================================================================');
  console.log(`TEST SUMMARY: Passed: ${passed} | Failed: ${failed}`);
  console.log('================================================================\n');

  if (mongoose.connection.readyState === 1) {
    await mongoose.disconnect();
  }

  process.exit(failed > 0 ? 1 : 0);
}

runSearchVerification().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
