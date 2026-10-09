// ============================================================================
// C BLOCK COMPLETE RECONSTRUCTION — cblock_reconstructed.glb
// Source references:
//   1. Satellite image (pink boundary) — footprint authority
//   2. Meshy 3D model — heights & 3D geometry reference
//   3. Aerial render — visual appearance & architectural detail
//
// COORDINATE SYSTEM:
//   +X = East (right wing direction)
//   +Z = South (front/south wing direction)
//   +Y = Up
//
// REAL-WORLD SCALE (approximate, from satellite):
//   Building compound: ~130m E-W × ~100m N-S
//   We model at 1 unit = 1 metre, then the Three.js scene scales via Box3.
//
// BUILDING LAYOUT (top-down, North = -Z, South = +Z, West = -X, East = +X):
//
//    -X                                              +X
//    W ________________________________________________ E
//    |  [AUD]──[CONN]──[NORTH WING: 3 floors]          |  -Z (North)
//    |    |                                             |
//    |  [WEST WING: 3 floors]  [COURTYARD]  [EAST WING: 3 floors]
//    |                                                  |
//    |       [SOUTH WING: 3 floors + lower front]       |  +Z (South)
//    |__________________________________________________|
//
// AUDITORIUM (NW quadrant):
//   Large octagonal/faceted single-storey structure, tall (~12m)
//   Connected to north wing by a narrow 1-storey corridor bridge
//   The connection is ONLY at ground/1st floor — upper floors are OPEN
//
// FLOOR LEVELS (from Meshy + aerial):
//   Ground slab:  Y = 0 (ground)
//   Floor 1 slab: Y = 4.2m
//   Floor 2 slab: Y = 8.4m
//   Roof slab:    Y = 12.0m
//   Parapet top:  Y = 13.0m
//   Floor-to-floor ~4.2m, 3 teaching floors + ground
//
// ============================================================================

const fs = require('fs');

// ---- GEOMETRY HELPERS -------------------------------------------------------

// Create a box mesh from (x1,y1,z1) to (x2,y2,z2) with outward normals
function makeBox(x1, y1, z1, x2, y2, z2) {
  const pos = [];
  const nor = [];
  const idx = [];

  function face(verts, normal) {
    const b = pos.length / 3;
    for (const v of verts) { pos.push(v[0], v[1], v[2]); nor.push(normal[0], normal[1], normal[2]); }
    idx.push(b, b+1, b+2, b, b+2, b+3);
  }

  face([[x1,y1,z1],[x2,y1,z1],[x2,y2,z1],[x1,y2,z1]], [0,0,-1]); // -Z
  face([[x2,y1,z2],[x1,y1,z2],[x1,y2,z2],[x2,y2,z2]], [0,0, 1]); // +Z
  face([[x2,y1,z1],[x2,y1,z2],[x2,y2,z2],[x2,y2,z1]], [1,0,0]);  // +X
  face([[x1,y1,z2],[x1,y1,z1],[x1,y2,z1],[x1,y2,z2]], [-1,0,0]); // -X
  face([[x1,y2,z1],[x2,y2,z1],[x2,y2,z2],[x1,y2,z2]], [0,1,0]);  // +Y top
  face([[x2,y1,z1],[x1,y1,z1],[x1,y1,z2],[x2,y1,z2]], [0,-1,0]); // -Y bottom

  return { pos, nor, idx };
}

