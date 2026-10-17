require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const mongoose = require('mongoose');

const BASE_URL = 'http://127.0.0.1:5001';

async function auditEndpoints() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('MongoDB connected to:', mongoose.connection.db.databaseName);

  const endpoints = [
    { name: 'Buildings', path: '/api/buildings' },
    { name: 'Rooms', path: '/api/rooms' },
    { name: 'Campus Areas', path: '/api/campus-areas' },
    { name: 'Sections', path: '/api/sections' },
    { name: 'Timetables', path: '/api/timetables' },
    { name: 'Alerts', path: '/api/alerts' },
    { name: 'Maintenance', path: '/api/maintenance' },
    { name: 'Occupancy', path: '/api/occupancy' },
    { name: 'Congestion', path: '/api/congestion' },
    { name: 'Energy Usage', path: '/api/energy-usage' },
    { name: 'Solar Generation', path: '/api/solar-generation' },
    { name: 'Insights', path: '/api/insights' },
    { name: 'Search', path: '/api/search?q=lab' },
  ];

  for (const ep of endpoints) {
    console.log(`\n======================================================`);
    console.log(`Testing endpoint: ${ep.name} (${ep.path})`);
    console.log(`======================================================`);
    try {
      const response = await fetch(`${BASE_URL}${ep.path}`);
      console.log(`Status: ${response.status}`);
      if (response.ok) {
        const body = await response.json();
        console.log(`Success: ${body.success}`);
        if (body.count !== undefined) console.log(`Count: ${body.count}`);
        if (body.total !== undefined) console.log(`Total: ${body.total}`);
        if (body.summary) console.log(`Summary:`, JSON.stringify(body.summary, null, 2));

        const sample = Array.isArray(body.data)
          ? body.data.slice(0, 2)
          : Array.isArray(body)
          ? body.slice(0, 2)
          : body;
        console.log(`Sample output (first 2):`, JSON.stringify(sample, null, 2));
      } else {
        console.log(`Error body:`, await response.text());
      }
    } catch (err) {
      console.error(`Request error:`, err.message);
    }
  }

  // Also test AI endpoint
  console.log(`\n======================================================`);
  console.log(`Testing AI endpoint: POST /api/ai`);
  console.log(`======================================================`);
  try {
    const response = await fetch(`${BASE_URL}/api/ai`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: 'What are the current high severity alerts across the campus?',
        pageContext: 'alerts'
      })
    });
    console.log(`Status: ${response.status}`);
    const body = await response.json();
    console.log(`AI Answer:`, body?.answer || body?.response || body);
    console.log(`AI Citations/Sources:`, body?.sources || body?.context);
  } catch (err) {
    console.error(`AI test error:`, err.message);
  }

  await mongoose.disconnect();
  process.exit(0);
}

auditEndpoints().catch(err => {
  console.error(err);
  process.exit(1);
});
