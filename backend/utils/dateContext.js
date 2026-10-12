/**
 * Unitwin Date Context & Reference Time Service
 *
 * Enforces one consistent temporal policy across Dashboard metrics and AI chatbot queries:
 * 1. Establishes the reporting reference time (from client asOfDate or system current time).
 * 2. Strictly bounds current/latest data queries to records timestamped on or before the cutoff:
 *    timestamp <= reportingCutoff.
 * 3. Identifies explicit historical, future, or multi-day requests from the user's message.
 * 4. Provides clear provenance notices when future simulations or historical comparisons are requested.
 * 5. Prevents any ungrounded future-dated records from leaking into "current" metrics.
 */

const MONTH_NAMES = {
  jan: 0, january: 0,
  feb: 1, february: 1,
  mar: 2, march: 2,
  apr: 3, april: 3,
  may: 4,
  jun: 5, june: 5,
  jul: 6, july: 6,
  aug: 7, august: 7,
  sep: 8, september: 8,
  oct: 9, october: 9,
  nov: 10, november: 10,
  dec: 11, december: 11,
};

const WEEKDAYS = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
};

/**
 * Format a Date object into a readable institutional string: e.g. "Monday, October 12, 2026"
 */
function formatDisplayDate(date) {
  if (!date || isNaN(date.getTime())) return 'Unknown Date';
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

/**
 * Format timestamp into standard readable time label: e.g. "01:45 PM IST"
 */
function formatDisplayTime(date) {
  if (!date || isNaN(date.getTime())) return '';
  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

/**
 * Resolves the client reporting context and extracts any specific temporal target.
 *
 * @param {Object} options
 * @param {string|Date} [options.asOfDate] - Reporting reference time passed from client
 * @param {string} [options.message] - User inquiry text
 * @returns {DateContext}
 */
function resolveDateContext({ asOfDate, message = '' }) {
  // 1. Establish the base reporting reference time
  let reportingDate;
  if (asOfDate) {
    const parsed = new Date(asOfDate);
    reportingDate = !isNaN(parsed.getTime()) ? parsed : new Date();
  } else {
    reportingDate = new Date();
  }

  const reportingCutoff = new Date(reportingDate.getTime());
  const reportingDateStr = reportingDate.toISOString().split('T')[0];
  const reportingDisplayLabel = formatDisplayDate(reportingDate);

  const text = (message || '').toLowerCase().trim();

  // 2. Detect multi-day baseline requests (e.g. "5-day baseline", "entire week", "weekly total")
  const isMultiDayQuery = /\b(?:5-day|five-day|weekly|across the week|whole week|multi-day|entire dataset|entire week|all days)\b/i.test(text);

  if (isMultiDayQuery) {
    return {
      reportingDate,
      reportingCutoff,
      reportingDateStr,
      reportingDisplayLabel,
      temporalScope: 'multi_day_baseline',
      targetCutoff: reportingCutoff,
      targetDate: null,
      targetDateStr: null,
      targetDisplayLabel: 'Multi-Day Pilot Baseline (Oct 12–16, 2026)',
      isFuture: false,
      isHistorical: false,
      isMultiDay: true,
      notice: 'Aggregated across the multi-day pilot monitoring baseline (Oct 12–16, 2026).',
    };
  }

  // 3. Detect explicit date mentions in the message
  let explicitTargetDate = null;

  // Match month + day: e.g. "Oct 16", "October 16th", "16 Oct", "16th of October"
  const monthDayMatch = text.match(/\b(?:on\s+)?(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+(\d{1,2})(?:st|nd|rd|th)?\b/i) ||
                        text.match(/\b(\d{1,2})(?:st|nd|rd|th)?\s+(?:of\s+)?(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\b/i);

  if (monthDayMatch) {
    let monthStr;
    let dayNum;
    if (isNaN(parseInt(monthDayMatch[1], 10))) {
      monthStr = monthDayMatch[1].toLowerCase();
      dayNum = parseInt(monthDayMatch[2], 10);
    } else {
      dayNum = parseInt(monthDayMatch[1], 10);
      monthStr = monthDayMatch[2].toLowerCase();
    }

    const monthIndex = MONTH_NAMES[monthStr];
    if (monthIndex !== undefined && dayNum >= 1 && dayNum <= 31) {
      const year = reportingDate.getFullYear();
      // Construct date at end of that requested day in local time
      explicitTargetDate = new Date(year, monthIndex, dayNum, 23, 59, 59, 999);
    }
  }

  // Match weekday if specific weekday mentioned and not generic
  if (!explicitTargetDate) {
    const weekdayMatch = text.match(/\b(?:on\s+)?(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i);
    if (weekdayMatch) {
      const targetDayOfWeek = WEEKDAYS[weekdayMatch[1].toLowerCase()];
      const currentDayOfWeek = reportingDate.getDay();
      const dayDiff = targetDayOfWeek - currentDayOfWeek;
      const target = new Date(reportingDate.getTime());
      target.setDate(reportingDate.getDate() + dayDiff);
      target.setHours(23, 59, 59, 999);
      explicitTargetDate = target;
    }
  }

  // Match relative keywords "tomorrow" or "yesterday"
  if (!explicitTargetDate) {
    if (/\btomorrow\b/i.test(text)) {
      const target = new Date(reportingDate.getTime());
      target.setDate(reportingDate.getDate() + 1);
      target.setHours(23, 59, 59, 999);
      explicitTargetDate = target;
    } else if (/\byesterday\b/i.test(text)) {
      const target = new Date(reportingDate.getTime());
      target.setDate(reportingDate.getDate() - 1);
      target.setHours(23, 59, 59, 999);
      explicitTargetDate = target;
    }
  }

  // 4. Resolve temporal relationship if an explicit date was requested
  if (explicitTargetDate) {
    const targetDateStr = explicitTargetDate.toISOString().split('T')[0];
    const targetDisplayLabel = formatDisplayDate(explicitTargetDate);

    // If target date is strictly after reporting cutoff
    if (explicitTargetDate.getTime() > reportingCutoff.getTime() && targetDateStr !== reportingDateStr) {
      return {
        reportingDate,
        reportingCutoff,
        reportingDateStr,
        reportingDisplayLabel,
        temporalScope: 'explicit_future',
        targetCutoff: explicitTargetDate,
        targetDate: explicitTargetDate,
        targetDateStr,
        targetDisplayLabel,
        isFuture: true,
        isHistorical: false,
        isMultiDay: false,
        notice: `Note: ${targetDisplayLabel} is ahead of the active campus reporting date (${reportingDisplayLabel}). Displaying future pilot simulation records from the dataset.`,
      };
    }

    // If target date is before reporting date
    if (targetDateStr < reportingDateStr) {
      return {
        reportingDate,
        reportingCutoff,
        reportingDateStr,
        reportingDisplayLabel,
        temporalScope: 'explicit_historical',
        targetCutoff: explicitTargetDate,
        targetDate: explicitTargetDate,
        targetDateStr,
        targetDisplayLabel,
        isFuture: false,
        isHistorical: true,
        isMultiDay: false,
        notice: `Displaying historical telemetry records for ${targetDisplayLabel}.`,
      };
    }
  }

  // 5. Default: Current status as of the reporting cutoff
  return {
    reportingDate,
    reportingCutoff,
    reportingDateStr,
    reportingDisplayLabel,
    temporalScope: 'current',
    targetCutoff: reportingCutoff,
    targetDate: reportingCutoff,
    targetDateStr: reportingDateStr,
    targetDisplayLabel: reportingDisplayLabel,
    isFuture: false,
    isHistorical: false,
    isMultiDay: false,
    notice: null,
  };
}

module.exports = {
  resolveDateContext,
  formatDisplayDate,
  formatDisplayTime,
};