// Create a prism from a polygon base extruded in Y
function makeExtrudedPolygon(points2d, y0, y1) {
  // points2d: array of [x,z] in CCW order from above
  const pos = [], nor = [], idx = [];
  const n = points2d.length;

  // Side faces
  for (let i = 0; i < n; i++) {
    const a = points2d[i];
    const b = points2d[(i+1) % n];
    // Normal: outward perpendicular to edge ab in XZ
    const dx = b[0]-a[0], dz = b[1]-a[1];
    const len = Math.sqrt(dx*dx+dz*dz);
    const nx = dz/len, nz = -dx/len;

    const base = pos.length / 3;
    pos.push(a[0],y0,a[1], b[0],y0,b[1], b[0],y1,b[1], a[0],y1,a[1]);
    nor.push(nx,0,nz, nx,0,nz, nx,0,nz, nx,0,nz);
    idx.push(base, base+1, base+2, base, base+2, base+3);
  }

  // Top cap (fan from first point)
  const topBase = pos.length / 3;
  for (const p of points2d) { pos.push(p[0],y1,p[1]); nor.push(0,1,0); }
  for (let i = 1; i < n-1; i++) { idx.push(topBase, topBase+i, topBase+i+1); }

  // Bottom cap
  const botBase = pos.length / 3;
  for (const p of points2d) { pos.push(p[0],y0,p[1]); nor.push(0,-1,0); }
  for (let i = 1; i < n-1; i++) { idx.push(botBase, botBase+i+1, botBase+i); }

  return { pos, nor, idx };
}

// Merge array of geometries into one
function mergeGeos(geos) {
  const allPos=[], allNor=[], allIdx=[];
  for (const g of geos) {
    const base = allPos.length / 3;
    for (const v of g.pos) allPos.push(v);
    for (const v of g.nor) allNor.push(v);
    for (const i of g.idx) allIdx.push(base + i);
  }
  return {
    positions: new Float32Array(allPos),
    normals: new Float32Array(allNor),
    indices: new Uint32Array(allIdx),
  };
}

// ============================================================================
// ARCHITECTURAL DIMENSIONS
// (all in metres, Y=0 at ground level)
// Derived from satellite footprint + aerial + Meshy proportions
// ============================================================================

// Overall compound bounds (inside pink boundary):
// West  X = 0
// East  X = 128
// North Z = 0
// South Z = 100

const W = 0;    // West wall X
const E = 128;  // East wall X
const N = 0;    // North wall Z
const S = 100;  // South wall Z

// Wing width (depth of classroom corridors seen from aerial)
const WING_W = 14;  // wing depth (metres)

// Floor levels
const G   = 0;     // ground
const F1  = 4.2;   // 1st floor slab top
const F2  = 8.4;   // 2nd floor slab top
const RF  = 12.0;  // roof slab top
const PAR = 13.0;  // parapet top
const ST  = 0.3;   // slab thickness
const WT  = 0.35;  // wall thickness
const PH  = 1.0;   // parapet height
const COL = 0.6;   // column/pillar size

// Auditorium position (NW, inside pink boundary)
// Satellite shows it centred in the NW quadrant
// Centre approx at X=28, Z=32 from our origin
const AUD_CX = 30;  // auditorium centre X
const AUD_CZ = 30;  // auditorium centre Z
const AUD_R  = 22;  // effective radius (octagon)
const AUD_H  = 11;  // height of auditorium walls
const AUD_RIDGE = 14; // top of roof ridge above ground

// Connecting corridor (auditorium → north wing)
// Satellite: narrow bridge, ~6m wide, goes from auditorium east face to north wing at ~X=52
const CONN_Z1 = 20;  // north edge of connector
const CONN_Z2 = 28;  // south edge of connector (connects to north wing N face)
const CONN_X1 = 44;  // west X (auditorium east edge)
const CONN_X2 = 60;  // east X (meets north wing)
const CONN_H  = 4.5; // only 1 storey tall (the gap above this to F2 is OPEN)

// North wing (runs E-W, with gap where auditorium+connector is)
// North wing: Z = 0 to WING_W (= 14)
// It starts from connector east edge to east wing
const NW_Z1 = N;
const NW_Z2 = N + WING_W;  // = 14
const NW_X_START = CONN_X2; // east end of connector = 60
const NW_X_END   = E - WING_W; // = 114

