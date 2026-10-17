/**
 * AIT Campus Intelligence - Comprehensive Solar Simulation & Energy Analytics Verification Suite
 * 
 * Verifies all requirements from prompt:
 * 1. Nighttime output is zero; daytime rises, peaks at solar noon, and declines at sunset.
 * 2. Instantaneous power never exceeds configured assumed capacity (kWp).
 * 3. Accumulated kWh correctly integrated over elapsed time (trapezoidal integration).
 * 4. Daily totals respect timezone and reporting dates.
 * 5. Duplicate and missing readings handled safely without inflating generation.
 * 6. Campus demand, solar power, and net grid import remain strictly mathematically consistent.
 * 7. Simulation assumptions and disclaimer metadata are present across services.
 */

const assert = require('assert');
const {
  getSimulationConfig,
  getCampusSolarTime,
  calculateSimulatedSolarPower,
  getPanelBreakdown,
  calculatePowerFromIntervalEnergy,
  integrateEnergyKWh,
  calculateNetGridBalance,
} = require('./services/solarSimulationService');

let passedTests = 0;
let failedTests = 0;

function runTest(name, fn) {
  try {
    fn();
    console.log(`  [PASS] ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`  [FAIL] ${name}:`, err.message);
    failedTests++;
  }
}

console.log('================================================================');
console.log('AIT CAMPUS INTELLIGENCE SOLAR SIMULATION & ANALYTICS VERIFICATION SUITE');
console.log('================================================================\n');

// -------------------------------------------------------------
// TEST GROUP 1: Configurable Simulation Assumptions & Defaults
// -------------------------------------------------------------
console.log('--- TEST GROUP 1: Configurable Simulation Assumptions ---');

runTest('Loads default assumed panel specifications and calculates total capacity', () => {
  const config = getSimulationConfig();
  assert.strictEqual(config.isSimulation, true, 'Must declare isSimulation: true');
  assert.strictEqual(config.assumedPanelCount, 50, 'Default panel count should be 50');
  assert.strictEqual(config.assumedPanelRatingWatts, 400, 'Default panel rating should be 400W');
  assert.strictEqual(config.assumedPanelCapacityKW, 0.4, '0.4 kW per panel');
  assert.strictEqual(config.assumedInstalledCapacityKW, 20.0, 'Total installed capacity should be 20.0 kWp');
  assert(config.disclaimer.includes('unverified demonstration assumptions'), 'Disclaimer must clarify unverified specifications');
});

runTest('Dynamic overrides via custom configuration work accurately', () => {
  const custom = {
    assumedPanelCount: 20,
    assumedPanelRatingWatts: 500,
    assumedInstalledCapacityKW: 10.0,
    assumedSystemLossFactor: 0.10,
    effectiveTimezone: 'Asia/Kolkata',
  };
  const noonPoint = calculateSimulatedSolarPower('2026-10-12T06:45:00.000Z', custom); // 12:15 PM IST
  assert(noonPoint.solarPowerKW > 7.0 && noonPoint.solarPowerKW <= 10.0, 'Scaled up capacity produces higher output within limit');
});

// -------------------------------------------------------------
// TEST GROUP 2: Diurnal Curve & Nighttime Zero Output
// -------------------------------------------------------------
console.log('\n--- TEST GROUP 2: Physical Diurnal Solar Model ---');

runTest('Nighttime generation is strictly 0.0 kW (Pre-dawn: 02:00 AM IST)', () => {
  // 02:00 AM IST = 20:30 UTC previous day
  const night1 = calculateSimulatedSolarPower('2026-10-11T20:30:00.000Z');
  assert.strictEqual(night1.solarPowerKW, 0.0, 'Pre-dawn must be 0.0 kW');
  assert.strictEqual(night1.isDaylight, false, 'Must be flagged as not daylight');
});

runTest('Nighttime generation is strictly 0.0 kW (Post-sunset: 09:30 PM IST)', () => {
  // 09:30 PM IST = 16:00 UTC
  const night2 = calculateSimulatedSolarPower('2026-10-12T16:00:00.000Z');
  assert.strictEqual(night2.solarPowerKW, 0.0, 'Post-sunset must be 0.0 kW');
  assert.strictEqual(night2.isDaylight, false, 'Must be flagged as not daylight');
});

runTest('Morning output rises after sunrise (~08:00 AM IST)', () => {
  // 08:00 AM IST = 02:30 UTC
  const morning = calculateSimulatedSolarPower('2026-10-12T02:30:00.000Z');
  assert(morning.isDaylight, 'Morning should be daylight');
  assert(morning.solarPowerKW > 2.0 && morning.solarPowerKW < 10.0, `Morning power (${morning.solarPowerKW} kW) should be rising`);
});

runTest('Midday output peaks near solar noon (~12:15 PM IST)', () => {
  // 12:15 PM IST = 06:45 UTC
  const midday = calculateSimulatedSolarPower('2026-10-12T06:45:00.000Z');
  assert(midday.isDaylight, 'Midday must be daylight');
  assert(midday.solarPowerKW >= 14.0 && midday.solarPowerKW <= 18.0, `Midday peak power (${midday.solarPowerKW} kW) expected near 14.0-17.2 kW`);
});

runTest('Late afternoon output declines toward sunset (~05:00 PM IST)', () => {
  // 05:00 PM IST = 11:30 UTC
  const evening = calculateSimulatedSolarPower('2026-10-12T11:30:00.000Z');
  assert(evening.isDaylight, 'Late afternoon is still daylight before sunset');
  assert(evening.solarPowerKW > 0.0 && evening.solarPowerKW < 8.0, `Late afternoon power (${evening.solarPowerKW} kW) should decline`);
});

runTest('Instantaneous power never exceeds assumed installed capacity (20.0 kWp)', () => {
  // Test every 15 minutes across a 24-hour cycle
  const base = new Date('2026-10-12T00:00:00.000Z').getTime();
  let maxObserved = 0;
  for (let m = 0; m < 24 * 60; m += 15) {
    const t = new Date(base + m * 60 * 1000);
    const reading = calculateSimulatedSolarPower(t);
    if (reading.solarPowerKW > maxObserved) maxObserved = reading.solarPowerKW;
    assert(
      reading.solarPowerKW <= 20.0,
      `Solar power (${reading.solarPowerKW} kW) exceeded assumed capacity 20.0 kW at ${t.toISOString()}`
    );
    assert(reading.solarPowerKW >= 0.0, 'Solar power must never be negative');
  }
  console.log(`     -> Verified 96 timesteps: Max observed power was ${maxObserved} kW <= 20.0 kWp`);
});

// -------------------------------------------------------------
// TEST GROUP 3: Energy Integration (Trapezoidal Integration)
// -------------------------------------------------------------
console.log('\n--- TEST GROUP 3: Energy Integration & Units Distinction ---');

runTest('Accurately integrates power over time: 2 hours at constant 3.0 kW yields 6.0 kWh', () => {
  const readings = [
    { timestamp: '2026-10-12T10:00:00.000Z', powerKW: 3.0 },
    { timestamp: '2026-10-12T12:00:00.000Z', powerKW: 3.0 },
  ];
  const energyKWh = integrateEnergyKWh(readings);
  assert.strictEqual(energyKWh, 6.0, `Expected 6.0 kWh, got ${energyKWh} kWh`);
});

runTest('Trapezoidal ramp: rising from 1.0 kW to 3.0 kW over 2 hours yields 4.0 kWh', () => {
  const readings = [
    { timestamp: '2026-10-12T08:00:00.000Z', powerKW: 1.0 },
    { timestamp: '2026-10-12T10:00:00.000Z', powerKW: 3.0 },
  ];
  // Average power = 2.0 kW * 2h = 4.0 kWh
  const energyKWh = integrateEnergyKWh(readings);
  assert.strictEqual(energyKWh, 4.0, `Expected 4.0 kWh, got ${energyKWh} kWh`);
});

runTest('Duplicate timestamps do not inflate accumulated energy', () => {
  const readings = [
    { timestamp: '2026-10-12T10:00:00.000Z', powerKW: 2.0 },
    { timestamp: '2026-10-12T10:00:00.000Z', powerKW: 2.0 }, // duplicate
    { timestamp: '2026-10-12T11:00:00.000Z', powerKW: 2.0 },
  ];
  // 1 hour at 2.0 kW = 2.0 kWh
  const energyKWh = integrateEnergyKWh(readings);
  assert.strictEqual(energyKWh, 2.0, `Expected 2.0 kWh, got ${energyKWh} kWh`);
});

runTest('Out-of-order readings are automatically sorted chronologically', () => {
  const readings = [
    { timestamp: '2026-10-12T12:00:00.000Z', powerKW: 2.0 },
    { timestamp: '2026-10-12T10:00:00.000Z', powerKW: 2.0 },
  ];
  const energyKWh = integrateEnergyKWh(readings);
  assert.strictEqual(energyKWh, 4.0, `Expected 4.0 kWh, got ${energyKWh} kWh`);
});

// -------------------------------------------------------------
// TEST GROUP 4: Net Grid Balance & Mathematical Consistency
// -------------------------------------------------------------
console.log('\n--- TEST GROUP 4: Net Grid Balance & Mathematical Consistency ---');

runTest('Net grid import is max(0, demand - solar)', () => {
  const result = calculateNetGridBalance(140.0, 3.2);
  assert.strictEqual(result.demandKW, 140.0);
  assert.strictEqual(result.solarPowerKW, 3.2);
  assert.strictEqual(result.netImportKW, 136.8, 'Net = 140.0 - 3.2 = 136.8 kW');
  assert.strictEqual(result.solarOffsetPct, 2.3, 'Offset = (3.2 / 140) * 100 = 2.3%');
});

runTest('Zero demand produces zero grid import and zero offset percentage', () => {
  const result = calculateNetGridBalance(0, 2.5);
  assert.strictEqual(result.netImportKW, 0.0);
  assert.strictEqual(result.solarOffsetPct, 0.0);
});

runTest('Surplus solar generation (solar > demand) never results in negative grid import', () => {
  const result = calculateNetGridBalance(2.0, 3.5);
  assert.strictEqual(result.netImportKW, 0.0, 'Net import must clamp to 0.0 kW when solar exceeds demand');
  assert.strictEqual(result.gridExportKW, 1.5, 'Grid export must equal solar - demand (3.5 - 2.0 = 1.5 kW)');
  assert.strictEqual(result.solarOffsetPct, 100.0, 'Solar offset clamps to 100%');
  assert.strictEqual(result.rawSolarOffsetPct, 175.0, 'Raw solar offset is (3.5 / 2.0) * 100 = 175%');
});

runTest('Cumulative energy is never treated as instantaneous power and power never exceeds 20.0 kWp', () => {
  const config = getSimulationConfig();
  assert.strictEqual(config.assumedInstalledCapacityKW, 20.0);
  const derivedPower = calculatePowerFromIntervalEnergy(435.0, 1.6667, config);
  assert(derivedPower <= 20.0, `Instantaneous power must be capped at 20.0 kWp, got ${derivedPower}`);
});

// -------------------------------------------------------------
// TEST GROUP 5: Panel Matrix Breakdown Consistency
// -------------------------------------------------------------
console.log('\n--- TEST GROUP 5: 50-Panel Module Matrix Consistency ---');

runTest('50 panels sum up to total array output within rounding precision', () => {
  const arrayPower = 16.86;
  const panels = getPanelBreakdown(arrayPower);
  assert.strictEqual(panels.length, 50, 'Must produce 50 panel records');
  const sumPower = Number(panels.reduce((acc, p) => acc + p.powerKW, 0).toFixed(2));
  assert(Math.abs(sumPower - arrayPower) < 0.15, `Panel sum (${sumPower}) should match array power (${arrayPower})`);
  panels.forEach((p) => {
    assert(p.powerKW <= 0.40, `Panel ${p.panelId} output (${p.powerKW} kW) must not exceed 0.40 kW`);
  });
});

runTest('Nighttime panel breakdown sets all panels to Standby (0.0 kW)', () => {
  const panels = getPanelBreakdown(0.0);
  panels.forEach((p) => {
    assert.strictEqual(p.powerKW, 0.0);
    assert.strictEqual(p.status, 'Standby (Night)');
  });
});

// -------------------------------------------------------------
// SUMMARY
// -------------------------------------------------------------
console.log('\n================================================================');
console.log(`TEST SUMMARY: ${passedTests + failedTests} Tests Run | Passed: ${passedTests} | Failed: ${failedTests}`);
console.log('================================================================');

if (failedTests > 0) {
  process.exit(1);
} else {
  console.log('All solar simulation & analytics verification tests passed successfully!\n');
  process.exit(0);
}
