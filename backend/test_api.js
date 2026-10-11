const http = require('http');
const mongoose = require('mongoose');
const { app, server } = require('./server');

function makeRequest(path) {
  return new Promise((resolve, reject) => {
    http.get(`http://localhost:5001${path}`, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve({ status: res.statusCode, body: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, text: data });
        }
      });
    }).on('error', reject);
  });
}

async function runTests() {
  console.log("Waiting for database connection...");
  // Wait up to 10 seconds for DB connection
  let attempts = 0;
  while (mongoose.connection.readyState !== 1 && attempts < 20) {
    await new Promise(r => setTimeout(r, 500));
    attempts++;
  }

  if (mongoose.connection.readyState !== 1) {
    console.error("Database failed to connect within timeout.");
    process.exit(1);
  }

  console.log(`Connected to database: "${mongoose.connection.db.databaseName}"`);
  console.log("\n================ RUNNING API ENDPOINT TESTS ================\n");

  const results = [];

  const testCases = [
    { name: 'Root Health Check', path: '/' },
    { name: 'List All Buildings', path: '/api/buildings' },
    { name: 'Get Building BLD001', path: '/api/buildings/BLD001' },
    { name: 'Get Building BLD999 (404 expected)', path: '/api/buildings/BLD999' },
    { name: 'List All Rooms', path: '/api/rooms' },
    { name: 'Filter Rooms by Building (BLD001)', path: '/api/rooms?buildingId=BLD001' },
    { name: 'Filter Rooms by Block (C)', path: '/api/rooms?block=C' },
    { name: 'Filter Rooms by Block C + Floor 1', path: '/api/rooms?block=C&floorNumber=1' },
    { name: 'Filter Rooms by Type (Lab)', path: '/api/rooms?roomType=Lab' },
    { name: 'Get Single Room (C-102)', path: '/api/rooms/C-102' },
    { name: 'List All Timetables', path: '/api/timetables' },
    { name: 'Filter Timetables by Day (Monday)', path: '/api/timetables?day=Monday' },
    { name: 'Filter Timetables by Room (C-209)', path: '/api/timetables?room=C-209' },
    { name: 'Filter Timetables by Section (CSE_1_C)', path: '/api/timetables?sectionId=CSE_1_C' },
    { name: 'List All Sections', path: '/api/sections' },
    { name: 'List All Campus Areas', path: '/api/campus-areas' },
    { name: 'List Active Alerts', path: '/api/alerts' },
    { name: 'List Energy Telemetry', path: '/api/energy-usage' },
    { name: 'List Occupancy Data', path: '/api/occupancy' },
    { name: 'List Campus Insights', path: '/api/insights' },
  ];

  for (const tc of testCases) {
    try {
      const res = await makeRequest(tc.path);
      const isSuccess = tc.path.includes('BLD999') ? res.status === 404 : res.status === 200;
      const count = res.body?.count !== undefined ? res.body.count : (res.body?.data ? 1 : 'N/A');
      
      console.log(`[${isSuccess ? 'PASS' : 'FAIL'}] HTTP ${res.status} | ${tc.name}`);
      console.log(`       Path: ${tc.path}`);
      console.log(`       Count / Result: ${count}`);
      if (res.body?.data && !Array.isArray(res.body.data)) {
        console.log(`       Sample Item:`, JSON.stringify(res.body.data).slice(0, 100) + '...');
      } else if (Array.isArray(res.body?.data) && res.body.data.length > 0) {
        console.log(`       First Item:`, JSON.stringify(res.body.data[0]).slice(0, 100) + '...');
      }

      results.push({ ...tc, status: res.status, count, passed: isSuccess });
    } catch (err) {
      console.error(`[FAIL] ${tc.name}:`, err.message);
      results.push({ ...tc, status: 'ERROR', error: err.message, passed: false });
    }
  }

  console.log("\n================ TEST SUMMARY ================\n");
  const passedCount = results.filter(r => r.passed).length;
  console.log(`Total Tests: ${results.length} | Passed: ${passedCount} | Failed: ${results.length - passedCount}`);

  server.close(async () => {
    await mongoose.disconnect();
    console.log("Server closed and database disconnected cleanly.");
    process.exit(passedCount === results.length ? 0 : 1);
  });
}

runTests();
