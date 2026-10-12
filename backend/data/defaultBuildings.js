const fs = require('fs');
const path = require('path');

const OFFICIAL_REGISTER = {
  B01: { name: 'administrative block', type: 'Administration', status: 'unknown' },
  B02: { name: 'C-BLOCK', type: 'Academic Block', status: 'unknown', isCBlock: true, buildingId: 'BLD001' },
  B03: { name: 'AUDITORIUM', type: 'Auditorium', status: 'unknown' },
  B04: { name: 'B-BLOCK', type: 'Academic Block', status: 'unknown' },
  B05: { name: 'A-BLOCK', type: 'Academic Block', status: 'unknown' },
  B06: { name: 'LIBRARY', type: 'Library', status: 'unknown' },
  B07: { name: 'GIRLS HOSTEL', type: 'Hostel', status: 'unknown' },
  B08: { name: 'INDOOR SPORTS COMPLEX', type: 'Sports Facility', status: 'unknown' },
  B09: { name: 'OUTDOOR SPORTS FEILD', type: 'Sports Facility', status: 'unknown' },
  B10: { name: 'S-BLOCK', type: 'Academic Block', status: 'unknown' },
  B11: { name: 'WORKSHOP', type: 'Academic Block', status: 'unknown' },
  B12: { name: 'WORKSHOP', type: 'Academic Block', status: 'unknown' },
  B13: { name: 'WORKSHOP', type: 'Academic Block', status: 'unknown' },
  B14: { name: 'WORKSHOP', type: 'Academic Block', status: 'unknown' },
  B15: { name: 'CAR PARKING', type: 'Parking', status: 'unknown' },
  B16: { name: 'ROCK GARDEN', type: 'Other', status: 'unknown' },
  B17: { name: 'DR AMBEDKAR COLLEGE CANTEEN', type: 'Canteen', status: 'unknown' },
  B18: { name: 'BOYS HOSTEL -1', type: 'Hostel', status: 'unknown' },
  B19: { name: 'BOYS HOSTEL 2', type: 'Hostel', status: 'unknown' },
  B20: { name: 'BOYS HOSTEL-3', type: 'Hostel', status: 'unknown' },
  B21: { name: 'DATA CENTRE', type: 'Other', status: 'unknown' },
};

let cachedBuildings = null;

function getDefaultBuildings() {
  if (cachedBuildings) return cachedBuildings;

  try {
    const jsonPath = path.join(__dirname, 'annotations', 'instances_default.json');
    if (fs.existsSync(jsonPath)) {
      const raw = fs.readFileSync(jsonPath, 'utf8');
      const coco = JSON.parse(raw);
      const annotations = coco.annotations || [];

      cachedBuildings = annotations.map((ann) => {
        const num = ann.id;
        const code = num < 10 ? `B0${num}` : `B${num}`;
        const meta = OFFICIAL_REGISTER[code] || {
          name: `Building ${code}`,
          type: 'Academic Block',
          status: 'unknown',
        };
        const isCBlock = Boolean(meta.isCBlock || code === 'B02');

        return {
          buildingId: isCBlock ? 'BLD001' : code,
          buildingCode: code,
          annotationId: ann.id,
          buildingName: meta.name,
          buildingType: meta.type,
          category: meta.type,
          description: isCBlock
            ? 'Academic block housing computer science lecture rooms, smart classrooms, CV Raman & CAED labs.'
            : `${meta.name} on campus grounds. Initial survey condition: Unknown.`,
          floors: isCBlock ? 3 : null,
          totalRooms: isCBlock ? 25 : null,
          status: 'Active',
          operationalStatus: meta.status || 'unknown',
          verificationStatus: isCBlock ? 'verified' : 'unverified',
          prototype: !isCBlock,
          geometry: {
            bbox: ann.bbox,
            area: ann.area,
            segmentation: ann.segmentation,
          },
        };
      });

      return cachedBuildings;
    }
  } catch (err) {
    console.error('Failed to load default building annotations:', err.message);
  }

  return [];
}

module.exports = { getDefaultBuildings };