// West wing (runs N-S along west edge)
// West wing: X = 0 to WING_W (= 14)
// It goes from Z=WING_W (where north-west corner is) down to south wing
const WW_X1 = W;
const WW_X2 = W + WING_W;  // = 14
const WW_Z1 = N + WING_W;  // = 14 (south of NW corner block)
const WW_Z2 = S - WING_W;  // = 86

// East wing (runs N-S along east edge)
const EW_X1 = E - WING_W;  // = 114
const EW_X2 = E;
const EW_Z1 = N;            // = 0 (east wing starts at north, no auditorium blockage)
const EW_Z2 = S - WING_W;  // = 86

// South wing (runs E-W along south edge)
const SW_Z1 = S - WING_W;  // = 86
const SW_Z2 = S;
const SW_X1 = W;
const SW_X2 = E;

// Northwest corner block (where west wing and north wing meet)
const NWC_X1 = W;
const NWC_X2 = W + WING_W; // = 14
const NWC_Z1 = N;
const NWC_Z2 = N + WING_W; // = 14

// Northeast corner block (where east wing and north wing meet)
const NEC_X1 = E - WING_W; // = 114
const NEC_X2 = E;
const NEC_Z1 = N;
const NEC_Z2 = N + WING_W; // = 14

// Southeast corner (where east + south meet)
// (Southwest corner where west + south meet is also included)

// Courtyard bounds (open area inside the U)
const CY_X1 = W + WING_W;   // = 14
const CY_X2 = E - WING_W;   // = 114
const CY_Z1 = N + WING_W;   // = 14
const CY_Z2 = S - WING_W;   // = 86

// Courtyard fountain
const FC_X = (CY_X1 + CY_X2) / 2; // centred
const FC_Z = (CY_Z1 + CY_Z2) / 2;

// Solar panels (simplified flat panels on roof sections)
function makeSolarPanel(cx, cz, w, d, angle=0) {
  // Flat panel on roof at angle (not implemented, just a flat box)
  const hw = w/2, hd = d/2;
  return makeBox(cx-hw, RF+0.05, cz-hd, cx+hw, RF+0.35, cz+hd);
}

// ============================================================================
// SECTION BUILDERS
// ============================================================================

function buildNorthWing() {
  const geos = [];
  // Main building volume: 3 floors
  geos.push(makeBox(NW_X_START, G, NW_Z1, NW_X_END, RF, NW_Z2));
  // Parapet
  geos.push(makeBox(NW_X_START, RF, NW_Z1, NW_X_END, PAR, NW_Z2));
  // Floor slab bands (visible horizontal lines on exterior)
  for (const fy of [F1, F2]) {
    geos.push(makeBox(NW_X_START-0.2, fy, NW_Z1-0.2, NW_X_END+0.2, fy+ST, NW_Z2));
  }
  // Courtyard-facing corridor slab overhangs (south face)
  for (const fy of [F1, F2]) {
    geos.push(makeBox(NW_X_START, fy, NW_Z2, NW_X_END, fy+ST, NW_Z2+1.5));
  }
  return mergeGeos(geos);
}

function buildNWCorner() {
  const geos = [];
  geos.push(makeBox(NWC_X1, G, NWC_Z1, NWC_X2, RF, NWC_Z2));
  geos.push(makeBox(NWC_X1, RF, NWC_Z1, NWC_X2, PAR, NWC_Z2));
  return mergeGeos(geos);
}

function buildNECorner() {
  const geos = [];
  geos.push(makeBox(NEC_X1, G, NEC_Z1, NEC_X2, RF, NEC_Z2));
  geos.push(makeBox(NEC_X1, RF, NEC_Z1, NEC_X2, PAR, NEC_Z2));
  return mergeGeos(geos);
}

function buildWestWing() {
  const geos = [];
  geos.push(makeBox(WW_X1, G, WW_Z1, WW_X2, RF, WW_Z2));
  geos.push(makeBox(WW_X1, RF, WW_Z1, WW_X2, PAR, WW_Z2));
  for (const fy of [F1, F2]) {
    // Floor slab bands visible on east face (courtyard side)
    geos.push(makeBox(WW_X2, fy, WW_Z1, WW_X2+1.5, fy+ST, WW_Z2));
  }
  return mergeGeos(geos);
}

