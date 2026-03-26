#!/usr/bin/env node
/**
 * Converts Atlas/geojson/boundary.svg paths → public/venue-chrome.geojson
 * Run with: npx tsx scripts/convertBoundary.ts
 *
 * Produces GeoJSON features:
 *   - arena-boundary: the oval arena polygon
 *   - court: the basketball court polygon
 */
import { writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// --- Coordinate transform: SVG (490x357) → synthetic lat/lng ---
const SVG_W = 490;
const SVG_H = 357;
const LNG_MIN = 0.0003;
const LNG_MAX = 0.0961;
const LAT_TOP = -0.0036;    // SVG y=0
const LAT_BOTTOM = -0.0726; // SVG y=357

function toLL(x: number, y: number): [number, number] {
  const lng = LNG_MIN + (x / SVG_W) * (LNG_MAX - LNG_MIN);
  const lat = LAT_TOP + (y / SVG_H) * (LAT_BOTTOM - LAT_TOP);
  return [lng, lat];
}

// --- Bezier sampling ---
type Pt = [number, number];

function cubicBezier(p0: Pt, p1: Pt, p2: Pt, p3: Pt, t: number): Pt {
  const mt = 1 - t;
  return [
    mt*mt*mt*p0[0] + 3*mt*mt*t*p1[0] + 3*mt*t*t*p2[0] + t*t*t*p3[0],
    mt*mt*mt*p0[1] + 3*mt*mt*t*p1[1] + 3*mt*t*t*p2[1] + t*t*t*p3[1],
  ];
}

/** Returns STEPS intermediate points (excludes start, includes end) */
function sampleCubic(p0: Pt, p1: Pt, p2: Pt, p3: Pt, steps = 20): Pt[] {
  const pts: Pt[] = [];
  for (let i = 1; i <= steps; i++) {
    pts.push(cubicBezier(p0, p1, p2, p3, i / steps));
  }
  return pts;
}

// --- Arena boundary path ---
// M444 48.7 C474.13 84.53 489.2 127.77 489.2 178.4
//   C489.2 229.03 474.13 272.27 444 308.1
//   C423.73 332.13 400.67 348.1 374.8 356
//   H114.45
//   C90.25 347.27 68.45 332 49.05 310.2
//   C16.68 273.8 0.5 229.88 0.5 178.45
//   C0.5 127.02 16.68 83.07 49.05 46.7
//   C68.75 24.57 90.92 9.17 115.55 0.5
//   H373.65
//   C399.98 8.27 423.43 24.33 444 48.7 Z
function buildArenaPoints(): Pt[] {
  const pts: Pt[] = [];
  const start: Pt = [444, 48.7];
  pts.push(start);

  const segments: Array<{ p0: Pt; p1: Pt; p2: Pt; p3: Pt } | { line: Pt }> = [
    { p0: [444, 48.7],    p1: [474.13, 84.53],  p2: [489.2, 127.77], p3: [489.2, 178.4]  },
    { p0: [489.2, 178.4], p1: [489.2, 229.03],  p2: [474.13, 272.27],p3: [444, 308.1]    },
    { p0: [444, 308.1],   p1: [423.73, 332.13], p2: [400.67, 348.1], p3: [374.8, 356]    },
    { line: [114.45, 356] },
    { p0: [114.45, 356],  p1: [90.25, 347.27],  p2: [68.45, 332],    p3: [49.05, 310.2]  },
    { p0: [49.05, 310.2], p1: [16.68, 273.8],   p2: [0.5, 229.88],   p3: [0.5, 178.45]   },
    { p0: [0.5, 178.45],  p1: [0.5, 127.02],    p2: [16.68, 83.07],  p3: [49.05, 46.7]   },
    { p0: [49.05, 46.7],  p1: [68.75, 24.57],   p2: [90.92, 9.17],   p3: [115.55, 0.5]   },
    { line: [373.65, 0.5] },
    { p0: [373.65, 0.5],  p1: [399.98, 8.27],   p2: [423.43, 24.33], p3: [444, 48.7]     },
  ];

  for (const seg of segments) {
    if ('line' in seg) {
      pts.push(seg.line);
    } else {
      pts.push(...sampleCubic(seg.p0, seg.p1, seg.p2, seg.p3));
    }
  }

  // Close
  pts.push(start);
  return pts.map(([x, y]) => toLL(x, y));
}

// --- Basketball court path ---
// M336.01 167.78 V193.68
//   C333.71 217.11 312.14 217.77 312.14 217.77
//   H181.1
//   C157.72 215.46 157.23 194.18 157.23 194.18
//   V165.8
//   C159.53 142.7 180.44 142.37 180.44 142.37
//   H311.47
//   C336 144.19 336 167.78 336 167.78 Z
function buildCourtPoints(): Pt[] {
  const pts: Pt[] = [];
  const start: Pt = [336.01, 167.78];
  pts.push(start);

  const segments: Array<{ p0: Pt; p1: Pt; p2: Pt; p3: Pt } | { line: Pt }> = [
    { line: [336.01, 193.68] },
    { p0: [336.01, 193.68], p1: [333.71, 217.11], p2: [312.14, 217.77], p3: [312.14, 217.77] },
    { line: [181.1, 217.77] },
    { p0: [181.1, 217.77],  p1: [157.72, 215.46], p2: [157.23, 194.18], p3: [157.23, 194.18] },
    { line: [157.23, 165.8] },
    { p0: [157.23, 165.8],  p1: [159.53, 142.7],  p2: [180.44, 142.37], p3: [180.44, 142.37] },
    { line: [311.47, 142.37] },
    { p0: [311.47, 142.37], p1: [336, 144.19],    p2: [336, 167.78],    p3: [336, 167.78]    },
  ];

  for (const seg of segments) {
    if ('line' in seg) {
      pts.push(seg.line);
    } else {
      pts.push(...sampleCubic(seg.p0, seg.p1, seg.p2, seg.p3, 10));
    }
  }

  pts.push(start);
  return pts.map(([x, y]) => toLL(x, y));
}

// --- Bench (center scorer's table) ---
// M257.75 225.95 H235.95 V219.3 H257.75 V225.95 Z
function buildBenchPoints(): Pt[] {
  return ([ [257.75, 225.95], [235.95, 225.95], [235.95, 219.3], [257.75, 219.3], [257.75, 225.95] ] as Pt[])
    .map(([x, y]) => toLL(x, y));
}

// --- GeoJSON assembly ---
const geojson = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      id: 'arena-boundary',
      geometry: { type: 'Polygon', coordinates: [buildArenaPoints()] },
      properties: { featureType: 'arena-boundary' },
    },
    {
      type: 'Feature',
      id: 'court',
      geometry: { type: 'Polygon', coordinates: [buildCourtPoints()] },
      properties: { featureType: 'court' },
    },
    {
      type: 'Feature',
      id: 'bench',
      geometry: { type: 'Polygon', coordinates: [buildBenchPoints()] },
      properties: { featureType: 'bench' },
    },
  ],
};

const outPath = join(__dirname, '..', 'public', 'venue-chrome.geojson');
writeFileSync(outPath, JSON.stringify(geojson, null, 2));
console.log(`Written: ${outPath}`);
