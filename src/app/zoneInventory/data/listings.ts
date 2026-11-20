import { createSeededRandom } from '../../seatMap/mock/seededRandom';
import type { ZoneId, ZoneListing } from '../types';
import { SHAPE_BY_ID, ZONE_NAME } from './venue';

/**
 * Mock inventory for the zone prototype. Counts are declared explicitly rather
 * than sampled so the seven demo states are exact: 119 is the busy section,
 * 122 has only 2 exact listings, and 121 has none at all.
 *
 * The mix leans hard toward zone-only inventory, because that is what these
 * events actually look like — a section number is the exception, not the rule.
 */

/**
 * Exact-section listings, keyed by the shape they belong to. 21 total — a
 * deliberate minority. On this inventory a seller who names a section is the
 * exception, so most shapes have one listing or none, and 119's nine exist only
 * because the busy-section state needs somewhere busy to point at.
 */
const EXACT_COUNTS: Record<string, number> = {
  '119': 9,
  '120': 1,
  '121': 0,
  '122': 2,
  '103': 1,
  '104': 0,
  '105': 1,
  '219': 1,
  '220': 0,
  '221': 1,
  '203': 0,
  '204': 0,
  '205': 1,
  AL1: 0,
  AL2: 0,
  AL3: 1,
  AL4: 0,
  AU1: 0,
  AU2: 0,
  AU3: 0,
  'AU4-SU': 1,
  VIP1: 1,
  VIP2: 0,
  'AU4-VIP': 1,
};

/** Zone-only listings: a zone name, no section. 53 total — the common case. */
const ZONE_ONLY_COUNTS: Record<ZoneId, number> = {
  'longside-lower-central': 22,
  'longside-upper-central': 12,
  'shortside-lower': 8,
  'shortside-upper': 7,
  vip: 4,
};

/**
 * Seller zone strings that match no zone in this venue. These listings must
 * never reach the panel or the map — "AU4" alone is ambiguous because AU4 is
 * split between Shortside Upper and VIP.
 */
const UNMATCHED_ZONES = [
  'AU4',
  'AU4',
  'Longside',
  'Block 7',
  'Category 1',
  'Tribuna Est',
  'General Admission',
  'Zone B',
];

/** Price band per zone, in whole dollars. */
const PRICE_BAND: Record<ZoneId, [number, number]> = {
  'shortside-upper': [167, 420],
  'longside-upper-central': [205, 560],
  'shortside-lower': [240, 690],
  'longside-lower-central': [315, 1150],
  vip: [880, 2596],
};

/** Rows arrive unreliable far more often than not. */
const PLACEHOLDER_ROWS = ['***', 'N/A', 'TBC', 'TBD'];
const REAL_ROWS = ['3', '7', '12', '18', 'A', 'C'];

export function createZoneListings(seed = 20_251_119): ZoneListing[] {
  const rng = createSeededRandom(seed);
  const listings: ZoneListing[] = [];
  let n = 0;

  const nextRow = (): string | null => {
    const roll = rng.random();
    if (roll < 0.15) return REAL_ROWS[rng.randInt(0, REAL_ROWS.length)]!;
    if (roll < 0.55) return PLACEHOLDER_ROWS[rng.randInt(0, PLACEHOLDER_ROWS.length)]!;
    return null;
  };

  const nextPrice = (zoneId: ZoneId): number => {
    const [lo, hi] = PRICE_BAND[zoneId];
    return (lo + Math.round(rng.random() * (hi - lo))) * 100;
  };

  /**
   * Deal score leans on where the price sits in its zone's band — a cheap seat
   * in an expensive zone scores well — plus noise, so the two sort orders
   * differ without being unrelated.
   */
  const dealScoreFor = (zoneId: ZoneId | null, price: number): number => {
    if (!zoneId) return 5;
    const [lo, hi] = PRICE_BAND[zoneId];
    const position = (price / 100 - lo) / Math.max(1, hi - lo);
    const score = 8.0 - position * 5.4 + (rng.random() - 0.5) * 2.4;
    return Math.round(Math.min(10, Math.max(3, score)) * 10) / 10;
  };

  const push = (
    shapeId: string | null,
    sectionLabel: string | null,
    zoneId: ZoneId | null,
    rawZone: string,
  ) => {
    const quantity = [1, 2, 2, 2, 3, 4, 4, 6][rng.randInt(0, 8)]!;
    const price = zoneId ? nextPrice(zoneId) : 30_000;
    listings.push({
      listingId: `zl-${String(++n).padStart(3, '0')}`,
      shapeId,
      sectionLabel,
      zoneId,
      rawZone,
      row: nextRow(),
      quantity,
      price,
      dealScore: dealScoreFor(zoneId, price),
    });
  };

  for (const [shapeId, count] of Object.entries(EXACT_COUNTS)) {
    const shape = SHAPE_BY_ID.get(shapeId);
    if (!shape) throw new Error(`Unknown shape in EXACT_COUNTS: ${shapeId}`);
    for (let i = 0; i < count; i++) {
      push(shapeId, shape.sectionLabel, shape.zoneId, ZONE_NAME[shape.zoneId]);
    }
  }

  for (const [zoneId, count] of Object.entries(ZONE_ONLY_COUNTS) as Array<[ZoneId, number]>) {
    for (let i = 0; i < count; i++) {
      push(null, null, zoneId, ZONE_NAME[zoneId]);
    }
  }

  for (const rawZone of UNMATCHED_ZONES) {
    // Some unmatched listings still carry a section number; the missing zone
    // is what disqualifies them, not the missing section.
    const label = rawZone === 'AU4' ? 'AU4' : null;
    push(null, label, null, rawZone);
  }

  // Pin the extremes so the advertised range is exact.
  const priced = listings.filter((l) => l.zoneId !== null);
  const cheapest = priced.reduce((a, b) => (a.price <= b.price ? a : b));
  const dearest = priced.reduce((a, b) => (a.price >= b.price ? a : b));
  cheapest.price = 16_700;
  cheapest.dealScore = 9.6;
  dearest.price = 259_600;
  dearest.dealScore = 3.4;

  return listings;
}

export const ZONE_LISTINGS: ZoneListing[] = createZoneListings();
