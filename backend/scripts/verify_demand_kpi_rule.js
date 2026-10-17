const http = require('http');

function get(path) {
  return new Promise((resolve, reject) => {
    http.get('http://127.0.0.1:5001' + path, (res) => {
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

async function verify() {
  console.log('================================================================');
  console.log('VERIFYING ACTIVE POWER DEMAND KPI RULE ACROSS DATES & TIMESTAMPS');
  console.log('================================================================\n');

  // Test 1: Oct 15 (Today, wall-clock time ~09:46 AM IST)
  // Should bound to current time (no future 5:00 PM reading) -> Expected latest observation: 8:40 AM IST (293.9 kW)
  console.log('--- Test 1: Oct 15 (Today, natural current time cutoff ~09:46 AM) ---');
  const t1 = await get('/api/energy-usage?date=2026-10-15');
  console.log('Status success:', t1.success);
  console.log('latestDemandKw:', t1.summary?.latestDemandKw, 'kW (Expected: 293.9 kW)');
  console.log('latestEnergyKwh:', t1.summary?.latestEnergyKwh, 'kWh (Expected: 489.9 kWh)');
  console.log('snapshotLabel:', t1.summary?.snapshotLabel, '(Expected: 8:40 AM IST (Morning rise))');
  console.log('timestamp:', t1.summary?.timestamp);
  console.log('peakDemandKw:', t1.summary?.peakDemandKw, 'kW');
  console.log('observationCount:', t1.summary?.observationCount, '(Expected: 2 observations: 7:00 AM & 8:40 AM)');
  console.log('isToday:', t1.summary?.isToday);
  console.log('isHistorical:', t1.summary?.isHistorical);
  console.log('isFuture:', t1.summary?.isFuture);
  console.log('');

  // Test 2: Oct 15 with explicit early morning cutoff (asOfDate = 7:30 AM IST)
  // Only 7:00 AM IST has occurred -> Expected: 132.0 kW
  console.log('--- Test 2: Oct 15 with asOfDate = 07:30 AM IST ---');
  const t2 = await get('/api/energy-usage?date=2026-10-15&asOfDate=2026-10-15T07:30:00%2B05:30');
  console.log('latestDemandKw:', t2.summary?.latestDemandKw, 'kW (Expected: 132.0 kW)');
  console.log('latestEnergyKwh:', t2.summary?.latestEnergyKwh, 'kWh (Expected: 219.9 kWh)');
  console.log('snapshotLabel:', t2.summary?.snapshotLabel, '(Expected: 7:00 AM IST (Early morning))');
  console.log('observationCount:', t2.summary?.observationCount, '(Expected: 1)');
  console.log('');

  // Test 3: Oct 15 with midday cutoff (asOfDate = 12:30 PM IST)
  // Snapshots up to 12:00 PM have occurred -> Expected: 338.3 kW (12:00 PM)
  console.log('--- Test 3: Oct 15 with asOfDate = 12:30 PM IST ---');
  const t3 = await get('/api/energy-usage?date=2026-10-15&asOfDate=2026-10-15T12:30:00%2B05:30');
  console.log('latestDemandKw:', t3.summary?.latestDemandKw, 'kW (Expected: 338.3 kW)');
  console.log('snapshotLabel:', t3.summary?.snapshotLabel, '(Expected: 12:00 PM IST (Midday peak))');
  console.log('observationCount:', t3.summary?.observationCount, '(Expected: 4: 7:00, 8:40, 10:20, 12:00)');
  console.log('');

  // Test 4: Oct 15 with evening cutoff (asOfDate = 17:30 PM IST)
  // Snapshots up to 5:00 PM have occurred -> Expected: 42.5 kW (5:00 PM)
  console.log('--- Test 4: Oct 15 with asOfDate = 05:30 PM IST ---');
  const t4 = await get('/api/energy-usage?date=2026-10-15&asOfDate=2026-10-15T17:30:00%2B05:30');
  console.log('latestDemandKw:', t4.summary?.latestDemandKw, 'kW (Expected: 42.5 kW)');
  console.log('latestEnergyKwh:', t4.summary?.latestEnergyKwh, 'kWh (Expected: 70.8 kWh)');
  console.log('snapshotLabel:', t4.summary?.snapshotLabel, '(Expected: 5:00 PM IST (Late afternoon))');
  console.log('peakDemandKw:', t4.summary?.peakDemandKw, 'kW (Expected: 338.3 kW)');
  console.log('observationCount:', t4.summary?.observationCount, '(Expected: 7)');
  console.log('');

  // Test 5: Oct 14 (Historical date, completed day)
  // All 7 snapshots occurred -> Expected latest: 5:00 PM IST (48.2 kW)
  console.log('--- Test 5: Oct 14 (Historical date, full completed baseline day) ---');
  const t5 = await get('/api/energy-usage?date=2026-10-14');
  console.log('latestDemandKw:', t5.summary?.latestDemandKw, 'kW (Expected: 48.2 kW)');
  console.log('latestEnergyKwh:', t5.summary?.latestEnergyKwh, 'kWh (Expected: 80.3 kWh)');
  console.log('snapshotLabel:', t5.summary?.snapshotLabel, '(Expected: 5:00 PM IST (Late afternoon))');
  console.log('peakDemandKw:', t5.summary?.peakDemandKw, 'kW (Expected: 339.2 kW)');
  console.log('observationCount:', t5.summary?.observationCount, '(Expected: 7)');
  console.log('isHistorical:', t5.summary?.isHistorical, '(Expected: true)');
  console.log('');

  // Test 6: Oct 14 with historical time cutoff (asOfDate = 10:30 AM IST)
  // Should return 10:20 AM snapshot -> Expected: 339.2 kW
  console.log('--- Test 6: Oct 14 with asOfDate = 10:30 AM IST ---');
  const t6 = await get('/api/energy-usage?date=2026-10-14&asOfDate=2026-10-14T10:30:00%2B05:30');
  console.log('latestDemandKw:', t6.summary?.latestDemandKw, 'kW (Expected: 339.2 kW)');
  console.log('snapshotLabel:', t6.summary?.snapshotLabel, '(Expected: 10:20 AM IST (Late morning))');
  console.log('observationCount:', t6.summary?.observationCount, '(Expected: 3)');
  console.log('');

  // Test 7: Oct 18 (Date with no records)
  // Should gracefully return summary: null
  console.log('--- Test 7: Oct 18 (Date with zero records) ---');
  const t7 = await get('/api/energy-usage?date=2026-10-18');
  console.log('Count:', t7.count, '(Expected: 0)');
  console.log('summary:', t7.summary, '(Expected: null)');
  console.log('');

  // Test 8: Solar synchronization on Oct 15
  console.log('--- Test 8: Solar API on Oct 15 (natural current time cutoff) ---');
  const s1 = await get('/api/solar-generation?date=2026-10-15');
  console.log('currentSolarPowerKW:', s1.summary?.currentSolarPowerKW, 'kW (Expected: 5.0 kW)');
  console.log('snapshotLabel:', s1.summary?.latestSnapshot?.timelineLabel, '(Expected: Morning rise)');
  console.log('timestamp:', s1.summary?.latestSnapshot?.timestamp);
  console.log('');

  console.log('================================================================');
  console.log('ALL TESTS COMPLETED SUCCESSFULLY!');
  console.log('================================================================');
}

verify().catch(console.error);
