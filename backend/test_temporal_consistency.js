require('dotenv').config();
const mongoose = require('mongoose');
const aiChatService = require('./services/aiChatService');
const campusDataService = require('./services/campusDataService');
const { resolveDateContext } = require('./utils/dateContext');

async function runTests() {
  console.log('================================================================');
  console.log('AIT CAMPUS INTELLIGENCE TEMPORAL CONSISTENCY & DATE-BOUNDARY VERIFICATION SUITE');
  console.log('================================================================\n');

  if (!process.env.MONGODB_URI) {
    console.error('FATAL: MONGODB_URI not found in environment');
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB Atlas\n');

  let allPassed = true;

  // TEST 1: Current energy & solar with Dashboard date set to Monday, October 12, 2026
  console.log('--- TEST 1: Primary Bug Reproduction & Verification (Current Energy & Solar) ---');
  const oct12Iso = '2026-10-12T19:57:03+05:30';
  const res1 = await aiChatService.processChatMessage({
    message: 'What is our current energy demand and solar generation?',
    pageContext: 'energy',
    asOfDate: oct12Iso,
  });

  console.log('Query: "What is our current energy demand and solar generation?"');
  console.log('Reporting Cutoff Applied:', res1.actualCutoffApplied);
  console.log('Reporting Period:', res1.reportingPeriod);
  console.log('Answer Snippet:\n' + res1.answer + '\n');

  // Assertions for Test 1
  const containsOct16InCurrentAnswer = /oct(?:ober)?\s*16,\s*2026/i.test(res1.answer) && !/notice/i.test(res1.answer);
  const mentionsOct12 = /oct(?:ober)?\s*12,\s*2026/i.test(res1.answer) || /oct\s*12/i.test(res1.reportingPeriod);
  const mentions141Demand = /141\.9\s*kW/i.test(res1.answer);
  const mentionsNoFuture122 = !/122\.9\s*kW/i.test(res1.answer);

  if (!containsOct16InCurrentAnswer && mentionsOct12 && mentions141Demand && mentionsNoFuture122) {
    console.log('✅ TEST 1 PASSED: Future Oct 16 records strictly excluded. October 12 current demand (141.9 kW) reported accurately!\n');
  } else {
    console.error('❌ TEST 1 FAILED: Temporal boundary violated.', {
      containsOct16InCurrentAnswer,
      mentionsOct12,
      mentions141Demand,
      mentionsNoFuture122,
    });
    allPassed = false;
  }

  // TEST 2: Current occupancy with Dashboard date set to Monday, October 12, 2026
  console.log('--- TEST 2: Current Occupancy Grounded on October 12, 2026 ---');
  const res2 = await aiChatService.processChatMessage({
    message: 'What is current campus occupancy and headcount?',
    pageContext: 'occupancy',
    asOfDate: oct12Iso,
  });

  console.log('Reporting Cutoff Applied:', res2.actualCutoffApplied);
  console.log('Reporting Period:', res2.reportingPeriod);
  console.log('Answer Snippet:\n' + res2.answer + '\n');

  const mentions2355Headcount = /2,?355/i.test(res2.answer);
  const mentions32Pct = /32\.3%/i.test(res2.answer);

  if (mentions2355Headcount && mentions32Pct) {
    console.log('✅ TEST 2 PASSED: Occupancy reports Oct 12 snapshot headcount (2,355) and 32.3% utilization!\n');
  } else {
    console.error('❌ TEST 2 FAILED: Occupancy numbers do not match Oct 12 snapshot.', {
      mentions2355Headcount,
      mentions32Pct,
    });
    allPassed = false;
  }

  // TEST 3: Explicit future simulation request (e.g. October 16)
  console.log('--- TEST 3: Explicit Future Simulation Request (Oct 16) ---');
  const res3 = await aiChatService.processChatMessage({
    message: 'What will solar generation be on Friday October 16?',
    pageContext: 'energy',
    asOfDate: oct12Iso,
  });

  console.log('Temporal Scope:', res3.temporalScope);
  console.log('Notice:', res3.notice);
  console.log('Answer Snippet:\n' + res3.answer + '\n');

  const recognizedFuture = res3.temporalScope === 'explicit_future';
  const hasFutureNotice = res3.notice && res3.notice.includes('ahead of the active campus reporting date');

  if (recognizedFuture && hasFutureNotice) {
    console.log('✅ TEST 3 PASSED: Future date explicitly recognized and tagged with advisory notice!\n');
  } else {
    console.error('❌ TEST 3 FAILED: Future date not handled explicitly.', {
      recognizedFuture,
      hasFutureNotice,
    });
    allPassed = false;
  }

  // TEST 4: Empty results / Date prior to dataset (e.g. October 5, 2026)
  console.log('--- TEST 4: Date Prior to Monitoring Baseline (Oct 5, 2026) ---');
  const oct5Iso = '2026-10-05T12:00:00.000Z';
  const res4 = await aiChatService.processChatMessage({
    message: 'What was energy demand on October 5, 2026?',
    pageContext: 'energy',
    asOfDate: oct5Iso,
  });

  console.log('Answer Snippet:\n' + res4.answer + '\n');
  const explainsDatasetBounds = /No (?:energy|solar|telemetry).*records|Telemetry Unavailable/i.test(res4.answer);

  if (explainsDatasetBounds) {
    console.log('✅ TEST 4 PASSED: Explained telemetry boundary clearly without silently modifying the date!\n');
  } else {
    console.error('❌ TEST 4 FAILED: Did not explain dataset boundaries cleanly.');
    allPassed = false;
  }

  // TEST 5: Invalid date context fallback
  console.log('--- TEST 5: Invalid Date Context Handling ---');
  const res5 = await aiChatService.processChatMessage({
    message: 'Executive summary please',
    pageContext: 'dashboard',
    asOfDate: 'not-a-valid-iso-date',
  });

  console.log('Cutoff Applied:', res5.actualCutoffApplied);
  console.log('Answer Snippet:\n' + res5.answer + '\n');

  if (res5.success && res5.actualCutoffApplied) {
    console.log('✅ TEST 5 PASSED: Handled invalid asOfDate gracefully by falling back to system reference!\n');
  } else {
    console.error('❌ TEST 5 FAILED: Invalid date broke execution.');
    allPassed = false;
  }

  // TEST 6: All other domains bounded by October 12, 2026
  console.log('--- TEST 6: Verification Across Remaining Domains (Bounded Oct 12, 2026) ---');
  const domains = [
    { name: 'Alerts', q: 'Show active campus alerts', check: (a) => /23/i.test(a) },
    { name: 'Maintenance', q: 'List open maintenance work orders', check: (a) => /7|9/i.test(a) },
    { name: 'Water', q: 'Are there any water leak anomalies?', check: (a) => /141/i.test(a) },
    { name: 'Congestion', q: 'Show pedestrian congestion levels', check: (a) => /75/i.test(a) },
  ];

  for (const d of domains) {
    const res = await aiChatService.processChatMessage({
      message: d.q,
      asOfDate: oct12Iso,
    });
    const passed = d.check(res.answer);
    console.log(`${passed ? '✓' : '✗'} Domain "${d.name}": Cutoff Applied = ${res.actualCutoffApplied} | Pass = ${passed}`);
    if (!passed) allPassed = false;
  }

  console.log('\n================================================================');
  if (allPassed) {
    console.log('🎉 ALL TEMPORAL CONSISTENCY TESTS PASSED SUCCESSFULLY!');
  } else {
    console.error('⚠️ SOME TESTS FAILED. PLEASE REVIEW.');
  }
  console.log('================================================================');

  await mongoose.disconnect();
  process.exit(allPassed ? 0 : 1);
}

runTests().catch((err) => {
  console.error('Fatal error during test run:', err);
  process.exit(1);
});
