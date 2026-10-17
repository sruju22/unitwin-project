require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const mongoose = require('mongoose');
const { getEnergyAndPower } = require('../services/campusDataService');
const { resolveDateContext } = require('../utils/dateContext');

async function test() {
  await mongoose.connect(process.env.MONGODB_URI);

  console.log('Testing campusDataService.getEnergyAndPower (default):');
  const res1 = await getEnergyAndPower({});
  console.log('Latest snapshot time:', res1.snapshotTime);
  console.log('Latest snapshot label:', res1.snapshotLabel);
  console.log('Active demand kW:', res1.activePowerDemandKw);
  console.log('Solar active power kW:', res1.solarActivePowerKw);
  console.log('Day energy consumed kWh:', res1.dayEnergyConsumedKWh);
  console.log('Day solar yield kWh:', res1.daySolarYieldKWh);
  console.log('Cumulative energy consumed kWh:', res1.cumulativeEnergyConsumedKWh);
  console.log('Total solar yield kWh:', res1.totalSolarYieldKWh);

  console.log('\nTesting campusDataService.getEnergyAndPower for Oct 16:');
  const ctxOct16 = resolveDateContext({ message: 'Oct 16' });
  const resOct16 = await getEnergyAndPower({}, ctxOct16);
  console.log('Oct 16 snapshot time:', resOct16.snapshotTime);
  console.log('Oct 16 snapshot label:', resOct16.snapshotLabel);
  console.log('Oct 16 active demand kW:', resOct16.activePowerDemandKw);
  console.log('Oct 16 solar active power kW:', resOct16.solarActivePowerKw);

  await mongoose.disconnect();
}

test().catch(console.error);
