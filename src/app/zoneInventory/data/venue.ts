import type { SectionShape, Venue, ZoneDef, ZoneId } from '../types';

/**
 * A schematic football stadium: a rectangular pitch ringed by four stands.
 * Geometry is authored in "stadium units" (x right, y down, 1200x900) and
 * projected to lng/lat by `toLngLat` so MapLibre can render it directly.
 */

export const UNIT_SCALE = 1 / 12000;
const CENTER_X = 600;
const CENTER_Y = 450;

/** Pitch rectangle in stadium units. */
export const PITCH = { x0: 320, y0: 330, x1: 880, y1: 570 };

export function toLngLat(x: number, y: number): [number, number] {
  return [x * UNIT_SCALE, -y * UNIT_SCALE];
}

/**
 * Stands splay outward as they rise, which is what makes the plan read as a
 * bowl rather than a grid. `k` scales a point away from the stadium centre by
 * how far past the pitch edge it sits.
 */
const SPLAY = 0.0009;
function kHorizontal(y: number): number {
  return 1 + Math.max(0, Math.abs(y - CENTER_Y) - 150) * SPLAY;
}
function kVertical(x: number): number {
  return 1 + Math.max(0, Math.abs(x - CENTER_X) - 280) * SPLAY;
}

interface BandSpec {
  /** Edge nearest the pitch, then the outer edge. */
  inner: number;
  outer: number;
  /** One entry per section, inner edge → outer edge order preserved. */
  sections: Array<{ shapeId: string; sectionLabel: string; zoneId: ZoneId }>;
}

const GAP = 10;

/** Sections laid left→right along the north or south stand. */
function horizontalBand(spec: BandSpec): SectionShape[] {
  const { inner, outer, sections } = spec;
  const kIn = kHorizontal(inner);
  const kOut = kHorizontal(outer);
  const span = (PITCH.x1 - PITCH.x0 - GAP * (sections.length - 1)) / sections.length;
  return sections.map((section, i) => {
    const xa = PITCH.x0 + i * (span + GAP);
    const xb = xa + span;
    const px = (x: number, k: number) => CENTER_X + (x - CENTER_X) * k;
    return {
      ...section,
      ring: [
        [px(xa, kIn), inner],
        [px(xb, kIn), inner],
        [px(xb, kOut), outer],
        [px(xa, kOut), outer],
      ] as Array<[number, number]>,
    };
  });
}

/** Sections laid top→bottom along the east or west stand. */
function verticalBand(spec: BandSpec): SectionShape[] {
  const { inner, outer, sections } = spec;
  const kIn = kVertical(inner);
  const kOut = kVertical(outer);
  const span = (PITCH.y1 - PITCH.y0 - GAP * (sections.length - 1)) / sections.length;
  return sections.map((section, i) => {
    const ya = PITCH.y0 + i * (span + GAP);
    const yb = ya + span;
    const py = (y: number, k: number) => CENTER_Y + (y - CENTER_Y) * k;
    return {
      ...section,
      ring: [
        [inner, py(ya, kIn)],
        [inner, py(yb, kIn)],
        [outer, py(yb, kOut)],
        [outer, py(ya, kOut)],
      ] as Array<[number, number]>,
    };
  });
}

function box(
  shapeId: string,
  sectionLabel: string,
  zoneId: ZoneId,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
): SectionShape {
  return {
    shapeId,
    sectionLabel,
    zoneId,
    ring: [
      [x0, y0],
      [x1, y0],
      [x1, y1],
      [x0, y1],
    ],
  };
}

export const ZONES: ZoneDef[] = [
  { id: 'longside-lower-central', name: 'Longside Lower Central' },
  { id: 'longside-upper-central', name: 'Longside Upper Central' },
  { id: 'shortside-lower', name: 'Shortside Lower' },
  { id: 'shortside-upper', name: 'Shortside Upper' },
  { id: 'vip', name: 'VIP' },
];