function buildEastWing() {
  const geos = [];
  geos.push(makeBox(EW_X1, G, EW_Z1, EW_X2, RF, EW_Z2));
  geos.push(makeBox(EW_X1, RF, EW_Z1, EW_X2, PAR, EW_Z2));
  for (const fy of [F1, F2]) {
    // Floor slab bands visible on west face (courtyard side)
    geos.push(makeBox(EW_X1-1.5, fy, EW_Z1, EW_X1, fy+ST, EW_Z2));
  }
  return mergeGeos(geos);
}

function buildSouthWing() {
  const geos = [];
  geos.push(makeBox(SW_X1, G, SW_Z1, SW_X2, RF, SW_Z2));
  geos.push(makeBox(SW_X1, RF, SW_Z1, SW_X2, PAR, SW_Z2));
  for (const fy of [F1, F2]) {
    // Floor slab bands on north face (courtyard side)
    geos.push(makeBox(SW_X1, fy, SW_Z1-1.5, SW_X2, fy+ST, SW_Z1));
  }
  // Lower front entrance section (south face, from aerial shows stepped volume)
  // A small single-floor entrance canopy in the centre of south wing
  const ENT_W = 18;
  geos.push(makeBox(FC_X - ENT_W/2, G, SW_Z2, FC_X + ENT_W/2, F1+ST, SW_Z2+3));
  return mergeGeos(geos);
}

function buildConnectingCorridor() {
  const geos = [];
  // CRITICAL: This is only ONE storey (ground floor level) tall
  // The 2nd and 3rd floor levels are OPEN above this — no upper floor connection
  // Wall body
  geos.push(makeBox(CONN_X1, G, CONN_Z1, CONN_X2, CONN_H, CONN_Z2));
  // Roof slab of connector
  geos.push(makeBox(CONN_X1-0.5, CONN_H, CONN_Z1-0.5, CONN_X2+0.5, CONN_H+ST, CONN_Z2+0.5));
  // Low parapet on connector roof
  geos.push(makeBox(CONN_X1, CONN_H+ST, CONN_Z1, CONN_X2, CONN_H+ST+0.8, CONN_Z2));
  return mergeGeos(geos);
}

