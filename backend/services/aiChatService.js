const { GoogleGenAI } = require('@google/genai');
const campusDataService = require('./campusDataService');
const { resolveDateContext, formatDisplayDate } = require('../utils/dateContext');

/**
 * Unitwin AI Chat Assistant Service
 *
 * Implements strict temporal consistency:
 * - Honors client asOfDate / reporting cutoff across all queries.
 * - Prevents future-dated pilot records from leaking into current/latest status.
 * - Explicitly tags and explains future simulations, historical records, and multi-day baselines.
 * - Passes strictly filtered telemetry records to Gemini with prompt temporal boundaries.
 */

function getGeminiClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey.trim() === '' || apiKey === 'YOUR_GEMINI_API_KEY_HERE') {
    return null;
  }
  try {
    return new GoogleGenAI({ apiKey: apiKey.trim() });
  } catch (err) {
    console.error('Failed to initialize Google Gen AI client:', err.message);
    return null;
  }
}

/**
 * Classify user intent and target campus domain
 */
function analyzeIntent(message = '', pageContext = '') {
  const text = message.toLowerCase().trim();
  const page = (pageContext || '').toLowerCase().trim();

  // Extract room entity (e.g. "C-101", "102", "Room 204")
  const roomMatch = text.match(/\b(?:room\s*)?([cdefgh]?[- ]?\d{2,3}[a-z]?)\b/i);
  const roomNumber = roomMatch ? roomMatch[1].replace(/\s+/, '').toUpperCase() : null;

  // Extract day of week
  const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
  const dayMatch = days.find((d) => text.includes(d));

  // Extract section (e.g. CSE-A, ECE-B)
  const sectionMatch = text.match(/\b(cse|ece|mec|civ|eee)-?([a-c])\b/i);
  const sectionId = sectionMatch ? `${sectionMatch[1].toUpperCase()}-${sectionMatch[2].toUpperCase()}` : null;

  // Domain topic detection
  const hasEnergy = /energy|solar|power|kwh|kw|pv|electricity|photovoltaic|grid|demand|appliance/i.test(text);
  const hasOccupancy = /occupancy|headcount|people|crowd|utilization|seating|capacity|present|empty|full/i.test(text);
  const hasTimetable = /timetable|schedule|class|lecture|period|slot|routine|cohort|section|faculty/i.test(text);
  const hasBuildings = /building|rooms?|floor|block|inventory|catalog|facility|infrastructure/i.test(text);
  const hasWater = /water|leak|plumbing|liters|flush|restroom|drainage/i.test(text);
  const hasCongestion = /congestion|bottleneck|traffic|crowding|queue|cafeteria|gate|corridor|delay|wait/i.test(text);
  const hasMaintenance = /maintenance|maintainence|ticket|repair|work order|hvac|asset|broken/i.test(text);
  const hasAlerts = /alert|alarm|incident|warning|tripwire|emergency|critical|high priority/i.test(text);
  const hasOverview = /executive|overview|summary|campus state|overall status|campus health|dashboard/i.test(text);

  // Specific domain queries take precedence
  if (hasEnergy && !hasOccupancy && !hasTimetable && !hasAlerts && !hasMaintenance && !hasWater && !hasCongestion) {
    return { domain: 'energy', roomNumber, dayMatch, sectionId };
  }
  if (hasOccupancy) return { domain: 'occupancy', roomNumber, dayMatch, sectionId };
  if (hasAlerts) return { domain: 'alerts', roomNumber, dayMatch, sectionId };
  if (hasMaintenance) return { domain: 'maintenance', roomNumber, dayMatch, sectionId };
  if (hasCongestion) return { domain: 'congestion', roomNumber, dayMatch, sectionId };
  if (hasWater) return { domain: 'water', roomNumber, dayMatch, sectionId };
  if (hasTimetable || sectionId || (dayMatch && !hasEnergy)) return { domain: 'timetable', roomNumber, dayMatch, sectionId };
  if (hasBuildings || roomNumber) return { domain: 'buildings', roomNumber, dayMatch, sectionId };
  if (hasOverview || text === 'hi' || text === 'hello' || text === 'help' || text.includes('kpi')) {
    return { domain: 'executive', roomNumber, dayMatch, sectionId };
  }

  // Active page fallback
  if (page === 'energy') return { domain: 'energy', roomNumber, dayMatch, sectionId };
  if (page === 'occupancy') return { domain: 'occupancy', roomNumber, dayMatch, sectionId };
  if (page === 'alerts') return { domain: 'alerts', roomNumber, dayMatch, sectionId };
  if (page === 'maintenance') return { domain: 'maintenance', roomNumber, dayMatch, sectionId };
  if (page === 'congestion') return { domain: 'congestion', roomNumber, dayMatch, sectionId };
  if (page === 'analytics') return { domain: 'timetable', roomNumber, dayMatch, sectionId };

  return { domain: 'executive', roomNumber, dayMatch, sectionId };
}

