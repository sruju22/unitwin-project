/**
 * AIT Campus Intelligence - Solar Photovoltaic Simulation & Analytics Service
 * 
 * Provides a physically grounded, configurable solar diurnal simulation model
 * for demonstration when physical campus solar panel technical specifications
 * (wattage, orientation, installed capacity, live sensor measurements) are unverified.
 * 
 * Key Principles:
 * 1. Configurable simulation assumptions via environment variables with sensible defaults.
 * 2. Plausible diurnal curve: 0 kW at night, rise at dawn, peak around solar noon, decline at sunset.
 * 3. Instantaneous power (kW) strictly capped by assumed installed capacity (kWp).
 * 4. Energy (kWh) calculated via interval/trapezoidal integration over elapsed time, never by summing kW.
 * 5. Safe, non-negative net grid import: Net = max(0, Demand - Solar).
 * 6. Explicit simulation disclosure and provenance metadata.
 */

const DEFAULT_PANEL_COUNT = 50;
const DEFAULT_PANEL_RATING_WATTS = 400; // 400W per monocrystalline module
const DEFAULT_SYSTEM_LOSS_FACTOR = 0.14; // 14% system losses (inverter, wiring, temperature, soiling)
const DEFAULT_CAMPUS_TIMEZONE = 'Asia/Kolkata'; // Standard Indian Campus Timezone (UTC+5:30)

/**
 * Retrieve active simulation configuration and assumptions.
 */
function getSimulationConfig() {
  const panelCount = parseInt(process.env.SOLAR_SIM_PANEL_COUNT, 10) || DEFAULT_PANEL_COUNT;
  const panelRatingWatts = parseFloat(process.env.SOLAR_SIM_PANEL_RATING_WATTS) || DEFAULT_PANEL_RATING_WATTS;
  const systemLossFactor = parseFloat(process.env.SOLAR_SIM_SYSTEM_LOSS_FACTOR) || DEFAULT_SYSTEM_LOSS_FACTOR;
  const timezone = process.env.SOLAR_SIM_TIMEZONE || DEFAULT_CAMPUS_TIMEZONE;

  const panelCapacityKW = Number((panelRatingWatts / 1000).toFixed(3));
  const totalCapacityKW = Number(((panelCount * panelRatingWatts) / 1000).toFixed(2));
  const maxAchievablePowerKW = Number((totalCapacityKW * (1 - systemLossFactor)).toFixed(2));

  return {
    isSimulation: true,
    simulationStatus: 'Simulated Solar Telemetry',
    disclaimer: 'Campus solar panel wattage, installed capacity, and technical specifications are unverified demonstration assumptions; telemetry is generated via configurable diurnal simulation.',
    assumedPanelCount: panelCount,
    assumedPanelRatingWatts: panelRatingWatts,
    assumedPanelCapacityKW: panelCapacityKW,
    assumedInstalledCapacityKW: totalCapacityKW,
    assumedSystemLossFactor: systemLossFactor,
    maxAchievablePowerKW,
    effectiveTimezone: timezone,
    arrayLocation: 'Main Building (BLD001) Rooftop Array',
    systemId: 'SOLAR001',
  };
}

/**
 * Deconstruct timestamp into local campus solar time components.
 */
function getCampusSolarTime(dateInput, timezone = DEFAULT_CAMPUS_TIMEZONE) {
  const date = dateInput instanceof Date ? dateInput : new Date(dateInput);
  if (isNaN(date.getTime())) {
    throw new Error(`Invalid date provided to getCampusSolarTime: ${dateInput}`);
  }

  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

  const parts = formatter.formatToParts(date);
  const map = {};
  parts.forEach((p) => {
    map[p.type] = p.value;
  });

  const hour = parseInt(map.hour, 10) % 24;
  const minute = parseInt(map.minute, 10);
  const second = parseInt(map.second, 10);
  const decimalHour = hour + minute / 60 + second / 3600;
  const dateStr = `${map.year}-${map.month}-${map.day}`;

  return {
    date,
    dateStr,
    hour,
    minute,
    second,
    decimalHour,
    timezone,
  };
}

/**
 * Deterministic, smooth atmospheric & cloud modulation factor.
 * Varies gently throughout the day based on date seed to ensure consecutive
 * readings are smooth without erratic jumps.
 */
function getSmoothAtmosphericFactor(dateStr, decimalHour) {
  let hash = 0;
  for (let i = 0; i < dateStr.length; i++) {
    hash = (hash * 31 + dateStr.charCodeAt(i)) & 0xffffff;
  }
  // Base daily clearness index between 0.88 and 0.98
  const baseClearness = 0.88 + ((hash % 100) / 100) * 0.1;
  // Gentle sinusoidal atmospheric wave (period ~4 hours, amplitude ±0.03)
  const atmosphericWave = Math.sin((decimalHour + (hash % 7)) * 0.8) * 0.03;
  return Math.max(0.75, Math.min(1.0, baseClearness + atmosphericWave));
}