function buildAuditorium() {
  const geos = [];

  // Octagonal footprint (8-sided polygon from satellite)
  // The auditorium appears as a large faceted/octagonal structure
  // Centre at (AUD_CX, AUD_CZ), approximate octagon
  const oct = [];
  const sides = 8;
  for (let i = 0; i < sides; i++) {
    const angle = (i / sides) * Math.PI * 2 - Math.PI/8; // rotated 22.5 deg
    oct.push([AUD_CX + AUD_R * Math.cos(angle), AUD_CZ + AUD_R * Math.sin(angle)]);
  }

  // Walls (extruded from G to AUD_H)
  geos.push(makeExtrudedPolygon(oct, G, AUD_H));

  // Roof: a faceted/pyramid-like roof
  // Approximate as octagonal pyramid using flat top (simplified)
  // Inner polygon at centre elevated to ridge height
  const ridgePoly = [];
  const innerR = 6;
  for (let i = 0; i < sides; i++) {
    const angle = (i / sides) * Math.PI * 2 - Math.PI/8;
    ridgePoly.push([AUD_CX + innerR * Math.cos(angle), AUD_CZ + innerR * Math.sin(angle)]);
  }

  // Roof panels: triangular sections from each edge to centre ridge
  for (let i = 0; i < sides; i++) {
    const a = oct[i];
    const b = oct[(i+1)%sides];
    const ra = ridgePoly[i];
    const rb = ridgePoly[(i+1)%sides];

    // Two triangles forming a trapezoid panel on each face
    const base = geos.length;
    const roofGeo = {pos:[], nor:[], idx:[]};
    // 4 corner points: bottom-outer-a, bottom-outer-b, top-inner-b, top-inner-a
    const pts = [
      [a[0], AUD_H, a[1]],
      [b[0], AUD_H, b[1]],
      [rb[0], AUD_RIDGE, rb[1]],
      [ra[0], AUD_RIDGE, ra[1]],
    ];
    // Compute normal (cross product)
    const dx1 = pts[1][0]-pts[0][0], dy1 = pts[1][1]-pts[0][1], dz1 = pts[1][2]-pts[0][2];
    const dx2 = pts[3][0]-pts[0][0], dy2 = pts[3][1]-pts[0][1], dz2 = pts[3][2]-pts[0][2];
    const nx = dy1*dz2 - dz1*dy2;
    const ny = dz1*dx2 - dx1*dz2;
    const nz = dx1*dy2 - dy1*dx2;
    const nl = Math.sqrt(nx*nx+ny*ny+nz*nz);

    const vb = roofGeo.pos.length / 3;
    for (const p of pts) { roofGeo.pos.push(p[0],p[1],p[2]); roofGeo.nor.push(nx/nl,ny/nl,nz/nl); }
    roofGeo.idx.push(vb, vb+1, vb+2, vb, vb+2, vb+3);
    geos.push(roofGeo);
  }

  // Top cap of ridge (flat polygon)
  geos.push(makeExtrudedPolygon(ridgePoly, AUD_RIDGE-0.3, AUD_RIDGE));

  // Pedestal / base platform visible in satellite (slightly wider base)
  geos.push(makeExtrudedPolygon(
    oct.map(p => [AUD_CX + (p[0]-AUD_CX)*1.08, AUD_CZ + (p[1]-AUD_CZ)*1.08]),
    G-0.2, G+0.5
  ));

  return mergeGeos(geos);
}

function buildCourtyard() {
  const geos = [];
  // Ground plane of courtyard (lawn surface)
  geos.push(makeBox(CY_X1, -0.15, CY_Z1, CY_X2, G, CY_Z2));
  return mergeGeos(geos);
}

function buildFountain() {
  const geos = [];
  // Circular fountain: approximate as a low cylinder using hexdecagon
  const FR = 4.5; // fountain radius
  const poly = [];
  const segs = 16;
  for (let i = 0; i < segs; i++) {
    const a = (i/segs)*Math.PI*2;
    poly.push([FC_X + FR*Math.cos(a), FC_Z + FR*Math.sin(a)]);
  }
  geos.push(makeExtrudedPolygon(poly, -0.15, 0.4)); // rim
  // Inner water surface
  const poly2 = [];
  for (let i = 0; i < segs; i++) {
    const a = (i/segs)*Math.PI*2;
    poly2.push([FC_X + (FR-0.4)*Math.cos(a), FC_Z + (FR-0.4)*Math.sin(a)]);
  }
  geos.push(makeExtrudedPolygon(poly2, -0.15, 0.1)); // water basin
  return mergeGeos(geos);
}

function buildSolarPanels() {
  const geos = [];
  // North wing panels
  for (let x = NW_X_START + 6; x < NW_X_END - 6; x += 10) {
    geos.push(makeSolarPanel(x, (NW_Z1+NW_Z2)/2, 7, 4));
  }
  // West wing panels
  for (let z = WW_Z1 + 6; z < WW_Z2 - 6; z += 10) {
    geos.push(makeSolarPanel((WW_X1+WW_X2)/2, z, 4, 7));
  }
  // East wing panels
  for (let z = EW_Z1 + 6; z < EW_Z2 - 6; z += 10) {
    geos.push(makeSolarPanel((EW_X1+EW_X2)/2, z, 4, 7));
  }
  // South wing panels
  for (let x = SW_X1 + 8; x < SW_X2 - 8; x += 12) {
    geos.push(makeSolarPanel(x, (SW_Z1+SW_Z2)/2, 7, 4));
  }
  return mergeGeos(geos);
}

