import { describe, expect, it } from 'vitest';
import { ZONE_LISTINGS } from '../data/listings';
import { SHAPES_BY_ZONE } from '../data/venue';
import { buildPins, type PinContext } from './pins';
import type { Filters } from '../types';

const NO_FILTER: Filters = { quantity: 1, priceMin: 0, priceMax: Number.MAX_SAFE_INTEGER };
const NOTHING: PinContext = {
  selectedShapeIds: [],
  collapsedZoneIds: [],
  selectedListingId: null,
};

const LLC = 'longside-lower-central';
const llcShapes = (SHAPES_BY_ZONE.get(LLC) ?? []).map((s) => s.shapeId);
const cheapestIn = (predicate: (l: (typeof ZONE_LISTINGS)[number]) => boolean) =>
  Math.min(...ZONE_LISTINGS.filter(predicate).map((l) => l.price));

describe('pins with nothing selected', () => {
  it('gives every section with section-level inventory its own pin', () => {
    const pins = buildPins(ZONE_LISTINGS, NO_FILTER, NOTHING);
    const keys = pins.map((p) => p.key);
    expect(keys).toContain('shape:119');
    // 121 and VIP2 have no sectioned listings, so nothing to price.
    expect(keys).not.toContain('shape:121');
    expect(keys).not.toContain('shape:VIP2');
    expect(pins.every((p) => p.target.kind === 'shape')).toBe(true);
  });

  it('prices a section pin from that section only', () => {
    const pins = buildPins(ZONE_LISTINGS, NO_FILTER, NOTHING);
    expect(pins.find((p) => p.key === 'shape:119')!.price).toBe(
      cheapestIn((l) => l.shapeId === '119'),
    );
  });
});

describe('a zone the highlight covers whole', () => {
  const pins = buildPins(ZONE_LISTINGS, NO_FILTER, { ...NOTHING, collapsedZoneIds: [LLC] });

  it('collapses to exactly one pin for the zone', () => {
    const inZone = pins.filter(
      (p) => p.key === `zone:${LLC}` || llcShapes.includes(p.anchorShapeId),
    );
    expect(inZone).toHaveLength(1);
    expect(inZone[0]!.key).toBe(`zone:${LLC}`);
    expect(inZone[0]!.target).toEqual({ kind: 'zone', zoneId: LLC });
  });

  it('prices it from the whole zone, zone-only inventory included', () => {
    const pin = pins.find((p) => p.key === `zone:${LLC}`)!;
    expect(pin.price).toBe(cheapestIn((l) => l.zoneId === LLC));
    // Cheaper than any single section's pin, which is the point.
    expect(pin.price).toBeLessThanOrEqual(cheapestIn((l) => l.shapeId === '119'));
  });

  it('leaves untouched zones alone', () => {
    expect(pins.some((p) => p.key === 'shape:AL3')).toBe(true);
  });

  it('shows the open listing instead of the cheapest, when there is one', () => {
    const dearest = ZONE_LISTINGS.filter((l) => l.zoneId === LLC).reduce((a, b) =>
      a.price >= b.price ? a : b,
    );
    const withSelection = buildPins(ZONE_LISTINGS, NO_FILTER, {
      ...NOTHING,
      collapsedZoneIds: [LLC],
      selectedListingId: dearest.listingId,
    });
    expect(withSelection.find((p) => p.key === `zone:${LLC}`)!.price).toBe(dearest.price);
  });
});

describe('a section picked on its own', () => {
  const pins = buildPins(ZONE_LISTINGS, NO_FILTER, { ...NOTHING, selectedShapeIds: ['119'] });

  it('keeps that section its own pin and collapses the rest of its zone', () => {
    const inZone = pins.filter((p) => llcShapes.includes(p.anchorShapeId));
    expect(inZone.map((p) => p.key).sort()).toEqual(['shape:119', `zone-rest:${LLC}`]);
  });

  it('prices the remainder from everything in the zone except that section', () => {
    const rest = pins.find((p) => p.key === `zone-rest:${LLC}`)!;
    expect(rest.price).toBe(cheapestIn((l) => l.zoneId === LLC && l.shapeId !== '119'));
    expect(rest.name).toBe('Elsewhere in Longside Lower Central');
  });

  it('anchors every pin to a real section of the venue', () => {
    expect(pins.every((p) => p.anchorShapeId.length > 0)).toBe(true);
    const rest = pins.find((p) => p.key === `zone-rest:${LLC}`)!;
    expect(llcShapes).toContain(rest.anchorShapeId);
  });
});

describe('a non-contiguous zone', () => {
  it('still anchors its single pin to one of its own sections', () => {
    // VIP is VIP1 at one end, VIP2 at the other and a corner of AU4, so the
    // zone centroid sits on the pitch — the anchor must not.
    const pins = buildPins(ZONE_LISTINGS, NO_FILTER, { ...NOTHING, collapsedZoneIds: ['vip'] });
    const pin = pins.find((p) => p.key === 'zone:vip')!;
    const vipShapes = (SHAPES_BY_ZONE.get('vip') ?? []).map((s) => s.shapeId);
    expect(vipShapes).toContain(pin.anchorShapeId);
  });
});

describe('filters', () => {
  it('prices pins from filtered inventory only', () => {
    const filters: Filters = { quantity: 1, priceMin: 0, priceMax: 40_000 };
    const pins = buildPins(ZONE_LISTINGS, filters, { ...NOTHING, collapsedZoneIds: [LLC] });
    const pin = pins.find((p) => p.key === `zone:${LLC}`);
    if (pin) expect(pin.price).toBeLessThanOrEqual(40_000);
    expect(pins.every((p) => p.price <= 40_000)).toBe(true);
  });
});
