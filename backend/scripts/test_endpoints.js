const http = require('http');

function get(path) {
  return new Promise((resolve, reject) => {
    http.get(`http://127.0.0.1:5001${path}`, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          resolve(data);
        }
      });
    }).on('error', reject);
  });
}

async function test() {
  console.log('Testing GET /api/energy-usage:');
  const energy = await get('/api/energy-usage');
  console.log('Success:', energy.success);
  console.log('Total records count in response:', energy.count);
  console.log('Summary reportingPeriod:', energy.summary?.reportingPeriod);
  console.log('Summary latest timestamp:', energy.summary?.timestamp);
  console.log('Summary snapshotLabel:', energy.summary?.snapshotLabel);
  console.log('Summary timeline length:', energy.summary?.timeline?.length);
  if (energy.summary?.timeline?.length) {
    console.log('First timeline point:', energy.summary.timeline[0]);
    console.log('Last 5 timeline points:');
    energy.summary.timeline.slice(-5).forEach(p => console.log(' ', p.timestamp, p.snapshotLabel, 'Demand:', p.demandKw, 'Solar:', p.solarKw));
  }

  console.log('\nTesting GET /api/solar-generation:');
  const solar = await get('/api/solar-generation');
  console.log('Success:', solar.success);
  console.log('Total records count in response:', solar.count);
  console.log('Summary latest timestamp:', solar.summary?.latestReadingTimestamp);
  console.log('Summary intervalTimeline length:', solar.summary?.intervalTimeline?.length);
  if (solar.summary?.intervalTimeline?.length) {
    console.log('First interval point:', solar.summary.intervalTimeline[0]);
    console.log('Last 5 interval points:');
    solar.summary.intervalTimeline.slice(-5).forEach(p => console.log(' ', p.timestamp, p.timelineLabel, 'totalKWh:', p.totalKWh, 'estimatedKW:', p.estimatedKW));
  }
}

test().catch(console.error);