/**
 * Fetch grounded facts observing temporal boundaries
 */
async function fetchGroundedData(intent, dateContext) {
  const { domain, roomNumber, dayMatch, sectionId } = intent;

  switch (domain) {
    case 'energy': {
      const data = await campusDataService.getEnergyAndSolar({}, dateContext);
      return {
        domain: 'Energy & Solar Telemetry',
        data,
        sources: [
          { name: 'Energy Consumption Telemetry', collection: 'energyUsage' },
          { name: 'Rooftop Solar PV Telemetry', collection: 'solarGeneration' },
        ],
        followUps: [
          'What is our current solar power yield vs grid import?',
          'Which appliances consume the highest wattage on campus?',
          'Show campus executive operations overview.',
        ],
      };
    }

    case 'occupancy': {
      const data = await campusDataService.getOccupancy({ roomNumber }, dateContext);
      return {
        domain: 'Occupancy & Utilization',
        data,
        sources: [{ name: 'Room Occupancy Baseline', collection: 'occupancy' }],
        followUps: [
          'Which campus rooms currently exceed 70% capacity?',
          'Show total campus headcount and overall utilization rate.',
          'What is the occupancy status of Room C-101?',
        ],
      };
    }

    case 'timetable': {
      const data = await campusDataService.getAcademicTimetable(
        { day: dayMatch, sectionId, roomNumber },
        dateContext
      );
      return {
        domain: 'Academic Timetables & Schedules',
        data,
        sources: [
          { name: 'Academic Course Sections', collection: 'sections' },
          { name: 'Master Schedule Time Slots', collection: 'timetables' },
        ],
        followUps: [
          'Show timetable distribution across weekdays.',
          'How many sections are registered under CSE vs ECE?',
          'What classes are scheduled in room C-102?',
        ],
      };
    }

    case 'buildings': {
      const data = await campusDataService.getBuildingsAndRooms({ roomNumber }, dateContext);
      return {
        domain: 'Buildings & Spatial Inventory',
        data,
        sources: [
          { name: 'Campus Buildings Registry', collection: 'buildings' },
          { name: 'Room Catalog', collection: 'rooms' },
        ],
        followUps: [
          'List all buildings registered on campus.',
          'What is the breakdown of rooms by block and type?',
          'What are the details for room C-101?',
        ],
      };
    }

    case 'water': {
      const data = await campusDataService.getWaterUsage({}, dateContext);
      return {
        domain: 'Water Utilities Telemetry',
        data,
        sources: [{ name: 'Sub-Meter Water Telemetry', collection: 'Waterusage' }],
        followUps: [
          'Are there any active water leaks or anomalies reported?',
          'Which facilities consume the highest water volume?',
          'Show executive summary of campus operations.',
        ],
      };
    }

    case 'congestion': {
      const data = await campusDataService.getCongestion({}, dateContext);
      return {
        domain: 'Pedestrian Flow & Congestion',
        data,
        sources: [{ name: 'Campus Flow Observations', collection: 'congestion' }],
        followUps: [
          'Which areas currently have High congestion levels?',
          'What are the estimated queue wait times at campus bottlenecks?',
          'What crowd management actions are currently recommended?',
        ],
      };
    }

    case 'maintenance': {
      const data = await campusDataService.getMaintenance({}, dateContext);
      return {
        domain: 'Maintenance & Work Orders',
        data,
        sources: [{ name: 'Work Order Management', collection: 'maintainence' }],
        followUps: [
          'How many maintenance tickets are currently Open vs In Progress?',
          'List all High-priority open maintenance work orders.',
          'What is the status of HVAC and plumbing maintenance?',
        ],
      };
    }

    case 'alerts': {
      const data = await campusDataService.getAlerts({}, dateContext);
      return {
        domain: 'Campus Incident Alerts',
        data,
        sources: [{ name: 'System Alarms & Incident Engine', collection: 'alerts' }],
        followUps: [
          'How many High and Critical alerts are currently active?',
          'Show recent incidents requiring facility manager intervention.',
          'Summarize active alerts across energy, water, and occupancy.',
        ],
      };
    }

    case 'executive':
    default: {
      const data = await campusDataService.getExecutiveOverview({}, dateContext);
      return {
        domain: 'Executive Campus Overview',
        data,
        sources: [
          { name: 'Multi-Collection Synthesis', collection: 'buildings, occupancy, energyUsage, alerts, maintainence' },
        ],
        followUps: [
          'What is the live active power demand and solar contribution?',
          'Show current campus headcount and room utilization.',
          'Are there any critical operational alerts requiring attention?',
        ],
      };
    }
  }
}