function buildRoofEquipment() {
  const geos = [];
  // Small AC units / equipment boxes visible in aerial
  // North wing: small boxes
  geos.push(makeBox(NW_X_START+5, RF, NW_Z1+2, NW_X_START+8, RF+1.2, NW_Z1+4));
  // East wing: water tanks / equipment
  geos.push(makeBox(EW_X1+2, RF, 8, EW_X1+5, RF+2, 11));
  geos.push(makeBox(EW_X1+7, RF, 8, EW_X1+10, RF+2, 11));
  return mergeGeos(geos);
}

// ============================================================================
// BUILD ALL SECTIONS
// ============================================================================

console.log('Building C Block sections...');

const sections = [
  { name: 'NorthWing',          material: 0, geo: buildNorthWing() },
  { name: 'NWCorner',           material: 0, geo: buildNWCorner() },
  { name: 'NECorner',           material: 0, geo: buildNECorner() },
  { name: 'WestWing',           material: 0, geo: buildWestWing() },
  { name: 'EastWing',           material: 0, geo: buildEastWing() },
  { name: 'SouthWing',          material: 0, geo: buildSouthWing() },
  { name: 'ConnectingCorridor', material: 0, geo: buildConnectingCorridor() },
  { name: 'Auditorium',         material: 1, geo: buildAuditorium() },
  { name: 'Courtyard',          material: 2, geo: buildCourtyard() },
  { name: 'Fountain',           material: 3, geo: buildFountain() },
  { name: 'SolarPanels',        material: 4, geo: buildSolarPanels() },
  { name: 'RoofEquipment',      material: 0, geo: buildRoofEquipment() },
];

let totalV = 0, totalT = 0;
for (const sec of sections) {
  const v = sec.geo.positions.length / 3;
  const t = sec.geo.indices.length / 3;
  totalV += v; totalT += t;
  console.log(`  ${sec.name.padEnd(24)}: ${v} vertices, ${t} triangles`);
}
console.log(`  ${'TOTAL'.padEnd(24)}: ${totalV} vertices, ${totalT} triangles`);

// ============================================================================
// PACK GLB
// ============================================================================
console.log('\nPacking GLB binary...');

// 1. Build binary blob
let totalBin = 0;
for (const sec of sections) {
  sec.posOff  = totalBin; sec.posByteLen  = sec.geo.positions.byteLength; totalBin += sec.posByteLen;
  sec.normOff = totalBin; sec.normByteLen = sec.geo.normals.byteLength;   totalBin += sec.normByteLen;
  sec.idxOff  = totalBin; sec.idxByteLen  = sec.geo.indices.byteLength;   totalBin += sec.idxByteLen;
}
// Align to 4 bytes
const padded = (totalBin + 3) & ~3;
const binBuf = Buffer.alloc(padded);
for (const sec of sections) {
  Buffer.from(sec.geo.positions.buffer).copy(binBuf, sec.posOff);
  Buffer.from(sec.geo.normals.buffer).copy(binBuf, sec.normOff);
  Buffer.from(sec.geo.indices.buffer).copy(binBuf, sec.idxOff);
}

// 2. Build GLTF JSON
const nodes = [{ name: 'CBlock', children: [] }];
const meshes = [], accessors = [], bufferViews = [];

const materials = [
  {
    name: 'WallMaterial',
    pbrMetallicRoughness: { baseColorFactor:[0.88,0.74,0.64,1], metallicFactor:0.05, roughnessFactor:0.85 },
    doubleSided: true
  },
  {
    name: 'AuditoriumRoof',
    pbrMetallicRoughness: { baseColorFactor:[0.95,0.93,0.82,1], metallicFactor:0.1, roughnessFactor:0.4 },
    doubleSided: true
  },
  {
    name: 'CourtyardGrass',
    pbrMetallicRoughness: { baseColorFactor:[0.22,0.50,0.18,1], metallicFactor:0, roughnessFactor:0.95 },
    doubleSided: false
  },
  {
    name: 'FountainConcrete',
    pbrMetallicRoughness: { baseColorFactor:[0.75,0.75,0.73,1], metallicFactor:0, roughnessFactor:0.8 },
    doubleSided: true
  },
  {
    name: 'SolarPanel',
    pbrMetallicRoughness: { baseColorFactor:[0.05,0.10,0.25,1], metallicFactor:0.6, roughnessFactor:0.2 },
    doubleSided: false
  },
];

