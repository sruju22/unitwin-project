require('dotenv').config({ path: require('path').resolve(__dirname, '.env') });
const http = require('http');
const mongoose = require('mongoose');
const express = require('express');
const roomsRouter = require('./routes/rooms');
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

async function runLabNamesVerification() {
  console.log('================================================================');
  console.log('AIT CAMPUS INTELLIGENCE LAB NAMES API & DISPLAY VERIFICATION');
  console.log('================================================================\n');

  const app = express();
  app.use(express.json());
  app.use('/api/rooms', roomsRouter);
  app.use('/api/search', searchRouter);

  if (process.env.MONGODB_URI) {
    try {
      await mongoose.connect(process.env.MONGODB_URI);
      console.log('Connected to MongoDB Atlas\n');
    } catch (err) {
      console.error('Failed to connect to MongoDB Atlas:', err.message);
      process.exit(1);
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
    // ── TEST GROUP 1: Room Model & GET /api/rooms ──
    console.log('--- TEST GROUP 1: Room Endpoints & Updated Lab Names ---');

    // C-123 (Capgemini Lab)
    const c123Res = await makeRequest(server, '/api/rooms/C-123');
    assert(c123Res.status === 200, 'GET /api/rooms/C-123 returns HTTP 200');
    assert(c123Res.body?.data?.roomName === 'Capgemini Lab', `C-123 contains updated roomName: "Capgemini Lab" (got: "${c123Res.body?.data?.roomName}")`);
    assert(c123Res.body?.data?.roomNumber === 'C-123', 'C-123 retains roomNumber: "C-123"');

    // C-108 (Sir CV Raman Lab)
    const c108Res = await makeRequest(server, '/api/rooms/C-108');
    assert(c108Res.status === 200, 'GET /api/rooms/C-108 returns HTTP 200');
    assert(c108Res.body?.data?.roomType === 'Sir CV Raman Lab', `C-108 contains roomType: "Sir CV Raman Lab" (got: "${c108Res.body?.data?.roomType}")`);
    assert(c108Res.body?.data?.roomNumber === 'C-108', 'C-108 retains roomNumber: "C-108"');

    // B-302 (Siddartha Lab)
    const b302Res = await makeRequest(server, '/api/rooms/B-302');
    assert(b302Res.status === 200, 'GET /api/rooms/B-302 returns HTTP 200');
    assert(b302Res.body?.data?.roomName === 'Siddartha Lab', `B-302 contains updated roomName: "Siddartha Lab" (got: "${b302Res.body?.data?.roomName}")`);

    // D-107 (M. Visvesvaraya Computer Lab)
    const d107Res = await makeRequest(server, '/api/rooms/D-107');
    assert(d107Res.status === 200, 'GET /api/rooms/D-107 returns HTTP 200');
    assert(d107Res.body?.data?.roomName === 'M. Visvesvaraya Computer Lab', `D-107 contains updated roomName: "M. Visvesvaraya Computer Lab" (got: "${d107Res.body?.data?.roomName}")`);

    // List Block C rooms
    const blockCRes = await makeRequest(server, '/api/rooms?buildingId=BLD001&block=C');
    assert(blockCRes.status === 200, 'GET /api/rooms?buildingId=BLD001&block=C returns HTTP 200');
    assert(Array.isArray(blockCRes.body?.data) && blockCRes.body.data.length > 0, `Block C returns array of rooms (${blockCRes.body?.data?.length} rooms)`);
    const capgeminiInList = blockCRes.body?.data?.find((r) => r.roomNumber === 'C-123');
    assert(capgeminiInList && capgeminiInList.roomName === 'Capgemini Lab', 'Block C rooms list includes Capgemini Lab for C-123');

    // ── TEST GROUP 2: Search by Updated Lab Names ──
    console.log('\n--- TEST GROUP 2: Campus-Aware Search for Updated Lab Names ---');

    // Search for "Capgemini"
    const searchCap = await makeRequest(server, '/api/search?q=Capgemini&types=rooms');
    assert(searchCap.status === 200, 'Search for "Capgemini" returns HTTP 200');
    const capRooms = searchCap.body?.results?.rooms || [];
    assert(capRooms.length > 0, 'Search for "Capgemini" finds matching room');
    assert(capRooms[0]?.title.includes('Capgemini Lab'), `Search title includes "Capgemini Lab" (got: "${capRooms[0]?.title}")`);
    assert(capRooms[0]?.metadata?.roomNumber === 'C-123', `Search metadata preserves roomNumber "C-123" (got: "${capRooms[0]?.metadata?.roomNumber}")`);
    assert(capRooms[0]?.metadata?.roomName === 'Capgemini Lab', `Search metadata includes roomName "Capgemini Lab" (got: "${capRooms[0]?.metadata?.roomName}")`);

    // Search for "Siddartha"
    const searchSid = await makeRequest(server, '/api/search?q=Siddartha&types=rooms');
    assert(searchSid.status === 200, 'Search for "Siddartha" returns HTTP 200');
    const sidRooms = searchSid.body?.results?.rooms || [];
    assert(sidRooms.length > 0, 'Search for "Siddartha" finds matching room');
    assert(sidRooms[0]?.title.includes('Siddartha Lab'), `Search title includes "Siddartha Lab" (got: "${sidRooms[0]?.title}")`);
    assert(sidRooms[0]?.metadata?.roomNumber === 'B-302', `Search metadata preserves roomNumber "B-302"`);

    // Search for "Visvesvaraya"
    const searchVis = await makeRequest(server, '/api/search?q=Visvesvaraya&types=rooms');
    assert(searchVis.status === 200, 'Search for "Visvesvaraya" returns HTTP 200');
    const visRooms = searchVis.body?.results?.rooms || [];
    assert(visRooms.length > 0, 'Search for "Visvesvaraya" finds matching room');
    assert(visRooms[0]?.title.includes('Visvesvaraya'), `Search title includes "Visvesvaraya"`);

    // Search for "Raman"
    const searchRam = await makeRequest(server, '/api/search?q=Raman&types=rooms');
    assert(searchRam.status === 200, 'Search for "Raman" returns HTTP 200');
    const ramRooms = searchRam.body?.results?.rooms || [];
    assert(ramRooms.length > 0, 'Search for "Raman" finds matching room');
    assert(ramRooms.some((r) => r.title.includes('Raman') && r.metadata?.roomNumber === 'C-108'), 'Search finds Sir CV Raman Lab (C-108)');

    // ── TEST GROUP 3: Frontend Utility Logic ──
    console.log('\n--- TEST GROUP 3: Centralized Room Display Utilities ---');

    // Simulate roomUtils functions in Node
    const GENERIC_TYPES = new Set([
      'classroom', 'smart classroom', 'lecture hall', 'storage room', 'washroom',
      'gents washroom', 'ladies washroom', 'staff room', 'office', 'unspecified', 'lab', 'laboratory'
    ]);
    function getRoomDisplayName(room) {
      if (!room) return '';
      if (typeof room === 'string') return room;
      const roomNum = (room.roomNumber || room.id || '').trim();
      if (room.roomName && typeof room.roomName === 'string') {
        const trimmed = room.roomName.trim();
        if (trimmed && trimmed.toLowerCase() !== roomNum.toLowerCase()) return trimmed;
      }
      if (room.name && typeof room.name === 'string') {
        const trimmed = room.name.trim();
        if (trimmed && trimmed.toLowerCase() !== roomNum.toLowerCase()) return trimmed;
      }
      if (room.roomType && typeof room.roomType === 'string') {
        const trimmed = room.roomType.trim();
        if (!GENERIC_TYPES.has(trimmed.toLowerCase())) return trimmed;
      }
      if (room.roomType && typeof room.roomType === 'string' && room.roomType.trim()) {
        return room.roomType.trim();
      }
      return roomNum ? `Room ${roomNum}` : 'Room';
    }

    assert(getRoomDisplayName({ roomNumber: 'C-123', roomType: 'Laboratory', roomName: 'Capgemini Lab' }) === 'Capgemini Lab', 'Resolves explicit roomName: "Capgemini Lab"');
    assert(getRoomDisplayName({ roomNumber: 'C-108', roomType: 'Sir CV Raman Lab' }) === 'Sir CV Raman Lab', 'Resolves specific roomType: "Sir CV Raman Lab"');
    assert(getRoomDisplayName({ roomNumber: 'B-302', roomType: 'Lab', roomName: 'Siddartha Lab' }) === 'Siddartha Lab', 'Resolves explicit roomName over generic "Lab"');
    assert(getRoomDisplayName({ roomNumber: 'C-101', roomType: 'Classroom' }) === 'Classroom', 'Falls back gracefully for generic room type: "Classroom"');
    assert(getRoomDisplayName({ roomNumber: 'C-999' }) === 'Room C-999', 'Falls back gracefully to room number: "Room C-999"');

    console.log('\n================================================================');
    console.log(`TEST SUMMARY: Passed: ${passed} | Failed: ${failed}`);
    console.log('================================================================\n');

    server.close();
    await mongoose.disconnect();

    if (failed > 0) {
      process.exit(1);
    }
  } catch (err) {
    console.error('Test execution error:', err);
    server.close();
    await mongoose.disconnect();
    process.exit(1);
  }
}

runLabNamesVerification();