/**
 * Formats deterministic responses with explicit temporal provenance and notices
 */
function formatDeterministicResponse(intent, groundedData, dateContext) {
  const { data } = groundedData;

  // Header notice block if explicit future simulation or historical lookup
  const noticeHeader = data.notice ? `> ℹ️ **${data.notice}**\n\n` : '';

  // Handle empty records scenario
  if (data.hasRecords === false) {
    return [
      `### ${groundedData.domain}`,
      noticeHeader,
      `⚠️ **Telemetry Unavailable**: ${data.message || 'No records found for the requested period.'}`,
      `*Active Cutoff Applied:* \`${data.actualCutoffApplied}\``,
    ]
      .filter(Boolean)
      .join('\n\n');
  }

  switch (intent.domain) {
    case 'energy': {
      const isMulti = data.isMultiDayView;
      return [
        `### Campus Energy & Solar Generation Telemetry`,
        noticeHeader,
        `**Reporting Status:** Telemetry snapshot as of **${data.reportingPeriod}**:`,
        `- **Active Campus Demand:** **${data.activePowerDemandKw} kW**`,
        `- **Simulated Rooftop Solar PV Output:** **${data.solarActivePowerKw} kW** (${data.solarOffsetPercentage}% solar offset against demand)`,
        `- **Net Grid Import:** **${data.netGridImportKw} kW** (grid import = max(0, demand - solar))`,
        `- **${isMulti ? 'Cumulative Energy Logged' : "Today's Energy Logged"}:** **${data.dayEnergyConsumedKWh || data.cumulativeEnergyConsumedKWh} kWh**`,
        `- **${isMulti ? 'Cumulative Estimated Solar Generation' : "Today's Estimated Solar Generation"}:** **${data.daySolarYieldKWh || data.totalSolarYieldKWh} kWh** (assumed ${data.solarCapacityKW} kWp array with ${data.solarPanelsCount} panels)`,
        `- **Solar Model Status:** ${data.simulationStatus || 'Simulated Solar Telemetry'} · Assumed ${data.solarCapacityKW} kWp capacity (${data.solarAssumedPanelRatingWatts || 400}W/panel). Campus panel specs are unverified simulation assumptions.`,
        data.applianceBreakdown && data.applianceBreakdown.length > 0
          ? `- **Top Power Draw:** ${data.applianceBreakdown.slice(0, 3).map((a) => `${a.appliance} (${a.activeLoadKw} kW)`).join(', ')}`
          : '',
        `*Reporting Cutoff Applied:* \`${data.actualCutoffApplied}\``,
      ]
        .filter(Boolean)
        .join('\n\n');
    }

    case 'occupancy': {
      return [
        `### Campus Occupancy & Space Utilization`,
        noticeHeader,
        `**Reporting Status:** Verified snapshot as of **${data.reportingPeriod}**:`,
        `- **Total Present Headcount:** **${data.totalPresentHeadcount.toLocaleString()} students & staff**`,
        `- **Monitored Seating Capacity:** **${data.totalSeatingCapacity.toLocaleString()} seats** across **${data.monitoredRoomsCount} rooms**`,
        `- **Average Campus Utilization:** **${data.averageUtilizationPct}%**`,
        `- **Rooms In Active Session:** **${data.roomsInActiveSession} rooms**`,
        data.highCapacityAlertRooms && data.highCapacityAlertRooms.length > 0
          ? `**High Utilization Alerts (≥70%):**\n` +
            data.highCapacityAlertRooms
              .map(
                (r) =>
                  `- **Room ${r.room}** (${r.building}): ${r.occupancy}/${r.capacity} seats (${r.utilizationPct}%)`
              )
              .join('\n')
          : '',
        data.specificRoom
          ? `**Requested Room Status (${data.specificRoom.roomNumber}):** Occupancy: ${data.specificRoom.occupancy}/${data.specificRoom.capacity} (${data.specificRoom.utilization}%).`
          : '',
        `*Reporting Cutoff Applied:* \`${data.actualCutoffApplied}\``,
      ]
        .filter(Boolean)
        .join('\n\n');
    }

    case 'timetable': {
      return [
        `### Academic Timetables & Schedules`,
        noticeHeader,
        `**Reporting Status:** ${data.reportingPeriod}:`,
        `- **Academic Sections Registered:** **${data.totalAcademicSections} sections** (${data.branches.map((b) => `${b.branch}: ${b.sectionCount}`).join(', ')})`,
        `- **Total Scheduled Slots Cataloged:** **${data.totalScheduledSlots} lecture & lab periods**`,
        `- **Slot Distribution Across Week:** ${data.slotsByDay.map((d) => `${d.day}: ${d.slots}`).join(', ')}`,
        data.sampleSchedule && data.sampleSchedule.length > 0
          ? `**Sample Scheduled Sessions (${data.scheduledDayFilter}):**\n` +
            data.sampleSchedule
              .map((s) => `- **${s.section}** (${s.day}, ${s.slot}): *${s.subject}* in Room **${s.room}**`)
              .join('\n')
          : '',
      ]
        .filter(Boolean)
        .join('\n\n');
    }

    case 'buildings': {
      return [
        `### Campus Spatial & Room Directory`,
        noticeHeader,
        `- **Total Registered Buildings:** **${data.totalBuildings} institutional structures**`,
        `- **Cataloged Rooms:** **${data.totalRooms} rooms** across campus blocks`,
        `- **Primary Room Types:** ${data.roomTypesDistribution.slice(0, 4).map((rt) => `${rt.type}: ${rt.count}`).join(', ')}`,
        `- **Block Distribution:** ${data.blocksDistribution.map((b) => `Block ${b.block}: ${b.count} rooms`).join(', ')}`,
        data.specificRoomMatch
          ? `**Catalog Record for Room ${data.specificRoomMatch.roomNumber}:** Building ${data.specificRoomMatch.buildingId}, Block ${data.specificRoomMatch.block}, Floor ${data.specificRoomMatch.floorNumber}, Type: ${data.specificRoomMatch.roomType}, Status: ${data.specificRoomMatch.status}.`
          : '',
      ]
        .filter(Boolean)
        .join('\n\n');
    }

    case 'water': {
      return [
        `### Water Utilities Monitoring`,
        noticeHeader,
        `**Reporting Status:** ${data.reportingPeriod}:`,
        `- **Telemetry Records on Record:** **${data.totalTelemetryRecords} meter readings**`,
        `- **Active Anomalies / Leaks Flagged:** **${data.activeAnomaliesCount} facility alerts**`,
        data.facilitiesSummary && data.facilitiesSummary.length > 0
          ? `**Facility Consumption Summary:**\n` +
            data.facilitiesSummary
              .map(
                (f) =>
                  `- **${f.facilityType}:** ${f.consumedLiters.toLocaleString()} L consumed (Baseline: ${f.baselineLiters.toLocaleString()} L)`
              )
              .join('\n')
          : '',
        `*Reporting Cutoff Applied:* \`${data.actualCutoffApplied}\``,
      ]
        .filter(Boolean)
        .join('\n\n');
    }

    case 'congestion': {
      return [
        `### Pedestrian Flow & Crowd Bottlenecks`,
        noticeHeader,
        `**Reporting Status:** ${data.reportingPeriod}:`,
        `- **Flow Observations on Record:** **${data.totalObservations} readings**`,
        `- **Density Distribution:** ${data.congestionLevels.map((l) => `${l.level}: ${l.observations}`).join(', ')}`,
        data.criticalBottlenecks && data.criticalBottlenecks.length > 0
          ? `**Critical Bottlenecks:**\n` +
            data.criticalBottlenecks
              .map(
                (b) =>
                  `- **${b.zone}** (${b.building}): ${b.peoplePresent} people (${b.densityPct}% density, Queue: ${b.queueLength}, Wait: ${b.waitTimeMinutes}m). Guidance: *${b.guidance}*`
              )
              .join('\n')
          : '',
        `*Reporting Cutoff Applied:* \`${data.actualCutoffApplied}\``,
      ]
        .filter(Boolean)
        .join('\n\n');
    }

    case 'maintenance': {
      return [
        `### Facility Maintenance & Work Orders`,
        noticeHeader,
        `**Reporting Status:** ${data.reportingPeriod}:`,
        `- **Total Work Orders Logged:** **${data.totalWorkOrders} tickets**`,
        `- **Status Breakdown:** ${data.statusBreakdown.map((s) => `${s.status}: ${s.count}`).join(', ')}`,
        `- **Priority Breakdown:** ${data.priorityBreakdown.map((p) => `${p.priority}: ${p.count}`).join(', ')}`,
        data.urgentOpenTickets && data.urgentOpenTickets.length > 0
          ? `**High-Priority Open Work Orders:**\n` +
            data.urgentOpenTickets
              .map(
                (t) =>
                  `- **${t.asset}** in Room ${t.room} (${t.building}): ${t.issue} [${t.status} - ${t.priority}]`
              )
              .join('\n')
          : '',
        `*Reporting Cutoff Applied:* \`${data.actualCutoffApplied}\``,
      ]
        .filter(Boolean)
        .join('\n\n');
    }

    case 'alerts': {
      return [
        `### Operational Incidents & Alarms`,
        noticeHeader,
        `**Reporting Status:** ${data.reportingPeriod}:`,
        `- **Monitored Incidents Logged:** **${data.totalActiveIncidents} alerts**`,
        `- **Severity Distribution:** ${data.severityBreakdown.map((s) => `${s.severity}: ${s.count}`).join(', ')}`,
        `- **Incident Categories:** ${data.typeBreakdown.map((t) => `${t.type}: ${t.count}`).join(', ')}`,
        data.activeHighSeverityAlarms && data.activeHighSeverityAlarms.length > 0
          ? `**Active High-Severity Alerts:**\n` +
            data.activeHighSeverityAlarms
              .map(
                (a) =>
                  `- **[${a.severity}] ${a.type}** (Room ${a.room || 'General'}, ${a.building}): ${a.message}. *Recommended: ${a.action}*`
              )
              .join('\n')
          : data.recentAlerts && data.recentAlerts.length > 0
          ? `**Recent Incident Reports:**\n` +
            data.recentAlerts
              .map(
                (a) =>
                  `- **[${a.severity}] ${a.type}** (Room ${a.room || 'General'}, ${a.building}): ${a.message}. *Recommended: ${a.action}*`
              )
              .join('\n')
          : '',
        `*Reporting Cutoff Applied:* \`${data.actualCutoffApplied}\``,
      ]
        .filter(Boolean)
        .join('\n\n');
    }

    case 'executive':
    default: {
      return [
        `### Executive Campus Operations Overview`,
        noticeHeader,
        `Live operational scorecard as of **${data.reportingPeriod}**:`,
        `- **Infrastructure Status:** **${data.buildingsOnline} Buildings Online**`,
        `- **Campus Headcount:** **${data.campusHeadcount?.toLocaleString() || 0} Occupants** (Campus Utilization: **${data.averageUtilization}**)`,
        `- **Active Power Demand:** **${data.activeEnergyDemandKw} kW** (Grid Import: **${data.netGridImportKw} kW**)`,
        `- **Rooftop Solar Output (Simulated):** **${data.solarYieldKw} kW** (${data.solarOffsetPct} clean energy offset against demand)`,
        `- **Critical Alarms:** **${data.criticalAlertsCount} High/Critical Alerts** requiring operator attention`,
        `- **Open Maintenance Tickets:** **${data.openMaintenanceTickets} Tickets** pending resolution`,
        `*Reporting Cutoff Applied:* \`${data.actualCutoffApplied}\``,
      ]
        .filter(Boolean)
        .join('\n\n');
    }
  }
}

