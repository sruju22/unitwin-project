/**
 * Campus Timezone & Temporal Formatting Utilities
 *
 * Configured campus timezone: Asia/Kolkata (IST, UTC+05:30)
 * Ensures 100% consistent date, time, and day boundary calculations across all clients.
 */

export const CAMPUS_TIMEZONE = 'Asia/Kolkata';

/**
 * Safely parse an ISO string, timestamp number, or date-only string (YYYY-MM-DD).
 * Date-only strings are interpreted as start-of-day in Asia/Kolkata (+05:30) to avoid UTC midnight shifting.
 *
 * @param {string|number|Date} input
 * @returns {Date|null}
 */
export function parseCampusDate(input) {
  if (!input) return null;
  if (input instanceof Date) return isNaN(input.getTime()) ? null : input;
  if (typeof input === 'number') {
    const d = new Date(input);
    return isNaN(d.getTime()) ? null : d;
  }
  if (typeof input === 'string') {
    const trimmed = input.trim();
    // Handle date-only "YYYY-MM-DD"
    const match = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (match) {
      const [, y, m, d] = match;
      return new Date(`${y}-${m}-${d}T00:00:00+05:30`);
    }
    const d = new Date(trimmed);
    return isNaN(d.getTime()) ? null : d;
  }
  return null;
}

/**
 * Returns YYYY-MM-DD calendar date key in Asia/Kolkata.
 *
 * @param {string|number|Date} dateOrTimestamp
 * @returns {string} e.g. "2026-10-13"
 */
export function getCampusDayKey(dateOrTimestamp) {
  const d = parseCampusDate(dateOrTimestamp);
  if (!d) return '';
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: CAMPUS_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}

/**
 * Formats date in Asia/Kolkata: e.g. "Oct 13" or "Oct 13, 2026"
 *
 * @param {string|number|Date} dateOrTimestamp
 * @param {Object} [options]
 * @param {boolean} [options.includeYear=false]
 * @param {'short'|'long'|'numeric'} [options.month='short']
 * @returns {string}
 */
export function formatCampusDate(dateOrTimestamp, { includeYear = false, month = 'short' } = {}) {
  const d = parseCampusDate(dateOrTimestamp);
  if (!d) return '';
  const options = {
    timeZone: CAMPUS_TIMEZONE,
    month,
    day: 'numeric',
  };
  if (includeYear) {
    options.year = 'numeric';
  }
  return new Intl.DateTimeFormat('en-US', options).format(d);
}

/**
 * Formats time in Asia/Kolkata: e.g. "09:00 AM IST"
 *
 * @param {string|number|Date} dateOrTimestamp
 * @param {Object} [options]
 * @param {boolean} [options.includeZone=true]
 * @returns {string}
 */
export function formatCampusTime(dateOrTimestamp, { includeZone = true } = {}) {
  const d = parseCampusDate(dateOrTimestamp);
  if (!d) return '';
  const timeStr = new Intl.DateTimeFormat('en-US', {
    timeZone: CAMPUS_TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  }).format(d);
  return includeZone ? `${timeStr} IST` : timeStr;
}

/**
 * Formats combined date & time in Asia/Kolkata: e.g. "Oct 13, 09:00 AM IST"
 */
export function formatCampusDateTime(dateOrTimestamp) {
  const d = parseCampusDate(dateOrTimestamp);
  if (!d) return '';
  const dateStr = formatCampusDate(d);
  const timeStr = formatCampusTime(d);
  return `${dateStr}, ${timeStr}`;
}

/**
 * Returns english ordinal for day number: e.g. 1 -> "1st", 2 -> "2nd", 13 -> "13th"
 */
export function getDayOrdinal(dayNum) {
  const d = Number(dayNum);
  if (d >= 11 && d <= 13) return `${d}th`;
  switch (d % 10) {
    case 1: return `${d}st`;
    case 2: return `${d}nd`;
    case 3: return `${d}rd`;
    default: return `${d}th`;
  }
}