export const ZONE_NAME: Record<ZoneId, string> = ZONES.reduce(
  (acc, z) => ({ ...acc, [z.id]: z.name }),
  {} as Record<ZoneId, string>,
);

/**
 * One color per zone, drawn from the same family as the base prototype's
 * `ZONE_TIER_COLORS`, so the two maps read as one system. This is the single
 * source for both the map's section fill and the listing row's accent bar —
 * the bar only means anything because it repeats the fill the buyer just saw.
 */
export const ZONE_COLOR: Record<ZoneId, string> = {
  'longside-lower-central': '#D45196',
  'longside-upper-central': '#4C85D0',
  'shortside-lower': '#30C096',
  'shortside-upper': '#8B74D8',
  vip: '#B99872',
};

/** Zones the seller's text never matched have no color to show. */
export const NO_ZONE_COLOR = '#D3D3DC';

/** Map fill expression input: flattens ZONE_COLOR into match-expression pairs. */
export const ZONE_COLOR_MATCH_PAIRS: string[] = Object.entries(ZONE_COLOR).flat();

const SHAPES: SectionShape[] = [
  // North stand (top of plan) — lower tier closest to the pitch.
  ...horizontalBand({
    inner: 300,
    outer: 212,
    sections: [
      { shapeId: '119', sectionLabel: '119', zoneId: 'longside-lower-central' },
      { shapeId: '120', sectionLabel: '120', zoneId: 'longside-lower-central' },
      { shapeId: '121', sectionLabel: '121', zoneId: 'longside-lower-central' },
      { shapeId: '122', sectionLabel: '122', zoneId: 'longside-lower-central' },
    ],
  }),
  ...horizontalBand({
    inner: 198,
    outer: 110,
    sections: [
      { shapeId: '219', sectionLabel: '219', zoneId: 'longside-upper-central' },
      { shapeId: '220', sectionLabel: '220', zoneId: 'longside-upper-central' },
      { shapeId: '221', sectionLabel: '221', zoneId: 'longside-upper-central' },
    ],
  }),
  // South stand — the other half of Longside Lower Central, deliberately
  // non-contiguous with 119-122 so zone tinting has to span the whole plan.
  ...horizontalBand({
    inner: 600,
    outer: 688,
    sections: [
      { shapeId: '103', sectionLabel: '103', zoneId: 'longside-lower-central' },
      { shapeId: '104', sectionLabel: '104', zoneId: 'longside-lower-central' },
      { shapeId: '105', sectionLabel: '105', zoneId: 'longside-lower-central' },
    ],
  }),
  ...horizontalBand({
    inner: 702,
    outer: 790,
    sections: [
      { shapeId: '203', sectionLabel: '203', zoneId: 'longside-upper-central' },
      { shapeId: '204', sectionLabel: '204', zoneId: 'longside-upper-central' },
      { shapeId: '205', sectionLabel: '205', zoneId: 'longside-upper-central' },
    ],
  }),
  // West stand (shortside).
  ...verticalBand({
    inner: 320,
    outer: 232,
    sections: [
      { shapeId: 'AL1', sectionLabel: 'AL1', zoneId: 'shortside-lower' },
      { shapeId: 'AL2', sectionLabel: 'AL2', zoneId: 'shortside-lower' },
    ],
  }),
  ...verticalBand({
    inner: 218,
    outer: 130,
    sections: [
      { shapeId: 'AU1', sectionLabel: 'AU1', zoneId: 'shortside-upper' },
      { shapeId: 'AU2', sectionLabel: 'AU2', zoneId: 'shortside-upper' },
    ],
  }),
  // East stand (shortside).
  ...verticalBand({
    inner: 880,
    outer: 968,
    sections: [
      { shapeId: 'AL3', sectionLabel: 'AL3', zoneId: 'shortside-lower' },
      { shapeId: 'AL4', sectionLabel: 'AL4', zoneId: 'shortside-lower' },
    ],
  }),
  // AU4 is one section split between two zones, drawn as two shapes.
  ...verticalBand({
    inner: 982,
    outer: 1070,
    sections: [
      { shapeId: 'AU3', sectionLabel: 'AU3', zoneId: 'shortside-upper' },
      { shapeId: 'AU4-SU', sectionLabel: 'AU4', zoneId: 'shortside-upper' },
      { shapeId: 'AU4-VIP', sectionLabel: 'AU4', zoneId: 'vip' },
    ],
  }),
  // Executive boxes in the north corners — VIP is non-contiguous too.
  box('VIP1', 'VIP1', 'vip', 152, 176, 272, 266),
  box('VIP2', 'VIP2', 'vip', 928, 176, 1048, 266),
];