/**
 * Main AI Chat Query Handler
 */
async function processChatMessage({ message, history = [], pageContext = 'dashboard', asOfDate }) {
  // 1. Resolve date context and strict reporting boundaries
  const dateContext = resolveDateContext({ asOfDate, message });

  // 2. Identify domain intent
  const intent = analyzeIntent(message, pageContext);

  // 3. Fetch strictly filtered grounded facts
  const groundedResult = await fetchGroundedData(intent, dateContext);

  const gemini = getGeminiClient();

  if (gemini) {
    try {
      const modelName = process.env.GEMINI_MODEL || 'gemini-3.8-flash';

      const systemInstruction = `You are Unitwin AI, the intelligent virtual operations assistant for the Unitwin Smart Campus Digital Twin & Analytics Platform.
Purpose: Assist institutional leaders, college principals, facility managers, and administrators.
CRITICAL TEMPORAL GROUNDING POLICY:
- The user's active campus reporting reference time is: "${dateContext.reportingDisplayLabel}".
- Strictly observe the temporal cutoff: "${groundedResult.data.actualCutoffApplied}".
- You MUST ONLY cite facts, metrics, and timestamps present in the supplied telemetry context.
- NEVER fabricate or cite future dates or readings that post-date the reporting cutoff, unless responding to an explicit future simulation requested by the user.
- Always include the reporting timestamp/snapshot in your response (e.g. "${groundedResult.data.reportingPeriod}").
- If the telemetry context indicates that no records exist for the requested date, explain that clearly rather than changing the date.

SOLAR TELEMETRY SIMULATION POLICY:
- Campus solar panel wattage, installed capacity, and live sensors are unverified; telemetry is generated via a configurable diurnal simulation model for demonstration.
- Always refer to solar metrics as "Simulated" or "Estimated" using the assumed array capacity (e.g. 4.0 kWp).
- Maintain a strict distinction between instantaneous solar power (kW), interval/accumulated solar energy (kWh), and assumed installed capacity (kWp). Never present cumulative kWh as instantaneous power.
- Net grid import is defined as max(0, campus demand - solar output); it is never negative unless export is specifically modelled.
- Maintain an authoritative, concise, enterprise tone using GitHub-flavored markdown.`;

      const contextFacts = JSON.stringify(
        {
          temporalReportingCutoff: groundedResult.data.actualCutoffApplied,
          reportingPeriodLabel: groundedResult.data.reportingPeriod,
          temporalScope: dateContext.temporalScope,
          notice: dateContext.notice,
          verifiedFacts: groundedResult.data,
        },
        null,
        2
      );

      const boundedHistory = Array.isArray(history) ? history.slice(-6) : [];
      const historyPrompt = boundedHistory
        .map((h) => `${h.role === 'user' ? 'User' : 'Assistant'}: ${h.text || h.content}`)
        .join('\n');

      const userPrompt = [
        `Active Page Context: ${pageContext || 'Dashboard'}`,
        `Active Campus Reporting Date: ${dateContext.reportingDisplayLabel}`,
        dateContext.notice ? `TEMPORAL ADVISORY: ${dateContext.notice}` : '',
        `=== VERIFIED MONGODB CAMPUS TELEMETRY FACTS (BOUNDED AS OF REPORTING CUTOFF) ===`,
        contextFacts,
        `================================================================================`,
        historyPrompt ? `Recent Conversation History:\n${historyPrompt}\n` : '',
        `User Inquiry: "${message}"`,
        `Provide an intelligent, direct, concise, grounded response based strictly on the verified facts above as of ${groundedResult.data.reportingPeriod}.`,
      ]
        .filter(Boolean)
        .join('\n\n');

      const geminiResponse = await gemini.models.generateContent({
        model: modelName,
        contents: userPrompt,
        config: {
          systemInstruction,
          temperature: 0.15,
        },
      });

      const responseText = geminiResponse.text?.trim();

      if (responseText) {
        return {
          success: true,
          answer: responseText,
          domain: groundedResult.domain,
          sources: groundedResult.sources,
          isGeminiPowered: true,
          model: modelName,
          reportingPeriod: groundedResult.data.reportingPeriod,
          actualCutoffApplied: groundedResult.data.actualCutoffApplied,
          temporalScope: dateContext.temporalScope,
          notice: dateContext.notice,
          suggestedFollowUps: groundedResult.followUps,
          timestamp: new Date().toISOString(),
        };
      }
    } catch (aiErr) {
      console.warn('Gemini API call encountered an issue, falling back to deterministic grounding:', aiErr.message);
    }
  }

  // Deterministic grounded response fallback
  const fallbackAnswer = formatDeterministicResponse(intent, groundedResult, dateContext);

  return {
    success: true,
    answer: fallbackAnswer,
    domain: groundedResult.domain,
    sources: groundedResult.sources,
    isGeminiPowered: false,
    model: 'grounded-mongo-synthesizer',
    reportingPeriod: groundedResult.data.reportingPeriod,
    actualCutoffApplied: groundedResult.data.actualCutoffApplied,
    temporalScope: dateContext.temporalScope,
    notice: dateContext.notice || 'Directly grounded in MongoDB Atlas campus telemetry observing reporting boundaries.',
    suggestedFollowUps: groundedResult.followUps,
    timestamp: new Date().toISOString(),
  };
}

module.exports = {
  processChatMessage,
  analyzeIntent,
  fetchGroundedData,
};