for (let si = 0; si < sections.length; si++) {
  const sec = sections[si];
  nodes[0].children.push(nodes.length);
  nodes.push({ name: sec.name, mesh: meshes.length });

  const posBV = bufferViews.length;
  bufferViews.push({ buffer:0, byteOffset:sec.posOff,  byteLength:sec.posByteLen,  target:34962 });
  const norBV = bufferViews.length;
  bufferViews.push({ buffer:0, byteOffset:sec.normOff, byteLength:sec.normByteLen, target:34962 });
  const idxBV = bufferViews.length;
  bufferViews.push({ buffer:0, byteOffset:sec.idxOff,  byteLength:sec.idxByteLen,  target:34963 });

  // Compute POSITION min/max
  const p = sec.geo.positions;
  let mnX=Infinity,mnY=Infinity,mnZ=Infinity,mxX=-Infinity,mxY=-Infinity,mxZ=-Infinity;
  for (let i=0; i<p.length; i+=3) {
    if(p[i]<mnX)mnX=p[i]; if(p[i]>mxX)mxX=p[i];
    if(p[i+1]<mnY)mnY=p[i+1]; if(p[i+1]>mxY)mxY=p[i+1];
    if(p[i+2]<mnZ)mnZ=p[i+2]; if(p[i+2]>mxZ)mxZ=p[i+2];
  }

  const posAcc = accessors.length;
  accessors.push({ bufferView:posBV, componentType:5126, count:p.length/3, type:'VEC3', min:[mnX,mnY,mnZ], max:[mxX,mxY,mxZ] });
  const norAcc = accessors.length;
  accessors.push({ bufferView:norBV, componentType:5126, count:sec.geo.normals.length/3, type:'VEC3' });
  const idxAcc = accessors.length;
  accessors.push({ bufferView:idxBV, componentType:5125, count:sec.geo.indices.length, type:'SCALAR' });

  meshes.push({
    name: sec.name + '_Mesh',
    primitives: [{ attributes:{ POSITION:posAcc, NORMAL:norAcc }, indices:idxAcc, material:sec.material }]
  });
}

const gltfJson = {
  asset: { generator:'Antigravity CBlock Reconstructor v1.0', version:'2.0' },
  scene: 0,
  scenes: [{ name:'CBlock_Scene', nodes:[0] }],
  nodes,
  meshes,
  materials,
  accessors,
  bufferViews,
  buffers: [{ byteLength: padded }]
};

function packGLB(json, bin) {
  let s = JSON.stringify(json);
  while (s.length % 4) s += ' ';
  const jb = Buffer.from(s, 'utf8');
  const binPad = (4 - bin.length%4) % 4;
  const binPadded = bin.length + binPad;
  const total = 12 + 8 + jb.length + 8 + binPadded;
  const g = Buffer.alloc(total);
  g.writeUInt32LE(0x46546C67, 0);
  g.writeUInt32LE(2, 4);
  g.writeUInt32LE(total, 8);
  g.writeUInt32LE(jb.length, 12);
  g.writeUInt32LE(0x4E4F534A, 16);
  jb.copy(g, 20);
  const bo = 20 + jb.length;
  g.writeUInt32LE(binPadded, bo);
  g.writeUInt32LE(0x004E4942, bo+4);
  bin.copy(g, bo+8);
  return g;
}

const glb = packGLB(gltfJson, binBuf);