export const VENUE: Venue = { shapes: SHAPES, zones: ZONES };

export const SHAPE_BY_ID = new Map(SHAPES.map((s) => [s.shapeId, s]));

export const SHAPES_BY_ZONE = SHAPES.reduce((acc, shape) => {
  const list = acc.get(shape.zoneId) ?? [];
  list.push(shape);
  acc.set(shape.zoneId, list);
  return acc;
}, new Map<ZoneId, SectionShape[]>());

/** Average of the ring vertices — good enough for a label or pin anchor. */
export function shapeCenter(shape: SectionShape): [number, number] {
  const sx = shape.ring.reduce((a, p) => a + p[0], 0) / shape.ring.length;
  const sy = shape.ring.reduce((a, p) => a + p[1], 0) / shape.ring.length;
  return [sx, sy];
}

export function sectionsGeoJson(): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: SHAPES.map((shape) => ({
      type: 'Feature',
      id: shape.shapeId,
      properties: {
        shapeId: shape.shapeId,
        sectionLabel: shape.sectionLabel,
        zoneId: shape.zoneId,
      },
      geometry: {
        type: 'Polygon',
        coordinates: [[...shape.ring, shape.ring[0]!].map(([x, y]) => toLngLat(x, y))],
      },
    })),
  };
}

export function labelsGeoJson(): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: SHAPES.map((shape) => {
      const [cx, cy] = shapeCenter(shape);
      return {
        type: 'Feature',
        properties: { shapeId: shape.shapeId, sectionLabel: shape.sectionLabel },
        geometry: { type: 'Point', coordinates: toLngLat(cx, cy) },
      };
    }),
  };
}

/** Pitch outline plus halfway line and centre circle, as map chrome. */
export function pitchGeoJson(): GeoJSON.FeatureCollection {
  const { x0, y0, x1, y1 } = PITCH;
  const midX = (x0 + x1) / 2;
  const circle: Array<[number, number]> = Array.from({ length: 48 }, (_, i) => {
    const t = (i / 48) * Math.PI * 2;
    return [midX + Math.cos(t) * 46, CENTER_Y + Math.sin(t) * 46];
  });
  return {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        properties: { kind: 'pitch' },
        geometry: {
          type: 'Polygon',
          coordinates: [
            [
              toLngLat(x0, y0),
              toLngLat(x1, y0),
              toLngLat(x1, y1),
              toLngLat(x0, y1),
              toLngLat(x0, y0),
            ],
          ],
        },
      },
      {
        type: 'Feature',
        properties: { kind: 'markings' },
        geometry: {
          type: 'MultiLineString',
          coordinates: [
            [toLngLat(midX, y0), toLngLat(midX, y1)],
            [...circle, circle[0]!].map(([x, y]) => toLngLat(x, y)),
          ],
        },
      },
    ],
  };
}

/** [southwest, northeast] — y grows downward in stadium units, so y flips. */
export const VENUE_BOUNDS: [[number, number], [number, number]] = [
  toLngLat(110, 810),
  toLngLat(1090, 90),
];