/**
 * Calculate instantaneous simulated solar power (kW) for any given timestamp.
 * 
 * Physics principles:
 * - Nighttime: strictly 0 kW before sunrise (~06:05 IST) and after sunset (~18:15 IST).
 * - Daytime: follows solar elevation arc sin(pi * progress)^1.15.
 * - Peaks near solar noon (~12:10–12:20 IST).
 * - Applies derate for system losses (inverter, temperature, wiring).
 * - Strictly capped by assumed total installed capacity (kWp).
 */
function calculateSimulatedSolarPower(timestamp, customConfig = null) {
  const config = customConfig || getSimulationConfig();
  const solarTime = getCampusSolarTime(timestamp, config.effectiveTimezone);
  const { decimalHour, dateStr } = solarTime;

  // Approximate solar daylight boundaries for October in campus region
  const sunriseHour = 6.08; // ~06:05 AM IST
  const sunsetHour = 18.25; // ~06:15 PM IST
  const solarDayDuration = sunsetHour - sunriseHour; // ~12.17 hours

  // Nighttime condition: zero generation
  if (decimalHour < sunriseHour || decimalHour > sunsetHour) {
    return {
      timestamp: solarTime.date.toISOString(),
      localTime: `${String(solarTime.hour).padStart(2, '0')}:${String(solarTime.minute).padStart(2, '0')}`,
      dateStr,
      isDaylight: false,
      solarPowerKW: 0.0,
      sunElevationFactor: 0.0,
      capacityUtilizationPct: 0.0,
      assumedCapacityKW: config.assumedInstalledCapacityKW,
    };
  }

  // Daylight solar elevation curve
  const progress = (decimalHour - sunriseHour) / solarDayDuration; // 0.0 at dawn, 1.0 at dusk
  const sunElevationFactor = Math.pow(Math.sin(Math.PI * progress), 1.15);

  // Atmospheric / cloud modulation
  const atmosphericFactor = getSmoothAtmosphericFactor(dateStr, decimalHour);

  // Derate factor (inverter, temperature, system losses)
  const netDerate = (1 - config.assumedSystemLossFactor) * atmosphericFactor;

  // Raw instantaneous power
  const rawPower = config.assumedInstalledCapacityKW * sunElevationFactor * netDerate;

  // Strictly clamp between 0.0 and assumed total capacity
  const clampedPower = Math.max(0.0, Math.min(config.assumedInstalledCapacityKW, rawPower));
  const solarPowerKW = Number(clampedPower.toFixed(2));
  const capacityUtil = Number(((solarPowerKW / config.assumedInstalledCapacityKW) * 100).toFixed(1));

  return {
    timestamp: solarTime.date.toISOString(),
    localTime: `${String(solarTime.hour).padStart(2, '0')}:${String(solarTime.minute).padStart(2, '0')}`,
    dateStr,
    isDaylight: true,
    solarPowerKW,
    sunElevationFactor: Number(sunElevationFactor.toFixed(3)),
    capacityUtilizationPct: capacityUtil,
    assumedCapacityKW: config.assumedInstalledCapacityKW,
  };
}

/**
 * Generate simulated per-panel breakdown for a given array power output.
 * Models minor module-level variability (e.g. slight mismatch, localized shading)
 * while ensuring sum of panels matches array power within rounding precision.
 */
function getPanelBreakdown(arrayPowerKW, customConfig = null) {
  const config = customConfig || getSimulationConfig();
  const count = config.assumedPanelCount;
  const panelRatingKW = config.assumedPanelCapacityKW;

  if (arrayPowerKW <= 0) {
    return Array.from({ length: count }, (_, i) => ({
      panelId: `SOLAR-P${String(i + 1).padStart(2, '0')}`,
      panelNumber: i + 1,
      powerKW: 0.0,
      assumedCapacityKW: panelRatingKW,
      status: 'Standby (Night)',
    }));
  }

  const basePerPanel = arrayPowerKW / count;
  return Array.from({ length: count }, (_, i) => {
    // Subtle physical variability (±2%)
    const variation = 1 + Math.sin(i * 1.3) * 0.02;
    const pPower = Math.max(0, Math.min(panelRatingKW, Number((basePerPanel * variation).toFixed(3))));
    return {
      panelId: `SOLAR-P${String(i + 1).padStart(2, '0')}`,
      panelNumber: i + 1,
      powerKW: pPower,
      assumedCapacityKW: panelRatingKW,
      status: 'Generating (Online)',
    };
  });
}