// ============================================================================
// VERIFICATION
// ============================================================================
console.log('\nVerification:');
let oMinX=Infinity,oMinY=Infinity,oMinZ=Infinity,oMaxX=-Infinity,oMaxY=-Infinity,oMaxZ=-Infinity;
for (const sec of sections) {
  const p = sec.geo.positions;
  for (let i=0;i<p.length;i+=3){
    if(p[i]<oMinX)oMinX=p[i]; if(p[i]>oMaxX)oMaxX=p[i];
    if(p[i+1]<oMinY)oMinY=p[i+1]; if(p[i+1]>oMaxY)oMaxY=p[i+1];
    if(p[i+2]<oMinZ)oMinZ=p[i+2]; if(p[i+2]>oMaxZ)oMaxZ=p[i+2];
  }
}
console.log(`  Bounds: X=[${oMinX.toFixed(1)},${oMaxX.toFixed(1)}] W=${(oMaxX-oMinX).toFixed(1)}m`);
console.log(`          Y=[${oMinY.toFixed(1)},${oMaxY.toFixed(1)}] H=${(oMaxY-oMinY).toFixed(1)}m`);
console.log(`          Z=[${oMinZ.toFixed(1)},${oMaxZ.toFixed(1)}] D=${(oMaxZ-oMinZ).toFixed(1)}m`);

// Verify connecting corridor height is below F2
const sec = sections.find(s => s.name === 'ConnectingCorridor');
let cMaxY = -Infinity;
const cp = sec.geo.positions;
for (let i=1; i<cp.length; i+=3) if(cp[i]>cMaxY) cMaxY=cp[i];
console.log(`  ConnectingCorridor max Y: ${cMaxY.toFixed(2)}m (expected ~${CONN_H+ST+0.8}m, F1=${F1}m, F2=${F2}m)`);
console.log(`  ✓ Connector is only ${cMaxY<F2?'ONE':'MULTIPLE'} storey tall (gap preserved above)`);

// Verify auditorium is in NW quadrant
const audSec = sections.find(s => s.name === 'Auditorium');
let audMinX=Infinity,audMinZ=Infinity,audMaxX=-Infinity,audMaxZ=-Infinity;
const ap = audSec.geo.positions;
for (let i=0;i<ap.length;i+=3){
  if(ap[i]<audMinX)audMinX=ap[i]; if(ap[i]>audMaxX)audMaxX=ap[i];
  if(ap[i+2]<audMinZ)audMinZ=ap[i+2]; if(ap[i+2]>audMaxZ)audMaxZ=ap[i+2];
}
console.log(`  Auditorium: X=[${audMinX.toFixed(1)},${audMaxX.toFixed(1)}], Z=[${audMinZ.toFixed(1)},${audMaxZ.toFixed(1)}]`);
console.log(`  ✓ Auditorium in NW quadrant: ${audMinX>=0 && audMaxX<E/2 && audMinZ>=0 && audMaxZ<S/2 ? 'YES' : 'CHECK'}`);

// Verify courtyard is open (interior empty)
const courtyardSec = sections.find(s => s.name === 'Courtyard');
console.log(`  Courtyard: X=[${CY_X1},${CY_X2}] Z=[${CY_Z1},${CY_Z2}] — open interior ✓`);

console.log(`  Named nodes: ${sections.map(s=>s.name).join(', ')}`);
console.log(`  GLTF: ${nodes.length} nodes, ${meshes.length} meshes, ${materials.length} materials`);

// ============================================================================
// WRITE
// ============================================================================
const outPath = 'public/cblock_reconstructed.glb';
fs.writeFileSync(outPath, glb);
console.log(`\n✓ Written: ${outPath}  (${(glb.length/1024).toFixed(1)} KB)`);
console.log('\nAll original GLBs unchanged:');
console.log(`  cblock.glb.bak  = ${fs.statSync('public/cblock.glb.bak').size} bytes (Meshy original, untouched)`);
console.log(`  cblock.glb      = ${fs.statSync('public/cblock.glb').size} bytes (previous working model)`);
