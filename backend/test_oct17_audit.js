require('dotenv').config();
const mongoose = require('mongoose');
const aiChatService = require('./services/aiChatService');
const campusDataService = require('./services/campusDataService');
const { resolveDateContext } = require('./utils/dateContext');

async function runAuditTests() {
  console.log('================================================================');
  console.log('UNITWIN APPLICATION-WIDE OCTOBER 17 AUDIT & VERIFICATION SUITE');
  console.log('================================================================\n');

  if (!process.env.MONGODB_URI) {
    console.error('FATAL: MONGODB_URI not found in environment');
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB Atlas\n');

  const db = mongoose.connection.db;
  let allPassed = true;

  // 1. Audit latest timestamps across all collections
  console.log('--- 1. Verification of Actual Database Max Timestamps ---');
  const collections = [
    { name: 'occupancy', dateField: 'timestamp', expectedMaxDay: '2026-10-17' },
    { name: 'alerts', dateField: 'timestamp', expectedMaxDay: '2026-10-17' },
    { name: 'energyUsage', dateField: 'timestamp', expectedMaxDay: '2026-10-16' },
    { name: 'solarGeneration', dateField: 'timestamp', expectedMaxDay: '2026-10-16' },
    { name: 'congestion', dateField: 'timestamp', expectedMaxDay: '2026-10-16' },
    { name: 'maintainence', dateField: 'reportedDate', expectedMaxDay: '2026-10-16' },
    { name: 'Waterusage', dateField: 'timestamp', expectedMaxDay: '2026-10-16' },
  ];

  for (const c of collections) {
    const doc = await db.collection(c.name).find({ [c.dateField]: { $exists: true } }).sort({ [c.dateField]: -1 }).limit(1).toArray();
    const maxDate = doc[0]?.[c.dateField];
    const maxDayStr = maxDate ? new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(maxDate)) : null;
    const matchesExpected = maxDayStr === c.expectedMaxDay;
    console.log(`- Collection ${c.name.padEnd(16)}: Max Date = ${maxDate ? maxDate.toISOString() : 'none'} (IST Day: ${maxDayStr}) | Matches Expected: ${matchesExpected ? '✅' : '❌'}`);
    if (!matchesExpected) allPassed = false;
  }
  console.log('');

  // 2. Test Occupancy Service with Oct 17 Cutoff
  console.log('--- 2. Occupancy Retrieval for Saturday October 17 ---');
  const oct17Cutoff = new Date('2026-10-17T23:59:59.999+05:30');
  const occResOct17 = await campusDataService.getOccupancy({}, { targetCutoff: oct17Cutoff });
  console.log('Occupancy result with Oct 17 cutoff:');
  console.log('  Reporting Period:', occResOct17.reportingPeriod);
  console.log('  Snapshot Timestamp:', occResOct17.snapshotTimestamp);
  console.log('  Monitored Rooms:', occResOct17.monitoredRoomsCount);
  console.log('  Total Headcount:', occResOct17.totalPresentHeadcount);
  console.log('  Average Utilization:', occResOct17.averageUtilizationPct + '%');

  const occOct17Day = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date(occResOct17.snapshotTimestamp));
  if (occOct17Day === '2026-10-17') {
    console.log('✅ TEST 2 PASSED: Occupancy successfully returned Saturday Oct 17 snapshot without being clamped to Oct 16!\n');
  } else {
    console.error('❌ TEST 2 FAILED: Occupancy did not return Oct 17 snapshot. Returned day:', occOct17Day);
    allPassed = false;
  }

  // 3. Test Alerts Service with Oct 17 Cutoff
  console.log('--- 3. Alerts Retrieval for Saturday October 17 ---');
  const alertsResOct17 = await campusDataService.getAlerts({}, { targetCutoff: oct17Cutoff });
  console.log('Alerts result with Oct 17 cutoff:');
  console.log('  Total Active Incidents:', alertsResOct17.totalActiveIncidents);
  console.log('  Severity Breakdown:', alertsResOct17.severityBreakdown);
  console.log('  Recent Alerts count:', alertsResOct17.recentAlerts?.length);
  const foundOct17Alert = alertsResOct17.recentAlerts?.some(a => a.alertId === 'ALT-LIB-20261017-LIB-201-1830');
  console.log('  Found Oct 17 Library Alert:', foundOct17Alert ? 'YES' : 'NO');

  if (alertsResOct17.totalActiveIncidents === 155 && foundOct17Alert) {
    console.log('✅ TEST 3 PASSED: All 155 alerts included and October 17 Library alert present!\n');
  } else {
    console.error('❌ TEST 3 FAILED: Alerts count or October 17 alert missing.');
    allPassed = false;
  }

  // 4. Test AI Chat Query for Saturday October 17 Occupancy
  console.log('--- 4. AI Chat Assistant Grounding for Saturday October 17 ---');
  const chatResOcc = await aiChatService.processChatMessage({
    message: 'What was campus room occupancy on Saturday October 17?',
    pageContext: 'occupancy',
    asOfDate: '2026-10-13T10:00:00+05:30',
  });
  console.log('AI Answer for Saturday Oct 17 Occupancy:\n' + chatResOcc.answer + '\n');
  const mentionsOct17InAnswer = /oct(?:ober)?\s*17/i.test(chatResOcc.answer);
  if (mentionsOct17InAnswer && chatResOcc.temporalScope === 'explicit_future') {
    console.log('✅ TEST 4 PASSED: AI assistant grounded on Saturday October 17 telemetry!\n');
  } else {
    console.error('❌ TEST 4 FAILED: AI assistant failed to ground on Oct 17.');
    allPassed = false;
  }

  // 5. Test AI Chat Query for October 17 Alerts
  console.log('--- 5. AI Chat Assistant Grounding for October 17 Alerts ---');
  const chatResAlert = await aiChatService.processChatMessage({
    message: 'Show any alerts on October 17',
    pageContext: 'alerts',
    asOfDate: '2026-10-13T10:00:00+05:30',
  });
  console.log('AI Answer for October 17 Alerts:\n' + chatResAlert.answer + '\n');
  const mentionsLibraryAlert = /LIB-201|library|ALT-LIB/i.test(chatResAlert.answer);
  if (mentionsLibraryAlert) {
    console.log('✅ TEST 5 PASSED: AI assistant cited the October 17 Library alert!\n');
  } else {
    console.error('❌ TEST 5 FAILED: AI assistant did not cite the Library alert.');
    allPassed = false;
  }

  // 6. Test Multi-Day Baseline Query
  console.log('--- 6. Multi-Day Baseline Recognition (Oct 12–17) ---');
  const chatResMulti = await aiChatService.processChatMessage({
    message: 'Summarize the multi-day pilot monitoring baseline across the entire week',
    pageContext: 'dashboard',
    asOfDate: '2026-10-13T10:00:00+05:30',
  });
  console.log('AI Temporal Scope:', chatResMulti.temporalScope);
  console.log('AI Target Label:', chatResMulti.targetDisplayLabel);
  const mentionsOct1217 = /Oct 12–17|Oct 12.*17/i.test(chatResMulti.notice || chatResMulti.targetDisplayLabel || '');
  if (chatResMulti.temporalScope === 'multi_day_baseline' && mentionsOct1217) {
    console.log('✅ TEST 6 PASSED: Multi-day baseline recognized with Oct 12–17 scope!\n');
  } else {
    console.error('❌ TEST 6 FAILED: Multi-day baseline not properly configured.', {
      scope: chatResMulti.temporalScope,
      notice: chatResMulti.notice,
    });
    allPassed = false;
  }

  // 7. Verify collections ending on Oct 16 handle Oct 17 cutoff gracefully
  console.log('--- 7. Non-Oct-17 Collections Graceful Telemetry Bounding ---');
  const energyRes = await campusDataService.getEnergyAndSolar({}, { targetCutoff: oct17Cutoff });
  console.log('Energy with Oct 17 cutoff:');
  console.log('  Has Records:', energyRes.hasRecords);
  console.log('  Active Power Demand:', energyRes.activePowerDemandKw + ' kW');
  console.log('  Snapshot Timestamp:', energyRes.snapshotTime);
  const energyDay = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date(energyRes.snapshotTime));
  if (energyRes.hasRecords && energyDay === '2026-10-16') {
    console.log('✅ TEST 7 PASSED: Energy gracefully reports legitimate Oct 16 max snapshot without fabricating Oct 17 records!\n');
  } else {
    console.error('❌ TEST 7 FAILED: Energy reporting unexpected snapshot day:', energyDay);
    allPassed = false;
  }

  console.log('================================================================');
  if (allPassed) {
    console.log('🎉 ALL OCTOBER 17 AUDIT TESTS PASSED SUCCESSFULLY!');
  } else {
    console.error('⚠️ SOME TESTS FAILED. PLEASE REVIEW.');
  }
  console.log('================================================================');

  await mongoose.disconnect();
  process.exit(allPassed ? 0 : 1);
}

runAuditTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