/**
 * Calculate power (kW) from an interval energy reading (kWh) over elapsed time.
 * P (kW) = E (kWh) / elapsedHours, clamped by assumed capacity.
 */
function calculatePowerFromIntervalEnergy(energyKWh, elapsedHours = 2.5, customConfig = null) {
  const config = customConfig || getSimulationConfig();
  if (typeof energyKWh !== 'number' || energyKWh <= 0 || elapsedHours <= 0) {
    return 0.0;
  }
  const derivedPower = energyKWh / elapsedHours;
  return Number(Math.max(0, Math.min(config.assumedInstalledCapacityKW, derivedPower)).toFixed(2));
}

/**
 * Integrate accumulated solar energy (kWh) from a sequence of power readings (kW)
 * using the trapezoidal rule over elapsed time:
 * Delta E = ((P1 + P2) / 2) * Delta t (hours).
 * 
 * Safely handles missing, out-of-order, or duplicate timestamps.
 */
function integrateEnergyKWh(readings) {
  if (!Array.isArray(readings) || readings.length === 0) return 0.0;

  // Extract and normalize { timestampMs, powerKW }
  const validPoints = readings
    .map((r) => {
      const ts = new Date(r.timestamp || r.time).getTime();
      const p = typeof r.powerKW === 'number' ? r.powerKW : (typeof r.solarKw === 'number' ? r.solarKw : 0);
      return { timestampMs: ts, powerKW: Math.max(0, p) };
    })
    .filter((r) => !isNaN(r.timestampMs))
    .sort((a, b) => a.timestampMs - b.timestampMs);

  if (validPoints.length === 0) return 0.0;
  if (validPoints.length === 1) return 0.0;

  // Deduplicate timestamps by averaging power
  const deduplicated = [];
  for (let i = 0; i < validPoints.length; i++) {
    const cur = validPoints[i];
    if (deduplicated.length > 0 && deduplicated[deduplicated.length - 1].timestampMs === cur.timestampMs) {
      const prev = deduplicated[deduplicated.length - 1];
      prev.powerKW = (prev.powerKW + cur.powerKW) / 2;
    } else {
      deduplicated.push({ ...cur });
    }
  }

  let accumulatedKWh = 0.0;
  for (let i = 1; i < deduplicated.length; i++) {
    const pPrev = deduplicated[i - 1];
    const pCurr = deduplicated[i];
    const dtHours = (pCurr.timestampMs - pPrev.timestampMs) / (1000 * 60 * 60);

    if (dtHours <= 0) continue;

    // Cap excessive interval gaps (e.g. overnight gaps > 14 hours) to avoid artificial inflation
    const effectiveDt = Math.min(dtHours, 14.0);
    const avgPower = (pPrev.powerKW + pCurr.powerKW) / 2;
    accumulatedKWh += avgPower * effectiveDt;
  }

  return Number(accumulatedKWh.toFixed(2));
}

/**
 * Calculate net grid import and solar offset safely.
 * Net Import (kW) = max(0, Demand - Solar)
 * Grid Export (kW) = max(0, Solar - Demand)
 * Solar Offset (%) = Demand > 0 ? (Solar / Demand) * 100 : 0
 */
function calculateNetGridBalance(demandKW, solarPowerKW) {
  const safeDemand = Math.max(0, Number(demandKW) || 0);
  const safeSolar = Math.max(0, Number(solarPowerKW) || 0);
  const netImportKW = Number(Math.max(0, safeDemand - safeSolar).toFixed(1));
  const gridExportKW = Number(Math.max(0, safeSolar - safeDemand).toFixed(1));
  const solarOffsetPct = safeDemand > 0
    ? Number(Math.min(100, (safeSolar / safeDemand) * 100).toFixed(1))
    : 0;
  const rawSolarOffsetPct = safeDemand > 0
    ? Number(((safeSolar / safeDemand) * 100).toFixed(1))
    : (safeSolar > 0 ? 100 : 0);

  return {
    demandKW: Number(safeDemand.toFixed(1)),
    solarPowerKW: Number(safeSolar.toFixed(2)),
    netImportKW,
    gridExportKW,
    solarOffsetPct,
    rawSolarOffsetPct,
  };
}

module.exports = {
  getSimulationConfig,
  getCampusSolarTime,
  calculateSimulatedSolarPower,
  getPanelBreakdown,
  calculatePowerFromIntervalEnergy,
  integrateEnergyKWh,
  calculateNetGridBalance,
};
